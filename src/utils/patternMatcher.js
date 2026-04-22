import { getConfig } from '../config.js';

/**
 * Check if a string matches any protected pattern
 * Supports both glob patterns (fnmatch) and regex patterns
 * 
 * @param {string} content - Content to check (file path, session name, etc.)
 * @param {Array} patterns - Array of patterns (glob or regex strings)
 * @returns {boolean} True if content matches any pattern
 */
export function matchesAnyPattern(content, patterns) {
  if (!content || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }

  for (const pattern of patterns) {
    if (matchesPattern(content, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if content matches a single pattern
 * @param {string} content - Content to check
 * @param {string} pattern - Pattern (glob or regex)
 * @returns {boolean}
 */
export function matchesPattern(content, pattern) {
  if (!content || !pattern) return false;

  // If pattern starts with ^, it's a regex pattern
  if (pattern.startsWith('^')) {
    try {
      const regex = new RegExp(pattern);
      return regex.test(content);
    } catch {
      return content.includes(pattern);
    }
  }

  // If pattern contains glob characters (* or ?), treat as glob pattern
  const isGlob = /[*?]/.test(pattern);
  
  if (isGlob) {
    return globMatch(content, pattern);
  }

  // Otherwise treat as literal substring match
  return content.includes(pattern);
}

/**
 * Simple glob pattern matching
 * Supports: ** (any dirs), * (any chars), ? (single char)
 * 
 * @param {string} str - String to match
 * @param {string} glob - Glob pattern
 * @returns {boolean}
 */
function globMatch(str, glob) {
  // Convert glob to regex step by step
  // Step 1: Escape regex special chars except * and ?
  let regexStr = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  
  // Step 2: Replace ** with a placeholder that won't be affected by * replacement
  regexStr = regexStr.replace(/\*\*/g, '\x00STARSTAR\x00');
  
  // Step 3: Replace * (single) with regex pattern (any chars except /)
  regexStr = regexStr.replace(/\*/g, '[^/]*');
  
  // Step 4: Replace ? with single char regex (except /)
  regexStr = regexStr.replace(/\?/g, '[^/]');
  
  // Step 5: Replace the ** placeholder with .* (any chars including /)
  regexStr = regexStr.replace(/\x00STARSTAR\x00/g, '.*');

  try {
    const regex = new RegExp('^' + regexStr + '$');
    return regex.test(str);
  } catch {
    // Fallback to simple string match
    return str.includes(glob);
  }
}

/**
 * Check if a session should be protected based on session info
 * Used to skip entire sessions from summary processing
 * 
 * @param {Object} sessionInfo - Session info object { filename, path, type }
 * @returns {boolean} True if session is protected
 */
export function isProtectedSession(sessionInfo) {
  if (!sessionInfo) return false;
  
  const { filename, path, type } = sessionInfo;
  const config = getConfig();
  
  if (!config.protected?.enabled) {
    return false;
  }

  // Check session name patterns (exit-protected-*, compact-protected-*)
  const patterns = config.protected.patterns || [];
  if (patterns.length === 0) {
    return false;
  }

  // Mode check: 'content' mode doesn't protect entire sessions
  if (config.protected.mode === 'content') {
    return false;
  }

  // For 'session' mode, check if filename matches
  return matchesAnyPattern(filename, patterns) || 
         matchesAnyPattern(path, patterns);
}

/**
 * Check if content (goal, accomplishment, etc.) is protected
 * Used to filter individual items during aggregation
 * 
 * @param {string} content - Text content to check
 * @returns {boolean} True if content is protected
 */
export function isProtectedContent(content) {
  if (!content || typeof content !== 'string') return false;
  
  const config = getConfig();
  
  if (!config.protected?.enabled) {
    return false;
  }

  const patterns = config.protected.patterns || [];
  if (patterns.length === 0) {
    return false;
  }

  // In 'session' mode, content is not individually protected
  if (config.protected.mode === 'session') {
    return false;
  }

  // For 'content' mode, check if content matches any pattern
  return matchesAnyPattern(content, patterns);
}

/**
 * Combined check for summary generation
 * Returns { skipSession: boolean, skipContent: boolean }
 * 
 * @param {Object} sessionInfo - Session info object
 * @param {string} content - Optional content to check (for content mode)
 * @returns {Object} { skipSession, skipContent }
 */
export function getProtectionStatus(sessionInfo, content = null) {
  const skipSession = isProtectedSession(sessionInfo);
  
  let skipContent = false;
  if (content && !skipSession) {
    skipContent = isProtectedContent(content);
  }
  
  return { skipSession, skipContent };
}

/**
 * Convenience function: check if something is protected
 * Auto-detects whether it's session info or content string
 * 
 * @param {string|Object} item - Session info object or content string
 * @returns {boolean} True if protected
 */
export function isProtected(item) {
  if (!item) return false;
  
  // If it's an object with filename/path, treat as session
  if (typeof item === 'object' && (item.filename || item.path)) {
    return isProtectedSession(item);
  }
  
  // Otherwise treat as content string
  return isProtectedContent(String(item));
}

/**
 * Check if a file/path should be protected based on config
 * 
 * @param {string} filePath - Full file path to check
 * @param {string} fileName - Just the filename (for session name matching)
 * @returns {boolean} True if protected
 */
export function isProtectedPath(filePath, fileName) {
  const config = getConfig();
  
  if (!config.protected?.enabled) {
    return false;
  }

  const patterns = config.protected.patterns || [];
  if (patterns.length === 0) {
    return false;
  }

  // Check both full path and just filename
  return matchesAnyPattern(filePath, patterns) || 
         matchesAnyPattern(fileName, patterns);
}

// Re-export useful content extractor functions for convenience
export { normalizePattern, dedupePatterns } from '../modules/contentExtractor.js';