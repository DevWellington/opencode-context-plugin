/**
 * Content Extractor Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { extractSessionContent, extractBugs, inferMissingFields, findPatterns, extractPersistentPatterns, normalizePattern, dedupePatterns, filterPinnedFromRecent } from '../src/modules/contentExtractor.js';

describe('contentExtractor Module', () => {
  describe('extractSessionContent', () => {
    it('should extract Goal, Accomplished, Discoveries, Relevant Files from structured content', () => {
      const content = `## Goal
Implement user authentication

## Accomplished
- Added JWT token validation
- Created login endpoint

## Discoveries
- Found race condition in token refresh

## Relevant Files
- src/auth/jwt.js
- src/routes/login.ts
`;

      const result = extractSessionContent(content);

      expect(result.goal).toBe('Implement user authentication');
      expect(result.accomplished).toContain('JWT token validation');
      expect(result.discoveries).toContain('race condition');
      expect(result.relevantFiles).toContain('src/auth/jwt.js');
    });

    it('should handle markdown-style headers (###)', () => {
      const content = `### Goal
Test the extraction

### Accomplished
Tests passing

### Discoveries
Jest works
`;

      const result = extractSessionContent(content);

      expect(result.goal).toBe('Test the extraction');
      expect(result.accomplished).toBe('Tests passing');
      expect(result.discoveries).toBe('Jest works');
    });

    it('should handle bullet point style sections', () => {
      const content = `- Goal: Build an API
- Accomplished: Created endpoints
- Discoveries: Express routing
- Relevant Files: src/api/*.js
`;

      const result = extractSessionContent(content);

      expect(result.goal).toBe('Build an API');
      expect(result.accomplished).toBe('Created endpoints');
      expect(result.discoveries).toBe('Express routing');
    });

    it('should extract first user message when no structured sections found', () => {
      const content = `# User wants to build a feature
This is the main request.

Some other content here.
`;

      const result = extractSessionContent(content);

      expect(result.firstUserMessage).toBe('User wants to build a feature');
      expect(result.goal).toBeNull();
      expect(result.accomplished).toBeNull();
    });

    it('should handle empty/invalid content gracefully', () => {
      expect(extractSessionContent('')).toEqual({
        goal: null,
        accomplished: null,
        discoveries: null,
        relevantFiles: [],
        firstUserMessage: null,
        raw: '',
        relatedSessions: []
      });

      expect(extractSessionContent(null)).toEqual({
        goal: null,
        accomplished: null,
        discoveries: null,
        relevantFiles: [],
        firstUserMessage: null,
        raw: '',
        relatedSessions: []
      });

      expect(extractSessionContent(undefined)).toEqual({
        goal: null,
        accomplished: null,
        discoveries: null,
        relevantFiles: [],
        firstUserMessage: null,
        raw: '',
        relatedSessions: []
      });
    });

    it('should return raw content in the raw field', () => {
      const content = 'Some raw content here';
      const result = extractSessionContent(content);
      expect(result.raw).toBe(content);
    });

    it('should parse relevant files correctly', () => {
      const content = `## Relevant Files
- src/utils/helper.ts
- src/types/index.ts
- tests/*.test.js
`;

      const result = extractSessionContent(content);

      expect(result.relevantFiles).toHaveLength(3);
      expect(result.relevantFiles).toContain('src/utils/helper.ts');
      expect(result.relevantFiles).toContain('src/types/index.ts');
      expect(result.relevantFiles).toContain('tests/*.test.js');
    });

    it('should deduplicate relevant files', () => {
      const content = `## Relevant Files
- src/file.js
- src/file.js
- other/file.ts
`;

      const result = extractSessionContent(content);

      expect(result.relevantFiles).toHaveLength(2);
    });
  });

  describe('extractBugs', () => {
    it('should extract bugs with symptom, cause, solution, prevention', () => {
      const content = `### Bug: Login fails with valid credentials

**Cause:** Token validation incorrectly checks expiry

**Solution:** Fix the token expiry check logic

**Prevention:** Add unit tests for token validation
`;

      const bugs = extractBugs(content);

      expect(bugs).toHaveLength(1);
      expect(bugs[0].symptom).toBe('Login fails with valid credentials');
      expect(bugs[0].cause).toBe('Token validation incorrectly checks expiry');
      expect(bugs[0].solution).toBe('Fix the token expiry check logic');
      expect(bugs[0].prevention).toBe('Add unit tests for token validation');
    });

    it('should ONLY return bugs that have a solution', () => {
      const content = `### Bug: Something broken

This bug has no solution mentioned.

### Bug: Another issue
**Solution:** Fixed by restarting

Some other content.
`;

      const bugs = extractBugs(content);

      expect(bugs).toHaveLength(1);
      expect(bugs[0].symptom).toBe('Another issue');
    });

    it('should return empty array when no bugs found', () => {
      const content = `## Goal
Implement feature X

## Accomplished
Feature X complete
`;

      const bugs = extractBugs(content);

      expect(bugs).toEqual([]);
    });

    it('should handle Error: prefix as well as Bug:', () => {
      const content = `### Error: Database connection timeout

**Solution:** Increased connection pool size
`;

      const bugs = extractBugs(content);

      expect(bugs).toHaveLength(1);
      expect(bugs[0].symptom).toBe('Database connection timeout');
    });

    it('should handle Issue: prefix as well as Bug:', () => {
      const content = `### Issue: Memory leak in worker

**Solution:** Properly cleanup resources
`;

      const bugs = extractBugs(content);

      expect(bugs).toHaveLength(1);
      expect(bugs[0].symptom).toBe('Memory leak in worker');
    });

    it('should handle empty/invalid content gracefully', () => {
      expect(extractBugs('')).toEqual([]);
      expect(extractBugs(null)).toEqual([]);
      expect(extractBugs(undefined)).toEqual([]);
    });

    it('should extract multiple bugs in same content', () => {
      const content = `### Bug: First issue

**Solution:** Fixed the first thing

### Bug: Second issue

**Solution:** Fixed the second thing
`;

      const bugs = extractBugs(content);

      expect(bugs).toHaveLength(2);
    });

    it('should handle bug content with solution keywords', () => {
      const content = `### Bug: Performance issue

The system was slow.

**Resolution:** Implemented caching layer

**Prevention:** Monitor response times
`;

      const bugs = extractBugs(content);

      expect(bugs).toHaveLength(1);
      expect(bugs[0].solution).toBe('Implemented caching layer');
    });
  });

  describe('inferMissingFields', () => {
    it('should return partial extraction when no OpenCode client is provided', async () => {
      const content = `## Goal
Implement authentication system with JWT tokens

This is some content without full structure.
`;

      const result = await inferMissingFields(content, null);

      expect(result.goal).toContain('Implement authentication');
      expect(result.confidence.goal).toBe(0.9);
    });

    it('should use OpenCode AI when client is provided', async () => {
      // Mock OpenCode client with sessions.prompt
      const mockClient = {
        sessions: {
          prompt: jest.fn().mockResolvedValue({
            content: JSON.stringify({
              goal: 'Test goal from LLM',
              accomplished: 'Test accomplished from LLM',
              discoveries: 'Test discoveries from LLM',
              confidence: { goal: 0.8, accomplished: 0.7, discoveries: 0.9 }
            })
          })
        }
      };

      // Content with no structured sections
      const content = `User: I want to build a REST API
Assistant: I'll help you build that API
We created endpoints for users, products, and orders.
`;

      const result = await inferMissingFields(content, mockClient);

      expect(result.goal).toBe('Test goal from LLM');
      expect(result.accomplished).toBe('Test accomplished from LLM');
      expect(mockClient.sessions.prompt).toHaveBeenCalled();
      expect(mockClient.sessions.prompt).toHaveBeenCalledWith('context-plugin-inference', expect.any(Object));
    });

    it('should skip LLM when most fields are already present', async () => {
      // Mock client should NOT be called
      const mockClient = {
        sessions: {
          prompt: jest.fn()
        }
      };

      const content = `## Goal
Existing goal

## Accomplished
Existing accomplishment

## Discoveries
Existing discoveries
`;

      const result = await inferMissingFields(content, mockClient);

      expect(result.goal).toBe('Existing goal');
      expect(mockClient.sessions.prompt).not.toHaveBeenCalled();
    });

    it('should handle invalid content gracefully', async () => {
      const result = await inferMissingFields('', null);
      
      expect(result.goal).toBeNull();
      expect(result.confidence.goal).toBe(0);
    });

    it('should return confidence scores', async () => {
      const content = `## Goal
Test goal

Some content.
`;

      const result = await inferMissingFields(content, null);

      expect(result.confidence).toBeDefined();
      expect(result.confidence.goal).toBe(0.9);
      expect(typeof result.confidence.goal).toBe('number');
    });

    it('should return null fields when no client provided and no structured data', async () => {
      const content = `Random unstructured content without any headers.
`;

      const result = await inferMissingFields(content, null);

      // Since content has no ## Goal/etc headers and no client, it returns partial extraction
      // but goal/accomplished/discoveries would be null since no structured data exists
      expect(result.goal).toBeNull();
    });

    it('should handle OpenCode AI errors gracefully', async () => {
      const mockClient = {
        sessions: {
          prompt: jest.fn().mockRejectedValue(new Error('AI unavailable'))
        }
      };

      const content = `User: I want to build a REST API
Assistant: I'll help you build that API
`;

      const result = await inferMissingFields(content, mockClient);

      // Should return partial extraction without crashing
      expect(result).toBeDefined();
      expect(result.goal).toBeNull();
    });
  });

  describe('findPatterns', () => {
    it('should return empty array for less than 2 sessions', () => {
      expect(findPatterns([])).toEqual([]);
      expect(findPatterns([{ content: 'test' }])).toEqual([]);
    });

    it('should find recurring themes from goals', () => {
      const sessions = [
        { sessionId: 's1', content: '## Goal\nImplement API authentication' },
        { sessionId: 's2', content: '## Goal\nAdd API rate limiting' },
        { sessionId: 's3', content: '## Goal\nBuild REST API' }
      ];

      const patterns = findPatterns(sessions);

      expect(patterns.length).toBeGreaterThan(0);
      const apiPatterns = patterns.filter(p => p.pattern.includes('api'));
      expect(apiPatterns.length).toBeGreaterThan(0);
    });

    it('should find recurring bug patterns', () => {
      const sessions = [
        {
          sessionId: 's1',
          content: `### Bug: Auth token issue
**Cause:** Token validation error
**Solution:** Fixed token validation`
        },
        {
          sessionId: 's2',
          content: `### Bug: Auth session expired
**Cause:** Token validation error
**Solution:** Extended session timeout`
        }
      ];

      const patterns = findPatterns(sessions);

      const bugPatterns = patterns.filter(p => p.pattern.includes('Bug pattern'));
      expect(bugPatterns.length).toBeGreaterThan(0);
    });

    it('should find related files across sessions', () => {
      const sessions = [
        { sessionId: 's1', content: '## Relevant Files\n- src/auth/login.js' },
        { sessionId: 's2', content: '## Relevant Files\n- src/auth/logout.js' },
        { sessionId: 's3', content: '## Relevant Files\n- src/auth/profile.js' }
      ];

      const patterns = findPatterns(sessions);

      const filePatterns = patterns.filter(p => p.pattern.includes('src/auth'));
      expect(filePatterns.length).toBeGreaterThan(0);
    });

    it('should return patterns with sessions and frequency', () => {
      const sessions = [
        { sessionId: 's1', content: '## Goal\nImplement database migration' },
        { sessionId: 's2', content: '## Goal\nDatabase migration for users' },
        { sessionId: 's3', content: '## Goal\nAnother database task' }
      ];

      const patterns = findPatterns(sessions);

      expect(patterns.length).toBeGreaterThan(0);
      const databasePattern = patterns.find(p => p.pattern.includes('database'));
      if (databasePattern) {
        expect(databasePattern.sessions).toContain('s1');
        expect(databasePattern.sessions).toContain('s2');
        expect(databasePattern.frequency).toBeGreaterThanOrEqual(2);
      }
    });

    it('should sort patterns by frequency', () => {
      const sessions = [
        { sessionId: 's1', content: '## Goal\nAPI task' },
        { sessionId: 's2', content: '## Goal\nAPI task' },
        { sessionId: 's3', content: '## Goal\nAPI task' },
        { sessionId: 's4', content: '## Goal\nDatabase task' },
        { sessionId: 's5', content: '## Goal\nDatabase task' }
      ];

      const patterns = findPatterns(sessions);

      if (patterns.length >= 2) {
        expect(patterns[0].frequency).toBeGreaterThanOrEqual(patterns[1].frequency);
      }
    });

    it('should handle string sessions', () => {
      const sessions = [
        '## Goal\nTest goal one',
        '## Goal\nTest goal two'
      ];

      const patterns = findPatterns(sessions);

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle sessions without structured content', () => {
      const sessions = [
        { sessionId: 's1', content: 'Random unstructured content' },
        { sessionId: 's2', content: 'More random content' }
      ];

      const patterns = findPatterns(sessions);

      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic session content', () => {
      const content = `## Goal
Create user authentication system with JWT

## Accomplished
- Implemented JWT token generation
- Created /login and /logout endpoints
- Added token refresh mechanism
- Wrote unit tests for auth module

## Discoveries
- Token expiry was being checked incorrectly
- Race condition in concurrent login requests

## Relevant Files
- src/auth/jwt.js
- src/auth/middleware.ts
- src/routes/auth.ts
- tests/auth.test.js

### Bug: Token refresh race condition

**Cause:** Multiple concurrent refresh requests could generate duplicate tokens

**Solution:** Implemented token refresh locking mechanism

**Prevention:** Add integration tests for concurrent auth scenarios
`;

      const result = extractSessionContent(content);
      const bugs = extractBugs(content);

      expect(result.goal).toContain('user authentication');
      expect(result.accomplished).toContain('JWT token generation');
      // Discoveries contains bullet points as extracted from markdown
      expect(result.discoveries).toContain('Race condition');
      expect(result.relevantFiles).toContain('src/auth/jwt.js');

      expect(bugs).toHaveLength(1);
      expect(bugs[0].symptom).toContain('race condition');
      expect(bugs[0].solution).toBeDefined();
    });

    it('should find bug patterns when bugs have causes', () => {
      const sessions = [
        {
          sessionId: 's1',
          content: `### Bug: Auth token issue
**Cause:** Token expiry check
**Solution:** Fixed token validation`
        },
        {
          sessionId: 's2',
          content: `### Bug: Auth session expired
**Cause:** Token expiry check
**Solution:** Extended session timeout`
        }
      ];

      const patterns = findPatterns(sessions);

      const bugPatterns = patterns.filter(p => p.pattern.includes('Bug pattern'));
      expect(bugPatterns.length).toBeGreaterThan(0);
    });

    it('should find patterns with sessions when keywords match', () => {
      const sessions = [
        { sessionId: 's1', content: '## Goal\nImplement database migration task' },
        { sessionId: 's2', content: '## Goal\nDatabase migration for users' },
        { sessionId: 's3', content: '## Goal\nAnother database task' }
      ];

      const patterns = findPatterns(sessions);

      // Should find some patterns related to database
      const databasePattern = patterns.find(p => p.pattern.includes('database'));
      expect(databasePattern).toBeDefined();
      if (databasePattern) {
        expect(databasePattern.frequency).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('extractPersistentPatterns', () => {
    it('returns empty array for empty content', () => {
      expect(extractPersistentPatterns('')).toEqual([]);
      expect(extractPersistentPatterns(null)).toEqual([]);
      expect(extractPersistentPatterns(undefined)).toEqual([]);
    });

    it('parses patterns with session metadata', () => {
      const content = `### Recurring Themes
- api design (Sessions: 5, Last: 2026-04-20)
- authentication flow (Sessions: 3, Last: 2026-04-19)
`;
      const patterns = extractPersistentPatterns(content);
      expect(patterns).toHaveLength(2);
      expect(patterns[0].pattern).toBe('api design');
      expect(patterns[0].sessionCount).toBe(5);
      expect(patterns[0].pinned).toBe(true); // 5 >= 3
      expect(patterns[1].pinned).toBe(true); // 3 >= 3
    });

    it('parses simple patterns without session metadata', () => {
      const content = `### Common Commands
- git commit
- npm test
`;
      const patterns = extractPersistentPatterns(content);
      expect(patterns).toHaveLength(2);
      expect(patterns[0].pattern).toBe('git commit');
      expect(patterns[0].sessionCount).toBe(1);
      expect(patterns[0].pinned).toBe(false); // 1 < 3
    });

    it('pins patterns with sessionCount >= 3', () => {
      const content = `### Recurring Themes
- frequent pattern (Sessions: 3)
- rare pattern (Sessions: 2)
`;
      const patterns = extractPersistentPatterns(content);
      expect(patterns.find(p => p.pattern.includes('frequent'))?.pinned).toBe(true);
      expect(patterns.find(p => p.pattern.includes('rare'))?.pinned).toBe(false);
    });

    it('infers correct pattern types', () => {
      const content = `### Bug-Prone Areas
- authentication error

### Common Commands
- npm run dev
`;
      const patterns = extractPersistentPatterns(content);
      const bugPattern = patterns.find(p => p.pattern.includes('authentication error'));
      const commandPattern = patterns.find(p => p.pattern.includes('npm run dev'));
      expect(bugPattern?.type).toBe('bug_pattern');
      expect(commandPattern?.type).toBe('command');
    });

    it('sorts by session count descending', () => {
      const content = `### Common Commands
- rare cmd (Sessions: 1)
- common cmd (Sessions: 10)
- medium cmd (Sessions: 5)
`;
      const patterns = extractPersistentPatterns(content);
      expect(patterns[0].sessionCount).toBe(10);
      expect(patterns[1].sessionCount).toBe(5);
      expect(patterns[2].sessionCount).toBe(1);
    });

    it('parses patterns with first and last seen dates', () => {
      const content = `### Recurring Themes
- api design (Sessions: 5, Last: 2026-04-20)
`;
      const patterns = extractPersistentPatterns(content);
      expect(patterns[0].firstSeen).toBe('2026-04-20');
      expect(patterns[0].lastSeen).toBe('2026-04-20');
    });
  });

  describe('normalizePattern', () => {
    it('normalizes pattern text to lowercase and truncates to 50 chars', () => {
      expect(normalizePattern('  API Design Pattern  ')).toBe('api design pattern');
      expect(normalizePattern('a'.repeat(60)).length).toBe(50);
    });

    it('handles empty/null patterns', () => {
      expect(normalizePattern('')).toBe('');
      expect(normalizePattern(null)).toBe('');
    });
  });

  describe('dedupePatterns', () => {
    it('returns empty array for empty input', () => {
      expect(dedupePatterns([])).toEqual([]);
      expect(dedupePatterns(null)).toEqual([]);
    });

    it('deduplicates patterns by normalized key', () => {
      const patterns = [
        { pattern: 'api design', sessionCount: 5, sessions: ['s1'] },
        { pattern: 'API Design', sessionCount: 3, sessions: ['s2'] }
      ];
      const deduped = dedupePatterns(patterns);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].sessionCount).toBe(5); // Higher count kept
    });

    it('keeps pattern with highest session count on conflict', () => {
      const patterns = [
        { pattern: 'api design', sessionCount: 3, sessions: ['s1'] },
        { pattern: 'api design', sessionCount: 7, sessions: ['s2'] }
      ];
      const deduped = dedupePatterns(patterns);
      expect(deduped[0].sessionCount).toBe(7);
    });
  });

  describe('filterPinnedFromRecent', () => {
    it('returns recent patterns unchanged if no pinned patterns', () => {
      const recent = [{ pattern: 'api design', sessionCount: 5 }];
      const filtered = filterPinnedFromRecent(recent, []);
      expect(filtered).toHaveLength(1);
    });

    it('filters out patterns that are already pinned with lower count', () => {
      const recent = [{ pattern: 'api design', sessionCount: 5 }];
      const pinned = [{ pattern: 'api design', sessionCount: 5 }];
      const filtered = filterPinnedFromRecent(recent, pinned);
      expect(filtered).toHaveLength(0);
    });

    it('keeps recent pattern if session count increased beyond pinned', () => {
      const recent = [{ pattern: 'api design', sessionCount: 6 }];
      const pinned = [{ pattern: 'api design', sessionCount: 5 }];
      const filtered = filterPinnedFromRecent(recent, pinned);
      expect(filtered).toHaveLength(1);
    });

    it('handles empty/null inputs gracefully', () => {
      expect(filterPinnedFromRecent([], [])).toEqual([]);
      expect(filterPinnedFromRecent(null, [])).toEqual([]);
      expect(filterPinnedFromRecent([], null)).toEqual([]);
    });
  });
});
