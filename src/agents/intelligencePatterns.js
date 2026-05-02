import { isLowQualityPattern } from './reportExtractor.js';

/**
 * Issue patterns to detect from discoveries text (multilingual)
 */
export const ISSUE_PATTERNS = [
  /\b(não funciona|does not work|is broken|not working|broken)\b/i,
  /\b(bug|error|problema|issue)\b/i,
  /\b(causando|causing|caused by|causes)\b/i,
  /\b(fail(ed)?|failing|fails)\b/i,
  /\b(crash|crashed|crashing)\b/i,
  /\b(não funciona|corrompido| contaminat)\b/i,
  /\b(infinite loop|loop infinito)\b/i,
  /\b(truncat|garbage|residual)\b/i,
  /\b(duplicate|duplicat)\b/i
];

/**
 * Failed approach patterns from discoveries
 */
export const FAILED_APPROACH_PATTERNS = [
  { pattern: /\bhardcoded\s+path/i, antiPattern: 'Using hardcoded paths instead of dynamic paths', reason: 'Paths break when directory structure changes' },
  { pattern: /\bMath\.ceil\(getDate\(\)\/7\)/i, antiPattern: 'ISO week calculation using Math.ceil(getDate()/7)', reason: 'Incorrect week number for dates near month boundaries' },
  { pattern: /\bextractSectionFromContent\b/i, antiPattern: 'Calling extractSectionFromContent', reason: 'Function does not exist, should be extractSection' },
  { pattern: /\bdebounce.*module.*load/i, antiPattern: 'Debounce delay calculated at module load', reason: 'Config changes after module load are ignored' },
  { pattern: /\bduplicate.*extract/i, antiPattern: 'Duplicate extractSection definitions', reason: 'Inconsistent behavior when function is redefined' },
  { pattern: /\bemoji.*hardcoded/i, antiPattern: 'Emoji characters hardcoded in templates', reason: 'Emojis corrupt when aggregated across sessions' },
  { pattern: /\bwiki.*link.*contamination/i, antiPattern: 'Wiki-links with full path prefix', reason: 'Full paths leak into content instead of relative links' },
  { pattern: /\btruncat.*marker/i, antiPattern: 'Truncation markers in content aggregation', reason: 'Markers appear as literal text instead of being filtered' },
  { pattern: /\bzero.*padding/i, antiPattern: 'Month without zero-padding', reason: 'Path like 2026/4/ is invalid, should be 2026/04/' },
  { pattern: /\bno.*dedup/i, antiPattern: 'Missing deduplication on keywords', reason: 'Same keyword appears multiple times in report' }
];

export const LOW_QUALITY_ACCOMPLISHMENT_PATTERNS = [
  /^Phases?\s+\d+(\.\d+)*(-\d+(\.\d+)*)?/i,
  /^\d+\.\d+:\s*\w+/i,
  /^\s*07\.\d+:/i,
  /^(Su|Success|Successfully)/i,
  /^\.\.\./i,
  /^\(truncated\)/i
];

export function containsIssuePattern(text) {
  if (!text) return false;
  for (const pattern of ISSUE_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

export function isLowQualityAccomplishment(text) {
  if (!text) return true;
  const lower = text.toLowerCase();
  if (lower.length < 20) return true;
  if (LOW_QUALITY_ACCOMPLISHMENT_PATTERNS.some(p => p.test(text))) return true;
  if (containsIssuePattern(text)) return true;
  if (isLowQualityPattern(text)) return true;
  return false;
}