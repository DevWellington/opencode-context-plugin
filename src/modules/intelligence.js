import fs from "fs/promises";
import path from "path";
import { createDebugLogger } from '../utils/debug.js';
import { atomicWrite } from '../utils/fileUtils.js';
import { getConfig } from '../config.js';
import { extractPersistentPatterns } from './contentExtractor.js';

const logger = createDebugLogger('intelligence');

const CONTEXT_SESSION_DIR = '.opencode/context-session';

/**
 * Check if session is high priority and should be preserved
 * @param {Object} sessionData - Session object with priority field
 * @returns {boolean}
 */
export function isHighPriority(sessionData) {
  return sessionData.priority === 'high';
}

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
    
    content += `## Pinned Patterns\n\n`;
    content += `Patterns that have appeared in 3+ sessions and are preserved across all updates:\n\n`;
    content += `### Pinned Goal Themes\n`;
    content += `- [Auto-populated from cross-session analysis]\n\n`;
    content += `### Pinned Bug Patterns\n`;
    content += `- [Auto-populated from cross-session analysis]\n\n`;
    content += `### Pinned File Patterns\n`;
    content += `- [Auto-populated from cross-session analysis]\n\n`;
    content += `---\n\n`;
    content += `## Recent Sessions\n`;
    content += `- [Current session patterns - refreshed each time]\n\n`;
 
    content += `## High-Priority Session Preservation\n\n`;
    content += `Sessions marked as HIGH priority are preserved indefinitely:\n`;
    content += `- [Auto-populated: list of high-priority session IDs and their key learnings]\n\n`;

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
 * Preserve persistent patterns across intelligence updates
 * Extracts patterns from existing file, pins those with sessionCount >= 3
 * Merges new patterns with pinned ones
 * 
 * @param {string} existingContent - Current intelligence-learning.md content
 * @param {Array} newPatterns - New patterns from findPatterns()
 * @returns {Object} { pinnedContent, recentContent }
 */
function preservePersistentPatterns(existingContent, newPatterns) {
  // Extract existing persistent patterns
  const existingPatterns = extractPersistentPatterns(existingContent);
  
  // Separate pinned (sessionCount >= 3) from recent
  const pinnedPatterns = existingPatterns.filter(p => p.pinned);
  const recentPatterns = newPatterns || [];
  
  // Merge: new patterns may increment session counts on existing pinned patterns
  const mergedPinned = mergePatterns(pinnedPatterns, recentPatterns);
  
  return {
    pinnedContent: formatPinnedPatterns(mergedPinned),
    recentContent: formatRecentPatterns(recentPatterns)
  };
}

function mergePatterns(pinned, newPatterns) {
  // For each new pattern, check if it matches an existing pinned pattern
  // If so, increment session count; otherwise keep pinned as-is
  const result = [...pinned];
  
  for (const newPat of newPatterns) {
    const matchIdx = result.findIndex(p => 
      p.pattern.toLowerCase() === newPat.pattern.toLowerCase()
    );
    if (matchIdx >= 0) {
      // Update existing pinned pattern with new session
      result[matchIdx].sessions.push(...newPat.sessions);
      result[matchIdx].sessionCount = result[matchIdx].sessions.length;
      result[matchIdx].lastSeen = new Date().toISOString().split('T')[0];
      result[matchIdx].pinned = result[matchIdx].sessionCount >= 3;
    }
    // New patterns that aren't pinned yet go to recent, not pinned
  }
  
  return result;
}

function formatPinnedPatterns(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'No pinned patterns yet (appear in 3+ sessions to pin)\n';
  }
  
  // Group by type
  const byType = {
    goal_theme: patterns.filter(p => p.type === 'goal_theme'),
    bug_pattern: patterns.filter(p => p.type === 'bug_pattern'),
    file_pattern: patterns.filter(p => p.type === 'file_pattern'),
    general: patterns.filter(p => !['goal_theme', 'bug_pattern', 'file_pattern'].includes(p.type))
  };
  
  let content = '';
  
  if (byType.goal_theme.length > 0) {
    content += '### Pinned Goal Themes\n';
    for (const p of byType.goal_theme) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  if (byType.bug_pattern.length > 0) {
    content += '### Pinned Bug Patterns\n';
    for (const p of byType.bug_pattern) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  if (byType.file_pattern.length > 0) {
    content += '### Pinned File Patterns\n';
    for (const p of byType.file_pattern) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  if (byType.general.length > 0) {
    content += '### Other Pinned Patterns\n';
    for (const p of byType.general) {
      content += `- ${p.pattern} (Sessions: ${p.sessionCount}, Last: ${p.lastSeen})\n`;
    }
    content += '\n';
  }
  
  return content;
}

function formatRecentPatterns(patterns) {
  if (!patterns || patterns.length === 0) {
    return 'No recent patterns\n';
  }
  
  let content = '';
  for (const p of patterns.slice(0, 10)) { // Limit to top 10 recent
    content += `- ${p.pattern} (Sessions: ${p.sessionCount})\n`;
  }
  
  return content;
}
