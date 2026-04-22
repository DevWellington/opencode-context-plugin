/**
 * @ocp-generate-intelligence-learning
 * Update intelligence-learning.md with new context from recent sessions
 *
 * Usage: @ocp-generate-intelligence-learning
 *
 * Reads ALL reference files before updating:
 * - Today's sessions
 * - This week's sessions
 * - Existing intelligence-learning.md (for deduplication)
 *
 * Then extracts patterns, bugs, and generates updated summary
 */

import path from 'path';
import fs from 'fs/promises';
import { REPORT_PATHS, REPORTS_DIR, CONTEXT_SESSION_DIR, extractKeywordsFromContent } from './utils/linkBuilder.js';
import { getConfig } from '../config.js';
import { extractSessionContent, extractBugs, findPatterns } from '../modules/contentExtractor.js';

const INTELLIGENCE_FILE = 'intelligence-learning.md';
const MAX_ENTRIES = 20;

// Greeting patterns to filter out - messages that are just salutations
const GREETING_PATTERNS = [
  /^oi$/i, /^hi$/i, /^hello$/i, /^olá$/i, /^hey$/i, /^e aí$/i,
  /^bom dia$/i, /^boa tarde$/i, /^boa noite$/i, /^tudo bem$/i,
  /^(hi|hey|yo|sup)\s*[!.]*$/i
];

// Keywords that indicate greeting titles (not actual work)
const GREETING_KEYWORDS = [
  'greeting', 'saudação', 'cumprimento', 'light chat', 'quick check-in'
];

/**
 * Check if content is likely just a greeting (not meaningful work)
 */
function isGreeting(content) {
  if (!content || typeof content !== 'string') return false;
  
  const trimmed = content.trim().toLowerCase();
  
  // Check if it's too short (likely greeting)
  if (trimmed.length < 5) return true;
  
  // Check against greeting patterns
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  return false;
}

/**
 * Check if session title indicates greeting content
 */
function isGreetingTitle(title) {
  if (!title) return false;
  
  const lowerTitle = title.toLowerCase();
  
  // Check greeting keywords in title
  for (const keyword of GREETING_KEYWORDS) {
    if (lowerTitle.includes(keyword)) return true;
  }
  
  // Check if title contains a timestamp pattern (for "New session - <timestamp>" format)
  // This indicates a default-named session that typically contains greeting content
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(title)) {
    return true;
  }
  
  return false;
}

export async function updateIntelligenceLearning(directory) {
  const config = getConfig();
  const intelligencePath = path.join(directory, REPORT_PATHS.intelligence);
  const reportsDir = path.join(directory, REPORTS_DIR);

  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const weekStr = `W${String(getWeekNumber(new Date())).padStart(2, '0')}`;

  let allReportsContent = '';

  // Correct hierarchical paths - same structure used by generators
  const weekDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month, weekStr);
  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month);
  const yearDir = path.join(directory, CONTEXT_SESSION_DIR, String(year));

  const reportFiles = [
    path.join(directory, REPORT_PATHS.today),                                              // daily-summary.md at root
    path.join(weekDir, 'week-summary.md'),                                               // week-summary.md in hierarchical folder
    path.join(monthDir, `monthly-${year}-${month}.md`),                                  // monthly-*.md in month folder
    path.join(yearDir, `annual-${year}.md`)                                               // annual-*.md in year folder
  ];

  for (const reportFile of reportFiles) {
    try {
      const content = await fs.readFile(reportFile, 'utf-8');
      allReportsContent += content + '\n\n';
    } catch {
      // Report not ready yet
    }
  }

  // Read existing content if exists
  let existingEntries = [];
  let existingContent = '';

  try {
    existingContent = await fs.readFile(intelligencePath, 'utf-8');
    existingEntries = parseExistingEntries(existingContent);
  } catch {
    // File doesn't exist, start fresh
  }

  // Gather new session information from recent files
  const newSessionInfo = await gatherRecentSessionInfo(directory);

  // Deduplicate by session content (title + firstUserMessage), not by ID
  const existingKeys = new Set();
  for (const entry of existingEntries) {
    for (const session of (entry.sessions || [])) {
      const key = `${session.title || ''}|${session.firstUserMessage || ''}`;
      existingKeys.add(key);
    }
  }

  // Filter out sessions that already exist (by content, not by ID)
  const newSessions = (newSessionInfo.sessions || []).filter(session => {
    const key = `${session.title || ''}|${session.firstUserMessage || ''}`;
    if (existingKeys.has(key)) {
      return false;
    }
    existingKeys.add(key);
    return true;
  });

  // Only add entry if it has new sessions (not just greetings that were filtered)
  if (newSessions.length === 0) {
    return { skipped: true, reason: 'No new meaningful sessions (all greetings or duplicates)' };
  }

  // Create deduplicated entry with filtered sessions
  const deduplicatedEntry = {
    ...newSessionInfo,
    sessions: newSessions,
    sessionCount: newSessions.length
  };

  // Add new entry at the beginning, capped at MAX_ENTRIES
  const allEntries = [deduplicatedEntry, ...existingEntries].slice(0, MAX_ENTRIES);

  // Generate updated content
  const content = generateIntelligenceContent(allEntries, deduplicatedEntry);

  // Save
  await fs.mkdir(path.dirname(intelligencePath), { recursive: true });
  await fs.writeFile(intelligencePath, content, 'utf-8');

  return { success: true, entries: allEntries.length, newSessions: newSessions.length };
}

