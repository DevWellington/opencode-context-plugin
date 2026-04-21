import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('token-limit');

/**
 * Estimate token count using character approximation
 * Matches D-02: Math.ceil(content.length / 4)
 * @param {string} content - Text content to estimate
 * @returns {number} - Estimated token count
 */
export function estimateTokens(content) {
  if (!content) return 0;
  return Math.ceil(content.length / 4);
}

/**
 * Truncate content to fit within token limit
 * @param {string} content - Content to truncate
 * @param {number} maxTokens - Maximum tokens allowed
 * @returns {string} - Truncated content
 */
export function truncateToTokenLimit(content, maxTokens) {
  const estimated = estimateTokens(content);
  if (estimated <= maxTokens) return content;
  
  // Rough: take maxTokens * 4 characters
  // This slightly over-estimates tokens but is safe
  const maxChars = maxTokens * 4;
  const truncated = content.slice(0, maxChars);
  
  logger(`[token-limit] Truncated ${estimated} tokens to ${maxTokens} (${content.length} -> ${maxChars} chars)`);
  return truncated;
}

/**
 * Calculate token budget distribution across contexts
 * @param {number} totalBudget - Total token budget
 * @param {number} contextCount - Number of contexts to distribute
 * @returns {object} - { perContext: number[], currentSession: number }
 */
export function calculateTokenBudget(totalBudget, contextCount) {
  const config = getConfig();
  const maxPerContext = config.injection?.maxContexts 
    ? Math.floor(totalBudget / Math.min(contextCount + 1, config.injection.maxContexts))
    : Math.floor(totalBudget / (contextCount + 1));
  
  const currentSessionBudget = Math.floor(totalBudget * 0.2); // 20% for current
  const historicalBudget = totalBudget - currentSessionBudget;
  const perContext = Math.floor(historicalBudget / Math.min(contextCount, config.injection?.maxContexts || 5));
  
  return {
    perContext,
    currentSession: currentSessionBudget
  };
}

/**
 * Split token budget among contexts proportionally
 * @param {Array<{tokens: number, content: string}>} contexts - Contexts with token counts
 * @param {number} maxTokens - Maximum tokens total
 * @returns {Array<{context: object, content: string, tokens: number}>}
 */
export function distributeTokenBudget(contexts, maxTokens) {
  const totalTokens = contexts.reduce((sum, c) => sum + (c.tokens || estimateTokens(c.content)), 0);
  
  if (totalTokens <= maxTokens) {
    return contexts.map(c => ({
      context: c,
      content: c.content,
      tokens: c.tokens || estimateTokens(c.content)
    }));
  }
  
  // Proportional distribution
  const ratio = maxTokens / totalTokens;
  const result = [];
  let usedTokens = 0;
  
  for (const context of contexts) {
    const contextTokens = context.tokens || estimateTokens(context.content);
    const allocatedTokens = Math.floor(contextTokens * ratio);
    const truncated = truncateToTokenLimit(context.content, allocatedTokens);
    
    result.push({
      context,
      content: truncated,
      tokens: estimateTokens(truncated)
    });
    usedTokens += estimateTokens(truncated);
    
    if (usedTokens >= maxTokens) break;
  }
  
  return result;
}