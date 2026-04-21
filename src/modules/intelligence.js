import fs from "fs/promises";
import path from "path";
import { createDebugLogger } from '../utils/debug.js';
import { atomicWrite } from '../utils/fileUtils.js';
import { extractSessionContent, extractBugs, findPatterns } from './contentExtractor.js';
import { updateGlobalIntelligence } from '../utils/globalIntelligence.js';
import { getSyncStatus } from './remoteSync.js';

const logger = createDebugLogger('intelligence');

// Constants
const CONTEXT_SESSION_DIR = '.opencode/context-session';

// Queue-based serialization for intelligence learning updates
let learningWriteQueue = Promise.resolve();

// Greeting patterns to filter out
const GREETING_PATTERNS = [
  /^oi$/i, /^hi$/i, /^hello$/i, /^olá$/i, /^hey$/i, /^e aí$/i,
  /^bom dia$/i, /^boa tarde$/i, /^boa noite$/i, /^tudo bem$/i,
  /^(hi|hey|yo|sup)\s*[!.]*$/i
];

const GREETING_KEYWORDS = [
  'greeting', 'saudação', 'cumprimento', 'light chat', 'quick check-in'
];

/**
 * Check if content is likely just a greeting
 */
function checkIsGreeting(firstMessage, title) {
  if (!firstMessage && !title) return false;
  
  const msg = firstMessage?.trim().toLowerCase() || '';
  const t = title?.toLowerCase() || '';
  
  // Check short messages
  if (msg.length > 0 && msg.length < 5) return true;
  
  // Check patterns
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(msg)) return true;
  }
  
  // Check title keywords
  for (const keyword of GREETING_KEYWORDS) {
    if (t.includes(keyword)) return true;
  }
  
  return false;
}

/**
 * Initialize intelligence learning file with template
 */
export async function initializeIntelligenceLearning(baseDir) {
  const ctxDir = path.join(baseDir, CONTEXT_SESSION_DIR);
  const filePath = path.join(ctxDir, 'intelligence-learning.md');
  
  try {
    // Check if file already exists (don't overwrite)
    try {
      await fs.access(filePath);
      logger(`[Intelligence] File already exists, skipping initialization: ${filePath}`);
      return filePath;
    } catch {
      // File doesn't exist, proceed with creation
    }
    
    // Get project name from directory
    const projectName = path.basename(baseDir);
    const timestamp = new Date().toISOString();
    
    // Create template content
    let content = `# Intelligence Learning - ${projectName}\n\n`;
    content += `## Last Updated\n`;
    content += `- **Timestamp:** ${timestamp}\n`;
    content += `- **Sessions Analyzed:** 0\n`;
    content += `- **Last Session Type:** none\n\n`;
    
    content += `## Project Structure Decisions\n\n`;
    content += `### Folder Hierarchy\n`;
    content += `- **Why:** Temporal organization enables quick navigation by date\n`;
    content += `- **Structure:** YYYY/MM/WW/DD with summaries at each level\n`;
    content += `- **Tradeoff:** More directories vs. flat structure with search\n\n`;
    
    content += `### Naming Conventions\n`;
    content += `- **exit-***: Session end (replaced "saida-" for i18n)\n`;
    content += `- **compact-***: Manual or auto compaction\n`;
    content += `- **summary.md**: Auto-generated summaries\n\n`;
    
    content += `## Architectural Decisions\n\n`;
    content += `### Hook Selection\n`;
    content += `- **session.compacted**: For manual/auto compaction\n`;
    content += `- **session.idle**: For automatic session end detection\n`;
    content += `- **session.deleted**: For explicit session deletion\n`;
    content += `- **Pre-exit trigger**: Custom hook before session ends\n\n`;
    
    content += `### Event Handling Pattern\n`;
    content += `- Use closure to access \`client\` object (not from event handler params)\n`;
    content += `- Queue-based write serialization (no file locking needed)\n`;
    content += `- Atomic writes via temp-file-rename pattern\n\n`;
    
    content += `## Bug Fix Guidance\n\n`;
    content += `### Common Issue: "client is undefined"\n`;
    content += `**Symptom:** Error "undefined is not an object (evaluating 'client.sessions.get")\n`;
    content += `**Cause:** Event handler doesn't receive client parameter\n`;
    content += `**Fix:** Use client from closure (outer plugin function scope)\n\n`;
    
    content += `### Common Issue: File corruption on crash\n`;
    content += `**Symptom:** Truncated or malformed summary files\n`;
    content += `**Cause:** Synchronous writes interrupted mid-operation\n`;
    content += `**Fix:** Use atomic write pattern (temp file + rename)\n\n`;
    
    content += `## Session Patterns\n\n`;
    content += `### Typical Session Duration\n`;
    content += `- [Auto-populated from session analysis]\n\n`;
    
    content += `### Common Commands\n`;
    content += `- [Auto-populated from session analysis]\n\n`;
    
    content += `### Recurring Themes\n`;
    content += `- [Auto-populated from cross-session analysis]\n\n`;
    
    content += `### Related Files\n`;
    content += `- [Auto-populated from cross-session analysis]\n\n`;
    
    content += `### Bug-Prone Areas\n`;
    content += `- [Auto-populated from cross-session analysis]\n\n`;

    content += `## Remote Sync Status\n\n`;
    content += `[Auto-populated when remote sync is configured]\n\n`;
    
    content += `## Key Learnings from Latest Sessions\n\n`;
    content += `[Appended on each trigger execution]\n\n`;
    
    content += `---\n`;
    content += `*Auto-generated by OpenCode Context Plugin*\n`;
    
    // Ensure directory exists
    await fs.mkdir(ctxDir, { recursive: true });
    
    // Atomic write
    await atomicWrite(filePath, content);
    logger(`[Intelligence] Initialized intelligence learning file: ${filePath}`);
    console.log(`[context-plugin] Intelligence learning file initialized`);
    
    return filePath;
  } catch (error) {
    logger(`[Intelligence] Error initializing learning file: ${error.message}`);
    console.error(`[context-plugin] Failed to initialize intelligence learning: ${error.message}`);
    throw error;
  }
}