/**
 * Read recent session files and gather information
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Parse title from session file content (frontmatter or header)
 */
function extractTitleFromContent(content) {
  // Try frontmatter title first
  const frontmatterMatch = content.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  if (frontmatterMatch && frontmatterMatch[1] && !frontmatterMatch[1].includes('${')) {
    return frontmatterMatch[1].trim();
  }
  
  // Try **Title:** pattern in content
  const titleMatch = content.match(/\*\*Title:\*\*\s*(.+)/);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }
  
  return null;
}

/**
 * Parse messages from session file content
 * Returns array of { role, content } objects
 */
function parseMessagesFromContent(content) {
  const messages = [];
  const messagePattern = /### Message (\d+) \[(\w+)\]\n\n([\s\S]*?)(?=\n### Message |\n---\n|\n## Messages\n|$)/g;
  
  let match;
  while ((match = messagePattern.exec(content)) !== null) {
    const role = match[2];
    const messageContent = match[3].trim();
    messages.push({ role, content: messageContent });
  }
  
  return messages;
}

/**
 * Infer structured data from raw messages when structured sections don't exist
 */
function inferFromMessages(messages, title) {
  const result = {
    goal: null,
    instructions: null,
    accomplished: null,
    discoveries: null,
    relevantFiles: []
  };
  
  // Get user messages
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // First user message = Instructions
  if (userMessages.length > 0) {
    result.instructions = userMessages[0].content;
  }
  
  // Infer goal from title if it seems meaningful (not just a timestamp)
  if (title && !title.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    result.goal = title;
  }
  
  // Last assistant message often indicates what was accomplished
  if (assistantMessages.length > 0) {
    const lastAssistant = assistantMessages[assistantMessages.length - 1].content;
    // Truncate if too long and take first meaningful part
    if (lastAssistant.length > 500) {
      result.accomplished = lastAssistant.slice(0, 500) + '...';
    } else {
      result.accomplished = lastAssistant;
    }
  }
  
  return result;
}

