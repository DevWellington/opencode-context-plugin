import { findPatterns, isValidBugSymptom } from '../../modules/contentExtractor.js';
import { FAILED_APPROACH_PATTERNS, containsIssuePattern, isLowQualityAccomplishment, isLowQualityPattern } from '../intelligencePatterns.js';
import { dedupeKnownIssues } from './deduplicator.js';
import { cleanAccomplishmentText } from './sanitizer.js';
import { TRUNCATE } from '../../constants.js';
import { createDebugLogger } from '../../utils/debug.js';
import { getConfig } from '../../config.js';

const logger = createDebugLogger('intelligence:transformer');

export function inferActivePhase(reportIntelligence, allSessions) {
  const sessionCount = Array.isArray(allSessions) ? allSessions.length : 0;

  if (reportIntelligence) {
    const hasIssues = (reportIntelligence.knownIssues || []).length > 0;
    const hasFailed = (reportIntelligence.failedApproaches || []).length > 0;
    const hasPending = (reportIntelligence.pendingItems || []).length > 0;

    if (hasPending) return 'bug-fixing';
    if (hasIssues && hasFailed) return 'stabilization';
  }

  if (sessionCount > 10) return 'maintenance';
  if (sessionCount > 3) return 'stabilization';
  return 'active-development';
}

function mapBugsToFailedApproaches(bugs, session) {
  if (!Array.isArray(bugs)) return [];
  const entries = [];
  for (const bug of bugs) {
    if (!bug || !(bug.solution || bug.resolution)) continue;
    entries.push({
      antiPattern: bug.symptom || '',
      reason: bug.cause || 'resolved with workaround',
      location: session?.relevantFiles?.[0] ? `${session.relevantFiles[0]}:${bug.line || 0}` : ''
    });
  }
  return entries;
}

function mapBugsToIssues(bugs, session) {
  if (!Array.isArray(bugs)) return [];
  const entries = [];
  for (const bug of bugs) {
    if (!bug || bug.solution || bug.resolution) continue;
    if (!isValidBugSymptom(bug.symptom)) continue;
    const symptomLower = (bug.symptom || '').toLowerCase();
    if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(symptomLower)) continue;
    const id = `BUG-${(bug.symptom || 'unknown').slice(0, 20).replace(/\s+/g, '-').toUpperCase()}`;
    entries.push({
      id,
      description: bug.symptom,
      location: session?.relevantFiles?.[0] ? `${session.relevantFiles[0]}:${bug.line || 0}` : ''
    });
  }
  return entries;
}

function mapAccomplishmentsToPatterns(session, seenAccomplishments) {
  const acc = session?.accomplished;
  if (!acc || acc.length < 15 || seenAccomplishments.has(acc)) return null;
  if (acc.endsWith('...')) return null;
  if (/^[a-z]\s*$/.test(acc.slice(-2))) return null;

  const strippedAcc = acc.replace(/^[-*]\s*/, '').replace(/^[✅💡🐛🔧📝🔍📦🚪]\s*/u, '').trim();
  const actionVerbPattern = /^(Added|Fixed|Improved|Implemented|Refactored|Created|Updated|Removed|Resolved|Corrected|Built|Migrated|Implementado|Corrigido|Melhorado|Removido|Atualizado|Criado|Resolvido|Migrado|Construído)\s+/i;
  const hasActionVerb = actionVerbPattern.test(strippedAcc);

  if (!hasActionVerb && containsIssuePattern(acc)) return null;
  if (!hasActionVerb) {
    if (isLowQualityPattern(acc)) return null;
    if (isLowQualityAccomplishment(acc)) return null;
  }

  const cleanAcc = cleanAccomplishmentText(acc);
  if (cleanAcc.length < 20) return null;

  const lowerClean = cleanAcc.toLowerCase();
  if (/^(both|key difference|the main|this is|ran|trigger)/i.test(lowerClean)) return null;
  if (/\b(both paths|key difference|path structure|consistent reports)/i.test(lowerClean)) return null;

  const normalizedKey = cleanAcc.slice(0, TRUNCATE.KEY).toLowerCase();
  if (seenAccomplishments.has(normalizedKey)) return null;
  seenAccomplishments.add(normalizedKey);
  seenAccomplishments.add(cleanAcc);

  const patternText = hasActionVerb
    ? cleanAcc.slice(0, TRUNCATE.ACCOMPLISHMENT)
    : (session.goal && session.goal.length > 3
      ? `when ${session.goal.slice(0, 30)}, do ${cleanAcc.slice(0, 80)}`
      : cleanAcc.slice(0, TRUNCATE.ACCOMPLISHMENT));

  return {
    pattern: patternText,
    context: session.title || '',
    frequency: 1,
    location: session.relevantFiles?.[0] || ''
  };
}

