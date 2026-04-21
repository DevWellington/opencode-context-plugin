/**
 * @ocp-generate-monthly
 * Generate monthly context summary with Obsidian-style linking
 *
 * Usage: @ocp-generate-monthly [month]
 *
 * Wraps: reportGenerator.generateMonthlyReport()
 * Adds: Obsidian keyword headers from actual content + wiki links
 * Saves to: .opencode/context-session/reports/monthly-YYYY-MM.md
 */

import path from 'path';
import fs from 'fs/promises';
import { generateMonthlyReport } from '../../modules/reportGenerator.js';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORTS_DIR } from './utils/linkBuilder.js';

export async function generateMonthlySummary(directory, monthDate) {
  const date = monthDate ? new Date(monthDate) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // DELEGATE to existing function
  const report = await generateMonthlyReport(directory, monthDate);

  // Extract keywords from report content
  const contentKeywords = extractKeywordsFromContent(report, 15);

  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateMonthly',
    keywords: contentKeywords
  });

  const header = `---
title: Monthly Context - ${year}-${month}
keywords: ${keywords}
created: ${new Date().toISOString()}
---

`;

  const relatedBody = addRelatedLinks([
    'intelligence-learning.md',
    `annual-${year}.md`
  ]);

  const fullReport = header + report + relatedBody;

  // Save to standard location
  const filename = `monthly-${year}-${month}.md`;
  const savePath = path.join(directory, REPORTS_DIR, filename);
  await fs.mkdir(path.dirname(savePath), { recursive: true });
  await fs.writeFile(savePath, fullReport, 'utf-8');

  return fullReport;
}