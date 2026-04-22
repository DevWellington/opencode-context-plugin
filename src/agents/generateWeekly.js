/**
 * @ocp-generate-weekly
 * Generate weekly context summary by aggregating daily summaries
 *
 * Usage: @ocp-generate-weekly [date]
 *
 * Reads: day-summary.md files from each day in the week
 * Saves to: .opencode/context-session/YYYY/MM/WW/week-summary.md
 */

import path from 'path';
import fs from 'fs/promises';
import { getWeek } from 'date-fns';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORT_PATHS, REPORTS_DIR, CONTEXT_SESSION_DIR, addKeywordNavigation, generateKeywordLinks } from './utils/linkBuilder.js';
import { getConfig } from '../config.js';
import { truncateToBudget } from '../modules/tokenLimit.js';
import { shouldRegenerate } from '../modules/summaries.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-plugin');

/**
 * Scan day-summary.md files in a week directory and extract content
 * Reads from day summaries (hierarchical flow), NOT raw session files
 */
async function scanWeekDaySummaries(weekDir) {
  const daySummaries = [];
  
  try {
    const dayDirs = await fs.readdir(weekDir, { withFileTypes: true });
    
    for (const dayDir of dayDirs) {
      if (!dayDir.isDirectory() || !/^\d{2}$/.test(dayDir.name)) continue;
      
      const dayPath = path.join(weekDir, dayDir.name);
      const daySummaryPath = path.join(dayPath, 'day-summary.md');
      
      try {
        const content = await fs.readFile(daySummaryPath, 'utf-8');
        
        // Count sessions from the day summary
        const compactMatch = content.match(/Compacts: (\d+)/);
        const exitMatch = content.match(/Exits: (\d+)/);
        
        // Extract structured sections
        const goals = extractSection(content, '## Goals');
        const accomplishments = extractSection(content, '## Accomplishments');
        const discoveries = extractSection(content, '## Discoveries');
        const bugsFixed = extractSection(content, '## Bugs Fixed');
        const files = extractSection(content, '## Relevant Files');
        
        daySummaries.push({
          day: dayDir.name,
          dateStr: extractDateStr(content),
          content,
          goals,
          accomplishments,
          discoveries,
          bugsFixed,
          files,
          compactCount: parseInt(compactMatch?.[1] || '0', 10),
          exitCount: parseInt(exitMatch?.[1] || '0', 10)
        });
      } catch {
        // No day summary for this day
      }
    }
  } catch {
    // Week directory doesn't exist
  }
  
  return daySummaries;
}

/**
 * Extract date string from day summary content
 */
function extractDateStr(content) {
  const match = content.match(/\*\*Date:\*\* (\d{4}-\d{2}-\d{2})/);
  return match?.[1] || 'unknown';
}

/**
 * Extract section content from day summary
 * Strips emojis and bullet markers to get clean text
 */
function extractSection(content, sectionHeading) {
  const lines = content.split('\n');
  const results = [];
  let inSection = false;
  
  for (const line of lines) {
    if (line.startsWith(sectionHeading)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        break;
      }
      if (line.trim().startsWith('- ')) {
        // Strip emoji prefixes and bullet markers to get clean text
        let text = line.trim().substring(2).trim();
        // Remove emoji prefixes (with or without dash): "✅ - ", "💡 ", "✅"
        text = text.replace(/^[✅💡🐛🔧📝🔍📦🚪][\s-–]*/, '');
        // Remove any remaining bullet markers
        text = text.replace(/^[-*]\s*/, '');
        if (text.length > 0) {
          results.push(text);
        }
      }
    }
  }
  
  return results;
}

/**
 * Format weekly content with aggregated sections from day summaries
 * Content hierarchy: day (largest) > week > month > annual (smallest)
 */
