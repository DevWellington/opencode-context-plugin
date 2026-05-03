import path from 'path';
import { createDebugLogger } from '../utils/debug.js';
import { findRelatedSessions, formatCrossProjectLink } from '../utils/crossProjectLinks.js';
import { withTimeout } from '../utils/fileUtils.js';

const logger = createDebugLogger('content-extractor');

/**
 * Content Extractor Module
 * 
 * Extracts structured data from session content for reporting.
 * No file system operations - works on string content only.
 * Uses native fetch for OpenAI API calls (no external dependencies).
 */

/**
 * Call OpenCode internal AI using sessions.prompt()
 * @param {Object} client - OpenCode client instance
 * @param {string} sessionContent - Session content to analyze
 * @param {string} prompt - Additional prompt context
 * @returns {Promise<string|null>} JSON response content or null on failure
 */
async function callOpenCodeAI(client, sessionContent, prompt) {
  if (!client?.sessions?.prompt) {
    logger('[infer] No OpenCode client available, skipping LLM inference');
    return null;
  }

  try {
    const response = await withTimeout(
      client.sessions.prompt('context-plugin-inference', {
        messages: [
          {
            role: 'user',
            content: `Analyze this session content and extract structured information.
Return a JSON object with these fields: goal, accomplished, discoveries, confidence.
Each confidence should be 0-1.

Session content:
${sessionContent.slice(0, 2000)}

${prompt}

Return only valid JSON, no markdown formatting.`
          }
        ],
        model: 'auto'
      }),
      30000,
      'callOpenCodeAI'
    );

    return response.content;
  } catch (error) {
    logger(`[infer] OpenCode AI inference failed: ${error.message}`);
    return null;
  }
}

/**
 * Extract structured data from session file content
 * @param {string} sessionContent - Raw session file content
 * @returns {Object} { goal, accomplished, discoveries, relevantFiles, firstUserMessage, raw, relatedSessions }
 */
