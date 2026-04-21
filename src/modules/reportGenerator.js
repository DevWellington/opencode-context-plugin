#!/usr/bin/env node
/**
 * Report generator module
 * Generates weekly, monthly, and custom activity reports from session data
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { searchSessions, getIndexStats } from './searchIndexer.js';

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
  // ISO week starts on Monday
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
 * Extract text content from context file (same as searchIndexer)
 */
function extractText(content) {
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/m, '');
  return withoutFrontmatter
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

/**
 * Parse session file metadata
 */
async function parseSessionFile(filePath) {
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

    // Count messages from frontmatter
    const messageCount = parsed.data?.messageCount || 0;
    const tokenCount = parsed.data?.tokenCount || 0;

    // Extract keywords from content
    const text = extractText(content);
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const wordFreq = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    // Get top keywords
    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);

    return {
      filename,
      type,
      date,
      messageCount,
      tokenCount,
      title: parsed.data?.title || filename,
      topKeywords
    };
  } catch (error) {
    return null;
  }
}

/**
 * Scan for session files in date range
 */
async function scanSessionsInRange(directory, startDate, endDate) {
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
          // Check if file date is in range
          const dateMatch = entry.name.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const fileDate = dateMatch[1];
            if (fileDate >= startDate && fileDate <= endDate) {
              const session = await parseSessionFile(fullPath);
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
  return sessions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/**
 * Generate keyword frequency analysis
 */
function analyzeKeywords(sessions, topN = 10) {
  const wordFreq = {};
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'were', 'they', 'this', 'that', 'with', 'would', 'there', 'from', 'which', 'into', 'only', 'other', 'some', 'could', 'what', 'when', 'where', 'who', 'will', 'with', 'your']);

  for (const session of sessions) {
    for (const keyword of session.topKeywords || []) {
      if (!stopWords.has(keyword)) {
        wordFreq[keyword] = (wordFreq[keyword] || 0) + 1;
      }
    }
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/**
 * Group sessions by day
 */
function groupByDay(sessions) {
  const byDay = {};
  for (const session of sessions) {
    const day = session.date || 'unknown';
    if (!byDay[day]) {
      byDay[day] = [];
    }
    byDay[day].push(session);
  }
  return byDay;
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
 * Generate weekly activity report
 */
export async function generateWeeklyReport(directory, weekStart) {
  const date = weekStart ? new Date(weekStart) : new Date();
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  const { start, end } = getWeekRange(year, week);

  const sessions = await scanSessionsInRange(directory, start, end);
  const stats = await getIndexStats(directory);

  // Calculate totals
  const totalSessions = sessions.length;
  const exitSessions = sessions.filter(s => s.type === 'exit').length;
  const compactSessions = sessions.filter(s => s.type === 'compact').length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokenCount || 0), 0);

  // Daily breakdown
  const byDay = groupByDay(sessions);
  const dailyLines = [];
  for (const [day, daySessions] of Object.entries(byDay).sort()) {
    const exits = daySessions.filter(s => s.type === 'exit').length;
    const compacts = daySessions.filter(s => s.type === 'compact').length;
    const highlights = daySessions.slice(0, 2).map(s => s.title || s.filename).join(', ');
    dailyLines.push(`| ${getDayName(day)} | ${daySessions.length} | ${exits} exit, ${compacts} compact | ${highlights} |`);
  }

  // Top keywords
  const topKeywords = analyzeKeywords(sessions, 10);
  const keywordLines = topKeywords.map(k => `- ${k.word} (${k.count} sessions)`);

  // Build markdown report
  let report = `# Weekly Activity Report - Week ${week}, ${year}\n\n`;
  report += `**Period:** ${start} to ${end}\n\n`;
  report += `## Summary Statistics\n\n`;
  report += `- **Total Sessions:** ${totalSessions}\n`;
  report += `- **Exit Sessions:** ${exitSessions}\n`;
  report += `- **Compact Sessions:** ${compactSessions}\n`;
  report += `- **Total Messages:** ${totalMessages}\n`;
  report += `- **Total Tokens:** ~${totalTokens.toLocaleString()}\n\n`;

  report += `## Daily Breakdown\n\n`;
  report += `| Day | Sessions | Type | Highlights |\n`;
  report += `|-----|----------|------|------------|\n`;
  report += dailyLines.join('\n') + '\n\n';

  report += `## Top Topics Discussed\n\n`;
  report += keywordLines.join('\n') + '\n\n';

  report += `## Session List\n\n`;
  for (const session of sessions) {
    const typeIcon = session.type === 'exit' ? '🚪' : '📦';
    report += `- ${typeIcon} **${session.title || session.filename}** (${session.date}) - ${session.messageCount || 0} messages\n`;
  }

  report += `\n---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Generate monthly activity report
 */
export async function generateMonthlyReport(directory, monthYear) {
  // Parse monthYear (format: '2026-04' or just use current month)
  let year, month;
  if (monthYear && monthYear.includes('-')) {
    [year, month] = monthYear.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const { start, end } = getMonthRange(year, month);
  const sessions = await scanSessionsInRange(directory, start, end);
  const stats = await getIndexStats(directory);

  // Calculate totals
  const totalSessions = sessions.length;
  const exitSessions = sessions.filter(s => s.type === 'exit').length;
  const compactSessions = sessions.filter(s => s.type === 'compact').length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokenCount || 0), 0);

  // Weekly breakdown
  const byWeek = {};
  for (const session of sessions) {
    const sessionWeek = getWeekNumber(new Date(session.date));
    if (!byWeek[sessionWeek]) {
      byWeek[sessionWeek] = [];
    }
    byWeek[sessionWeek].push(session);
  }

  const weeklyLines = [];
  for (const [week, weekSessions] of Object.entries(byWeek).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const exits = weekSessions.filter(s => s.type === 'exit').length;
    const compacts = weekSessions.filter(s => s.type === 'compact').length;
    weeklyLines.push(`| Week ${week} | ${weekSessions.length} | ${exits} exit, ${compacts} compact |`);
  }

  // Top keywords
  const topKeywords = analyzeKeywords(sessions, 15);
  const keywordLines = topKeywords.map(k => `- ${k.word} (${k.count} sessions)`);

  // Build markdown report
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  let report = `# Monthly Activity Report - ${monthName} ${year}\n\n`;
  report += `**Period:** ${start} to ${end}\n\n`;
  report += `## Summary Statistics\n\n`;
  report += `- **Total Sessions:** ${totalSessions}\n`;
  report += `- **Exit Sessions:** ${exitSessions}\n`;
  report += `- **Compact Sessions:** ${compactSessions}\n`;
  report += `- **Total Messages:** ${totalMessages}\n`;
  report += `- **Total Tokens:** ~${totalTokens.toLocaleString()}\n`;
  report += `- **Average Messages/Session:** ${totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0}\n\n`;

  report += `## Weekly Breakdown\n\n`;
  report += `| Week | Sessions | Type |\n`;
  report += `|------|----------|------|\n`;
  report += weeklyLines.join('\n') + '\n\n';

  report += `## Top Topics Discussed\n\n`;
  report += keywordLines.join('\n') + '\n\n';

  report += `## All Sessions\n\n`;
  for (const session of sessions) {
    const typeIcon = session.type === 'exit' ? '🚪' : '📦';
    const week = getWeekNumber(new Date(session.date));
    report += `- ${typeIcon} **${session.title || session.filename}** (${session.date}, Week ${week}) - ${session.messageCount || 0} messages\n`;
  }

  report += `\n---\n*Report generated on ${new Date().toISOString()}*\n`;

  return report;
}

/**
 * Generate activity report for custom date range
 */
export async function generateActivityReport(directory, options = {}) {
  const { startDate, endDate } = options;

  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required for activity reports');
  }

  const sessions = await scanSessionsInRange(directory, startDate, endDate);

  // Calculate totals
  const totalSessions = sessions.length;
  const exitSessions = sessions.filter(s => s.type === 'exit').length;
  const compactSessions = sessions.filter(s => s.type === 'compact').length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);
  const totalTokens = sessions.reduce((sum, s) => sum + (s.tokenCount || 0), 0);

  // Top keywords
  const topKeywords = analyzeKeywords(sessions, 20);
  const keywordLines = topKeywords.map(k => `- ${k.word} (${k.count} sessions)`);

  // Build markdown report
  let report = `# Activity Report\n\n`;
  report += `**Period:** ${startDate} to ${endDate}\n\n`;
  report += `## Summary Statistics\n\n`;
  report += `- **Total Sessions:** ${totalSessions}\n`;
  report += `- **Exit Sessions:** ${exitSessions}\n`;
  report += `- **Compact Sessions:** ${compactSessions}\n`;
  report += `- **Total Messages:** ${totalMessages}\n`;
  report += `- **Total Tokens:** ~${totalTokens.toLocaleString()}\n\n`;

  if (keywordLines.length > 0) {
    report += `## Top Topics Discussed\n\n`;
    report += keywordLines.join('\n') + '\n\n';
  }

  report += `## Session Details\n\n`;
  for (const session of sessions) {
    const typeIcon = session.type === 'exit' ? '🚪' : '📦';
    report += `### ${typeIcon} ${session.title || session.filename}\n\n`;
    report += `- **Date:** ${session.date}\n`;
    report += `- **Type:** ${session.type}\n`;
    report += `- **Messages:** ${session.messageCount || 0}\n`;
    report += `- **Tokens:** ~${(session.tokenCount || 0).toLocaleString()}\n\n`;
  }

  report += `\n---\n*Report generated on ${new Date().toISOString()}*\n`;

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
    // Report exists and is less than a day old - might need update
    const ageMs = now.getTime() - stat.mtime.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return ageMs > oneDayMs;
  } catch {
    // Report doesn't exist
    return true;
  }
}