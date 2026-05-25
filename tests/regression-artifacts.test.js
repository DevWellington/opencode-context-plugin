import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { formatDayContent } from '../src/modules/daySummaryFormatter.js';
import { generateReferenceContent, REFERENCE_SCHEMA, generateIntelligenceContent } from '../src/agents/intelligenceTemplate.js';

jest.mock('../src/config.js', () => ({
  getConfig: () => ({
    projectName: 'test-project'
  }),
  CONTEXT_SESSION_DIR: '.opencode/context-session'
}));

jest.mock('../src/utils/patternMatcher.js', () => ({
  isProtectedContent: () => false,
  isProtectedSession: () => false
}));

jest.mock('../src/modules/tokenLimit.js', () => ({
  countSessionTokens: () => ({ total: 100, byRole: { user: 50, assistant: 40, system: 10 } })
}));

jest.mock('../src/modules/contentExtractor.js', () => ({
  findPatterns: () => []
}));

jest.mock('../src/agents/utils/linkBuilder.js', () => ({
  buildKeywords: jest.fn((data) => (data.keywords || []).map(k => `[[${k}]]`).join(' | ')),
  extractKeywordsFromContent: jest.fn(() => ['authentication', 'handler', 'lock', 'atomic', 'session']),
  addRelatedLinks: jest.fn(() => '## Related\n- [[link1]]\n- [[link2]]\n'),
  addKeywordNavigation: jest.fn(() => '## Navigation\n- navigation links\n'),
  REPORT_PATHS: {
    intelligence: '.opencode/context-session/intelligence-learning.md',
    today: '.opencode/context-session/daily-summary.md'
  }
}));

jest.mock('../src/agents/intelligenceDeduplicator.js', () => ({
  parseExistingEntries: jest.fn(() => []),
  transformToReferenceSchema: jest.fn(() => ({
    projectState: { projectName: 'test', lastUpdated: '2024-01-01', sessionsTracked: 1 },
    knownIssues: [],
    successfulApproaches: [],
    failedApproaches: [],
    recentPatterns: []
  })),
  stripFieldHeader: jest.fn((s) => s),
  cleanOldLinks: jest.fn((s) => s)
}));

jest.mock('../src/modules/intelligence.js', () => ({
  preservePersistentPatterns: jest.fn(() => ({ pinnedContent: '' }))
}));

jest.mock('../src/agents/reportExtractor.js', () => ({
  extractIntelligenceFromReports: jest.fn(() => ({ patterns: [], bugs: [] }))
}));

jest.mock('../src/utils/greetingFilter.js', () => ({
  isGreeting: () => false,
  isGreetingTitle: () => false,
  hasStructuredWorkContent: () => true
}));

