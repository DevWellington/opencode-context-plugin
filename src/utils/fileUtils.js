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
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} label - Label for error message
 * @returns {Promise} Resolves or rejects with timeout error
 */
export function withTimeout(promise, ms, label = 'operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout(${ms}ms): ${label}`)), ms)
    )
  ]);
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
        // Recurse into subdirectories
        cleaned += await recoverOrphanedTempFiles(fullPath);
      } else if (entry.name.startsWith('.tmp-')) {
        // This is a temp file - check its age
        const stats = await fs.stat(fullPath);
        const age = now - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          // Temp file is older than 5 minutes - likely orphaned
          logger(`[recover] Removing orphaned temp file: ${fullPath} (age: ${Math.round(age / 1000)}s)`);
          await fs.unlink(fullPath);
          deletedFiles.push({ path: fullPath, age: Math.round(age / 1000) });
          cleaned++;
        }
      }
    }
  } catch (error) {
    // Directory might not exist yet
    if (error.code !== 'ENOENT') {
      logger(`[recover] Error scanning ${baseDir}: ${error.message}`);
    }
  }

  if (cleaned > 0) {
    logger(`[recover] Cleanup complete: deleted ${cleaned} file(s) - ${JSON.stringify(deletedFiles)}`);
  }

  return cleaned;
}
