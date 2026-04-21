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
import { generateMonthlyReport } from '../modules/reportGenerator.js';
import { buildKeywords, addRelatedLinks, extractKeywordsFromContent, REPORTS_DIR } from './utils/linkBuilder.js';

export async function generateMonthlySummary(directory, monthDate) {
  let year, month;
  
  if (monthDate) {
    // Handle "2026-04" format or full date
    const parts = monthDate.split('-');
    if (parts.length >= 2) {
      year = parseInt(parts[0], 10);
      month = parts[1].padStart(2, '0');
    } else {
      const date = new Date(monthDate);
      year = date.getFullYear();
      month = String(date.getMonth() + 1).padStart(2, '0');
    }
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = String(now.getMonth() + 1).padStart(2, '0');
  }

  // DELEGATE to existing function
  const report = await generateMonthlyReport(directory, monthDate);

  // Extract keywords from report content - filter generic terms
  const contentKeywords = extractKeywordsFromContent(report, 15);
  const filteredKeywords = contentKeywords.filter(k =>
    !['session', 'week', 'message', 'total', 'compact', 'exit', 'sessões', 'mensagens'].includes(k.toLowerCase())
  );

  const keywords = buildKeywords({
    projectName: 'opencode-context-plugin',
    module: 'generateMonthly',
    keywords: filteredKeywords
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