async function gatherRecentSessionInfo(directory) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  // Calculate ISO week number using same logic as reportGenerator
  const isoWeek = String(getWeekNumber(today)).padStart(2, '0');
  const weekDir = `W${isoWeek}`;

  // Try to find session directory
  let sessionDir = path.join(directory, '.opencode', 'context-session', String(year), month, weekDir, day);
  let sessionFiles = [];

  try {
    const files = await fs.readdir(sessionDir);
    sessionFiles = files.filter(f => f.endsWith('.md'));
  } catch {
    // Try searching for today's sessions in any week directory
    const baseDir = path.join(directory, '.opencode', 'context-session', String(year), month);
    try {
      const weeks = await fs.readdir(baseDir);
      for (const week of weeks) {
        if (week.startsWith('W')) {
          const tryDir = path.join(baseDir, week, day);
          try {
            const files = await fs.readdir(tryDir);
            const foundFiles = files.filter(f => f.endsWith('.md'));
            if (foundFiles.length > 0) {
              sessionFiles = foundFiles;
              sessionDir = tryDir; // Update to found location
              break;
            }
          } catch {
            // Continue to next week
          }
        }
      }
    } catch {
      // No sessions found
    }
  }

  // If no sessions found, return empty entry
  if (sessionFiles.length === 0) {
    return {
      id: `session-${Date.now()}`,
      date: today.toISOString(),
      type: 'compact',
      sessionCount: 0,
      sessions: [],
      keywords: []
    };
  }

  // Extract structured content from each session file
  const sessionSummaries = [];
  for (const file of sessionFiles) {
    const content = await fs.readFile(path.join(sessionDir, file), 'utf-8');
    
    // First try contentExtractor for structured data
    const extracted = extractSessionContent(content);
    const bugs = extractBugs(content);
    
    // Extract title from CONTENT, not filename
    const titleFromContent = extractTitleFromContent(content);
    // Fall back to filename if no title in content
    const titleFromFilename = file.replace(/^exit-|^compact-/, '').replace(/\.md$/, '');
    const title = titleFromContent || titleFromFilename;
    
    // Parse messages from content
    const messages = parseMessagesFromContent(content);
    
    // If no structured sections found, infer from messages
    let inferred = { goal: null, instructions: null, accomplished: null, discoveries: null, relevantFiles: [] };
    if (!extracted.goal && !extracted.accomplished && messages.length > 0) {
      inferred = inferFromMessages(messages, title);
    }
    
    // Use Instructions from messages as firstUserMessage
    const firstUserMessage = inferred.instructions || extracted.firstUserMessage || 
      (messages.find(m => m.role === 'user')?.content || '');
    
    // Skip sessions that are just greetings - they don't represent meaningful work
    if (isGreeting(firstUserMessage) || isGreetingTitle(title)) {
      continue;
    }
    
    sessionSummaries.push({
      filename: file,
      title: title,
      firstUserMessage: firstUserMessage,
      goal: extracted.goal || inferred.goal || '',
      instructions: inferred.instructions || extracted.firstUserMessage || '',
      accomplished: extracted.accomplished || inferred.accomplished || '',
      discoveries: extracted.discoveries || inferred.discoveries || '',
      relevantFiles: extracted.relevantFiles || inferred.relevantFiles || [],
      bugs: bugs
    });
  }
  
  // If all sessions were filtered out as greetings, return empty entry
  if (sessionSummaries.length === 0) {
    return {
      id: `session-${Date.now()}`,
      date: today.toISOString(),
      type: sessionFiles[0]?.startsWith('exit-') ? 'exit' : 'compact',
      sessionCount: 0,
      sessions: [],
      keywords: [],
      skippedGreetings: true
    };
  }

  // Return structured info
  return {
    id: `session-${Date.now()}`,
    date: today.toISOString(),
    type: sessionFiles[0]?.startsWith('exit-') ? 'exit' : 'compact',
    sessionCount: sessionSummaries.length, // Use filtered count, not original files
    sessions: sessionSummaries,
    // Extract meaningful keywords from actual content
    keywords: sessionSummaries
      .map(s => s.title)
      .filter(Boolean)
      .slice(0, 5)
  };
}

/**
 * Parse existing entries from intelligence file
 */
