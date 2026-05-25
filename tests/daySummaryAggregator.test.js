/**
 * Day Summary Aggregator Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const MOCK_CONFIG_DEFAULT = {
  debounceMs: 500,
  protected: { enabled: true, mode: 'session' },
};

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({ ...MOCK_CONFIG_DEFAULT })),
  CONTEXT_SESSION_DIR: '.opencode/context-session',
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn()),
}));

jest.unstable_mockModule('../src/modules/contentExtractor.js', () => ({
  extractSessionContent: jest.fn(() => ({
    goal: 'Extracted goal',
    accomplished: 'Extracted accomplished',
    discoveries: 'Extracted discovery',
    relevantFiles: ['src/extracted.js'],
  })),
  extractBugs: jest.fn(() => []),
  extractPersistentPatterns: jest.fn(() => []),
  normalizePattern: jest.fn((item) => item.toLowerCase().trim()),
}));

jest.unstable_mockModule('../src/utils/patternMatcher.js', () => ({
  isProtectedSession: jest.fn(() => false),
}));

jest.unstable_mockModule('../src/utils/summaryUtils.js', () => ({
  extractSection: jest.fn(() => ''),
}));

describe('daySummaryAggregator', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agg-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('readDaySessions', () => {
    it('should read session files and return structured data', async () => {
      await fs.writeFile(
        path.join(tempDir, 'compact-2026-04-21T10-30-00.md'),
        '## Goal\nTest goal\n\n## Accomplished\nDid stuff\n',
        'utf-8',
      );
      await fs.writeFile(
        path.join(tempDir, 'exit-2026-04-21T12-00-00.md'),
        '## Goal\nSecond task\n\n## Accomplished\nDone\n',
        'utf-8',
      );

      const { readDaySessions } = await import('../src/modules/daySummaryAggregator.js');
      const sessions = await readDaySessions(tempDir);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].filename).toMatch(/^(compact|exit)-/);
      expect(sessions[0]).toHaveProperty('content');
      expect(sessions[0]).toHaveProperty('extracted');
      expect(sessions[0]).toHaveProperty('bugs');
      expect(sessions[0]).toHaveProperty('path');
    });

    it('should skip summary files and non-session files', async () => {
      await fs.writeFile(path.join(tempDir, 'day-summary.md'), 'summary', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'random.txt'), 'text', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'compact-test.md'), '## Goal\nTest\n', 'utf-8');

      const { readDaySessions } = await import('../src/modules/daySummaryAggregator.js');
      const sessions = await readDaySessions(tempDir);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].filename).toBe('compact-test.md');
    });

    it('should return empty array for missing directory', async () => {
      const { readDaySessions } = await import('../src/modules/daySummaryAggregator.js');
      const sessions = await readDaySessions(path.join(tempDir, 'nonexistent'));
      expect(sessions).toEqual([]);
    });

    it('should handle unreadable files gracefully', async () => {
      await fs.writeFile(path.join(tempDir, 'compact-test.md'), '## Goal\nTest\n', 'utf-8');
      await fs.mkdir(path.join(tempDir, 'exit-baddir.md'));
      await fs.writeFile(path.join(tempDir, 'exit-good.md'), '## Goal\nWork\n', 'utf-8');

      const { readDaySessions } = await import('../src/modules/daySummaryAggregator.js');
      const sessions = await readDaySessions(tempDir);

      expect(sessions.length).toBeGreaterThanOrEqual(1);
      const files = sessions.map((s) => s.filename);
      expect(files).not.toContain('exit-baddir.md');
    });
  });

  describe('isDayFullyProtected', () => {
    it('should return false when protected config is disabled', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ protected: { enabled: false } });

      const { isDayFullyProtected } = await import('../src/modules/daySummaryAggregator.js');
      const result = await isDayFullyProtected(tempDir);
      expect(result).toBe(false);
    });

    it('should return false when mode is not session', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ protected: { enabled: true, mode: 'content' } });

      const { isDayFullyProtected } = await import('../src/modules/daySummaryAggregator.js');
      const result = await isDayFullyProtected(tempDir);
      expect(result).toBe(false);
    });

    it('should return true when all sessions are protected', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ protected: { enabled: true, mode: 'session' } });
      const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
      isProtectedSession.mockReturnValue(true);

      await fs.writeFile(
        path.join(tempDir, 'compact-2026-04-21T10-30-00.md'),
        '## Goal\nTest\n',
        'utf-8',
      );

      const { isDayFullyProtected } = await import('../src/modules/daySummaryAggregator.js');
      const result = await isDayFullyProtected(tempDir);
      expect(result).toBe(true);
    });

    it('should return false when some sessions are not protected', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ protected: { enabled: true, mode: 'session' } });
      const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
      isProtectedSession.mockReturnValue(false);

      await fs.writeFile(
        path.join(tempDir, 'compact-test.md'),
        '## Goal\nTest\n',
        'utf-8',
      );

      const { isDayFullyProtected } = await import('../src/modules/daySummaryAggregator.js');
      const result = await isDayFullyProtected(tempDir);
      expect(result).toBe(false);
    });

    it('should return false for empty directory', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ protected: { enabled: true, mode: 'session' } });

      const { isDayFullyProtected } = await import('../src/modules/daySummaryAggregator.js');
      const result = await isDayFullyProtected(tempDir);
      expect(result).toBe(false);
    });
  });

  describe('groupBy', () => {
    it('should group array of objects by key', async () => {
      const { groupBy } = await import('../src/modules/daySummaryAggregator.js');
      const items = [
        { type: 'A', name: 'foo' },
        { type: 'B', name: 'bar' },
        { type: 'A', name: 'baz' },
      ];
      const groups = groupBy(items, 'type');
      expect(groups).toEqual({
        A: [
          { type: 'A', name: 'foo' },
          { type: 'A', name: 'baz' },
        ],
        B: [{ type: 'B', name: 'bar' }],
      });
    });
  });

  describe('formatTypeName', () => {
    it('should map type keys to display names', async () => {
      const { formatTypeName } = await import('../src/modules/daySummaryAggregator.js');
      expect(formatTypeName('goal_theme')).toBe('Goal Themes');
      expect(formatTypeName('bug_pattern')).toBe('Bug Patterns');
      expect(formatTypeName('file_pattern')).toBe('File Patterns');
      expect(formatTypeName('command')).toBe('Commands');
      expect(formatTypeName('duration')).toBe('Session Durations');
      expect(formatTypeName('general')).toBe('Other Patterns');
    });

    it('should return the type key itself if no mapping exists', async () => {
      const { formatTypeName } = await import('../src/modules/daySummaryAggregator.js');
      expect(formatTypeName('unknown_type')).toBe('unknown_type');
    });
  });

  describe('synthesizeByTheme', () => {
    it('should cluster items by theme and count occurrences', async () => {
      const { synthesizeByTheme } = await import('../src/modules/daySummaryAggregator.js');
      const items = ['Bug fix in parser', 'Bug fix in config', 'Bug fix in parser', 'Added new feature'];
      const clusters = synthesizeByTheme(items);
      expect(clusters.length).toBeGreaterThanOrEqual(2);
      const bugCluster = clusters.find((c) => c.theme.includes('Bug'));
      expect(bugCluster).toBeDefined();
      expect(bugCluster.count).toBeGreaterThanOrEqual(1);
    });

    it('should limit examples to 2 per cluster', async () => {
      const { synthesizeByTheme } = await import('../src/modules/daySummaryAggregator.js');
      const items = Array(5).fill('Fix parser crash on null input');
      const clusters = synthesizeByTheme(items);
      const top = clusters[0];
      expect(top.examples.length).toBeLessThanOrEqual(2);
    });
  });

  describe('extractTheme', () => {
    it('should classify bug-fixing items', async () => {
      const { extractTheme } = await import('../src/modules/daySummaryAggregator.js');
      expect(extractTheme('Fix parser crash')).toBe('Bug fixes in parser');
      expect(extractTheme('Fix config loading')).toBe('Bug fixes in config');
      expect(extractTheme('Fix test assertion')).toBe('Test fixes');
      expect(extractTheme('Fix general issue')).toBe('Bug fixes');
    });

    it('should classify feature-addition items', async () => {
      const { extractTheme } = await import('../src/modules/daySummaryAggregator.js');
      expect(extractTheme('Add new test suite')).toBe('Tests added');
      expect(extractTheme('Implement new feature')).toBe('New features');
      expect(extractTheme('Create helper function')).toBe('New functions/methods');
      expect(extractTheme('Add new file for config')).toBe('New files created');
      expect(extractTheme('Implement something generic')).toBe('Implementation work');
    });

    it('should fallback to truncated item text for unrecognized content', async () => {
      const { extractTheme } = await import('../src/modules/daySummaryAggregator.js');
      const result = extractTheme('A long string that does not match any known theme keyword at all');
      expect(result.length).toBeLessThanOrEqual(43);
    });
  });

  describe('computeWeekHighlights', () => {
    it('should generate highlight strings from day summaries', async () => {
      const { computeWeekHighlights } = await import('../src/modules/daySummaryAggregator.js');
      const daySummaries = [
        { bugsFixed: ['bug1'], accomplishments: ['a1', 'a2'], discoveries: ['d1'], goals: ['g1'] },
        { bugsFixed: ['bug2'], accomplishments: ['a3', 'a4', 'a5'], discoveries: ['d2', 'd3'], goals: ['g2'] },
      ];
      const highlights = computeWeekHighlights(daySummaries);
      expect(highlights.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty highlights when no significant data', async () => {
      const { computeWeekHighlights } = await import('../src/modules/daySummaryAggregator.js');
      const daySummaries = [{ bugsFixed: [], accomplishments: [], discoveries: [], goals: [] }];
      const highlights = computeWeekHighlights(daySummaries);
      expect(highlights).toEqual([]);
    });

    it('should limit to 3 highlights', async () => {
      const { computeWeekHighlights } = await import('../src/modules/daySummaryAggregator.js');
      const daySummaries = [
        {
          bugsFixed: Array(10).fill('bug'),
          accomplishments: Array(10).fill('acc'),
          discoveries: Array(10).fill('disc'),
          goals: Array(10).fill('goal'),
        },
      ];
      const highlights = computeWeekHighlights(daySummaries);
      expect(highlights.length).toBeLessThanOrEqual(3);
    });
  });

  describe('dedupePatternsByKey', () => {
    it('should deduplicate items by normalized key', async () => {
      const { dedupePatternsByKey } = await import('../src/modules/daySummaryAggregator.js');
      const items = ['Fix parser crash', 'FIX PARSER CRASH', 'fix parser crash', 'Add new feature'];
      const result = dedupePatternsByKey(items);
      expect(result).toHaveLength(2);
    });
  });

  describe('getDebounceDelay', () => {
    it('should return default debounce delay when config value is 0', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ debounceMs: 0 });

      const { getDebounceDelay } = await import('../src/modules/daySummaryAggregator.js');
      expect(getDebounceDelay()).toBe(500);
    });

    it('should return value from config when set', async () => {
      const { getConfig } = await import('../src/config.js');
      getConfig.mockReturnValue({ debounceMs: 1000 });

      const { getDebounceDelay } = await import('../src/modules/daySummaryAggregator.js');
      expect(getDebounceDelay()).toBe(1000);
    });
  });

  describe('getPinnedPatternsSection', () => {
    it('should return empty string when intelligence file does not exist', async () => {
      const { getPinnedPatternsSection } = await import('../src/modules/daySummaryAggregator.js');
      const result = await getPinnedPatternsSection(tempDir);
      expect(result).toBe('');
    });

    it('should format pinned patterns when intelligence file exists', async () => {
      const sessionDir = path.join(tempDir, '.opencode', 'context-session');
      await fs.mkdir(sessionDir, { recursive: true });
      await fs.writeFile(path.join(sessionDir, 'intelligence-learning.md'), 'some content', 'utf-8');

      const { extractPersistentPatterns } = await import('../src/modules/contentExtractor.js');
      extractPersistentPatterns.mockReturnValue([
        { pinned: true, type: 'goal_theme', pattern: 'Authentication patterns' },
        { pinned: true, type: 'bug_pattern', pattern: 'Null pointer checks' },
        { pinned: false, type: 'general', pattern: 'Some pattern' },
      ]);

      const { getPinnedPatternsSection } = await import('../src/modules/daySummaryAggregator.js');
      const result = await getPinnedPatternsSection(tempDir);

      expect(result).toContain('## Pinned Patterns');
      expect(result).toContain('Authentication patterns');
      expect(result).toContain('Null pointer checks');
      expect(result).toContain('Goal Themes');
      expect(result).toContain('Bug Patterns');
      expect(result).not.toContain('Some pattern');
    });
  });
});
