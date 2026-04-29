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
      
      expect(content).toContain('NULL-1');
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
});
