/**
 * Inject Prompt Module
 * Interactive context selection and injection for manual context injection
 * 
 * This module provides:
 * - listAvailableContexts(): List all available contexts with scores
 * - formatContextPreview(): Format context list for display
 * - interactiveInject(): Execute injection of selected contexts
 */

import { getRelevantContexts, formatForInjection } from './contextInjector.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('inject-prompt');

/**
 * List all available contexts with relevance scores
 * @param {Object} currentSession - Current session object with messages
 * @param {Object} options - Options { maxContexts: 10, maxTokens: 16000 }
 * @returns {Array} Array of { id, title, score, tokens, preview }
 */
export async function listAvailableContexts(currentSession, options = {}) {
  const maxContexts = options.maxContexts || 10;
  const maxTokens = options.maxTokens || 16000;
  
  try {
    const scoredContexts = await getRelevantContexts(currentSession, {
      maxContexts,
      maxTokens
    });
    
    const contexts = scoredContexts.map(item => ({
      id: item.context.id,
      title: item.context.id,
      score: item.context.score || 0,
      tokens: item.tokens,
      preview: item.content.substring(0, 200).replace(/\n/g, ' ').trim() + '...'
    }));
    
    logger(`[inject-prompt] Listed ${contexts.length} available contexts`);
    return contexts;
  } catch (error) {
    logger(`[inject-prompt] Failed to list contexts: ${error.message}`);
    return [];
  }
}

/**
 * Format context list for display
 * @param {Array} contexts - Array of context objects from listAvailableContexts
 * @returns {string} Formatted string for display
 */
export function formatContextPreview(contexts) {
  if (!contexts || contexts.length === 0) {
    return '# Available Contexts\n\nNo relevant contexts found.';
  }
  
  const lines = ['# Available Contexts\n'];
  lines.push('');
  
  contexts.forEach((ctx, index) => {
    const num = index + 1;
    const scoreStr = ctx.score.toFixed(2);
    const tokens = ctx.tokens || 0;
    
    lines.push(`${num}. [${scoreStr}] ${ctx.id} (${tokens} tokens)`);
    lines.push(`   Preview: ${ctx.preview}`);
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Execute injection of selected contexts
 * @param {Object} currentSession - Current session object
 * @param {Array|null} selectedIndices - Array of indices to inject (0-based), or null for top 5
 * @returns {string} Formatted injection text
 */
export async function interactiveInject(currentSession, selectedIndices = null) {
  try {
    const scoredContexts = await getRelevantContexts(currentSession, {
      maxContexts: 10,
      maxTokens: 16000
    });
    
    let selectedContexts;
    
    if (selectedIndices && selectedIndices.length > 0) {
      // Inject specific contexts by index
      selectedContexts = selectedIndices
        .filter(idx => idx >= 0 && idx < scoredContexts.length)
        .map(idx => scoredContexts[idx]);
    } else {
      // Default: inject top 5 by relevance
      selectedContexts = scoredContexts.slice(0, 5);
    }
    
    if (selectedContexts.length === 0) {
      return 'No contexts selected for injection.';
    }
    
    const injection = formatForInjection(selectedContexts);
    logger(`[inject-prompt] Injected ${selectedContexts.length} contexts`);
    
    return injection;
  } catch (error) {
    logger(`[inject-prompt] Injection failed: ${error.message}`);
    return `Injection failed: ${error.message}`;
  }
}