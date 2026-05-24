/**
 * State Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { loadState, saveState } from '../src/modules/state.js';

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
});
