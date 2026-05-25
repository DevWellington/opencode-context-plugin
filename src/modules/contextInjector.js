import path from 'path';
import fs from 'fs/promises';
import { getConfig } from '../config.js';
import { scoreContextRelevance } from './relevanceScoring.js';
import { getCachedContexts, isCacheValid, saveToCache } from './contextCache.js';
import { estimateTokens, truncateToTokenLimit, distributeTokenBudget } from './tokenLimit.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-injector');

function getContextDir(baseDir) {
  return path.join(baseDir, '.opencode/context-session');
}

/**
 * Get all context files from context-session directory
 *
 * INJECTION CONTRACT: Only `exit-*` files are included for injection.
 *
 * **Exclusion of `compact-*` files is intentional by design:**
 *
 * - `exit-*` files: Complete session snapshots saved at session end. These contain
 *   full conversation context with natural conclusions, making them ideal for
 *   relevance scoring and injection into new sessions.
 *
 * - `compact-*` files: Mid-session snapshots saved during `/compact` operations.
 *   These represent incomplete, in-progress work and may lack proper context
 *   boundaries. Including them could inject misleading or fragmented context.
 *
 * This contract ensures only complete, well-formed sessions are used for
 * context injection, improving relevance quality and reducing noise.
 *
 * @see GAP-04 in v1.3-QUALITY-ROADMAP
 */
async function getAllContextFiles(baseDir) {
  const contexts = [];

  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.startsWith('exit-') && entry.name.endsWith('.md')) {
          contexts.push(fullPath);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger(`[injector] Failed to scan ${dir}: ${error.message}`);
      }
    }
  }

  await scanDir(getContextDir(baseDir));
  return contexts.sort().reverse();
}

/**
 * Load context file with metadata
 */
async function loadContext(contextPath) {
  const content = await fs.readFile(contextPath, 'utf-8');
  const filename = path.basename(contextPath, '.md');
  const tokens = estimateTokens(content);
  
  return {
    path: contextPath,
    id: filename,
    content,
    tokens,
    loadedAt: new Date().toISOString()
  };
}

/**
 * Get relevant contexts for injection
 * INJECT-01: Filter by relevance score
 * INJECT-04: Use cache when valid
 */
export async function getRelevantContexts(currentSession, options = {}) {
  const config = getConfig();
  const maxContexts = options.maxContexts || config.injection?.maxContexts || 5;
  const maxTokens = options.maxTokens || config.injection?.maxTokens || 8000;
  const baseDir = options.baseDir || process.cwd();
  
  // Check cache first
  if (config.injection?.cache?.enabled) {
    const cached = await getCachedContexts(baseDir);
    const validCached = [];
    
    for (const entry of cached) {
      if (await isCacheValid(entry.contextId, baseDir)) {
        validCached.push(entry);
      }
    }
    
    if (validCached.length > 0) {
      logger(`[injector] Using ${validCached.length} cached contexts`);
      const mapped = validCached.slice(0, maxContexts).map(entry => ({
        context: { id: entry.contextId, score: entry.relevanceScore },
        content: entry.content,
        tokens: entry.tokens
      }));
      return distributeTokenBudget(mapped, maxTokens);
    }
  }
  
  // Load and score all contexts
  const contextPaths = await getAllContextFiles(baseDir);
  const contexts = await Promise.all(contextPaths.map(loadContext));
  
  // Score each context
  const scoredContexts = [];
  for (const ctx of contexts) {
    try {
      const score = await scoreContextRelevance(ctx.path, currentSession);
      scoredContexts.push({ ...ctx, score });
    } catch (error) {
      logger(`[injector] Failed to score ${ctx.path}: ${error.message}`);
      scoredContexts.push({ ...ctx, score: 0 });
    }
  }
  
  // Sort by score descending
  scoredContexts.sort((a, b) => b.score - a.score);
  
  // Take top N
  const topContexts = scoredContexts.slice(0, maxContexts);
  
  // Distribute token budget
  const result = distributeTokenBudget(topContexts, maxTokens);
  
  // Cache the result
  if (config.injection?.cache?.enabled) {
    const cacheEntries = result.map(r => ({
      contextId: r.context.id,
      relevanceScore: r.context.score,
      tokens: r.tokens,
      cachedAt: new Date().toISOString(),
      content: r.content
    }));
    await saveToCache(cacheEntries, baseDir);
  }
  
  return result;
}

/**
 * Interactive context selection for manual injection
 * Returns list of selected context IDs for injection
 */
export async function selectContextsInteractively(contexts) {
  // For CLI/manual mode: return top contexts by relevance
  // Integration with OpenCode prompt hooks would go here
  // This enables: /inject or !context command
  return contexts.slice(0, 5).map(c => c.context.id);
}

/**
 * Inject contexts into current session prompt
 * Called when user triggers manual injection
 * @public
 */
export async function injectContextPrompt(currentSession, baseDir = process.cwd()) {
  const scoredContexts = await getRelevantContexts(currentSession, { baseDir });
  const selectedIds = await selectContextsInteractively(scoredContexts);

  const selectedContexts = scoredContexts.filter(
    c => selectedIds.includes(c.context.id)
  );

  return formatForInjection(selectedContexts);
}

/**
 * Format contexts for injection into session
 * INJECT-02: Token-based limiting applied
 */
export function formatForInjection(scoredContexts) {
  const lines = ['## Relevant Contexts\n'];

  for (const item of scoredContexts) {
    lines.push(`### ${item.context.id} (score: ${item.context.score?.toFixed(2) || 'N/A'})`);
    lines.push(`Tokens: ~${item.tokens}`);
    lines.push('');
    lines.push(item.content);
    lines.push('\n---\n');
  }

  return lines.join('\n');
}