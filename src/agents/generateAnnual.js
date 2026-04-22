/**
 * @ocp-generate-annual
 * Generate annual context summary by aggregating monthly reports
 *
 * Usage: @ocp-generate-annual [year]
 *
 * Reads: monthly-YYYY-MM.md files from each month in the year
 * Saves to: .opencode/context-session/reports/annual-YYYY.md
 * 
 * Content hierarchy: day > week > month (largest) > annual (smallest)
 */

import path from 'path';
import fs from 'fs/promises';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORTS_DIR, CONTEXT_SESSION_DIR, addKeywordNavigation, generateKeywordLinks } from './utils/linkBuilder.js';
import { getConfig } from '../config.js';
import { truncateToBudget } from '../modules/tokenLimit.js';

/**
 * Scan monthly-YYYY-MM.md files for a year
 * Reads from monthly files (hierarchical flow), NOT raw session files
 */
async function scanYearMonthlyFiles(directory, year) {
  const monthlyFiles = [];

  for (let month = 1; month <= 12; month++) {
    const monthStr = String(month).padStart(2, '0');
    const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
    const monthlyPath = path.join(monthDir, `monthly-${year}-${monthStr}.md`);

    try {
      const content = await fs.readFile(monthlyPath, 'utf-8');
      
      // Extract session count from monthly file
      const sessionMatch = content.match(/\*\*Total Sessions:\*\* (\d+)/);
      const totalSessions = parseInt(sessionMatch?.[1] || '0', 10);
      
      // Extract structured sections from monthly file
      const goals = extractSection(content, '## Goals');
      const accomplishments = extractSection(content, '## Accomplishments');
      const discoveries = extractSection(content, '## Discoveries');
      const issuesResolved = extractSection(content, '## Issues Resolved');
      const files = extractSection(content, '## Relevant Files');
      
      monthlyFiles.push({
        month: monthStr,
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        content,
        goals,
        accomplishments,
        discoveries,
        issuesResolved,
        files,
        totalSessions
      });
    } catch {
      // No monthly file for this month
    }
  }

  return monthlyFiles;
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
 * Get quarter from month number (1-12)
 */
function getQuarter(month) {
  if (month >= 1 && month <= 3) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q2';
  if (month >= 7 && month <= 9) return 'Q3';
  return 'Q4';
}

/**
 * Format annual content with aggregated sections from monthly files
 * Content hierarchy: day > week > month > annual (largest to smallest)
 */
function formatAnnualContent(year, monthlyFiles) {
  let content = `# Annual Summary - ${year}\n\n`;
  
  const totalSessions = monthlyFiles.reduce((sum, m) => sum + m.totalSessions, 0);
  const totalMonths = monthlyFiles.length;
  
  content += `- **Total Months with Sessions:** ${totalMonths}\n`;
  content += `- **Total Sessions:** ${totalSessions}\n\n`;
  
  // Aggregate Goals from all months
  const allGoals = monthlyFiles.flatMap(m => m.goals);
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
  
  // Aggregate Accomplishments from all months
  const allAccomplishments = monthlyFiles.flatMap(m => m.accomplishments);
  if (allAccomplishments.length > 0) {
    content += `## Major Accomplishments\n\n`;
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
  
  // Aggregate Discoveries from all months
  const allDiscoveries = monthlyFiles.flatMap(m => m.discoveries);
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
  
  // Aggregate Issues Resolved from all months
  const allIssues = monthlyFiles.flatMap(m => m.issuesResolved);
  if (allIssues.length > 0) {
    content += `## Issues Resolved\n\n`;
    for (const issue of allIssues) {
      content += `- ${issue}\n`;
    }
    content += '\n';
  }
  
  // Aggregate Relevant Files from all months
  const allFiles = monthlyFiles.flatMap(m => m.files);
  if (allFiles.length > 0) {
    content += `## Relevant Files\n\n`;
    const uniqueFiles = [...new Set(allFiles)];
    for (const file of uniqueFiles) {
      content += `- ${file}\n`;
    }
    content += '\n';
  }
  
  // Quarterly Themes
  content += `## Quarterly Themes\n\n`;
  const quarterNames = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  for (let i = 0; i < quarters.length; i++) {
    const quarter = quarters[i];
    const quarterMonths = monthlyFiles.filter(m => getQuarter(parseInt(m.month)) === quarter);
    const quarterSessions = quarterMonths.reduce((sum, m) => sum + m.totalSessions, 0);
    const quarterAccomplishments = quarterMonths.flatMap(m => m.accomplishments);
    
    content += `### ${quarterNames[i]}\n\n`;
    content += `- **Sessions:** ${quarterSessions}\n`;
    
    if (quarterAccomplishments.length > 0) {
      content += `- **Top Accomplishments:**\n`;
      const seenAccomplishments = new Set();
      for (const acc of quarterAccomplishments) {
        const key = acc.slice(0, 50).toLowerCase().trim();
        if (!seenAccomplishments.has(key) && key.length > 5) {
          seenAccomplishments.add(key);
          const firstLine = acc.split('\n')[0].trim();
          content += `  - ✅ ${firstLine}\n`;
        }
      }
    }
    
    content += '\n';
  }
  
  // Month-by-Month Summary
  if (monthlyFiles.length > 0) {
    content += `## Month-by-Month Summary\n\n`;
    for (const month of monthlyFiles) {
      content += `### ${month.monthName}\n\n`;
      content += `- Sessions: ${month.totalSessions}\n`;
      if (month.goals.length > 0) {
        content += `- Goals: ${month.goals.length}\n`;
      }
      if (month.accomplishments.length > 0) {
        content += `- Accomplishments: ${month.accomplishments.length}\n`;
      }
      content += '\n';
    }
  }
  
  return content;
}

export async function generateAnnualSummary(directory, targetYear) {
  const year = targetYear || new Date().getFullYear();

  // Read monthly files (hierarchical flow)
  const monthlyFiles = await scanYearMonthlyFiles(directory, year);

  // Build content with aggregated data from monthly files
  const bodyContent = formatAnnualContent(year, monthlyFiles);

  // Extract keywords and filter
  const contentKeywords = extractKeywordsFromContent(bodyContent, 20);
  const filteredKeywords = contentKeywords.filter(k =>
    !['annual', 'year', 'session', 'sessions', 'total', 'month', 'months', 'week', 'weeks', 'quarter'].includes(k.toLowerCase())
  );

  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateAnnual',
    keywords: filteredKeywords
  });

  const header = `---
title: Annual Context - ${year}
keywords: ${keywords}
created: ${new Date().toISOString()}
---

`;

  let body = bodyContent;

  // Apply budget limit
  const budgetCfg = getConfig();
  const annualMaxChars = budgetCfg.budget?.annualSummary || 1000;
  body = truncateToBudget(body, annualMaxChars);

  // Add keyword navigation for Obsidian
  body += addKeywordNavigation({ type: 'annual', year });

  // Add keyword links
  body += generateKeywordLinks({ keywords: filteredKeywords, year, maxLinks: 10 });

  const fullReport = header + body;

  const annualDir = path.join(directory, CONTEXT_SESSION_DIR, String(year));
  await fs.mkdir(annualDir, { recursive: true });

  const filename = `annual-${year}.md`;
  const savePath = path.join(annualDir, filename);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}