import fs from "fs/promises";
import path from "path";
import { getConfig } from '../config.js';

// Export config key for external reference
export const DEBUG_KEY = 'debug';

// Log directory and file names
const LOG_DIR = path.join(process.env.HOME || '', '.opencode-context-plugin', 'logs');
const LOG_FILE_BASE = 'debug.log';
const LOG_FILE = path.join(LOG_DIR, LOG_FILE_BASE);

/**
 * Ensure log directory exists (best-effort)
 */
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch {}
}

/**
 * Format date for archive naming (ISO format without colons)
 * @param {Date} date
 * @returns {string} YYYY-MM-DD-HH-mm-ss
 */
function formatArchiveTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Get list of archive files (debug-YYYY-MM-DD-HH-mm-ss.log) sorted by name
 * @returns {Promise<string[]>}
 */
async function getArchiveFiles() {
  try {
    const files = await fs.readdir(LOG_DIR);
    return files
      .filter(f => f.startsWith('debug-') && f.endsWith('.log'))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Rotate log file if it exceeds the configured max size
 * Best-effort: errors are silently ignored
 */
export async function rotateLogIfNeeded() {
  const config = getConfig();
  const rotationConfig = config.logRotation || { enabled: true, maxSizeBytes: 10 * 1024 * 1024, maxFiles: 5 };

  if (!rotationConfig.enabled) {
    return;
  }

  try {
    // Ensure log directory exists
    await ensureLogDir();

    // Check if log file exists and get its size
    let fileSize = 0;
    try {
      const stats = await fs.stat(LOG_FILE);
      fileSize = stats.size;
    } catch {
      // File doesn't exist yet, no rotation needed
      return;
    }

    // Check if rotation is needed
    if (fileSize <= rotationConfig.maxSizeBytes) {
      return;
    }

    // Get archive files
    const archives = await getArchiveFiles();

    // Delete oldest archives if maxFiles exceeded
    while (archives.length >= rotationConfig.maxFiles) {
      const oldest = archives.shift();
      try {
        await fs.unlink(path.join(LOG_DIR, oldest));
      } catch {}
    }

    // Rename current log to timestamped archive
    const timestamp = formatArchiveTimestamp(new Date());
    const archiveName = `debug-${timestamp}.log`;
    const archivePath = path.join(LOG_DIR, archiveName);

    try {
      await fs.rename(LOG_FILE, archivePath);
    } catch {
      // If rename fails (e.g., file in use), try copy+delete
      try {
        await fs.copyFile(LOG_FILE, archivePath);
        await fs.unlink(LOG_FILE);
      } catch {}
    }

    // Create fresh log file
    await fs.writeFile(LOG_FILE, '');
  } catch {
    // Best-effort: silently ignore any errors during rotation
  }
}

/**
 * Create a namespaced debug logger that respects config.debug setting
 * @param {string} namespace - Identifier for the logger (e.g., 'context-plugin', 'intelligence')
 * @returns {function} Logger function that takes a message string
 */
export function createDebugLogger(namespace) {
  return async function debugLogger(message) {
    // Check config.debug before logging
    const config = getConfig();
    if (!config.debug) {
      return;
    }

    // Debug logging is best-effort, don't block on errors
    try {
      // Check and perform rotation if needed
      await rotateLogIfNeeded();

      const timestamp = new Date().toISOString();
      const formattedMessage = `[${timestamp}] [${namespace}] ${message}`;

      await fs.appendFile(LOG_FILE, formattedMessage + '\n');
    } catch {}
  };
}

// Backward compatible debugLog function (delegates to new system)
// Note: debugLog is synchronous for backward compatibility
const defaultLogger = createDebugLogger('context-plugin');

/**
 * Backward-compatible debug log function
 * @deprecated Use createDebugLogger() for namespaced logging
 */
export function debugLog(message) {
  // Fire and forget - best-effort async logging
  defaultLogger(message).catch(() => {});
}
