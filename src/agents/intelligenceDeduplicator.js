import { findPatterns } from '../modules/contentExtractor.js';
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
          // Filter out architectural observations (not actual bugs)
          const symptomLower = (bug.symptom || '').toLowerCase();
          if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(symptomLower)) continue;

          // Filter out parenthetical fragments and session artifacts
          const symptom = bug.symptom || '';
          if (/\(Revisar tudo\)$/.test(symptom)) continue;
          if (/^\d+\s*\(/.test(symptom)) continue;  // "2 (Revisar tudo)" type fragments
          if (/^md\)/.test(symptom)) continue;  // "md) or text..." fragments
          if (/^js\)/.test(symptom)) continue;  // "js:756" style entries should have been caught by extractBugs

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
    if (acc && acc.length >= 20 && !seenAccomplishments.has(acc)) {
      if (acc.endsWith('...')) continue;
      if (/[a-z]\s*$/i.test(acc)) continue;

      if (containsIssuePattern(acc)) continue;

      // Allow accomplishments starting with action verbs - these are valid outcomes
      const actionVerbPattern = /^(Added|Fixed|Improved|Implemented|Refactored|Created|Updated)\s+/i;
      const hasActionVerb = actionVerbPattern.test(acc);

      if (isLowQualityPattern(acc)) continue;
      if (!hasActionVerb && isLowQualityAccomplishment(acc)) continue;

      const cleanAcc = acc.replace(/[#*`\[\]]/g, '').replace(/\d+\.\d+:/g, '').trim();
      if (cleanAcc.length < 25) continue;

      const normalizedKey = cleanAcc.slice(0, 50).toLowerCase();
      if (seenAccomplishments.has(normalizedKey)) continue;
      seenAccomplishments.add(normalizedKey);
      seenAccomplishments.add(cleanAcc);

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

  if (reportIntelligence) {
    for (const pending of (reportIntelligence.pendingItems || [])) {
      const issueText = pending.issue || '';
      const sourceText = pending.source || '';
      // Filter out architectural observations (not actual bugs)
      // Check both issue text AND source text (parenthetical notes may be in source)
      const lowerIssue = issueText.toLowerCase();
      const lowerSource = sourceText.toLowerCase();
      if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(lowerIssue)) continue;
      if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(lowerSource)) continue;

      // Filter out already resolved issues (Portuguese/English)
      if (/\bfoi\s+(corrigido|implementado|adicionado)\b/i.test(issueText)) continue;
      if (/\bfixed|resolved|implemented|added\b/i.test(issueText) && /issue|bug|problem/i.test(lowerIssue)) continue;

      // Filter out uncertain/unverified bugs
      if (/^bug encontrado/i.test(issueText)) continue;

      // Filter out architecture description fragments
      if (/hierarchical flow/i.test(issueText)) continue;

      // Filter out very short entries
      if (issueText.length < 20) continue;

      // Filter out all-uppercase fragments (likely labels)
      if (issueText === issueText.toUpperCase() && /[A-Z]/.test(issueText)) continue;

      const id = `ISSUE-${issueText.slice(0, 15).replace(/\s+/g, '-').toUpperCase()}`;
      if (!knownIssues.some(k => k.description === pending.issue)) {
        knownIssues.push({
          id,
          title: issueText,
          description: issueText,
          location: pending.source || ''
        });
      }
    }

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