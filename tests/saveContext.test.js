/**
 * SaveContext Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock dependencies
jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({ debug: false, debounceMs: 500 })),
  CONTEXT_SESSION_DIR: '.opencode/context-session'
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn()),
  DEBUG_KEY: 'debug'
}));

jest.unstable_mockModule('../src/utils/fileUtils.js', () => ({
  atomicWrite: jest.fn(),
  getTimestamp: jest.fn(() => '2026-04-21T10-30-00'),
  recoverOrphanedTempFiles: jest.fn().mockResolvedValue(0),
  withTimeout: jest.fn((p) => p)
}));

jest.unstable_mockModule('../src/modules/summaries.js', () => ({
  updateDaySummary: jest.fn().mockResolvedValue(undefined),
  updateWeekSummary: jest.fn().mockResolvedValue(undefined),
  shouldRegenerate: jest.fn().mockReturnValue({ shouldRegenerate: true, savingsPercent: 100, changePercent: 100 }),
  hasNewSessions: jest.fn().mockReturnValue(true)
}));

jest.unstable_mockModule('../src/agents/generateToday.js', () => ({
  generateTodaySummary: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../src/agents/generateMonthly.js', () => ({
  generateMonthlySummary: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../src/agents/generateAnnual.js', () => ({
  generateAnnualSummary: jest.fn().mockResolvedValue(undefined)
}));

jest.unstable_mockModule('../src/agents/generateIntelligenceLearning.js', () => ({
  updateIntelligenceLearning: jest.fn().mockResolvedValue({ success: true, entries: 1 })
}));

jest.unstable_mockModule('../src/modules/state.js', () => ({
  setLastSummarized: jest.fn().mockResolvedValue(undefined),
  addToPendingQueue: jest.fn().mockResolvedValue(undefined),
  getLastSummarized: jest.fn().mockResolvedValue(null),
  markSummaryComplete: jest.fn().mockResolvedValue(undefined)
}));

const { extractSessionSummary, saveContext, ensureHierarchicalDir } = await import('../src/modules/saveContext.js');
const { atomicWrite } = await import('../src/utils/fileUtils.js');
const summaries = await import('../src/modules/summaries.js');
const intelligence = await import('../src/agents/generateIntelligenceLearning.js');
const monthly = await import('../src/agents/generateMonthly.js');
const annual = await import('../src/agents/generateAnnual.js');
const today = await import('../src/agents/generateToday.js');

describe('SaveContext Module', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'savecontext-test-'));
    // Create .opencode directory structure
    await fs.mkdir(path.join(tempDir, '.opencode'), { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('extractSessionSummary(session)', () => {
    it('should extract correct fields from session object', () => {
      const session = {
        id: 'test-id-123',
        slug: 'test-session',
        title: 'Test Session Title',
        messages: [
          { id: 'msg-1', role: 'user', type: 'text', content: 'Hello' },
          { id: 'msg-2', role: 'assistant', type: 'text', content: 'Hi there' }
        ]
      };

      const summary = extractSessionSummary(session);

      expect(summary.sessionId).toBe('test-id-123');
      expect(summary.slug).toBe('test-session');
      expect(summary.title).toBe('Test Session Title');
      expect(summary.messageCount).toBe(2);
      expect(summary.messages).toHaveLength(2);
      expect(summary.messages[0]).toEqual({
        index: 0,
        role: 'user',
        type: 'text',
        content: 'Hello'
      });
    });

    it('should handle session with sessionID (alternative field name)', () => {
      const session = {
        sessionID: 'alt-session-id',
        slug: 'alt-slug',
        title: 'Alt Title',
        messages: []
      };

      const summary = extractSessionSummary(session);

      expect(summary.sessionId).toBe('alt-session-id');
    });

    it('should handle null/undefined session gracefully', () => {
      expect(extractSessionSummary(null)).toBeNull();
      expect(extractSessionSummary(undefined)).toBeNull();
    });

    it('should handle session with no messages array', () => {
      const session = {
        id: 'no-messages',
        slug: 'test'
      };

      const summary = extractSessionSummary(session);

      expect(summary.messageCount).toBe(0);
      expect(summary.messages).toEqual([]);
    });

    it('should map message indices correctly', () => {
      const session = {
        id: 'test',
        messages: [
          { role: 'first', content: 'content1' },
          { role: 'second', content: 'content2' },
          { role: 'third', content: 'content3' }
        ]
      };

      const summary = extractSessionSummary(session);

      expect(summary.messages[0].index).toBe(0);
      expect(summary.messages[1].index).toBe(1);
      expect(summary.messages[2].index).toBe(2);
    });
  });

  describe('saveContext(directory, session, type)', () => {
    it('should create correct directory hierarchy', async () => {
      const session = {
        id: 'test-session',
        slug: 'test',
        title: 'Test',
        messages: [{ id: '1', role: 'user', content: 'test' }]
      };

      atomicWrite.mockResolvedValue(undefined);

      await saveContext(tempDir, session, 'compact');

      // Verify hierarchical dir was created - use current day/week since ensureHierarchicalDir uses new Date()
      const now = new Date();
      const currentDay = String(now.getDate()).padStart(2, '0');
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const { getWeek } = await import('date-fns');
      const weekNum = getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 });
      const currentWeek = `W${String(weekNum).padStart(2, '0')}`;
      const ctxDir = path.join(tempDir, '.opencode', 'context-session');
      expect(await fs.access(path.join(ctxDir, String(now.getFullYear()), currentMonth, currentWeek, currentDay)).then(() => true).catch(() => false)).toBe(true);
    });

    it('should write atomic file with correct filename format', async () => {
      const session = {
        id: 'test-session',
        slug: 'test',
        title: 'Test',
        messages: [{ id: '1', role: 'user', content: 'test' }]
      };

      atomicWrite.mockResolvedValue(undefined);

      await saveContext(tempDir, session, 'compact');

      // Verify atomicWrite was called with correct filepath pattern
      const callArgs = atomicWrite.mock.calls[0];
      const filepath = callArgs[0];
      expect(filepath).toMatch(/compact-2026-04-21T10-30-00\.md$/);
    });

    it('should truncate messages longer than 5000 chars', async () => {
      const longContent = 'x'.repeat(5500);
      const session = {
        id: 'test-session',
        slug: 'test',
        title: 'Test',
        messages: [{ id: '1', role: 'user', content: longContent }]
      };

      let savedContent = '';
      atomicWrite.mockImplementation(async (filepath, content) => {
        savedContent = content;
      });

      await saveContext(tempDir, session, 'compact');

      // Check that content in the saved file has been truncated
      expect(savedContent).not.toContain('x'.repeat(5500));
      expect(savedContent.length).toBeLessThan(longContent.length + 500); // Truncated + metadata
      expect(savedContent).toContain('[...truncated');
    });

    it('should call updateDailySummary after saving', async () => {
      const session = {
        id: 'test-session',
        slug: 'test',
        title: 'Test',
        messages: [{ id: '1', role: 'user', content: 'test' }]
      };

      atomicWrite.mockResolvedValue(undefined);

      await saveContext(tempDir, session, 'compact');

      expect(today.generateTodaySummary).toHaveBeenCalledWith(tempDir);
      expect(monthly.generateMonthlySummary).toHaveBeenCalled();
      expect(annual.generateAnnualSummary).toHaveBeenCalled();
      // updateIntelligenceLearning auto-update removed - use @ocp-generate-intelligence-learning manually
    });

    it('should return filepath on success', async () => {
      const session = {
        id: 'success-session',
        slug: 'test',
        title: 'Success Test',
        messages: []
      };

      atomicWrite.mockResolvedValue(undefined);

      const result = await saveContext(tempDir, session, 'compact');

      expect(result).toMatch(/.*\.opencode\/context-session\/.*\/compact-.*\.md$/);
    });

    it('should return null on failure', async () => {
      atomicWrite.mockRejectedValue(new Error('Write failed'));

      const result = await saveContext(tempDir, {}, 'compact');

      expect(result).toBeNull();
    });
  });

  describe('chat log detection', () => {
    it('should append chat log note when content has no user-authored sections', async () => {
      const session = {
        id: 'chat-log-session',
        slug: 'chat-log',
        title: 'Chat Log Only',
        messages: [
          { id: '1', role: 'user', content: 'Hello' },
          { id: '2', role: 'assistant', content: 'Hi there' }
        ]
      };

      let savedContent = '';
      atomicWrite.mockImplementation(async (filepath, content) => {
        savedContent = content;
      });

      await saveContext(tempDir, session, 'compact');

      // Should include the chat log note since there's no ## Goal section
      expect(savedContent).toContain('This session appears to be a chat log');
    });

    it('should NOT append chat log note when content has ## Goal section', async () => {
      const session = {
        id: 'goal-session',
        slug: 'goal-session',
        title: 'Has Goal',
        messages: [
          { id: '1', role: 'user', content: '## Goal\n\nFix the login bug' },
          { id: '2', role: 'assistant', content: 'Here is the fix...' }
        ]
      };

      let savedContent = '';
      atomicWrite.mockImplementation(async (filepath, content) => {
        savedContent = content;
      });

      await saveContext(tempDir, session, 'compact');

      // Should NOT include the chat log note since ## Goal is present
      expect(savedContent).not.toContain('appears to be a chat log');
    });

    it('existing behavior unchanged - should truncate messages longer than 5000 chars', async () => {
      const longContent = 'x'.repeat(5500);
      const session = {
        id: 'truncation-check',
        slug: 'trunc',
        title: 'Truncation Check',
        messages: [{ id: '1', role: 'user', content: longContent }]
      };

      let savedContent = '';
      atomicWrite.mockImplementation(async (filepath, content) => {
        savedContent = content;
      });

      await saveContext(tempDir, session, 'compact');

      expect(savedContent).not.toContain('x'.repeat(5500));
      expect(savedContent).toContain('[...truncated');
    });
  });

  describe('ensureHierarchicalDir(baseDir)', () => {
    it('should return path components', async () => {
      const result = await ensureHierarchicalDir(tempDir);

      expect(result).toHaveProperty('dirPath');
      expect(result).toHaveProperty('year');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('week');
      expect(result).toHaveProperty('day');
      expect(result.year).toBe(2026);
    });
  });
});
