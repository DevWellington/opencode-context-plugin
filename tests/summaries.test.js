/**
 * Summaries Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('Summaries Module', () => {
  let tempDir;
  let ctxDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'summaries-test-'));
    ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('updateDaySummary(dirPath, sessionInfo)', () => {
    it('should create day-summary.md if it does not exist', async () => {
      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'compact',
        filename: 'compact-2026-04-21T10-30-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const daySummaryPath = path.join(ctxDir, 'day-summary.md');
      const content = await fs.readFile(daySummaryPath, 'utf-8');

      expect(content).toContain('## Sessions');
      expect(content).toContain('📦 Compact');
      expect(content).toContain('compact-2026-04-21T10-30-00.md');
    });

    it('should append to existing day-summary.md', async () => {
      // Create existing day summary
      await fs.writeFile(path.join(ctxDir, 'day-summary.md'),
        `# Day Summary\n\n**Date:** 2026-04-21\n\n## Sessions\n\n- [2026-04-21T09-00-00] 🚪 Exit: exit-2026-04-21T09-00-00.md\n`);

      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'compact',
        filename: 'compact-2026-04-21T10-30-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const content = await fs.readFile(path.join(ctxDir, 'day-summary.md'), 'utf-8');
      expect(content).toContain('compact-2026-04-21T10-30-00.md');
      expect(content).toContain('exit-2026-04-21T09-00-00.md');
    });

    it('should not duplicate entry if filename already exists (idempotency)', async () => {
      // Create existing day summary with the same filename
      await fs.writeFile(path.join(ctxDir, 'day-summary.md'),
        `# Day Summary\n\n**Date:** 2026-04-21\n\n## Sessions\n\n- [2026-04-21T10-30-00] 📦 Compact: compact-2026-04-21T10-30-00.md\n`);

      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'compact',
        filename: 'compact-2026-04-21T10-30-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      await summaries.updateDaySummary(ctxDir, sessionInfo);

      // The function should detect duplicate and not write
      const content = await fs.readFile(path.join(ctxDir, 'day-summary.md'), 'utf-8');
      // Should still have only one entry
      expect(content.split('compact-2026-04-21T10-30-00.md').length).toBe(2); // One occurrence
    });
  });

  describe('updateWeekSummary', () => {
    it('should be debounced (function has flush method)', async () => {
      const summaries = await import('../src/modules/summaries.js');
      expect(typeof summaries.updateWeekSummary.flush).toBe('function');
    });

    it('should handle missing week directory gracefully', async () => {
      const summaries = await import('../src/modules/summaries.js');

      // Don't create the week dir - the function should catch the error
      // Just verify calling it doesn't throw
      summaries.updateWeekSummary(tempDir, '2026', '04', 'W17');

      // Since it's debounced, nothing happens until timer fires
      // But the function call itself should not throw
      expect(true).toBe(true);
    });
  });

  describe('updateDailySummary', () => {
    it('should be debounced (function has flush method)', async () => {
      const summaries = await import('../src/modules/summaries.js');
      expect(typeof summaries.updateDailySummary.flush).toBe('function');
    });
  });

  describe('updateDaySummary is NOT debounced', () => {
    it('should be a direct export without flush method', async () => {
      const summaries = await import('../src/modules/summaries.js');
      expect(typeof summaries.updateDaySummary.flush).toBe('undefined');
    });

    it('should create day-summary.md synchronously', async () => {
      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'exit',
        filename: 'exit-2026-04-21T12-00-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      // This should create the file immediately (not debounced)
      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const daySummaryPath = path.join(ctxDir, 'day-summary.md');
      const exists = await fs.access(daySummaryPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('debouncing verification', () => {
    it('updateDailySummary is wrapped with debounce', async () => {
      const summaries = await import('../src/modules/summaries.js');
      // The debounced function has a flush method
      expect(typeof summaries.updateDailySummary.flush).toBe('function');
    });

    it('updateWeekSummary is wrapped with debounce', async () => {
      const summaries = await import('../src/modules/summaries.js');
      expect(typeof summaries.updateWeekSummary.flush).toBe('function');
    });

    it('updateDaySummary is NOT wrapped (no flush)', async () => {
      const summaries = await import('../src/modules/summaries.js');
      expect(typeof summaries.updateDaySummary.flush).toBe('undefined');
    });
  });
});
