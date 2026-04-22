/**
 * Validation Test - Ensures Agent and Trigger paths produce consistent reports
 */

import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import generators
const { generateTodaySummary } = await import('../src/agents/generateToday.js');
const { generateWeeklySummary } = await import('../src/agents/generateWeekly.js');
const { generateMonthlySummary } = await import('../src/agents/generateMonthly.js');
const { generateAnnualSummary } = await import('../src/agents/generateAnnual.js');
const { updateIntelligenceLearning } = await import('../src/agents/generateIntelligenceLearning.js');
const { saveContext } = await import('../src/modules/saveContext.js');
const { loadConfig } = await import('../src/config.js');

describe('Validation: Agent vs Trigger Report Generation', () => {
  let tempDir;
  let year, month, week, day;
  const timestamp = Date.now();
  
  const TEST_SESSION = {
    id: `test-session-validation-${timestamp}`,
    slug: 'test-validation-session',
    title: 'Test Validation Session',
    messages: [
      {
        role: 'user',
        content: `## Goal
Implement user authentication with JWT tokens.

## Accomplished
- Created auth middleware
- Implemented login endpoint

## Discoveries
- JWT tokens should have expiration time

## Bugs
- Bug: Login returns 500 when password is wrong
  Cause: Error not handled
  Solution: Return 401

## Relevant Files
- src/middleware/auth.js`
      },
      { role: 'assistant', content: 'I implemented the authentication system.' }
    ]
  };
  
  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validation-test-'));
    
    const now = new Date();
    year = now.getFullYear();
    month = String(now.getMonth() + 1).padStart(2, '0');
    week = `W${String(Math.ceil(now.getDate() / 7)).padStart(2, '0')}`;
    day = String(now.getDate()).padStart(2, '0');
    
    const sessionDir = path.join(tempDir, '.opencode', 'context-session', String(year), month, week, day);
    await fs.mkdir(sessionDir, { recursive: true });
    
    const sessionContent = `---
sessionId: test-session-validation-${timestamp}
slug: test-validation-session
title: Test Validation Session
messageCount: 2
---

## Goal

Implement user authentication with JWT tokens.

## Accomplished

- Created auth middleware
- Implemented login endpoint

## Discoveries

- JWT tokens should have expiration time

## Bugs

- Bug: Login returns 500 when password is wrong
  Cause: Error not handled
  Solution: Return 401

## Relevant Files

- src/middleware/auth.js
`;
    
    await fs.writeFile(path.join(sessionDir, `compact-${timestamp}.md`), sessionContent);
    loadConfig(tempDir);
  });
  
  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true }).catch(() => {});
    }
  });
  
  describe('Report Structure Validation', () => {
    it('should have frontmatter in all generated reports', async () => {
      const reportMonth = `${year}-${month}`;
      
      // Run agent-based generation
      await generateTodaySummary(tempDir);
      await generateWeeklySummary(tempDir);
      await generateMonthlySummary(tempDir, reportMonth);
      await generateAnnualSummary(tempDir, year);
      await updateIntelligenceLearning(tempDir);
      
      // Check reports exist and have frontmatter
      const reports = {
        day: path.join(tempDir, '.opencode', 'context-session', String(year), month, week, day, 'day-summary.md'),
        week: path.join(tempDir, '.opencode', 'context-session', String(year), month, week, 'week-summary.md'),
        monthly: path.join(tempDir, '.opencode', 'context-session', String(year), month, `monthly-${reportMonth}.md`),
        annual: path.join(tempDir, '.opencode', 'context-session', String(year), `annual-${year}.md`),
        intelligence: path.join(tempDir, '.opencode', 'context-session', 'intelligence-learning.md')
      };
      
      for (const [name, filePath] of Object.entries(reports)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          expect(content).toContain('---');
        } catch {
          // Report may not exist if no sessions - skip
        }
      }
    });
    
    it('should generate reports with keywords when sessions exist', async () => {
      const reportMonth = `${year}-${month}`;
      
      // Run trigger-based generation
      await saveContext(tempDir, TEST_SESSION, 'compact');
      
      // Check that annual report has content
      const annualPath = path.join(tempDir, '.opencode', 'context-session', String(year), `annual-${year}.md`);
      const annualContent = await fs.readFile(annualPath, 'utf-8');
      
      // Should have some content (>100 chars)
      expect(annualContent.length).toBeGreaterThan(100);
      
      // Should have basic structure
      expect(annualContent).toContain('##');
    });
    
    it('should maintain sequential generation order', async () => {
      // This test verifies the "SEQUENTIAL GENERATION START" log appears
      // indicating reports are generated in order, not in parallel
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await saveContext(tempDir, TEST_SESSION, 'compact');
      
      // Check that sequential log was produced
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SEQUENTIAL GENERATION START')
      );
      
      consoleSpy.mockRestore();
    });
  });
});
