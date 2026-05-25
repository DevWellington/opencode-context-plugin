/**
 * State persistence module for tracking summarized content
 * Enables resume after restart without re-processing same content
 * 
 * State file: .opencode/context-session/.state.json
 * 
 * Uses optimistic locking with version numbers to prevent race conditions
 * when multiple processes save state concurrently.
 */

import fs from 'fs/promises';
import path from 'path';
import { atomicWrite } from '../utils/fileUtils.js';
import { createDebugLogger } from '../utils/debug.js';
import { isExpectedFsError } from '../utils/errorUtils.js';

const logger = createDebugLogger('context-plugin');
const STATE_FILE = '.opencode/context-session/.state.json';
const STATE_VERSION = 2; // Bumped for optimistic locking
const MAX_LOCK_RETRIES = 3;
const fileLocks = new Map();

async function withFileLock(directory, fn) {
  if (!fileLocks.has(directory)) {
    fileLocks.set(directory, Promise.resolve());
  }
  const prev = fileLocks.get(directory);
  let nextResolve;
  fileLocks.set(directory, new Promise(r => { nextResolve = r; }));
  await prev;
  try {
    return await fn();
  } finally {
    nextResolve();
  }
}

/**
 * Create default state object
 * @returns {State}
 */
function createDefaultState() {
  return {
    version: STATE_VERSION,
    lastSummarized: {},
    pending: [],
    lastUpdated: new Date().toISOString(),
    sessionGuidanceShown: null
  };
}

/**
 * Load state from disk, returns default if not found
 * @param {string} baseDir - Project base directory
 * @returns {Promise<State>}
 */
export async function loadState(baseDir) {
  const statePath = path.join(baseDir, STATE_FILE);
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    const state = JSON.parse(content);
    logger(`[state] Loaded state from ${statePath} (version ${state.version})`);
    return state;
  } catch (err) {
    if (!isExpectedFsError(err)) {
      logger(`[state] Error reading state file: ${err.message}`);
    }
    return createDefaultState();
  }
}

/**
 * Save state to disk atomically with optimistic locking
 * @param {string} baseDir - Project base directory
 * @param {State} state - State to save
 * @param {number} expectedVersion - Expected version for optimistic lock (from loadState)
 */
export async function saveState(baseDir, state, expectedVersion = null) {
  const statePath = path.join(baseDir, STATE_FILE);

  let stateExists = true;
  let diskState = null;
  try {
    const content = await fs.readFile(statePath, 'utf-8');
    diskState = JSON.parse(content);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      stateExists = false;
      diskState = null;
    } else {
      throw error;
    }
  }

  const diskVersion = diskState?.version ?? 0;
  const expected = expectedVersion ?? state.version ?? diskVersion;

  if (stateExists && expectedVersion !== null && diskVersion !== expectedVersion) {
    throw new Error(`State conflict: expected version ${expectedVersion}, found ${diskVersion}`);
  }

  state.version = diskVersion + 1;
  state.lastUpdated = new Date().toISOString();

  await fs.mkdir(path.dirname(statePath), { recursive: true });

  await atomicWrite(statePath, JSON.stringify(state, null, 2));
  logger(`[state] Saved state to ${statePath} (version ${state.version})`);
}

/**
 * Get last summarized info for a key
 * @param {string} baseDir - Project base directory
 * @param {string} key - e.g., "today-2026-04-22", "week-2026-W17"
 * @returns {Promise<SummarizedInfo|null>}
 */
export async function getLastSummarized(baseDir, key) {
  const state = await loadState(baseDir);
  return state.lastSummarized[key] || null;
}

/**
 * Set last summarized info for a key
 * @param {string} baseDir - Project base directory
 * @param {string} key - e.g., "today-2026-04-22"
 * @param {SummarizedInfo} info - { timestamp, type, tokens, sessionsCount }
 */
export async function setLastSummarized(baseDir, key, info) {
  return withFileLock(baseDir, async () => {
    const state = await loadState(baseDir);
    state.lastSummarized[key] = {
      ...info,
      timestamp: Date.now()
    };
    try {
      await saveState(baseDir, state, state.version);
    } catch (error) {
      logger(`[state] Failed to save lastSummarized for "${key}": ${error.message}`);
    }
  });
}

/**
 * Get pending work queue
 * @param {string} baseDir - Project base directory
 * @returns {Promise<PendingItem[]>}
 */
export async function getPendingQueue(baseDir) {
  const state = await loadState(baseDir);
  return state.pending || [];
}

/**
 * Add item to pending work queue
 * @param {string} baseDir - Project base directory
 * @param {PendingItem} item - { type, key, path, addedAt }
 */
export async function addToPendingQueue(baseDir, item) {
  return withFileLock(baseDir, async () => {
    const state = await loadState(baseDir);
    const exists = state.pending.some(p => p.type === item.type && p.key === item.key);
    if (!exists) {
      state.pending.push({
        ...item,
        addedAt: Date.now()
      });
      try {
        await saveState(baseDir, state, state.version);
      } catch (error) {
        logger(`[state] Failed to save pending queue for "${item.key}": ${error.message}`);
      }
    }
  });
}

/**
 * Clear pending work queue
 * @param {string} baseDir - Project base directory
 * @param {string} type - Optional: clear only items of this type
 */
export async function clearPendingQueue(baseDir, type = null) {
  return withFileLock(baseDir, async () => {
    const state = await loadState(baseDir);
    if (type) {
      state.pending = state.pending.filter(p => p.type !== type);
    } else {
      state.pending = [];
    }
    try {
      await saveState(baseDir, state, state.version);
    } catch (error) {
      logger(`[state] Failed to clear pending queue: ${error.message}`);
    }
  });
}

/**
 * Mark a summary as complete (removes from pending, updates lastSummarized)
 * @param {string} baseDir - Project base directory
 * @param {string} key - Summary key
 * @param {SummarizedInfo} info - Summary info
 */
export async function markSummaryComplete(baseDir, key, info) {
  return withFileLock(baseDir, async () => {
    const state = await loadState(baseDir);
    
    // Remove from pending
    state.pending = state.pending.filter(p => p.key !== key);
    
    // Update lastSummarized
    state.lastSummarized[key] = {
      ...info,
      timestamp: Date.now()
    };
    
    try {
      await saveState(baseDir, state, state.version);
    } catch (error) {
      logger(`[state] Failed to mark summary "${key}" complete: ${error.message}`);
    }
  });
}

/**
 * Check if a summary needs regeneration based on state
 * @param {string} baseDir - Project base directory
 * @param {string} key - Summary key
 * @param {number} sessionTimestamp - Timestamp of new session to add
 * @returns {Promise<boolean>} - true if needs regeneration
 */
async function needsRegeneration(baseDir, key, sessionTimestamp) {
  const last = await getLastSummarized(baseDir, key);
  
  // No previous summary - needs regeneration
  if (!last) return true;
  
  // New session added after last summary
  if (sessionTimestamp > last.timestamp) return true;
  
  return false;
}

// STATE_VERSION kept as internal constant for optimistic locking