function formatWeeklyContent(year, weekStr, daySummaries) {
  let content = `## Weekly Summary - ${year}-${weekStr}\n\n`;
  
  const totalSessions = daySummaries.reduce((sum, d) => sum + d.compactCount + d.exitCount, 0);
  const totalDays = daySummaries.length;
  
  content += `- **Total Days with Sessions:** ${totalDays}\n`;
  content += `- **Total Sessions:** ${totalSessions}\n\n`;
  
  // Aggregate Goals from all days
  const allGoals = daySummaries.flatMap(d => d.goals);
  if (allGoals.length > 0) {
    content += `## Goals\n\n`;
    const seenGoals = new Set();
    for (const goal of allGoals) {
      const key = goal.slice(0, 50).toLowerCase().trim();
      if (!seenGoals.has(key) && key.length > 5) {
        seenGoals.add(key);
        content += `- ${goal}\n`;
      }
    }
    content += '\n';
  }
  
  // Aggregate Accomplishments from all days
  const allAccomplishments = daySummaries.flatMap(d => d.accomplishments);
  if (allAccomplishments.length > 0) {
    content += `## Accomplishments\n\n`;
    const seenAccomplishments = new Set();
    for (const acc of allAccomplishments) {
      const key = acc.slice(0, 50).toLowerCase().trim();
      if (!seenAccomplishments.has(key) && key.length > 5) {
        seenAccomplishments.add(key);
        content += `- ✅ ${acc}\n`;
      }
    }
    content += '\n';
  }
  
  // Aggregate Discoveries from all days
  const allDiscoveries = daySummaries.flatMap(d => d.discoveries);
  if (allDiscoveries.length > 0) {
    content += `## Discoveries\n\n`;
    const seenDiscoveries = new Set();
    for (const disc of allDiscoveries) {
      const key = disc.slice(0, 50).toLowerCase().trim();
      if (!seenDiscoveries.has(key) && key.length > 5) {
        seenDiscoveries.add(key);
        content += `- 💡 ${disc}\n`;
      }
    }
    content += '\n';
  }
  
  // Aggregate Bugs Fixed from all days
  const allBugs = daySummaries.flatMap(d => d.bugsFixed);
  if (allBugs.length > 0) {
    content += `## Bugs Fixed\n\n`;
    for (const bug of allBugs) {
      content += `- ${bug}\n`;
    }
    content += '\n';
  }
  
  // Aggregate Relevant Files from all days
  const allFiles = daySummaries.flatMap(d => d.files);
  if (allFiles.length > 0) {
    content += `## Relevant Files\n\n`;
    const uniqueFiles = [...new Set(allFiles)];
    for (const file of uniqueFiles) {
      content += `- ${file}\n`;
    }
    content += '\n';
  }
  
  // Day-by-Day Summary
  if (daySummaries.length > 0) {
    content += `## Day-by-Day Summary\n\n`;
    for (const day of daySummaries) {
      content += `### Day ${day.day} (${day.dateStr})\n`;
      content += `- Sessions: ${day.compactCount + day.exitCount} (Exit: ${day.exitCount}, Compact: ${day.compactCount})\n`;
      content += `- [[${day.day}/day-summary.md]]\n\n`;
    }
  }
  
  return content;
}

export async function generateWeeklySummary(directory, weekDate) {
  const date = weekDate ? new Date(weekDate) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const weekNum = getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const weekStr = `W${String(weekNum).padStart(2, '0')}`;

  const weekDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month, weekStr);

  // Read day-summary.md files from each day in the week (hierarchical flow)
  const daySummaries = await scanWeekDaySummaries(weekDir);

  // Build content with aggregated data from day summaries
  const bodyContent = formatWeeklyContent(year, weekStr, daySummaries);

  // Extract keywords from content
  const contentKeywords = extractKeywordsFromContent(bodyContent, 20);
  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateWeekly',
    keywords: contentKeywords
  });

  const header = `---
title: Weekly Context - ${year}-${weekStr}
keywords: ${keywords}
created: ${new Date().toISOString()}
---

`;

  let body = bodyContent;

  // Apply budget limit
  const budgetCfg = getConfig();
  const weekMaxChars = budgetCfg.budget?.weekSummary || 3000;
  body = truncateToBudget(body, weekMaxChars);

  body += addRelatedLinks([
    'intelligence-learning.md',
    `../reports/monthly-${year}-${month}.md`
  ]);

  // Add keyword navigation for Obsidian
  body += addKeywordNavigation({ type: 'weekly', year, month, week: weekStr });

  // Add keyword links
  body += generateKeywordLinks({ keywords: contentKeywords, year, month, week: weekStr, maxLinks: 15 });

  const fullReport = header + body;

  const savePath = path.join(weekDir, 'week-summary.md');

  // Check if regeneration is needed
  let existingContent = '';
  try {
    existingContent = await fs.readFile(savePath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  const { shouldRegenerate: needsRegen, changePercent } = shouldRegenerate(existingContent, fullReport);

  if (!needsRegen) {
    logger('[generateWeekly] Skipped - no meaningful change (change: ' + changePercent + '%)');
    return existingContent;
  }

  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}