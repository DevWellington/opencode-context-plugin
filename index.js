import fs from "fs/promises";
import path from "path";
import { getWeek, getWeekYear } from "date-fns";

const LOG_FILE = path.join(process.env.HOME || '', '.opencode-context-plugin.log');
const CONTEXT_SESSION_DIR = '.opencode/context-session';
const OLD_CONTEXTOS_DIR = '.opencode/contextos';

function debugLog(message) {
  // Debug logging is best-effort, don't block on errors
  const timestamp = new Date().toISOString();
  fs.appendFile(LOG_FILE, `[${timestamp}] ${message}\n`).catch(() => {});
}

async function ensureContextSessionDir(directory) {
  const ctxDir = path.join(directory, CONTEXT_SESSION_DIR);
  try {
    await fs.access(ctxDir);
  } catch {
    await fs.mkdir(ctxDir, { recursive: true });
    debugLog(`[context-plugin] Created directory: ${ctxDir}`);
  }
  return ctxDir;
}

async function ensureHierarchicalDir(baseDir) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const weekNum = getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const week = `W${String(weekNum).padStart(2, '0')}`;
  const day = String(now.getDate()).padStart(2, '0');
  
  const dirPath = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week, day);
  
  await fs.mkdir(dirPath, { recursive: true });
  debugLog(`[context-plugin] Created hierarchical directory: ${dirPath}`);
  
  return { dirPath, year, month, week, day };
}

async function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  
  try {
    await fs.writeFile(tempFile, content, 'utf-8');
    await fs.rename(tempFile, filePath);
    debugLog(`[context-plugin] Atomic write completed: ${filePath}`);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempFile);
    } catch {}
    throw error;
  }
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function extractSessionSummary(session) {
  if (!session) return null;
  
  const messages = session.messages || [];
  return {
    sessionId: session.id || session.sessionID,
    slug: session.slug,
    title: session.title,
    messageCount: messages.length,
    messages: messages.map((m, i) => ({
      index: i,
      role: m.role,
      type: m.type,
      content: m.content || ''
    }))
  };
}

