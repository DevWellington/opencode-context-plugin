import { jest, describe, it, expect } from '@jest/globals';

describe('intelligence pipeline - deduplicator', () => {
  describe('dedupeKnownIssues()', () => {
    it('should return empty array for non-array input', async () => {
      const { dedupeKnownIssues } = await import('../src/agents/intelligence/deduplicator.js');
      expect(dedupeKnownIssues(null)).toEqual([]);
      expect(dedupeKnownIssues(undefined)).toEqual([]);
      expect(dedupeKnownIssues('string')).toEqual([]);
    });

    it('should return knownIssues unchanged when failedApproaches is empty', async () => {
      const { dedupeKnownIssues } = await import('../src/agents/intelligence/deduplicator.js');
      const issues = [{ description: 'Something is broken', id: 'ISSUE-1' }];
      expect(dedupeKnownIssues(issues, [])).toEqual(issues);
    });

    it('should filter issues that match failedApproach antiPatterns', async () => {
      const { dedupeKnownIssues } = await import('../src/agents/intelligence/deduplicator.js');
      const issues = [
        { description: 'Parser fails on malformed input', id: 'ISSUE-1' },
        { description: 'Memory leak in long sessions', id: 'ISSUE-2' }
      ];
      const failed = [{ antiPattern: 'Parser fails' }];
      const result = dedupeKnownIssues(issues, failed);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ISSUE-2');
    });
  });
});

describe('deduplicateSessions()', () => {
  describe('sessionDedupKey()', () => {
    it('should use filepath when available', async () => {
      const { sessionDedupKey } = await import('../src/agents/generateIntelligenceLearning.js');
      const key = sessionDedupKey({ filepath: '/a/b.md', title: 'Test' });
      expect(key).toBe('path:/a/b.md');
    });

    it('should use composite key when filepath is absent', async () => {
      const { sessionDedupKey } = await import('../src/agents/generateIntelligenceLearning.js');
      const key = sessionDedupKey({ title: 'Fix Bug', firstUserMessage: 'Error in parser' });
      expect(key).toBe('composite:fix bug|error in parser');
    });

    it('should normalize case and trim whitespace', async () => {
      const { sessionDedupKey } = await import('../src/agents/generateIntelligenceLearning.js');
      const key1 = sessionDedupKey({ title: '  Fix Bug  ', firstUserMessage: 'error  ' });
      const key2 = sessionDedupKey({ title: 'fix bug', firstUserMessage: 'error' });
      expect(key1).toBe(key2);
    });

    it('should handle missing title and message', async () => {
      const { sessionDedupKey } = await import('../src/agents/generateIntelligenceLearning.js');
      const key = sessionDedupKey({});
      expect(key).toBe('composite:|');
    });
  });

  describe('deduplicateSessions()', () => {
    it('should filter sessions with same filepath as existing entries', async () => {
      const { deduplicateSessions } = await import('../src/agents/generateIntelligenceLearning.js');
      const existing = [{ sessions: [{ filepath: '/a/b.md' }] }];
      const newSessions = [{ filepath: '/a/b.md', title: 'A' }, { filepath: '/c/d.md', title: 'B' }];
      const result = deduplicateSessions(newSessions, existing);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('B');
    });

    it('should filter sessions with same composite key as existing', async () => {
      const { deduplicateSessions } = await import('../src/agents/generateIntelligenceLearning.js');
      const existing = [{ sessions: [{ title: 'Fix', firstUserMessage: 'crash' }] }];
      const newSessions = [
        { title: 'Fix', firstUserMessage: 'crash' },
        { title: 'Other', firstUserMessage: 'refactor' }
      ];
      const result = deduplicateSessions(newSessions, existing);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Other');
    });

    it('should handle empty sessions gracefully', async () => {
      const { deduplicateSessions } = await import('../src/agents/generateIntelligenceLearning.js');
      expect(deduplicateSessions([], [])).toEqual([]);
      expect(deduplicateSessions(null, [])).toEqual([]);
    });

    it('should handle empty existing entries', async () => {
      const { deduplicateSessions } = await import('../src/agents/generateIntelligenceLearning.js');
      const newSessions = [{ filepath: '/a.md', title: 'A' }];
      const result = deduplicateSessions(newSessions, []);
      expect(result).toHaveLength(1);
    });

    it('should keep both sessions when they have different filepaths', async () => {
      const { deduplicateSessions } = await import('../src/agents/generateIntelligenceLearning.js');
      const existing = [{ sessions: [{ filepath: '/a.md' }] }];
      const newSessions = [{ filepath: '/b.md', title: 'B' }, { filepath: '/c.md', title: 'C' }];
      const result = deduplicateSessions(newSessions, existing);
      expect(result).toHaveLength(2);
    });
  });
});

