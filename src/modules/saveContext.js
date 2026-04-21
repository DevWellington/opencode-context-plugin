import fs from "fs/promises";
import path from "path";
import { getWeek } from "date-fns";
import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { updateDailySummary, updateDaySummary, updateWeekSummary } from './summaries.js';
import { updateIntelligenceLearning } from './intelligence.js';
import { atomicWrite, getTimestamp } from '../utils/fileUtils.js';

const logger = createDebugLogger('context-plugin');

export { createDebugLogger };

// Constants
const CONTEXT_SESSION_DIR = '.opencode/context-session';

/**
 * Atomic write using temp file + rename pattern for crash safety
 * (Also exported from fileUtils for backward compatibility)
 */
export { atomicWrite, getTimestamp };

/**
 * Ensure hierarchical directory structure exists
 * Creates: .opencode/context-session/YYYY/MM/WW/DD/
 */
export async function ensureHierarchicalDir(baseDir) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const weekNum = getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const week = `W${String(weekNum).padStart(2, '0')}`;
  const day = String(now.getDate()).padStart(2, '0');
  
  const dirPath = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week, day);
  
  await fs.mkdir(dirPath, { recursive: true });
  logger(`[context-plugin] Created hierarchical directory: ${dirPath}`);
  
  return { dirPath, year, month, week, day };
}

/**
 * Extract session summary for serialization
 */
export function extractSessionSummary(session) {
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

/**
 * Save context to hierarchical folder structure
 * Returns filepath on success, null on failure
 */
export async function saveContext(directory, session, type = 'compact') {
  logger(`[saveContext] START - type=${type}, sessionId=${session?.id || session?.sessionID}, messages=${session?.messages?.length || 0}`);
  try {
    const pathComponents = await ensureHierarchicalDir(directory);
    logger(`[saveContext] Hierarchical dir ensured: ${JSON.stringify(pathComponents)}`);
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
    logger(`[context-plugin] Saved context to: ${filepath}`);
    console.log(`[context-plugin] Context saved: ${filename}`);
    
    // Prepare session info for summaries
    const sessionInfo = {
      type,
      filename,
      timestamp: new Date().toISOString()
    };
    
    // Update daily summary (at context-session root) and day summary (in hierarchical folder) in parallel
    // These are already debounced in the summaries module
    await Promise.all([
      updateDailySummary(directory, sessionInfo),
      updateDaySummary(dirPath, { type, filename, year, month, day })
    ]);
    
    // Update week summary (idempotent, safe to call every time)
    // This is already debounced in the summaries module
    await updateWeekSummary(directory, year, month, week);
    
    // Update intelligence learning file
    const learningSessionInfo = {
      type,
      filename,
      timestamp: new Date().toISOString(),
      sessionId: summary.sessionId,
      messageCount: summary.messageCount
    };
    await updateIntelligenceLearning(directory, learningSessionInfo);
    
    logger(`[Daily Summary] Updated with ${filename}`);
    
    return filepath;
  } catch (error) {
    logger(`[context-plugin] Error saving context: ${error.message}`);
    console.error(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}
