/**
 * Context Cache Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({
    injection: {
      cache: { ttlHours: 24 },
    },
  })),
}));

jest.unstable_mockModule('../src/utils/fileUtils.js', async () => {
  const { writeFile } = await import('fs/promises');
  return {
    atomicWrite: jest.fn(async (filePath, content) => {
      await writeFile(filePath, content, 'utf-8');
    }),
    getTimestamp: jest.fn(() => '2026-04-21T10-30-00'),
  };
});

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn()),
}));

function cacheDir(baseDir) {
  return path.join(baseDir, '.opencode/context-session/cache');
}

function indexPath(baseDir) {
  return path.join(cacheDir(baseDir), 'index.json');
}

describe('contextCache', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('saveToCache', () => {
    it('should create cache directory and write index.json', async () => {
      const { saveToCache, getCachedContexts } = await import('../src/modules/contextCache.js');
      const { atomicWrite } = await import('../src/utils/fileUtils.js');

      const contexts = [
        { contextId: 'ctx-1', relevanceScore: 0.9, tokens: 150, cachedAt: new Date().toISOString(), content: 'content1' },
      ];

      await saveToCache(contexts, tempDir);

      const dirExists = await fs
        .access(cacheDir(tempDir))
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);

      expect(atomicWrite).toHaveBeenCalledWith(indexPath(tempDir), expect.any(String));

      const saved = await getCachedContexts(tempDir);
      expect(saved).toEqual(contexts);
    });
  });

  describe('getCachedContexts', () => {
    it('should return empty array when no index exists', async () => {
      const { getCachedContexts } = await import('../src/modules/contextCache.js');
      const contexts = await getCachedContexts(tempDir);
      expect(contexts).toEqual([]);
    });

    it('should parse existing index correctly', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      const contexts = [
        { contextId: 'ctx-1', relevanceScore: 0.8, tokens: 200, cachedAt: '2026-04-20T12:00:00.000Z', content: 'data' },
      ];
      await fs.writeFile(
        indexPath(tempDir),
        JSON.stringify({ contexts, updatedAt: '2026-04-21T10:00:00.000Z' }, null, 2),
        'utf-8',
      );

      const { getCachedContexts } = await import('../src/modules/contextCache.js');
      const result = await getCachedContexts(tempDir);
      expect(result).toEqual(contexts);
    });
  });

  describe('getCachedContext', () => {
    it('should find context by ID', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      const contexts = [
        { contextId: 'ctx-1', relevanceScore: 0.9, tokens: 100, cachedAt: '2026-04-20T12:00:00.000Z', content: 'a' },
        { contextId: 'ctx-2', relevanceScore: 0.5, tokens: 50, cachedAt: '2026-04-20T12:00:00.000Z', content: 'b' },
      ];
      await fs.writeFile(
        indexPath(tempDir),
        JSON.stringify({ contexts }, null, 2),
        'utf-8',
      );

      const { getCachedContext } = await import('../src/modules/contextCache.js');
      const found = await getCachedContext('ctx-2', tempDir);
      expect(found).toEqual(contexts[1]);
    });

    it('should return undefined for missing context ID', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      await fs.writeFile(
        indexPath(tempDir),
        JSON.stringify({ contexts: [{ contextId: 'ctx-1' }] }, null, 2),
        'utf-8',
      );

      const { getCachedContext } = await import('../src/modules/contextCache.js');
      const found = await getCachedContext('nonexistent', tempDir);
      expect(found).toBeUndefined();
    });
  });

  describe('isCacheValid', () => {
    it('should return false for expired entries', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await fs.writeFile(
        indexPath(tempDir),
        JSON.stringify({
          contexts: [{ contextId: 'ctx-1', cachedAt: oldDate }],
        }, null, 2),
        'utf-8',
      );

      const { isCacheValid } = await import('../src/modules/contextCache.js');
      const valid = await isCacheValid('ctx-1', tempDir);
      expect(valid).toBe(false);
    });

    it('should return true for fresh entries', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      const freshDate = new Date().toISOString();
      await fs.writeFile(
        indexPath(tempDir),
        JSON.stringify({
          contexts: [{ contextId: 'ctx-1', cachedAt: freshDate }],
        }, null, 2),
        'utf-8',
      );

      const { isCacheValid } = await import('../src/modules/contextCache.js');
      const valid = await isCacheValid('ctx-1', tempDir);
      expect(valid).toBe(true);
    });

    it('should return false when entry does not exist', async () => {
      const { isCacheValid } = await import('../src/modules/contextCache.js');
      const valid = await isCacheValid('nonexistent', tempDir);
      expect(valid).toBe(false);
    });
  });

  describe('invalidateCache', () => {
    it('should delete index file', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      await fs.writeFile(indexPath(tempDir), JSON.stringify({ contexts: [] }), 'utf-8');

      const { invalidateCache, getCachedContexts } = await import('../src/modules/contextCache.js');
      await invalidateCache(tempDir);

      const contexts = await getCachedContexts(tempDir);
      expect(contexts).toEqual([]);
    });

    it('should handle missing index gracefully', async () => {
      const { invalidateCache } = await import('../src/modules/contextCache.js');
      await expect(invalidateCache(tempDir)).resolves.toBeUndefined();
    });
  });

  describe('getCacheStats', () => {
    it('should return stats object with count and totalTokens', async () => {
      await fs.mkdir(cacheDir(tempDir), { recursive: true });
      const contexts = [
        { contextId: 'a', tokens: 100, cachedAt: '2026-04-20T10:00:00.000Z' },
        { contextId: 'b', tokens: 200, cachedAt: '2026-04-21T10:00:00.000Z' },
      ];
      await fs.writeFile(
        indexPath(tempDir),
        JSON.stringify({ contexts }, null, 2),
        'utf-8',
      );

      const { getCacheStats } = await import('../src/modules/contextCache.js');
      const stats = await getCacheStats(tempDir);
      expect(stats).toEqual({
        count: 2,
        totalTokens: 300,
        oldest: '2026-04-20T10:00:00.000Z',
        newest: '2026-04-21T10:00:00.000Z',
      });
    });

    it('should return zeroed stats when no cache exists', async () => {
      const { getCacheStats } = await import('../src/modules/contextCache.js');
      const stats = await getCacheStats(tempDir);
      expect(stats).toEqual({
        count: 0,
        totalTokens: 0,
        oldest: null,
        newest: null,
      });
    });
  });
});