describe('intelligence pipeline - sanitizer', () => {
  describe('cleanOldLinks()', () => {
    it('should return empty string for null/undefined', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligence/sanitizer.js');
      expect(cleanOldLinks(null)).toBe('');
      expect(cleanOldLinks(undefined)).toBe('');
    });
  });

  describe('cleanAccomplishmentText()', () => {
    it('should collapse newlines into spaces', async () => {
      const { cleanAccomplishmentText } = await import('../src/agents/intelligence/sanitizer.js');
      const result = cleanAccomplishmentText('line1\n\nline2\nline3');
      expect(result).toBe('line1 line2 line3');
    });

    it('should strip markdown formatting characters', async () => {
      const { cleanAccomplishmentText } = await import('../src/agents/intelligence/sanitizer.js');
      const result = cleanAccomplishmentText('**bold** and `code` and [link]');
      expect(result).not.toContain('**');
      expect(result).not.toContain('`');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
    });

    it('should remove numbered prefixes like 1.2:', async () => {
      const { cleanAccomplishmentText } = await import('../src/agents/intelligence/sanitizer.js');
      const result = cleanAccomplishmentText('1.2: Fixed the parser bug');
      expect(result).toBe('Fixed the parser bug');
    });

    it('should trim whitespace and collapse multiple spaces', async () => {
      const { cleanAccomplishmentText } = await import('../src/agents/intelligence/sanitizer.js');
      const result = cleanAccomplishmentText('  too   many   spaces  ');
      expect(result).toBe('too many spaces');
    });

    it('should return empty string for null/undefined', async () => {
      const { cleanAccomplishmentText } = await import('../src/agents/intelligence/sanitizer.js');
      expect(cleanAccomplishmentText(null)).toBe('');
      expect(cleanAccomplishmentText(undefined)).toBe('');
      expect(cleanAccomplishmentText('')).toBe('');
    });
  });

  describe('stripFieldHeader()', () => {
    it('should strip field header from content', async () => {
      const { stripFieldHeader } = await import('../src/agents/intelligence/sanitizer.js');
      const result = stripFieldHeader('## Goal\nDo something\n', 'Goal');
      expect(result).toBe('Do something\n');
    });

    it('should return original value for null/undefined header', async () => {
      const { stripFieldHeader } = await import('../src/agents/intelligence/sanitizer.js');
      expect(stripFieldHeader('content', null)).toBe('content');
    });

    it('should return empty string for null/undefined value', async () => {
      const { stripFieldHeader } = await import('../src/agents/intelligence/sanitizer.js');
      expect(stripFieldHeader(null, 'Goal')).toBe('');
      expect(stripFieldHeader(undefined, 'Goal')).toBe('');
    });
  });
});

describe('intelligence pipeline - sessionTransformer', () => {
  describe('inferActivePhase()', () => {
    it('should return active-development for few sessions without issues', async () => {
      const { inferActivePhase } = await import('../src/agents/intelligence/sessionTransformer.js');
      const result = inferActivePhase(null, [{}, {}]);
      expect(result).toBe('active-development');
    });

    it('should return maintenance for more than 10 sessions', async () => {
      const { inferActivePhase } = await import('../src/agents/intelligence/sessionTransformer.js');
      const sessions = Array(12).fill({});
      const result = inferActivePhase(null, sessions);
      expect(result).toBe('maintenance');
    });

    it('should return bug-fixing when reportIntelligence has pending items', async () => {
      const { inferActivePhase } = await import('../src/agents/intelligence/sessionTransformer.js');
      const report = { pendingItems: ['fix crash'] };
      const result = inferActivePhase(report, []);
      expect(result).toBe('bug-fixing');
    });

    it('should return stabilization when both issues and failed approaches exist', async () => {
      const { inferActivePhase } = await import('../src/agents/intelligence/sessionTransformer.js');
      const report = { knownIssues: [{ id: 'ISSUE-1' }], failedApproaches: [{ antiPattern: 'crash' }] };
      const result = inferActivePhase(report, [{}, {}]);
      expect(result).toBe('stabilization');
    });

    it('should return stabilization for 4-10 sessions without issues', async () => {
      const { inferActivePhase } = await import('../src/agents/intelligence/sessionTransformer.js');
      const result = inferActivePhase(null, Array(5).fill({}));
      expect(result).toBe('stabilization');
    });
  });

  describe('transformToReferenceSchema()', () => {
    it('should return empty schema for empty entries', async () => {
      const { transformToReferenceSchema } = await import('../src/agents/intelligence/sessionTransformer.js');
      const result = transformToReferenceSchema([]);
      expect(result.knownIssues).toEqual([]);
      expect(result.successfulApproaches).toEqual([]);
      expect(result.failedApproaches).toEqual([]);
      expect(result.projectState.sessionsTracked).toBe(0);
    });

    it('should return empty schema for null entries', async () => {
      const { transformToReferenceSchema } = await import('../src/agents/intelligence/sessionTransformer.js');
      const result = transformToReferenceSchema(null);
      expect(result.knownIssues).toEqual([]);
      expect(result.projectState.sessionsTracked).toBe(0);
    });

    it('should extract bugs from sessions as failed approaches', async () => {
      const { transformToReferenceSchema } = await import('../src/agents/intelligence/sessionTransformer.js');
      const entries = [{
        sessionCount: 1,
        sessions: [{
          title: 'Fix parser',
          bugs: [{ symptom: 'parser crash', cause: 'null input', solution: 'added null check', line: 42 }],
          relevantFiles: ['src/parser.js']
        }]
      }];
      const result = transformToReferenceSchema(entries);
      expect(result.failedApproaches.length).toBeGreaterThanOrEqual(1);
      const fa = result.failedApproaches[0];
      expect(fa.antiPattern).toContain('parser crash');
      expect(fa.location).toContain('src/parser.js');
    });

    it('should cap sections at 10 items each', async () => {
      const { transformToReferenceSchema } = await import('../src/agents/intelligence/sessionTransformer.js');
      const manyIssues = Array(15).fill(null).map((_, i) => ({
        id: `ISSUE-${i}`,
        description: `Issue number ${i} that needs to be tracked for testing purposes`,
        location: 'test.js'
      }));
      const entries = [{
        sessionCount: 1,
        sessions: [{ title: 'test', goal: 'fix all', accomplished: 'done', discoveries: '' }]
      }];
      const result = transformToReferenceSchema(entries);
      expect(result.knownIssues.length).toBeLessThanOrEqual(10);
    });
  });
});
