import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({
    injection: {
      relevanceScoring: {
        recencyWeight: 0.4,
        keywordWeight: 0.35,
        affinityWeight: 0.25
      }
    }
  })),
  CONTEXT_SESSION_DIR: '.opencode/context-session'
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn()),
  DEBUG_KEY: 'relevance-scoring'
}));

const { scoreContextRelevance } = await import('../src/modules/relevanceScoring.js');

describe('relevanceScoring', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'relevance-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('scoreContextRelevance', () => {
    it('should return a number between 0 and 1', async () => {
      const contextPath = path.join(tempDir, 'exit-2026-05-01T10-00-00.md');
      await fs.writeFile(contextPath, 'Some content about JavaScript and React');
      const currentSession = { content: 'Working on a React component', title: 'Test' };

      const score = await scoreContextRelevance(contextPath, currentSession);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return higher score for recent files than old files', async () => {
      const recentPath = path.join(tempDir, 'exit-2026-05-24T10-00-00.md');
      const oldPath = path.join(tempDir, 'exit-2025-01-01T10-00-00.md');
      await fs.writeFile(recentPath, 'Some content');
      await fs.writeFile(oldPath, 'Some content');
      const currentSession = { content: 'Test', title: 'Test' };

      const recentScore = await scoreContextRelevance(recentPath, currentSession);
      const oldScore = await scoreContextRelevance(oldPath, currentSession);

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it('should increase score when keywords match between context and session', async () => {
      const matchingPath = path.join(tempDir, 'exit-2026-05-24T10-00-00.md');
      const nonMatchingPath = path.join(tempDir, 'exit-2026-05-24T11-00-00.md');
      await fs.writeFile(matchingPath, 'We use React, TypeScript, and Node.js extensively');
      await fs.writeFile(nonMatchingPath, 'The weather is nice today and I like coffee');
      const currentSession = { content: 'Building a React app with TypeScript', title: 'React Dev' };

      const matchingScore = await scoreContextRelevance(matchingPath, currentSession);
      const nonMatchingScore = await scoreContextRelevance(nonMatchingPath, currentSession);

      expect(matchingScore).toBeGreaterThan(nonMatchingScore);
    });

    it('should increase score when project name matches', async () => {
      const projectPath = path.join(tempDir, 'exit-2026-05-24T10-00-00.md');
      await fs.writeFile(projectPath, 'Working on the my-cool-project repository');
      const currentSession = { content: 'Fixing bugs', title: 'Bug fix', projectName: 'my-cool-project' };

      const score = await scoreContextRelevance(projectPath, currentSession);

      expect(score).toBeGreaterThan(0.5);
    });

    it('should handle missing file gracefully without crashing', async () => {
      const missingPath = path.join(tempDir, 'nonexistent.md');
      const currentSession = { content: 'Test', title: 'Test' };

      await expect(scoreContextRelevance(missingPath, currentSession)).rejects.toThrow();
    });
  });
});
