import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

jest.unstable_mockModule('../../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn())
}));

jest.unstable_mockModule('../../src/modules/summaries.js', () => ({
  shouldRegenerate: jest.fn().mockResolvedValue(true)
}));

function getTodayDir(baseDir) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return path.join(baseDir, '.opencode', 'context-session', String(year), month, 'W01', day);
}

describe('Report Agents', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-agents-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('generateTodaySummary', () => {
    it('should generate summary with session files', async () => {
      const sessionDir = getTodayDir(tempDir);
      await fs.mkdir(sessionDir, { recursive: true });
      await fs.writeFile(
        path.join(sessionDir, 'exit-2026-05-25T10-00-00.md'),
        '## Goal\nTest goal\n\n## Accomplished\nTest accomplishment\n'
      );

      const { generateTodaySummary } = await import('../../src/agents/generateToday.js');
      const result = await generateTodaySummary(tempDir);
      expect(typeof result).toBe('string');
    });

    it('should return content even without sessions', async () => {
      const { generateTodaySummary } = await import('../../src/agents/generateToday.js');
      const result = await generateTodaySummary(tempDir);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateWeeklySummary', () => {
    it('should generate weekly summary', async () => {
      const ctxDir = path.join(tempDir, '.opencode/context-session');
      await fs.mkdir(ctxDir, { recursive: true });

      const { generateWeeklySummary } = await import('../../src/agents/generateWeekly.js');
      const result = await generateWeeklySummary(tempDir, '2026-05-25');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateMonthlySummary', () => {
    it('should generate monthly summary', async () => {
      const { generateMonthlySummary } = await import('../../src/agents/generateMonthly.js');
      const result = await generateMonthlySummary(tempDir, '2026-05');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('generateAnnualSummary', () => {
    it('should generate annual summary', async () => {
      const { generateAnnualSummary } = await import('../../src/agents/generateAnnual.js');
      const result = await generateAnnualSummary(tempDir, 2026);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