async function saveContext(directory, session, type = 'compact') {
  try {
    const pathComponents = await ensureHierarchicalDir(directory);
    const { dirPath, year, month, week, day } = pathComponents;
    const timestamp = getTimestamp();
    const filename = `${type}-${timestamp}.md`;
    const filepath = path.join(dirPath, filename);
    
    const summary = extractSessionSummary(session);
    
    let content = `# Session Context - ${type.toUpperCase()}\n\n`;
    content += `**Session ID:** ${summary.sessionId}\n`;
    content += `**Slug:** ${summary.slug}\n`;
    content += `**Title:** ${summary.title}\n`;
    content += `**Timestamp:** ${new Date().toISOString()}\n`;
    content += `**Message Count:** ${summary.messageCount}\n\n`;
    content += `---\n\n`;
    content += `## Messages\n\n`;
    
    summary.messages.forEach((msg) => {
      const preview = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '\n\n*(truncated)*' : msg.content;
      content += `### Message ${msg.index} [${msg.role}]\n\n`;
      content += `${preview}\n\n`;
    });
    
    await atomicWrite(filepath, content);
    debugLog(`[context-plugin] Saved context to: ${filepath}`);
    console.log(`[context-plugin] Context saved: ${filename}`);
    
    // Update day summary
    await updateDaySummary(dirPath, { type, filename, year, month, day });
    
    // Update week summary (idempotent, safe to call every time)
    await updateWeekSummary(directory, year, month, week);
    
    return filepath;
  } catch (error) {
    debugLog(`[context-plugin] Error saving context: ${error.message}`);
    console.error(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}

// In-memory lock for daily summary updates to prevent race conditions
let dailySummaryLock = Promise.resolve();

async function updateDailySummary(baseDir, sessionInfo) {
  try {
    const summaryPath = path.join(baseDir, CONTEXT_SESSION_DIR, 'daily-summary.md');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Use lock to serialize writes and prevent race conditions
    await dailySummaryLock;
    
    let updatePromise = (async () => {
      // Read existing summary or create new
      let content = '';
      let existingEntries = [];
      let currentHeader = null;
      
      try {
        content = await fs.readFile(summaryPath, 'utf-8');
        
        // Parse existing content to extract entries and current date header
        const lines = content.split('\n');
        const entriesStart = lines.findIndex(line => line.startsWith('- ['));
        
        if (entriesStart !== -1) {
          // Extract existing entries
          for (let i = entriesStart; i < lines.length; i++) {
            if (lines[i].startsWith('- [')) {
              existingEntries.push(lines[i]);
            }
          }
          
          // Check current date header
          const dateHeaderIdx = lines.findIndex(line => line.startsWith('## '));
          if (dateHeaderIdx !== -1) {
            currentHeader = lines[dateHeaderIdx].replace('## ', '').trim();
          }
        }
      } catch (e) {
        // File doesn't exist yet
        content = `# Daily Summary\n\n`;
      }
      
      // Check if we need to update the date header (new day)
      if (currentHeader !== today) {
        // New day - reset content with new date header
        content = `# Daily Summary\n\n## ${today}\n`;
        existingEntries = [];
      }
      
      // Format new entry
      const typeEmoji = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
      const newEntry = `- [${sessionInfo.timestamp}] ${typeEmoji}: ${sessionInfo.filename}`;
      
      // Check if filename already exists (idempotency)
      const alreadyExists = existingEntries.some(entry => entry.includes(sessionInfo.filename));
      
      if (!alreadyExists) {
        existingEntries.push(newEntry);
        
        // Calculate statistics
        const totalSessions = existingEntries.length;
        const compactCount = existingEntries.filter(e => e.includes('📦')).length;
        const exitCount = existingEntries.filter(e => e.includes('🚪')).length;
        
        // Build final content
        let finalContent = content;
        finalContent += `\n**Total Sessions:** ${totalSessions}\n`;
        finalContent += `**Compacts:** ${compactCount} | **Exits:** ${exitCount}\n\n`;
        finalContent += existingEntries.join('\n') + '\n';
        
        await atomicWrite(summaryPath, finalContent);
        debugLog(`[context-plugin] Updated daily summary: ${summaryPath}`);
      }
    })();
    
    // Update lock to wait for this operation
    dailySummaryLock = updatePromise.catch(() => {});
    await dailySummaryLock;
    
  } catch (error) {
    debugLog(`[context-plugin] Error updating daily summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

async function updateDaySummary(dirPath, sessionInfo) {
  try {
    const summaryPath = path.join(dirPath, 'day-summary.md');
    
    // Read existing summary or create new
    let content = '';
    try {
      content = await fs.readFile(summaryPath, 'utf-8');
    } catch (e) {
      // File doesn't exist yet
      content = `# Day Summary\n\n`;
      content += `**Date:** ${sessionInfo.year}-${sessionInfo.month}-${sessionInfo.day}\n\n`;
      content += `## Sessions\n\n`;
    }
    
    // Append new session info
    const timestamp = new Date().toISOString();
    const type = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
    const entry = `- [${timestamp}] ${type}: ${sessionInfo.filename}\n`;
    
    // Check if already recorded (idempotency)
    if (!content.includes(sessionInfo.filename)) {
      content += entry;
      await atomicWrite(summaryPath, content);
      debugLog(`[context-plugin] Updated day summary: ${summaryPath}`);
    }
  } catch (error) {
    debugLog(`[context-plugin] Error updating day summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

async function updateWeekSummary(baseDir, year, month, week) {
  try {
    const weekDir = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week);
    const summaryPath = path.join(weekDir, 'week-summary.md');
    
    // Read day directories
    let dayDirs = [];
    try {
      const entries = await fs.readdir(weekDir, { withFileTypes: true });
      dayDirs = entries
        .filter(d => d.isDirectory() && /^\d{2}$/.test(d.name))
        .map(d => d.name)
        .sort();
    } catch (e) {
      debugLog(`[context-plugin] Error reading week directory: ${e.message}`);
      return;
    }
    
    // Generate week summary from day folders
    let content = `# Week ${week} Summary\n\n`;
    content += `**Period:** ${year}-${month}\n`;
    content += `**Week:** ${week}\n\n`;
    content += `## Days\n\n`;
    
    for (const dayDir of dayDirs) {
      const dayPath = path.join(weekDir, dayDir);
      let files = [];
      try {
        files = await fs.readdir(dayPath);
      } catch (e) {
        continue;
      }
      
      const compacts = files.filter(f => f.startsWith('compact-')).length;
      const exits = files.filter(f => f.startsWith('exit-')).length;
      const summaries = files.filter(f => f.endsWith('-summary.md')).length;
      
      content += `### Day ${dayDir}\n\n`;
      content += `- 📦 Compact files: ${compacts}\n`;
      content += `- 🚪 Exit files: ${exits}\n`;
      content += `- 📄 Summary files: ${summaries}\n\n`;
    }
    
    content += `## Summary\n\n`;
    content += `Total days with sessions: ${dayDirs.length}\n`;
    
    await atomicWrite(summaryPath, content);
    debugLog(`[context-plugin] Updated week summary: ${summaryPath}`);
  } catch (error) {
    debugLog(`[context-plugin] Error updating week summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

async function triggerPreExitCompression(sessionId, directory, client) {
  try {
    debugLog(`[Pre-Exit] Triggering compression for session ${sessionId}`);
    
    // Fetch session data using client from closure
    let session;
    try {
      session = await client.sessions.get(sessionId);
    } catch (error) {
      debugLog(`[Pre-Exit] Failed to fetch session ${sessionId}: ${error.message}`);
      console.error(`[context-plugin] Pre-exit compression failed: ${error.message}`);
      return null;
    }
    
    if (!session) {
      debugLog(`[Pre-Exit] Session ${sessionId} not found, skipping compression`);
      return null;
    }
    
    debugLog(`[Pre-Exit] Session fetched successfully, ${session.messages?.length || 0} messages`);
    
    // Save context with type='exit'
    const result = await saveContext(directory, session, 'exit');
    
    if (result) {
      debugLog(`[Pre-Exit] Compression completed: ${result}`);
      console.log(`[context-plugin] Pre-exit compression completed: ${path.basename(result)}`);
    }
    
    return result;
  } catch (error) {
    debugLog(`[Pre-Exit] Error during compression: ${error.message}`);
    console.error(`[context-plugin] Pre-exit compression error: ${error.message}`);
    return null;
  }
}

async function loadPreviousContexts(directory, limit = 5) {
  try {
    const ctxDir = path.join(directory, CONTEXT_SESSION_DIR);
    try {
      await fs.access(ctxDir);
    } catch {
      return [];
    }
    
    const files = await fs.readdir(ctxDir);
    const mdFiles = files
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, limit);
    
    const contexts = await Promise.all(
      mdFiles.map(async (file) => {
        const filepath = path.join(ctxDir, file);
        const content = await fs.readFile(filepath, 'utf-8');
        return { file, content };
      })
    );
    
    debugLog(`[context-plugin] Loaded ${contexts.length} previous contexts`);
    return contexts;
  } catch (error) {
    debugLog(`[context-plugin] Error loading contexts: ${error.message}`);
    return [];
  }
}

async function migrateContextFiles(directory) {
  const oldDir = path.join(directory, OLD_CONTEXTOS_DIR);
  const newDir = path.join(directory, CONTEXT_SESSION_DIR);
  
  try {
    // Check if old directory exists
    try {
      await fs.access(oldDir);
    } catch {
      // Old directory doesn't exist, no migration needed
      return;
    }
    
    // Check if new directory already exists (migration already done)
    try {
      await fs.access(newDir);
      debugLog(`[context-plugin] New directory already exists, skipping migration`);
      return;
    } catch {
      // New directory doesn't exist, proceed with migration
    }
    
    debugLog(`[context-plugin] Starting migration from ${oldDir} to ${newDir}`);
    
    // Create new directory
    await fs.mkdir(newDir, { recursive: true });
    
    // Read old directory contents
    const oldFiles = await fs.readdir(oldDir);
    const mdFiles = oldFiles.filter(f => f.endsWith('.md'));
    
    let migratedCount = 0;
    for (const file of mdFiles) {
      const oldPath = path.join(oldDir, file);
      // Rename saida- to exit-
      const newFileName = file.replace(/^saida-/, 'exit-');
      const newPath = path.join(newDir, newFileName);
      
      try {
        await fs.rename(oldPath, newPath);
        migratedCount++;
        debugLog(`[context-plugin] Migrated: ${file} → ${newFileName}`);
      } catch (error) {
        debugLog(`[context-plugin] Failed to migrate ${file}: ${error.message}`);
      }
    }
    
    // Rename old directory to .deprecated
    const deprecatedDir = path.join(directory, '.opencode/.deprecated');
    await fs.rename(oldDir, deprecatedDir);
    
    debugLog(`[context-plugin] Migration complete: ${migratedCount}/${mdFiles.length} files migrated`);
    console.log(`[context-plugin] Migrated ${migratedCount} context files to new structure`);
  } catch (error) {
    debugLog(`[context-plugin] Migration error: ${error.message}`);
    // Don't block plugin initialization on migration failure
  }
}

function buildContextInjection(contexts) {
  if (contexts.length === 0) return '';
  
  let injection = `\n\n---\n## Previous Session Contexts\n\n`;
  injection += `*The following contexts from previous sessions are available for reference:*\n\n`;
  
  contexts.forEach(ctx => {
    injection += `### From: ${ctx.file}\n`;
    injection += `${ctx.content}\n\n`;
    injection += `---\n\n`;
  });
  
  return injection;
}

let currentSessionId = null;
let hasInjectedContext = false;
let lastSession = null;

export default async (input) => {
  const { directory, client } = input;
  
  debugLog(`[context-plugin] Loaded for: ${directory}`);
  console.log(`[context-plugin] Context Plugin loaded`);
  
  // Perform migration before ensuring new directory exists
  await migrateContextFiles(directory);
  await ensureContextSessionDir(directory);
  
  return {
    "event": async (eventInput) => {
      const event = eventInput?.event || eventInput;
      const eventType = event?.type;
      
      if (!eventType) return;
      
      if (eventType === "session.created") {
        currentSessionId = event?.sessionId || event?.sessionID || event?.session?.id;
        hasInjectedContext = false;
        lastSession = null;
        debugLog(`[context-plugin] Session created: ${currentSessionId}`);
      }
      
      if (eventType === "session.updated") {
        const info = event?.properties?.info;
        if (info) {
          if (!lastSession) lastSession = {};
          Object.assign(lastSession, info);
          debugLog(`[context-plugin] Session metadata updated`);
        }
      }
      
      if (eventType === "message.updated" || eventType === "message.created") {
        const msgInfo = event?.properties?.info;
        const msgId = msgInfo?.id;
        
        if (msgId && msgInfo?.role) {
          if (!lastSession) lastSession = { messages: [] };
          if (!lastSession.messages) lastSession.messages = [];
          
          const existingIdx = lastSession.messages.findIndex(m => m.id === msgId);
          if (existingIdx === -1) {
            lastSession.messages.push({ ...msgInfo, content: '' });
            debugLog(`[context-plugin] Message added: ${lastSession.messages.length} total`);
          } else {
            Object.assign(lastSession.messages[existingIdx], msgInfo);
          }
        }
      }
      
      if (eventType === "message.part.delta") {
        const msgId = event?.properties?.messageID;
        const delta = event?.properties?.delta;
        
        if (msgId && delta && lastSession?.messages) {
          const msg = lastSession.messages.find(m => m.id === msgId);
          if (msg) {
            msg.content = (msg.content || '') + delta;
          }
        }
      }
      
      if (eventType === "message.part.updated") {
        const msgId = event?.properties?.part?.messageID || event?.properties?.messageID;
        const text = event?.properties?.part?.text;
        
        if (msgId && text && lastSession?.messages) {
          const msg = lastSession.messages.find(m => m.id === msgId);
          if (msg && !msg.content) {
            msg.content = text;
            debugLog(`[context-plugin] Message content from part.updated: ${text.length} chars`);
          }
        }
      }
      
      if (eventType === "command.execute.before") {
        const command = event?.command || event?.properties?.command || event?.properties?.name;
        if (command === '/compact' || command === 'compact') {
          debugLog('[context-plugin] /compact command detected');
        }
      }
      
      if (eventType === "session.compacted" || eventType === "experimental.compaction.autocontinue") {
        debugLog('[context-plugin] session.compacted event received - saving context');
        if (lastSession) {
          await saveContext(directory, lastSession, 'compact');
        } else {
          debugLog('[context-plugin] No lastSession available for compact save');
        }
      }
      
      if (eventType === "session.end" || eventType === "server.instance.disposed") {
        debugLog('[context-plugin] Session ending - saving final context');
        if (lastSession) {
          await saveContext(directory, lastSession, 'exit');
        }
      }
      
      // Pre-exit compression trigger - catches session ending BEFORE data is lost
      if (eventType === "session.idle" || eventType === "session.deleted") {
        const sessionId = event?.properties?.sessionID || event?.sessionId || currentSessionId;
        if (sessionId) {
          debugLog(`[Pre-Exit] Session ${sessionId} ending, triggering compression...`);
          // Use client from closure (critical fix from debug/plugin-not-working.md)
          await triggerPreExitCompression(sessionId, directory, client);
        }
      }
    },
    
    "experimental.chat.messages.transform": async (transformInput) => {
      const messages = transformInput?.messages || transformInput;
      
      if (!messages || messages.length === 0) {
        return messages;
      }
      
      const isFirstMessage = messages.length === 1 && !hasInjectedContext;
      
      if (isFirstMessage) {
        debugLog('[context-plugin] First message detected - injecting context');
        const contexts = await loadPreviousContexts(directory, 5);
        
        if (contexts.length > 0) {
          const injection = buildContextInjection(contexts);
          const firstMsg = messages[0];
          
          if (firstMsg.content) {
            firstMsg.content = firstMsg.content + injection;
            hasInjectedContext = true;
            debugLog(`[context-plugin] Injected ${contexts.length} contexts into first message`);
          }
        }
      }
      
      return messages;
    }
  };
};

// Export helper functions for testing and external use
export { ensureHierarchicalDir, ensureContextSessionDir, atomicWrite, saveContext, loadPreviousContexts, updateDaySummary, updateWeekSummary, triggerPreExitCompression };
