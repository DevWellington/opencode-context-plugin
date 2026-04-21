#!/usr/bin/env node
/**
 * Report generator module
 * Generates content-focused reports from session data using contentExtractor
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { extractSessionContent, extractBugs, findPatterns, inferMissingFields } from './contentExtractor.js';

const CONTEXT_SESSION_DIR = '.opencode/context-session';
const REPORTS_DIR = '.opencode/context-session/reports';

/**
 * Get week number in year (ISO week)
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get start and end dates for a week
 */
function getWeekRange(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const isoWeekStart = simple;
  if (dow <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setDate(isoWeekEnd.getDate() + 6);
  return {
    start: isoWeekStart.toISOString().split('T')[0],
    end: isoWeekEnd.toISOString().split('T')[0]
  };
}

/**
 * Get start and end dates for a month
 */
function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/**
 * Get start and end dates for a year (full year)
 */
function getYearRange(year) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`
  };
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
 * Parse session file and enrich with contentExtractor data
 * @param {string} filePath - Path to session file
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
async function parseSessionFile(filePath, opencodeClient = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = matter(content);
    const filename = path.basename(filePath, '.md');

    // Parse type from filename
    const type = filename.startsWith('exit-') ? 'exit' :
                 filename.startsWith('compact-') ? 'compact' : 'unknown';

    // Parse date from filename
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : null;

    // Extract structured content using contentExtractor
    const extracted = extractSessionContent(content);
    const bugs = extractBugs(content);

    // Enhance with AI inference if client is available
    let goal = extracted.goal;
    let accomplished = extracted.accomplished;
    let discoveries = extracted.discoveries;

    if (opencodeClient) {
      try {
        const inferred = await inferMissingFields(content, opencodeClient);
        // Use inferred values if they're better/more complete
        if (inferred.goal && (!goal || inferred.confidence?.goal > 0.7)) {
          goal = inferred.goal;
        }
        if (inferred.accomplished && (!accomplished || inferred.confidence?.accomplished > 0.7)) {
          accomplished = inferred.accomplished;
        }
        if (inferred.discoveries && (!discoveries || inferred.confidence?.discoveries > 0.7)) {
          discoveries = inferred.discoveries;
        }
      } catch (error) {
        // AI inference failed, use extracted values
      }
    }

    return {
      filename,
      type,
      date,
      title: parsed.data?.title || filename,
      goal,
      accomplished,
      discoveries,
      relevantFiles: extracted.relevantFiles,
      bugs,
      patterns: []
    };
  } catch (error) {
    return null;
  }
}

/**
 * Scan for session files in date range - returns enriched session objects
 * @param {string} directory - Base directory to scan
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function scanSessionsInRange(directory, startDate, endDate, opencodeClient = null) {
  const sessions = [];
  const baseDir = path.join(directory, CONTEXT_SESSION_DIR);

  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if ((entry.name.startsWith('exit-') || entry.name.startsWith('compact-')) && entry.name.endsWith('.md')) {
          const dateMatch = entry.name.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const fileDate = dateMatch[1];
            if (fileDate >= startDate && fileDate <= endDate) {
              const session = await parseSessionFile(fullPath, opencodeClient);
              if (session) {
                sessions.push(session);
              }
            }
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
  }

  await scanDir(baseDir);

  // Find patterns across sessions
  if (sessions.length >= 2) {
    const patterns = findPatterns(sessions.map(s => ({
      sessionId: s.filename,
      content: s.goal || s.accomplished || s.discoveries || ''
    })));
    sessions.forEach(s => {
      s.patterns = patterns.filter(p => p.sessions.includes(s.filename));
    });
  }

  return sessions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/**
 * Group sessions by week number
 */
function groupByWeek(sessions) {
  const byWeek = {};
  for (const session of sessions) {
    if (!session.date) continue;
    const week = getWeekNumber(new Date(session.date));
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(session);
  }
  return byWeek;
}

/**
 * Group sessions by quarter
 */
function groupByQuarter(sessions) {
  const byQuarter = { Q1: [], Q2: [], Q3: [], Q4: [] };
  for (const session of sessions) {
    if (!session.date) continue;
    const month = parseInt(session.date.split('-')[1], 10);
    const quarter = getQuarter(month);
    byQuarter[quarter].push(session);
  }
  return byQuarter;
}

/**
 * Format day name from date
 */
function getDayName(dateStr) {
  const date = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

/**
 * Aggregate accomplishments across sessions - deduplicate similar items
 */
function aggregateAccomplishments(sessions) {
  const accomplishments = [];

  for (const session of sessions) {
    if (session.accomplished) {
      accomplishments.push({
        text: session.accomplished,
        date: session.date,
        source: session.filename
      });
    }
  }

  // Deduplicate similar accomplishments (simple check for now)
  const unique = [];
  const seen = new Set();

  for (const acc of accomplishments) {
    // Use first 50 chars as key for deduplication
    const key = acc.text.slice(0, 50).toLowerCase().trim();
    if (!seen.has(key) && key.length > 5) {
      seen.add(key);
      unique.push(acc);
    }
  }

  return unique;
}

/**
 * Aggregate bugs across sessions
 */
function aggregateBugs(sessions) {
  const allBugs = [];

  for (const session of sessions) {
    for (const bug of session.bugs) {
      allBugs.push({
        ...bug,
        date: session.date,
        source: session.filename
      });
    }
  }

  return allBugs;
}

/**
 * Extract decisions mentioned in sessions
 */
function extractDecisions(sessions) {
  const decisions = [];

  for (const session of sessions) {
    // Look for decision-related keywords in accomplishments or discoveries
    const content = [session.accomplished, session.discoveries, session.goal]
      .filter(Boolean)
      .join(' ');

    // Simple decision detection - look for specific patterns
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
          date: session.date,
          source: session.filename
        });
      }
    }
  }

  // Also include any session that has structured content as potential decision context
  for (const session of sessions) {
    if (session.goal && !decisions.some(d => d.source === session.filename)) {
      decisions.push({
        text: `Goal: ${session.goal.slice(0, 100)}`,
        date: session.date,
        source: session.filename
      });
    }
  }

  return decisions;
}

/**
 * Generate executive summary for monthly report
 */
function generateExecutiveSummary(sessions, monthName, year) {
  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return `No sessions recorded during ${monthName} ${year}.`;
  }

  // Build summary from top accomplishments
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
 * Generate monthly content-focused report
 * @param {string} directory - Base directory
 * @param {string} monthYear - Month in YYYY-MM format
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function generateMonthlyReport(directory, monthYear, opencodeClient = null) {
  let year, month;
  if (monthYear && monthYear.includes('-')) {
    [year, month] = monthYear.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const { start, end } = getMonthRange(year, month);
  const sessions = await scanSessionsInRange(directory, start, end, opencodeClient);

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  const byWeek = groupByWeek(sessions);

  // Gather all data
  const accomplishments = aggregateAccomplishments(sessions);
  const bugs = aggregateBugs(sessions);
  const decisions = extractDecisions(sessions);
  const allFiles = sessions.flatMap(s => s.relevantFiles || []).filter(Boolean);
  const uniqueFiles = [...new Set(allFiles)];

  // Build report with frontmatter
  let report = '---\n';
  report += `title: "${monthName} ${year} Monthly Report"\n`;
  report += `created: "${new Date().toISOString()}"\n`;
  report += `period: "${start} to ${end}"\n`;
  report += `keywords: [monthly-report, ${monthName.toLowerCase()}, ${year}]\n`;
  report += '---\n\n';

  report += `# Monthly Report - ${monthName} ${year}\n\n`;
  report += `**Period:** ${start} to ${end}\n`;
  report += `**Sessions:** ${sessions.length}\n\n`;

  // Executive Summary
  report += `## Executive Summary\n\n`;
  report += `${generateExecutiveSummary(sessions, monthName, year)}\n\n`;

  // Major Accomplishments
  report += `## Major Accomplishments\n\n`;
  if (accomplishments.length > 0) {
    for (const acc of accomplishments.slice(0, 10)) {
      report += `- ${acc.text}`;
      if (acc.date) {
        report += ` (${acc.date})`;
      }
      report += '\n';
    }
  } else {
    report += `- No specific accomplishments recorded\n`;
  }
  report += '\n';

  // Issues Resolved
  report += `## Issues Resolved\n\n`;
  if (bugs.length > 0) {
    for (const bug of bugs) {
      report += `### ${bug.symptom || 'Issue'}\n\n`;
      if (bug.solution) {
        report += `**Solution:** ${bug.solution}\n\n`;
      }
      if (bug.cause) {
        report += `**Cause:** ${bug.cause}\n\n`;
      }
      if (bug.prevention) {
        report += `**Prevention:** ${bug.prevention}\n\n`;
      }
      report += `*Resolved: ${bug.date || 'unknown'}*\n\n`;
    }
  } else {
    report += `No issues requiring resolution were recorded this month.\n\n`;
  }

  // Decisions Made
  report += `## Decisions Made\n\n`;
  if (decisions.length > 0) {
    for (const decision of decisions.slice(0, 5)) {
      report += `- ${decision.text}`;
      if (decision.date) {
        report += ` (${decision.date})`;
      }
      report += '\n';
    }
  } else {
    report += `No explicit decisions recorded.\n\n`;
  }
  report += '\n';

  // Week-by-Week Breakdown
  report += `## Week-by-Week Breakdown\n\n`;
  const sortedWeeks = Object.keys(byWeek).sort((a, b) => Number(a) - Number(b));
  for (const week of sortedWeeks) {
    const weekSessions = byWeek[week];
    const weekAccomplishments = aggregateAccomplishments(weekSessions);
    const weekBugs = aggregateBugs(weekSessions);

    report += `### Week ${week}\n\n`;
    report += `- **Sessions:** ${weekSessions.length}\n`;

    if (weekAccomplishments.length > 0) {
      report += `- **Top Accomplishments:**\n`;
      for (const acc of weekAccomplishments.slice(0, 3)) {
        report += `  - ${acc.text.slice(0, 80)}${acc.text.length > 80 ? '...' : ''}\n`;
      }
    }

    if (weekBugs.length > 0) {
      report += `- **Issues Resolved:** ${weekBugs.length}\n`;
      for (const bug of weekBugs.slice(0, 2)) {
        report += `  - ${bug.symptom}: ${bug.solution ? bug.solution.slice(0, 50) : 'Resolved'}\n`;
      }
    }

    report += '\n';
  }

  // Files Modified
  if (uniqueFiles.length > 0) {
    report += `## Files Modified\n\n`;
    for (const file of uniqueFiles.slice(0, 20)) {
      report += `- ${file}\n`;
    }
    report += '\n';
  }

  report += `---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Generate annual content-focused report with quarterly themes
 * @param {string} directory - Base directory
 * @param {number} year - Year
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function generateAnnualReport(directory, year, opencodeClient = null) {
  const { start, end } = getYearRange(year);
  const sessions = await scanSessionsInRange(directory, start, end, opencodeClient);
  const byQuarter = groupByQuarter(sessions);

  // Gather all data
  const bugs = aggregateBugs(sessions);
  const allFiles = sessions.flatMap(s => s.relevantFiles || []).filter(Boolean);
  const uniqueFiles = [...new Set(allFiles)];

  // Determine annual theme from top accomplishments
  const allAccomplishments = aggregateAccomplishments(sessions);
  const topAccomplishments = allAccomplishments.slice(0, 5);

  // Build report with frontmatter
  let report = '---\n';
  report += `title: "${year} Annual Report"\n`;
  report += `created: "${new Date().toISOString()}"\n`;
  report += `year: "${year}"\n`;
  report += `keywords: [annual-report, ${year}, yearly-summary]\n`;
  report += '---\n\n';

  report += `# Annual Report - ${year}\n\n`;
  report += `**Total Sessions:** ${sessions.length}\n\n`;

  // Annual Theme
  report += `## Annual Theme\n\n`;
  if (topAccomplishments.length > 0) {
    report += `**Major Accomplishments:**\n\n`;
    for (const acc of topAccomplishments) {
      report += `- ${acc.text}`;
      if (acc.date) {
        report += ` (${acc.date})`;
      }
      report += '\n';
    }
    report += '\n';
  } else {
    report += `Year focused on continued development and maintenance.\n\n`;
  }

  // Quarterly Themes
  report += `## Quarterly Themes\n\n`;
  const quarterNames = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (let i = 0; i < quarters.length; i++) {
    const quarter = quarters[i];
    const quarterSessions = byQuarter[quarter];
    const quarterAccomplishments = aggregateAccomplishments(quarterSessions);
    const quarterBugs = aggregateBugs(quarterSessions);

    report += `### ${quarterNames[i]}\n\n`;
    report += `- **Sessions:** ${quarterSessions.length}\n`;

    if (quarterAccomplishments.length > 0) {
      report += `- **Top Accomplishments:**\n`;
      for (const acc of quarterAccomplishments.slice(0, 3)) {
        report += `  - ${acc.text.slice(0, 80)}${acc.text.length > 80 ? '...' : ''}\n`;
      }
    }

    if (quarterBugs.length > 0) {
      report += `- **Issues Resolved:** ${quarterBugs.length}\n`;
    }

    report += '\n';
  }

  // Project Evolution
  report += `## Project Evolution\n\n`;
  report += `### Milestone Timeline\n\n`;
  if (sessions.length > 0) {
    // Group by month for milestones
    const byMonth = {};
    for (const session of sessions) {
      if (!session.date) continue;
      const monthKey = session.date.slice(0, 7); // YYYY-MM
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(session);
    }

    const sortedMonths = Object.keys(byMonth).sort();
    for (const month of sortedMonths) {
      const monthSessions = byMonth[month];
      const monthAccomplishments = aggregateAccomplishments(monthSessions);
      const monthName = new Date(month + '-01').toLocaleString('default', { month: 'long' });

      report += `- **${monthName}:** ${monthSessions.length} session${monthSessions.length !== 1 ? 's' : ''}`;
      if (monthAccomplishments.length > 0) {
        report += ` - ${monthAccomplishments[0].text.slice(0, 60)}${monthAccomplishments[0].text.length > 60 ? '...' : ''}`;
      }
      report += '\n';
    }
  } else {
    report += `No sessions recorded for ${year}.\n`;
  }
  report += '\n';

  // Bug History
  report += `## Bug History\n\n`;
  if (bugs.length > 0) {
    report += `| Bug | Symptom | Solution | Date |\n`;
    report += `|-----|---------|----------|------|\n`;
    for (const bug of bugs.slice(0, 15)) {
      const symptom = (bug.symptom || 'Unknown').slice(0, 30);
      const solution = (bug.solution || 'Resolved').slice(0, 30);
      report += `| ${bug.source || 'unknown'} | ${symptom} | ${solution} | ${bug.date || '-'} |\n`;
    }
  } else {
    report += `No bugs recorded for ${year}.\n\n`;
  }

  // Summary Statistics (as supplemental)
  report += `## Summary Statistics\n\n`;
  report += `- **Total Sessions:** ${sessions.length}\n`;
  report += `- **Total Issues Resolved:** ${bugs.length}\n`;
  report += `- **Unique Files Modified:** ${uniqueFiles.length}\n`;
  report += `- **Q1 Sessions:** ${byQuarter.Q1.length} | **Q2 Sessions:** ${byQuarter.Q2.length} | **Q3 Sessions:** ${byQuarter.Q3.length} | **Q4 Sessions:** ${byQuarter.Q4.length}\n\n`;

  report += `---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Generate activity report for a custom date range
 * Used by CLI for 'range' command
 * @param {string} directory - Base directory
 * @param {Object} options - Options with startDate and endDate
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function generateActivityReport(directory, options = {}, opencodeClient = null) {
  const { startDate, endDate } = options;
  
  if (!startDate || !endDate) {
    throw new Error('generateActivityReport requires startDate and endDate options');
  }
  
  const sessions = await scanSessionsInRange(directory, startDate, endDate, opencodeClient);
  const byDay = {};
  
  for (const session of sessions) {
    const day = session.date || 'unknown';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(session);
  }
  
  let report = `# Activity Report - ${startDate} to ${endDate}\n\n`;
  report += `**Period:** ${startDate} to ${endDate}\n`;
  report += `**Total Sessions:** ${sessions.length}\n\n`;
  report += `## Sessions\n\n`;
  
  for (const [day, daySessions] of Object.entries(byDay).sort()) {
    const dayName = getDayName(day);
    report += `### ${day} (${dayName})\n\n`;
    for (const session of daySessions) {
      const icon = session.type === 'exit' ? '🚪' : '📦';
      report += `${icon} **${session.title || session.filename}**\n`;
      if (session.goal) {
        report += `   → Goal: ${session.goal.slice(0, 80)}${session.goal.length > 80 ? '...' : ''}\n`;
      }
      if (session.accomplished) {
        report += `   ✓ ${session.accomplished.slice(0, 80)}${session.accomplished.length > 80 ? '...' : ''}\n`;
      }
    }
    report += '\n';
  }
  
  report += `---\n*Report generated on ${new Date().toISOString()}*\n`;
  
  return report;
}

