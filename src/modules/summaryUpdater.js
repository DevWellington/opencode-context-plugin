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

        await atomicWrite(summaryPath, finalContent);
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
    await atomicWrite(summaryPath, content);
    logger(`[context-plugin] Updated day summary with content extraction: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating day summary: ${error.message}`);
  }
}

async function updateWeekSummaryImpl(baseDir, year, month, week) {
  try {
    const weekDir = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week);
    const summaryPath = path.join(weekDir, 'week-summary.md');

    let dayDirs = [];
    try {
      const entries = await fs.readdir(weekDir, { withFileTypes: true });
      dayDirs = entries
        .filter(d => d.isDirectory() && /^\d{2}$/.test(d.name))
        .map(d => d.name)
        .sort();
    } catch (e) {
      logger(`[context-plugin] Error reading week directory: ${e.message}`);
      return;
    }

    const daySummaries = [];
    let totalCompacts = 0;
    let totalExits = 0;

    for (const dayDir of dayDirs) {
      const dayPath = path.join(weekDir, dayDir);
      const daySummaryPath = path.join(dayPath, 'day-summary.md');

      try {
        if (await isDayFullyProtected(dayPath)) {
          logger(`[summaries] Skipping fully protected day: ${dayDir}`);
          continue;
        }

        const content = await fs.readFile(daySummaryPath, 'utf-8');

        const compactMatches = content.match(/Compacts: (\d+)/) || [];
        const exitMatches = content.match(/Exits: (\d+)/) || [];
        totalCompacts += parseInt(compactMatches[1] || 0, 10);
        totalExits += parseInt(exitMatches[1] || 0, 10);

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
      }
    }

    let content = `# Week ${week} Summary\n\n`;
    content += `**Period:** ${year}-${month}\n`;
    content += `**Week:** ${week}\n`;
    content += `**Total Sessions:** ${totalCompacts + totalExits} (Compacts: ${totalCompacts}, Exits: ${totalExits})\n\n`;

    const allGoals = daySummaries.flatMap(d => d.goals);
    if (allGoals.length > 0) {
      content += `## Goals\n\n`;
      const goalClusters = synthesizeByTheme(allGoals);
      for (const cluster of goalClusters) {
        if (cluster.count > 1) {
          content += `- **${cluster.theme}** (${cluster.count} days)\n`;
        } else {
          content += `- ${cluster.examples[0]}\n`;
        }
      }
      content += '\n';
    }

    const allAccomplishments = daySummaries.flatMap(d => d.accomplishments);
    if (allAccomplishments.length > 0) {
      content += `## Accomplishments\n\n`;
      const uniqueAccomplishments = dedupePatternsByKey(allAccomplishments).filter(key => key.length > 5);
      const accClusters = synthesizeByTheme(uniqueAccomplishments);
      for (const cluster of accClusters) {
        if (cluster.count > 1) {
          content += `- **${cluster.theme}** (${cluster.count} occurrences)\n`;
        } else {
          content += `- ${cluster.examples[0]}\n`;
        }
      }
      content += '\n';
    }

    const allDiscoveries = daySummaries.flatMap(d => d.discoveries);
    if (allDiscoveries.length > 0) {
      content += `## Discoveries\n\n`;
      const uniqueDiscoveries = dedupePatternsByKey(allDiscoveries).filter(key => key.length > 5);
      const discClusters = synthesizeByTheme(uniqueDiscoveries);
      for (const cluster of discClusters) {
        if (cluster.count > 1) {
          content += `- **${cluster.theme}** (${cluster.count} occurrences)\n`;
        } else {
          content += `- ${cluster.examples[0]}\n`;
        }
      }
      content += '\n';
    }

    const allBugs = daySummaries.flatMap(d => d.bugsFixed);
    if (allBugs.length > 0) {
      content += `## Bugs Fixed\n\n`;
      const bugClusters = synthesizeByTheme(allBugs);
      const totalBugs = allBugs.length;
      content += `**Total:** ${totalBugs} bug${totalBugs !== 1 ? 's' : ''} fixed across ${daySummaries.length} days\n\n`;
      for (const cluster of bugClusters) {
        if (cluster.count > 1) {
          content += `- **${cluster.theme}** (${cluster.count} occurrences)\n`;
        } else {
          content += `- ${cluster.examples[0]}\n`;
        }
      }
      content += '\n';
    }

    const allFiles = daySummaries.flatMap(d => d.files);
    if (allFiles.length > 0) {
      content += `## Relevant Files\n\n`;
      const uniqueFiles = [...new Set(allFiles)];
      for (const file of uniqueFiles.slice(0, 15)) {
        content += `- ${file}\n`;
      }
      if (uniqueFiles.length > 15) {
        content += `- ... and ${uniqueFiles.length - 15} more\n`;
      }
      content += '\n';
    }

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

    content += `## Day-by-Day Summary\n\n`;
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

    content += `---\n*Aggregated from ${daySummaries.length} day summaries*\n`;

    await atomicWrite(summaryPath, content);
    logger(`[context-plugin] Updated week summary from day summaries: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating week summary: ${error.message}`);
  }
}

export const updateDailySummary = debounce(updateDailySummaryImpl, getDebounceDelay);
export const updateWeekSummary = debounce(updateWeekSummaryImpl, getDebounceDelay);
export { updateDaySummary };