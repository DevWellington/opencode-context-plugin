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
import { updateIntelligenceLearning } from './generateIntelligenceLearning.js';

export async function readIntelligenceLearning(directory, options = { summary: true }) {
  const filePath = path.join(directory, REPORT_PATHS.intelligence);

  // Auto-generate if doesn't exist
  if (!(await fileExists(filePath))) {
    await updateIntelligenceLearning(directory);
  }

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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}