/**
 * Generate weekly activity report (legacy, kept for compatibility)
 * @param {string} directory - Base directory
 * @param {string} weekStart - Start date of week (optional)
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function generateWeeklyReport(directory, weekStart, opencodeClient = null) {
  const date = weekStart ? new Date(weekStart) : new Date();
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  const { start, end } = getWeekRange(year, week);

  const sessions = await scanSessionsInRange(directory, start, end, opencodeClient);
  const byDay = {};

  for (const session of sessions) {
    const day = session.date || 'unknown';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(session);
  }

  let report = `# Weekly Activity Report - Week ${week}, ${year}\n\n`;
  report += `**Period:** ${start} to ${end}\n\n`;
  report += `## Sessions\n\n`;

  for (const [day, daySessions] of Object.entries(byDay).sort()) {
    const dayName = getDayName(day);
    report += `### ${day} (${dayName})\n\n`;
    for (const session of daySessions) {
      const icon = session.type === 'exit' ? '🚪' : '📦';
      report += `${icon} **${session.title || session.filename}**\n`;
      if (session.goal) {
        report += `   → Goal: ${session.goal.slice(0, 80)}${session.goal.length > 80 ? '...' : ''}\n`;
      }
      if (session.accomplished) {
        report += `   ✓ ${session.accomplished.slice(0, 80)}${session.accomplished.length > 80 ? '...' : ''}\n`;
      }
    }
    report += '\n';
  }

  report += `---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Save report to file
 */
export async function saveReport(directory, report, filename) {
  const reportsDir = path.join(directory, REPORTS_DIR);
  await fs.mkdir(reportsDir, { recursive: true });

  const reportPath = path.join(reportsDir, filename);
  await fs.writeFile(reportPath, report, 'utf-8');

  return reportPath;
}

/**
 * Check if report needs regeneration
 */
export async function needsReportGeneration(directory, reportType) {
  const reportsDir = path.join(directory, REPORTS_DIR);
  const now = new Date();

  let expectedFilename;
  if (reportType === 'weekly') {
    const week = getWeekNumber(now);
    const year = now.getFullYear();
    expectedFilename = `weekly-${year}-${String(week).padStart(2, '0')}.md`;
  } else if (reportType === 'monthly') {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    expectedFilename = `monthly-${year}-${String(month).padStart(2, '0')}.md`;
  } else {
    return true;
  }

  const reportPath = path.join(reportsDir, expectedFilename);

  try {
    const stat = await fs.stat(reportPath);
    const ageMs = now.getTime() - stat.mtime.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return ageMs > oneDayMs;
  } catch {
    return true;
  }
}