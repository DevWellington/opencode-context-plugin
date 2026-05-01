import { extractSessionContent, extractBugs } from '../modules/contentExtractor.js';
import { createDebugLogger } from '../utils/debug.js';
import path from 'path';
import fs from 'fs/promises';
import { REPORT_PATHS, CONTEXT_SESSION_DIR } from './utils/linkBuilder.js';
import { getWeek } from 'date-fns';

const logger = createDebugLogger('report-extractor');

/**
 * Filter out low-quality patterns that don't represent actual work
 */
export function isLowQualityPattern(pattern) {
  const lower = pattern.toLowerCase();

  // Greetings and non-work
  if (/^(no actual|no prior|the user|conversation initiated|this is the beginning)/i.test(lower)) {
    return true;
  }

  // Generic placeholders
  if (/^(no files|no work|nothing yet|not started)/i.test(lower)) {
    return true;
  }

  // Very short patterns
  if (pattern.length < 20) {
    return true;
  }

  return false;
}

/**
 * Extract structured intelligence from all report levels
 * This supplements session-based extraction with aggregate insights from reports
 */
export async function extractIntelligenceFromReports(directory) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const weekStr = `W${String(getWeek(new Date(), { weekStartsOn: 1, firstWeekContainsDate: 4 })).padStart(2, '0')}`;

  const weekDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month, weekStr);
  const monthDir = path.join(directory, CONTEXT_SESSION_DIR, String(year), month);
  const yearDir = path.join(directory, CONTEXT_SESSION_DIR, String(year));

  const reports = [
    { path: path.join(weekDir, 'week-summary.md'), type: 'weekly' },
    { path: path.join(monthDir, `monthly-${year}-${month}.md`), type: 'monthly' },
    { path: path.join(yearDir, `annual-${year}.md`), type: 'annual' }
  ];

  const result = {
    knownIssues: [],
    successfulApproaches: [],
    failedApproaches: [],
    pendingItems: []
  };

  for (const report of reports) {
    try {
      const content = await fs.readFile(report.path, 'utf-8');
      const extracted = extractFromReportContent(content, report.type);
      result.knownIssues.push(...extracted.knownIssues);
      result.successfulApproaches.push(...extracted.successfulApproaches);
      result.failedApproaches.push(...extracted.failedApproaches);
      result.pendingItems.push(...extracted.pendingItems);
    } catch {
      // Report not ready
    }
  }

  return result;
}

/**
 * Extract intelligence from report content
 */
