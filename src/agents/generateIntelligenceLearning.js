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
async function gatherRecentSessionInfo(directory) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const week = `W${Math.ceil(today.getDate() / 7)}`;
  const day = String(today.getDate()).padStart(2, '0');

  const sessionDir = path.join(directory, '.opencode', 'context-session', String(year), month, week, day);

  let sessionFiles = [];
  let allContent = '';

  try {
    const files = await fs.readdir(sessionDir);
    sessionFiles = files.filter(f => f.endsWith('.md'));
    for (const file of sessionFiles) {
      allContent += await fs.readFile(path.join(sessionDir, file), 'utf-8') + '\n';
    }
  } catch {
    // No sessions today
  }

  // Extract keywords from content
  const keywords = extractKeywordsFromContent(allContent, 15);

  // Detect potential bugs/patterns (simple keyword detection)
  const bugIndicators = ['error', 'fix', 'bug', 'issue', 'problem', 'failed', 'crash'];
  const detectedBugs = keywords.filter(k => bugIndicators.includes(k.toLowerCase()));

  return {
    id: `session-${Date.now()}`,
    date: today.toISOString(),
    type: sessionFiles[0]?.startsWith('exit-') ? 'exit' : 'compact',
    messages: sessionFiles.length,
    keywords,
    bugs: detectedBugs,
    patterns: keywords.slice(0, 5) // Top 5 keywords as patterns
  };
}

/**
 * Parse existing entries from intelligence file
 */
function parseExistingEntries(content) {
  const entries = [];
  const sessionBlocks = content.matchAll(/### Session \d+ - (\w+)\n([\s\S]*?)(?=\n### |$(?!\n))/g);

  for (const match of sessionBlocks) {
    const id = match[1];
    const body = match[2];
    const dateMatch = body.match(/\*\*Date:\*\* ([\d-T:]+)/);
    const msgsMatch = body.match(/\*\*Messages:\*\* (\d+)/);
    const bugsMatch = body.match(/\*\*Bugs Fixed:\*\* ([\w, ]+)/);
    const keywordsMatch = body.match(/\*\*Keywords:\*\* ([\w|]+)/);

    entries.push({
      id,
      date: dateMatch?.[1] || '',
      messages: parseInt(msgsMatch?.[1] || '0', 10),
      bugs: bugsMatch?.[1]?.split(',').map(b => b.trim()) || [],
      keywords: keywordsMatch?.[1]?.split('|').map(k => k.trim()) || []
    });
  }

  return entries;
}

/**
 * Generate updated intelligence learning content
 */
function generateIntelligenceContent(entries, latestEntry) {
  const keywords = latestEntry.keywords?.join(' | ') || 'opencode-context-plugin | intelligence-learning';

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

## Key Learnings from Latest Sessions

`;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    content += `### Session ${i + 1} - ${(e.type || 'unknown').toUpperCase()}\n`;
    content += `- **Date:** ${e.date}\n`;
    content += `- **Session ID:** ${e.id}\n`;
    content += `- **Messages:** ${e.messages}\n`;
    if (e.keywords?.length) {
      content += `- **Keywords:** ${e.keywords.join(', ')}\n`;
    }
    if (e.bugs?.length) {
      content += `- **Bugs Fixed:** ${e.bugs.join(', ')}\n`;
    }
    if (e.patterns?.length) {
      content += `- **Patterns:** ${e.patterns.join(', ')}\n`;
    }
    content += '\n';
  }

  // Bug Prevention Guide
  const allBugs = [...new Set(entries.flatMap(e => e.bugs || []))].slice(0, 10);

  content += `## Bug Prevention Guide\n\n`;
  if (allBugs.length > 0) {
    content += `Known issues from historical sessions:\n`;
    for (const bug of allBugs) {
      content += `- ${bug}\n`;
    }
  } else {
    content += `No bugs tracked yet.\n`;
  }

  content += `\n## Related\n`;
  content += `  - [[daily-summary.md]]\n`;
  content += `  - [[reports/weekly-${new Date().getFullYear()}-W${Math.ceil(new Date().getDate() / 7)}.md]]\n`;

  return content;
}