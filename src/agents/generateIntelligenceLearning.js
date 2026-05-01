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
import { isLowQualityPattern } from './reportExtractor.js';

const logger = createDebugLogger('intelligence');

const INTELLIGENCE_FILE = 'intelligence-learning.md';
const MAX_ENTRIES = 20;

/**
 * Reference Content Schema
 * Clean, compact format for intelligence-learning.md (~50 lines)
 */
export const REFERENCE_SCHEMA = {
  projectState: {
    projectName: '',
    lastUpdated: '',
    sessionsTracked: 0,
    activePhase: ''
  },
  knownIssues: [], // { id, description, location }
  successfulApproaches: [], // { pattern, context, frequency, location }
  failedApproaches: [], // { antiPattern, reason, location }
  recentPatterns: [] // { type, name, frequency }
};

/**
 * Generate compact reference content from pattern data
 * Output format: ~50 lines with clean sections (no raw content, no backticks)
 * 
 * @param {Object} patternData - Structured pattern data following REFERENCE_SCHEMA
 * @returns {string} Markdown content in compact reference format
 */
export function generateReferenceContent(patternData) {
  const lines = [];
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Header
  lines.push('# Intelligence Learning');
  lines.push('');
  
  // Project State section
  lines.push('## Project State');
  lines.push(`- **Project:** ${patternData.projectState?.projectName || 'opencode-context-plugin'}`);
  lines.push(`- **Last Updated:** ${patternData.projectState?.lastUpdated || timestamp}`);
  lines.push(`- **Sessions Tracked:** ${patternData.projectState?.sessionsTracked || 0}`);
  lines.push(`- **Active Phase:** ${patternData.projectState?.activePhase || 'N/A'}`);
  lines.push('');
  
  // Known Issues section
  lines.push('## Known Issues');
  if (patternData.knownIssues && patternData.knownIssues.length > 0) {
    for (const issue of patternData.knownIssues.slice(0, 10)) {
      const loc = issue.location ? ` (${issue.location})` : '';
      lines.push(`- ${issue.id || 'ISSUE'}: ${issue.description}${loc}`);
    }
  } else {
    lines.push('- No known issues');
  }
  lines.push('');
  
  // Successful Approaches section
  lines.push('## Successful Approaches');
  if (patternData.successfulApproaches && patternData.successfulApproaches.length > 0) {
    for (const approach of patternData.successfulApproaches.slice(0, 10)) {
      const freq = approach.frequency ? ` (seen ${approach.frequency} times)` : '';
      const loc = approach.location ? ` (${approach.location})` : '';
      lines.push(`- ${approach.pattern}${freq}${loc}`);
    }
  } else {
    lines.push('- No patterns recorded yet');
  }
  lines.push('');
  
  // Failed Approaches section
  lines.push('## Failed Approaches');
  if (patternData.failedApproaches && patternData.failedApproaches.length > 0) {
    for (const approach of patternData.failedApproaches.slice(0, 10)) {
      const loc = approach.location ? ` (${approach.location})` : '';
      // If antiPattern already looks complete, don't add reason
      // If antiPattern is a partial phrase followed by "because X", skip adding more
      const hasBecauseInAnti = approach.antiPattern.includes(' because');
      if (approach.reason && !hasBecauseInAnti) {
        lines.push(`- ANTI-PATTERN: ${approach.antiPattern} because ${approach.reason}${loc}`);
      } else {
        lines.push(`- ANTI-PATTERN: ${approach.antiPattern}${loc}`);
      }
    }
  } else {
    lines.push('- No failed approaches recorded');
  }
  lines.push('');
  
  // Recent Patterns section
  lines.push('## Recent Patterns');
  if (patternData.recentPatterns && patternData.recentPatterns.length > 0) {
    for (const pattern of patternData.recentPatterns.slice(0, 10)) {
      lines.push(`- ${pattern.type}: ${pattern.name} (${pattern.frequency} sessions)`);
    }
  } else {
    lines.push('- No patterns detected yet');
  }
  lines.push('');
  
  // Footer
  lines.push('---');
  lines.push(`Generated: ${timestamp}`);
  
  return lines.join('\n');
}

