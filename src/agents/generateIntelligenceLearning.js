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
import { getWeek } from 'date-fns';
import { REPORT_PATHS, CONTEXT_SESSION_DIR } from './utils/linkBuilder.js';
import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { extractSessionContent, extractBugs, findPatterns, inferMissingFields } from '../modules/contentExtractor.js';
import { preservePersistentPatterns } from '../modules/intelligence.js';
import { isGreeting, isGreetingTitle, isGreetingContent, hasStructuredWorkContent } from '../utils/greetingFilter.js';
import { extractIntelligenceFromReports, mergePatterns } from './reportExtractor.js';
import { parseExistingEntries, transformToReferenceSchema, stripFieldHeader, cleanOldLinks } from './intelligenceDeduplicator.js';
import { ISSUE_PATTERNS, FAILED_APPROACH_PATTERNS, LOW_QUALITY_ACCOMPLISHMENT_PATTERNS, containsIssuePattern, isLowQualityAccomplishment } from './intelligencePatterns.js';
import { REFERENCE_SCHEMA, generateReferenceContent, generateIntelligenceContent } from './intelligenceTemplate.js';

export { REFERENCE_SCHEMA, generateReferenceContent, generateIntelligenceContent };

const logger = createDebugLogger('intelligence');

const INTELLIGENCE_FILE = 'intelligence-learning.md';
const MAX_ENTRIES = 20;