/**
 * Update intelligence learning file with new session info
 * Uses queue-based serialization to prevent write conflicts
 */
export async function updateIntelligenceLearning(baseDir, sessionInfo) {
  // Queue-based serialization to prevent concurrent write conflicts
  learningWriteQueue = learningWriteQueue.then(async () => {
    try {
      // Handle null/undefined session info gracefully
      if (!sessionInfo || !sessionInfo.type) {
        logger(`[Intelligence] Invalid session info, skipping update`);
        return;
      }
      
      const ctxDir = path.join(baseDir, CONTEXT_SESSION_DIR);
      const filePath = path.join(ctxDir, 'intelligence-learning.md');
      
      // Read existing content
      let content;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        logger(`[Intelligence] Cannot read learning file, skipping update: ${error.message}`);
        return;
      }
      
      // Update Last Updated section
      const lines = content.split('\n');
      const updatedLines = [];
      let inLastUpdatedSection = false;
      let sessionsAnalyzed = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Track Last Updated section
        if (line.startsWith('## Last Updated')) {
          inLastUpdatedSection = true;
          updatedLines.push(line);
          continue;
        }
        
        if (inLastUpdatedSection && line.startsWith('## ')) {
          inLastUpdatedSection = false;
        }
        
        // Update timestamp
        if (inLastUpdatedSection && line.includes('**Timestamp:**')) {
          updatedLines.push(`- **Timestamp:** ${sessionInfo.timestamp || new Date().toISOString()}`);
          continue;
        }
        
        // Update session count
        if (inLastUpdatedSection && line.includes('**Sessions Analyzed:**')) {
          const match = line.match(/Sessions Analyzed:\s*(\d+)/);
          sessionsAnalyzed = match ? parseInt(match[1], 10) + 1 : 1;
          updatedLines.push(`- **Sessions Analyzed:** ${sessionsAnalyzed}`);
          
          // Trigger pattern analysis periodically (every 5 sessions)
          if (sessionsAnalyzed > 0 && sessionsAnalyzed % 5 === 0) {
            logger(`[Intelligence] Triggering pattern analysis at session ${sessionsAnalyzed}`);
            // Fire and forget - analysis runs in background
            analyzeCrossSessionPatterns(baseDir).then(patterns => {
              if (patterns.totalSessions >= 2) {
                updatePatternInsights(baseDir, patterns);
              }
            }).catch(err => {
              logger(`[Intelligence] Pattern analysis error: ${err.message}`);
            });
          }
          continue;
        }
        
        // Update session type
        if (inLastUpdatedSection && line.includes('**Last Session Type:**')) {
          updatedLines.push(`- **Last Session Type:** ${sessionInfo.type}`);
          continue;
        }
        
        updatedLines.push(line);
      }
      
      content = updatedLines.join('\n');
      
      // Extract structured content if session content is available
      let extracted = { goal: null, accomplished: null, discoveries: null, relevantFiles: [], firstUserMessage: null };
      let bugs = [];
      
      if (sessionInfo.content) {
        // Use contentExtractor functions if content is provided
        extracted = extractSessionContent(sessionInfo.content);
        bugs = extractBugs(sessionInfo.content);
      } else if (sessionInfo.filename) {
        // Try to read session file if filename is provided
        try {
          const sessionPath = path.join(ctxDir, '..', '..', sessionInfo.filename);
          const sessionContent = await fs.readFile(sessionPath, 'utf-8');
          extracted = extractSessionContent(sessionContent);
          bugs = extractBugs(sessionContent);
        } catch (error) {
          logger(`[Intelligence] Could not read session file: ${error.message}`);
        }
      }
      
      // Deduplicate: Check if this session already exists
      if (sessionInfo.sessionId && content.includes(sessionInfo.sessionId)) {
        logger(`[Intelligence] Session ${sessionInfo.sessionId} already recorded, skipping duplicate`);
        return;
      }
      
      // Filter out greeting content - don't record purely salutations
      const firstMsg = extracted.firstUserMessage || '';
      const isGreeting = checkIsGreeting(firstMsg, sessionInfo.title);
      if (isGreeting) {
        logger(`[Intelligence] Skipping greeting content, not meaningful work`);
        return;
      }
      
      // Additional deduplication: check for similar first messages
      if (firstMsg && content.includes(firstMsg)) {
        // Check if it's the same session (by timestamp) or just same message content
        const timestamp = sessionInfo.timestamp || '';
        if (!content.includes(`**Date:** ${timestamp.split('T')[0]}`)) {
          logger(`[Intelligence] Similar session content already recorded, skipping duplicate`);
          return;
        }
      }
      
      // Build Key Learnings entry following template format
      const templateSections = [];
      
      if (extracted.goal) {
        templateSections.push(`## Goal\n${extracted.goal}`);
      }
      
      templateSections.push(`## Instructions\n${sessionInfo.type === 'exit' ? 'Session ended' : 'Session compacted'}`);
      
      if (extracted.discoveries) {
        templateSections.push(`## Discoveries\n${extracted.discoveries}`);
      }
      
      if (extracted.accomplished) {
        templateSections.push(`## Accomplished\n${extracted.accomplished}`);
      } else if (sessionInfo.messageCount) {
        templateSections.push(`## Accomplished\n${sessionInfo.messageCount} messages processed`);
      }
      
      if (extracted.relevantFiles.length > 0) {
        const filesList = extracted.relevantFiles.map(f => `- ${f}`).join('\n');
        templateSections.push(`## Relevant files / directories\n${filesList}`);
      }
      
      // Add bug tracking if bugs with solutions were found
      if (bugs.length > 0) {
        const bugsSection = bugs.map(bug => {
          let bugEntry = `### Bug: ${bug.symptom}\n`;
          if (bug.cause) bugEntry += `**Cause:** ${bug.cause}\n`;
          if (bug.solution) bugEntry += `**Solution:** ${bug.solution}\n`;
          if (bug.prevention) bugEntry += `**Prevention:** ${bug.prevention}\n`;
          return bugEntry;
        }).join('\n');
        templateSections.push(`\n${bugsSection}`);
      }
      
      // Append to Key Learnings section
      const learningsMarker = '## Key Learnings from Latest Sessions';
      const learningsIndex = content.indexOf(learningsMarker);
      
      if (learningsIndex === -1) {
        logger(`[Intelligence] Key Learnings section not found, appending at end`);
        // Append before the footer
        const footerIndex = content.indexOf('---\n*Auto-generated');
        if (footerIndex !== -1) {
          let newEntry = `### Session ${sessionsAnalyzed} - ${sessionInfo.type.toUpperCase()}\n`;
          newEntry += `- **Date:** ${sessionInfo.timestamp || new Date().toISOString()}\n`;
          newEntry += `- **Session ID:** ${sessionInfo.sessionId || 'unknown'}\n\n`;
          newEntry += templateSections.join('\n\n');
          newEntry += '\n\n';
          
          content = content.slice(0, footerIndex) + newEntry + content.slice(footerIndex);
        }
      } else {
        // Find the end of the Key Learnings section (before footer)
        const sectionStart = learningsIndex + learningsMarker.length;
        const footerIndex = content.indexOf('---\n*Auto-generated', sectionStart);
        const insertPosition = footerIndex !== -1 ? footerIndex : content.length;
        
        let sectionContent = content.slice(sectionStart, insertPosition);
        const entries = sectionContent.split(/(?=### Session \d+)/).filter(s => s.trim().length > 0);
        
        // Limit to last 19 entries (adding 1 new = 20 total)
        if (entries.length >= 20) {
          entries.shift(); // Remove oldest
        }
        
        // Build new entry with template format
        let newEntry = `### Session ${sessionsAnalyzed} - ${sessionInfo.type.toUpperCase()}\n`;
        newEntry += `- **Date:** ${sessionInfo.timestamp || new Date().toISOString()}\n`;
        newEntry += `- **Session ID:** ${sessionInfo.sessionId || 'unknown'}\n\n`;
        newEntry += templateSections.join('\n\n');
        newEntry += '\n\n';
        
        entries.push(newEntry);
        
        // Rebuild section - join with \n### Session and prepend the marker
        const updatedSection = learningsMarker + '\n' + entries.join('\n### Session');
        content = content.slice(0, learningsIndex) + updatedSection + content.slice(insertPosition);
      }
      
      // Atomic write
      await atomicWrite(filePath, content);
      logger(`[Intelligence] Updated learning file: ${filePath}`);
      
      // Update remote sync status in learning file (fire-and-forget, don't block)
      updateRemoteSyncStatus(filePath).catch(err => {
        logger(`[Intelligence] Remote sync status update error (non-blocking): ${err.message}`);
      });
      
      // Sync to global intelligence (fire-and-forget, don't block local updates)
      const projectName = path.basename(baseDir);
      updateGlobalIntelligence(projectName, {
        sessionCount: sessionsAnalyzed,
        lastSessionType: sessionInfo.type,
        timestamp: sessionInfo.timestamp || new Date().toISOString()
      }).catch(err => {
        logger(`[Intelligence] Global sync error (non-blocking): ${err.message}`);
      });
    } catch (error) {
      logger(`[Intelligence] Error updating learning file: ${error.message}`);
      console.error(`[context-plugin] Intelligence learning update failed: ${error.message}`);
      // Don't throw - fail gracefully to not break session saving
    }
  });
  
  await learningWriteQueue;
}

