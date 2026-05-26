import fs from "fs/promises";
import path from "path";
import { getConfig, CONTEXT_SESSION_DIR } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { debounce } from '../utils/debounce.js';
import { atomicWrite } from '../utils/fileUtils.js';
import { extractSessionContent, extractBugs } from './contentExtractor.js';
import { isProtectedSession } from '../utils/patternMatcher.js';
import { formatDayContent } from './daySummaryFormatter.js';
import { readDaySessions, isDayFullyProtected, synthesizeByTheme, computeWeekHighlights, getPinnedPatternsSection, groupBy, formatTypeName, dedupePatternsByKey } from './daySummaryAggregator.js';
import { extractSection } from '../utils/summaryUtils.js';
import { isExpectedFsError } from '../utils/errorUtils.js';

const logger = createDebugLogger('context-plugin');
let dailySummaryLock = Promise.resolve();

function getDebounceDelay() {
  return getConfig().debounceMs || 500;
}

async function updateDailySummaryImpl(baseDir, sessionInfo) {
  try {
    const summaryPath = path.join(baseDir, CONTEXT_SESSION_DIR, 'daily-summary.md');
    const today = new Date().toISOString().split('T')[0];

    const currentLock = dailySummaryLock;

    dailySummaryLock = (async () => {
      await currentLock.catch(() => {});

      let existingEntries = [];
      let currentHeader = null;

      try {
        const content = await fs.readFile(summaryPath, 'utf-8');

        const lines = content.split('\n');
        const entriesStart = lines.findIndex(line => line.startsWith('- ['));

        if (entriesStart !== -1) {
          for (let i = entriesStart; i < lines.length; i++) {
            if (lines[i].startsWith('- [')) {
              existingEntries.push(lines[i]);
            }
          }

          const dateHeaderIdx = lines.findIndex(line => line.startsWith('## '));
          if (dateHeaderIdx !== -1) {
            currentHeader = lines[dateHeaderIdx].replace('## ', '').trim();
          }
        }
      } catch (e) {
        if (!isExpectedFsError(e)) {
          logger(`[context-plugin] Error reading existing summary: ${e.message}`);
        }
      }

      if (currentHeader !== today) {
        existingEntries = [];
      }

      const typeEmoji = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
      const newEntry = `- [${sessionInfo.timestamp}] ${typeEmoji}: ${sessionInfo.filename}`;

      const alreadyExists = existingEntries.some(entry => entry.includes(sessionInfo.filename));

      if (!alreadyExists) {
        existingEntries.push(newEntry);

        const totalSessions = existingEntries.length;
        const compactCount = existingEntries.filter(e => e.includes('📦')).length;
        const exitCount = existingEntries.filter(e => e.includes('🚪')).length;

        let finalContent = `# Daily Summary\n\n`;
        finalContent += `## ${today}\n\n`;
        finalContent += `**Total Sessions:** ${totalSessions}\n`;
        finalContent += `**Compacts:** ${compactCount} | **Exits:** ${exitCount}\n\n`;
        finalContent += existingEntries.join('\n') + '\n';

        await atomicWrite(summaryPath, finalContent, path.dirname(summaryPath));
        logger(`[context-plugin] Updated daily summary: ${summaryPath}`);
      }
    })();

    await dailySummaryLock;

  } catch (error) {
    logger(`[context-plugin] Error updating daily summary: ${error.message}`);
  }
}

async function updateDaySummary(dirPath, sessionInfo) {
  try {
    const sessionsData = await readDaySessions(dirPath);

    const dateStr = `${sessionInfo.year}-${String(sessionInfo.month).padStart(2, '0')}-${String(sessionInfo.day).padStart(2, '0')}`;

    const allContent = sessionsData.map(s => s.content).join('\n');

    const content = formatDayContent(dateStr, sessionsData, sessionInfo.year, sessionInfo.month, sessionInfo.week, allContent);

    const summaryPath = path.join(dirPath, 'day-summary.md');
    await atomicWrite(summaryPath, content, path.dirname(summaryPath));
    logger(`[context-plugin] Updated day summary with content extraction: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating day summary: ${error.message}`);
  }
}

