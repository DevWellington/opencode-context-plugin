import fs from 'fs/promises';
import path from 'path';
import { createDebugLogger } from '../utils/debug.js';
import { extractSessionContent } from './contentExtractor.js';
import { CONTEXT_SESSION_DIR } from '../config.js';

const logger = createDebugLogger('context-validator');

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether content passed validation
 * @property {string[]} warnings - Array of warning messages
 * @property {string[]} missingFields - Array of missing required fields
 */

/**
 * Validate that session content has required structured sections
 * Required: Goal + Accomplished + at least one Discovery OR Relevant Files
 *
 * @param {string} content - Raw session content
 * @param {string} sessionPath - Path to session file for logging
 * @returns {ValidationResult}
 */
export function validateSessionContent(content, sessionPath = 'unknown') {
  const warnings = [];
  const missingFields = [];

  if (!content || content.length < 50) {
    return {
      isValid: false,
      warnings: ['Content too short to validate'],
      missingFields: ['content']
    };
  }

  const extracted = extractSessionContent(content);

  if (!extracted.goal || extracted.goal.length < 10) {
    missingFields.push('Goal');
    warnings.push('[context-validator] Missing or weak Goal section - add ## Goal at session start');
  }

  if (!extracted.accomplished || extracted.accomplished.length < 10) {
    missingFields.push('Accomplished');
    warnings.push('[context-validator] Missing or weak Accomplished section - add ## Accomplished before session end');
  }

  const hasDiscovery = extracted.discoveries && extracted.discoveries.length > 10;
  const hasFiles = extracted.relevantFiles && extracted.relevantFiles.length > 0;

  if (!hasDiscovery && !hasFiles) {
    missingFields.push('Discovery OR Relevant Files');
    warnings.push('[context-validator] Missing Discovery OR Relevant Files - add ## Discoveries or ## Relevant Files');
  }

  const isValid = missingFields.length === 0;

  if (!isValid) {
    for (const warning of warnings) {
      logger(warning);
    }
    logger(`[context-validator] Validation FAILED for ${sessionPath}: missing ${missingFields.join(', ')}`);
  } else {
    logger(`[context-validator] Validation PASSED for ${sessionPath}`);
  }

  return { isValid, warnings, missingFields };
}

/**
 * Log failed validation to intelligence-learning.md as failedApproach
 * Appends to a dedicated section in the intelligence file
 *
 * @param {string} baseDir - Project base directory
 * @param {ValidationResult} result - Validation result
 * @param {string} sessionPath - Path to session file
 */
export async function logFailedValidation(baseDir, result, sessionPath) {
  if (result.isValid) return;

  const timestamp = new Date().toISOString();
  const sessionName = sessionPath.split('/').pop() || 'unknown';

  const failedApproachEntry = `- [${timestamp}] ANTI-PATTERN: Session lacks structured content (${result.missingFields.join(', ')}) in ${sessionName}`;

  try {
    const intelPath = path.join(baseDir, CONTEXT_SESSION_DIR, 'intelligence-learning.md');
    let existingContent = '';

    try {
      existingContent = await fs.readFile(intelPath, 'utf-8');
    } catch {
      existingContent = '';
    }

    const marker = '## Failed Approaches';
    if (existingContent.includes(marker)) {
      const idx = existingContent.indexOf(marker);
      const before = existingContent.slice(0, idx + marker.length);
      const after = existingContent.slice(idx + marker.length);

      const lines = after.split('\n');
      let insertIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('## ') && !lines[i].startsWith(marker)) {
          insertIdx = i;
          break;
        }
        insertIdx = i + 1;
      }

      lines.splice(insertIdx, 0, failedApproachEntry);
      existingContent = before + '\n' + lines.join('\n');
    } else {
      existingContent += `\n\n${marker}\n\n${failedApproachEntry}\n`;
    }

    await fs.writeFile(intelPath, existingContent, 'utf-8');
    logger(`[context-validator] Logged failed validation to intelligence: ${sessionName}`);
  } catch (error) {
    logger(`[context-validator] Failed to log to intelligence: ${error.message}`);
  }
}

/**
 * Validate and log session content after save
 * Call this after saveContext completes successfully
 *
 * @param {string} baseDir - Project base directory
 * @param {string} content - Session file content
 * @param {string} sessionPath - Full path to session file
 */
export async function validateAfterSave(baseDir, content, sessionPath) {
  const result = validateSessionContent(content, sessionPath);

  if (!result.isValid) {
    await logFailedValidation(baseDir, result, sessionPath);
  }

  return result;
}

/**
 * Get suggestions for improving session content quality
 * @param {ValidationResult} result - Previous validation result
 * @returns {string[]} Array of suggestions
 */
export function getSuggestions(result) {
  const suggestions = [];

  if (result.missingFields.includes('Goal')) {
    suggestions.push('Add "## Goal" section at start describing what you plan to accomplish');
  }

  if (result.missingFields.includes('Accomplished')) {
    suggestions.push('Add "## Accomplished" section before session ends listing completed work');
  }

  if (result.missingFields.includes('Discovery OR Relevant Files')) {
    suggestions.push('Add "## Discoveries" section with findings or "## Relevant Files" section with file paths');
  }

  return suggestions;
}