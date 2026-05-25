/**
 * Context Injector Module Tests
 * Tests for cached context token budget application
 * GAP-04: Tests for injection contract (compact-* exclusion)
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ContextInjector - Cached Context Token Budget', () => {
  let tempDir;

  beforeEach(async () => {
    jest.resetModules();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-injector-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  it('should return cached contexts as-is when within maxTokens budget', async () => {
    // Mock dependencies with cache enabled
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

    const smallContent = 'x'.repeat(500);
    jest.unstable_mockModule('../src/modules/contextCache.js', () => ({
      getCachedContexts: jest.fn().mockResolvedValue([
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
      ]),
      isCacheValid: jest.fn().mockResolvedValue(true),
      saveToCache: jest.fn().mockResolvedValue(undefined)
    }));

    jest.unstable_mockModule('../src/modules/relevanceScoring.js', () => ({
      scoreContextRelevance: jest.fn().mockResolvedValue(0.5)
    }));

    const { getRelevantContexts } = await import('../src/modules/contextInjector.js');

    const options = {
      baseDir: tempDir,
      maxTokens: 8000,
      maxContexts: 5
    };

    const result = await getRelevantContexts({ messages: [] }, options);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe(smallContent);
    expect(result[1].content).toBe(smallContent);
  });

  it('should truncate cached contexts proportionally when they exceed maxTokens', async () => {
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

    const largeContent = 'y'.repeat(20000);
    jest.unstable_mockModule('../src/modules/contextCache.js', () => ({
      getCachedContexts: jest.fn().mockResolvedValue([
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
      ]),
      isCacheValid: jest.fn().mockResolvedValue(true),
      saveToCache: jest.fn().mockResolvedValue(undefined)
    }));

    jest.unstable_mockModule('../src/modules/relevanceScoring.js', () => ({
      scoreContextRelevance: jest.fn().mockResolvedValue(0.5)
    }));

    const { getRelevantContexts } = await import('../src/modules/contextInjector.js');

    const options = {
      baseDir: tempDir,
      maxTokens: 2000,
      maxContexts: 5
    };

    const result = await getRelevantContexts({ messages: [] }, options);

    expect(result).toHaveLength(2);
    expect(result[0].content.length).toBeLessThan(largeContent.length);
    expect(result[1].content.length).toBeLessThan(largeContent.length);
    const totalTokens = result.reduce((sum, r) => sum + r.tokens, 0);
    expect(totalTokens).toBeLessThanOrEqual(3000);
  });

  it('should fall through to non-cached path when cache is empty', async () => {
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

    const getCachedContextsMock = jest.fn().mockResolvedValue([]);
    jest.unstable_mockModule('../src/modules/contextCache.js', () => ({
      getCachedContexts: getCachedContextsMock,
      isCacheValid: jest.fn().mockResolvedValue(true),
      saveToCache: jest.fn().mockResolvedValue(undefined)
    }));

    jest.unstable_mockModule('../src/modules/relevanceScoring.js', () => ({
      scoreContextRelevance: jest.fn().mockResolvedValue(0.5)
    }));

    const { getRelevantContexts } = await import('../src/modules/contextInjector.js');

    const options = {
      baseDir: tempDir,
      maxTokens: 8000,
      maxContexts: 5
    };

    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });

    const result = await getRelevantContexts({ messages: [] }, options);

    expect(getCachedContextsMock).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

describe('ContextInjector - GAP-04: Injection Contract', () => {
  let tempDir;

  beforeEach(async () => {
    jest.resetModules();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'context-injector-contract-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  it('should ONLY include exit-* files, excluding compact-* files', async () => {
    // Mock with cache disabled to test file system behavior
    jest.unstable_mockModule('../src/config.js', () => ({
      getConfig: jest.fn(() => ({
        injection: {
          maxContexts: 5,
          maxTokens: 8000,
          cache: { enabled: false }
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

    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });

    await fs.writeFile(
      path.join(ctxDir, 'exit-2026-04-21T10-00-00.md'),
      '## Goal\nExit session 1\n## Summary\nComplete session'
    );
    await fs.writeFile(
      path.join(ctxDir, 'compact-2026-04-21T09-00-00.md'),
      '## Goal\nMid-session snapshot\n## Summary\nIncomplete work'
    );
    await fs.writeFile(
      path.join(ctxDir, 'exit-2026-04-21T08-00-00.md'),
      '## Goal\nExit session 2\n## Summary\nAnother complete session'
    );
    await fs.writeFile(
      path.join(ctxDir, 'compact-2026-04-21T07-00-00.md'),
      '## Goal\nAnother compact\n## Summary\nMore incomplete work'
    );

    const result = await getRelevantContexts({ messages: [] }, { baseDir: tempDir });

    expect(result).toHaveLength(2);
    const contextIds = result.map(r => r.context.id);
    expect(contextIds.every(id => id.startsWith('exit-'))).toBe(true);
    expect(contextIds.some(id => id.startsWith('compact-'))).toBe(false);
  });

  it('should return empty array when only compact-* files exist', async () => {
    jest.unstable_mockModule('../src/config.js', () => ({
      getConfig: jest.fn(() => ({
        injection: {
          maxContexts: 5,
          maxTokens: 8000,
          cache: { enabled: false }
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

    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });

    await fs.writeFile(
      path.join(ctxDir, 'compact-2026-04-21T10-00-00.md'),
      '## Goal\nCompact only\n## Summary\nNo exit files'
    );
    await fs.writeFile(
      path.join(ctxDir, 'compact-2026-04-21T09-00-00.md'),
      '## Goal\nAnother compact\n## Summary\nStill no exit'
    );

    const result = await getRelevantContexts({ messages: [] }, { baseDir: tempDir });

    expect(result).toEqual([]);
  });

  it('should document the injection contract: exit-* complete, compact-* incomplete', async () => {
    jest.unstable_mockModule('../src/config.js', () => ({
      getConfig: jest.fn(() => ({
        injection: {
          maxContexts: 5,
          maxTokens: 8000,
          cache: { enabled: false }
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

    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });

    const exitContent = '## Goal\nUser requested feature\n## Summary\nFeature implemented and tested\n## Outcome\nComplete';
    const compactContent = '## Goal\nUser requested feature\n## Summary\nWork in progress...\n## Outcome\n(Incomplete)';

    await fs.writeFile(path.join(ctxDir, 'exit-2026-04-21T10-00-00.md'), exitContent);
    await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T09-00-00.md'), compactContent);

    const result = await getRelevantContexts({ messages: [] }, { baseDir: tempDir });

    expect(result).toHaveLength(1);
    expect(result[0].context.id).toBe('exit-2026-04-21T10-00-00');
    expect(result[0].content).toContain('Complete');
  });
});
