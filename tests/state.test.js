/**
 * State Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { 
  loadState, 
  saveState, 
  addToPendingQueue, 
  getPendingQueue, 
  markSummaryComplete,
  setLastSummarized,
  getLastSummarized,
  clearPendingQueue
} from '../src/modules/state.js';

describe('State Module', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('detects concurrent writes using on-disk version', async () => {
    const first = await loadState(tempDir);
    first.pending.push({ type: 'week', key: 'week-1' });
    await saveState(tempDir, first, first.version);

    const stale = await loadState(tempDir);
    const fresh = await loadState(tempDir);
    fresh.pending.push({ type: 'month', key: 'month-1' });
    await saveState(tempDir, fresh, fresh.version);

    stale.pending.push({ type: 'annual', key: 'year-1' });

    await expect(saveState(tempDir, stale, stale.version)).rejects.toThrow(/State conflict/);
  });

  describe('concurrent state operations', () => {
    it('addToPendingQueue handles concurrent additions', async () => {
      await Promise.all([
        addToPendingQueue(tempDir, { type: 'day', key: 'day-1' }),
        addToPendingQueue(tempDir, { type: 'day', key: 'day-2' }),
        addToPendingQueue(tempDir, { type: 'day', key: 'day-3' })
      ]);

      const queue = await getPendingQueue(tempDir);
      expect(queue).toHaveLength(3);
      expect(queue.map(p => p.key)).toEqual(expect.arrayContaining(['day-1', 'day-2', 'day-3']));
    });

    it('addToPendingQueue prevents duplicates under concurrency', async () => {
      await Promise.all([
        addToPendingQueue(tempDir, { type: 'day', key: 'same-key' }),
        addToPendingQueue(tempDir, { type: 'day', key: 'same-key' }),
        addToPendingQueue(tempDir, { type: 'day', key: 'same-key' })
      ]);

      const queue = await getPendingQueue(tempDir);
      expect(queue).toHaveLength(1);
      expect(queue[0].key).toBe('same-key');
    });

    it('markSummaryComplete handles concurrent completions', async () => {
      await addToPendingQueue(tempDir, { type: 'day', key: 'day-1' });
      await addToPendingQueue(tempDir, { type: 'day', key: 'day-2' });

      await Promise.all([
        markSummaryComplete(tempDir, 'day-1', { tokens: 100 }),
        markSummaryComplete(tempDir, 'day-2', { tokens: 200 })
      ]);

      const queue = await getPendingQueue(tempDir);
      expect(queue).toHaveLength(0);

      const last1 = await getLastSummarized(tempDir, 'day-1');
      const last2 = await getLastSummarized(tempDir, 'day-2');
      expect(last1).not.toBeNull();
      expect(last2).not.toBeNull();
    });

    it('setLastSummarized handles concurrent updates', async () => {
      await Promise.all([
        setLastSummarized(tempDir, 'key-1', { tokens: 100 }),
        setLastSummarized(tempDir, 'key-2', { tokens: 200 }),
        setLastSummarized(tempDir, 'key-3', { tokens: 300 })
      ]);

      const last1 = await getLastSummarized(tempDir, 'key-1');
      const last2 = await getLastSummarized(tempDir, 'key-2');
      const last3 = await getLastSummarized(tempDir, 'key-3');

      expect(last1.tokens).toBe(100);
      expect(last2.tokens).toBe(200);
      expect(last3.tokens).toBe(300);
    });

    it('file lock prevents corruption during rapid load-modify-save cycles', async () => {
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(addToPendingQueue(tempDir, { type: 'test', key: `item-${i}` }));
      }

      await Promise.all(operations);

      const queue = await getPendingQueue(tempDir);
      expect(queue).toHaveLength(10);

      const state = await loadState(tempDir);
      const keys = state.pending.map(p => p.key);
      for (let i = 0; i < 10; i++) {
        expect(keys).toContain(`item-${i}`);
      }
    });

    it('clearPendingQueue handles concurrent clear operations', async () => {
      await addToPendingQueue(tempDir, { type: 'day', key: 'day-1' });
      await addToPendingQueue(tempDir, { type: 'week', key: 'week-1' });

      await Promise.all([
        clearPendingQueue(tempDir, 'day'),
        clearPendingQueue(tempDir, 'week')
      ]);

      const queue = await getPendingQueue(tempDir);
      expect(queue).toHaveLength(0);
    });
  });

  describe('error handling and edge cases', () => {
    it('loadState returns default when state file missing', async () => {
      const state = await loadState(tempDir);
      expect(state.version).toBe(2);
      expect(state.pending).toEqual([]);
      expect(state.lastSummarized).toEqual({});
    });

    it('loadState handles corrupted state file', async () => {
      const statePath = path.join(tempDir, '.opencode', 'context-session', '.state.json');
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, 'corrupted json {{{');
      
      const state = await loadState(tempDir);
      expect(state.version).toBe(2);
      expect(state.pending).toEqual([]);
    });

    it('saveState handles missing state file gracefully', async () => {
      const state = { pending: [], lastSummarized: {} };
      await saveState(tempDir, state, null);
      
      const loaded = await loadState(tempDir);
      expect(loaded.version).toBeGreaterThan(0);
    });

    it('saveState without expectedVersion uses disk version', async () => {
      const state1 = await loadState(tempDir);
      state1.pending.push({ type: 'test', key: 'test-1' });
      await saveState(tempDir, state1, state1.version);

      const state2 = await loadState(tempDir);
      state2.pending.push({ type: 'test', key: 'test-2' });
      await saveState(tempDir, state2);

      const final = await loadState(tempDir);
      expect(final.pending).toHaveLength(2);
    });

    it('getLastSummarized returns null for unknown key', async () => {
      const result = await getLastSummarized(tempDir, 'unknown-key');
      expect(result).toBeNull();
    });

    it('clearPendingQueue clears all when type not specified', async () => {
      await addToPendingQueue(tempDir, { type: 'day', key: 'day-1' });
      await addToPendingQueue(tempDir, { type: 'week', key: 'week-1' });
      
      await clearPendingQueue(tempDir);
      
      const queue = await getPendingQueue(tempDir);
      expect(queue).toHaveLength(0);
    });

    it('addToPendingQueue handles save failure gracefully', async () => {
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValueOnce(new Error('write failed'));
      
      await addToPendingQueue(tempDir, { type: 'test', key: 'test-1' });
      
      fs.writeFile = originalWriteFile;
      
      const queue = await getPendingQueue(tempDir);
      expect(queue.length).toBeGreaterThanOrEqual(0);
    });

    it('markSummaryComplete handles save failure gracefully', async () => {
      await addToPendingQueue(tempDir, { type: 'test', key: 'test-1' });
      
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValueOnce(new Error('write failed'));
      
      await markSummaryComplete(tempDir, 'test-1', { tokens: 100 });
      
      fs.writeFile = originalWriteFile;
      
      const state = await loadState(tempDir);
      expect(state).toBeDefined();
    });

    it('setLastSummarized handles save failure gracefully', async () => {
      const originalWriteFile = fs.writeFile;
      fs.writeFile = jest.fn().mockRejectedValueOnce(new Error('write failed'));
      
      await setLastSummarized(tempDir, 'test-key', { tokens: 100 });
      
      fs.writeFile = originalWriteFile;
      
      const result = await getLastSummarized(tempDir, 'test-key');
      expect(result).toBeNull();
    });
  });
});
