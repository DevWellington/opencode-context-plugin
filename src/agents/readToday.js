/**
 * @ocp-read-today
 * Read today's context summary
 *
 * Usage: @ocp-read-today [--summary|--all]
 *
 * If file doesn't exist, auto-generates it first (good UX)
 */

import path from 'path';
import { readFileContent, fileExists } from './utils/fileReader.js';
import { REPORT_PATHS } from './utils/linkBuilder.js';
import { generateTodaySummary } from './generateToday.js';

export async function readTodaySummary(directory, options = { summary: true }) {
  const filePath = path.join(directory, REPORT_PATHS.today);

  // Check if file exists
  if (!(await fileExists(filePath))) {
    // Auto-generate if doesn't exist
    await generateTodaySummary(directory);
  }

  const content = await readFileContent(filePath, options);

  return `## Today's Context\n\n${content || 'No sessions found for today.'}`;
}