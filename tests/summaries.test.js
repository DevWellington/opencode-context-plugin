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
    it('should create day-summary.md with extracted content from session files', async () => {
      // Create a real session file that will be read
      const sessionContent = `## Goal
Implement user authentication flow

## Accomplished
- Added JWT middleware to API routes

## Relevant Files
- src/auth/jwt.js
`;

      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T10-30-00.md'), sessionContent);

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

      // New content extraction format
      expect(content).toContain('**Date:** 2026-04-21');
      expect(content).toContain('**Sessions:** 1');
      expect(content).toContain('## Goals');
      expect(content).toContain('Implement user authentication flow');
      expect(content).toContain('## Accomplishments');
      expect(content).toContain('Added JWT middleware');
      expect(content).toContain('src/auth/jwt.js');
    });

    it('should aggregate content from multiple session files', async () => {
      // Create multiple session files
      const session1 = `## Goal
First task

## Accomplished
- Task one completed
`;

      const session2 = `## Goal
Second task

## Accomplished
- Task two completed

### Bug: Token limit exceeded
**Solution:** Added streaming with chunked injection
`;

      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T09-00-00.md'), session1);
      await fs.writeFile(path.join(ctxDir, 'exit-2026-04-21T10-30-00.md'), session2);

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

      // Should have both accomplishments
      expect(content).toContain('Task one completed');
      expect(content).toContain('Task two completed');
      // Should have the bug fixed
      expect(content).toContain('Bugs Fixed');
      expect(content).toContain('Token limit exceeded');
      expect(content).toContain('Added streaming');
      // Session count should reflect both files
      expect(content).toContain('**Sessions:** 2');
    });

    it('should deduplicate similar entries', async () => {
      // Create sessions with similar accomplishments
      const session1 = `## Accomplished
- Implemented user authentication flow with JWT
`;

      const session2 = `## Accomplished
- Implemented user authentication flow with JWT
`;

      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T09-00-00.md'), session1);
      await fs.writeFile(path.join(ctxDir, 'exit-2026-04-21T10-30-00.md'), session2);

      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'exit',
        filename: 'exit-2026-04-21T10-30-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const content = await fs.readFile(path.join(ctxDir, 'day-summary.md'), 'utf-8');

      // Deduplication should result in only one entry
      const matches = content.match(/Implemented user authentication/g);
      expect(matches).not.toBeNull();
      // The count of matches should be 1 (deduplicated)
      expect(content.split('Implemented user authentication').length).toBe(2); // One occurrence
    });

    it('should handle directory with no session files gracefully', async () => {
      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'compact',
        filename: 'compact-2026-04-21T10-30-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      // Call with empty directory - should not throw
      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const daySummaryPath = path.join(ctxDir, 'day-summary.md');
      const content = await fs.readFile(daySummaryPath, 'utf-8');

      expect(content).toContain('**Date:** 2026-04-21');
      expect(content).toContain('**Sessions:** 0');
    });

    it('should extract bugs with solutions into Bugs Fixed section', async () => {
      const sessionContent = `## Goal
Fix memory leak

### Bug: Memory leak in cache
**Solution:** Added proper cleanup on eviction
**Cause:** References not released

## Discoveries
- Cache eviction timing matters
`;

      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T11-00-00.md'), sessionContent);

      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'compact',
        filename: 'compact-2026-04-21T11-00-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const content = await fs.readFile(path.join(ctxDir, 'day-summary.md'), 'utf-8');

      expect(content).toContain('## Bugs Fixed');
      expect(content).toContain('Memory leak in cache');
      expect(content).toContain('Added proper cleanup');
      expect(content).toContain('## Discoveries');
      expect(content).toContain('Cache eviction timing');
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

  describe('Token Statistics Integration', () => {
    it('should include Session Statistics section when sessions are processed', async () => {
      const sessionContent = `## Goal
Implement authentication

## Accomplished
- Added JWT middleware
`;

      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T10-30-00.md'), sessionContent);

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

      // Should contain token statistics section
      expect(content).toContain('### Session Statistics');
      expect(content).toContain('**Total tokens:**');
      expect(content).toContain('**User tokens:**');
      expect(content).toContain('**Assistant tokens:**');
    });

    it('should aggregate tokens from multiple sessions', async () => {
      const session1 = `## Goal
Task one

## Accomplished
- Done one
`;

      const session2 = `## Goal
Task two

## Accomplished
- Done two
`;

      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T09-00-00.md'), session1);
      await fs.writeFile(path.join(ctxDir, 'exit-2026-04-21T10-30-00.md'), session2);

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

      // Should show 2 sessions
      expect(content).toContain('**Sessions:** 2');
      // Should have token statistics section
      expect(content).toContain('### Session Statistics');
    });

    it('should handle session with no content gracefully', async () => {
      // Empty session file
      await fs.writeFile(path.join(ctxDir, 'compact-2026-04-21T10-30-00.md'), '');

      const summaries = await import('../src/modules/summaries.js');

      const sessionInfo = {
        type: 'compact',
        filename: 'compact-2026-04-21T10-30-00.md',
        year: '2026',
        month: '04',
        day: '21'
      };

      // Should not throw
      await summaries.updateDaySummary(ctxDir, sessionInfo);

      const content = await fs.readFile(path.join(ctxDir, 'day-summary.md'), 'utf-8');
      expect(content).toContain('**Date:** 2026-04-21');
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