// Greeting patterns to filter out - messages that are just salutations
/**
 * Transform session entries into reference schema format
 * Converts raw session data into compact patterns and issues
 *
 * @param {Array} allEntries - All monthly entries with sessions from readMonthlyFiles()
 * @param {Object} latestEntry - Most recent monthly entry for new session data
 * @returns {Object} Reference schema with { projectState, knownIssues, successfulApproaches, failedApproaches, recentPatterns }
 *
 * Input: extractBugs() returns { symptom, cause, solution, prevention }
 *
 * Transformations:
 * - Unresolved bug (no solution) → knownIssues with { id, description, location }
 * - Resolved bug (has solution) → failedApproaches with { antiPattern, reason, location }
 *
 * ID generation: BUG-${symptom.slice(0,20).replace(/\s+/g, '-').toUpperCase()}
 * Location: session.relevantFiles[0]:bug.line
*/
function transformToReferenceSchema(allEntries, latestEntry, reportIntelligence = null) {
  const timestamp = new Date().toISOString().split('T')[0];
  const allSessions = allEntries.flatMap(e => e.sessions || []);

  // Build project state
  const projectState = {
    projectName: 'opencode-context-plugin',
    lastUpdated: timestamp,
    sessionsTracked: allEntries.reduce((sum, e) => sum + (e.sessionCount || 0), 0),
    activePhase: 'intelligence-learning-reform'
  };

  // Extract known issues and failed approaches from bugs
  const knownIssues = [];
  const failedApproaches = [];

  for (const session of allSessions) {
    if (session.bugs?.length) {
      for (const bug of session.bugs) {
        if (bug.solution || bug.resolution) {
          // Resolved bug = failed approach
          failedApproaches.push({
            antiPattern: bug.symptom,
            reason: bug.cause || 'resolved with workaround',
            location: session.relevantFiles?.[0] ? `${session.relevantFiles[0]}:${bug.line || 0}` : ''
          });
        } else {
          // Unresolved bug = known issue
          knownIssues.push({
            id: `BUG-${(bug.symptom || 'unknown').slice(0, 20).replace(/\s+/g, '-').toUpperCase()}`,
            description: bug.symptom,
            location: session.relevantFiles?.[0] ? `${session.relevantFiles[0]}:${bug.line || 0}` : ''
          });
        }
      }
    }
  }

  // Extract successful approaches from accomplishments
  const successfulApproaches = [];
  const seenAccomplishments = new Set();

  for (const session of allSessions) {
    const acc = session.accomplished;
    if (acc && acc.length >= 20 && !seenAccomplishments.has(acc)) {
      // Skip truncated/incomplete content
      if (acc.endsWith('...')) continue;
      if (/[a-z]\s*$/i.test(acc)) continue; // Ends mid-word

      // Skip if it's actually a bug description (not a real accomplishment)
      // Check for any mention of bugs, errors, or problematic patterns anywhere in the text
      const bugPatterns = /\b(bug|error|issue|hardcoded|generating|causing|caused|broken|prefix|not working|doesn't work|cannot handle)/i;
      if (bugPatterns.test(acc)) continue;

      // Skip low quality patterns
      if (isLowQualityPattern(acc)) continue;

      // Clean the text - remove markdown artifacts
      const cleanAcc = acc.replace(/[#*`\[\]]/g, '').trim();
      if (cleanAcc.length < 25) continue;

      // Normalize for deduplication - extract first 50 chars as key
      const normalizedKey = cleanAcc.slice(0, 50).toLowerCase();
      if (seenAccomplishments.has(normalizedKey)) continue;
      seenAccomplishments.add(normalizedKey);

      // Also track full pattern for exact dedup
      seenAccomplishments.add(cleanAcc);

      // Create pattern: "when [goal], do [accomplishment]"
      const patternText = session.goal && session.goal.length > 3
        ? `when ${session.goal.slice(0, 30)}, do ${cleanAcc.slice(0, 80)}`
        : cleanAcc.slice(0, 120);

      successfulApproaches.push({
        pattern: patternText,
        context: session.title || '',
        frequency: 1,
        location: session.relevantFiles?.[0] || ''
      });
    }
  }

  // Merge intelligence from reports (week/monthly/annual summaries)
  if (reportIntelligence) {
    // Add pending items as known issues
    for (const pending of (reportIntelligence.pendingItems || [])) {
      const id = `ISSUE-${(pending.issue || 'unknown').slice(0, 15).replace(/\s+/g, '-').toUpperCase()}`;
      // Avoid duplicates
      if (!knownIssues.some(k => k.description === pending.issue)) {
        knownIssues.push({
          id,
          description: pending.issue,
          location: pending.source || ''
        });
      }
    }

    // Add failed approaches from report discoveries (bugs found)
    for (const failed of (reportIntelligence.failedApproaches || [])) {
      if (failed.antiPattern && !failedApproaches.some(f => f.antiPattern === failed.antiPattern)) {
        failedApproaches.push({
          antiPattern: failed.antiPattern,
          reason: failed.reason || '',
          location: failed.source || ''
        });
      }
    }

    // Add successful approaches from report insights
    for (const success of (reportIntelligence.successfulApproaches || [])) {
      if (success.pattern && !seenAccomplishments.has(success.pattern)) {
        const cleanPattern = success.pattern.replace(/[#*`\[\]]/g, '').trim();

        // Skip low quality and bug descriptions
        if (isLowQualityPattern(cleanPattern)) continue;
        if (/\b(bug|error|issue|was\s+(hardcoded|generating|causing|broken)|prefix|not working)/i.test(cleanPattern)) continue;
        if (cleanPattern.length < 20) continue;

        // Normalize for deduplication - extract first 50 chars as key
        // This handles truncation variations (e.g., "...context" vs "...context-session...")
        const normalizedKey = cleanPattern.slice(0, 50).toLowerCase();
        if (seenAccomplishments.has(normalizedKey)) continue;
        seenAccomplishments.add(normalizedKey);

        // Also track full pattern for exact dedup
        seenAccomplishments.add(cleanPattern);

        successfulApproaches.push({
          pattern: cleanPattern.slice(0, 120),
          context: success.source || '',
          frequency: success.frequency || 1,
          location: ''
        });
      }
    }
  }

  // Deduplicate knownIssues that overlap with failedApproaches
  const knownIssuesDeduped = knownIssues.filter(ki => {
    const normalizedKi = (ki.description || '').toLowerCase().slice(0, 40);
    return !failedApproaches.some(fa =>
      (fa.antiPattern || '').toLowerCase().includes(normalizedKi) ||
      normalizedKi.includes((fa.antiPattern || '').toLowerCase().slice(0, 30))
    );
  });

  // Use findPatterns for recent patterns
  const patternSessions = allSessions
    .filter(s => s.goal || s.accomplished || s.discoveries)
    .map((s, i) => ({
      sessionId: s.sessionId || `session-${i}`,
      content: `## Goal\n${s.goal || ''}\n\n## Accomplished\n${s.accomplished || ''}\n\n## Discoveries\n${s.discoveries || ''}`
    }));
  
  const patterns = patternSessions.length >= 2 ? findPatterns(patternSessions) : [];
  const recentPatterns = patterns.slice(0, 5).map(p => ({
    type: p.pattern.split(':')[0] || 'general',
    name: p.pattern.split(':').slice(1).join(':').trim() || p.pattern,
    frequency: p.frequency
  }));

  return {
    projectState,
    knownIssues: knownIssuesDeduped.slice(0, 10),
    successfulApproaches: successfulApproaches.slice(0, 10),
    failedApproaches: failedApproaches.slice(0, 10),
    recentPatterns
  };
}

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
  const patternData = transformToReferenceSchema(allEntries, deduplicatedEntry, reportIntelligence);

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
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  // Calculate ISO week number using same logic as reportGenerator
  const isoWeek = String(getWeek(today, { weekStartsOn: 1, firstWeekContainsDate: 4 })).padStart(2, '0');
  const weekDir = `W${isoWeek}`;

  // Try to find session directory
  let sessionDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month, weekDir, day);
  let sessionFiles = [];

  try {
    const files = await fs.readdir(sessionDir);
    sessionFiles = files.filter(f => f.endsWith('.md'));
  } catch {
    // Try searching for today's sessions in any week directory
    const baseDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month);
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
    // But allow sessions with structured content (## Goal, ## Accomplished, etc.)
    if (isGreeting(firstUserMessage) && !hasStructuredWorkContent(content)) {
      continue;
    }
    if (isGreetingTitle(title, hasStructuredWorkContent(content))) {
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
/**
 * Clean old/deprecated links from content
 * Removes references to old flat reports/ structure
 */
function cleanOldLinks(content) {
  if (!content) return '';
  // Remove links to old reports/ directory and deprecated paths, plus truncation markers
  return content
    .replace(/\[\[reports\/[^\]]+\]\]/g, '')
    .replace(/\[\[\.opencode\/context-session\/reports\/[^\]]+\]\]/g, '')
    .replace(/\*\(truncated\)\*/g, '')
    .replace(/\[truncated\]/g, '')
    .trim();
}

function generateIntelligenceContent(entries, latestEntry) {
  const rawKeywords = latestEntry.keywords || [];
  const uniqueKeywords = [...new Set(rawKeywords.map(k => k.toLowerCase()))].map(k => rawKeywords.find(item => item.toLowerCase() === k));
  const keywordsList = uniqueKeywords?.length > 0
    ? [...new Set(uniqueKeywords)].map(k => `[[${k}]]`).join(' | ')
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

  // Build accomplishments list for pattern analysis - deduplicate using Set
  const accomplishmentSet = new Set();
  const accomplishments = allSessions
    .map(s => s.accomplished)
    .filter(Boolean)
    .filter(a => {
      if (accomplishmentSet.has(a)) return false;
      accomplishmentSet.add(a);
      return true;
    })
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
        // Clean old links before writing
        if (session.goal) {
          content += `## Goal\n${cleanOldLinks(session.goal)}\n\n`;
        }
        if (session.firstUserMessage) {
          content += `## Instructions\n${cleanOldLinks(session.firstUserMessage)}\n\n`;
        }
        if (session.discoveries) {
          content += `## Discoveries\n${cleanOldLinks(session.discoveries)}\n\n`;
        }
        if (session.accomplished) {
          content += `## Accomplished\n${cleanOldLinks(session.accomplished)}\n\n`;
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

  // Weekly report link using current date's hierarchical path
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentWeek = `W${String(getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 })).padStart(2, '0')}`;
  content += `  - [[${currentYear}/${currentMonth}/${currentWeek}/week-summary.md]]\n`;

  return content;
}