import { TRUNCATE } from '../../constants.js';

export function parseExistingEntries(content) {
  if (!content || typeof content !== 'string') return [];

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
  const deduplicated = entries.map(entry => {
    const uniqueSessions = [];
    for (const session of (entry.sessions || [])) {
      const key = `${session.title || ''}|${session.firstUserMessage || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSessions.push(session);
      }
    }
    return { ...entry, sessions: uniqueSessions, sessionCount: uniqueSessions.length };
  }).filter(entry => entry.sessions.length > 0);

  let result = deduplicated;

  if (deduplicated.length === 0 && /### Session \d+ - \w+/.test(content)) {
    result = [];
    const oldBlocks = content.matchAll(/### (Session \d+) - (\w+)\n([\s\S]*?)(?=\n### |$(?!\n))/g);
    for (const match of oldBlocks) {
      const id = match[1];
      const type = match[2];
      const body = match[3];
      const dateMatch = body.match(/\*\*Date:\*\* ([\d-T:]+)/);
      const msgsMatch = body.match(/\*\*Messages:\*\* (\d+)/);
      const bugsMatch = body.match(/\*\*Bugs Fixed:\*\* ([\w, ]+)/);
      const keywordsMatch = body.match(/\*\*Keywords:\*\* ([^\n]+)/);

      result.push({
        id,
        date: dateMatch?.[1] || '',
        type,
        messages: parseInt(msgsMatch?.[1] || '0', 10),
        bugs: bugsMatch?.[1]?.split(',').map(b => b.trim()) || [],
        keywords: keywordsMatch?.[1]?.split('|').map(k => k.trim()) || []
      });
    }
  }

  return result;
}

export function dedupeKnownIssues(knownIssues, failedApproaches) {
  if (!Array.isArray(knownIssues)) return [];
  if (!Array.isArray(failedApproaches) || failedApproaches.length === 0) return knownIssues;

  return knownIssues.filter(ki => {
    const normalizedKi = (ki?.description || '').toLowerCase().slice(0, TRUNCATE.ISSUE);
    return !failedApproaches.some(fa =>
      (fa?.antiPattern || '').toLowerCase().includes(normalizedKi) ||
      normalizedKi.includes((fa?.antiPattern || '').toLowerCase().slice(0, 30))
    );
  });
}
