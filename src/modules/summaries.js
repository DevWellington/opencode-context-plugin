import fs from "fs/promises";
import path from "path";
import { getConfig, CONTEXT_SESSION_DIR } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { extractSessionContent, extractBugs, extractPersistentPatterns, normalizePattern, dedupePatterns } from './contentExtractor.js';
import { countSessionTokens, countTokens, isCodeContent } from './tokenLimit.js';
import { isProtectedSession, isProtectedContent, getProtectionStatus } from '../utils/patternMatcher.js';
import { buildKeywords, extractKeywordsFromContent, addRelatedLinks, addKeywordNavigation } from '../agents/utils/linkBuilder.js';

const logger = createDebugLogger('context-plugin');

/**
 * Check if content change exceeds nudge threshold
 * Returns { shouldRegenerate: boolean, savingsPercent: number, changePercent: number }
 *
 * @param {string} oldContent - Existing content
 * @param {string} newContent - New content to compare
 * @param {number} threshold - Minimum change percentage to trigger regeneration (default: 0.05 = 5%)
 * @returns {Object} { shouldRegenerate, savingsPercent, changePercent }
 */
export function shouldRegenerate(oldContent, newContent, threshold = 0.05) {
  if (!oldContent) {
    return { shouldRegenerate: true, savingsPercent: 100, changePercent: 100 };
  }

  const oldLen = oldContent.length;
  const newLen = newContent.length;

  if (oldLen === newLen && oldContent === newContent) {
    return { shouldRegenerate: false, savingsPercent: 0, changePercent: 0 };
  }

  const changePercent = Math.abs(newLen - oldLen) / oldLen;

  return {
    shouldRegenerate: changePercent > threshold,
    savingsPercent: Math.round(changePercent * 100),
    changePercent: Math.round(changePercent * 100)
  };
}

/**
 * Check if new session was added compared to existing summary
 * Compares session entry count in the summary
 *
 * @param {string} existingSummary - Existing summary content
 * @param {Array} newSessions - Array of new session objects with filename property
 * @returns {boolean} True if new sessions exist
 */
export function hasNewSessions(existingSummary, newSessions) {
  if (!existingSummary || !newSessions || newSessions.length === 0) {
    return newSessions && newSessions.length > 0;
  }

  const existingMatch = existingSummary.match(/- \[(\d{4}-\d{2}-\d{2})/g);
  const existingCount = existingMatch ? existingMatch.length : 0;

  return newSessions.length > existingCount;
}

/**
 * Get session age in days
 * @param {string} sessionPath - Path to session file
 * @returns {Promise<number>} Days since last modified
 */
async function getSessionAge(sessionPath) {
  const stats = await fs.stat(sessionPath);
  const now = new Date();
  const modified = new Date(stats.mtime);
  return Math.floor((now - modified) / (1000 * 60 * 60 * 24));
}

/**
 * Extract priority from session file frontmatter
 * @param {string} sessionContent - Raw session file content
 * @returns {string} 'low' | 'medium' | 'high' (defaults to 'medium')
 */
function getSessionPriority(sessionContent) {
  const match = sessionContent.match(/priority:\s*["']?([a-z]+)["']?/i);
  if (!match) return 'medium';
  const value = match[1].toLowerCase();
  if (['high', 'medium', 'low'].includes(value)) {
    return value;
  }
  return 'medium';
}

/**
 * Check if session should be pruned based on priority and age
 * @param {string} sessionContent - Session file content
 * @param {number} ageDays - Age of session in days
 * @returns {boolean}
 */
function shouldPruneSession(sessionContent, ageDays) {
  const config = getConfig();
  const priority = getSessionPriority(sessionContent);
  const retentionDays = {
    high: config.priority?.highRetention ?? -1,
    medium: config.priority?.mediumRetention ?? 90,
    low: config.priority?.lowRetention ?? 30
  };

  const retention = retentionDays[priority] ?? 90;
  if (retention === -1) return false;
  return ageDays > retention;
}

export { updateDailySummary, updateWeekSummary, updateDaySummary } from './summaryUpdater.js';