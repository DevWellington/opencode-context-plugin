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
export function truncateToTokenLimit(content, maxTokens, isCode = null) {
  if (!content || content.length === 0) return content;

  const contentIsCode = isCode !== null ? isCode : isCodeContent(content);
  const encoding = contentIsCode ? 'code' : 'prose';
  const ratio = contentIsCode ? 3 : 4;

  let truncated = content;
  const roughMaxChars = Math.floor(maxTokens * ratio);
  if (truncated.length > roughMaxChars) {
    truncated = truncated.slice(0, roughMaxChars);
  }

  let actualTokens = countTokens(truncated, encoding);

  if (actualTokens > maxTokens) {
    let low = 0;
    let high = truncated.length;
    while (low < high && (high - low) > 10) {
      const mid = Math.floor((low + high) / 2);
      const testContent = truncated.slice(0, mid);
      const testTokens = countTokens(testContent, encoding);
      if (testTokens <= maxTokens) {
        low = mid;
      } else {
        high = mid;
      }
    }
    truncated = truncated.slice(0, low);
    actualTokens = countTokens(truncated, encoding);
  }

  logger(`[token-limit] Truncated ${actualTokens} tokens to ${maxTokens} (${content.length} -> ${truncated.length} chars)`);
  return truncated;
}

/**
 * Truncate content to fit within character budget
 * @param {string} content - Content to truncate
 * @param {number} maxChars - Maximum characters allowed
 * @returns {string} - Truncated content with [truncated] marker if exceeded
 */
export function truncateToBudget(content, maxChars) {
  if (!content || content.length <= maxChars) return content || '';
  // Strip existing truncation markers to avoid double markers
  const cleanContent = content.replace(/\*\(truncated\)\*/g, '').replace(/\s*\[truncated\]\s*$/g, '').trim();
  const truncated = cleanContent.slice(0, maxChars);
  return truncated + ' [truncated]';
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