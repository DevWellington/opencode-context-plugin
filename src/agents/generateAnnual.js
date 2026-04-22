/**
 * @ocp-generate-annual
 * Generate annual context summary by aggregating monthly reports
 *
 * Usage: @ocp-generate-annual [year]
 *
 * Reads: monthly-YYYY-MM.md files from each month in the year
 * Saves to: .opencode/context-session/reports/annual-YYYY.md
 */

import path from 'path';
import fs from 'fs/promises';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORTS_DIR, CONTEXT_SESSION_DIR, addKeywordNavigation, generateKeywordLinks } from './utils/linkBuilder.js';
import { extractSessionContent, extractBugs } from '../modules/contentExtractor.js';

/**
 * Scan all session files for a year
 */
async function scanSessionsInYear(directory, year) {
  const allSessions = [];

  for (let month = 1; month <= 12; month++) {
    const monthStr = String(month).padStart(2, '0');
    const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);

    try {
      const weekDirs = await fs.readdir(monthDir);

      for (const weekDir of weekDirs) {
        if (!weekDir.startsWith('W')) continue;
        const weekPath = path.join(monthDir, weekDir);

        try {
          const dayDirs = await fs.readdir(weekPath, { withFileTypes: true });

          for (const dayDir of dayDirs) {
            if (!dayDir.isDirectory() || !/^\d{2}$/.test(dayDir.name)) continue;
            const dayPath = path.join(weekPath, dayDir.name);

            try {
              const files = await fs.readdir(dayPath);

              for (const file of files) {
                if ((file.startsWith('exit-') || file.startsWith('compact-')) && file.endsWith('.md')) {
                  const content = await fs.readFile(path.join(dayPath, file), 'utf-8');
                  const extracted = extractSessionContent(content);
                  const bugs = extractBugs(content);
                  allSessions.push({
                    filename: file,
                    year,
                    month: monthStr,
                    week: weekDir,
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
          // Skip unreadable week directories
        }
      }
    } catch {
      // Month directory doesn't exist
    }
  }

  return allSessions;
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
 * Group sessions by quarter
 */
function groupByQuarter(sessions) {
  const byQuarter = { Q1: [], Q2: [], Q3: [], Q4: [] };
  for (const session of sessions) {
    const quarter = getQuarter(parseInt(session.month));
    byQuarter[quarter].push(session);
  }
  return byQuarter;
}

/**
 * Group sessions by month
 */
function groupByMonth(sessions) {
  const byMonth = {};
  for (const session of sessions) {
    if (!byMonth[session.month]) byMonth[session.month] = [];
    byMonth[session.month].push(session);
  }
  return byMonth;
}

/**
 * Aggregate accomplishments
 */
function aggregateAccomplishments(sessions) {
  const accomplishments = [];
  const seen = new Set();

  for (const session of sessions) {
    if (session.extracted.accomplished) {
      const key = session.extracted.accomplished.slice(0, 50).toLowerCase().trim();
      if (!seen.has(key) && key.length > 5) {
        seen.add(key);
        accomplishments.push({
          text: session.extracted.accomplished,
          date: `${session.month}-${session.day}`,
          source: session.filename
        });
      }
    }
  }

  return accomplishments;
}

/**
 * Aggregate bugs
 */
function aggregateBugs(sessions) {
  const bugs = [];

  for (const session of sessions) {
    for (const bug of session.bugs) {
      if (bug.solution) {
        bugs.push({
          symptom: bug.symptom,
          solution: bug.solution,
          cause: bug.cause,
          prevention: bug.prevention,
          date: `${session.month}-${session.day}`,
          source: session.filename
        });
      }
    }
  }

  return bugs;
}

export async function generateAnnualSummary(directory, targetYear) {
  const year = targetYear || new Date().getFullYear();

  // Scan all sessions for the year
  const sessions = await scanSessionsInYear(directory, year);
  const byQuarter = groupByQuarter(sessions);
  const byMonth = groupByMonth(sessions);

  // Gather all data
  const bugs = aggregateBugs(sessions);
  const allFiles = sessions.flatMap(s => s.extracted.relevantFiles || []).filter(Boolean);
  const uniqueFiles = [...new Set(allFiles)];
  const allAccomplishments = aggregateAccomplishments(sessions);
  const topAccomplishments = allAccomplishments.slice(0, 5);

  // Build content with frontmatter
  let body = `# Annual Summary - ${year}\n\n`;
  body += `- **Total Sessions:** ${sessions.length}\n`;
  body += `- **Total Months:** ${Object.keys(byMonth).length}\n\n`;

  // Annual Theme
  body += `## Annual Theme\n\n`;
  if (topAccomplishments.length > 0) {
    body += `**Major Accomplishments:**\n\n`;
    for (const acc of topAccomplishments) {
      body += `- ${acc.text}`;
      if (acc.date) {
        body += ` (${acc.date})`;
      }
      body += '\n';
    }
    body += '\n';
  } else {
    body += `Year focused on continued development and maintenance.\n\n`;
  }

  // Quarterly Themes
  body += `## Quarterly Themes\n\n`;
  const quarterNames = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (let i = 0; i < quarters.length; i++) {
    const quarter = quarters[i];
    const quarterSessions = byQuarter[quarter];
    const quarterAccomplishments = aggregateAccomplishments(quarterSessions);
    const quarterBugs = aggregateBugs(quarterSessions);

    body += `### ${quarterNames[i]}\n\n`;
    body += `- **Sessions:** ${quarterSessions.length}\n`;

    if (quarterAccomplishments.length > 0) {
      body += `- **Top Accomplishments:**\n`;
      for (const acc of quarterAccomplishments.slice(0, 3)) {
        const firstLine = acc.text.split('\n')[0].trim();
        body += `  - ✅ ${firstLine}\n`;
      }
    }

    if (quarterBugs.length > 0) {
      body += `- **Issues Resolved:** ${quarterBugs.length}\n`;
    }

    body += '\n';
  }

  // Project Evolution
  body += `## Project Evolution\n\n`;
  body += `### Milestone Timeline\n\n`;

  if (sessions.length > 0) {
    const sortedMonths = Object.keys(byMonth).sort();
    for (const month of sortedMonths) {
      const monthSessions = byMonth[month];
      const monthAccomplishments = aggregateAccomplishments(monthSessions);
      const monthName = new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long' });

      body += `- **${monthName}:** ${monthSessions.length} session${monthSessions.length !== 1 ? 's' : ''}`;
      if (monthAccomplishments.length > 0) {
        const firstLine = monthAccomplishments[0].text.split('\n')[0].trim();
        body += ` - ${firstLine.slice(0, 60)}${firstLine.length > 60 ? '...' : ''}`;
      }
      body += '\n';
    }
  } else {
    body += `No sessions recorded for ${year}.\n`;
  }
  body += '\n';

  // Bug History
  body += `## Bug History\n\n`;
  if (bugs.length > 0) {
    body += `| Bug | Symptom | Solution | Date |\n`;
    body += `|-----|---------|----------|------|\n`;
    for (const bug of bugs.slice(0, 15)) {
      const symptom = (bug.symptom || 'Unknown').slice(0, 30);
      const solution = (bug.solution || 'Resolved').slice(0, 30);
      body += `| ${bug.source || 'unknown'} | ${symptom} | ${solution} | ${bug.date || '-'} |\n`;
    }
  } else {
    body += `No bugs recorded for ${year}.\n\n`;
  }

  // Summary Statistics
  body += `## Summary Statistics\n\n`;
  body += `- **Total Sessions:** ${sessions.length}\n`;
  body += `- **Total Issues Resolved:** ${bugs.length}\n`;
  body += `- **Unique Files Modified:** ${uniqueFiles.length}\n`;
  body += `- **Q1 Sessions:** ${byQuarter.Q1.length} | **Q2 Sessions:** ${byQuarter.Q2.length} | **Q3 Sessions:** ${byQuarter.Q3.length} | **Q4 Sessions:** ${byQuarter.Q4.length}\n\n`;

  // Extract keywords from content
  const contentKeywords = extractKeywordsFromContent(body, 20);
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

  const fullReport = header + body;

  const annualDir = path.join(directory, CONTEXT_SESSION_DIR, String(year));
  await fs.mkdir(annualDir, { recursive: true });

  const filename = `annual-${year}.md`;
  const savePath = path.join(annualDir, filename);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}