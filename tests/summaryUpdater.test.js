/**
 * Summary Updater Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

// --- Module mocks ---

jest.unstable_mockModule('../src/utils/debounce.js', () => ({
  debounce: jest.fn(fn => {
    function wrapped(...args) { return fn(...args); }
    wrapped.flush = function (...args) { return fn(...args); };
    return wrapped;
  })
}));

const mockFormatDayContent = jest.fn();
jest.unstable_mockModule('../src/modules/daySummaryFormatter.js', () => ({
  formatDayContent: mockFormatDayContent
}));

const mockReadDaySessions = jest.fn();
const mockIsDayFullyProtected = jest.fn(() => false);
const mockSynthesizeByTheme = jest.fn(() => []);
const mockComputeWeekHighlights = jest.fn(() => []);
const mockGetPinnedPatternsSection = jest.fn(() => '');
const mockDedupePatternsByKey = jest.fn(arr => arr);
jest.unstable_mockModule('../src/modules/daySummaryAggregator.js', () => ({
  readDaySessions: mockReadDaySessions,
  isDayFullyProtected: mockIsDayFullyProtected,
  synthesizeByTheme: mockSynthesizeByTheme,
  computeWeekHighlights: mockComputeWeekHighlights,
  getPinnedPatternsSection: mockGetPinnedPatternsSection,
  dedupePatternsByKey: mockDedupePatternsByKey,
  groupBy: jest.fn(),
  formatTypeName: jest.fn(s => s),
  extractTheme: jest.fn(() => 'theme')
}));

jest.unstable_mockModule('../src/modules/contentExtractor.js', () => ({
  extractSessionContent: jest.fn(() => ({})),
  extractBugs: jest.fn(() => []),
  extractPersistentPatterns: jest.fn(() => []),
  normalizePattern: jest.fn(s => s),
  dedupePatterns: jest.fn(arr => arr)
}));

jest.unstable_mockModule('../src/utils/patternMatcher.js', () => ({
  isProtectedSession: jest.fn(() => false),
  isProtectedContent: jest.fn(() => false),
  matchesAnyPattern: jest.fn(() => false),
  getProtectionStatus: jest.fn(() => 'unprotected')
}));

const mockLogger = jest.fn();
jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => mockLogger)
}));

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({ debounceMs: 100, projectName: 'test-project' })),
  CONTEXT_SESSION_DIR: '.opencode/context-session',
  LOG_FILE: '/tmp/test-opencode-context-plugin.log'
}));

const mockExtractSection = jest.fn(() => []);
jest.unstable_mockModule('../src/utils/summaryUtils.js', () => ({
  extractSection: mockExtractSection
}));

const { updateDaySummary, updateWeekSummary, updateDailySummary } = await import('../src/modules/summaryUpdater.js');

describe('updateDaySummary', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'summary-day-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should create day-summary.md with correct content', async () => {
    const sessionsData = [
      { filename: 'exit-test.md', content: '## Goal\nTest', extracted: { goal: 'Test' }, bugs: [] }
    ];
    mockReadDaySessions.mockResolvedValue(sessionsData);
    mockFormatDayContent.mockReturnValue('# Day Summary\n\n**Date:** 2026-04-21\n\nTest content');

    await updateDaySummary(tempDir, {
      year: '2026', month: '04', day: '21', type: 'exit', filename: 'exit-test.md'
    });

    const content = await fs.readFile(path.join(tempDir, 'day-summary.md'), 'utf-8');
    expect(content).toBe('# Day Summary\n\n**Date:** 2026-04-21\n\nTest content');
  });

  it('should handle readDaySessions error gracefully', async () => {
    mockReadDaySessions.mockRejectedValue(new Error('ENOENT: directory not found'));

    await updateDaySummary(tempDir, {
      year: '2026', month: '04', day: '21', type: 'exit', filename: 'test.md'
    });

    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Error updating day summary'));

    const exists = await fs.access(path.join(tempDir, 'day-summary.md'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('should call formatDayContent with correct arguments', async () => {
    const sessionsData = [
      { filename: 'exit-a.md', content: '## Goal\nA', extracted: { goal: 'A' }, bugs: [] },
      { filename: 'compact-b.md', content: '## Goal\nB', extracted: { goal: 'B' }, bugs: [] }
    ];
    mockReadDaySessions.mockResolvedValue(sessionsData);
    mockFormatDayContent.mockReturnValue('');

    await updateDaySummary(tempDir, {
      year: '2026', month: '04', day: '21', type: 'exit', filename: 'exit-test.md'
    });

    expect(mockReadDaySessions).toHaveBeenCalledWith(tempDir);
    expect(mockFormatDayContent).toHaveBeenCalledWith(
      '2026-04-21',
      sessionsData,
      '2026',
      '04',
      undefined,
      '## Goal\nA\n## Goal\nB'
    );
  });
});

describe('updateWeekSummary', () => {
  let tempDir;
  let weekDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'summary-week-'));
    weekDir = path.join(tempDir, '.opencode', 'context-session', '2026', '04', 'W17');
    await fs.mkdir(weekDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should create week-summary.md with aggregated structure', async () => {
    const dayDir1 = path.join(weekDir, '20');
    const dayDir2 = path.join(weekDir, '21');
    await fs.mkdir(dayDir1, { recursive: true });
    await fs.mkdir(dayDir2, { recursive: true });
    await fs.writeFile(path.join(dayDir1, 'day-summary.md'), '# Day 20\n\nContent for day 20');
    await fs.writeFile(path.join(dayDir2, 'day-summary.md'), '# Day 21\n\nContent for day 21');

    await updateWeekSummary(tempDir, '2026', '04', 'W17');

    const content = await fs.readFile(path.join(weekDir, 'week-summary.md'), 'utf-8');
    expect(content).toContain('# Week W17 Summary');
    expect(content).toContain('**Period:** 2026-04');
    expect(content).toContain('**Week:** W17');
    expect(content).toContain('**Total Sessions:** 0');
    expect(content).toContain('## Day-by-Day Summary');
    expect(content).toContain('### Day 20');
    expect(content).toContain('### Day 21');
    expect(content).toContain('[[2026/04/W17/20/day-summary.md]]');
    expect(content).toContain('[[2026/04/W17/21/day-summary.md]]');
    expect(content).toContain('*Aggregated from 2 day summaries*');
  });

  it('should handle empty week directory (no day subdirectories)', async () => {
    await updateWeekSummary(tempDir, '2026', '04', 'W17');

    const content = await fs.readFile(path.join(weekDir, 'week-summary.md'), 'utf-8');
    expect(content).toContain('# Week W17 Summary');
    expect(content).toContain('**Total Sessions:** 0');
    expect(content).toContain('*Aggregated from 0 day summaries*');
  });

  it('should handle missing week directory gracefully', async () => {
    await updateWeekSummary(tempDir, '2026', '04', 'W99');

    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('Error reading week directory'));

    const weekPath = path.join(tempDir, '.opencode', 'context-session', '2026', '04', 'W99');
    const exists = await fs.access(path.join(weekPath, 'week-summary.md'))
      .then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});

describe('updateDailySummary', () => {
  let tempDir;
  let ctxSessionDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-21T12:00:00Z'));
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'summary-daily-'));
    ctxSessionDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxSessionDir, { recursive: true });
  });

  afterEach(async () => {
    jest.useRealTimers();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should create daily-summary.md with header and entry for exit type', async () => {
    await updateDailySummary(tempDir, {
      type: 'exit',
      timestamp: '2026-04-21T10:30:00',
      filename: 'exit-test-session.md'
    });

    const content = await fs.readFile(path.join(ctxSessionDir, 'daily-summary.md'), 'utf-8');
    expect(content).toContain('# Daily Summary');
    expect(content).toContain('## 2026-04-21');
    expect(content).toContain('**Total Sessions:** 1');
    expect(content).toContain('**Compacts:** 0 | **Exits:** 1');
    expect(content).toContain('- [2026-04-21T10:30:00] 🚪 Exit: exit-test-session.md');
  });

  it('should mark compact type sessions correctly', async () => {
    await updateDailySummary(tempDir, {
      type: 'compact',
      timestamp: '2026-04-21T09:00:00',
      filename: 'compact-api-work.md'
    });

    const content = await fs.readFile(path.join(ctxSessionDir, 'daily-summary.md'), 'utf-8');
    expect(content).toContain('**Total Sessions:** 1');
    expect(content).toContain('**Compacts:** 1 | **Exits:** 0');
    expect(content).toContain('📦 Compact');
    expect(content).toContain('compact-api-work.md');
  });

  it('should deduplicate entries by filename', async () => {
    const sessionInfo = {
      type: 'exit',
      timestamp: '2026-04-21T10:30:00',
      filename: 'exit-test-session.md'
    };

    await updateDailySummary(tempDir, sessionInfo);
    await updateDailySummary(tempDir, sessionInfo);

    const content = await fs.readFile(path.join(ctxSessionDir, 'daily-summary.md'), 'utf-8');
    const matches = content.match(/exit-test-session\.md/g);
    expect(matches).toHaveLength(1);
    expect(content).toContain('**Total Sessions:** 1');
  });

  it('should aggregate multiple entries with mixed types', async () => {
    await updateDailySummary(tempDir, {
      type: 'exit', timestamp: '2026-04-21T09:00:00', filename: 'exit-morning.md'
    });
    await updateDailySummary(tempDir, {
      type: 'compact', timestamp: '2026-04-21T10:30:00', filename: 'compact-noon.md'
    });
    await updateDailySummary(tempDir, {
      type: 'exit', timestamp: '2026-04-21T14:00:00', filename: 'exit-afternoon.md'
    });

    const content = await fs.readFile(path.join(ctxSessionDir, 'daily-summary.md'), 'utf-8');
    expect(content).toContain('**Total Sessions:** 3');
    expect(content).toContain('**Compacts:** 1 | **Exits:** 2');
    expect(content).toContain('exit-morning.md');
    expect(content).toContain('compact-noon.md');
    expect(content).toContain('exit-afternoon.md');
  });

  it('should start fresh when date changes between calls', async () => {
    await updateDailySummary(tempDir, {
      type: 'exit', timestamp: '2026-04-21T23:00:00', filename: 'exit-late.md'
    });

    jest.setSystemTime(new Date('2026-04-22T10:00:00Z'));

    await updateDailySummary(tempDir, {
      type: 'compact', timestamp: '2026-04-22T10:00:00', filename: 'compact-new-day.md'
    });

    const content = await fs.readFile(path.join(ctxSessionDir, 'daily-summary.md'), 'utf-8');
    expect(content).toContain('## 2026-04-22');
    expect(content).toContain('compact-new-day.md');
    expect(content).not.toContain('exit-late.md');
  });
});
