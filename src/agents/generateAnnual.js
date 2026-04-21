/**
 * @ocp-generate-annual
 * Generate annual context summary with yearly statistics
 *
 * Usage: @ocp-generate-annual [year]
 *
 * Uses: reportGenerator.scanSessionsInRange() for data
 * Extracts: Keywords from actual session content
 * Saves to: .opencode/context-session/reports/annual-YYYY.md
 */

import path from 'path';
import fs from 'fs/promises';
import { scanSessionsInRange } from '../../modules/reportGenerator.js';
import { formatFileHeader, addRelatedLinks, buildKeywords, extractKeywordsFromContent, REPORTS_DIR } from './utils/linkBuilder.js';

export async function generateAnnualSummary(directory, year) {
  const targetYear = year || new Date().getFullYear();

  const sessions = await scanSessionsInRange(
    directory,
    `${targetYear}-01-01`,
    `${targetYear}-12-31`
  );

  // Calculate statistics
  const totalSessions = sessions.length;
  const exitSessions = sessions.filter(s => s.type === 'exit').length;
  const compactSessions = sessions.filter(s => s.type === 'compact').length;
  const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0);

  // Group by month
  const monthlyStats = {};
  for (const session of sessions) {
    const month = session.date?.substring(5, 7) || 'unknown';
    if (!monthlyStats[month]) {
      monthlyStats[month] = { exit: 0, compact: 0, total: 0 };
    }
    monthlyStats[month].exit += session.type === 'exit' ? 1 : 0;
    monthlyStats[month].compact += session.type === 'compact' ? 1 : 0;
    monthlyStats[month].total++;
  }

  // Extract keywords from session data (combine all session content)
  const allSessionContent = sessions.map(s => s.content || '').join('\n');
  const contentKeywords = extractKeywordsFromContent(allSessionContent, 15);

  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateAnnual',
    keywords: contentKeywords
  });

  const header = formatFileHeader(`Annual Context - ${targetYear}`, keywords);

  let body = `## Annual Summary ${targetYear}\n\n`;
  body += `- **Total Sessions:** ${totalSessions}\n`;
  body += `- **Exit Sessions:** ${exitSessions}\n`;
  body += `- **Compact Sessions:** ${compactSessions}\n`;
  body += `- **Total Messages:** ${totalMessages}\n\n`;

  body += `## Monthly Statistics\n\n`;
  body += `| Month | Exit | Compact | Total |\n`;
  body += `|-------|------|---------|-------|\n`;
  for (const [month, stats] of Object.entries(monthlyStats)) {
    body += `| ${month} | ${stats.exit} | ${stats.compact} | ${stats.total} |\n`;
  }

  body += addRelatedLinks(['intelligence-learning.md']);

  const fullReport = header + body;

  // Save to standard location
  const filename = `annual-${targetYear}.md`;
  const savePath = path.join(directory, REPORTS_DIR, filename);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}