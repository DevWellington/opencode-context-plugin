import { extractSessionContent } from '../contentExtractor.js';

export function countBugsByCategory(sessions) {
  if (!Array.isArray(sessions)) {
    return { categoryCounts: {}, totalBugs: 0 };
  }

  const categoryCounts = {};
  let totalBugs = 0;

  for (const session of sessions) {
    if (!session?.bugs || !Array.isArray(session.bugs)) continue;
    for (const bug of session.bugs) {
      totalBugs++;
      const symptom = (bug.symptom || '').toLowerCase();

      let category = 'other';
      if (symptom.includes('parser') || symptom.includes('parse')) category = 'parser';
      else if (symptom.includes('config') || symptom.includes('setting')) category = 'config';
      else if (symptom.includes('file') || symptom.includes('path') || symptom.includes('dir')) category = 'file-system';
      else if (symptom.includes('memory') || symptom.includes('leak')) category = 'memory';
      else if (symptom.includes('sync') || symptom.includes('remote')) category = 'sync';
      else if (symptom.includes('token') || symptom.includes('limit')) category = 'token-limit';
      else if (symptom.includes('debounce') || symptom.includes('timing')) category = 'timing';
      else if (symptom.includes('inject') || symptom.includes('context')) category = 'context-injection';

      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  }

  return { categoryCounts, totalBugs };
}

export function findTopGoalPatterns(sessions, topN = 3) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const goalMap = new Map();

  for (const session of sessions) {
    const goal = session?.goal || '';
    if (!goal || goal.length < 10) continue;

    const normalized = goal.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 3);
    const key = words.slice(0, 5).join(' ');
    if (!key) continue;

    if (!goalMap.has(key)) {
      goalMap.set(key, { pattern: goal.slice(0, 60), count: 0, examples: [] });
    }
    const entry = goalMap.get(key);
    entry.count++;
    if (entry.examples.length < 2) {
      entry.examples.push(goal.slice(0, 80));
    }
  }

  return Array.from(goalMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export function calculateContextQuality(extracted) {
  if (!extracted || typeof extracted !== 'object') return 0;

  let score = 0;
  const maxScore = 3;

  if (extracted.goal && extracted.goal.length > 10) score++;
  if (extracted.accomplished && extracted.accomplished.length > 10) score++;
  if ((extracted.discoveries && extracted.discoveries.length > 10) ||
      (extracted.relevantFiles && extracted.relevantFiles.length > 0)) score++;

  return Math.round((score / maxScore) * 100);
}

export function generateIntelligenceLearning(sessions) {
  if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
    return {
      bugCounts: {},
      totalBugs: 0,
      topGoalPatterns: [],
      contextQualityPercent: 0,
      recommendations: []
    };
  }

  const bugData = countBugsByCategory(sessions);
  const topGoals = findTopGoalPatterns(sessions, 3);

  let qualitySum = 0;
  let qualityCount = 0;
  for (const session of sessions) {
    const extracted = extractSessionContent(session.content || '');
    qualitySum += calculateContextQuality(extracted);
    qualityCount++;
  }
  const avgQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : 0;

  const recommendations = [];
  const topCategory = Object.keys(bugData.categoryCounts)[0];
  if (bugData.totalBugs > 0 && topCategory) {
    recommendations.push(`Focus on ${topCategory} bugs (${bugData.totalBugs} total found)`);
  }
  if (avgQuality < 70) {
    recommendations.push('Improve session content quality - add ## Goal, ## Accomplished, and ## Discoveries sections');
  }
  if (topGoals.length > 0) {
    recommendations.push(`Top goal pattern: "${topGoals[0].pattern}" seen in ${topGoals[0].count} sessions`);
  }

  return {
    bugCounts: bugData.categoryCounts,
    totalBugs: bugData.totalBugs,
    topGoalPatterns: topGoals,
    contextQualityPercent: avgQuality,
    recommendations
  };
}
