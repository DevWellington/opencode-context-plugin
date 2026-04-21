import fs from "fs/promises";
import path from "path";
import { getWeek } from "date-fns";
import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { updateDailySummary, updateDaySummary, updateWeekSummary } from './summaries.js';
import { updateIntelligenceLearning as updateIntelligenceLearningMeta } from './intelligence.js';
import { generateMonthlySummary } from '../agents/generateMonthly.js';
import { generateAnnualSummary } from '../agents/generateAnnual.js';
import { updateIntelligenceLearning } from '../agents/generateIntelligenceLearning.js';
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
    
    let content = `---
sessionId: "${summary.sessionId}"
slug: "${summary.slug}"
title: "${summary.title}"
timestamp: "${now}"
messageCount: ${summary.messageCount}
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
    await updateIntelligenceLearningMeta(directory, learningSessionInfo);

    // Regenerate all reports (non-blocking, fire-and-forget)
    // Start async operations without awaiting - they run in background
    const reportDate = new Date();
    const reportYear = reportDate.getFullYear();
    const reportMonth = `${reportYear}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
    logger(`[saveContext] Starting report regeneration: ${directory}, month: ${reportMonth}`);
    console.log(`[saveContext] Starting report regeneration: ${directory}, month: ${reportMonth}`);
    Promise.all([
      generateMonthlySummary(directory, reportMonth),
      generateAnnualSummary(directory, reportYear),
      updateIntelligenceLearning(directory)
    ])
      .then(() => {
        console.log(`[saveContext] Report regeneration completed`);
        logger(`[saveContext] Report regeneration completed`);
      })
      .catch(error => {
        console.error(`[saveContext] Report regeneration ERROR: ${error.message}`, error);
        logger(`[saveContext] Report regeneration ERROR: ${error.message}`);
      });

    // Update search index with new session (non-blocking, best effort)
    try {
      const { updateSearchIndex } = await import('./searchIndexer.js');
      await updateSearchIndex(directory, filepath);
    } catch (error) {
      // Don't fail save if search index update fails
      logger(`[saveContext] Search index update failed (non-fatal): ${error.message}`);
    }
    
    logger(`[Daily Summary] Updated with ${filename}`);
    
    return filepath;
  } catch (error) {
    logger(`[context-plugin] Error saving context: ${error.message}`);
    console.error(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}
