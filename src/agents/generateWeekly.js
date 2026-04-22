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
import { extractSessionContent, extractBugs } from '../modules/contentExtractor.js';

/**
 * Scan all session files in a week directory and extract content
 */
async function scanWeekSessions(weekDir) {
  const allSessions = [];
  
  try {
    const dayDirs = await fs.readdir(weekDir, { withFileTypes: true });
    
    for (const dayDir of dayDirs) {
      if (!dayDir.isDirectory() || !/^\d{2}$/.test(dayDir.name)) continue;
      
      const dayPath = path.join(weekDir, dayDir.name);
      
      try {
        const files = await fs.readdir(dayPath);
        
        for (const file of files) {
          if ((file.startsWith('exit-') || file.startsWith('compact-')) && file.endsWith('.md')) {
            const content = await fs.readFile(path.join(dayPath, file), 'utf-8');
            const extracted = extractSessionContent(content);
            const bugs = extractBugs(content);
            allSessions.push({
              filename: file,
              day: dayDir.name,
              content,
              extracted,
              bugs
            });
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }
  } catch {
    // Week directory doesn't exist
  }
  
  return allSessions;
}

/**
 * Aggregate accomplishments from sessions
 */
function aggregateWeekAccomplishments(sessions) {
  const accomplishments = [];
  const seen = new Set();
  
  for (const session of sessions) {
    if (session.extracted.accomplished) {
      const key = session.extracted.accomplished.slice(0, 50).toLowerCase().trim();
      if (!seen.has(key) && key.length > 5) {
        seen.add(key);
        accomplishments.push({
          text: session.extracted.accomplished,
          day: session.day
        });
      }
    }
  }
  
  return accomplishments;
}

/**
 * Aggregate bugs from sessions
 */
function aggregateWeekBugs(sessions) {
  const bugs = [];
  
  for (const session of sessions) {
    for (const bug of session.bugs) {
      if (bug.solution) {
        bugs.push({
          ...bug,
          day: session.day
        });
      }
    }
  }
  
  return bugs;
}

/**
 * Format weekly content with structured sections
 */
function formatWeeklyContent(year, weekStr, sessions, dailyFiles) {
  const accomplishments = aggregateWeekAccomplishments(sessions);
  const bugs = aggregateWeekBugs(sessions);
  const allGoals = sessions.filter(s => s.extracted.goal).map(s => ({ text: s.extracted.goal, day: s.day }));
  const allDiscoveries = sessions.filter(s => s.extracted.discoveries).map(s => ({ text: s.extracted.discoveries, day: s.day }));
  
  // Collect all relevant files
  const fileSet = new Set();
  for (const session of sessions) {
    for (const file of session.extracted.relevantFiles || []) {
      if (file) fileSet.add(file);
    }
  }
  
  let content = `## Weekly Summary - ${year}-${weekStr}\n\n`;
  content += `- **Total Days with Sessions:** ${dailyFiles.length}\n`;
  content += `- **Total Sessions:** ${sessions.length}\n\n`;
  
  // Goals section
  if (allGoals.length > 0) {
    content += `## Goals\n\n`;
    // Deduplicate by first 50 chars
    const seenGoals = new Set();
    for (const goal of allGoals) {
      const key = goal.text.slice(0, 50).toLowerCase().trim();
      if (!seenGoals.has(key) && key.length > 5) {
        seenGoals.add(key);
        content += `- ${goal.text} (${goal.day})\n`;
      }
    }
    content += '\n';
  }
  
  // Accomplishments section
  if (accomplishments.length > 0) {
    content += `## Accomplishments\n\n`;
    for (const acc of accomplishments) {
      const lines = acc.text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        content += `- ✅ ${line}`;
        if (acc.day) content += ` (${acc.day})`;
        content += '\n';
      }
    }
    content += '\n';
  }
  
  // Discoveries section
  if (allDiscoveries.length > 0) {
    content += `## Discoveries\n\n`;
    const seenDisc = new Set();
    for (const disc of allDiscoveries) {
      const key = disc.text.slice(0, 50).toLowerCase().trim();
      if (!seenDisc.has(key) && key.length > 5) {
        seenDisc.add(key);
        content += `- 💡 ${disc.text}\n`;
      }
    }
    content += '\n';
  }
  
  // Bugs Fixed section
  if (bugs.length > 0) {
    content += `## Bugs Fixed\n\n`;
    for (const bug of bugs) {
      content += `- **${bug.symptom}:** ${bug.solution}`;
      if (bug.day) content += ` (${bug.day})`;
      content += '\n';
    }
    content += '\n';
  }
  
  // Relevant Files section
  if (fileSet.size > 0) {
    content += `## Relevant Files\n\n`;
    for (const file of fileSet) {
      content += `- ${file}\n`;
    }
    content += '\n';
  }
  
  // Day-by-Day Summary
  if (dailyFiles.length > 0) {
    content += `## Day-by-Day Summary\n\n`;
    for (const { day, dateStr, compacts, exits } of dailyFiles) {
      content += `### Day ${day} (${dateStr})\n`;
      content += `- Sessions: ${compacts + exits} (Exit: ${exits}, Compact: ${compacts})\n`;
      
      // Find top accomplishments for this day
      const dayAccomplishments = sessions
        .filter(s => s.day === day && s.extracted.accomplished)
        .slice(0, 2);
      
      for (const acc of dayAccomplishments) {
        const firstLine = acc.extracted.accomplished.split('\n')[0].trim();
        content += `  - ✅ ${firstLine}\n`;
      }
      
      content += '\n';
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

  // Scan all session files in the week directory for content extraction
  const sessions = await scanWeekSessions(weekDir);

  // Collect daily file info for day-by-day breakdown
  const weekStartDay = date.getDate() - (date.getDay() || 7) + 1;
  const dailyFiles = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayOfMonth = weekStartDay + dayOffset;
    const dayStr = String(dayOfMonth).padStart(2, '0');
    const dayDir = path.join(weekDir, dayStr);
    const dailyPath = path.join(dayDir, 'day-summary.md');

    try {
      const content = await fs.readFile(dailyPath, 'utf-8');
      const dateMatch = content.match(/\*\*Date:\*\* (\d{4}-\d{2}-\d{2})/);
      const sessionMatches = content.match(/\[.*?\] (📦|🚪)/g) || [];
      const compacts = sessionMatches.filter(m => m.includes('📦')).length;
      const exits = sessionMatches.filter(m => m.includes('🚪')).length;
      const dayDate = dateMatch?.[1] || `Day ${dayStr}`;

      dailyFiles.push({ day: dayStr, dateStr: dayDate, compacts, exits });
    } catch {
      // No summary for this day yet
    }
  }

  // Build content with extracted data
  const bodyContent = formatWeeklyContent(year, weekStr, sessions, dailyFiles);

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

  const body = bodyContent;

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
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}