import { createDebugLogger } from '../../utils/debug.js';
import { extractSessionContent } from './sectionExtractor.js';
import { extractBugs } from './bugExtractor.js';

const logger = createDebugLogger('content-extractor');

/**
 * Semantic theme definitions for meaningful work pattern detection
 * Each theme has a name, specific phrases that indicate the theme,
 * and example topics for documentation.
 */
const SEMANTIC_THEMES = [
  {
    name: 'startup optimization',
    phrases: ['lazy initialization', 'deferred loading', 'async initialization', 'module-level init', 'slow startup', 'constructor initialization'],
    exampleTopics: 'Improving plugin startup time'
  },
  {
    name: 'LLM integration',
    phrases: ['llm client', 'infer missing fields', 'context plugin', 'mechanical extraction', 'clientsessionsprompt', 'openai client', 'ai inference'],
    exampleTopics: 'Integrating LLM capabilities'
  },
  {
    name: 'context learning',
    phrases: ['context learning', 'extract persistent patterns', 'intelligence learning', 'pattern detection', 'learn from sessions'],
    exampleTopics: 'Learning from session history'
  },
  {
    name: 'plugin hook registration',
    phrases: ['hook registration', 'register hook', 'hook system', 'lifecycle hook', 'plugin hook', 'before/after hook'],
    exampleTopics: 'Plugin hook infrastructure'
  },
  {
    name: 'token counting',
    phrases: ['token counting', 'count tokens', 'countSessionTokens', 'token limit', 'context length', 'max tokens'],
    exampleTopics: 'Managing context window limits'
  },
  {
    name: 'memory management',
    phrases: ['memory leak', 'cache invalidation', 'weak reference', 'memory pressure', 'gc optimization', 'object pooling'],
    exampleTopics: 'Memory optimization and leak prevention'
  },
  {
    name: 'dead code detection',
    phrases: ['dead code', 'unused code', 'unreachable code', 'code analysis', 'static analysis', 'unused export'],
    exampleTopics: 'Identifying and removing unused code'
  },
  {
    name: 'session deduplication',
    phrases: ['session deduplication', 'dedupe sessions', 'duplicate session', 'merge sessions', 'session merge'],
    exampleTopics: 'Preventing duplicate session entries'
  },
  {
    name: 'keyword link generation',
    phrases: ['keyword link', 'cross reference', 'related session', 'session link', 'cross-project link', 'link generation'],
    exampleTopics: 'Generating links between related sessions'
  },
  {
    name: 'error handling improvement',
    phrases: ['error handling', 'exception handling', 'try-catch', 'error recovery', 'graceful degradation', 'fallback mechanism'],
    exampleTopics: 'Improving error resilience'
  },
  {
    name: 'API client wrapper',
    phrases: ['api client', 'http client', 'fetch wrapper', 'axios instance', 'request builder', 'api abstraction'],
    exampleTopics: 'Abstracting external API calls'
  },
  {
    name: 'data serialization',
    phrases: ['serialize', 'deserialize', 'json parsing', 'parse json', 'serialization format', 'data marshalling'],
    exampleTopics: 'Converting data between formats'
  },
  {
    name: 'configuration management',
    phrases: ['config management', 'settings persistence', 'user preferences', 'config file', 'environment config', 'dotenv'],
    exampleTopics: 'Managing application configuration'
  },
  {
    name: 'logging and debugging',
    phrases: ['debug logger', 'debug mode', 'verbose logging', 'log level', 'trace execution', 'console debug'],
    exampleTopics: 'Diagnostic and debugging utilities'
  },
  {
    name: 'file system operations',
    phrases: ['file watcher', 'directory scan', 'path resolution', 'file glob', 'fs operations', 'watch directory'],
    exampleTopics: 'File and directory handling'
  },
  {
    name: 'prompt engineering',
    phrases: ['prompt template', 'system prompt', 'user prompt', 'prompt injection', 'prompt optimization', 'chat template'],
    exampleTopics: 'Crafting effective LLM prompts'
  },
  {
    name: 'context window management',
    phrases: ['context window', 'truncate context', 'context overflow', 'trim history', 'prune context', 'context limit'],
    exampleTopics: 'Managing LLM context constraints'
  },
  {
    name: 'state management',
    phrases: ['state machine', 'state management', 'store state', 'persist state', 'application state', 'state reducer'],
    exampleTopics: 'Managing application state'
  },
  {
    name: 'batch processing',
    phrases: ['batch processing', 'bulk operation', 'batch operation', 'parallel processing', 'concurrent tasks', 'worker queue'],
    exampleTopics: 'Processing multiple items efficiently'
  },
  {
    name: 'session context extraction',
    phrases: ['extract context', 'parse session', 'session parsing', 'content extraction', 'structured data', 'parse markdown'],
    exampleTopics: 'Extracting structured data from sessions'
  }
];

