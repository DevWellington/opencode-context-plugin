/**
 * @ocp-generate-monthly
 * Generate monthly context summary by aggregating weekly reports
 *
 * Usage: @ocp-generate-monthly [month]
 *
 * Reads: week-summary.md files from each week in the month
 * Saves to: .opencode/context-session/reports/monthly-YYYY-MM.md
 */

import path from 'path';
import fs from 'fs/promises';
import { getWeek } from 'date-fns';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORT_PATHS, REPORTS_DIR, CONTEXT_SESSION_DIR, addKeywordNavigation, generateKeywordLinks } from './utils/linkBuilder.js';
import { extractSessionContent, extractBugs, findPatterns } from '../modules/contentExtractor.js';

/**
 * Scan all session files for a month
 */
async function scanSessionsInMonth(directory, year, month) {
  const monthStr = String(month).padStart(2, '0');
  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
  const allSessions = [];

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

  return allSessions;
}

/**
 * Aggregate accomplishments - deduplicate by first 50 chars
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
          date: `${session.week}/${session.day}`,
          source: session.filename
        });
      }
    }
  }

  return accomplishments;
}

/**
 * Aggregate bugs from sessions
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
          date: `${session.week}/${session.day}`,
          source: session.filename
        });
      }
    }
  }

  return bugs;
}

/**
 * Extract decisions from session content
 */
function extractDecisions(sessions) {
  const decisions = [];

  for (const session of sessions) {
    const content = [
      session.extracted.accomplished,
      session.extracted.discoveries,
      session.extracted.goal
    ].filter(Boolean).join(' ');

    const decisionPatterns = [
      /decided to ([\w\s]+)/i,
      /chose to ([\w\s]+)/i,
      /using ([\w\s]+) for/i,
      /went with ([\w\s]+)/i,
      /opted for ([\w\s]+)/i
    ];

    for (const pattern of decisionPatterns) {
      const match = content.match(pattern);
      if (match) {
        decisions.push({
          text: match[0],
          date: `${session.week}/${session.day}`,
          source: session.filename
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  return decisions.filter(d => {
    const key = d.text.slice(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(sessions, monthName, year) {
  const totalSessions = sessions.length;
  if (totalSessions === 0) return `No sessions recorded during ${monthName} ${year}.`;

  const accomplishments = aggregateAccomplishments(sessions);
  const bugs = aggregateBugs(sessions);

  let summary = `${totalSessions} session${totalSessions !== 1 ? 's' : ''} worked on this month.`;

  if (accomplishments.length > 0) {
    const topAccomplishment = accomplishments[0].text;
    summary += ` Key work included: ${topAccomplishment.slice(0, 100)}.`;
  }

  if (bugs.length > 0) {
    summary += ` ${bugs.length} issue${bugs.length !== 1 ? 's' : ''} were resolved.`;
  }

  return summary;
}

/**
 * Group sessions by week
 */
function groupByWeek(sessions) {
  const byWeek = {};
  for (const session of sessions) {
    if (!byWeek[session.week]) byWeek[session.week] = [];
    byWeek[session.week].push(session);
  }
  return byWeek;
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

  // Scan all sessions for the month
  const sessions = await scanSessionsInMonth(directory, year, month);
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const byWeek = groupByWeek(sessions);

  // Gather all data
  const accomplishments = aggregateAccomplishments(sessions);
  const bugs = aggregateBugs(sessions);
  const decisions = extractDecisions(sessions);
  const allFiles = sessions.flatMap(s => s.extracted.relevantFiles || []).filter(Boolean);
  const uniqueFiles = [...new Set(allFiles)];

  // Build content with frontmatter
  let body = `# Monthly Summary - ${year}-${monthStr}\n\n`;
  body += `- **Total Sessions:** ${sessions.length}\n`;
  body += `- **Total Weeks:** ${Object.keys(byWeek).length}\n\n`;

  // Executive Summary
  body += `## Executive Summary\n\n`;
  body += `${generateExecutiveSummary(sessions, monthName, year)}\n\n`;

  // Major Accomplishments
  body += `## Major Accomplishments\n\n`;
  if (accomplishments.length > 0) {
    for (const acc of accomplishments.slice(0, 10)) {
      body += `- ${acc.text}`;
      if (acc.date) {
        body += ` (${acc.date})`;
      }
      body += '\n';
    }
  } else {
    body += `- No specific accomplishments recorded\n`;
  }
  body += '\n';

  // Issues Resolved
  body += `## Issues Resolved\n\n`;
  if (bugs.length > 0) {
    for (const bug of bugs) {
      body += `### ${bug.symptom || 'Issue'}\n\n`;
      if (bug.solution) {
        body += `**Solution:** ${bug.solution}\n\n`;
      }
      if (bug.cause) {
        body += `**Cause:** ${bug.cause}\n\n`;
      }
      body += `*Resolved: ${bug.date || 'unknown'}*\n\n`;
    }
  } else {
    body += `No issues requiring resolution were recorded this month.\n\n`;
  }

  // Decisions Made
  body += `## Decisions Made\n\n`;
  if (decisions.length > 0) {
    for (const decision of decisions.slice(0, 5)) {
      body += `- ${decision.text}`;
      if (decision.date) {
        body += ` (${decision.date})`;
      }
      body += '\n';
    }
  } else {
    body += `No explicit decisions recorded.\n\n`;
  }
  body += '\n';

  // Week-by-Week Breakdown
  body += `## Week-by-Week Breakdown\n\n`;
  const sortedWeeks = Object.keys(byWeek).sort((a, b) => {
    const numA = parseInt(a.slice(1));
    const numB = parseInt(b.slice(1));
    return numA - numB;
  });

  for (const week of sortedWeeks) {
    const weekSessions = byWeek[week];
    const weekAccomplishments = aggregateAccomplishments(weekSessions);
    const weekBugs = aggregateBugs(weekSessions);

    body += `### Week ${week}\n\n`;
    body += `- **Sessions:** ${weekSessions.length}\n`;

    if (weekAccomplishments.length > 0) {
      body += `- **Top Accomplishments:**\n`;
      for (const acc of weekAccomplishments.slice(0, 3)) {
        const firstLine = acc.text.split('\n')[0].trim();
        body += `  - ✅ ${firstLine}\n`;
      }
    }

    if (weekBugs.length > 0) {
      body += `- **Issues Resolved:** ${weekBugs.length}\n`;
    }

    body += '\n';
  }

  // Relevant Files
  if (uniqueFiles.length > 0) {
    body += `## Relevant Files\n\n`;
    for (const file of uniqueFiles.slice(0, 20)) {
      body += `- ${file}\n`;
    }
    body += '\n';
  }

  // Extract keywords from content
  const contentKeywords = extractKeywordsFromContent(body, 20);
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

  const fullReport = header + body;

  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
  await fs.mkdir(monthDir, { recursive: true });

  const filename = `monthly-${year}-${monthStr}.md`;
  const savePath = path.join(monthDir, filename);
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}