/**
 * Reads all day summary files from a week directory
 * @param {string} baseDir - Base project directory
 * @param {number} year - Year
 * @param {string} month - Zero-padded month
 * @param {string} week - Week folder (e.g. 'W12')
 * @returns {Array|null} Array of day summary objects, or null if week dir missing
 */
async function readWeekDaySummaries(baseDir, year, month, week) {
  const weekDir = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week);

  let dayDirs = [];
  try {
    const entries = await fs.readdir(weekDir, { withFileTypes: true });
    dayDirs = entries
      .filter(d => d.isDirectory() && /^\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort();
  } catch (e) {
    logger(`[context-plugin] Error reading week directory: ${e.message}`);
    return null;
  }

  const daySummaries = [];
  for (const dayDir of dayDirs) {
    const dayPath = path.join(weekDir, dayDir);
    const daySummaryPath = path.join(dayPath, 'day-summary.md');

    try {
      if (await isDayFullyProtected(dayPath)) {
        logger(`[summaries] Skipping fully protected day: ${dayDir}`);
        continue;
      }

      const content = await fs.readFile(daySummaryPath, 'utf-8');

      const goals = extractSection(content, '## Goals');
      const accomplishments = extractSection(content, '## Accomplishments');
      const discoveries = extractSection(content, '## Discoveries');
      const bugsFixed = extractSection(content, '## Bugs Fixed');
      const files = extractSection(content, '## Relevant Files');

      daySummaries.push({
        day: dayDir,
        content,
        goals,
        accomplishments,
        discoveries,
        bugsFixed,
        files
      });
    } catch (e) {
      if (!isExpectedFsError(e)) {
        logger(`[summaries] Error reading day summary ${dayDir}: ${e.message}`);
      }
    }
  }

  return daySummaries;
}

/**
 * Computes total compact and exit session counts from day summaries
 * @param {Array} daySummaries - Array of day summary objects with content
 * @returns {Object} { totalCompacts, totalExits }
 */
function computeWeekStats(daySummaries) {
  let totalCompacts = 0;
  let totalExits = 0;

  for (const day of daySummaries) {
    const compactMatches = day.content.match(/Compacts: (\d+)/) || [];
    const exitMatches = day.content.match(/Exits: (\d+)/) || [];
    totalCompacts += parseInt(compactMatches[1] || 0, 10);
    totalExits += parseInt(exitMatches[1] || 0, 10);
  }

  return { totalCompacts, totalExits };
}

/**
 * Generates week summary markdown content with all sections
 * @param {Array} daySummaries - Array of day summary objects
 * @param {number} totalCompacts - Total compact sessions
 * @param {number} totalExits - Total exit sessions
 * @param {number} year - Year
 * @param {string} month - Zero-padded month
 * @param {string} week - Week folder (e.g. 'W12')
 * @param {string} baseDir - Base project directory (for pinned patterns)
 * @returns {Promise<string>} Formatted week summary content
 */
function formatClusteredList(items, sectionTitle) {
  if (items.length === 0) return '';
  const clusters = synthesizeByTheme(items);
  let content = `## ${sectionTitle}\n\n`;
  for (const cluster of clusters) {
    if (cluster.count > 1) {
      content += `- **${cluster.theme}** (${cluster.count} ${sectionTitle.toLowerCase()})\n`;
    } else {
      content += `- ${cluster.examples[0]}\n`;
    }
  }
  return content + '\n';
}

function formatBugsFixedSection(bugs, dayCount) {
  if (bugs.length === 0) return '';
  const clusters = synthesizeByTheme(bugs);
  let content = `## Bugs Fixed\n\n`;
  content += `**Total:** ${bugs.length} bug${bugs.length !== 1 ? 's' : ''} fixed across ${dayCount} days\n\n`;
  for (const cluster of clusters) {
    if (cluster.count > 1) {
      content += `- **${cluster.theme}** (${cluster.count} occurrences)\n`;
    } else {
      content += `- ${cluster.examples[0]}\n`;
    }
  }
  return content + '\n';
}