function parseExistingEntries(content) {
  const entries = [];

  // Try new format first: sessions array
  // Fix: Use consuming pattern \n(?=### \d{4}|## Related) to avoid matching \n##  inside date header "### 2026-04-21"
  const sessionBlocks = content.matchAll(/### (\d{4}-\d{2}-\d{2}) - (\d+) sessions\n([\s\S]+?)\n(?=### \d{4}|## Related|\Z)/g);

  for (const match of sessionBlocks) {
    const dateStr = match[1];
    const body = match[3];

    // Extract session details
    const sessionTitles = [...body.matchAll(/#### (.+)/g)].map(m => m[1]);
    const requests = [...body.matchAll(/- \*\*Request:\*\* (.+)/g)].map(m => m[1]);
    const accomplished = [...body.matchAll(/- \*\*Accomplished:\*\* (.+)/g)].map(m => m[1]);

    const sessions = sessionTitles.map((title, i) => ({
      title,
      firstUserMessage: requests[i] || '',
      accomplished: accomplished[i] || ''
    }));

    // Skip entries with no sessions (stub blocks from buggy regex)
    if (sessions.length === 0) {
      continue;
    }

    entries.push({
      id: `parsed-${dateStr}`,
      date: new Date(dateStr).toISOString(),
      type: 'compact',
      sessionCount: sessions.length,
      sessions
    });
  }

  // Global deduplication: skip if we already have a session with same title and request
  const seen = new Set();
  const deduplicated = entries.filter(entry => {
    for (const session of (entry.sessions || [])) {
      const key = `${session.title || ''}|${session.firstUserMessage || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });

  // Fallback to old format if no new format found
  if (entries.length === 0) {
    const oldBlocks = content.matchAll(/### Session \d+ - (\w+)\n([\s\S]*?)(?=\n### |$(?!\n))/g);
    for (const match of oldBlocks) {
      const id = match[1];
      const body = match[2];
      const dateMatch = body.match(/\*\*Date:\*\* ([\d-T:]+)/);
      const msgsMatch = body.match(/\*\*Messages:\*\* (\d+)/);
      const bugsMatch = body.match(/\*\*Bugs Fixed:\*\* ([\w, ]+)/);
      const keywordsMatch = body.match(/\*\*Keywords:\*\* ([\w|]+)/);

      entries.push({
        id,
        date: dateMatch?.[1] || '',
        type: id,
        messages: parseInt(msgsMatch?.[1] || '0', 10),
        bugs: bugsMatch?.[1]?.split(',').map(b => b.trim()) || [],
        keywords: keywordsMatch?.[1]?.split('|').map(k => k.trim()) || []
      });
    }
  }

  return deduplicated;
}

/**
 * Generate updated intelligence learning content
 */
function generateIntelligenceContent(entries, latestEntry) {
  const keywordsList = latestEntry.keywords?.length 
    ? latestEntry.keywords.map(k => `[[${k}]]`).join(' | ')
    : '[[opencode-context-plugin]] | [[intelligence-learning]]';

  // Extract structured content from all entries using contentExtractor patterns
  const allSessions = entries.flatMap(e => e.sessions || []);
  
  // Use findPatterns to identify cross-session patterns
  const patternSessions = allSessions
    .filter(s => s.content || (s.goal || s.accomplished || s.discoveries))
    .map((s, i) => ({
      sessionId: s.sessionId || `session-${i}`,
      content: s.content || `## Goal\n${s.goal || ''}\n\n## Accomplished\n${s.accomplished || ''}\n\n## Discoveries\n${s.discoveries || ''}`
    }));
  
  const patterns = patternSessions.length >= 2 ? findPatterns(patternSessions) : [];

  // Build accomplishments list for pattern analysis
  const accomplishments = allSessions
    .map(s => s.accomplished)
    .filter(Boolean)
    .slice(0, 10);

  let content = `---
title: Intelligence Learning
keywords: ${keywordsList}
created: ${new Date().toISOString()}
lastUpdated: ${new Date().toISOString()}
---

# Intelligence Learning

## Last Updated
- **Timestamp:** ${new Date().toISOString()}
- **Sessions Tracked:** ${entries.length}
- **Last Session Type:** ${latestEntry.type}
- **Patterns Learned:** ${patterns.length}

## Recent Sessions

`;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.sessions?.length) {
      content += `### ${e.date.split('T')[0]} - ${e.sessionCount} sessions\n\n`;
      for (const session of e.sessions) {
        content += `#### ${session.title}\n`;
        
        // Use template format for structured content
        if (session.goal) {
          content += `## Goal\n${session.goal}\n\n`;
        }
        if (session.firstUserMessage) {
          content += `## Instructions\n${session.firstUserMessage}\n\n`;
        }
        if (session.discoveries) {
          content += `## Discoveries\n${session.discoveries}\n\n`;
        }
        if (session.accomplished) {
          content += `## Accomplished\n${session.accomplished}\n\n`;
        }
        if (session.relevantFiles?.length) {
          content += `## Relevant Files\n${session.relevantFiles.map(f => `- ${f}`).join('\n')}\n\n`;
        }
        
        // Add bug history if any
        if (session.bugs?.length) {
          for (const bug of session.bugs) {
            content += `### Bug: ${bug.symptom}\n`;
            if (bug.cause) content += `**Cause:** ${bug.cause}\n`;
            if (bug.solution) content += `**Solution:** ${bug.solution}\n`;
            if (bug.prevention) content += `**Prevention:** ${bug.prevention}\n`;
            content += '\n';
          }
        }
        content += '\n';
      }
    } else {
      // Fallback for legacy entries without sessions
      content += `### Session ${i + 1} - ${(e.type || 'unknown').toUpperCase()}\n`;
      content += `- **Date:** ${e.date}\n`;
      content += `- **Session ID:** ${e.id}\n`;
      if (e.messages) content += `- **Messages:** ${e.messages}\n`;
      if (e.keywords?.length) content += `- **Keywords:** ${e.keywords.join(', ')}\n`;
      content += '\n';
    }
  }

  // Pattern Analysis section using findPatterns output
  if (patterns.length > 0) {
    content += `## Patterns from Recent Sessions\n\n`;
    for (const pattern of patterns.slice(0, 10)) {
      content += `- **${pattern.pattern}:** seen in ${pattern.frequency} sessions\n`;
    }
    content += '\n';
  }

  // Bug History section - only bugs with solutions
  const allBugs = allSessions.flatMap(s => s.bugs || []).filter(Boolean);
  if (allBugs.length > 0) {
    content += `## Bug History (Resolved Only)\n\n`;
    for (const bug of allBugs.slice(0, 10)) {
      content += `### ${bug.symptom}\n`;
      if (bug.cause) content += `**Cause:** ${bug.cause}\n`;
      if (bug.solution) content += `**Solution:** ${bug.solution}\n`;
      content += '\n';
    }
    content += '\n';
  }

  content += `## Related\n`;
  content += `  - [[daily-summary.md]]\n`;
  content += `  - [[reports/weekly-${new Date().getFullYear()}-W${String(Math.ceil(new Date().getDate() / 7)).padStart(2, '0')}.md]]\n`;

  return content;
}