function extractFromReportContent(content, reportType) {
  const knownIssues = [];
  const successfulApproaches = [];
  const failedApproaches = [];
  const pendingItems = [];

  const lines = content.split('\n');
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect sections
    if (line.startsWith('## Goals') || line.startsWith('## Goals')) {
      currentSection = 'goals';
      continue;
    }
    if (line.startsWith('## Accomplishments') || line.startsWith('## Achieved')) {
      currentSection = 'accomplishments';
      continue;
    }
    if (line.startsWith('## Discoveries') || line.startsWith('## Findings')) {
      currentSection = 'discoveries';
      continue;
    }
    if (line.startsWith('## ') && !currentSection) {
      currentSection = 'other';
      continue;
    }

    // Parse accomplishments - look for completed items
  if (currentSection === 'accomplishments') {
      // ✅ Pattern: completed items
      const completedMatch = line.match(/^[\s]*-[\s]*✅[\s✅]*(.+)/);
      if (completedMatch && completedMatch[1] && !completedMatch[1].includes('PENDENTE')) {
        const item = completedMatch[1].trim();
        // Filter: must be substantive, not a bug description
        if (item.length > 15 && !isLowQualityPattern(item)) {
          // Skip bug descriptions (they belong in Failed Approaches, not Successful)
          // Patterns indicating something was BROKEN/WRONG, not working, not doing something
          // But allow "was fixed" / "was implemented" / "was completed" type patterns
          const bugPatterns = /\b(was\s+not|wasn't|weren't|not\s+(working|handling|properly|deduplicating)|was\s+(hardcoded|generating|causing|broken)|bug|prefix\s+bug|error|issue|contamination|passing\s+through|inconsistent)\b/i;
          // Allow patterns like "was fixed", "was implemented", "was completed"
          const fixedPattern = /\b(was\s+(fixed|implemented|completed|added|created|built|resolved|corrected))\b/i;
          // Allow "X was Y" patterns where Y shows the fix worked (not that it was broken)
          const wasFixed = /(\w+)\s+was\s+(?:corrected|fixed|resolved|implemented|completed|added)/i;
          const hasExplicitFix = fixedPattern.test(item) || wasFixed.test(item);
          const isBugDescription = bugPatterns.test(item) && !hasExplicitFix;
          if (isBugDescription) {
            continue; // Skip bug descriptions
          }
          successfulApproaches.push({
            pattern: item,
            frequency: 1,
            source: reportType
          });
        }
      }

      // ⏳ Pattern: pending items - handle various formats like "✅ ⏳ ... - **PENDENTE**" or "⏳ ... **PENDENTE**"
      const pendingMatch = line.match(/⏳\s*(.+?)[\s]*[-–]?[\s]*\*\*PENDENTE\*\*/);
      if (pendingMatch && pendingMatch[1]) {
        const item = pendingMatch[1].trim();
        if (item.length > 5) {
          pendingItems.push({
            issue: item,
            source: reportType
          });
        }
      }
    }

    // Parse discoveries - look for bugs and patterns
    if (currentSection === 'discoveries') {
      // Bug found pattern - handle both **Bug** and *Bug* formats
      const bugMatch = line.match(/\*\*Bug encontrado:\*\*|\*Bug encontrado:\*\*/i);
      if (bugMatch) {
        // Extract description after Bug encontrado:
        const idx = line.indexOf('Bug encontrado:');
        let bugDesc = '';
        if (idx !== -1) {
          bugDesc = line.slice(idx + 'Bug encontrado:'.length).replace(/^:?\s*/, '').trim();
          // Clean up asterisks from the description
          bugDesc = bugDesc.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
        }
        if (bugDesc.length > 10 && !isLowQualityPattern(bugDesc)) {
          // Split description into anti-pattern and reason if it has structure
          // e.g., "Token propagation não funciona - stats do day não propagam" -> antiPattern="Token propagation não funciona", reason="stats do day não propagam"
          const parts = bugDesc.split(' - ');
          const cleanAntiPattern = parts[0].split(' (')[0].trim().slice(0, 50);
          const hasSeparateContext = parts.length > 1 || bugDesc.includes(' (');
          const reason = hasSeparateContext ? parts.slice(1).join(' - ').replace(/\)$/, '').trim() : '';

          failedApproaches.push({
            antiPattern: cleanAntiPattern || bugDesc.slice(0, 40),
            reason: reason,
            source: reportType
          });
        }
      }

      // 💡 Insight patterns - only substantial ones
      const insightMatch = line.match(/^[\s]*-[\s]*💡[\s💡]*(.+)/);
      if (insightMatch && insightMatch[1]) {
        const insight = insightMatch[1].trim();
        // Skip lines that contain bug patterns (they belong in Failed Approaches)
        if (insight.includes('Bug encontrado')) continue;

        // Skip bug description patterns that appear as insights:
        // These indicate the text is describing a problem, not a solution/insight
        // Don't add to failed approaches - the actual bugs should come from "Bug encontrado:" patterns
        // Patterns: "X issue**", "X problem**", "X bug**", "X contamination**", "was not", "hardcoded", etc.
        // Also skip patterns like "was passing through" (indicates something broken)
        // Skip entries that are clearly bug description format: "**Issue**: description"
        const bugPatterns = /\b(was\s+not|wasn't|weren't|hardcoded|was\s+generating|was\s+not\s+(working|handling|properly|deduplicating)|contamination|prefix\s+bug|was\s+causing|was\s+passing\s+through)\b/i;
        // Also skip lines that start with *asterisks* followed by issue/bug/problem (markdown formatting for bug notes)
        const markdownBugPattern = /^[*]+[A-Za-z]+[-\s]+(issue|problem|bug|error)[*]*$/i;
        // Also skip lines in "X issue**" or "X problem**" format (bug description title format)
        const titleBugPattern = /^[A-Za-z]+[-\s]+(issue|problem|bug|error)[:**]/i;
        if (bugPatterns.test(insight) || markdownBugPattern.test(insight.trim()) || titleBugPattern.test(insight)) {
          continue;  // Skip bug descriptions entirely
        }

        if (insight.length > 25 && !insight.includes('PENDENTE') && !isLowQualityPattern(insight)) {
          successfulApproaches.push({
            pattern: insight.slice(0, 120),
            frequency: 1,
            source: reportType
          });
        }
      }
    }
  }

  return { knownIssues, successfulApproaches, failedApproaches, pendingItems };
}

/**
 * Parse pending items from session content
 * Looks for patterns like "⏳ ... PENDENTE" or "Bug encontrado:"
 */
export function extractPendingItemsFromContent(content) {
  const pending = [];

  // Pattern: ⏳ description - **PENDENTE**
  const pendeRegex = /⏳\s*(.+?)[\s]*[-–]?[\s]*\*\*PENDENTE\*\*/gi;
  let match;
  while ((match = pendeRegex.exec(content)) !== null) {
    pending.push({
      issue: match[1].trim(),
      type: 'pending'
    });
  }

  // Pattern: **Bug encontrado:** description
  const bugRegex = /\*\*Bug encontrado:\*\*\s*(.+)/gi;
  while ((match = bugRegex.exec(content)) !== null) {
    pending.push({
      issue: match[1].trim(),
      type: 'bug'
    });
  }

  return pending;
}

/**
 * Parse accomplished items from content
 * Looks for patterns like "✅ ✅ description" or "- ✅ description"
 */
export function extractAccomplishedFromContent(content) {
  const accomplishments = [];

  // Pattern: ✅ ✅ description or - ✅ description
  const accRegex = /(?:^|\n)[\s]*-[\s]*✅[\s✅]*(.+?)(?=\n|$)/g;
  let match;
  while ((match = accRegex.exec(content)) !== null) {
    const item = match[1].trim();
    if (item.length > 5 && !item.includes('PENDENTE')) {
      accomplishments.push(item);
    }
  }

  return accomplishments;
}

/**
 * Merge and deduplicate patterns from multiple sources
 */
export function mergePatterns(reportPatterns, sessionPatterns) {
  const allPatterns = [...reportPatterns];

  // Add session patterns
  if (sessionPatterns && Array.isArray(sessionPatterns)) {
    allPatterns.push(...sessionPatterns);
  }

  // Deduplicate by normalized pattern
  const seen = new Map();
  for (const p of allPatterns) {
    const key = (p.pattern || p.issue || '').toLowerCase().slice(0, 50);
    if (!key) continue;

    if (seen.has(key)) {
      seen.get(key).frequency = (seen.get(key).frequency || 1) + 1;
    } else {
      seen.set(key, { ...p, frequency: p.frequency || 1 });
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.frequency - a.frequency);
}