/**
 * Find recurring semantic themes in text array
 * Uses phrase-based matching instead of single keywords
 * 
 * @param {Array} textsWithIds - Array of {text, id} objects
 * @param {string} patternType - Type prefix for patterns
 */
function findRecurringThemes(textsWithIds, patternType) {
  const themeMap = new Map();

  // Initialize theme map with semantic themes
  for (const theme of SEMANTIC_THEMES) {
    const themeKey = patternType + ': ' + theme.name;
    themeMap.set(theme.name, {
      pattern: themeKey,
      sessions: [],
      frequency: 0,
      themeName: theme.name
    });
  }

  for (const { text, id } of textsWithIds) {
    if (!text) continue;

    const lowerText = text.toLowerCase();
    const matchedThemes = new Set(); // Track themes matched in this session

    // Check each semantic theme
    for (const theme of SEMANTIC_THEMES) {
      // Skip if this session already matched this theme
      if (matchedThemes.has(theme.name)) continue;

      // Check if any phrase for this theme matches
      for (const phrase of theme.phrases) {
        if (lowerText.includes(phrase.toLowerCase())) {
          // Mark this theme as matched for this session
          matchedThemes.add(theme.name);
          
          const entry = themeMap.get(theme.name);
          entry.sessions.push(id);
          entry.frequency++;
          break; // Only count once per session
        }
      }
    }
  }

  // Filter to themes appearing in at least 2 sessions, sort by frequency
  let results = Array.from(themeMap.values())
    .filter(t => t.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency);

  // ALWAYS run keyword fallback to find additional organic patterns
  // This supplements SEMANTIC_THEMES, doesn't replace them
  const stopWords = new Set(['the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'to', 'of', 'and', 'in', 'for', 'on', 'with', 'that', 'this', 'it', 'its', 'as', 'at', 'by', 'from', 'or', 'if', 'when', 'while', 'then', 'so', 'but', 'not', 'can', 'will', 'just', 'have', 'has', 'had', 'do', 'does', 'did', 'would', 'could', 'should', 'may', 'might', 'must', 'about', 'into', 'out', 'up', 'down', 'over', 'under', 'again', 'more', 'most', 'some', 'any', 'all', 'each', 'few', 'many', 'other', 'such', 'no', 'nor', 'only', 'own', 'same', 'than', 'too', 'very', 's', 't', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'these', 'those', 'am', 'let', 'get', 'got', 'been', 'session', 'user', 'wants', 'summary', 'conversation', 'context', 'goal', 'message', 'assistant', 'file', 'files', 'project', 'code', 'plugin', 'opencode', 'using', 'used', 'create', 'created', 'make', 'made', 'add', 'added', 'update', 'updated', 'remove', 'removed', 'fix', 'fixed', 'change', 'changed', 'check', 'see', 'need', 'needs', 'look', 'looking', 'find', 'found', 'help', 'try', 'start', 'work', 'works', 'working', 'run', 'running', 'give', 'given', 'tell', 'told', 'ask', 'asked', 'want', 'like', 'take', 'took', 'know', 'think', 'thought', 'right', 'left', 'good', 'great', 'well', 'way', 'ways', 'new', 'now', 'here', 'there', 'come', 'came', 'go', 'went', 'say', 'said', 'use', 'using', 'thanks', 'thank', 'please', 'sorry', 'something', 'anything', 'everything', 'nothing', 'someone', 'anyone', 'everyone', 'done', 'doing', 'able', 'also', 'back', 'even', 'still', 'enough', 'first', 'last', 'next', 'best', 'better', 'sure', 'real', 'really', 'maybe', 'perhaps', 'probably', 'actually', 'basically', 'simply', 'exactly', 'already', 'yet', 'ever', 'never', 'always', 'sometimes', 'often', 'usually', 'likely', 'unlikely', 'possible', 'impossible', 'necessary', 'worse', 'important', 'easy', 'hard', 'long', 'short', 'big', 'small', 'old', 'young', 'high', 'low', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool', 'dark', 'light', 'bright', 'weak', 'strong', 'loud', 'quiet', 'clean', 'dirty', 'dry', 'wet', 'deep', 'shallow', 'full', 'empty', 'heavy', 'light', 'rich', 'poor', 'safe', 'dangerous', 'healthy', 'sick', 'alive', 'dead', 'open', 'closed', 'true', 'false', 'different', 'similar', 'natural', 'artificial', 'free', 'expensive', 'cheap', 'quiet', 'noisy', 'simple', 'complex', 'clear', 'confusing', 'direct', 'indirect', 'positive', 'negative', 'active', 'passive', 'correct', 'incorrect', 'early', 'late', 'modern', 'traditional', 'internal', 'external', 'public', 'private', 'formal', 'informal', 'special', 'general', 'temporary', 'permanent', 'curious', 'indifferent', 'optimistic', 'pessimistic', 'objective', 'subjective', 'logical', 'illogical', 'reasonable', 'unreasonable', 'responsible', 'irresponsible', 'efficient', 'inefficient', 'sufficient', 'insufficient', 'necessary', 'unnecessary', 'sufficient', 'acceptable', 'unacceptable', 'appropriate', 'inappropriate', 'significant', 'insignificant', 'obvious', 'subtle', 'minor', 'major', 'primary', 'secondary', 'basic', 'advanced', 'standard', 'nonstandard', 'normal', 'abnormal', 'regular', 'irregular', 'consistent', 'inconsistent', 'dependent', 'independent', 'relative', 'absolute', 'complete', 'incomplete', 'perfect', 'imperfect', 'strong', 'weak', 'violent', 'peaceful', '\u7c97\u7cd9', '\u7cbe\u7ec6', '\u5feb\u901f', '\u7f13\u6162', '\u7b80\u5355', '\u590d\u6742', '\u6e05\u695a', '\u6a21\u7cca', '\u7a33\u5b9a', '\u4e0d\u7a33\u5b9a', '\u6709\u6548', '\u65e0\u6548', '\u4e00\u81f4', '\u4e0d\u4e00\u81f4', '\u5168\u9762', '\u7247\u9762', '\u7cfb\u7edf', '\u96f6\u6563', '\u4e3b\u52a8', '\u88ab\u52a8', '\u8ba1\u5212', '\u968f\u673a', '\u5f00\u6e90', '\u95ed\u6e90', '\u540c\u6b65', '\u5f02\u6b65', '\u96c6\u4e2d', '\u5206\u6563', '\u8fd9\u4e2a', '\u90a3\u4e2a', '\u4ec0\u4e48', '\u600e\u4e48', '\u4e3a\u4ec0\u4e48', '\u54ea\u91cc', '\u8c01', '\u4f55\u65f6', '\u662f\u5426', '\u867d\u7136', '\u4f46\u662f', '\u800c\u4e14', '\u6216\u8005', '\u56e0\u4e3a', '\u6240\u4ee5', '\u5982\u679c', '\u867d\u7136', 'test', 'tests', 'testing', 'tested', 'revisar', 'revisando', 'revisado', 'tudo', 'todas', 'todos', 'todo', 'toda', 'very', 'also', 'too', 'only', 'just', 'even']);

  // Count single words, 2-word phrases, and 3-word phrases
  const phraseCount = new Map();
  const matchedSemanticThemes = new Set(results.map(r => r.themeName));
  for (const { text, id } of textsWithIds) {
    if (!text) continue;
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    
    // Count single words (3+ chars)
    for (const word of words) {
      if (matchedSemanticThemes.has(word)) continue;
      if (!phraseCount.has(word)) phraseCount.set(word, { count: 0, sessions: new Set() });
      phraseCount.get(word).count++;
      phraseCount.get(word).sessions.add(id);
    }
    
    // Count 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      const phrase2 = words.slice(i, i + 2).join(' ');
      if (matchedSemanticThemes.has(phrase2) || matchedSemanticThemes.has(phrase2.split(' ')[0])) continue;
      if (!phraseCount.has(phrase2)) phraseCount.set(phrase2, { count: 0, sessions: new Set() });
      phraseCount.get(phrase2).count++;
      phraseCount.get(phrase2).sessions.add(id);
    }
    
    // Count 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
      const phrase3 = words.slice(i, i + 3).join(' ');
      if (matchedSemanticThemes.has(phrase3)) continue;
      if (!phraseCount.has(phrase3)) phraseCount.set(phrase3, { count: 0, sessions: new Set() });
      phraseCount.get(phrase3).count++;
      phraseCount.get(phrase3).sessions.add(id);
    }
  }

  // Build organic patterns from phrases appearing in 2+ sessions
  const existingPatterns = new Set(results.map(r => r.pattern.toLowerCase()));
  for (const [phrase, data] of phraseCount) {
    if (data.sessions.size >= 2) {
      const pattern = patternType + ': ' + phrase;
      if (!existingPatterns.has(pattern.toLowerCase())) {
        results.push({
          pattern,
          sessions: Array.from(data.sessions),
          frequency: data.sessions.size
        });
      }
    }
  }

  // Sort by frequency and limit
  results.sort((a, b) => b.frequency - a.frequency);
  return results.slice(0, 10);
}

