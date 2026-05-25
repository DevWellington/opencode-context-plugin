/**
 * Day Summary Formatter Tests
 */

import { jest, describe, it, expect } from '@jest/globals';

jest.unstable_mockModule('../src/utils/patternMatcher.js', () => ({
  isProtectedContent: jest.fn(() => false),
}));

jest.unstable_mockModule('../src/modules/tokenLimit.js', () => ({
  countSessionTokens: jest.fn(() => ({ total: 100, byRole: { user: 50, assistant: 40, system: 10 } })),
}));

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({ projectName: 'test-project' })),
  CONTEXT_SESSION_DIR: '.opencode/context-session',
}));

jest.unstable_mockModule('../src/agents/utils/linkBuilder.js', () => ({
  buildKeywords: jest.fn(() => '[[keyword1]] [[keyword2]]'),
  extractKeywordsFromContent: jest.fn(() => ['keyword1', 'keyword2']),
  addRelatedLinks: jest.fn(() => '\n## Related\n\n- [[link1]]\n- [[link2]]\n'),
  addKeywordNavigation: jest.fn(() => '\n## Navigation\n\n- [[nav1]]\n- [[nav2]]\n'),
}));

describe('daySummaryFormatter', () => {
  describe('parseSessionToMessages', () => {
    it('should extract sections from markdown content', async () => {
      const { parseSessionToMessages } = await import('../src/modules/daySummaryFormatter.js');
      const content = `## Goal
Implement authentication

## Accomplished
Added JWT middleware
Fixed token refresh

## Discoveries
New API patterns found
`;
      const messages = parseSessionToMessages(content);
      expect(messages).toHaveLength(3);
      expect(messages[0]).toMatchObject({ role: 'user', content: 'Implement authentication' });
      expect(messages[1].content).toContain('JWT middleware');
      expect(messages[1].content).toContain('token refresh');
      expect(messages[2].content).toBe('New API patterns found');
    });

    it('should return empty array for empty or null content', async () => {
      const { parseSessionToMessages } = await import('../src/modules/daySummaryFormatter.js');
      expect(parseSessionToMessages('')).toEqual([]);
      expect(parseSessionToMessages(null)).toEqual([]);
      expect(parseSessionToMessages(undefined)).toEqual([]);
    });

    it('should return empty array for content with no section headers', async () => {
      const { parseSessionToMessages } = await import('../src/modules/daySummaryFormatter.js');
      const content = 'Just a plain text without any ## section headers';
      expect(parseSessionToMessages(content)).toEqual([]);
    });

    it('should skip empty sections', async () => {
      const { parseSessionToMessages } = await import('../src/modules/daySummaryFormatter.js');
      const content = `## Goal
      
## Accomplished
Did stuff
`;
      const messages = parseSessionToMessages(content);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Did stuff');
    });
  });

  describe('groupDiscoveriesByType', () => {
    it('should categorize discoveries by type keywords', async () => {
      const { groupDiscoveriesByType } = await import('../src/modules/daySummaryFormatter.js');
      const discoveries = [
        { text: 'Fixed memory leak in parser', source: 'file1.md' },
        { text: 'Added new user API endpoint', source: 'file2.md' },
        { text: 'Refactored database connection pool', source: 'file3.md' },
        { text: 'Updated README with setup instructions', source: 'file4.md' },
        { text: 'Investigated WebSocket timeout issue', source: 'file5.md' },
      ];
      const groups = groupDiscoveriesByType(discoveries);
      expect(groups['Bug Fixes']).toHaveLength(1);
      expect(groups['Bug Fixes'][0].text).toContain('Fixed memory leak');
      expect(groups['New Features']).toHaveLength(1);
      expect(groups['New Features'][0].text).toContain('Added new user');
      expect(groups['Refactoring']).toHaveLength(1);
      expect(groups['Refactoring'][0].text).toContain('Refactored database');
      expect(groups['Documentation']).toHaveLength(1);
      expect(groups['Documentation'][0].text).toContain('Updated README');
      expect(groups['Research']).toHaveLength(1);
      expect(groups['Research'][0].text).toContain('Investigated WebSocket');
    });

    it('should place non-matching discoveries in Other', async () => {
      const { groupDiscoveriesByType } = await import('../src/modules/daySummaryFormatter.js');
      const discoveries = [
        { text: 'Random discovery about deployment', source: 'file.md' },
      ];
      const groups = groupDiscoveriesByType(discoveries);
      expect(groups['Other']).toHaveLength(1);
      expect(groups['Other'][0].text).toBe('Random discovery about deployment');
    });

    it('should remove empty categories from result', async () => {
      const { groupDiscoveriesByType } = await import('../src/modules/daySummaryFormatter.js');
      const discoveries = [
        { text: 'Added new feature', source: 'file.md' },
      ];
      const groups = groupDiscoveriesByType(discoveries);
      expect(groups).not.toHaveProperty('Bug Fixes');
      expect(groups).not.toHaveProperty('Refactoring');
      expect(groups).not.toHaveProperty('Documentation');
      expect(groups).not.toHaveProperty('Research');
      expect(groups).toHaveProperty('New Features');
    });
  });

  describe('groupFilesByProject', () => {
    it('should group files by project prefix', async () => {
      const { groupFilesByProject } = await import('../src/modules/daySummaryFormatter.js');
      const files = new Set([
        'src/modules/foo.js',
        'src/utils/bar.js',
        'tests/foo.test.js',
        'docs/README.md',
        'package.json',
      ]);
      const groups = groupFilesByProject(files);
      expect(groups['modules']).toContain('src/modules/foo.js');
      expect(groups['utils']).toContain('src/utils/bar.js');
      expect(groups['tests']).toContain('tests/foo.test.js');
      expect(groups['docs']).toContain('docs/README.md');
      expect(groups['other']).toContain('package.json');
    });
  });

  describe('extractKeyDecisions', () => {
    it('should extract decision patterns from session data', async () => {
      const { extractKeyDecisions } = await import('../src/modules/daySummaryFormatter.js');
      const sessionsData = [
        {
          extracted: {
            accomplished: 'We decided to use Redis instead of Memcached for caching.',
            goal: '',
          },
        },
        {
          extracted: {
            accomplished: 'Refactored auth module to use JWT from session tokens.',
            goal: '',
          },
        },
      ];
      const decisions = extractKeyDecisions(sessionsData);
      expect(decisions.length).toBeGreaterThanOrEqual(1);
      expect(decisions.some((d) => d.toLowerCase().includes('redis'))).toBe(true);
    });

    it('should limit to 5 decisions and deduplicate', async () => {
      const { extractKeyDecisions } = await import('../src/modules/daySummaryFormatter.js');
      const sessionsData = Array(10).fill({
        extracted: {
          accomplished: 'We decided to use Redis for caching.',
          goal: '',
        },
      });
      const decisions = extractKeyDecisions(sessionsData);
      expect(decisions.length).toBeLessThanOrEqual(5);
    });

    it('should return empty array when no decision patterns match', async () => {
      const { extractKeyDecisions } = await import('../src/modules/daySummaryFormatter.js');
      const sessionsData = [
        {
          extracted: {
            accomplished: 'Wrote some code and ran tests.',
            goal: '',
          },
        },
      ];
      const decisions = extractKeyDecisions(sessionsData);
      expect(decisions).toEqual([]);
    });
  });

  describe('formatDayContent', () => {
    it('should produce valid markdown with frontmatter', async () => {
      const { formatDayContent } = await import('../src/modules/daySummaryFormatter.js');
      const sessionsData = [
        {
          filename: 'compact-2026-04-21T10-30-00.md',
          content: '## Goal\nTest goal\n\n## Accomplished\n- Did something\n\n## Discoveries\n- Found something\n',
          extracted: {
            goal: 'Test goal',
            accomplished: 'Did something',
            discoveries: 'Found something',
            relevantFiles: ['src/test.js'],
          },
          bugs: [],
        },
      ];
      const content = formatDayContent('2026-04-21', sessionsData, 2026, 4, 'W17');
      expect(content).toMatch(/^---\n/);
      expect(content).toContain('title: Day Summary - 2026-04-21');
      expect(content).toContain('**Date:** 2026-04-21');
      expect(content).toContain('**Sessions:** 1');
    });

    it('should handle empty sessions array', async () => {
      const { formatDayContent } = await import('../src/modules/daySummaryFormatter.js');
      const content = formatDayContent('2026-04-21', [], 2026, 4, 'W17');
      expect(content).toContain('**Date:** 2026-04-21');
      expect(content).toContain('**Sessions:** 0');
      expect(content).not.toContain('## Goals');
      expect(content).not.toContain('## Accomplishments');
    });

    it('should count tokens and include Session Statistics', async () => {
      const { formatDayContent } = await import('../src/modules/daySummaryFormatter.js');
      const sessionsData = [
        {
          filename: 'compact-2026-04-21T10-30-00.md',
          content: '## Goal\nTest goal\n\n## Accomplished\n- Did something',
          extracted: { goal: 'Test goal', accomplished: 'Did something', discoveries: '', relevantFiles: [] },
          bugs: [],
        },
      ];
      const content = formatDayContent('2026-04-21', sessionsData, 2026, 4, 'W17');
      expect(content).toContain('### Session Statistics');
      expect(content).toContain('**Total tokens:** 100');
    });

    it('should include Keywords, Related, and Navigation sections when allContent provided', async () => {
      const { formatDayContent } = await import('../src/modules/daySummaryFormatter.js');
      const sessionsData = [
        {
          filename: 'compact-2026-04-21T10-30-00.md',
          content: '## Goal\nTest goal\n\n## Accomplished\n- Did something',
          extracted: { goal: 'Test goal', accomplished: 'Did something', discoveries: '', relevantFiles: [] },
          bugs: [],
        },
      ];
      const content = formatDayContent('2026-04-21', sessionsData, 2026, 4, 'W17', 'some keyword content here');
      expect(content).toContain('## Keywords (Obsidian)');
      expect(content).toContain('## Related');
      expect(content).toContain('## Navigation');
    });
  });
});
