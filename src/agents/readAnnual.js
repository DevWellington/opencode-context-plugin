/**
 * @ocp-read-annual
 * Read annual context summary
 *
 * Usage: @ocp-read-annual [year] [--summary|--all]
 *
 * Auto-generates if file doesn't exist
 */

import path from 'path';
import { readFileContent, fileExists } from './utils/fileReader.js';
import { REPORTS_DIR } from './utils/linkBuilder.js';
import { generateAnnualSummary } from './generateAnnual.js';

export async function readAnnualSummary(directory, year, options = { summary: true }) {
  const targetYear = year || new Date().getFullYear();

  const filename = `annual-${targetYear}.md`;
  const filePath = path.join(directory, REPORTS_DIR, filename);

  // Auto-generate if doesn't exist
  if (!(await fileExists(filePath))) {
    await generateAnnualSummary(directory, targetYear);
  }

  const content = await readFileContent(filePath, options);

  return `## Annual Context - ${targetYear}\n\n${content || 'No annual summary found.'}`;
}