/**
 * Find bug-related patterns
 */
function findBugPatterns(sessionData) {
  const bugMap = new Map();

  for (const session of sessionData) {
    for (const bug of session.bugs) {
      // Use symptom as key for grouping similar bugs
      const symptomLower = (bug.symptom || '').toLowerCase();
      
      // Group by root cause keywords
      const causeLower = (bug.cause || '').toLowerCase();
      const key = causeLower || symptomLower;
      
      if (!key) continue;
      
      // Extract key phrase (first 3-5 words)
      const words = key.split(/\s+/).slice(0, 5).join(' ');
      const pattern = 'Bug pattern: ' + words;
      
      if (!bugMap.has(pattern)) {
        bugMap.set(pattern, { pattern, sessions: [], frequency: 0 });
      }
      
      const entry = bugMap.get(pattern);
      entry.sessions.push(session.id);
      entry.frequency++;
    }
  }

  return Array.from(bugMap.values()).filter(t => t.frequency >= 1);
}

/**
 * Find file patterns across sessions
 */
function findFilePatterns(sessionData) {
  const fileMap = new Map();

  for (const session of sessionData) {
    const files = session.extracted.relevantFiles || [];
    
    for (const file of files) {
      // Normalize file path (remove exact paths, keep patterns)
      const normalized = normalizeFilePattern(file);
      
      if (!fileMap.has(normalized)) {
        fileMap.set(normalized, { pattern: normalized, sessions: [], frequency: 0 });
      }
      
      const entry = fileMap.get(normalized);
      if (!entry.sessions.includes(session.id)) {
        entry.sessions.push(session.id);
        entry.frequency++;
      }
    }
  }

  return Array.from(fileMap.values()).filter(t => t.frequency >= 1);
}

