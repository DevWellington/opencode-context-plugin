/**
 * @ocp-generate-monthly
 * Generate monthly context summary by aggregating weekly reports
 *
 * Usage: @ocp-generate-monthly [month]
 *
 * Reads: week-summary.md files from each week in the month
 * Saves to: .opencode/context-session/reports/monthly-YYYY-MM.md
 * 
 * Content hierarchy: day (largest) > week > month > annual (smallest)
 */

import path from 'path';
import fs from 'fs/promises';
import { getWeek } from 'date-fns';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORT_PATHS, REPORTS_DIR, CONTEXT_SESSION_DIR, addKeywordNavigation, generateKeywordLinks } from './utils/linkBuilder.js';
import { getConfig } from '../config.js';
import { truncateToBudget } from '../modules/tokenLimit.js';

/**
 * Scan week-summary.md files for a month
 * Reads from week summaries (hierarchical flow), NOT raw session files
 */
async function scanMonthWeekSummaries(directory, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
  const weekSummaries = [];

  try {
    const weekDirs = await fs.readdir(monthDir);

    for (const weekDir of weekDirs) {
      if (!weekDir.startsWith('W')) continue;
      const weekPath = path.join(monthDir, weekDir);
      const weekSummaryPath = path.join(weekPath, 'week-summary.md');

      try {
        const content = await fs.readFile(weekSummaryPath, 'utf-8');
        
        // Extract session count from week summary
        const sessionMatch = content.match(/\*\*Total Sessions:\*\* (\d+)/);
        const totalSessions = parseInt(sessionMatch?.[1] || '0', 10);
        
        // Extract structured sections from week summary
        const goals = extractSection(content, '## Goals');
        const accomplishments = extractSection(content, '## Accomplishments');
        const discoveries = extractSection(content, '## Discoveries');
        const bugsFixed = extractSection(content, '## Bugs Fixed');
        const files = extractSection(content, '## Relevant Files');
        
        weekSummaries.push({
          week: weekDir,
          content,
          goals,
          accomplishments,
          discoveries,
          bugsFixed,
          files,
          totalSessions
        });
      } catch {
        // No week summary for this week
      }
    }
  } catch {
    // Month directory doesn't exist
  }

  return weekSummaries;
}

/**
 * Extract section content from summary file
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
 * Format monthly content with aggregated sections from week summaries
 * Content hierarchy: day > week (largest) > month > annual (smallest)
 */
function formatMonthlyContent(year, monthStr, weekSummaries) {
  let content = `# Monthly Summary - ${year}-${monthStr}\n\n`;
  
  const totalSessions = weekSummaries.reduce((sum, w) => sum + w.totalSessions, 0);
  const totalWeeks = weekSummaries.length;
  
  content += `- **Total Weeks with Sessions:** ${totalWeeks}\n`;
  content += `- **Total Sessions:** ${totalSessions}\n\n`;
  
  // Aggregate Goals from all weeks
  const allGoals = weekSummaries.flatMap(w => w.goals);
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
  
  // Aggregate Accomplishments from all weeks
  const allAccomplishments = weekSummaries.flatMap(w => w.accomplishments);
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
  
  // Aggregate Discoveries from all weeks
  const allDiscoveries = weekSummaries.flatMap(w => w.discoveries);
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
  
  // Aggregate Bugs Fixed from all weeks
  const allBugs = weekSummaries.flatMap(w => w.bugsFixed);
  if (allBugs.length > 0) {
    content += `## Issues Resolved\n\n`;
    for (const bug of allBugs) {
      content += `- ${bug}\n`;
    }
    content += '\n';
  }
  
  // Aggregate Relevant Files from all weeks
  const allFiles = weekSummaries.flatMap(w => w.files);
  if (allFiles.length > 0) {
    content += `## Relevant Files\n\n`;
    const uniqueFiles = [...new Set(allFiles)];
    for (const file of uniqueFiles) {
      content += `- ${file}\n`;
    }
    content += '\n';
  }
  
  // Week-by-Week Summary
  if (weekSummaries.length > 0) {
    content += `## Week-by-Week Summary\n\n`;
    for (const week of weekSummaries) {
      content += `### Week ${week.week}\n\n`;
      content += `- Sessions: ${week.totalSessions}\n`;
      if (week.goals.length > 0) {
        content += `- Goals: ${week.goals.length}\n`;
      }
      if (week.accomplishments.length > 0) {
        content += `- Accomplishments: ${week.accomplishments.length}\n`;
      }
      content += '\n';
    }
  }
  
  return content;
}

export async function generateMonthlySummary(directory, monthDate) {
  let year, month;

  if (monthDate && monthDate.includes('-')) {
    [year, month] = monthDate.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const monthStr = String(month).padStart(2, '0');
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  // Read week summaries (hierarchical flow)
  const weekSummaries = await scanMonthWeekSummaries(directory, year, month);

  // Build content with aggregated data from week summaries
  const bodyContent = formatMonthlyContent(year, monthStr, weekSummaries);

  // Extract keywords from content
  const contentKeywords = extractKeywordsFromContent(bodyContent, 20);
  const filteredKeywords = contentKeywords.filter(k =>
    !['week', 'weekly', 'session', 'sessions', 'total', 'day', 'days', 'month', 'monthly'].includes(k.toLowerCase())
  );

  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateMonthly',
    keywords: filteredKeywords
  });

  const header = `---
title: Monthly Context - ${year}-${monthStr}
keywords: ${keywords}
created: ${new Date().toISOString()}
---

`;

  let body = bodyContent;

  // Apply budget limit
  const budgetCfg = getConfig();
  const monthMaxChars = budgetCfg.budget?.monthlySummary || 2000;
  body = truncateToBudget(body, monthMaxChars);

  // Add keyword navigation for Obsidian
  body += addKeywordNavigation({ type: 'monthly', year, month });

  // Add keyword links
  body += generateKeywordLinks({ keywords: filteredKeywords, year, month, maxLinks: 12 });

  const fullReport = header + body;

  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
  await fs.mkdir(monthDir, { recursive: true });

  const filename = `monthly-${year}-${monthStr}.md`;
  const savePath = path.join(monthDir, filename);
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}