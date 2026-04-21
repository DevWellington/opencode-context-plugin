import path from 'path';
import fs from 'fs/promises';
import { getConfig } from '../config.js';
import { scoreContextRelevance } from './relevanceScoring.js';
import { getCachedContexts, isCacheValid, saveToCache } from './contextCache.js';
import { estimateTokens, truncateToTokenLimit, distributeTokenBudget } from './tokenLimit.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-injector');
const CONTEXT_SESSION_DIR = '.opencode/context-session';

/**
 * Get all context files from context-session directory
 */
async function getAllContextFiles() {
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
    } catch {
      // Directory doesn't exist yet
    }
  }
  
  await scanDir(CONTEXT_SESSION_DIR);
  return contexts.sort().reverse(); // Most recent first
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
  
  // Check cache first
  if (config.injection?.cache?.enabled) {
    const cached = await getCachedContexts();
    const validCached = [];
    
    for (const entry of cached) {
      if (await isCacheValid(entry.contextId)) {
        validCached.push(entry);
      }
    }
    
    if (validCached.length > 0) {
      logger(`[injector] Using ${validCached.length} cached contexts`);
      return validCached.slice(0, maxContexts);
    }
  }
  
  // Load and score all contexts
  const contextPaths = await getAllContextFiles();
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
    await saveToCache(cacheEntries);
  }
  
  return result;
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