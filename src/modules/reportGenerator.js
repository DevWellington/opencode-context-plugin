#!/usr/bin/env node
/**
 * Report generator module
 * Generates content-focused reports from session data using contentExtractor
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { extractSessionContent, extractBugs, findPatterns, inferMissingFields, extractCrossProjectLinks } from './contentExtractor.js';
import { resolveLinksInContent } from '../utils/crossProjectLinks.js';

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
      patterns: [],
      crossProjectLinks: extractCrossProjectLinks(content)
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
 * Reads from week-summary.md files (hierarchical flow)
 * Content hierarchy: day > week (largest) > month > annual (smallest)
 * 
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

  const monthStr = String(month).padStart(2, '0');
  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
  
  // Read from week-summary.md files (hierarchical flow)
  const weekSummaries = await readWeekSummaries(monthDir);
  
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  // Gather all data from week summaries
  const accomplishments = aggregateAccomplishmentsFromWeeks(weekSummaries);
  const bugs = aggregateBugsFromWeeks(weekSummaries);
  const allFiles = [...new Set(weekSummaries.flatMap(w => w.files))];
  const totalSessions = weekSummaries.reduce((sum, w) => sum + w.totalSessions, 0);

  // Build report with frontmatter
  let report = '---\n';
  report += `title: "${monthName} ${year} Monthly Report"\n`;
  report += `created: "${new Date().toISOString()}"\n`;
  report += `period: "${year}-${monthStr}-01 to ${year}-${monthStr}-${new Date(year, month, 0).getDate()}"\n`;
  report += `keywords: [monthly-report, ${monthName.toLowerCase()}, ${year}]\n`;
  report += '---\n\n';

  report += `# Monthly Report - ${monthName} ${year}\n\n`;
  report += `**Total Sessions:** ${totalSessions}\n`;
  report += `**Weeks with Sessions:** ${weekSummaries.length}\n\n`;

  // Executive Summary
  report += `## Executive Summary\n\n`;
  if (weekSummaries.length === 0) {
    report += `No sessions recorded during ${monthName} ${year}.\n\n`;
  } else {
    report += `${totalSessions} session${totalSessions !== 1 ? 's' : ''} worked on this month.`;
    if (accomplishments.length > 0) {
      const topAccomplishment = accomplishments[0].text;
      report += ` Key work included: ${topAccomplishment.slice(0, 100)}.`;
    }
    if (bugs.length > 0) {
      report += ` ${bugs.length} issue${bugs.length !== 1 ? 's' : ''} were resolved.`;
    }
    report += '\n\n';
  }

  // Major Accomplishments
  report += `## Major Accomplishments\n\n`;
  if (accomplishments.length > 0) {
    for (const acc of accomplishments.slice(0, 10)) {
      report += `- ${acc.text}\n`;
    }
  } else {
    report += `- No specific accomplishments recorded\n`;
  }
  report += '\n';

  // Issues Resolved
  report += `## Issues Resolved\n\n`;
  if (bugs.length > 0) {
    for (const bug of bugs) {
      report += `- **${bug.symptom}:** ${bug.solution}\n`;
    }
  } else {
    report += `No issues requiring resolution were recorded this month.\n\n`;
  }
  report += '\n';

  // Decisions Made
  report += `## Decisions Made\n\n`;
  report += `No explicit decisions recorded this month.\n\n`;

  // Week-by-Week Summary
  report += `## Week-by-Week Summary\n\n`;
  for (const week of weekSummaries) {
    report += `### Week ${week.week}\n\n`;
    report += `- **Sessions:** ${week.totalSessions}\n`;
    if (week.goals.length > 0) {
      report += `- **Goals:** ${week.goals.length}\n`;
    }
    if (week.accomplishments.length > 0) {
      report += `- **Top Accomplishments:**\n`;
      for (const acc of week.accomplishments.slice(0, 3)) {
        report += `  - ${acc}\n`;
      }
    }
    report += '\n';
  }

  // Relevant Files
  if (allFiles.length > 0) {
    report += `## Relevant Files\n\n`;
    for (const file of allFiles.slice(0, 20)) {
      report += `- ${file}\n`;
    }
    report += '\n';
  }

  report += `---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Read week summaries from a month directory
 */
