import fs from "fs/promises";
import path from "path";
import { getConfig } from '../config.js';

// Export config key for external reference
export const DEBUG_KEY = 'debug';

const LOG_FILE = path.join(process.env.HOME || '', '.opencode-context-plugin.log');

/**
 * Create a namespaced debug logger that respects config.debug setting
 * @param {string} namespace - Identifier for the logger (e.g., 'context-plugin', 'intelligence')
 * @returns {function} Logger function that takes a message string
 */
export function createDebugLogger(namespace) {
  return function debugLogger(message) {
    // Check config.debug before logging
    const config = getConfig();
    if (!config.debug) {
      return;
    }
    
    // Debug logging is best-effort, don't block on errors
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${namespace}] ${message}`;
    
    fs.appendFile(LOG_FILE, formattedMessage + '\n').catch(() => {});
  };
}

// Backward compatible debugLog function (delegates to new system)
const defaultLogger = createDebugLogger('context-plugin');

/**
 * Backward-compatible debug log function
 * @deprecated Use createDebugLogger() for namespaced logging
 */
export function debugLog(message) {
  defaultLogger(message);
}
