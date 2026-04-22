import fs from "fs/promises";
import path from "path";
import { getWeek } from "date-fns";
import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { updateDaySummary, updateWeekSummary } from './summaries.js';
import { classifySessionPriority } from './contentExtractor.js';
import { generateTodaySummary } from '../agents/generateToday.js';
import { generateWeeklySummary } from '../agents/generateWeekly.js';
import { generateMonthlySummary } from '../agents/generateMonthly.js';
import { generateAnnualSummary } from '../agents/generateAnnual.js';
import { updateIntelligenceLearning } from '../agents/generateIntelligenceLearning.js';
import { atomicWrite, getTimestamp } from '../utils/fileUtils.js';
import { setLastSummarized, addToPendingQueue } from './state.js';
import { countTokens } from './tokenLimit.js';

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
 * @param {string} directory - Base directory
 * @param {Object} session - Session object
 * @param {string} type - Type of save ('compact' or 'exit')
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function saveContext(directory, session, type = 'compact', opencodeClient = null) {
  console.log(`[saveContext] FUNCTION CALLED - directory=${directory}, type=${type}, hasClient=${!!opencodeClient}`);
  logger(`[saveContext] START - type=${type}, sessionId=${session?.id || session?.sessionID}, messages=${session?.messages?.length || 0}`);
  try {
    const pathComponents = await ensureHierarchicalDir(directory);
    logger(`[saveContext] Hierarchical dir ensured: ${JSON.stringify(pathComponents)}`);
    const { dirPath, year, month, week, day } = pathComponents;
    const timestamp = getTimestamp();
    const filename = `${type}-${timestamp}.md`;
    const filepath = path.join(dirPath, filename);
    
    const summary = extractSessionSummary(session);
    const now = new Date().toISOString();

    // Classify session priority based on content
    const sessionContent = summary.messages.map(m => m.content).join(' ');
    const priority = classifySessionPriority(sessionContent);

    let content = `---
sessionId: "${summary.sessionId}"
slug: "${summary.slug}"
title: "${summary.title}"
timestamp: "${now}"
messageCount: ${summary.messageCount}
priority: "${priority}"
---

# Session Context - ${type.toUpperCase()}

**Session ID:** ${summary.sessionId}
**Slug:** ${summary.slug}
**Title:** ${summary.title}
**Timestamp:** ${now}
**Message Count:** ${summary.messageCount}

---

`;
    content += `## Messages\n\n`;
    
    summary.messages.forEach((msg) => {
      const preview = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '\n\n*(truncated)*' : msg.content;
      content += `### Message ${msg.index} [${msg.role}]\n\n`;
      content += `${preview}\n\n`;
    });
    
    await atomicWrite(filepath, content);
    logger(`[context-plugin] Saved context to: ${filepath}`);
    console.log(`[context-plugin] Context saved: ${filename}`);
    
    // Invalidate context cache on new save
    if (getConfig().injection?.cache?.enabled) {
      const { invalidateCache } = await import('./contextCache.js');
      await invalidateCache();
    }
    
    // Update day summary in hierarchical folder (not debounced, fast operation)
    // This writes to: context-session/YYYY/MM/WW/DD/day-summary.md
    await updateDaySummary(dirPath, { type, filename, year, month, day });

    // Update search index with new session (non-blocking, best effort)
    try {
      const { updateSearchIndex } = await import('./searchIndexer.js');
      await updateSearchIndex(directory, filepath);
    } catch (error) {
      // Don't fail save if search index update fails
      logger(`[saveContext] Search index update failed (non-fatal): ${error.message}`);
    }

    // Regenerate all reports - SEQUENTIAL hierarchical order
    // Each report aggregates the previous level's data:
    // today → weekly → monthly → annual → intelligence
    const reportDate = new Date();
    const reportYear = reportDate.getFullYear();
    const reportMonth = `${reportYear}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
    logger(`[saveContext] Starting report regeneration: ${directory}, month: ${reportMonth}`);
    console.log(`[saveContext] Starting report regeneration: ${directory}, month: ${reportMonth}`);

    console.log('[saveContext] SEQUENTIAL GENERATION START - this line must appear');
    logger(`[saveContext] SEQUENTIAL GENERATION START - this line must appear`);

    logger(`[saveContext] [1/5] Generating today summary...`);
    await generateTodaySummary(directory);

    logger(`[saveContext] [2/5] Generating weekly summary...`);
    await generateWeeklySummary(directory);

    logger(`[saveContext] [3/5] Generating monthly summary...`);
    await generateMonthlySummary(directory, reportMonth);

    logger(`[saveContext] [4/5] Generating annual summary...`);
    await generateAnnualSummary(directory, reportYear);

    logger(`[saveContext] [5/5] Updating intelligence learning...`);
    await updateIntelligenceLearning(directory);

    console.log(`[saveContext] Report regeneration completed`);
    logger(`[saveContext] Report regeneration completed`);

    logger(`[Daily Summary] Updated with ${filename}`);
    
    // Update state to track summarized content
    const stateKey = `today-${year}-${month}-${day}`;
    const contentForTokens = summary.messages.map(m => m.content).join(' ');
    const tokenCount = countTokens(contentForTokens);
    
    await setLastSummarized(directory, stateKey, {
      type: 'day',
      path: filepath,
      tokens: tokenCount,
      sessionsCount: 1
    });
    
    // Add pending work for other summary levels
    await addToPendingQueue(directory, {
      type: 'week',
      key: `week-${year}-${month}-${week}`
    });
    await addToPendingQueue(directory, {
      type: 'month',
      key: `month-${year}-${month}`
    });
    await addToPendingQueue(directory, {
      type: 'annual',
      key: `year-${year}`
    });
    
    logger('[saveContext] State updated with summarized content');
    
    return filepath;
  } catch (error) {
    logger(`[context-plugin] Error saving context: ${error.message}`);
    console.error(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}
