/**
 * Content Extractor Module — Barrel File
 * 
 * Re-exports all extraction functions from sub-modules for backward compatibility.
 * Sub-modules: sectionExtractor, bugExtractor, patternDetector, llmEnricher
 */

export {
  extractSessionContent,
  enrichWithRelatedSessions,
  extractCrossProjectLinks,
  classifySessionPriority
} from './extractors/sectionExtractor.js';

export {
  extractBugs,
  isValidBugSymptom
} from './extractors/bugExtractor.js';

export {
  inferMissingFields
} from './extractors/llmEnricher.js';

export {
  findPatterns,
  extractPersistentPatterns,
  normalizePattern,
  dedupePatterns,
  filterPinnedFromRecent
} from './extractors/patternDetector.js';
