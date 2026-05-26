import fs from 'fs/promises';
import path from 'path';
import { atomicWrite } from '../utils/fileUtils.js';
import { createDebugLogger } from '../utils/debug.js';
import { getHomeDir } from '../utils/homeDir.js';

const logger = createDebugLogger('sync-state');

// State file path - can be overridden for testing
let STATE_PATH = path.join(getHomeDir(), '.opencode', '.config', 'remote-state.json');

export function setStatePath(newPath) {
  STATE_PATH = newPath;
}

export function getStatePath() {
  return STATE_PATH;
}

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
    const syncStateBaseDir = path.dirname(STATE_PATH);
    await atomicWrite(STATE_PATH, JSON.stringify(state, null, 2), syncStateBaseDir);
    return true;
  } catch (error) {
    logger(`[sync-state] Failed to save state: ${error.message}`);
    return false;
  }
}

export function getDefaultSyncState() {
  return { ...defaultSyncState };
}