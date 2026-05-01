/**
 * Greeting Detection Module
 * Detects if content or titles are just greetings (not meaningful work)
 */

export const GREETING_PATTERNS = [
  /^oi$/i, /^hi$/i, /^hello$/i, /^olá$/i, /^hey$/i, /^e aí$/i,
  /^bom dia$/i, /^boa tarde$/i, /^boa noite$/i, /^tudo bem$/i,
  /^(hi|hey|yo|sup)\s*[!.]*$/i
];

export const GREETING_KEYWORDS = [
  'greeting', 'saudação', 'cumprimento', 'light chat', 'quick check-in'
];

export function isGreeting(content) {
  if (!content || typeof content !== 'string') return false;

  const trimmed = content.trim().toLowerCase();

  if (trimmed.length < 5) return true;

  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

export function isGreetingTitle(title, hasStructuredContent = false) {
  if (!title) return false;

  const lowerTitle = title.toLowerCase();
  const trimmed = title.trim();

  // Check for timestamp pattern (default session names like "New session - 2026-04-30T16:48:16")
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(title)) {
    return true;
  }

  // If content has structured sections (## Goal, ## Accomplished, etc.), it's NOT a greeting
  // even if title contains greeting keywords
  if (hasStructuredContent) {
    return false;
  }

  // Only flag as greeting if title is SHORT (under 30 chars) AND contains greeting keyword
  // This prevents filtering valid work sessions with titles like "Greeting - Phase 24 analysis"
  if (trimmed.length < 30) {
    for (const keyword of GREETING_KEYWORDS) {
      if (lowerTitle.includes(keyword)) return true;
    }
  }

  // Check for exact greeting patterns (standalone words only)
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Check if content has structured work sections
 * Sessions with ## Goal, ## Accomplished, etc. are NOT greetings
 */
export function hasStructuredWorkContent(content) {
  if (!content || typeof content !== 'string') return false;

  // Check for structured section headers
  const structuredPatterns = [
    /^##\s+(Goal|Accomplished|Discoveries)/m,
    /^###\s+(Goal|Accomplished|Discoveries|Bug)/m,
    /^- \*\*Goal:\*\*/m,
    /^- \*\*Accomplished:\*\*/m
  ];

  return structuredPatterns.some(pattern => pattern.test(content));
}

export function isGreetingContent(content, title) {
  return isGreeting(content) || isGreetingTitle(title);
}