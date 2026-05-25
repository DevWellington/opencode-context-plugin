import fs from 'fs/promises';
import path from 'path';
import { getConfig } from '../config.js';
import { atomicWrite, getTimestamp } from '../utils/fileUtils.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-cache');
const INDEX_FILE = 'index.json';

function getCacheDir(baseDir) {
  return path.join(baseDir, '.opencode/context-session/cache');
}

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {string} contextId - Unique context identifier
 * @property {number} relevanceScore - LLM-assigned score
 * @property {number} tokens - Token count
 * @property {string} cachedAt - ISO timestamp
 * @property {string} content - Cached content
 */

/**
 * Get all cached contexts
 */
export async function getCachedContexts(baseDir) {
  const indexPath = path.join(getCacheDir(baseDir), INDEX_FILE);
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);
    return index.contexts || [];
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger(`[context-cache] Failed to read cache index: ${error.message}`);
    }
    return [];
  }
}

/**
 * Get a specific context from cache
 */
export async function getCachedContext(contextId, baseDir) {
  const contexts = await getCachedContexts(baseDir);
  return contexts.find(c => c.contextId === contextId);
}

/**
 * Check if cache is valid (not stale)
 */
export async function isCacheValid(contextId, baseDir) {
  const config = getConfig();
  const ttlHours = config.injection?.cache?.ttlHours || 24;
  
  const entry = await getCachedContext(contextId, baseDir);
  if (!entry) return false;
  
  const cachedAt = new Date(entry.cachedAt);
  const now = new Date();
  const hoursOld = (now - cachedAt) / (1000 * 60 * 60);
  
  return hoursOld < ttlHours;
}

/**
 * Save contexts to cache
 */
export async function saveToCache(contexts, baseDir) {
  const index = { contexts, updatedAt: new Date().toISOString() };
  const indexPath = path.join(getCacheDir(baseDir), INDEX_FILE);
  
  // Ensure cache directory exists
  await fs.mkdir(getCacheDir(baseDir), { recursive: true });
  
  await atomicWrite(indexPath, JSON.stringify(index, null, 2));
  logger(`[context-cache] Saved ${contexts.length} contexts to cache`);
}

/**
 * Invalidate entire cache (called when new context is saved)
 */
export async function invalidateCache(baseDir) {
  const indexPath = path.join(getCacheDir(baseDir), INDEX_FILE);
  try {
    await fs.unlink(indexPath);
    logger('[context-cache] Cache invalidated');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger(`[context-cache] Failed to invalidate cache: ${error.message}`);
    }
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(baseDir) {
  const contexts = await getCachedContexts(baseDir);
  const totalTokens = contexts.reduce((sum, c) => sum + (c.tokens || 0), 0);
  return {
    count: contexts.length,
    totalTokens,
    oldest: contexts.length > 0 ? contexts[0].cachedAt : null,
    newest: contexts.length > 0 ? contexts[contexts.length - 1].cachedAt : null
  };
}
