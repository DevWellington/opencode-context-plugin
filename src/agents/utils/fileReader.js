import fs from 'fs/promises';
import path from 'path';

/**
 * Read file and return content with options
 * @param {string} filePath - Path to file
 * @param {object} options - { summary: boolean }
 * @returns {Promise<string>} - File content or summary
 */
export async function readFileContent(filePath, options = { summary: true }) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    if (options.summary) {
      return extractSummary(content);
    }

    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    return `Error reading file: ${error.message}`;
  }
}

/**
 * Extract summary section from content
 * @param {string} content - Full file content
 * @returns {string} - Summary with truncation notice
 */
export function extractSummary(content) {
  const lines = content.split('\n');
  let summaryEnd = 0;

  // Find end of first major section (## ...)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ') && i > 5) {
      summaryEnd = i;
      break;
    }
  }

  if (summaryEnd > 0 && summaryEnd < lines.length - 1) {
    return lines.slice(0, summaryEnd).join('\n') + '\n\n*[Summary - use --all for full content]*';
  }

  // If no clear sections, take first 20 lines
  if (lines.length > 20) {
    return lines.slice(0, 20).join('\n') + '\n\n... [truncated, use --all for full content]';
  }

  return content;
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}