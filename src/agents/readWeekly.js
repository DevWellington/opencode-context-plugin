/**
 * @ocp-read-weekly
 * Read weekly context summary
 *
 * Usage: @ocp-read-weekly [date] [--summary|--all]
 *
 * Auto-generates if file doesn't exist
 */

import path from 'path';
import { readFileContent, fileExists } from './utils/fileReader.js';

import { getWeek } from '../utils/dateUtils.js';
import { CONTEXT_SESSION_DIR } from './utils/linkBuilder.js';
import { generateWeeklySummary } from './generateWeekly.js';

export async function readWeeklySummary(directory, weekDate, options = { summary: true }) {
  const date = weekDate ? new Date(weekDate) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const weekNum = String(getWeek(date)).padStart(2, '0');
  const weekStr = `W${weekNum}`;

  const filePath = path.join(directory, CONTEXT_SESSION_DIR, String(year), month, weekStr, 'week-summary.md');

  // Auto-generate if doesn't exist
  if (!(await fileExists(filePath))) {
    await generateWeeklySummary(directory, weekDate);
  }

  const content = await readFileContent(filePath, options);

  return `## Weekly Context - ${year} ${weekStr}\n\n${content || 'No weekly summary found.'}`;
}