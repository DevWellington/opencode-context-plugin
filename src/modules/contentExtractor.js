import path from 'path';
import { createDebugLogger } from '../utils/debug.js';
import { findRelatedSessions, formatCrossProjectLink } from '../utils/crossProjectLinks.js';

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
    const response = await client.sessions.prompt('context-plugin-inference', {
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
    });

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
    // Check for section headers
    const sectionMatch = line.match(/^##\s+(Goal|Accomplished|Discoveries|Relevant Files)/i);
    if (sectionMatch) {
      // Save previous section
      saveSection(result, currentSection, currentContent);
      currentSection = sectionMatch[1].toLowerCase();
      currentContent = [];
      continue;
    }

    // Check for "###" sub-headers (e.g., "### Bug:")
    const subSectionMatch = line.match(/^###\s+(Goal|Accomplished|Discoveries|Relevant Files)/i);
    if (subSectionMatch) {
      saveSection(result, currentSection, currentContent);
      currentSection = subSectionMatch[1].toLowerCase();
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
      currentContent.push(line);
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

  for (const line of lines) {
    // Match bullet points with file paths
    const bulletMatch = line.match(/^-\s+(.+)/);
    if (bulletMatch) {
      const fileContent = bulletMatch[1].trim();
      // Extract file paths (e.g., src/utils/file.js, *.test.js, etc.)
      const fileMatches = fileContent.match(/(?:[\w\-\*\/\.]+\/?)+[\w\-\*\.]+/g);
      if (fileMatches) {
        files.push(...fileMatches);
      } else if (fileContent && !fileContent.startsWith('*')) {
        // If it's a bullet but no file pattern, treat as a file reference
        files.push(fileContent);
      }
    }
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
      
      // Start new bug
      currentBug = { symptom: bugHeaderMatch[1] || '', line: i };
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
export function findPatterns(sessions) {
  if (!Array.isArray(sessions) || sessions.length < 2) {
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
 * Find recurring themes in text array
 * @param {Array} textsWithIds - Array of {text, id} objects
 * @param {string} patternType - Type prefix for patterns
 */
function findRecurringThemes(textsWithIds, patternType) {
  const themeMap = new Map();

  // Simple keyword-based theme detection
  const commonKeywords = [
    'api', 'database', 'auth', 'config', 'test', 'bug', 'fix', 'feature',
    'refactor', 'deploy', 'migration', 'error', 'performance', 'security'
  ];

  for (const { text, id } of textsWithIds) {
    if (!text) continue;
    
    const lowerText = text.toLowerCase();
    const seenKeywords = new Set(); // Track keywords found in this session to avoid duplicates
    
    for (const keyword of commonKeywords) {
      if (lowerText.includes(keyword)) {
        const theme = patternType + ': ' + keyword;
        if (!themeMap.has(theme)) {
          themeMap.set(theme, { pattern: theme, sessions: [], frequency: 0 });
        }
        const entry = themeMap.get(theme);
        // Only add session ID if we haven't already counted this keyword for this session
        if (!seenKeywords.has(keyword)) {
          entry.sessions.push(id);
          entry.frequency++;
          seenKeywords.add(keyword);
        }
      }
    }
  }

  return Array.from(themeMap.values()).filter(t => t.frequency >= 2);
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

  return Array.from(bugMap.values()).filter(t => t.frequency >= 2);
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

  return Array.from(fileMap.values()).filter(t => t.frequency >= 2);
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
