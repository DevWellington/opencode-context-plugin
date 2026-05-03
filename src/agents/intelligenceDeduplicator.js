import { findPatterns, isValidBugSymptom } from '../modules/contentExtractor.js';
import { FAILED_APPROACH_PATTERNS, containsIssuePattern, isLowQualityAccomplishment } from './intelligencePatterns.js';
import { isLowQualityPattern } from './reportExtractor.js';

export function parseExistingEntries(content) {
  const entries = [];

  const sessionBlocks = content.matchAll(/### (\d{4}-\d{2}-\d{2}) - (\d+) sessions\n([\s\S]+?)\n(?=### \d{4}|## Related|\Z)/g);

  for (const match of sessionBlocks) {
    const dateStr = match[1];
    const body = match[3];

    const sessionTitles = [...body.matchAll(/#### (.+)/g)].map(m => m[1]);
    const requests = [...body.matchAll(/- \*\*Request:\*\* (.+)/g)].map(m => m[1]);
    const accomplished = [...body.matchAll(/- \*\*Accomplished:\*\* (.+)/g)].map(m => m[1]);

    const sessions = sessionTitles.map((title, i) => ({
      title,
      firstUserMessage: requests[i] || '',
      accomplished: accomplished[i] || ''
    }));

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

  const seen = new Set();
  const deduplicated = entries.filter(entry => {
    for (const session of (entry.sessions || [])) {
      const key = `${session.title || ''}|${session.firstUserMessage || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });

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

function stripFieldHeader(value, header) {
  if (!value || typeof value !== 'string') return value;
  const pattern = new RegExp(`^##\\s+${header}\\s*\\n`, 'i');
  return value.replace(pattern, '');
}

function cleanOldLinks(content) {
  if (!content) return '';
  return content
    .replace(/\[\[reports\/[^\]]+\]\]/g, '')
    .replace(/\[\[\.opencode\/context-session\/reports\/[^\]]+\]\]/g, '')
    .replace(/\*\(truncated\)\*/g, '')
    .replace(/\[truncated\]/g, '')
    .trim();
}

export function transformToReferenceSchema(allEntries, latestEntry, reportIntelligence = null, config = null) {
  const timestamp = new Date().toISOString().split('T')[0];
  const allSessions = allEntries.flatMap(e => e.sessions || []);

  const projectState = {
    projectName: 'opencode-context-plugin',
    lastUpdated: timestamp,
    sessionsTracked: allEntries.reduce((sum, e) => sum + (e.sessionCount || 0), 0),
    activePhase: 'intelligence-learning-reform'
  };

  const knownIssues = [];
  const failedApproaches = [];

  for (const session of allSessions) {
    // Skip entire session if title indicates architectural review (not a bug report)
    const sessionTitleLower = (session.title || '').toLowerCase();
    if (/\b(arquitetura|architecture)\b/.test(sessionTitleLower)) continue;

    if (session.bugs?.length) {
      for (const bug of session.bugs) {
        if (bug.solution || bug.resolution) {
          failedApproaches.push({
            antiPattern: bug.symptom,
            reason: bug.cause || 'resolved with workaround',
            location: session.relevantFiles?.[0] ? `${session.relevantFiles[0]}:${bug.line || 0}` : ''
          });
        } else {
          // Apply comprehensive validation using isValidBugSymptom
          // This filters out: file:line refs, fragments, module names, truncated content
          if (!isValidBugSymptom(bug.symptom)) continue;

          // Also filter architectural observations
          const symptomLower = (bug.symptom || '').toLowerCase();
          if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(symptomLower)) continue;

          const id = `BUG-${(bug.symptom || 'unknown').slice(0, 20).replace(/\s+/g, '-').toUpperCase()}`;
          if (!knownIssues.some(k => k.id === id)) {
            knownIssues.push({
              id,
              description: bug.symptom,
              location: session.relevantFiles?.[0] ? `${session.relevantFiles[0]}:${bug.line || 0}` : ''
            });
          }
        }
      }
    }
  }

  for (const session of allSessions) {
    // Skip architectural review sessions
    const sessionTitleLower = (session.title || '').toLowerCase();
    if (/\b(arquitetura|architecture)\b/.test(sessionTitleLower)) continue;

    const discoveries = session.discoveries || '';
    if (!discoveries) continue;

    for (const { pattern, antiPattern, reason } of FAILED_APPROACH_PATTERNS) {
      if (pattern.test(discoveries)) {
        if (!failedApproaches.some(f => f.antiPattern === antiPattern)) {
          failedApproaches.push({
            antiPattern,
            reason,
            location: session.relevantFiles?.[0] || session.title || ''
          });
        }
      }
    }

    if (containsIssuePattern(discoveries)) {
      const sentences = discoveries.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length >= 15)  // Remove very short fragments
        .filter(s => !/^[()\[\]]/.test(s))  // Remove parenthetical-only fragments
        .filter(s => !/^\d+$/.test(s))  // Remove pure numbers
        .filter(s => containsIssuePattern(s));
      for (const sentence of sentences.slice(0, 3)) {
        const cleanSentence = sentence.replace(/[#*`\[\]]/g, '').trim();
        if (cleanSentence.length > 15) {
          // Filter out architectural observations (not actual bugs)
          // Handle English, Portuguese, Spanish terms
          const lowerClean = cleanSentence.toLowerCase();
          if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(lowerClean)) continue;

          // Also filter if session title indicates architectural review
          if (/\b(arquitetura|architecture)\b/.test(sessionTitleLower)) continue;

          // Apply bug symptom validation to filter out malformed entries
          // (file:line references, fragments, module names, etc.)
          if (!isValidBugSymptom(cleanSentence)) continue;

          // Use first 60 chars of description for ID but keep full cleanSentence for display
          const idKey = cleanSentence.slice(0, 60).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
          const id = `ISSUE-${idKey}`;
          const isDuplicate = knownIssues.some(k =>
            k.id === id || (k.description && cleanSentence &&
              (k.description.slice(0, 40) === cleanSentence.slice(0, 40) ||
               k.description.includes(cleanSentence.slice(0, 30))))
          );
          if (!isDuplicate) {
            knownIssues.push({
              id,
              title: cleanSentence,
              description: cleanSentence,
              location: session.title || ''
            });
          }
        }
      }
    }
  }

  const successfulApproaches = [];
  const seenAccomplishments = new Set();

  for (const session of allSessions) {
    const acc = session.accomplished;
    if (acc && acc.length >= 15 && !seenAccomplishments.has(acc)) {
      // Skip truncated content
      if (acc.endsWith('...')) continue;
      // Skip incomplete sentences - only if ends with single letter followed by space
      // (e.g., "Fixing bug i" or "Implementing feature a")
      // But allow complete words ending in lowercase (e.g., "construtor", "bug", "feature")
      if (/^[a-z]\s*$/.test(acc.slice(-2))) continue;

      // Strip leading bullets and emojis before checking action verbs
      // e.g., "- ✅ Implementado..." -> "Implementado..."
      const strippedAcc = acc.replace(/^[-*]\s*/, '').replace(/^[✅💡🐛🔧📝🔍📦🚪]\s*/u, '').trim();

      // Allow accomplishments that START with action verbs - these are valid outcomes
      // e.g., "Fixed X bug", "Implemented Y feature", "Refactored Z module"
      // Support both English and Portuguese action verbs
      const actionVerbPattern = /^(Added|Fixed|Improved|Implemented|Refactored|Created|Updated|Removed|Resolved|Corrected|Built|Migrated|Implementado|Corrigido|Melhorado|Removido|Atualizado|Criado|Resolvido|Migrado|Construído)\s+/i;
      const hasActionVerb = actionVerbPattern.test(strippedAcc);

      // Only apply issue filter if NOT an action verb (fixing a bug IS an accomplishment!)
      if (!hasActionVerb && containsIssuePattern(acc)) continue;

      // Only apply low-quality filters if NOT an action verb
      if (!hasActionVerb) {
        if (isLowQualityPattern(acc)) continue;
        if (isLowQualityAccomplishment(acc)) continue;
      }

      const cleanAcc = cleanAccomplishmentText(acc);
      if (cleanAcc.length < 20) continue;

      // Filter out generic observations/narratives (not actual accomplishments)
      const lowerClean = cleanAcc.toLowerCase();
      if (/^(both|key difference|the main|this is|ran|trigger)/i.test(lowerClean)) continue;
      if (/\b(both paths|key difference|path structure|consistent reports)/i.test(lowerClean)) continue;

      const normalizedKey = cleanAcc.slice(0, 50).toLowerCase();
      if (seenAccomplishments.has(normalizedKey)) continue;
      seenAccomplishments.add(normalizedKey);
      seenAccomplishments.add(cleanAcc);

      // For action verbs, use the full accomplishment text
      // For others, wrap with goal context if available
      const patternText = hasActionVerb
        ? cleanAcc.slice(0, 120)
        : (session.goal && session.goal.length > 3
          ? `when ${session.goal.slice(0, 30)}, do ${cleanAcc.slice(0, 80)}`
          : cleanAcc.slice(0, 120));

      successfulApproaches.push({
        pattern: patternText,
        context: session.title || '',
        frequency: 1,
        location: session.relevantFiles?.[0] || ''
      });
}
}

/**
 * Cleans accomplishment text by replacing newlines with spaces.
 * Prevents mid-bullet line breaks that break markdown formatting.
 * @param {string} text - Raw accomplishment text
 * @returns {string} - Cleaned text with newlines replaced by spaces
 */
function cleanAccomplishmentText(text) {
  if (!text) return '';
  // Replace newlines with spaces, then clean markdown markers
  return text
    .replace(/\n+/g, ' ')  // Convert multiline to single line
    .replace(/[#*`\[\]]/g, '')  // Remove markdown markers
    .replace(/\d+\.\d+:/g, '')  // Remove timestamps like "14.30:"
    .replace(/\s+/g, ' ')  // Normalize multiple spaces to single
    .trim();
}

// NOTE: pendingItems from reports are NOT real issues - they are TODOs/work items
// Disabled to break the feedback loop where reports generate noise -> intelligence picks it up -> cycle repeats
// Real issues come from actual bugs in session code, not from pending work items
// if (reportIntelligence) {
//   for (const pending of (reportIntelligence.pendingItems || [])) { ... }
// }

  // Extract failed and successful approaches from reports (but NOT pendingItems)
  if (reportIntelligence) {
    for (const failed of (reportIntelligence.failedApproaches || [])) {
      if (failed.antiPattern && !failedApproaches.some(f => f.antiPattern === failed.antiPattern)) {
        failedApproaches.push({
          antiPattern: failed.antiPattern,
          reason: failed.reason || '',
          location: failed.source || ''
        });
      }
    }

    for (const success of (reportIntelligence.successfulApproaches || [])) {
      if (success.pattern && !seenAccomplishments.has(success.pattern)) {
        const cleanPattern = success.pattern.replace(/[#*`\[\]]/g, '').trim();

        // Filter out generic observations/narratives (not actual accomplishments)
        const lowerClean = cleanPattern.toLowerCase();
        if (/^(both|key difference|the main|this is)/i.test(lowerClean)) continue;
        if (/\b(both paths|key difference|path structure)/i.test(lowerClean)) continue;

        if (isLowQualityPattern(cleanPattern)) continue;
        if (isLowQualityAccomplishment(cleanPattern)) continue;
        if (containsIssuePattern(cleanPattern)) continue;
        if (cleanPattern.length < 20) continue;

        const normalizedKey = cleanPattern.slice(0, 50).toLowerCase();
        if (seenAccomplishments.has(normalizedKey)) continue;
        seenAccomplishments.add(normalizedKey);
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

  const knownIssuesDeduped = knownIssues.filter(ki => {
    const normalizedKi = (ki.description || '').toLowerCase().slice(0, 40);
    return !failedApproaches.some(fa =>
      (fa.antiPattern || '').toLowerCase().includes(normalizedKi) ||
      normalizedKi.includes((fa.antiPattern || '').toLowerCase().slice(0, 30))
    );
  });

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

export { stripFieldHeader, cleanOldLinks };