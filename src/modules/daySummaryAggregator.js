import fs from "fs/promises";
import path from "path";
import { getConfig, CONTEXT_SESSION_DIR } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { extractSessionContent, extractBugs, extractPersistentPatterns, normalizePattern } from './contentExtractor.js';
import { isProtectedSession } from '../utils/patternMatcher.js';
import { extractSection } from '../utils/summaryUtils.js';
import { handleCatch, isExpectedFsError } from '../utils/errorUtils.js';

const logger = createDebugLogger('context-plugin');

/**
 * Read all session files from a day directory
 * @param {string} dirPath - Path to day directory
 * @returns {Array} Array of { filename, content, extracted, bugs }
 */
async function readDaySessions(dirPath) {
  const sessions = [];

  try {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      // Skip summary files and non-session files
      if (file.endsWith('-summary.md') || (!file.startsWith('exit-') && !file.startsWith('compact-'))) {
        continue;
      }

      if (file.endsWith('.md')) {
        try {
          const filePath = path.join(dirPath, file);
          const sessionInfo = { filename: file, path: filePath, type: file.startsWith('compact-') ? 'compact' : 'exit' };

          // Skip protected sessions (mode: 'session')
          if (isProtectedSession(sessionInfo)) {
            logger(`[summaries] Skipping protected session: ${file}`);
            continue;
          }

          const content = await fs.readFile(filePath, 'utf-8');
          const extracted = extractSessionContent(content);
          const bugs = extractBugs(content);
          sessions.push({ filename: file, path: filePath, content, extracted, bugs });
        } catch (err) {
          if (!isExpectedFsError(err)) {
            logger(`[summaries] Failed to read session ${file}: ${err.message}`);
          }
        }
      }
    }
  } catch (err) {
    if (!isExpectedFsError(err)) {
      logger(`[summaries] Failed to read day directory ${dirPath}: ${err.message}`);
    }
  }

  return sessions;
}

/**
 * Check if a day directory contains only protected sessions
 * Returns true if all sessions in the day are protected
 *
 * @param {string} dayPath - Path to day directory
 * @returns {Promise<boolean>}
 */
async function isDayFullyProtected(dayPath) {
  const config = getConfig();

  if (!config.protected?.enabled || config.protected?.mode !== 'session') {
    return false;
  }

  try {
    const files = await fs.readdir(dayPath);
    const sessions = files.filter(f =>
      f.endsWith('.md') && (f.startsWith('exit-') || f.startsWith('compact-'))
    );

    if (sessions.length === 0) return false;

    // Check if ALL sessions are protected
    for (const session of sessions) {
      const sessionInfo = {
        filename: session,
        path: path.join(dayPath, session),
        type: session.startsWith('compact-') ? 'compact' : 'exit'
      };
      if (!isProtectedSession(sessionInfo)) {
        return false; // At least one non-protected session exists
      }
    }

    return true; // All sessions are protected
  } catch (err) {
    if (!isExpectedFsError(err)) {
      logger(`[summaries] Failed to check day protection ${dayPath}: ${err.message}`);
    }
    return false;
  }
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const val = item[key] || 'other';
    if (!acc[val]) acc[val] = [];
    acc[val].push(item);
    return acc;
  }, {});
}

function formatTypeName(type) {
  const names = {
    goal_theme: 'Goal Themes',
    bug_pattern: 'Bug Patterns',
    file_pattern: 'File Patterns',
    command: 'Commands',
    duration: 'Session Durations',
    general: 'Other Patterns'
  };
  return names[type] || type;
}

/**
 * Synthesize items by theme clustering
 * Groups items by extracted theme and counts occurrences
 *
 * @param {Array} items - Array of strings to synthesize
 * @returns {Array} Array of {theme, count, examples} clusters
 */
