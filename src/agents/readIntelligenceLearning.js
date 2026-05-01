/**
 * @ocp-read-intelligence-learning
 * Read intelligence-learning.md file
 *
 * Usage: @ocp-read-intelligence-learning [--summary|--all]
 *
 * Auto-generates if file doesn't exist
 */

import path from 'path';
import fs from 'fs/promises';
import { extractSummary } from './utils/fileReader.js';
import { REPORT_PATHS } from './utils/linkBuilder.js';

export async function readIntelligenceLearning(directory, options = { summary: true }) {
  const filePath = path.join(directory, REPORT_PATHS.intelligence);

  // Don't auto-generate - file should already exist or user triggers generation manually
  // if (!(await fileExists(filePath))) {
  //   await updateIntelligenceLearning(directory);
  // }

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    if (options.summary) {
      return extractSummary(content);
    }

    return content;
  } catch (error) {
    return `Error reading intelligence learning: ${error.message}`;
  }
}