function collectRecentPatterns(allSessions) {
  if (!Array.isArray(allSessions) || allSessions.length === 0) return [];

  const patternSessions = allSessions
    .filter(s => s?.goal || s?.accomplished || s?.discoveries)
    .map((s, i) => ({
      sessionId: s.sessionId || `session-${i}`,
      content: `## Goal\n${s.goal || ''}\n\n## Accomplished\n${s.accomplished || ''}\n\n## Discoveries\n${s.discoveries || ''}`
    }));

  const patterns = patternSessions.length >= 2 ? findPatterns(patternSessions) : [];
  return patterns.slice(0, 5).map(p => ({
    type: p.pattern.split(':')[0] || 'general',
    name: p.pattern.split(':').slice(1).join(':').trim() || p.pattern,
    frequency: p.frequency
  }));
}

function capSectionItems(section, maxItems) {
  if (!Array.isArray(section)) return [];
  return section.slice(0, maxItems);
}

function isArchitecturalSession(sessionTitle) {
  const title = (sessionTitle || '').toLowerCase();
  return /\b(arquitetura|architecture)\b/.test(title);
}

function collectIssuesFromDiscoveries(session, knownIssues) {
  const discoveries = session?.discoveries || '';
  if (!discoveries || !containsIssuePattern(discoveries)) return;

  const sentences = discoveries.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 15)
    .filter(s => !/^[()\[\]]/.test(s))
    .filter(s => !/^\d+$/.test(s))
    .filter(s => containsIssuePattern(s));

  for (const sentence of sentences.slice(0, 3)) {
    const cleanSentence = sentence.replace(/[#*`\[\]]/g, '').trim();
    if (cleanSentence.length <= 15) continue;

    const lowerClean = cleanSentence.toLowerCase();
    if (/\b(arquitetura|architecture|inverted|invertida)\b/.test(lowerClean)) continue;
    if (isArchitecturalSession(session?.title)) continue;
    if (!isValidBugSymptom(cleanSentence)) continue;

    const idKey = cleanSentence.slice(0, 60).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
    const id = `ISSUE-${idKey}`;
    const isDuplicate = knownIssues.some(k =>
      k?.id === id || (k?.description && cleanSentence &&
        (k.description.slice(0, TRUNCATE.ISSUE) === cleanSentence.slice(0, TRUNCATE.ISSUE) ||
         k.description.includes(cleanSentence.slice(0, 30))))
    );
    if (!isDuplicate) {
      knownIssues.push({
        id,
        title: cleanSentence,
        description: cleanSentence,
        location: session?.title || ''
      });
    }
  }
}

function collectFailedPatternsFromDiscoveries(session, failedApproaches) {
  const discoveries = session?.discoveries || '';
  if (!discoveries) return;

  for (const { pattern, antiPattern, reason } of FAILED_APPROACH_PATTERNS) {
    if (pattern.test(discoveries)) {
      if (!failedApproaches.some(f => f?.antiPattern === antiPattern)) {
        failedApproaches.push({
          antiPattern,
          reason,
          location: session?.relevantFiles?.[0] || session?.title || ''
        });
      }
    }
  }
}

function mergeReportIntelligence(reportIntelligence, failedApproaches, successfulApproaches, seenAccomplishments) {
  if (!reportIntelligence) return;

  for (const failed of (reportIntelligence.failedApproaches || [])) {
    if (failed?.antiPattern && !failedApproaches.some(f => f?.antiPattern === failed.antiPattern)) {
      failedApproaches.push({
        antiPattern: failed.antiPattern,
        reason: failed.reason || '',
        location: failed.source || ''
      });
    }
  }

  for (const success of (reportIntelligence.successfulApproaches || [])) {
    if (!success?.pattern || seenAccomplishments.has(success.pattern)) continue;

    const cleanPattern = success.pattern.replace(/[#*`\[\]]/g, '').trim();
    const lowerClean = cleanPattern.toLowerCase();
    if (/^(both|key difference|the main|this is)/i.test(lowerClean)) continue;
    if (/\b(both paths|key difference|path structure)/i.test(lowerClean)) continue;
    if (isLowQualityPattern(cleanPattern)) continue;
    if (isLowQualityAccomplishment(cleanPattern)) continue;
    if (containsIssuePattern(cleanPattern)) continue;
    if (cleanPattern.length < 20) continue;

    const normalizedKey = cleanPattern.slice(0, TRUNCATE.KEY).toLowerCase();
    if (seenAccomplishments.has(normalizedKey)) continue;
    seenAccomplishments.add(normalizedKey);
    seenAccomplishments.add(cleanPattern);

    successfulApproaches.push({
      pattern: cleanPattern.slice(0, TRUNCATE.ACCOMPLISHMENT),
      context: success.source || '',
      frequency: success.frequency || 1,
      location: ''
    });
  }
}

/**
 * Transform session data into reference schema for intelligence-learning.md
 * @param {Array} allEntries - Historical session entries with bugs, accomplishments, discoveries
 * @param {Object|null} reportIntelligence - Intelligence from week/monthly/annual reports
 * @returns {Object} Reference schema: { projectState, knownIssues, successfulApproaches, failedApproaches, recentPatterns }
 */
export function transformToReferenceSchema(allEntries, reportIntelligence = null) {
  const config = getConfig();
  const projectName = config.projectName || 'opencode-context-plugin';

  if (!Array.isArray(allEntries) || allEntries.length === 0) {
    const timestamp = new Date().toISOString().split('T')[0];
    return {
      projectState: { projectName, lastUpdated: timestamp, sessionsTracked: 0, activePhase: 'active-development' },
      knownIssues: [],
      successfulApproaches: [],
      failedApproaches: [],
      recentPatterns: []
    };
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const allSessions = allEntries.flatMap(e => e?.sessions || []);

  const projectState = {
    projectName,
    lastUpdated: timestamp,
    sessionsTracked: allEntries.reduce((sum, e) => sum + (e?.sessionCount || 0), 0),
    activePhase: inferActivePhase(reportIntelligence, allSessions)
  };

  const knownIssues = [];
  const failedApproaches = [];

  try {
    for (const session of allSessions) {
      if (!session || isArchitecturalSession(session.title)) continue;
      if (session.bugs?.length) {
        failedApproaches.push(...mapBugsToFailedApproaches(session.bugs, session));
        for (const issue of mapBugsToIssues(session.bugs, session)) {
          if (!knownIssues.some(k => k?.id === issue.id)) {
            knownIssues.push(issue);
          }
        }
      }
    }

    for (const session of allSessions) {
      if (!session || isArchitecturalSession(session.title)) continue;
      collectFailedPatternsFromDiscoveries(session, failedApproaches);
      collectIssuesFromDiscoveries(session, knownIssues);
    }
  } catch (error) {
    logger(`transform failed during bug/issue extraction: ${error.message}`);
  }

  const successfulApproaches = [];
  const seenAccomplishments = new Set();

  try {
    for (const session of allSessions) {
      if (!session) continue;
      const pattern = mapAccomplishmentsToPatterns(session, seenAccomplishments);
      if (pattern) successfulApproaches.push(pattern);
    }

    mergeReportIntelligence(reportIntelligence, failedApproaches, successfulApproaches, seenAccomplishments);
  } catch (error) {
    logger(`transform failed during accomplishment processing: ${error.message}`);
  }

  const knownIssuesDeduped = dedupeKnownIssues(knownIssues, failedApproaches);
  const recentPatterns = collectRecentPatterns(allSessions);

  logger(`transform complete: ${knownIssuesDeduped.length} issues, ${successfulApproaches.length} approaches, ${failedApproaches.length} failed`);

  return {
    projectState,
    knownIssues: capSectionItems(knownIssuesDeduped, 10),
    successfulApproaches: capSectionItems(successfulApproaches, 10),
    failedApproaches: capSectionItems(failedApproaches, 10),
    recentPatterns
  };
}