/**
 * Normalize file path to pattern
 */
function normalizeFilePattern(file) {
  if (!file) return null;
  
  // Remove leading ./
  let normalized = file.replace(/^\.\//, '');
  
  // Replace specific names with wildcards
  normalized = normalized.replace(/\/[a-f0-9-]{36}\//g, '/{id}/');
  normalized = normalized.replace(/\/\d+\//g, '/{num}/');
  
  // Keep directory structure
  const parts = normalized.split('/');
  if (parts.length > 2) {
    return parts.slice(0, 2).join('/') + '/...';
  }
  
  return normalized;
}

/**
 * Cross-reference sessions to find patterns
 * 
 * @param {Array} sessions - Array of session objects with content
 * @returns {Array} [{ pattern, sessions, frequency }]
 */
export function findPatterns(sessions, existingPatterns = []) {
  if (!Array.isArray(sessions) || sessions.length < 1) {
    return [];
  }

  const patterns = [];
  const patternMap = new Map();

  // Extract content from each session
  const sessionData = sessions.map((session, index) => {
    const content = typeof session === 'string' ? session : (session.content || session.raw || '');
    const id = session.sessionId || session.id || `session-${index}`;
    const extracted = extractSessionContent(content);
    return {
      id,
      content,
      extracted,
      bugs: extractBugs(content)
    };
  });

  // Find recurring themes from goals
  const goalThemes = findRecurringThemes(
    sessionData.map(s => ({ text: s.extracted.goal, id: s.id })).filter(s => s.text),
    'goal theme'
  );
  goalThemes.forEach(p => patternMap.set(p.pattern, p));

  // Find recurring accomplishments
  const accomplishedThemes = findRecurringThemes(
    sessionData.map(s => ({ text: s.extracted.accomplished, id: s.id })).filter(s => s.text),
    'accomplishment theme'
  );
  accomplishedThemes.forEach(p => {
    if (patternMap.has(p.pattern)) {
      const existing = patternMap.get(p.pattern);
      existing.sessions = [...new Set([...existing.sessions, ...p.sessions])];
      existing.frequency = existing.sessions.length;
    } else {
      patternMap.set(p.pattern, p);
    }
  });

  // Find recurring bugs
  const bugPatterns = findBugPatterns(sessionData);
  bugPatterns.forEach(p => {
    if (patternMap.has(p.pattern)) {
      const existing = patternMap.get(p.pattern);
      existing.sessions = [...new Set([...existing.sessions, ...p.sessions])];
      existing.frequency = existing.sessions.length;
    } else {
      patternMap.set(p.pattern, p);
    }
  });

  // Find related files across sessions
  const filePatterns = findFilePatterns(sessionData);
  filePatterns.forEach(p => {
    if (patternMap.has(p.pattern)) {
      const existing = patternMap.get(p.pattern);
      existing.sessions = [...new Set([...existing.sessions, ...p.sessions])];
      existing.frequency = existing.sessions.length;
    } else {
      patternMap.set(p.pattern, p);
    }
  });

  // Convert to array and sort by frequency
  return Array.from(patternMap.values())
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Extract persistent patterns from intelligence-learning.md content
 * Parses existing patterns with session counts, first/last seen dates, and pinned status
 * 
 * @param {string} intelligenceContent - Raw content of intelligence-learning.md
 * @returns {Array} [{ pattern, type, sessions, sessionCount, firstSeen, lastSeen, pinned, lastValue }]
 */
export function extractPersistentPatterns(intelligenceContent) {
  if (!intelligenceContent || typeof intelligenceContent !== 'string') {
    return [];
  }

  const patterns = [];
  const lines = intelligenceContent.split('\n');
  
  let currentSection = null;
  let currentPattern = null;
  let currentSessionCount = 1;
  let currentFirstSeen = null;
  let currentLastSeen = null;

  // Parse section types from headers
  const sectionTypeMap = {
    '### Typical Session Duration': 'duration',
    '### Common Commands': 'command',
    '### Recurring Themes': 'goal_theme',
    '### Related Files': 'file_pattern',
    '### Bug-Prone Areas': 'bug_pattern',
    '### Session Patterns': 'session_pattern'
  };

  for (const line of lines) {
    // Check for section headers
    const sectionMatch = line.match(/^###\s+(.+)/);
    if (sectionMatch) {
      // Save previous pattern
      if (currentPattern) {
        patterns.push(finishPattern(currentPattern, currentSessionCount, currentFirstSeen, currentLastSeen));
      }
      
      currentSection = sectionMatch[1].trim();
      currentPattern = null;
      currentSessionCount = 1;
      currentFirstSeen = null;
      currentLastSeen = null;
      continue;
    }

    // Check for pattern entries with session references
    // Pattern format: "- pattern text (Sessions: N, Last: YYYY-MM-DD)"
    // Or simple: "- pattern text"
    // Match pattern text up to parenthesis, then optionally match (Sessions: N, Last: DATE)
    const entryMatch = line.match(/^-\s+([^(]+?)\s*(?:\(([^)]+)\))?$/);
    if (entryMatch && currentSection) {
      // Save previous
      if (currentPattern) {
        patterns.push(finishPattern(currentPattern, currentSessionCount, currentFirstSeen, currentLastSeen));
      }
      
      currentPattern = entryMatch[1].trim();
      
      // Parse metadata from entryMatch[2] (inside parentheses)
      // Format: "Sessions: N, Last: YYYY-MM-DD" or just "Sessions: N"
      const metadata = entryMatch[2];
      if (metadata) {
        const sessionsMatch = metadata.match(/Sessions?:?\s*(\d+)/i);
        const lastMatch = metadata.match(/Last:?\s*(\d{4}-\d{2}-\d{2})/i);
        currentSessionCount = sessionsMatch ? parseInt(sessionsMatch[1], 10) : 1;
        currentFirstSeen = lastMatch ? lastMatch[1] : null;
        currentLastSeen = lastMatch ? lastMatch[1] : null;
      } else {
        currentSessionCount = 1;
        currentFirstSeen = null;
        currentLastSeen = null;
      }
      continue;
    }

    // Continuation of previous pattern (indented content)
    if (line.match(/^\s{2,}-\s+/) && currentPattern) {
      const contText = line.trim().replace(/^-\s+/, '');
      currentPattern += ' ' + contText;
      continue;
    }
  }

  // Don't forget last pattern
  if (currentPattern) {
    patterns.push(finishPattern(currentPattern, currentSessionCount, currentFirstSeen, currentLastSeen));
  }

  // Sort by session count descending
  return patterns.sort((a, b) => b.sessionCount - a.sessionCount);
}

/**
 * Build pattern object with computed fields
 */
function finishPattern(pattern, sessionCount, firstSeen, lastSeen) {
  return {
    pattern,
    type: inferPatternType(pattern),
    sessions: ['unknown'], // Placeholder - actual session IDs not stored in this format
    sessionCount: sessionCount || 1,
    firstSeen: firstSeen || new Date().toISOString().split('T')[0],
    lastSeen: lastSeen || new Date().toISOString().split('T')[0],
    pinned: (sessionCount || 1) >= 3,
    lastValue: pattern
  };
}

/**
 * Infer pattern type from content
 */
function inferPatternType(pattern) {
  const lower = pattern.toLowerCase();
  if (lower.includes('command')) return 'command';
  if (lower.includes('duration') || lower.includes('minute') || lower.includes('hour')) return 'duration';
  if (lower.includes('bug') || lower.includes('error')) return 'bug_pattern';
  if (lower.includes('file') || lower.includes('/')) return 'file_pattern';
  // Recognize command-like patterns (npm, git, node, etc.)
  if (/^(npm|git|node|yarn|pnpm|docker|kubectl|pytest|jest|pytest)\s/.test(pattern)) return 'command';
  return 'general';
}

/**
 * Normalize pattern text for deduplication comparison
 * Removes articles, normalizes whitespace, lowercases
 * 
 * @param {string} pattern - Pattern text
 * @returns {string} Normalized pattern key
 */
export function normalizePattern(pattern) {
  if (!pattern) return '';
  let normalized = pattern.toLowerCase().trim();
  normalized = normalized.replace(/\b(a|an|the)\b/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 50);
}

/**
 * Deduplicate patterns by normalized key
 * Returns unique patterns, keeping the one with highest session count
 * 
 * @param {Array} patterns - Array of pattern objects
 * @returns {Array} Deduplicated patterns
 */
export function dedupePatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return [];
  }

  const seen = new Map();
  
  for (const p of patterns) {
    const key = normalizePattern(p.pattern);
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, { ...p });
    } else {
      // Keep the one with higher session count
      if (p.sessionCount > existing.sessionCount) {
        seen.set(key, { ...p });
      }
      // Merge sessions if different
      if (p.sessions) {
        const mergedSessions = [...new Set([...existing.sessions, ...p.sessions])];
        seen.get(key).sessions = mergedSessions;
        // Keep the max sessionCount, not the array length
        seen.get(key).sessionCount = Math.max(existing.sessionCount, p.sessionCount);
      }
    }
  }
  
  return Array.from(seen.values())
    .sort((a, b) => b.sessionCount - a.sessionCount);
}

/**
 * Filter patterns excluding already-pinned ones
 * Used to prevent recent patterns from duplicating pinned content
 * 
 * @param {Array} recentPatterns - Recent patterns to filter
 * @param {Array} pinnedPatterns - Already pinned patterns
 * @returns {Array} Filtered recent patterns
 */
export function filterPinnedFromRecent(recentPatterns, pinnedPatterns) {
  if (!recentPatterns || recentPatterns.length === 0) {
    return recentPatterns || [];
  }
  if (!pinnedPatterns || pinnedPatterns.length === 0) {
    return recentPatterns;
  }

  const pinnedByKey = new Map(
    pinnedPatterns.map(p => [normalizePattern(p.pattern), p])
  );
  
  return recentPatterns.filter(p => {
    const key = normalizePattern(p.pattern);
    const pinnedPattern = pinnedByKey.get(key);
    // Include if not in pinned set OR if session count increased beyond pinned
    if (!pinnedPattern) return true;
    return p.sessionCount > pinnedPattern.sessionCount;
  });
}
