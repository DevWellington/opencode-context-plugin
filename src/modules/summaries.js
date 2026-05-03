import fs from "fs/promises";
import path from "path";
import { getConfig, CONTEXT_SESSION_DIR } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { debounce } from '../utils/debounce.js';
import { atomicWrite } from '../utils/fileUtils.js';
import { extractSessionContent, extractBugs, extractPersistentPatterns, normalizePattern, dedupePatterns } from './contentExtractor.js';
import { countSessionTokens, countTokens, isCodeContent } from './tokenLimit.js';
import { isProtectedSession, isProtectedContent, getProtectionStatus } from '../utils/patternMatcher.js';
import { buildKeywords, extractKeywordsFromContent, addRelatedLinks, addKeywordNavigation } from '../agents/utils/linkBuilder.js';
import { extractSection } from '../utils/summaryUtils.js';
import { parseSessionToMessages, groupDiscoveriesByType, groupFilesByProject, extractKeyDecisions, formatDayContent } from './daySummaryFormatter.js';
import { readDaySessions, isDayFullyProtected, groupBy, formatTypeName, synthesizeByTheme, extractTheme, computeWeekHighlights, dedupePatternsByKey, getDebounceDelay, getPinnedPatternsSection } from './daySummaryAggregator.js';

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
  // No old content means always regenerate
  if (!oldContent) {
    return { shouldRegenerate: true, savingsPercent: 100, changePercent: 100 };
  }
  
  const oldLen = oldContent.length;
  const newLen = newContent.length;
  
  // No change
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
  
  // Count entries in existing summary
  const existingMatch = existingSummary.match(/- \[(\d{4}-\d{2}-\d{2})/g);
  const existingCount = existingMatch ? existingMatch.length : 0;
  
  return newSessions.length > existingCount;
}

// In-memory lock for daily summary updates to prevent race conditions
let dailySummaryLock = Promise.resolve();

/**
 * Update daily summary at context-session root
 * This file is debounced to prevent excessive I/O on rapid saves
 */