function formatFilesSection(files) {
  if (files.length === 0) return '';
  const uniqueFiles = [...new Set(files)];
  let content = `## Relevant Files\n\n`;
  for (const file of uniqueFiles.slice(0, 15)) {
    content += `- ${file}\n`;
  }
  if (uniqueFiles.length > 15) {
    content += `- ... and ${uniqueFiles.length - 15} more\n`;
  }
  return content + '\n';
}

function formatDayByDaySection(daySummaries, year, month, week) {
  let content = `## Day-by-Day Summary\n\n`;
  for (const daySummary of daySummaries) {
    content += `### Day ${daySummary.day}\n\n`;
    content += `- [[${year}/${month}/${week}/${daySummary.day}/day-summary.md]]\n`;
    if (daySummary.goals.length > 0) {
      content += `  - Goals: ${daySummary.goals.length}\n`;
    }
    if (daySummary.accomplishments.length > 0) {
      content += `  - Accomplishments: ${daySummary.accomplishments.length}\n`;
    }
    content += '\n';
  }
  return content;
}

async function formatWeekContent(daySummaries, totalCompacts, totalExits, year, month, week, baseDir) {
  let content = `# Week ${week} Summary\n\n`;
  content += `**Period:** ${year}-${month}\n`;
  content += `**Week:** ${week}\n`;
  content += `**Total Sessions:** ${totalCompacts + totalExits} (Compacts: ${totalCompacts}, Exits: ${totalExits})\n\n`;

  const allGoals = daySummaries.flatMap(d => d.goals);
  content += formatClusteredList(allGoals, 'Goals');

  const allAccomplishments = dedupePatternsByKey(daySummaries.flatMap(d => d.accomplishments)).filter(k => k.length > 5);
  content += formatClusteredList(allAccomplishments, 'Accomplishments');

  const allDiscoveries = dedupePatternsByKey(daySummaries.flatMap(d => d.discoveries)).filter(k => k.length > 5);
  content += formatClusteredList(allDiscoveries, 'Discoveries');

  const allBugs = daySummaries.flatMap(d => d.bugsFixed);
  content += formatBugsFixedSection(allBugs, daySummaries.length);

  const allFiles = daySummaries.flatMap(d => d.files);
  content += formatFilesSection(allFiles);

  const highlights = computeWeekHighlights(daySummaries);
  if (highlights.length > 0) {
    content += `## Week Highlights\n\n`;
    for (const h of highlights) {
      content += `- ${h}\n`;
    }
    content += '\n';
  }

  const pinnedSection = await getPinnedPatternsSection(baseDir);
  if (pinnedSection) {
    content += pinnedSection;
  }

  content += formatDayByDaySection(daySummaries, year, month, week);
  content += `---\n*Aggregated from ${daySummaries.length} day summaries*\n`;
  return content;
}

async function updateWeekSummaryImpl(baseDir, year, month, week) {
  try {
    const weekDir = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week);
    const summaryPath = path.join(weekDir, 'week-summary.md');

    const daySummaries = await readWeekDaySummaries(baseDir, year, month, week);
    if (daySummaries === null) return;

    const { totalCompacts, totalExits } = computeWeekStats(daySummaries);
    const content = await formatWeekContent(daySummaries, totalCompacts, totalExits, year, month, week, baseDir);

    await atomicWrite(summaryPath, content, path.dirname(summaryPath));
    logger(`[context-plugin] Updated week summary from day summaries: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating week summary: ${error.message}`);
  }
}

export const updateDailySummary = debounce(updateDailySummaryImpl, getDebounceDelay);
export const updateWeekSummary = debounce(updateWeekSummaryImpl, getDebounceDelay);
export { updateDaySummary };