/**
 * Analyze cross-session patterns from all existing session files
 * Uses findPatterns() from contentExtractor to detect recurring themes,
 * related files, and bug patterns across sessions.
 * 
 * @param {string} baseDir - Base directory of the project
 * @returns {Promise<Object>} { recurringThemes, relatedFiles, bugPatterns }
 */
export async function analyzeCrossSessionPatterns(baseDir) {
  const ctxDir = path.join(baseDir, CONTEXT_SESSION_DIR);
  
  try {
    // Scan for all session files
    const sessionFiles = await scanSessionFiles(ctxDir);
    
    if (sessionFiles.length < 2) {
      logger(`[Intelligence] Not enough sessions (${sessionFiles.length}) for pattern analysis`);
      return { recurringThemes: [], relatedFiles: [], bugPatterns: [], totalSessions: sessionFiles.length };
    }
    
    // Read session contents
    const sessions = [];
    for (const file of sessionFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        sessions.push({
          sessionId: file.name,
          content: content
        });
      } catch (error) {
        logger(`[Intelligence] Could not read session file ${file.path}: ${error.message}`);
      }
    }
    
    if (sessions.length < 2) {
      return { recurringThemes: [], relatedFiles: [], bugPatterns: [], totalSessions: sessions.length };
    }
    
    // Use findPatterns from contentExtractor
    const patterns = findPatterns(sessions);
    
    // Categorize patterns
    const recurringThemes = patterns.filter(p => 
      p.pattern.startsWith('goal theme:') || 
      p.pattern.startsWith('accomplishment theme:')
    );
    
    const relatedFiles = patterns.filter(p => 
      p.pattern.startsWith('File pattern:')
    );
    
    const bugPatterns = patterns.filter(p => 
      p.pattern.startsWith('Bug pattern:')
    );
    
    logger(`[Intelligence] Cross-session analysis: ${sessions.length} sessions, ${recurringThemes.length} themes, ${relatedFiles.length} file patterns, ${bugPatterns.length} bug patterns`);
    
    return {
      recurringThemes,
      relatedFiles,
      bugPatterns,
      totalSessions: sessions.length
    };
  } catch (error) {
    logger(`[Intelligence] Error in cross-session analysis: ${error.message}`);
    return { recurringThemes: [], relatedFiles: [], bugPatterns: [], totalSessions: 0 };
  }
}

