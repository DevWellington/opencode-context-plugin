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
import { REPORT_PATHS, extractKeywordsFromContent } from './utils/linkBuilder.js';
import { getConfig } from '../config.js';

const INTELLIGENCE_FILE = 'intelligence-learning.md';
const MAX_ENTRIES = 20;

export async function updateIntelligenceLearning(directory) {
  const config = getConfig();
  const intelligencePath = path.join(directory, REPORT_PATHS.intelligence);

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

  // Check for duplicate session ID
  if (newSessionInfo.id && existingEntries.some(s => s.id === newSessionInfo.id)) {
    return { skipped: true, reason: 'Duplicate session ID' };
  }

  // Add new entry at the beginning
  const allEntries = [newSessionInfo, ...existingEntries].slice(0, MAX_ENTRIES);

  // Generate updated content
  const content = generateIntelligenceContent(allEntries, newSessionInfo);

  // Save
  await fs.mkdir(path.dirname(intelligencePath), { recursive: true });
  await fs.writeFile(intelligencePath, content, 'utf-8');

  return { success: true, entries: allEntries.length };
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

    // Extract title
    const titleMatch = content.match(/\*\*Title:\*\*\s*(.+)/);
    // Extract first user message
    const firstUser = content.match(/### Message 0 \[user\]\n\n(.+?)(?=\n###)/s);
    // Extract goal/accomplished from compact sessions
    const goalMatch = content.match(/\*\*Goal:\*\*\s*(.+?)(?=\n\n|\*\*|$)/s);
    const accomplishedMatch = content.match(/\*\*Accomplished:\*\*\s*(.+?)(?=\n\n|\*\*|$)/s);
    // Extract relevant files
    const filesMatch = content.match(/\*\*Relevant files.+?\*\*\s*(.+?)(?=\n\n|\*\*##|$)/s);

    sessionSummaries.push({
      filename: file,
      title: titleMatch?.[1]?.trim() || file,
      firstUserMessage: firstUser?.[1]?.trim().slice(0, 100) || '',
      goal: goalMatch?.[1]?.trim() || '',
      accomplished: accomplishedMatch?.[1]?.trim() || '',
      relevantFiles: filesMatch?.[1]?.trim() || ''
    });
  }

  // Return structured info
  return {
    id: `session-${Date.now()}`,
    date: today.toISOString(),
    type: sessionFiles[0]?.startsWith('exit-') ? 'exit' : 'compact',
    sessionCount: sessionFiles.length,
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
  const sessionBlocks = content.matchAll(/### (\d{4}-\d{2}-\d{2}) - (\d+) sessions\n([\s\S]*?)(?=\n### |\n## |\Z)/g);

  for (const match of sessionBlocks) {
    const dateStr = match[1];
    const sessionCount = parseInt(match[2], 10);
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

    entries.push({
      id: `parsed-${dateStr}`,
      date: new Date(dateStr).toISOString(),
      type: 'compact',
      sessionCount,
      sessions
    });
  }

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

  return entries;
}

/**
 * Generate updated intelligence learning content
 */
function generateIntelligenceContent(entries, latestEntry) {
  const keywords = latestEntry.keywords?.join(' | ') || 'opencode-context-plugin | intelligence-learning';

  // Extract meaningful patterns from accomplishments
  const patterns = entries
    .flatMap(e => e.sessions?.map(s => s.accomplished).filter(Boolean) || [])
    .slice(0, 10);

  let content = `---
title: Intelligence Learning
keywords: ${keywords}
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
        content += `- **Request:** ${session.firstUserMessage || '(no request)'}\n`;
        if (session.accomplished) {
          content += `- **Accomplished:** ${session.accomplished}\n`;
        }
        if (session.goal) {
          content += `- **Goal:** ${session.goal}\n`;
        }
        if (session.relevantFiles) {
          content += `- **Files:** ${session.relevantFiles}\n`;
        }
        content += '\n';
      }
    } else {
      // Fallback for legacy entries without sessions
      content += `### Session ${i + 1} - ${(e.type || 'unknown').toUpperCase()}\n`;
      content += `- **Date:** ${e.date}\n`;
      content += `- **Session ID:** ${e.id}\n`;
      content += `- **Messages:** ${e.messages || 0}\n`;
      if (e.keywords?.length) {
        content += `- **Keywords:** ${e.keywords.join(', ')}\n`;
      }
      content += '\n';
    }
  }

  // Pattern Analysis from Accomplishments
  if (patterns.length > 0) {
    content += `## Patterns from Accomplishments\n\n`;
    for (const pattern of patterns) {
      content += `- ${pattern}\n`;
    }
    content += '\n';
  }

  content += `## Related\n`;
  content += `  - [[daily-summary.md]]\n`;
  content += `  - [[reports/weekly-${new Date().getFullYear()}-W${String(Math.ceil(new Date().getDate() / 7)).padStart(2, '0')}.md]]\n`;

  return content;
}