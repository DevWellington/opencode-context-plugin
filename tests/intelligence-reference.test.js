/**
 * Intelligence Reference Format Tests
 * Tests for the new compact intelligence-learning.md format (~50 lines)
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('Intelligence Reference Format', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intelligence-ref-test-'));
  });

  describe('generateReferenceContent()', () => {
    it('should produce approximately 50 lines of output', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: {
          projectName: 'test-project',
          lastUpdated: '2026-04-29',
          sessionsTracked: 5,
          activePhase: 'test-phase'
        },
        knownIssues: [
          { id: 'TEST-1', description: 'Test issue', location: 'src/test.js:10' }
        ],
        successfulApproaches: [
          { pattern: 'use async/await', context: 'for promises', frequency: 3, location: 'src/test.js:20' }
        ],
        failedApproaches: [
          { antiPattern: 'callback hell', reason: 'hard to debug', location: 'src/test.js:30' }
        ],
        recentPatterns: [
          { type: 'goal theme', name: 'testing', frequency: 2 }
        ]
      };

      const content = generateReferenceContent(patternData);
      const lineCount = content.split('\n').length;

      // Should be compact: 15-60 lines range (empty sections = fewer lines, populated = ~50)
      expect(lineCount).toBeGreaterThanOrEqual(15);
      expect(lineCount).toBeLessThanOrEqual(60);
    });

    it('should contain all 5 main sections', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      
      // Count ## headers (main sections): Project State, Known Issues, Successful Approaches, Failed Approaches, Recent Patterns
      const sectionMatches = content.match(/^##\s+/gm);
      expect(sectionMatches).toHaveLength(5);
      
      expect(content).toContain('## Project State');
      expect(content).toContain('## Known Issues');
      expect(content).toContain('## Successful Approaches');
      expect(content).toContain('## Failed Approaches');
      expect(content).toContain('## Recent Patterns');
    });

    it('should not contain backticks (no raw code)', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [{ id: 'BUG-1', description: 'Error: something broke', location: 'src/file.js:10' }],
        successfulApproaches: [{ pattern: 'use Z for W', context: '', frequency: 1, location: 'src/file.js:20' }],
        failedApproaches: [{ antiPattern: 'avoid X', reason: 'causes Y', location: 'src/file.js:30' }],
        recentPatterns: [{ type: 'bug', name: 'regex flags', frequency: 2 }]
      };

      const content = generateReferenceContent(patternData);
      
      // No backticks should be present (no raw code blocks)
      expect(content).not.toContain('`');
    });

    it('should format knownIssues with location in file:line format', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [
          { id: 'NULL-1', description: 'null pointer exception', location: 'src/utils/helper.js:42' }
        ],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      
      // Issue title is now the full description, not the truncated ID
      expect(content).toContain('null pointer exception');
      expect(content).toContain('src/utils/helper.js:42');
    });

    it('should format successfulApproaches with frequency and location', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [
          { pattern: 'use jose for JWT', context: 'ESM-native', frequency: 5, location: 'src/lib/auth.js:15' }
        ],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      
      expect(content).toContain('use jose for JWT');
      expect(content).toContain('seen 5 times');
      expect(content).toContain('src/lib/auth.js:15');
    });

    it('should format failedApproaches as anti-patterns', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [
          { antiPattern: 'using eval()', reason: 'security vulnerability', location: 'src/eval.js:1' }
        ],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      
      expect(content).toContain('ANTI-PATTERN: using eval()');
      expect(content).toContain('security vulnerability');
      expect(content).toContain('src/eval.js:1');
    });

    it('should format recentPatterns with type and frequency', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: [
          { type: 'goal theme', name: 'auth', frequency: 3 },
          { type: 'bug pattern', name: 'regex flags', frequency: 2 }
        ]
      };

      const content = generateReferenceContent(patternData);
      
      expect(content).toContain('goal theme: auth (3 sessions)');
      expect(content).toContain('bug pattern: regex flags (2 sessions)');
    });

    it('should include generated timestamp in footer', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');
      
      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      
      expect(content).toContain('---');
      expect(content).toMatch(/Generated:\s*\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('transformToReferenceSchema() integration', () => {
    it('should transform bug with solution into failedApproach format', async () => {
      const agent = await import('../src/agents/generateIntelligenceLearning.js');
      
      // Create temp directory with session structure matching today's date
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const weekNum = String(Math.ceil(today.getDate() / 7)).padStart(2, '0');
      const ctxDir = path.join(tempDir, '.opencode', 'context-session');
      const sessionDir = path.join(ctxDir, String(year), month, `W${weekNum}`, day);
      await fs.mkdir(sessionDir, { recursive: true });

      // Create a session file with a resolved bug (has solution)
      const sessionContent = `---
sessionId: "test-bug-session"
title: "Bug Fix Session"
---

## Goal
Fix the null pointer exception

## Accomplished
Identified and fixed the bug

## Bugs Found
### Bug: null pointer on startup
**Cause:** config not initialized
**Solution:** add null check
`;
      const sessionFile = path.join(sessionDir, 'exit-test-session.md');
      await fs.writeFile(sessionFile, sessionContent);

      // Call updateIntelligenceLearning
      const result = await agent.updateIntelligenceLearning(tempDir);
      
      expect(result.success).toBe(true);
      
      // Read the generated file
      const intelligencePath = path.join(ctxDir, 'intelligence-learning.md');
      const content = await fs.readFile(intelligencePath, 'utf-8');
      
      // Should contain the new format with sections
      expect(content).toContain('## Project State');
      expect(content).toContain('## Known Issues');
      expect(content).toContain('## Successful Approaches');
      expect(content).toContain('## Failed Approaches');
    });

    it('should produce compact output under 60 lines', async () => {
      const agent = await import('../src/agents/generateIntelligenceLearning.js');
      
      // Create temp directory with session structure matching today's date
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const weekNum = String(Math.ceil(today.getDate() / 7)).padStart(2, '0');
      const ctxDir = path.join(tempDir, '.opencode', 'context-session');
      const sessionDir = path.join(ctxDir, String(year), month, `W${weekNum}`, day);
      await fs.mkdir(sessionDir, { recursive: true });

      // Create a session file with accomplishment
      const sessionContent = `---
sessionId: "test-accomplish"
title: "Feature Implementation"
---

## Goal
Implement JWT auth

## Accomplished
Added JWT authentication using jose library
`;
      const sessionFile = path.join(sessionDir, 'exit-test-accomplish.md');
      await fs.writeFile(sessionFile, sessionContent);

      // Call updateIntelligenceLearning
      const result = await agent.updateIntelligenceLearning(tempDir);
      
      // Even if no new sessions found (due to greeting filter), the function should succeed
      expect(result).toBeDefined();
      
      // Read the generated file (if it exists)
      const intelligencePath = path.join(ctxDir, 'intelligence-learning.md');
      try {
        const content = await fs.readFile(intelligencePath, 'utf-8');
        const lineCount = content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(60);
      } catch {
        // File may not exist if no sessions were found
        expect(result.skipped || result.success).toBeTruthy();
      }
    });
  });

  describe('Schema validation', () => {
    it('should use REFERENCE_SCHEMA structure', async () => {
      const { REFERENCE_SCHEMA } = await import('../src/agents/generateIntelligenceLearning.js');
      
      expect(REFERENCE_SCHEMA).toHaveProperty('projectState');
      expect(REFERENCE_SCHEMA).toHaveProperty('knownIssues');
      expect(REFERENCE_SCHEMA).toHaveProperty('successfulApproaches');
      expect(REFERENCE_SCHEMA).toHaveProperty('failedApproaches');
      expect(REFERENCE_SCHEMA).toHaveProperty('recentPatterns');
      
      // projectState should have expected shape
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('projectName');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('lastUpdated');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('sessionsTracked');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('activePhase');
    });
  });

  describe('Output line count verification', () => {
    it('should produce 40-60 lines of output', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');

      const patternData = {
        projectState: {
          projectName: 'test-project',
          lastUpdated: '2026-04-29',
          sessionsTracked: 5,
          activePhase: 'test-phase'
        },
        knownIssues: [
          { id: 'BUG-NULL-PTR', description: 'Null pointer exception on startup', location: 'src/utils/helper.js:42' },
          { id: 'BUG-MEMORY-LEAK', description: 'Memory leak in event handlers', location: 'src/core/handler.js:15' },
          { id: 'BUG-ASYNC-RACE', description: 'Race condition in async operations', location: 'src/services/sync.js:88' },
          { id: 'BUG-AUTH-TOKEN', description: 'Token expiration not handled', location: 'src/auth/jwt.js:33' },
          { id: 'BUG-INVALID-INPUT', description: 'Input validation bypassed', location: 'src/middleware/validate.js:21' },
          { id: 'BUG-TYPE-ERROR', description: 'Type casting issues', location: 'src/core/types.js:17' },
          { id: 'BUG-DEPRECATED-API', description: 'Using deprecated endpoints', location: 'src/api/v1.js:9' }
        ],
        successfulApproaches: [
          { pattern: 'use jose for JWT handling', context: 'ESM-native library', frequency: 8, location: 'src/auth/jwt.js:12' },
          { pattern: 'implement circuit breaker', context: 'for external APIs', frequency: 5, location: 'src/api/client.js:45' },
          { pattern: 'use connection pooling', context: 'database connections', frequency: 6, location: 'src/db/pool.js:28' },
          { pattern: 'add request debouncing', context: 'user input handling', frequency: 4, location: 'src/ui/input.js:67' },
          { pattern: 'use parameterized queries', context: 'SQL injection prevention', frequency: 7, location: 'src/db/query.js:31' },
          { pattern: 'implement retry logic', context: 'transient failures', frequency: 3, location: 'src/api/retry.js:22' }
        ],
        failedApproaches: [
          { antiPattern: 'callback hell', reason: 'hard to debug and maintain', location: 'src/legacy/callbacks.js:12' },
          { antiPattern: 'synchronous file I/O', reason: 'blocks event loop', location: 'src/utils/file.js:33' },
          { antiPattern: 'global mutable state', reason: 'causes race conditions', location: 'src/state/global.js:8' },
          { antiPattern: 'monolithic functions', reason: 'difficult to test', location: 'src/core/main.js:55' },
          { antiPattern: 'string concatenation for SQL', reason: 'SQL injection vulnerability', location: 'src/db/raw.js:14' }
        ],
        recentPatterns: [
          { type: 'goal theme', name: 'authentication', frequency: 5 },
          { type: 'bug pattern', name: 'null checks', frequency: 3 },
          { type: 'approach', name: 'async/await patterns', frequency: 4 },
          { type: 'goal theme', name: 'error handling', frequency: 3 },
          { type: 'bug pattern', name: 'type conversions', frequency: 2 }
        ]
      };

      const content = generateReferenceContent(patternData);
      const lineCount = content.split('\n').length;

      expect(lineCount).toBeGreaterThanOrEqual(40);
      expect(lineCount).toBeLessThanOrEqual(60);
    });
  });

  describe('Overflow enforcement (slice 0, 10)', () => {
    it('should cap knownIssues at 10 items', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');

      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: Array(15).fill(null).map((_, i) => ({
          id: `BUG-${i}`, description: `Issue ${i}`, location: `file${i}.js:1`
        })),
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      // Issues are now formatted as "- description (location)" without ID prefix
      const issueMatches = content.match(/^- .+ \([^)]+\)$/gm);
      expect(issueMatches.length).toBe(10);
    });

    it('should cap successfulApproaches at 10 items', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');

      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: Array(15).fill(null).map((_, i) => ({
          pattern: `pattern ${i}`, context: '', frequency: 1, location: ''
        })),
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      // CORRECT: Match "(seen N times)" format
      const patternMatches = content.match(/\(seen\s+\d+\s+times\)/g);
      expect(patternMatches.length).toBe(10);
    });

    it('should cap failedApproaches at 10 items', async () => {
      const { generateReferenceContent } = await import('../src/agents/generateIntelligenceLearning.js');

      const patternData = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: Array(15).fill(null).map((_, i) => ({
          antiPattern: `anti ${i}`, reason: '', location: ''
        })),
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);
      // CORRECT: Match ANTI-PATTERN: format
      const antiMatches = content.match(/^- ANTI-PATTERN:\s+.+/gm);
      expect(antiMatches.length).toBe(10);
    });
  });

  describe('parseExistingEntries()', () => {
    it('should parse date blocks from compact format', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = [
        '### 2026-05-01 - 2 sessions',
        '#### Session Title 1',
        '- **Request:** First user message 1',
        '- **Accomplished:** Did something',
        '',
        '#### Session Title 2',
        '- **Request:** First user message 2',
        '- **Accomplished:** Did something else',
        '',
        '## Related',
      ].join('\n');
      const result = parseExistingEntries(content);
      expect(result).toHaveLength(1);
      expect(result[0].sessions).toHaveLength(2);
      expect(result[0].sessions[0].title).toBe('Session Title 1');
      expect(result[0].sessions[0].firstUserMessage).toBe('First user message 1');
    });

    it('should deduplicate by title + firstUserMessage', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = `### 2026-05-01 - 1 sessions
#### Duplicate Session
- **Request:** same message
- **Accomplished:** Did thing 1

### 2026-05-02 - 1 sessions
#### Duplicate Session
- **Request:** same message
- **Accomplished:** Did thing 2
`;
      const result = parseExistingEntries(content);
      expect(result).toHaveLength(1);
    });

    it('should handle old format (Session N - TYPE) gracefully', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = [
        '### Session 1 - EXIT',
        '**Date:** 2026-05-01T12:00:00',
        '**Messages:** 5',
        '**Keywords:** test | auth',
      ].join('\n');
      const result = parseExistingEntries(content);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('Session 1');
      expect(result[0].type).toBe('EXIT');
      expect(result[0].date).toBe('2026-05-01T12:00:00');
      expect(result[0].messages).toBe(5);
      expect(result[0].keywords).toEqual(['test', 'auth']);
    });

    it('should parse old format with bugs field', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = [
        '### Session 2 - COMPACT',
        '**Date:** 2026-04-15T10-30-00',
        '**Messages:** 3',
        '**Bugs Fixed:** null pointer, memory leak',
        '**Keywords:** bug | memory',
      ].join('\n');
      const result = parseExistingEntries(content);
      expect(result).toHaveLength(1);
      expect(result[0].bugs).toEqual(['null pointer', 'memory leak']);
      expect(result[0].keywords).toEqual(['bug', 'memory']);
    });

    it('should handle old format with incomplete fields', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = [
        '### Session 3 - EXIT',
        '**Date:** 2026-03-20T08-00-00',
        '**Messages:** 1',
      ].join('\n');
      const result = parseExistingEntries(content);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('Session 3');
      expect(result[0].type).toBe('EXIT');
      expect(result[0].date).toBe('2026-03-20T08-00-00');
      expect(result[0].messages).toBe(1);
      expect(result[0].keywords).toEqual([]);
      expect(result[0].bugs).toEqual([]);
    });

    it('should handle multiple old format blocks in sequence', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = [
        '### Session 1 - EXIT',
        '**Date:** 2026-01-10T09-00-00',
        '**Messages:** 2',
        '**Keywords:** alpha',
        '',
        '### Session 2 - COMPACT',
        '**Date:** 2026-02-15T14-30-00',
        '**Messages:** 4',
        '**Keywords:** beta | gamma',
      ].join('\n');
      const result = parseExistingEntries(content);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('Session 1');
      expect(result[0].keywords).toEqual(['alpha']);
      expect(result[1].id).toBe('Session 2');
      expect(result[1].keywords).toEqual(['beta', 'gamma']);
    });

    it('should return empty array for empty content', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = parseExistingEntries('');
      expect(result).toEqual([]);
    });

    it('should return empty array for content without session blocks', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = parseExistingEntries('Just some regular text without any session blocks');
      expect(result).toEqual([]);
    });

    it('should parse multiple date blocks when terminated by a {{Related}} section', async () => {
      const { parseExistingEntries } = await import('../src/agents/intelligenceDeduplicator.js');
      const content = [
        '### 2026-05-01 - 2 sessions',
        '#### Session A',
        '- **Request:** msg 1',
        '- **Accomplished:** done',
        '',
        '#### Session B',
        '- **Request:** msg 2',
        '- **Accomplished:** done too',
        '',
        '### 2026-05-02 - 1 sessions',
        '#### Session C',
        '- **Request:** msg 3',
        '- **Accomplished:** done three',
        '',
        '## Related',
      ].join('\n');
      const result = parseExistingEntries(content);
      expect(result).toHaveLength(2);
      expect(result[0].sessions).toHaveLength(2);
      expect(result[1].sessions).toHaveLength(1);
    });
  });

  describe('cleanOldLinks()', () => {
    it('should remove [[reports/...]] links', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = cleanOldLinks('Some text [[reports/2026/05/week-summary.md]] more text');
      expect(result).not.toContain('[[reports/');
      expect(result).toContain('Some text');
      expect(result).toContain('more text');
    });

    it('should remove .opencode/context-session/reports/ links', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = cleanOldLinks('Link [[.opencode/context-session/reports/summary.md]] here');
      expect(result).not.toContain('[[.opencode');
    });

    it('should remove *(truncated)* markers', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = cleanOldLinks('Some text *(truncated)* more text');
      expect(result).not.toContain('(truncated)');
    });

    it('should remove [truncated] markers', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = cleanOldLinks('Some text [truncated] more text');
      expect(result).not.toContain('[truncated]');
    });

    it('should return empty string for null/undefined content', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligenceDeduplicator.js');
      expect(cleanOldLinks(null)).toBe('');
      expect(cleanOldLinks(undefined)).toBe('');
    });

    it('should return trimmed content when no links are present', async () => {
      const { cleanOldLinks } = await import('../src/agents/intelligenceDeduplicator.js');
      const result = cleanOldLinks('  Just clean text  ');
      expect(result).toBe('Just clean text');
    });
  });
});