describe('regression artifacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('HD-03: day summary structure', () => {
    it('has required frontmatter fields', async () => {
      const sessionsData = [
        {
          filename: 'compact-2024-01-01T10-00-00.md',
          content: '## Goal\nTest goal\n\n## Accomplished\nTest done\n',
          extracted: {
            goal: 'Test goal',
            accomplished: 'Test done',
            discoveries: '',
            relevantFiles: []
          },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      expect(content).toMatch(/^---\n/);
      expect(content).toContain('title: Day Summary');
      expect(content).toContain('date: 2024-01-01');
      expect(content).toMatch(/^---\n[\s\S]*?---\n/);
    });

    it('has required sections', async () => {
      const sessionsData = [
        {
          filename: 'exit-2024-01-01T10-00-00.md',
          content: '## Goal\nImplement feature\n\n## Accomplished\nAdded tests\n\n## Discoveries\nFound bug\n',
          extracted: {
            goal: 'Implement feature',
            accomplished: 'Added tests',
            discoveries: 'Found bug',
            relevantFiles: ['src/test.js']
          },
          bugs: [{ symptom: 'Crash', solution: 'Fix', cause: 'Null ref' }]
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01', 'test content');

      expect(content).toContain('# Day Summary');
      expect(content).toContain('**Date:**');
      expect(content).toContain('**Sessions:**');
    });

    it('preserves goal section structure', async () => {
      const sessionsData = [
        {
          filename: 'compact-test.md',
          content: '',
          extracted: {
            goal: 'Fix authentication bug in login module',
            accomplished: '',
            discoveries: '',
            relevantFiles: []
          },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      expect(content).toContain('## Goals');
      expect(content).toContain('Fix authentication bug');
    });

    it('preserves accomplishments section structure', async () => {
      const sessionsData = [
        {
          filename: 'exit-test.md',
          content: '',
          extracted: {
            goal: '',
            accomplished: 'Completed unit tests for session handler',
            discoveries: '',
            relevantFiles: []
          },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      expect(content).toContain('## Accomplishments');
      expect(content).toContain('Completed unit tests');
    });

    it('preserves discoveries section structure', async () => {
      const sessionsData = [
        {
          filename: 'compact-discovery.md',
          content: '',
          extracted: {
            goal: '',
            accomplished: '',
            discoveries: 'Found that the lock mechanism prevents race conditions',
            relevantFiles: []
          },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      expect(content).toContain('## Discoveries');
      expect(content).toContain('lock mechanism');
    });

    it('preserves bugs section structure', async () => {
      const sessionsData = [
        {
          filename: 'exit-bug.md',
          content: '',
          extracted: { goal: '', accomplished: '', discoveries: '', relevantFiles: [] },
          bugs: [
            { symptom: 'Null pointer dereference', solution: 'Added null check', cause: 'Missing validation' }
          ]
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      expect(content).toContain('## Bugs Fixed');
      expect(content).toContain('Null pointer dereference');
      expect(content).toContain('Added null check');
      expect(content).toContain('Cause:');
    });

    it('preserves files section structure', async () => {
      const sessionsData = [
        {
          filename: 'compact-files.md',
          content: '',
          extracted: {
            goal: '',
            accomplished: '',
            discoveries: '',
            relevantFiles: ['src/handlers/sessionState.js', 'tests/sessionState.test.js']
          },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      expect(content).toContain('## Relevant Files');
      expect(content).toContain('sessionState.js');
      expect(content).toContain('sessionState.test.js');
    });

    it('includes keywords section when content provided', async () => {
      const sessionsData = [
        {
          filename: 'test.md',
          content: 'test content with keywords',
          extracted: { goal: '', accomplished: '', discoveries: '', relevantFiles: [] },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01', 'session content with authentication handler lock atomic');

      expect(content).toContain('## Keywords (Obsidian)');
    });

    it('includes navigation section when content provided', async () => {
      const sessionsData = [
        {
          filename: 'test.md',
          content: 'test content',
          extracted: { goal: '', accomplished: '', discoveries: '', relevantFiles: [] },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01', 'session content');

      expect(content).toContain('## Navigation');
    });

    it('handles empty sessions gracefully', async () => {
      const content = formatDayContent('2024-01-01', [], 2024, '01', 'W01');

      expect(content).toContain('# Day Summary');
      expect(content).toContain('**Sessions:** 0');
    });
  });

  describe('HD-03: intelligence file structure', () => {
    it('has required sections in reference content', async () => {
      const patternData = {
        projectState: {
          projectName: 'test-project',
          lastUpdated: '2024-01-01',
          sessionsTracked: 10,
          activePhase: 'Phase 1'
        },
        knownIssues: [{ title: 'Test issue', location: 'src/test.js' }],
        successfulApproaches: [{ pattern: 'Atomic write', frequency: 5 }],
        failedApproaches: [{ antiPattern: 'Sync write', reason: 'Corruption risk' }],
        recentPatterns: [{ name: 'Lock serialization', type: 'pattern', frequency: 3 }]
      };

      const content = generateReferenceContent(patternData);

      expect(content).toContain('# Intelligence Learning');
      expect(content).toContain('## Project State');
      expect(content).toContain('## Known Issues');
      expect(content).toContain('## Successful Approaches');
      expect(content).toContain('## Failed Approaches');
      expect(content).toContain('## Recent Patterns');
      expect(content).toContain('---');
      expect(content).toContain('Generated:');
    });

    it('preserves project state fields', async () => {
      const patternData = {
        projectState: {
          projectName: 'opencode-context-plugin',
          lastUpdated: '2024-05-25',
          sessionsTracked: 100,
          activePhase: 'Phase 30'
        },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);

      expect(content).toContain('**Project:** opencode-context-plugin');
      expect(content).toContain('**Last Updated:** 2024-05-25');
      expect(content).toContain('**Sessions Tracked:** 100');
      expect(content).toContain('**Active Phase:** Phase 30');
    });

    it('preserves known issues structure', async () => {
      const patternData = {
        projectState: {},
        knownIssues: [
          { title: 'Race condition in session state', location: 'sessionState.js' },
          { title: 'Missing error handling', location: 'handlers.js' }
        ],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);

      expect(content).toContain('Race condition');
      expect(content).toContain('sessionState.js');
      expect(content).toContain('Missing error handling');
    });

    it('preserves successful approaches structure', async () => {
      const patternData = {
        projectState: {},
        knownIssues: [],
        successfulApproaches: [
          { pattern: 'Atomic write with temp+rename', frequency: 10 },
          { pattern: 'Lock serialization for concurrency', frequency: 5 }
        ],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);

      expect(content).toContain('Atomic write');
      expect(content).toContain('seen 10 times');
      expect(content).toContain('Lock serialization');
    });

    it('preserves failed approaches structure (ANTI-PATTERN)', async () => {
      const patternData = {
        projectState: {},
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [
          { antiPattern: 'Direct fs.writeFile without atomic', reason: 'Crash corruption' },
          { antiPattern: 'No lock for concurrent updates', reason: 'Race conditions' }
        ],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);

      expect(content).toContain('ANTI-PATTERN:');
      expect(content).toContain('Direct fs.writeFile');
      expect(content).toContain('because');
    });

    it('handles empty sections gracefully', async () => {
      const patternData = {
        projectState: {},
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);

      expect(content).toContain('- No known issues');
      expect(content).toContain('- No patterns recorded yet');
      expect(content).toContain('- No failed approaches recorded');
      expect(content).toContain('- No patterns detected yet');
    });

    it('generates intelligence content with frontmatter', async () => {
      const entries = [
        {
          date: '2024-01-01T10:00:00Z',
          type: 'exit',
          sessions: [
            { title: 'Test session', goal: 'Test goal', accomplished: 'Test done' }
          ]
        }
      ];
      const latestEntry = entries[0];

      const content = generateIntelligenceContent(entries, latestEntry);

      expect(content).toMatch(/^---\n/);
      expect(content).toContain('title: Intelligence Learning');
      expect(content).toContain('lastUpdated:');
      expect(content).toContain('# Intelligence Learning');
    });
  });

  describe('HD-03: intelligence content structure', () => {
    it('has last updated section', async () => {
      const entries = [
        {
          date: '2024-01-01T10:00:00Z',
          type: 'exit',
          sessions: []
        }
      ];
      const latestEntry = entries[0];

      const content = generateIntelligenceContent(entries, latestEntry);

      expect(content).toContain('## Last Updated');
      expect(content).toContain('**Timestamp:**');
      expect(content).toContain('**Sessions Tracked:**');
    });

    it('has recent sessions section', async () => {
      const entries = [
        {
          date: '2024-01-01T10:00:00Z',
          type: 'exit',
          sessions: [
            { title: 'Session 1', goal: 'Goal 1', accomplished: 'Done 1' }
          ]
        }
      ];
      const latestEntry = entries[0];

      const content = generateIntelligenceContent(entries, latestEntry);

      expect(content).toContain('## Recent Sessions');
    });

    it('includes session details when available', async () => {
      const entries = [
        {
          date: '2024-01-01T10:00:00Z',
          type: 'exit',
          sessions: [
            {
              title: 'Implement feature',
              goal: 'Add new handler',
              accomplished: 'Handler added',
              discoveries: 'Lock needed',
              relevantFiles: ['src/handler.js'],
              bugs: [{ symptom: 'Bug', solution: 'Fix' }]
            }
          ]
        }
      ];
      const latestEntry = entries[0];

      const content = generateIntelligenceContent(entries, latestEntry);

      expect(content).toContain('Implement feature');
      expect(content).toContain('## Goal');
      expect(content).toContain('## Accomplished');
      expect(content).toContain('## Discoveries');
    });

    it('includes bug history section', async () => {
      const entries = [
        {
          date: '2024-01-01T10:00:00Z',
          type: 'exit',
          sessions: [
            {
              title: 'Bug fix session',
              bugs: [
                { symptom: 'Crash on null', cause: 'Null ref', solution: 'Add check' }
              ]
            }
          ]
        }
      ];
      const latestEntry = entries[0];

      const content = generateIntelligenceContent(entries, latestEntry);

      expect(content).toContain('## Bug History');
    });

    it('includes related links section', async () => {
      const entries = [
        { date: '2024-01-01T10:00:00Z', type: 'exit', sessions: [] }
      ];
      const latestEntry = entries[0];

      const content = generateIntelligenceContent(entries, latestEntry);

      expect(content).toContain('## Related');
    });
  });

  describe('HD-03: format validation', () => {
    it('day summary has valid markdown format', async () => {
      const sessionsData = [
        {
          filename: 'test.md',
          content: '## Goal\nTest\n',
          extracted: { goal: 'Test goal text', accomplished: '', discoveries: '', relevantFiles: [] },
          bugs: []
        }
      ];

      const content = formatDayContent('2024-01-01', sessionsData, 2024, '01', 'W01');

      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
      expect(frontmatterMatch).not.toBeNull();

      const sections = content.match(/^##\s+.+/gm);
      expect(sections).not.toBeNull();
    });

    it('intelligence reference content has valid markdown', async () => {
      const patternData = {
        projectState: { projectName: 'test' },
        knownIssues: [{ title: 'Issue' }],
        successfulApproaches: [{ pattern: 'Approach' }],
        failedApproaches: [{ antiPattern: 'Anti' }],
        recentPatterns: [{ name: 'Pattern', type: 'test' }]
      };

      const content = generateReferenceContent(patternData);

      expect(content.startsWith('# Intelligence Learning')).toBe(true);

      expect(content).toContain('## Project State');
      expect(content).toContain('## Known Issues');
      expect(content).toContain('## Successful Approaches');
      expect(content).toContain('## Failed Approaches');
      expect(content).toContain('## Recent Patterns');
    });

    it('section headers follow consistent format', async () => {
      const patternData = {
        projectState: {},
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };

      const content = generateReferenceContent(patternData);

      const headers = content.match(/^##\s+[A-Za-z\s]+$/gm);
      for (const header of headers || []) {
        expect(header).toMatch(/^##\s+[A-Za-z]+(\s+[A-Za-z]+)?$/);
      }
    });

    it('bullet points have consistent format', async () => {
      const patternData = {
        projectState: {},
        knownIssues: [{ title: 'Test issue', location: 'file.js' }],
        successfulApproaches: [{ pattern: 'Test pattern', frequency: 1 }],
        failedApproaches: [{ antiPattern: 'Test anti', reason: 'Test reason' }],
        recentPatterns: [{ name: 'Test recent', type: 'type', frequency: 1 }]
      };

      const content = generateReferenceContent(patternData);

      const bullets = content.match(/^-\s+.+/gm);
      expect(bullets).not.toBeNull();

      for (const bullet of bullets || []) {
        expect(bullet).toMatch(/^-\s+[^\s]/);
      }
    });
  });
});