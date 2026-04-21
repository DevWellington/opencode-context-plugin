import fs from "fs/promises";
import path from "path";
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('context-plugin');

export { createDebugLogger };

// Constants
const CONTEXT_SESSION_DIR = '.opencode/context-session';

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
