import fs from "fs/promises";
import path from "path";
import { CONTEXT_SESSION_DIR } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-plugin');

export { createDebugLogger, CONTEXT_SESSION_DIR };

/**
 * Atomic write using temp file + rename pattern for crash safety
 */
export async function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  logger(`[atomic-write] Starting: ${filePath}`);
  
  try {
    await fs.writeFile(tempFile, content, 'utf-8');
    logger(`[atomic-write] Temp file written: ${tempFile}`);
    await fs.rename(tempFile, filePath);
    logger(`[atomic-write] Rename completed: ${filePath}`);
  } catch (error) {
    logger(`[atomic-write] Error: ${error.message}, cleaning up temp file`);
    try {
      await fs.unlink(tempFile);
    } catch {}
    throw error;
  }
}

/**
 * Get ISO timestamp string for filenames
 */
export function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

/**
 * Wrap a promise with a timeout and optional abort signal
 * @param {Promise|Function} taskOrPromise - Promise to wrap OR function receiving { signal }
 * @param {number} ms - Timeout in milliseconds
 * @param {string|Object} labelOrOptions - Label string OR options object { signal, label }
 * @returns {Promise} Resolves or rejects with timeout/abort error
 */
export function withTimeout(taskOrPromise, ms, labelOrOptions = 'operation') {
  const options = typeof labelOrOptions === 'string'
    ? { label: labelOrOptions }
    : labelOrOptions;
  const { signal, label = 'operation' } = options;

  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  const internalController = new AbortController();

  let effectiveSignal;
  let onExternalAbortForCombined;
  let onInternalAbortForCombined;

  if (signal) {
    const controller = new AbortController();
    const combinedSignal = controller.signal;

    onExternalAbortForCombined = () => controller.abort();
    onInternalAbortForCombined = () => controller.abort();

    signal.addEventListener('abort', onExternalAbortForCombined, { once: true });
    internalController.signal.addEventListener('abort', onInternalAbortForCombined, { once: true });

    effectiveSignal = combinedSignal;
  } else {
    effectiveSignal = internalController.signal;
  }

  const task = typeof taskOrPromise === 'function'
    ? taskOrPromise({ signal: effectiveSignal })
    : taskOrPromise;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = setTimeout(() => {
      internalController.abort();
      const error = new Error(`Timeout after ${ms}ms: ${label}`);
      error.code = 'ETIMEDOUT';
      finalizeReject(error);
    }, ms);

    function cleanup() {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onExternalAbort);
        if (onExternalAbortForCombined) signal.removeEventListener('abort', onExternalAbortForCombined);
      }
      if (onInternalAbortForCombined) internalController.signal.removeEventListener('abort', onInternalAbortForCombined);
    }

    function finalizeResolve(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    function finalizeReject(err) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    }

    function onExternalAbort() {
      internalController.abort();
      finalizeReject(new DOMException('Aborted', 'AbortError'));
    }
    if (signal) {
      signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    task
      .then(result => finalizeResolve(result))
      .catch(err => finalizeReject(err));
  });
}

/**
 * Create an AbortController for cancellation support
 * @returns {AbortController}
 */
export function createAbortController() {
  return new AbortController();
}

/**
 * Find and remove orphaned temp files (.tmp-*) that were left behind
 * after crashes or failed writes. These are temp files that are older
 * than 1 hour and have no corresponding final file.
 */
export async function recoverOrphanedTempFiles(baseDir = CONTEXT_SESSION_DIR) {
  const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  let cleaned = 0;
  const deletedFiles = [];

  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);

      if (entry.isDirectory()) {
        cleaned += await recoverOrphanedTempFiles(fullPath);
      } else if (entry.name.startsWith('.tmp-')) {
        const stats = await fs.stat(fullPath);
        const age = now - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          logger(`[recover] Removing orphaned temp file: ${fullPath} (age: ${Math.round(age / 1000)}s)`);
          await fs.unlink(fullPath);
          deletedFiles.push({ path: fullPath, age: Math.round(age / 1000) });
          cleaned++;
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger(`[recover] Error scanning ${baseDir}: ${error.message}`);
    }
  }

  if (cleaned > 0) {
    logger(`[recover] Cleanup complete: deleted ${cleaned} file(s) - ${JSON.stringify(deletedFiles)}`);
  }

  return cleaned;
}