/**
 * Scan directory for session files
 * @param {string} dir - Directory to scan
 * @returns {Promise<Array>} Array of { path, name } objects
 */
async function scanSessionFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isFile() && (entry.name.startsWith('compact-') || entry.name.startsWith('exit-'))) {
        files.push({ path: fullPath, name: entry.name });
      } else if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanSessionFiles(fullPath);
        files.push(...subFiles);
      }
    }
  } catch (error) {
    logger(`[Intelligence] Error scanning directory ${dir}: ${error.message}`);
  }
  
  return files;
}

/**
 * Update intelligence learning with pattern analysis results
 * Called periodically to refresh cross-session insights
 * 
 * @param {string} baseDir - Base directory of the project
 * @param {Object} patterns - Result from analyzeCrossSessionPatterns
 */
export async function updatePatternInsights(baseDir, patterns) {
  if (!patterns || patterns.totalSessions < 2) {
    return;
  }
  
  const ctxDir = path.join(baseDir, CONTEXT_SESSION_DIR);
  const filePath = path.join(ctxDir, 'intelligence-learning.md');
  
  learningWriteQueue = learningWriteQueue.then(async () => {
    try {
      let content;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        logger(`[Intelligence] Cannot read learning file for pattern update: ${error.message}`);
        return;
      }
      
      // Find or create Session Patterns section
      const patternsSection = '## Session Patterns\n';
      const patternsMarker = '### Typical Session Duration';
      const patternsIndex = content.indexOf(patternsMarker);
      
      if (patternsIndex === -1) {
        // Section doesn't exist, find where to insert (after Architectural Decisions)
        const archSectionEnd = content.indexOf('## Bug Fix Guidance');
        if (archSectionEnd !== -1) {
          const insertPos = archSectionEnd;
          let patternContent = '\n' + patternsSection;
          patternContent += `### Typical Session Duration\n`;
          patternContent += `- [Auto-populated from session analysis]\n\n`;
          patternContent += `### Common Commands\n`;
          patternContent += `- [Auto-populated from session analysis]\n\n`;
          patternContent += `### Recurring Themes\n`;
          patternContent += `- [Auto-populated from cross-session analysis]\n\n`;
          patternContent += `### Related Files\n`;
          patternContent += `- [Auto-populated from cross-session analysis]\n\n`;
          patternContent += `### Bug-Prone Areas\n`;
          patternContent += `- [Auto-populated from cross-session analysis]\n`;
          
          content = content.slice(0, insertPos) + patternContent + content.slice(insertPos);
        }
      } else {
        // Update existing section with pattern insights
        const sectionStart = patternsIndex;
        
        // Find the end of this section (next ## or footer)
        let sectionEnd = content.indexOf('\n## ', sectionStart + 1);
        if (sectionEnd === -1) sectionEnd = content.indexOf('\n---\n', sectionStart);
        if (sectionEnd === -1) sectionEnd = content.length;
        
        const oldSection = content.slice(sectionStart, sectionEnd);
        
        // Build new section with pattern insights
        let newSection = `### Typical Session Duration\n`;
        newSection += `- [Auto-populated from session analysis]\n\n`;
        newSection += `### Common Commands\n`;
        
        // Extract common commands from recurring themes
        const commandThemes = patterns.recurringThemes.filter(t => 
          t.pattern.includes('test') || t.pattern.includes('deploy') || 
          t.pattern.includes('config') || t.pattern.includes('api')
        );
        if (commandThemes.length > 0) {
          for (const theme of commandThemes.slice(0, 3)) {
            const cmd = theme.pattern.split(': ')[1];
            newSection += `- **${cmd}:** seen in ${theme.frequency} sessions\n`;
          }
        } else {
          newSection += `- [Auto-populated from session analysis]\n`;
        }
        
        newSection += `\n### Recurring Themes\n`;
        if (patterns.recurringThemes.length > 0) {
          for (const theme of patterns.recurringThemes.slice(0, 5)) {
            newSection += `- **${theme.pattern}:** ${theme.frequency} sessions\n`;
          }
        } else {
          newSection += `- [Auto-populated from cross-session analysis]\n`;
        }
        
        newSection += `\n### Related Files\n`;
        if (patterns.relatedFiles.length > 0) {
          for (const file of patterns.relatedFiles.slice(0, 5)) {
            newSection += `- **${file.pattern}:** ${file.frequency} sessions\n`;
          }
        } else {
          newSection += `- [Auto-populated from cross-session analysis]\n`;
        }
        
        newSection += `\n### Bug-Prone Areas\n`;
        if (patterns.bugPatterns.length > 0) {
          for (const bug of patterns.bugPatterns.slice(0, 5)) {
            newSection += `- **${bug.pattern}:** ${bug.frequency} occurrences\n`;
          }
        } else {
          newSection += `- [Auto-populated from cross-session analysis]\n`;
        }
        
        content = content.slice(0, sectionStart) + newSection + content.slice(sectionEnd);
      }
      
      await atomicWrite(filePath, content);
      logger(`[Intelligence] Updated pattern insights: ${patterns.recurringThemes.length} themes, ${patterns.bugPatterns.length} bug patterns`);
    } catch (error) {
      logger(`[Intelligence] Error updating pattern insights: ${error.message}`);
    }
  });
  
  await learningWriteQueue;
}

