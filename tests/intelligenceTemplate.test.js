import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('Intelligence Template', () => {
  describe('REFERENCE_SCHEMA', () => {
    it('should have the expected structure', async () => {
      const { REFERENCE_SCHEMA } = await import('../src/agents/intelligenceTemplate.js');
      expect(REFERENCE_SCHEMA).toHaveProperty('projectState');
      expect(REFERENCE_SCHEMA).toHaveProperty('knownIssues');
      expect(REFERENCE_SCHEMA).toHaveProperty('successfulApproaches');
      expect(REFERENCE_SCHEMA).toHaveProperty('failedApproaches');
      expect(REFERENCE_SCHEMA).toHaveProperty('recentPatterns');
    });

    it('should have projectState with expected fields', async () => {
      const { REFERENCE_SCHEMA } = await import('../src/agents/intelligenceTemplate.js');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('projectName');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('lastUpdated');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('sessionsTracked');
      expect(REFERENCE_SCHEMA.projectState).toHaveProperty('activePhase');
    });
  });

  describe('generateReferenceContent()', () => {
    it('should include all 5 main sections', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const data = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };
      const content = generateReferenceContent(data);
      expect(content).toContain('## Project State');
      expect(content).toContain('## Known Issues');
      expect(content).toContain('## Successful Approaches');
      expect(content).toContain('## Failed Approaches');
      expect(content).toContain('## Recent Patterns');
    });

    it('should display "No known issues" when empty', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const data = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };
      const content = generateReferenceContent(data);
      expect(content).toContain('- No known issues');
      expect(content).toContain('- No patterns recorded yet');
      expect(content).toContain('- No failed approaches recorded');
      expect(content).toContain('- No patterns detected yet');
    });

    it('should cap knownIssues at 10 items', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const data = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: Array(15).fill(null).map((_, i) => ({
          description: `Issue number ${i}`,
          location: `file${i}.js:1`
        })),
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };
      const content = generateReferenceContent(data);
      const issueLines = content.match(/^- .+ \(file\d+\.js:\d+\)$/gm);
      expect(issueLines).toHaveLength(10);
    });

    it('should sanitize newlines in issue descriptions', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const data = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [{ description: 'Multi\nline\ndescription', location: 'file.js:1' }],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };
      const content = generateReferenceContent(data);
      expect(content).toContain('Multi line description');
      expect(content).not.toContain('Multi\nline');
    });

    it('should group recent patterns by concrete context', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const data = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: [
          { type: 'bug pattern', name: 'null checks in auth', frequency: 3 },
          { type: 'bug pattern', name: 'null pointer in parser', frequency: 2 }
        ]
      };
      const content = generateReferenceContent(data);
      expect(content).toContain('bug pattern: null checks in auth (3 sessions)');
      expect(content).toContain('bug pattern: null pointer in parser (2 sessions)');
    });

    it('should include timestamp in footer', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const data = {
        projectState: { projectName: 'test', lastUpdated: '', sessionsTracked: 0, activePhase: '' },
        knownIssues: [],
        successfulApproaches: [],
        failedApproaches: [],
        recentPatterns: []
      };
      const content = generateReferenceContent(data);
      expect(content).toContain('---');
      expect(content).toMatch(/Generated:\s*\d{4}-\d{2}-\d{2}/);
    });

    it('should handle null/undefined patternData gracefully', async () => {
      const { generateReferenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const content = generateReferenceContent({});
      expect(content).toContain('## Project State');
      expect(content).toContain('## Known Issues');
    });
  });

  describe('generateIntelligenceContent()', () => {
    it('should include frontmatter with keywords', async () => {
      const { generateIntelligenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const entries = [];
      const latestEntry = { keywords: ['test', 'auth'] };
      const content = generateIntelligenceContent(entries, latestEntry);
      expect(content).toContain('---');
      expect(content).toContain('keywords:');
      expect(content).toContain('[[test]]');
      expect(content).toContain('[[auth]]');
    });

    it('should include session details section', async () => {
      const { generateIntelligenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const entries = [
        {
          date: '2026-05-01T00:00:00Z',
          sessionCount: 2,
          sessions: [
            { title: 'Session 1', goal: 'Fix bug', accomplished: 'Fixed it' }
          ]
        }
      ];
      const latestEntry = { type: 'exit', keywords: [] };
      const content = generateIntelligenceContent(entries, latestEntry);
      expect(content).toContain('## Last Updated');
      expect(content).toContain('Sessions Tracked');
      expect(content).toContain('## Recent Sessions');
    });

    it('should include Related section with wiki-links', async () => {
      const { generateIntelligenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const entries = [];
      const latestEntry = { type: 'exit', keywords: [] };
      const content = generateIntelligenceContent(entries, latestEntry);
      expect(content).toContain('## Related');
      expect(content).toContain('[[daily-summary.md]]');
    });

    it('should handle entries with bugs', async () => {
      const { generateIntelligenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const entries = [
        {
          date: '2026-05-01T00:00:00Z',
          sessionCount: 1,
          sessions: [
            {
              title: 'Bug Fix',
              bugs: [{ symptom: 'Null pointer', cause: 'Missing check', solution: 'Added guard' }]
            }
          ]
        }
      ];
      const latestEntry = { type: 'exit', keywords: [] };
      const content = generateIntelligenceContent(entries, latestEntry);
      expect(content).toContain('## Bug History');
      expect(content).toContain('Null pointer');
      expect(content).toContain('Added guard');
    });

    it('should handle entries without sessions', async () => {
      const { generateIntelligenceContent } = await import('../src/agents/intelligenceTemplate.js');
      const entries = [
        {
          date: '2026-05-01T00:00:00Z',
          id: 's1',
          type: 'exit',
          messages: 5
        }
      ];
      const latestEntry = { type: 'exit', keywords: [] };
      const content = generateIntelligenceContent(entries, latestEntry);
      expect(content).toContain('Session 1 - EXIT');
    });
  });
});
