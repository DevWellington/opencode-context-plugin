/**
 * @ocp-read-monthly
 * Read monthly context summary
 *
 * Usage: @ocp-read-monthly [month] [--summary|--all]
 *
 * Auto-generates if file doesn't exist
 */

import path from 'path';
import { readFileContent, fileExists } from './utils/fileReader.js';
import { REPORTS_DIR } from './utils/linkBuilder.js';
import { generateMonthlySummary } from './generateMonthly.js';

export async function readMonthlySummary(directory, monthDate, options = { summary: true }) {
  const date = monthDate ? new Date(monthDate) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const filename = `monthly-${year}-${month}.md`;
  const filePath = path.join(directory, REPORTS_DIR, filename);

  // Auto-generate if doesn't exist
  if (!(await fileExists(filePath))) {
    await generateMonthlySummary(directory, monthDate);
  }

  const content = await readFileContent(filePath, options);

  return `## Monthly Context - ${year}-${month}\n\n${content || 'No monthly summary found.'}`;
}