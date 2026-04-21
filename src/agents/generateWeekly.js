/**
 * @ocp-generate-weekly
 * Generate weekly context summary with Obsidian-style linking
 *
 * Usage: @ocp-generate-weekly [date]
 *
 * Wraps: reportGenerator.generateWeeklyReport()
 * Adds: Obsidian keyword headers from actual content + wiki links
 * Saves to: .opencode/context-session/reports/weekly-YYYY-WW.md
 */

import path from 'path';
import fs from 'fs/promises';
import { generateWeeklyReport } from '../modules/reportGenerator.js';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORT_PATHS, REPORTS_DIR } from './utils/linkBuilder.js';

export async function generateWeeklySummary(directory, weekDate) {
  const date = weekDate ? new Date(weekDate) : new Date();
  const year = date.getFullYear();
  const weekNum = String(Math.ceil(date.getDate() / 7)).padStart(2, '0');
  const weekStr = `W${weekNum}`;

  // DELEGATE to existing function
  const report = await generateWeeklyReport(directory, weekDate);

  // Extract keywords from report content
  const contentKeywords = extractKeywordsFromContent(report, 15);

  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateWeekly',
    keywords: contentKeywords
  });

  // Build header with keywords
  const header = `---
title: Weekly Context - ${year}-${weekStr}
keywords: ${keywords}
created: ${new Date().toISOString()}
---

`;

  const relatedBody = addRelatedLinks([
    'intelligence-learning.md',
    `monthly-${year}-${String(date.getMonth() + 1).padStart(2, '0')}.md`
  ]);

  const fullReport = header + report + relatedBody;

  // Save to standard location
  const filename = `weekly-${year}-${weekStr}.md`;
  const savePath = path.join(directory, REPORTS_DIR, filename);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}