/**
 * Update remote sync status section in intelligence learning file
 * Only shows information if remote sync is configured
 * 
 * @param {string} filePath - Path to intelligence-learning.md file
 */
async function updateRemoteSyncStatus(filePath) {
  try {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist yet
      return;
    }

    const status = await getSyncStatus();
    
    // Find Remote Sync Status section
    const syncStatusMarker = '## Remote Sync Status';
    const markerIndex = content.indexOf(syncStatusMarker);
    
    if (markerIndex === -1) {
      // Section doesn't exist, skip
      return;
    }
    
    // Find the end of this section (next ## or footer)
    let sectionEnd = content.indexOf('\n## ', markerIndex + 1);
    if (sectionEnd === -1) sectionEnd = content.indexOf('\n---\n', markerIndex);
    if (sectionEnd === -1) sectionEnd = content.length;
    
    // Build new section content
    let newSection = `${syncStatusMarker}\n\n`;
    
    if (status.configured) {
      newSection += `- **Provider:** ${status.configured ? 'configured' : 'not configured'}\n`;
      newSection += `- **Last Sync:** ${status.lastSync || 'never'}\n`;
      newSection += `- **Pending Changes:** ${status.pendingChanges ? 'yes' : 'no'}\n`;
      if (status.errors && status.errors.length > 0) {
        newSection += `- **Recent Errors:** ${status.errors.length}\n`;
      }
    } else {
      newSection += `Remote sync is not configured.\n`;
      newSection += `Configure in context-plugin.json to enable.\n`;
    }
    
    newSection += `\n`;
    
    // Replace section content
    content = content.slice(0, markerIndex) + newSection + content.slice(sectionEnd);
    
    await atomicWrite(filePath, content);
    logger(`[Intelligence] Updated remote sync status: configured=${status.configured}`);
  } catch (error) {
    logger(`[Intelligence] Error updating remote sync status: ${error.message}`);
  }
}
