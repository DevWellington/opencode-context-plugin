/**
 * Context Injector Module Tests
 * Tests for cached context token budget application
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock dependencies
jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({
    injection: {
      maxContexts: 5,
      maxTokens: 8000,
      cache: { enabled: true, ttlHours: 24 }
    }
  }))
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn())
}));

jest.unstable_mockModule('../src/modules/contextCache.js', () => ({
  getCachedContexts: jest.fn(),
  isCacheValid: jest.fn().mockResolvedValue(true),
  saveToCache: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../src/modules/relevanceScoring.js', () => ({
  scoreContextRelevance: jest.fn().mockResolvedValue(0.5)
}));

const { getRelevantContexts } = await import('../src/modules/contextInjector.js');
const { getCachedContexts } = await import('../src/modules/contextCache.js');
const { scoreContextRelevance } = await import('../src/modules/relevanceScoring.js');

describe('ContextInjector - Cached Context Token Budget', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-injector-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  it('should return cached contexts as-is when within maxTokens budget', async () => {
    const smallContent = 'x'.repeat(500);
    getCachedContexts.mockResolvedValue([
      {
        contextId: 'ctx-1',
        relevanceScore: 0.9,
        tokens: 50,
        content: smallContent,
        cachedAt: new Date().toISOString()
      },
      {
        contextId: 'ctx-2',
        relevanceScore: 0.8,
        tokens: 50,
        content: smallContent,
        cachedAt: new Date().toISOString()
      }
    ]);

    const options = {
      baseDir: tempDir,
      maxTokens: 8000,
      maxContexts: 5
    };

    const result = await getRelevantContexts({ messages: [] }, options);

    // Both contexts should be returned without truncation (total 100 tokens << 8000)
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe(smallContent);
    expect(result[1].content).toBe(smallContent);
    // Should NOT have fallen through to scoring
    expect(scoreContextRelevance).not.toHaveBeenCalled();
  });

  it('should truncate cached contexts proportionally when they exceed maxTokens', async () => {
    const largeContent = 'y'.repeat(20000); // ~5000 tokens each
    getCachedContexts.mockResolvedValue([
      {
        contextId: 'ctx-big-1',
        relevanceScore: 0.9,
        tokens: 5000,
        content: largeContent,
        cachedAt: new Date().toISOString()
      },
      {
        contextId: 'ctx-big-2',
        relevanceScore: 0.8,
        tokens: 5000,
        content: largeContent,
        cachedAt: new Date().toISOString()
      }
    ]);

    const options = {
      baseDir: tempDir,
      maxTokens: 2000, // Much smaller than 10000 total
      maxContexts: 5
    };

    const result = await getRelevantContexts({ messages: [] }, options);

    // Both should be returned but with truncated content
    expect(result).toHaveLength(2);
    expect(result[0].content.length).toBeLessThan(largeContent.length);
    expect(result[1].content.length).toBeLessThan(largeContent.length);
    // Total tokens should be within maxTokens budget
    const totalTokens = result.reduce((sum, r) => sum + r.tokens, 0);
    // Allow some overhead but should be roughly within budget
    expect(totalTokens).toBeLessThanOrEqual(3000);
    // Should NOT have fallen through to scoring
    expect(scoreContextRelevance).not.toHaveBeenCalled();
  });

  it('should fall through to non-cached path when cache is empty', async () => {
    getCachedContexts.mockResolvedValue([]);

    const options = {
      baseDir: tempDir,
      maxTokens: 8000,
      maxContexts: 5
    };

    // Make sure there's at least the context-session dir with a session file
    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });

    const result = await getRelevantContexts({ messages: [] }, options);

    // When cache is empty, should fall through to scoring
    expect(getCachedContexts).toHaveBeenCalled();
    expect(result).toEqual([]); // No context files exist in the empty directory
  });
});
