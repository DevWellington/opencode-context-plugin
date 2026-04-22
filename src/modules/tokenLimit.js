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
 * Code indicator patterns for detecting code content
 */
const CODE_PATTERNS = [
  /\{/, /\}/, /\(\)/, /=>/, /\bfunction\b/, /\bconst\b/, /\blet\b/, /\bvar\b/,
  /\bif\b/, /\bfor\b/, /\bwhile\b/, /\breturn\b/, /\bimport\b/, /\bexport\b/,
  /\bclass\b/, /\binterface\b/, /\btype\b/, /=*>/, /\/\//, /\/\*/, /\*\//
];

/**
 * Count code indicators in content
 * @param {string} content - Content to analyze
 * @returns {number} - Count of code indicators
 */
function countCodeIndicators(content) {
  let count = 0;
  for (const pattern of CODE_PATTERNS) {
    const matches = content.match(new RegExp(pattern.source, 'g'));
    count += matches ? matches.length : 0;
  }
  return count;
}

/**
 * Detect if content is primarily code vs prose
 * @param {string} content - Content to analyze
 * @returns {boolean} - True if content appears to be code
 */
export function isCodeContent(content) {
  if (!content || content.length === 0) return false;
  
  const codeIndicatorsPer100Chars = (countCodeIndicators(content) * 100) / content.length;
  return codeIndicatorsPer100Chars > 3;
}

/**
 * Accurate token estimation using content-type-aware char per token ratio
 * @param {string} content - Text content to estimate
 * @param {string|null} type - 'code', 'prose', or null for auto-detection
 * @returns {number} - Token count
 */
export function countTokens(content, type = null) {
  if (!content) return 0;
  
  // Use provided type or detect
  const actualType = type || (isCodeContent(content) ? 'code' : 'prose');
  const charsPerToken = actualType === 'code' ? 3 : 4;
  
  return Math.ceil(content.length / charsPerToken);
}

/**
 * Count tokens in session messages
 * @param {Array<{content: string, role: string, index?: number}>} messages - Session messages
 * @returns {{ total: number, byRole: {user: number, assistant: number, system: number}, byMessage: Array<{index: number, role: string, tokens: number, preview: string}> }}
 */
export function countSessionTokens(messages) {
  const result = { total: 0, byRole: { user: 0, assistant: 0, system: 0 }, byMessage: [] };
  
  if (!messages || messages.length === 0) return result;
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const content = msg.content || '';
    const type = isCodeContent(content) ? 'code' : 'prose';
    const tokens = countTokens(content, type);
    
    result.total += tokens;
    result.byRole[msg.role] = (result.byRole[msg.role] || 0) + tokens;
    result.byMessage.push({
      index: msg.index ?? i,
      role: msg.role,
      tokens,
      preview: content.slice(0, 50)
    });
  }
  
  return result;
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