export function extractSessionContent(sessionContent) {
  if (!sessionContent || typeof sessionContent !== 'string') {
    return {
      goal: null,
      accomplished: null,
      discoveries: null,
      relevantFiles: [],
      firstUserMessage: null,
      raw: sessionContent || '',
      relatedSessions: []  // Cross-project links will be added by enrichWithRelatedSessions
    };
  }

  const result = {
    goal: null,
    accomplished: null,
    discoveries: null,
    relevantFiles: [],
    firstUserMessage: null,
    raw: sessionContent,
    relatedSessions: []  // Cross-project links will be added by enrichWithRelatedSessions
  };

  // Parse markdown sections
  const lines = sessionContent.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    // Check for section headers (## Level)
    const sectionMatch = line.match(/^##\s+(Goal|Accomplished|Discoveries|Relevant Files?.*)/i);
    if (sectionMatch) {
      // Save previous section
      saveSection(result, currentSection, currentContent);
      // Normalize: treat "Relevant files / directories" and similar variants as "relevant files"
      const matched = sectionMatch[1].toLowerCase();
      currentSection = matched.startsWith('relevant') ? 'relevant files' : matched;
      currentContent = [];
      continue;
    }

    // Check for "###" sub-headers for Goal/Accomplished/Discoveries/Relevant Files
    const subSectionMatch = line.match(/^###\s+(Goal|Accomplished|Discoveries|Relevant Files?.*)/i);
    if (subSectionMatch) {
      saveSection(result, currentSection, currentContent);
      const matched = subSectionMatch[1].toLowerCase();
      currentSection = matched.startsWith('relevant') ? 'relevant files' : matched;
      currentContent = [];
      continue;
    }

    // Skip other nested headers (### Architecture, ### Bug:, etc.) - but save current section first
    const otherHeaderMatch = line.match(/^###+\s+.*/);
    if (otherHeaderMatch) {
      // This marks the end of current section content
      saveSection(result, currentSection, currentContent);
      currentSection = null;
      currentContent = [];
      continue;
    }

    // Check for bullet points with specific prefixes
    const bulletMatch = line.match(/^-\s+(Goal|Accomplished|Discoveries|Relevant Files):\s*(.*)/i);
    if (bulletMatch) {
      saveSection(result, currentSection, currentContent);
      currentSection = bulletMatch[1].toLowerCase();
      currentContent = [bulletMatch[2]];
      continue;
    }

    // Accumulate content for current section
    if (currentSection) {
      // Strip emojis and truncation markers from aggregated content
      const cleanLine = line
        .replace(/^[\s]*[-*–][\s]+/u, '')     // Strip bullet marker first
        .replace(/^[✅💡🐛🔧📝🔍📦🚪🚀][\s\-–]*/u, '')  // Then strip emoji
        .replace(/\*\(truncated\)\*/g, '')
        .replace(/\*\*/g, '')                  // Remove residual **
        .trim();
      if (cleanLine.length > 0 && !cleanLine.match(/^#+\s/)) {
        currentContent.push(cleanLine);
      }
    }
  }

  // Save last section
  saveSection(result, currentSection, currentContent);

  // Extract first user message if no structured sections found
  if (!result.goal && !result.accomplished && !result.discoveries) {
    result.firstUserMessage = extractFirstUserMessage(sessionContent);
  }

  return result;
}

/**
 * Save parsed section content to result object
 */
function saveSection(result, section, content) {
  if (!section || content.length === 0) return;

  const joined = content.join('\n').trim();
  
  switch (section) {
    case 'goal':
      result.goal = joined;
      break;
    case 'accomplished':
      result.accomplished = joined;
      break;
    case 'discoveries':
      result.discoveries = joined;
      break;
    case 'relevant files':
      result.relevantFiles = parseRelevantFiles(joined);
      break;
  }
}

/**
 * Parse relevant files from content - extracts file paths/patterns
 */
function parseRelevantFiles(content) {
  if (!content) return [];

  const files = [];
  const lines = content.split('\n');

  // Only accept lines that look like actual file paths
  // Valid: /path/file.js, src/file.js, *.test.js, package.json, dir/file.ext
  // Invalid: plain English sentences, "Note:", "No files", greeting text
  const filePathPattern = /^[\/.]?[a-zA-Z][\w\-\.\/\*]*\.[a-zA-Z]{1,10}$/;
  // Also accept paths starting with /Users/, /var/, ./, ../, or *.
  const validPrefixes = ['/Users/', '/var/', '/tmp/', './', '../', '~/.'];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fileContent = trimmed.replace(/^[-*]\s*/, '').trim();
    if (!fileContent) continue;

    // Must match file path pattern OR start with valid prefix
    const hasValidPrefix = validPrefixes.some(p => fileContent.startsWith(p));
    const matchesPattern = filePathPattern.test(fileContent);
    // Accept wildcards at START (*.test.js) or with ** in middle (src/**/*.js)
    // but NOT garbage like "Note: ...*" (asterisk at end of sentence)
    const hasWildcard = /^\*|^\[.*\]\(/.test(fileContent) || fileContent.includes('**');

    if (matchesPattern || hasValidPrefix || hasWildcard) {
      files.push(fileContent);
    }
    // Silent drop: sentences, greetings, system messages
  }

  return [...new Set(files)]; // Deduplicate
}

/**
 * Extract first user message from session content
 */
function extractFirstUserMessage(content) {
  if (!content) return null;

  // Look for user message patterns
  const userMessagePatterns = [
    /^#\s+(.+)/m,                           // First heading
    /^User:\s*(.+)/m,                        // User: prefix
    /^>\s*(.+)/m,                            // Quoted text
    /^\w+:\s*(.+)/m                          // Any name: prefix
  ];

  for (const pattern of userMessagePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fall back to first non-empty line
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('//')) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Extract ONLY bugs that were identified AND treated
 * Looks for "Bug:", "Error:", "Issue:" followed by solution/fix
 * Only returns bugs that have a resolution
 * 
 * @param {string} sessionContent - Raw session file content
 * @returns {Array} [{ symptom, cause, solution, prevention }]
 */
export function extractBugs(sessionContent) {
  if (!sessionContent || typeof sessionContent !== 'string') {
    return [];
  }

  const bugs = [];
  const lines = sessionContent.split('\n');
  
  let currentBug = null;
  let currentBugContent = [];
  let inBugSection = false;
  let sectionDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Detect bug-related headers
    const bugHeaderMatch = trimmedLine.match(/^(?:###\s+)?(?:Bug|Error|Issue):\s*(.*)/i);
    if (bugHeaderMatch) {
      // Save previous bug if complete
      if (currentBug && hasSolution(currentBugContent)) {
        bugs.push(finishBug(currentBug, currentBugContent));
      }
      
      // Extract and validate symptom
      const symptomCandidate = bugHeaderMatch[1] || '';
      if (!isValidBugSymptom(symptomCandidate)) {
        continue;  // Skip malformed bug headers
      }
      
      // Start new bug with validated symptom
      currentBug = { symptom: symptomCandidate, line: i };
      currentBugContent = [];
      inBugSection = true;
      sectionDepth = (trimmedLine.startsWith('###') ? 1 : 0);
      continue;
    }

    // Detect end of bug section (next ## header or significant content change)
    if (inBugSection) {
      const nextSectionMatch = trimmedLine.match(/^##\s+\w+/);
      if (nextSectionMatch) {
        inBugSection = false;
        if (currentBug && hasSolution(currentBugContent)) {
          bugs.push(finishBug(currentBug, currentBugContent));
        }
        currentBug = null;
        currentBugContent = [];
        continue;
      }

      // Also detect if we hit another Bug/Error/Issue
      const anotherBugMatch = trimmedLine.match(/^(?:###\s+)?(?:Bug|Error|Issue):/i);
      if (anotherBugMatch && !trimmedLine.startsWith('###')) {
        // This means we're exiting a sub-section
        if (currentBug && hasSolution(currentBugContent)) {
          bugs.push(finishBug(currentBug, currentBugContent));
        }
        currentBug = { symptom: anotherBugMatch[1] || '', line: i };
        currentBugContent = [];
        continue;
      }

      currentBugContent.push(line);
    }
  }

  // Don't forget last bug
  if (currentBug && hasSolution(currentBugContent)) {
    bugs.push(finishBug(currentBug, currentBugContent));
  }

  return bugs;
}

/**
 * Check if bug content includes a solution/fix
 * Uses word boundaries to avoid false positives like "no solution"
 */
function hasSolution(content) {
  if (!content || content.length === 0) return false;
  
  // Word boundary patterns to avoid false matches like "no solution"
  const positivePatterns = [
    /\bsolution\b/i,
    /\bfix\b/i,
    /\bresolution\b/i,
    /\bresolved\b/i,
    /\bworkaround\b/i,
    /\bprevent/i,
    /\bavoid\b/i
  ];

  // Negative patterns that indicate solution is NOT present
  const negativePatterns = [
    /no\s+(solution|fix|resolution)/i,
    /without\s+(solution|fix)/i,
    /unsolved/i,
    /unresolved/i
  ];

  const contentStr = content.join('\n');
  
  // Check for negative patterns first
  if (negativePatterns.some(pattern => pattern.test(contentStr))) {
    return false;
  }
  
  // Then check for positive patterns
  return positivePatterns.some(pattern => pattern.test(contentStr));
}

/**
 * Parse bug content into structured bug object
 */
function finishBug(bug, content) {
  const contentStr = content.join('\n');
  
  return {
    symptom: bug.symptom,
    cause: extractBugField(content, ['cause', 'reason', 'root cause', 'why']),
    solution: extractBugField(content, ['solution', 'fix', 'resolution', 'resolved by', 'workaround']),
    prevention: extractBugField(content, ['prevention', 'prevent', 'avoid', 'next time'])
  };
}

/**
 * Validates that a bug symptom is not a malformed fragment or artifact.
 * @param {string} symptom - Candidate bug symptom text
 * @returns {boolean} - True if symptom is valid, false if malformed
 */
export function isValidBugSymptom(symptom) {
  if (!symptom || symptom.length < 10) return false;
  
  // Reject file:line references (e.g., "js:756", "js:467-468")
  if (/^[a-z]+:\d/.test(symptom)) return false;
  
  // Reject truncated fragments ending with "(Revisar tudo)" or similar
  if (/\(Revisar tudo\)$/.test(symptom)) return false;
  if (/\(review\)$/.test(symptom)) return false;
  
  // Reject standalone file/module names (session artifacts)
  if (/^(md|js|ts|contentExtractor|linkBuilder)\b/i.test(symptom)) return false;
  
  // Reject pure numbers or number+paren fragments
  if (/^\d+\s/.test(symptom)) return false;
  if (/^\d+\(/.test(symptom)) return false;  // "2 (Revisar tudo)"
  
  // Reject fragments starting with lowercase letter followed by space
  if (/^[a-z]\s/.test(symptom)) return false;  // "e (Revisar tudo)"
  
  return true;
}

/**
 * Extract a named field from bug content
 */
function extractBugField(content, fieldNames) {
  const contentStr = content.join('\n');

  for (const fieldName of fieldNames) {
    // Check for **FieldName:** pattern (markdown bold with colons inside asterisks)
    // The colon is BEFORE the closing ** in "**Cause:**"
    const boldPattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const boldMatch = contentStr.match(boldPattern);
    if (boldMatch) {
      return boldMatch[1].trim();
    }
    
    // Check for plain FieldName: pattern at start of line or after bullet
    const plainPattern = new RegExp(`(?:^|\\n)\\s*[*\\-]?\\s*${fieldName}:\\s*(.+)`, 'i');
    const plainMatch = contentStr.match(plainPattern);
    if (plainMatch) {
      return plainMatch[1].trim();
    }
  }

  return null;
}

/**
 * Use LLM inference to fill missing structured data
 * Only call when structured fields are absent
 * 
 * @param {string} sessionContent - Raw session content
 * @param {Object} opencodeClient - OpenCode client instance (optional)
 * @returns {Promise<Object>} { goal, accomplished, discoveries } with confidence scores
 */
export async function inferMissingFields(sessionContent, opencodeClient = null) {
  // Only infer if we have content
  if (!sessionContent || typeof sessionContent !== 'string') {
    return { goal: null, accomplished: null, discoveries: null, confidence: { goal: 0, accomplished: 0, discoveries: 0 } };
  }

  // First try basic extraction
  const extracted = extractSessionContent(sessionContent);
  
  // Check if we already have structured data
  const hasGoal = extracted.goal && extracted.goal.length > 10;
  const hasAccomplished = extracted.accomplished && extracted.accomplished.length > 10;
  const hasDiscoveries = extracted.discoveries && extracted.discoveries.length > 10;

  // If we have most data, skip LLM inference
  const fieldsPresent = [hasGoal, hasAccomplished, hasDiscoveries].filter(Boolean).length;
  if (fieldsPresent >= 2) {
    return {
      goal: extracted.goal,
      accomplished: extracted.accomplished,
      discoveries: extracted.discoveries,
      confidence: {
        goal: hasGoal ? 0.9 : 0,
        accomplished: hasAccomplished ? 0.9 : 0,
        discoveries: hasDiscoveries ? 0.9 : 0
      }
    };
  }

  // Need LLM inference - check for OpenCode client
  if (!opencodeClient?.sessions?.prompt) {
    logger('[infer] No OpenCode client available, returning partial extraction');
    return {
      goal: extracted.goal,
      accomplished: extracted.accomplished,
      discoveries: extracted.discoveries,
      confidence: {
        goal: hasGoal ? 0.9 : 0,
        accomplished: hasAccomplished ? 0.9 : 0,
        discoveries: hasDiscoveries ? 0.9 : 0
      }
    };
  }

  try {
    // Build prompt for inference
    const prompt = buildInferencePrompt(sessionContent, extracted);
    
    const content = await callOpenCodeAI(opencodeClient, sessionContent, prompt);
    
    if (!content) {
      throw new Error('Empty response from OpenCode AI');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const inferred = JSON.parse(jsonMatch[0]);
    
    // Merge with extracted data, preferring LLM inference for missing fields
    return {
      goal: inferred.goal || extracted.goal,
      accomplished: inferred.accomplished || extracted.accomplished,
      discoveries: inferred.discoveries || extracted.discoveries,
      confidence: {
        goal: inferred.confidence?.goal ?? (hasGoal ? 0.9 : 0.5),
        accomplished: inferred.confidence?.accomplished ?? (hasAccomplished ? 0.9 : 0.5),
        discoveries: inferred.confidence?.discoveries ?? (hasDiscoveries ? 0.9 : 0.5)
      }
    };
  } catch (error) {
    logger(`[infer] LLM inference failed: ${error.message}`);
    // Return partial extraction on error
    return {
      goal: extracted.goal,
      accomplished: extracted.accomplished,
      discoveries: extracted.discoveries,
      confidence: {
        goal: hasGoal ? 0.9 : 0,
        accomplished: hasAccomplished ? 0.9 : 0,
        discoveries: hasDiscoveries ? 0.9 : 0
      }
    };
  }
}

/**
 * Build prompt for LLM inference
 */
function buildInferencePrompt(sessionContent, extracted) {
  let prompt = 'Analyze this session content and extract structured information.\n\n';
  
  // Include first 1500 chars of session
  const preview = sessionContent.slice(0, 1500);
  prompt += `Session content:\n${preview}\n\n`;
  
  // Add hints about what's missing
  if (!extracted.goal) {
    prompt += 'Missing: Goal (what was the session trying to accomplish?)\n';
  }
  if (!extracted.accomplished) {
    prompt += 'Missing: Accomplished (what was successfully completed?)\n';
  }
  if (!extracted.discoveries) {
    prompt += 'Missing: Discoveries (what was learned or found?)\n';
  }
  
  prompt += '\nReturn JSON with goal, accomplished, discoveries, and confidence scores.';
  
  return prompt;
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
  const stopWords = new Set(['the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'to', 'of', 'and', 'in', 'for', 'on', 'with', 'that', 'this', 'it', 'its', 'as', 'at', 'by', 'from', 'or', 'if', 'when', 'while', 'then', 'so', 'but', 'not', 'can', 'will', 'just', 'have', 'has', 'had', 'do', 'does', 'did', 'would', 'could', 'should', 'may', 'might', 'must', 'about', 'into', 'out', 'up', 'down', 'over', 'under', 'again', 'more', 'most', 'some', 'any', 'all', 'each', 'few', 'many', 'other', 'such', 'no', 'nor', 'only', 'own', 'same', 'than', 'too', 'very', 's', 't', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'these', 'those', 'am', 'let', 'get', 'got', 'been', 'session', 'user', 'wants', 'summary', 'conversation', 'context', 'goal', 'message', 'assistant', 'file', 'files', 'project', 'code', 'plugin', 'opencode', 'using', 'used', 'create', 'created', 'make', 'made', 'add', 'added', 'update', 'updated', 'remove', 'removed', 'fix', 'fixed', 'change', 'changed', 'check', 'see', 'need', 'needs', 'look', 'looking', 'find', 'found', 'help', 'try', 'start', 'work', 'works', 'working', 'run', 'running', 'give', 'given', 'tell', 'told', 'ask', 'asked', 'want', 'like', 'take', 'took', 'know', 'think', 'thought', 'right', 'left', 'good', 'great', 'well', 'way', 'ways', 'new', 'now', 'here', 'there', 'come', 'came', 'go', 'went', 'say', 'said', 'use', 'using', 'thanks', 'thank', 'please', 'sorry', 'something', 'anything', 'everything', 'nothing', 'someone', 'anyone', 'everyone', 'done', 'doing', 'able', 'also', 'back', 'even', 'still', 'enough', 'first', 'last', 'next', 'best', 'better', 'sure', 'real', 'really', 'maybe', 'perhaps', 'probably', 'actually', 'basically', 'simply', 'exactly', 'already', 'yet', 'ever', 'never', 'always', 'sometimes', 'often', 'usually', 'likely', 'unlikely', 'possible', 'impossible', 'necessary', 'worse', 'important', 'easy', 'hard', 'long', 'short', 'big', 'small', 'old', 'young', 'high', 'low', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool', 'dark', 'light', 'bright', 'weak', 'strong', 'loud', 'quiet', 'clean', 'dirty', 'dry', 'wet', 'deep', 'shallow', 'full', 'empty', 'heavy', 'light', 'rich', 'poor', 'safe', 'dangerous', 'healthy', 'sick', 'alive', 'dead', 'open', 'closed', 'true', 'false', 'different', 'similar', 'natural', 'artificial', 'free', 'expensive', 'cheap', 'quiet', 'noisy', 'simple', 'complex', 'clear', 'confusing', 'direct', 'indirect', 'positive', 'negative', 'active', 'passive', 'correct', 'incorrect', 'early', 'late', 'modern', 'traditional', 'internal', 'external', 'public', 'private', 'formal', 'informal', 'special', 'general', 'temporary', 'permanent', 'curious', 'indifferent', 'optimistic', 'pessimistic', 'objective', 'subjective', 'logical', 'illogical', 'reasonable', 'unreasonable', 'responsible', 'irresponsible', 'efficient', 'inefficient', 'sufficient', 'insufficient', 'necessary', 'unnecessary', 'sufficient', 'acceptable', 'unacceptable', 'appropriate', 'inappropriate', 'significant', 'insignificant', 'obvious', 'subtle', 'minor', 'major', 'primary', 'secondary', 'basic', 'advanced', 'standard', 'nonstandard', 'normal', 'abnormal', 'regular', 'irregular', 'consistent', 'inconsistent', 'dependent', 'independent', 'relative', 'absolute', 'complete', 'incomplete', 'perfect', 'imperfect', 'strong', 'weak', 'violent', 'peaceful', '粗糙', '精细', '快速', '缓慢', '简单', '复杂', '清楚', '模糊', '稳定', '不稳定', '有效', '无效', '一致', '不一致', '全面', '片面', '系统', '零散', '主动', '被动', '计划', '随机', '开源', '闭源', '同步', '异步', '集中', '分散', '这个', '那个', '什么', '怎么', '为什么', '哪里', '谁', '何时', '是否', '虽然', '但是', '而且', '或者', '因为', '所以', '如果', '虽然', 'test', 'tests', 'testing', 'tested', 'revisar', 'revisando', 'revisado', 'tudo', 'todas', 'todos', 'todo', 'toda', 'very', 'also', 'too', 'only', 'just', 'even']);

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
 * Enrich extracted content with cross-project related sessions
 * This is called separately after extractSessionContent to avoid blocking the main extraction
 * 
 * @param {Object} extractedContent - Result from extractSessionContent
 * @param {string} sessionContent - Original session content
 * @returns {Promise<Object>} Same object with relatedSessions populated
 */
export async function enrichWithRelatedSessions(extractedContent, sessionContent) {
  if (!extractedContent || extractedContent.relatedSessions) {
    return extractedContent;
  }

  // Create a session object for findRelatedSessions
  const session = {
    content: sessionContent,
    goal: extractedContent.goal,
    accomplished: extractedContent.accomplished
  };

  try {
    // Find related sessions with 500ms timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Cross-project search timeout')), 500);
    });

    const relatedPromise = findRelatedSessions(session, {
      keyword: extractedContent.goal || '',
      goal: extractedContent.goal || '',
      maxResults: 3
    });

    const related = await Promise.race([relatedPromise, timeoutPromise]);
    
    // Format cross-project links for the related sessions
    extractedContent.relatedSessions = related.map(r => ({
      project: r.project,
      path: r.session,
      relevance: r.relevance,
      reason: r.reason,
      link: formatCrossProjectLink(r.project, path.basename(r.session, '.md'))
    }));
  } catch (error) {
    logger(`[enrich] Cross-project search failed: ${error.message}`);
    // Don't fail the whole extraction - just leave relatedSessions empty
    extractedContent.relatedSessions = [];
  }

  return extractedContent;
}

/**
 * Extract any cross-project links from session content
 * Parses [[project:session-id]] format from content
 * 
 * @param {string} sessionContent - Raw session content
 * @returns {Array} Array of { project, sessionId, fullMatch }
 */
export function extractCrossProjectLinks(sessionContent) {
  if (!sessionContent) return [];

  const links = [];
  const pattern = /\[\[([^\]:]+):([^\]]+)\]\]/g;
  
  let match;
  while ((match = pattern.exec(sessionContent)) !== null) {
    links.push({
      project: match[1],
      sessionId: match[2],
      fullMatch: match[0]
    });
  }

  return links;
}

/**
 * Classify session priority based on content analysis
 * High Priority: Bug-related, architecture, design, refactor, migration, decisions
 * Medium Priority: Feature work, testing, configuration
 * Low Priority: Default - routine sessions
 * 
 * @param {string} sessionContent - Raw session content
 * @returns {'high' | 'medium' | 'low'} Priority level
 */
export function classifySessionPriority(sessionContent) {
  if (!sessionContent || typeof sessionContent !== 'string') {
    return 'low';
  }

  const highPriorityPatterns = [
    /\b(bug|error|crash|security|vulnerability|critical)\b/i,
    /\b(architecture|design|refactor|migration|performance)\b/i,
    /\b(decision|chose|selected|agreed)\b/i
  ];

  const mediumPriorityPatterns = [
    /\b(feature|implement|add|create|build)\b/i,
    /\b(test|testing|coverage|verify)\b/i,
    /\b(config|setting|setup|install)\b/i
  ];

  // Check HIGH first
  if (highPriorityPatterns.some(p => p.test(sessionContent))) {
    return 'high';
  }

  // Check MEDIUM second
  if (mediumPriorityPatterns.some(p => p.test(sessionContent))) {
    return 'medium';
  }

  return 'low';
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