function synthesizeByTheme(items) {
  const themeMap = new Map();

  for (const item of items) {
    const normalized = normalizePattern(item);
    const theme = extractTheme(item);

    if (!themeMap.has(theme)) {
      themeMap.set(theme, { theme, count: 0, examples: [] });
    }
    const cluster = themeMap.get(theme);
    cluster.count++;
    if (cluster.examples.length < 2) {
      cluster.examples.push(item);
    }
  }

  return Array.from(themeMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Extract a theme from an item string
 * Groups similar items together based on key words
 *
 * @param {string} item - Item text
 * @returns {string} Theme string
 */
function extractTheme(item) {
  const lower = item.toLowerCase();

  if (lower.includes('fix') || lower.includes('bug')) {
    if (lower.includes('parser')) return 'Bug fixes in parser';
    if (lower.includes('config')) return 'Bug fixes in config';
    if (lower.includes('test')) return 'Test fixes';
    return 'Bug fixes';
  }

  if (lower.includes('add') || lower.includes('implement') || lower.includes('create')) {
    if (lower.includes('test')) return 'Tests added';
    if (lower.includes('feature')) return 'New features';
    if (lower.includes('function') || lower.includes('method')) return 'New functions/methods';
    if (lower.includes('file')) return 'New files created';
    return 'Implementation work';
  }

  if (lower.includes('update') || lower.includes('refactor') || lower.includes('improve')) {
    if (lower.includes('test')) return 'Test updates';
    if (lower.includes('code')) return 'Code refactoring';
    return 'Updates and improvements';
  }

  if (lower.includes('remove') || lower.includes('delete')) {
    return 'Code removal';
  }

  if (lower.includes('read') || lower.includes('investigate') || lower.includes('explore')) {
    return 'Research and investigation';
  }

  if (lower.includes('debug') || lower.includes('troubleshoot')) {
    return 'Debugging';
  }

  if (lower.includes('optimize') || lower.includes('performance')) {
    return 'Performance optimization';
  }

  if (lower.includes('review') || lower.includes('check')) {
    return 'Code review';
  }

  if (lower.includes('docs') || lower.includes('documentation')) {
    return 'Documentation';
  }

  return item.length > 40 ? item.slice(0, 40) + '...' : item;
}

/**
 * Compute week highlights - top 3 most significant items
 *
 * @param {Array} daySummaries - Array of day summary objects
 * @returns {Array} Array of highlight strings
 */
function computeWeekHighlights(daySummaries) {
  const highlights = [];

  const totalBugs = daySummaries.flatMap(d => d.bugsFixed).length;
  const totalAccomplishments = daySummaries.flatMap(d => d.accomplishments).length;
  const totalDiscoveries = daySummaries.flatMap(d => d.discoveries).length;

  if (totalBugs > 0) {
    highlights.push(`Fixed ${totalBugs} bug${totalBugs !== 1 ? 's' : ''} across the week`);
  }

  if (totalAccomplishments >= 5) {
    highlights.push(`Completed ${totalAccomplishments} accomplishments`);
  }

  if (totalDiscoveries >= 3) {
    highlights.push(`Made ${totalDiscoveries} discoveries`);
  }

  const goalDays = daySummaries.filter(d => d.goals.length > 0).length;
  if (goalDays >= 4) {
    highlights.push(`Set goals on ${goalDays} days (${Math.round(goalDays / daySummaries.length * 100)}% goal coverage)`);
  }

  return highlights.slice(0, 3);
}

/**
 * Deduplicate string items by normalized pattern key
 * @param {Array} items - Array of strings to deduplicate
 * @returns {Array} Deduplicated array
 */
function dedupePatternsByKey(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = normalizePattern(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDebounceDelay() {
  return getConfig().debounceMs || 500;
}

/**
 * Extract pinned patterns from intelligence-learning.md for display in summaries
 * @param {string} baseDir - Project base directory
 * @returns {Promise<string>} Formatted pinned patterns section
 */
async function getPinnedPatternsSection(baseDir) {
  const intelPath = path.join(baseDir, CONTEXT_SESSION_DIR, 'intelligence-learning.md');

  try {
    const content = await fs.readFile(intelPath, 'utf-8');
    const patterns = extractPersistentPatterns(content);
    const pinned = patterns.filter(p => p.pinned);

    if (pinned.length === 0) {
      return '';
    }

    let section = '## Pinned Patterns\n\n';
    section += `*${pinned.length} patterns pinned from previous sessions*\n\n`;

    // Group and display top pinned patterns
    const byType = groupBy(pinned, 'type');
    for (const [type, items] of Object.entries(byType)) {
      if (items.length > 0) {
        section += `### ${formatTypeName(type)}\n`;
        for (const p of items.slice(0, 5)) {
          section += `- ${p.pattern}\n`;
        }
        section += '\n';
      }
    }

    return section;
  } catch (err) {
    if (!isExpectedFsError(err)) {
      logger(`[summaries] Failed to read pinned patterns: ${err.message}`);
    }
    return '';
  }
}

export { readDaySessions, isDayFullyProtected, groupBy, formatTypeName, synthesizeByTheme, extractTheme, computeWeekHighlights, dedupePatternsByKey, getDebounceDelay, getPinnedPatternsSection };