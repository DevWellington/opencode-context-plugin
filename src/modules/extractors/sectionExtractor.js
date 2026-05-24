import path from 'path';
import { createDebugLogger } from '../../utils/debug.js';
import { findRelatedSessions, formatCrossProjectLink } from '../../utils/crossProjectLinks.js';
import { withTimeout } from '../../utils/fileUtils.js';

const logger = createDebugLogger('content-extractor');

/**
 * Clean extracted text to remove emojis, truncation markers, and headers
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
function cleanExtractedText(text) {
  if (!text) return '';
  
  // Strip *(truncated)* markers (case-insensitive, with optional surrounding whitespace)
  let cleaned = text.replace(/\*\(truncated\)\*/gi, '');
  
  // Strip emoji characters using Unicode ranges
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '');
  
  // Strip markdown headers
  cleaned = cleaned.replace(/^#+\s*/gm, '');
  
  // Collapse multiple newlines to single newlines
  cleaned = cleaned.replace(/\n{2,}/g, '\n');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Save parsed section content to result object
 */
function saveSection(result, section, content) {
  if (!section || content.length === 0) return;

  const joined = content.join('\n').trim();
  
  switch (section) {
    case 'goal':
      result.goal = cleanExtractedText(joined);
      break;
    case 'accomplished':
      result.accomplished = cleanExtractedText(joined);
      break;
    case 'discoveries':
      result.discoveries = cleanExtractedText(joined);
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
  const stopWords = new Set(['duration', 'minutes', 'hours', 'sessions', 'session', 'observations']);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fileContent = trimmed.replace(/^[-*]\s*/, '').trim();
    if (!fileContent) continue;

    // Skip lines that are just stop words
    if (stopWords.has(fileContent.toLowerCase())) continue;

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
