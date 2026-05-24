/**
 * Search Indexer Module Tests
 * Tests for scanDirectory directory filtering
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock gray-matter
jest.unstable_mockModule('gray-matter', () => ({
  default: jest.fn(() => ({ data: {}, content: '' }))
}));

async function createTestDirStructure(baseDir) {
  const ctxDir = path.join(baseDir, '.opencode', 'context-session');
  const dateDir = path.join(ctxDir, '2026', '01', 'W01', '01');

  // Valid session files
  await fs.mkdir(dateDir, { recursive: true });
  await fs.writeFile(path.join(dateDir, 'exit-test-1.md'), '---\ntitle: Test\n---\n\nContent');
  await fs.writeFile(path.join(dateDir, 'compact-test-2.md'), '---\ntitle: Compact\n---\n\nCompact content');

  // Directories that should be skipped
  await fs.mkdir(path.join(ctxDir, '.index'), { recursive: true });
  await fs.writeFile(path.join(ctxDir, '.index', 'search-index.json'), '{"files": []}');

  await fs.mkdir(path.join(ctxDir, 'cache'), { recursive: true });
  await fs.writeFile(path.join(ctxDir, 'cache', 'cached-context-1.json'), '{"data": "cached"}');

  await fs.mkdir(path.join(ctxDir, 'reports'), { recursive: true });
  await fs.writeFile(path.join(ctxDir, 'reports', 'report-1.md'), '# Report\nContent');

  return baseDir;
}

const { buildSearchIndex } = await import('../src/modules/searchIndexer.js');

describe('searchIndexer - scanDirectory', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'search-indexer-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should skip .index, cache, and reports directories', async () => {
    await createTestDirStructure(tempDir);

    const index = await buildSearchIndex(tempDir);

    // Should only have the 2 valid session files, not the files in skipped dirs
    expect(index.files).toHaveLength(2);
    const fileNames = index.files.map(f => f.id);
    expect(fileNames).toContain('exit-test-1');
    expect(fileNames).toContain('compact-test-2');
    expect(fileNames).not.toContain('search-index');
    expect(fileNames).not.toContain('cached-context-1');
    expect(fileNames).not.toContain('report-1');
  });

  it('should include both exit- and compact- session files', async () => {
    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    const dateDir = path.join(ctxDir, '2026', '01', 'W01', '01');
    await fs.mkdir(dateDir, { recursive: true });
    await fs.writeFile(path.join(dateDir, 'exit-session-1.md'), '---\ntitle: Exit\n---\n\nExit content');
    await fs.writeFile(path.join(dateDir, 'compact-session-1.md'), '---\ntitle: Compact\n---\n\nCompact content');

    const index = await buildSearchIndex(tempDir);

    expect(index.files).toHaveLength(2);
    const fileNames = index.files.map(f => f.id);
    expect(fileNames).toContain('exit-session-1');
    expect(fileNames).toContain('compact-session-1');
  });

  it('should handle empty directory gracefully', async () => {
    const ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });

    const index = await buildSearchIndex(tempDir);

    expect(index.files).toEqual([]);
    expect(index.builtAt).toBeDefined();
  });
});
