import { getWeek } from 'date-fns';
import { findPatterns } from '../modules/contentExtractor.js';
import { cleanOldLinks, stripFieldHeader } from './intelligenceDeduplicator.js';

export const REFERENCE_SCHEMA = {
  projectState: {
    projectName: '',
    lastUpdated: '',
    sessionsTracked: 0,
    activePhase: ''
  },
  knownIssues: [],
  successfulApproaches: [],
  failedApproaches: [],
  recentPatterns: []
};

export function generateReferenceContent(patternData) {
  const lines = [];
  const timestamp = new Date().toISOString().split('T')[0];

  lines.push('# Intelligence Learning');
  lines.push('');
  lines.push('## Project State');
  lines.push(`- **Project:** ${patternData.projectState?.projectName || 'opencode-context-plugin'}`);
  lines.push(`- **Last Updated:** ${patternData.projectState?.lastUpdated || timestamp}`);
  lines.push(`- **Sessions Tracked:** ${patternData.projectState?.sessionsTracked || 0}`);
  lines.push(`- **Active Phase:** ${patternData.projectState?.activePhase || 'N/A'}`);
  lines.push('');
  lines.push('## Known Issues');
  if (patternData.knownIssues && patternData.knownIssues.length > 0) {
    for (const issue of patternData.knownIssues.slice(0, 10)) {
      const loc = issue.location ? ` (${issue.location})` : '';
      lines.push(`- ${issue.title || issue.description}${loc}`);
    }
  } else {
    lines.push('- No known issues');
  }
  lines.push('');
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
  lines.push('## Failed Approaches');
  if (patternData.failedApproaches && patternData.failedApproaches.length > 0) {
    for (const approach of patternData.failedApproaches.slice(0, 10)) {
      const loc = approach.location ? ` (${approach.location})` : '';
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
  lines.push('## Recent Patterns');
  if (patternData.recentPatterns && patternData.recentPatterns.length > 0) {
    // Group patterns by concrete context (file/module) not just generic theme
    const patternGroups = new Map();
    for (const pattern of patternData.recentPatterns) {
      // Extract concrete context from pattern name - look for file-like or module-like parts
      const words = pattern.name.split(/[\s\-_:]+/);
      const concreteParts = words.filter(w =>
        w.length > 3 &&
        /^[a-zA-Z]/.test(w) &&
        !/^(the|and|for|from|with|that|this|when|then|than)$/i.test(w) &&
        !/^(theme|pattern|approach|issue|bug|fix|feature)$/i.test(w)
      );
      const concreteContext = concreteParts.slice(0, 2).join('-').toLowerCase() || pattern.name.slice(0, 20).toLowerCase();

      if (!patternGroups.has(concreteContext)) {
        patternGroups.set(concreteContext, {
          type: pattern.type,
          context: concreteContext,
          names: [],
          totalFrequency: 0
        });
      }
      const group = patternGroups.get(concreteContext);
      group.names.push(pattern.name);
      group.totalFrequency += pattern.frequency;
    }

    // Output grouped patterns with concrete context
    for (const [ctx, group] of patternGroups) {
      const uniqueNames = [...new Set(group.names)].slice(0, 3);
      const nameStr = uniqueNames.length > 1
        ? uniqueNames.map(n => n.slice(0, 25)).join(', ')
        : uniqueNames[0] || ctx;
      lines.push(`- ${group.type}: ${nameStr} (${group.totalFrequency} sessions)`);
    }
  } else {
    lines.push('- No patterns detected yet');
  }
  lines.push('');
  lines.push('---');
  lines.push(`Generated: ${timestamp}`);

  return lines.join('\n');
}

export function generateIntelligenceContent(entries, latestEntry) {
  const rawKeywords = latestEntry.keywords || [];
  const uniqueKeywords = [...new Set(rawKeywords.map(k => k.toLowerCase()))].map(k => rawKeywords.find(item => item.toLowerCase() === k));
  const keywordsList = uniqueKeywords?.length > 0
    ? [...new Set(uniqueKeywords)].map(k => `[[${k}]]`).join(' | ')
    : '[[opencode-context-plugin]] | [[intelligence-learning]]';

  const allSessions = entries.flatMap(e => e.sessions || []);

  const patternSessions = allSessions
    .filter(s => s.content || (s.goal || s.accomplished || s.discoveries))
    .map((s, i) => ({
      sessionId: s.sessionId || `session-${i}`,
      content: s.content || `## Goal\n${s.goal || ''}\n\n## Accomplished\n${s.accomplished || ''}\n\n## Discoveries\n${s.discoveries || ''}`
    }));

  const patterns = patternSessions.length >= 2 ? findPatterns(patternSessions) : [];

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

        if (session.goal) {
          content += `## Goal\n${cleanOldLinks(stripFieldHeader(session.goal, 'Goal'))}\n\n`;
        }
        if (session.firstUserMessage) {
          content += `## Instructions\n${cleanOldLinks(stripFieldHeader(session.firstUserMessage, 'Instructions'))}\n\n`;
        }
        if (session.discoveries) {
          content += `## Discoveries\n${cleanOldLinks(stripFieldHeader(session.discoveries, 'Discoveries'))}\n\n`;
        }
        if (session.accomplished) {
          content += `## Accomplished\n${cleanOldLinks(stripFieldHeader(session.accomplished, 'Accomplished'))}\n\n`;
        }
        if (session.relevantFiles?.length) {
          content += `## Relevant Files\n${session.relevantFiles.map(f => `- ${f}`).join('\n')}\n\n`;
        }

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
      content += `### Session ${i + 1} - ${(e.type || 'unknown').toUpperCase()}\n`;
      content += `- **Date:** ${e.date}\n`;
      content += `- **Session ID:** ${e.id}\n`;
      if (e.messages) content += `- **Messages:** ${e.messages}\n`;
      if (e.keywords?.length) content += `- **Keywords:** ${e.keywords.join(', ')}\n`;
      content += '\n';
    }
  }

  if (patterns.length > 0) {
    content += `## Patterns from Recent Sessions\n\n`;
    for (const pattern of patterns.slice(0, 10)) {
      content += `- **${pattern.pattern}:** seen in ${pattern.frequency} sessions\n`;
    }
    content += '\n';
  }

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

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentWeek = `W${String(getWeek(now, { weekStartsOn: 1, firstWeekContainsDate: 4 })).padStart(2, '0')}`;
  content += `  - [[${currentYear}/${currentMonth}/${currentWeek}/week-summary.md]]\n`;

  return content;
}