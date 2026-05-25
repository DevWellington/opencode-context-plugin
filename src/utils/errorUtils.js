/**
 * Error handling utilities for standardized error handling across modules
 * 
 * Policy:
 * 1. ENOENT expected - silent with mandatory comment
 * 2. Unexpected errors - log minimum: module, operation, error.message
 * 3. Fire-and-forget - .catch() with comment about non-criticality
 */

const loggedErrors = new Set();
const THROTTLE_MS = 60000;

/**
 * Reset the logged errors cache (for testing)
 */
export function resetThrottleCache() {
  loggedErrors.clear();
}

/**
 * Checks if an error is an expected filesystem error
 * @param {Error} err - The error to check
 * @param {string[]} expectedCodes - Expected error codes (default: ['ENOENT'])
 * @returns {boolean}
 */
export function isExpectedFsError(err, expectedCodes = ['ENOENT']) {
  if (!err || !err.code) return false;
  return expectedCodes.includes(err.code);
}

/**
 * Logs unexpected errors with context
 * @param {Error} err - The error
 * @param {string} module - Module name
 * @param {string} operation - Operation name
 * @param {Function} logger - Logger function
 * @param {string[]} expectedCodes - Expected error codes (default: ['ENOENT'])
 */
export function logUnexpectedError(err, module, operation, logger, expectedCodes = ['ENOENT']) {
  if (!isExpectedFsError(err, expectedCodes)) {
    logger(`[${module}] ${operation} failed: ${err.message}`);
  }
}

/**
 * Throttled logging to prevent noise from repeated errors
 * Logs only once per minute for the same error
 * @param {Error} err - The error
 * @param {string} module - Module name
 * @param {string} operation - Operation name
 * @param {Function} logger - Logger function
 * @param {string[]} expectedCodes - Expected error codes (default: ['ENOENT'])
 */
export function throttledLog(err, module, operation, logger, expectedCodes = ['ENOENT']) {
  if (isExpectedFsError(err, expectedCodes)) return;
  const key = `${module}:${operation}:${err.code || err.message}`;
  if (loggedErrors.has(key)) return;
  loggedErrors.add(key);
  logger(`[${module}] ${operation} failed: ${err.message}`);
  
  setTimeout(() => loggedErrors.delete(key), THROTTLE_MS).unref();
}

/**
 * Handle catch block with policy-compliant logging
 * @param {Error} err - The caught error
 * @param {string} module - Module name
 * @param {string} operation - Operation name
 * @param {Function} logger - Logger function (optional)
 * @param {string[]} expectedCodes - Expected error codes
 */
export function handleCatch(err, module, operation, logger = null, expectedCodes = ['ENOENT']) {
  if (isExpectedFsError(err, expectedCodes)) {
    return;
  }
  if (logger) {
    throttledLog(err, module, operation, logger);
  }
}