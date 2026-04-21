/**
 * @ocp-generate-today
 * Generate today's context summary with Obsidian-style linking
 *
 * Usage: @ocp-generate-today
 *
 * Extracts keywords from ACTUAL session content, not hardcoded
 * Saves to: .opencode/context-session/daily-summary.md
 */

import path from 'path';
import fs from 'fs/promises';
import { formatFileHeader, addRelatedLinks, buildKeywords, extractKeywordsFromContent, REPORT_PATHS } from './utils/linkBuilder.js';
import { getConfig } from '../../config.js';

export async function generateTodaySummary(directory) {
  const config = getConfig();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const week = `W${Math.ceil(today.getDate() / 7)}`;
  const day = String(today.getDate()).padStart(2, '0');

  const sessionDir = path.join(directory, '.opencode', 'context-session', String(year), month, week, day);

  // Read all session files from today
  let sessions = [];
  let allContent = '';

  try {
    const files = await fs.readdir(sessionDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(sessionDir, file), 'utf-8');
        sessions.push({ file, content });
        allContent += content + '\n';
      }
    }
  } catch {
    // No sessions yet today
  }

  // Extract keywords from actual content
  const contentKeywords = extractKeywordsFromContent(allContent, 15);

  const keywords = buildKeywords({
    projectName: config.projectName || 'opencode-context-plugin',
    module: 'generateToday',
    keywords: contentKeywords
  });

  const header = formatFileHeader(`Today's Context - ${today.toISOString().split('T')[0]}`, keywords);

  // Build summary
  const sessionCount = sessions.length;
  const exitCount = sessions.filter(s => s.file.startsWith('exit-')).length;
  const compactCount = sessions.filter(s => s.file.startsWith('compact-')).length;

  let body = `## Summary\n\n`;
  body += `- **Date:** ${today.toISOString().split('T')[0]}\n`;
  body += `- **Total Sessions:** ${sessionCount}\n`;
  body += `- **Exit Sessions:** ${exitCount}\n`;
  body += `- **Compact Sessions:** ${compactCount}\n\n`;

  if (sessions.length > 0) {
    body += `## Session Files\n\n`;
    for (const session of sessions) {
      body += `- [[${session.file}]]\n`;
    }
  }

  body += addRelatedLinks([
    'intelligence-learning.md',
    `weekly-${year}-${week}.md`
  ]);

  const fullReport = header + body;

  // Save to standard location
  const savePath = path.join(directory, REPORT_PATHS.today);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}