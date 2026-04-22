/**
 * State persistence module for tracking summarized content
 * Enables resume after restart without re-processing same content
 * 
 * State file: .opencode/context-session/.state.json
 */

import fs from 'fs/promises';
import path from 'path';
import { atomicWrite } from '../utils/fileUtils.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-plugin');
const STATE_FILE = '.opencode/context-session/.state.json';
const STATE_VERSION = 1;

/**
 * Create default state object
 * @returns {State}
 */
function createDefaultState() {
  return {
    version: STATE_VERSION,
    lastSummarized: {},
    pending: [],
    lastUpdated: new Date().toISOString()
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
    logger(`[state] Loaded state from ${statePath}`);
    return state;
  } catch {
    logger(`[state] No existing state, returning default`);
    return createDefaultState();
  }
}

/**
 * Save state to disk atomically
 * @param {string} baseDir - Project base directory
 * @param {State} state - State to save
 */
export async function saveState(baseDir, state) {
  const statePath = path.join(baseDir, STATE_FILE);
  state.lastUpdated = new Date().toISOString();
  await atomicWrite(statePath, JSON.stringify(state, null, 2));
  logger(`[state] Saved state to ${statePath}`);
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
  const state = await loadState(baseDir);
  state.lastSummarized[key] = {
    ...info,
    timestamp: Date.now()
  };
  await saveState(baseDir, state);
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
  const state = await loadState(baseDir);
  state.pending.push({
    ...item,
    addedAt: Date.now()
  });
  await saveState(baseDir, state);
}

/**
 * Clear pending work queue
 * @param {string} baseDir - Project base directory
 * @param {string} type - Optional: clear only items of this type
 */
export async function clearPendingQueue(baseDir, type = null) {
  const state = await loadState(baseDir);
  if (type) {
    state.pending = state.pending.filter(p => p.type !== type);
  } else {
    state.pending = [];
  }
  await saveState(baseDir, state);
}

/**
 * Mark a summary as complete (removes from pending, updates lastSummarized)
 * @param {string} baseDir - Project base directory
 * @param {string} key - Summary key
 * @param {SummarizedInfo} info - Summary info
 */
export async function markSummaryComplete(baseDir, key, info) {
  const state = await loadState(baseDir);
  
  // Remove from pending
  state.pending = state.pending.filter(p => p.key !== key);
  
  // Update lastSummarized
  state.lastSummarized[key] = {
    ...info,
    timestamp: Date.now()
  };
  
  await saveState(baseDir, state);
}

/**
 * Check if a summary needs regeneration based on state
 * @param {string} baseDir - Project base directory
 * @param {string} key - Summary key
 * @param {number} sessionTimestamp - Timestamp of new session to add
 * @returns {Promise<boolean>} - true if needs regeneration
 */
export async function needsRegeneration(baseDir, key, sessionTimestamp) {
  const last = await getLastSummarized(baseDir, key);
  
  // No previous summary - needs regeneration
  if (!last) return true;
  
  // New session added after last summary
  if (sessionTimestamp > last.timestamp) return true;
  
  return false;
}

/**
 * Export state version for compatibility checks
 */
export { STATE_VERSION };