async function readWeekSummaries(monthDir) {
  const weekSummaries = [];
  
  try {
    const weekDirs = await fs.readdir(monthDir);
    
    for (const weekDir of weekDirs) {
      if (!weekDir.startsWith('W')) continue;
      const weekPath = path.join(monthDir, weekDir);
      const weekSummaryPath = path.join(weekPath, 'week-summary.md');
      
      try {
        const content = await fs.readFile(weekSummaryPath, 'utf-8');
        
        // Extract data from week summary
        const sessionMatch = content.match(/\*\*Total Sessions:\*\* (\d+)/);
        const totalSessions = parseInt(sessionMatch?.[1] || '0', 10);
        
        weekSummaries.push({
          week: weekDir,
          totalSessions,
          goals: extractSection(content, '## Goals'),
          accomplishments: extractSection(content, '## Accomplishments'),
          discoveries: extractSection(content, '## Discoveries'),
          bugsFixed: extractSection(content, '## Bugs Fixed'),
          files: extractSection(content, '## Relevant Files')
        });
      } catch {
        // No week summary
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
        text = text.replace(/^[✅💡🐛🔧📝🔍📦🚪][\s–-]*/u, '');
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
 * Aggregate accomplishments from week summaries
 */
function aggregateAccomplishmentsFromWeeks(weekSummaries) {
  const accomplishments = [];
  const seen = new Set();
  
  for (const week of weekSummaries) {
    for (const acc of week.accomplishments) {
      const key = acc.slice(0, 50).toLowerCase().trim();
      if (!seen.has(key) && key.length > 5) {
        seen.add(key);
        accomplishments.push({ text: acc, week: week.week });
      }
    }
  }
  
  return accomplishments;
}

/**
 * Aggregate bugs from week summaries
 */
function aggregateBugsFromWeeks(weekSummaries) {
  const bugs = [];
  
  for (const week of weekSummaries) {
    for (const bug of week.bugsFixed) {
      if (bug.includes(':')) {
        const [symptom, solution] = bug.split(':').map(s => s.trim());
        bugs.push({ symptom, solution, week: week.week });
      }
    }
  }
  
  return bugs;
}

/**
 * Generate annual content-focused report with quarterly themes
 * Reads from monthly-YYYY-MM.md files (hierarchical flow)
 * Content hierarchy: day > week > month > annual (largest to smallest)
 * 
 * @param {string} directory - Base directory
 * @param {number} year - Year
 * @param {Object} opencodeClient - OpenCode client for AI inference (optional)
 */
export async function generateAnnualReport(directory, year, opencodeClient = null) {
  // Read from monthly files (hierarchical flow)
  const monthlyFiles = await readMonthlyFiles(directory, year);
  
  // Gather all data from monthly files
  const bugs = aggregateBugsFromMonths(monthlyFiles);
  const allFiles = [...new Set(monthlyFiles.flatMap(m => m.files))];
  const allAccomplishments = aggregateAccomplishmentsFromMonths(monthlyFiles);
  const topAccomplishments = allAccomplishments.slice(0, 5);
  const totalSessions = monthlyFiles.reduce((sum, m) => sum + m.totalSessions, 0);

  // Build report with frontmatter
  let report = '---\n';
  report += `title: "${year} Annual Report"\n`;
  report += `created: "${new Date().toISOString()}"\n`;
  report += `year: "${year}"\n`;
  report += `keywords: [annual-report, ${year}, yearly-summary]\n`;
  report += '---\n\n';

  report += `# Annual Report - ${year}\n\n`;
  report += `**Total Sessions:** ${totalSessions}\n`;
  report += `**Months with Sessions:** ${monthlyFiles.length}\n\n`;

  // Annual Theme
  report += `## Annual Theme\n\n`;
  if (topAccomplishments.length > 0) {
    report += `**Major Accomplishments:**\n\n`;
    for (const acc of topAccomplishments) {
      report += `- ${acc.text}\n`;
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
    const quarterMonths = monthlyFiles.filter(m => getQuarterFromMonth(parseInt(m.month)) === quarter);
    const quarterSessions = quarterMonths.reduce((sum, m) => sum + m.totalSessions, 0);
    const quarterAccomplishments = quarterMonths.flatMap(m => m.accomplishments);
    
    report += `### ${quarterNames[i]}\n\n`;
    report += `- **Sessions:** ${quarterSessions}\n`;
    
    if (quarterAccomplishments.length > 0) {
      report += `- **Top Accomplishments:**\n`;
      const seen = new Set();
      for (const acc of quarterAccomplishments) {
        const key = acc.slice(0, 50).toLowerCase().trim();
        if (!seen.has(key) && key.length > 5) {
          seen.add(key);
          const firstLine = acc.split('\n')[0].trim();
          report += `  - ${firstLine}\n`;
        }
      }
    }
    
    report += '\n';
  }

  // Month-by-Month Summary
  report += `## Month-by-Month Summary\n\n`;
  for (const month of monthlyFiles) {
    report += `### ${month.monthName}\n\n`;
    report += `- **Sessions:** ${month.totalSessions}\n`;
    if (month.goals.length > 0) {
      report += `- **Goals:** ${month.goals.length}\n`;
    }
    if (month.accomplishments.length > 0) {
      report += `- **Accomplishments:** ${month.accomplishments.length}\n`;
    }
    report += '\n';
  }

  // Project Evolution
  report += `## Project Evolution\n\n`;
  if (monthlyFiles.length > 0) {
    report += `### Milestone Timeline\n\n`;
    for (const month of monthlyFiles) {
      report += `- **${month.monthName}:** ${month.totalSessions} session${month.totalSessions !== 1 ? 's' : ''}`;
      if (month.goals.length > 0) {
        report += ` - Goal: ${month.goals[0].slice(0, 60)}${month.goals[0].length > 60 ? '...' : ''}`;
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
    report += `| Month | Bug | Solution |\n`;
    report += `|-------|-----|----------|\n`;
    for (const bug of bugs.slice(0, 15)) {
      const symptom = (bug.symptom || 'Unknown').slice(0, 30);
      const solution = (bug.solution || 'Resolved').slice(0, 30);
      report += `| ${bug.month || '-'} | ${symptom} | ${solution} |\n`;
    }
  } else {
    report += `No bugs recorded for ${year}.\n\n`;
  }

  // Summary Statistics
  report += `## Summary Statistics\n\n`;
  report += `- **Total Sessions:** ${totalSessions}\n`;
  report += `- **Total Issues Resolved:** ${bugs.length}\n`;
  report += `- **Unique Files Modified:** ${allFiles.length}\n\n`;

  report += `---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Get quarter from month number (1-12)
 */
function getQuarterFromMonth(month) {
  if (month >= 1 && month <= 3) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q2';
  if (month >= 7 && month <= 9) return 'Q3';
  return 'Q4';
}

/**
 * Read monthly-YYYY-MM.md files from a year
 */
async function readMonthlyFiles(directory, year) {
  const monthlyFiles = [];
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = String(month).padStart(2, '0');
    const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), monthStr);
    const monthlyPath = path.join(monthDir, `monthly-${year}-${monthStr}.md`);
    
    try {
      const content = await fs.readFile(monthlyPath, 'utf-8');
      
      const sessionMatch = content.match(/\*\*Total Sessions:\*\* (\d+)/);
      const totalSessions = parseInt(sessionMatch?.[1] || '0', 10);
      
      monthlyFiles.push({
        month: monthStr,
        monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
        totalSessions,
        goals: extractSection(content, '## Goals'),
        accomplishments: extractSection(content, '## Major Accomplishments'),
        discoveries: extractSection(content, '## Discoveries'),
        files: extractSection(content, '## Relevant Files')
      });
    } catch {
      // No monthly file for this month
    }
  }
  
  return monthlyFiles;
}

/**
 * Aggregate accomplishments from monthly files
 */
function aggregateAccomplishmentsFromMonths(monthlyFiles) {
  const accomplishments = [];
  const seen = new Set();
  
  for (const month of monthlyFiles) {
    for (const acc of month.accomplishments) {
      const key = acc.slice(0, 50).toLowerCase().trim();
      if (!seen.has(key) && key.length > 5) {
        seen.add(key);
        accomplishments.push({ text: acc, month: month.monthName });
      }
    }
  }
  
  return accomplishments;
}

/**
 * Aggregate bugs from monthly files
 */
function aggregateBugsFromMonths(monthlyFiles) {
  const bugs = [];
  
  for (const month of monthlyFiles) {
    const issuesResolved = extractSectionFromContent(monthlyFiles.find(m => m.month === month.month)?.toString() || '', '## Issues Resolved');
    for (const issue of issuesResolved) {
      if (issue.includes(':')) {
        const [symptom, solution] = issue.split(':').map(s => s.trim());
        bugs.push({ symptom, solution, month: month.monthName });
      }
    }
  }
  
  return bugs;
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