export async function updateIntelligenceLearning(directory, opencodeClient = null) {
  const config = getConfig();
  const intelligencePath = path.join(directory, REPORT_PATHS.intelligence);

  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const weekStr = `W${String(getWeek(new Date(), { weekStartsOn: 1, firstWeekContainsDate: 4 })).padStart(2, '0')}`;

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
      allReportsContent += cleanOldLinks(content) + '\n\n';
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

  // Deduplicate by file path (stable ID), not by content which changes on edit
  const existingKeys = new Set();
  for (const entry of existingEntries) {
    for (const session of (entry.sessions || [])) {
      const key = session.filepath || `${session.title || ''}|${session.firstUserMessage || ''}`;
      existingKeys.add(key);
    }
  }

  // Filter out sessions that already exist (by path, which is stable across edits)
  const newSessions = (newSessionInfo.sessions || []).filter(session => {
    const key = session.filepath || `${session.title || ''}|${session.firstUserMessage || ''}`;
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

  // Apply LLM analysis to sessions when client is available
  if (opencodeClient?.sessions?.prompt) {
    logger('[intelligence] Using LLM analysis for enhanced pattern detection');
    for (const session of newSessions) {
      try {
        // Build session content from available fields
        const sessionContent = [
          `Title: ${session.title || ''}`,
          `Goal: ${session.goal || ''}`,
          `Instructions: ${session.instructions || ''}`,
          `Accomplished: ${session.accomplished || ''}`,
          `Discoveries: ${session.discoveries || ''}`,
          `Relevant Files: ${(session.relevantFiles || []).join(', ')}`
        ].join('\n');

        // Use inferMissingFields to get LLM-enhanced structured data
        const inferred = await inferMissingFields(sessionContent, opencodeClient);

        // Update session with LLM-inferred data if we got better confidence
        if (inferred.confidence.goal > 0.5 && inferred.goal && !session.goal) {
          session.goal = inferred.goal;
        }
        if (inferred.confidence.accomplished > 0.5 && inferred.accomplished && !session.accomplished) {
          session.accomplished = inferred.accomplished;
        }
        if (inferred.confidence.discoveries > 0.5 && inferred.discoveries && !session.discoveries) {
          session.discoveries = inferred.discoveries;
        }

        logger(`[intelligence] LLM analysis completed for session: ${session.title}`);
      } catch (error) {
        logger(`[intelligence] LLM analysis failed for session: ${error.message}`);
        // Continue without LLM enhancement - non-blocking
      }
    }
  } else {
    logger('[intelligence] No LLM client available, using mechanical extraction only');
  }

  // Create deduplicated entry with filtered sessions
  const deduplicatedEntry = {
    ...newSessionInfo,
    sessions: newSessions,
    sessionCount: newSessions.length
  };

  // Add new entry at the beginning, capped at MAX_ENTRIES
  const allEntries = [deduplicatedEntry, ...existingEntries].slice(0, MAX_ENTRIES);

  // Extract patterns from new sessions for preservePersistentPatterns
  const sessionPatterns = (newSessionInfo.sessions || []).map(s => ({
    pattern: s.title || s.goal || '',
    sessionCount: 1
  }));

  // Preserve pinned patterns (seen 3+ times) from existing content
  const { pinnedContent } = preservePersistentPatterns(existingContent, sessionPatterns);

  // Extract intelligence from reports (week/monthly/annual summaries)
  const reportIntelligence = await extractIntelligenceFromReports(directory);

  // Transform to reference schema format
  const patternData = transformToReferenceSchema(allEntries, deduplicatedEntry, reportIntelligence, config);

  // Generate updated content using new compact format
  const pinnedSection = pinnedContent ? `# Pinned Patterns\n\n${pinnedContent}\n\n` : '';
  const content = pinnedSection + generateReferenceContent(patternData);

  // Save
  await fs.mkdir(path.dirname(intelligencePath), { recursive: true });
  await fs.writeFile(intelligencePath, content, 'utf-8');

  return { success: true, entries: allEntries.length, newSessions: newSessions.length };
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

  // Scan ALL months in the year, not just current month
  const allSessionFiles = [];
  
  const yearDir = path.join(directory, CONTEXT_SESSION_DIR, String(year));
  
  try {
    const months = await fs.readdir(yearDir);
    for (const month of months) {
      if (!/^\d{2}$/.test(month)) continue; // Skip non-month directories
      const monthDir = path.join(yearDir, month);
      
      try {
        const weeks = await fs.readdir(monthDir);
        for (const week of weeks) {
          if (!week.startsWith('W')) continue;
          const weekDir = path.join(monthDir, week);
          
          try {
            const entries = await fs.readdir(weekDir);
            for (const entry of entries) {
              const entryPath = path.join(weekDir, entry);
              const stat = await fs.stat(entryPath);
              
              if (stat.isDirectory()) {
                // Day directory - scan for session files
                const dayFiles = await fs.readdir(entryPath);
                for (const file of dayFiles) {
                  if (file.endsWith('.md') && (file.startsWith('compact-') || file.startsWith('exit-'))) {
                    allSessionFiles.push({ file, dir: entryPath });
                  }
                }
              } else if (entry.endsWith('.md') && (entry.startsWith('compact-') || entry.startsWith('exit-'))) {
                // Session file directly in week dir
                allSessionFiles.push({ file: entry, dir: weekDir });
              }
            }
          } catch {
            // Skip inaccessible week dirs
          }
        }
      } catch {
        // Skip inaccessible month dirs
      }
    }
  } catch {
    // No year directory found
  }

  // Use allSessionFiles that was collected from ALL months
  const sessionFiles = allSessionFiles.map(f => f.file);
  const sessionDir = directory; // We'll use full path below

  // Extract structured content from each session file
  const sessionSummaries = [];
  for (const { file, dir } of allSessionFiles) {
    const fullPath = path.join(dir, file);
    const content = await fs.readFile(fullPath, 'utf-8');
    
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
    // But allow sessions with structured content (## Goal, ## Accomplished, etc.)
    if (isGreeting(firstUserMessage) && !hasStructuredWorkContent(content)) {
      continue;
    }
    if (isGreetingTitle(title, hasStructuredWorkContent(content))) {
      continue;
    }
    
    sessionSummaries.push({
      filename: file,
      filepath: fullPath,
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