async function updateDailySummaryImpl(baseDir, sessionInfo) {
  try {
    const summaryPath = path.join(baseDir, CONTEXT_SESSION_DIR, 'daily-summary.md');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Use lock to serialize writes and prevent race conditions
    // Chain the promise BEFORE doing any work
    const currentLock = dailySummaryLock;
    
    dailySummaryLock = (async () => {
      // Wait for previous operation to complete
      await currentLock.catch(() => {});
      
      // Read existing summary or create new
      let existingEntries = [];
      let currentHeader = null;
      
      try {
        const content = await fs.readFile(summaryPath, 'utf-8');
        
        // Parse existing content to extract entries and current date header
        const lines = content.split('\n');
        const entriesStart = lines.findIndex(line => line.startsWith('- ['));
        
        if (entriesStart !== -1) {
          // Extract existing entries
          for (let i = entriesStart; i < lines.length; i++) {
            if (lines[i].startsWith('- [')) {
              existingEntries.push(lines[i]);
            }
          }
          
          // Check current date header
          const dateHeaderIdx = lines.findIndex(line => line.startsWith('## '));
          if (dateHeaderIdx !== -1) {
            currentHeader = lines[dateHeaderIdx].replace('## ', '').trim();
          }
        }
      } catch (e) {
        // File doesn't exist yet
      }
      
      // Check if we need to update the date header (new day)
      if (currentHeader !== today) {
        // New day - reset content with new date header
        existingEntries = [];
      }
      
      // Format new entry
      const typeEmoji = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
      const newEntry = `- [${sessionInfo.timestamp}] ${typeEmoji}: ${sessionInfo.filename}`;
      
      // Check if filename already exists (idempotency)
      const alreadyExists = existingEntries.some(entry => entry.includes(sessionInfo.filename));
      
      if (!alreadyExists) {
        existingEntries.push(newEntry);
        
        // Calculate statistics
        const totalSessions = existingEntries.length;
        const compactCount = existingEntries.filter(e => e.includes('📦')).length;
        const exitCount = existingEntries.filter(e => e.includes('🚪')).length;
        
        // Build final content from scratch
        let finalContent = `# Daily Summary\n\n`;
        finalContent += `## ${today}\n\n`;
        finalContent += `**Total Sessions:** ${totalSessions}\n`;
        finalContent += `**Compacts:** ${compactCount} | **Exits:** ${exitCount}\n\n`;
        finalContent += existingEntries.join('\n') + '\n';
        
        await atomicWrite(summaryPath, finalContent);
        logger(`[context-plugin] Updated daily summary: ${summaryPath}`);
      }
    })();
    
    // Wait for our turn to complete
    await dailySummaryLock;
    
  } catch (error) {
    logger(`[context-plugin] Error updating daily summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

/**
 * Update day summary in hierarchical folder
 * Now uses contentExtractor to extract Goals, Accomplishments, Discoveries, Bugs, Relevant Files
 */
async function updateDaySummary(dirPath, sessionInfo) {
  try {
    // Read all session files from this day directory to build comprehensive summary
    const sessionsData = await readDaySessions(dirPath);
    
    // Format date string with zero-padding
    const dateStr = `${sessionInfo.year}-${String(sessionInfo.month).padStart(2, '0')}-${String(sessionInfo.day).padStart(2, '0')}`;
    
    // Build allContent for keyword extraction
    const allContent = sessionsData.map(s => s.content).join('\n');
    
    // Generate comprehensive day summary with extracted content
    const content = formatDayContent(dateStr, sessionsData, sessionInfo.year, sessionInfo.month, sessionInfo.week, allContent);
    
    const summaryPath = path.join(dirPath, 'day-summary.md');
    await atomicWrite(summaryPath, content);
    logger(`[context-plugin] Updated day summary with content extraction: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating day summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

/**
 * Update week summary aggregating all days in the week
 * Reads from day-summary.md files (NOT raw session files)
 * The content hierarchy: day > week > month > annual (descending size)
 */
async function updateWeekSummaryImpl(baseDir, year, month, week) {
  try {
    const weekDir = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week);
    const summaryPath = path.join(weekDir, 'week-summary.md');
    
    // Read day directories
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
    
    // Read content from each day-summary.md file
    const daySummaries = [];
    let totalCompacts = 0;
    let totalExits = 0;
    
    for (const dayDir of dayDirs) {
      const dayPath = path.join(weekDir, dayDir);
      const daySummaryPath = path.join(dayPath, 'day-summary.md');
      
      try {
        // Skip days that are entirely protected sessions
        if (await isDayFullyProtected(dayPath)) {
          logger(`[summaries] Skipping fully protected day: ${dayDir}`);
          continue;
        }
        
        const content = await fs.readFile(daySummaryPath, 'utf-8');
        
        // Count sessions from the day summary
        const compactMatches = content.match(/Compacts: (\d+)/) || [];
        const exitMatches = content.match(/Exits: (\d+)/) || [];
        totalCompacts += parseInt(compactMatches[1] || 0, 10);
        totalExits += parseInt(exitMatches[1] || 0, 10);
        
        // Extract structured sections from day-summary.md
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
        // No summary for this day yet
      }
    }
    
    // Generate week summary with aggregated content
    let content = `# Week ${week} Summary\n\n`;
    content += `**Period:** ${year}-${month}\n`;
    content += `**Week:** ${week}\n`;
    content += `**Total Sessions:** ${totalCompacts + totalExits} (Compacts: ${totalCompacts}, Exits: ${totalExits})\n\n`;
    
    // Synthesize Goals by theme clustering
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
    
    // Synthesize Accomplishments by type clustering
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
    
    // Synthesize Discoveries by topic clustering
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
    
    // Synthesize Bugs Fixed with trend info
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
    
    // Aggregate Relevant Files (still just unique list)
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
    
    // Week Highlights - top 3 most significant items
    const highlights = computeWeekHighlights(daySummaries);
    if (highlights.length > 0) {
      content += `## Week Highlights\n\n`;
      for (const h of highlights) {
        content += `- ${h}\n`;
      }
      content += '\n';
    }
    
    // Add Pinned Patterns from intelligence learning
    const pinnedSection = await getPinnedPatternsSection(baseDir);
    if (pinnedSection) {
      content += pinnedSection;
    }
    
    // Day-by-Day Summary (link to each day-summary.md)
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

/**
 * Get session age in days
 * @param {string} sessionPath - Path to session file
 * @returns {Promise<number>} Days since last modified
 */
export async function getSessionAge(sessionPath) {
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
export function getSessionPriority(sessionContent) {
  // Match priority: "value" or priority: value (stop at newline or closing punctuation)
  const match = sessionContent.match(/priority:\s*["']?([a-z]+)["']?/i);
  if (!match) return 'medium';
  const value = match[1].toLowerCase();
  // Only accept known priority values
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
export function shouldPruneSession(sessionContent, ageDays) {
  const config = getConfig();
  const priority = getSessionPriority(sessionContent);
  const retentionDays = {
    high: config.priority?.highRetention ?? -1,
    medium: config.priority?.mediumRetention ?? 90,
    low: config.priority?.lowRetention ?? 30
  };

  const retention = retentionDays[priority] ?? 90;
  if (retention === -1) return false; // Never prune high priority
  return ageDays > retention;
}



