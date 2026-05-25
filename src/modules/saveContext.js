import fs from "fs/promises";
import path from "path";
import { getWeek } from "date-fns";
import { getConfig, CONTEXT_SESSION_DIR } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { updateDaySummary } from './summaries.js';
import { classifySessionPriority } from './contentExtractor.js';
import { generateTodaySummary } from '../agents/generateToday.js';
import { generateWeeklySummary } from '../agents/generateWeekly.js';
import { generateMonthlySummary } from '../agents/generateMonthly.js';
import { generateAnnualSummary } from '../agents/generateAnnual.js';
import { atomicWrite, getTimestamp, recoverOrphanedTempFiles, withTimeout } from '../utils/fileUtils.js';
import { setLastSummarized, addToPendingQueue } from './state.js';
import { countTokens } from './tokenLimit.js';
import { validateAfterSave } from './contextValidator.js';

const logger = createDebugLogger('context-plugin');

export { createDebugLogger };

/**
 * Atomic write using temp file + rename pattern for crash safety
 * (Also exported from fileUtils for backward compatibility)
 */
export { atomicWrite, getTimestamp };

/**
 * Validates and normalizes session type to 'compact' or 'exit'
 * @param {string} type - Raw type value
 * @returns {string} Normalized type
 */
function determineSessionType(type) {
  return type === 'exit' ? 'exit' : 'compact';
}

/**
 * Performs atomic file write and asynchronous context validation
 * @param {string} directory - Base project directory
 * @param {string} filepath - Full path for the output file
 * @param {string} content - Markdown content to save
 */
async function performSave(directory, filepath, content) {
  await atomicWrite(filepath, content);
  logger(`[context-plugin] Saved context to: ${filepath}`);
  logger(`[context-plugin] Context saved: ${path.basename(filepath)}`);

  validateAfterSave(directory, content, filepath).catch(err => {
    logger(`[saveContext] Context validation failed (non-fatal): ${err.message}`);
  });
}

/**
 * Executes all post-save actions: cache invalidation, day summary update,
 * search index update, sequential report regeneration, and state tracking
 * @param {string} directory - Base project directory
 * @param {string} filepath - Full path of saved file
 * @param {string} content - Saved markdown content
 * @param {string} type - Session type ('compact' | 'exit')
 * @param {number} year - Session year
 * @param {string} month - Session month (zero-padded)
 * @param {string} day - Session day (zero-padded)
 * @param {Object} opencodeClient - OpenCode client for AI inference
 * @param {Object} summary - Extracted session summary
 * @param {string} dirPath - Hierarchical day directory path
 * @param {string} filename - Session filename
 * @param {string} week - Week folder name (e.g. 'W12')
 */
