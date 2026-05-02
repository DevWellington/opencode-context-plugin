import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { atomicWrite } from '../utils/fileUtils.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('sync-state');

const STATE_PATH = path.join(os.homedir(), '.opencode', '.config', 'remote-state.json');

const defaultSyncState = {
  configured: false,
  lastSync: null,
  pendingChanges: false,
  errors: []
};

export async function loadSyncState() {
  try {
    const content = await fs.readFile(STATE_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { ...defaultSyncState };
  }
}

export async function saveSyncState(state) {
  try {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await atomicWrite(STATE_PATH, JSON.stringify(state, null, 2));
    return true;
  } catch (error) {
    logger(`[sync-state] Failed to save state: ${error.message}`);
    return false;
  }
}

export function getDefaultSyncState() {
  return { ...defaultSyncState };
}