async function postSaveActions(directory, filepath, content, type, year, month, day, opencodeClient, summary, dirPath, filename, week) {
  if (getConfig().injection?.cache?.enabled) {
    const { invalidateCache } = await import('./contextCache.js');
    await invalidateCache(directory);
  }

  await updateDaySummary(dirPath, { type, filename, year, month, day });

  try {
    const { updateSearchIndex } = await import('./searchIndexer.js');
    await updateSearchIndex(directory, filepath);
  } catch (error) {
    logger(`[saveContext] Search index update failed (non-fatal): ${error.message}`);
  }

  const reportDate = new Date();
  const reportYear = reportDate.getFullYear();
  const reportMonth = `${reportYear}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
  logger(`[saveContext] Starting report regeneration: ${directory}, month: ${reportMonth}`);
  logger(`[context-plugin] Updating reports...`);

  const steps = [
    { label: 'today summary', fn: () => generateTodaySummary(directory), timeout: 30000 },
    { label: 'weekly summary', fn: () => generateWeeklySummary(directory), timeout: 30000 },
    { label: 'monthly summary', fn: () => generateMonthlySummary(directory, reportMonth), timeout: 30000 },
    { label: 'annual summary', fn: () => generateAnnualSummary(directory, reportYear), timeout: 30000 },
    { label: 'intelligence learning', fn: () => import('../agents/generateIntelligenceLearning.js').then(m => m.updateIntelligenceLearning(directory, opencodeClient)), timeout: 60000 }
  ];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    logger(`[saveContext] [${i + 1}/${steps.length}] Generating ${step.label}...`);
    try {
      await withTimeout(Promise.resolve(step.fn()), step.timeout, step.label);
      logger(`[saveContext] [${i + 1}/${steps.length}] ${step.label} ✓`);
    } catch (error) {
      logger(`[saveContext] [${i + 1}/${steps.length}] ${step.label} FAILED: ${error.message}`);
    }
  }

  logger(`[context-plugin] Reports updated`);
  logger(`[Daily Summary] Updated with ${filename}`);

  const stateKey = `today-${year}-${month}-${day}`;
  const contentForTokens = summary.messages.map(m => m.content).join(' ');
  const tokenCount = countTokens(contentForTokens);

  await setLastSummarized(directory, stateKey, {
    type: 'day',
    path: filepath,
    tokens: tokenCount,
    sessionsCount: 1
  });

  await addToPendingQueue(directory, { type: 'week', key: `week-${year}-${month}-${week}` });
  await addToPendingQueue(directory, { type: 'month', key: `month-${year}-${month}` });
  await addToPendingQueue(directory, { type: 'annual', key: `year-${year}` });
}

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
 * Save session context to file
 * Returns filepath on success, null on failure
 * @public
 * @param {string} directory - Base directory
 * @param {Object} session - Session object
 * @param {string} type - Type of save ('compact' or 'exit')
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function saveContext(directory, session, type = 'compact', opencodeClient = null) {
  logger(`[saveContext] START - directory=${directory}, type=${type}, hasClient=${!!opencodeClient}`);
  logger(`[saveContext] START - type=${type}, sessionId=${session?.id || session?.sessionID}, messages=${session?.messages?.length || 0}`);

  try {
    const cleaned = await recoverOrphanedTempFiles(directory);
    if (cleaned > 0) {
      logger(`[saveContext] Cleaned up ${cleaned} orphaned temp files`);
    }
  } catch (error) {
    logger(`[saveContext] Temp file cleanup failed (non-fatal): ${error.message}`);
  }

  try {
    type = determineSessionType(type);
    const pathComponents = await ensureHierarchicalDir(directory);
    logger(`[saveContext] Hierarchical dir ensured: ${JSON.stringify(pathComponents)}`);
    const { dirPath, year, month, week, day } = pathComponents;
    const timestamp = getTimestamp();
    const filename = `${type}-${timestamp}.md`;
    const filepath = path.join(dirPath, filename);

    const summary = extractSessionSummary(session);
    if (!summary) {
      logger(`[saveContext] Cannot save context: invalid session (null/undefined)`);
      return null;
    }
    const now = new Date().toISOString();

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
      const MAX_MSG_SIZE = 5000;
      const preview = msg.content.length > MAX_MSG_SIZE ? msg.content.slice(0, MAX_MSG_SIZE) + `\n\n[...truncated ${msg.content.length - MAX_MSG_SIZE} chars...]` : msg.content;
      content += `### Message ${msg.index} [${msg.role}]\n\n`;
      content += `${preview}\n\n`;
    });

    if (!content.includes('## Goal')) {
      content += `\n> **Note:** This session appears to be a chat log without structured sections. Consider adding ## Goal, ## Accomplished, and ## Discoveries sections for better analysis.\n`;
      logger(`[saveContext] Chat log detected, appended soft warning to: ${filepath}`);
    }

    await performSave(directory, filepath, content);
    await postSaveActions(directory, filepath, content, type, year, month, day, opencodeClient, summary, dirPath, filename, week);

    logger('[saveContext] State updated with summarized content');

    return filepath;
  } catch (error) {
    logger(`[context-plugin] Error saving context: ${error.message}`);
    return null;
  }
}
