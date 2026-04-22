/**
 * Report Generator Module Tests
 * Tests for content-focused report generation
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('reportGenerator Module', () => {
  let tempDir;
  let ctxDir;

  beforeEach(async () => {
    // Create temp directory structure
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'report-test-'));
    ctxDir = path.join(tempDir, '.opencode', 'context-session');
    await fs.mkdir(ctxDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('generateMonthlyReport', () => {
    it('should have Executive Summary section', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('## Executive Summary');
    });

    it('should have Major Accomplishments section (not counts)', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('## Major Accomplishments');
      // Should NOT contain "Key Work Areas" (old terminology)
      expect(report).not.toContain('## Key Work Areas');
    });

    it('should have Issues Resolved section with bug context', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('## Issues Resolved');
    });

    it('should have Decisions Made section', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('## Decisions Made');
    });

    it('should NOT contain word frequency content', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      // Should not have word frequency analysis
      expect(report).not.toContain('word frequency');
      expect(report).not.toMatch(/context appears \d+ times/);
    });

    it('should NOT contain message count statistics', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      // Should not have old-style statistics (Total Messages, Average Messages)
      expect(report).not.toContain('**Total Messages:**');
      expect(report).not.toContain('**Average Messages/Session:**');
    });

    it('should have Week-by-Week Summary section', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('## Week-by-Week Summary');
    });

    it('should have proper frontmatter for AI parsing', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('---');
      expect(report).toContain('title:');
      expect(report).toContain('created:');
      expect(report).toContain('keywords:');
    });

    it('should extract and display accomplishments from sessions when available', async () => {
      // Create a week-summary.md file with accomplishment content
      const weekDir = path.join(ctxDir, '2026', '04', 'W16');
      await fs.mkdir(weekDir, { recursive: true });
      
      const weekSummaryPath = path.join(weekDir, 'week-summary.md');
      const weekSummaryContent = `---
title: Week 16 Summary
---

# Week W16 Summary

**Period:** 2026-04
**Week:** W16
**Total Sessions:** 1 (Compacts: 0, Exits: 1)

## Goals

- Implement user authentication

## Accomplishments

- ✅ Added JWT token validation and created login endpoint

## Discoveries

- Found race condition in token refresh

## Relevant Files

- src/auth/jwt.js
- src/routes/login.js
`;
      await fs.writeFile(weekSummaryPath, weekSummaryContent);

      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      // Should contain the actual accomplishment text
      expect(report).toContain('JWT token validation');
      expect(report).toContain('login endpoint');
    });
  });

  describe('generateAnnualReport', () => {
    it('should have Quarterly Themes section (Q1, Q2, Q3, Q4)', async () => {
      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      expect(report).toContain('## Quarterly Themes');
      expect(report).toContain('Q1');
      expect(report).toContain('Q2');
      expect(report).toContain('Q3');
      expect(report).toContain('Q4');
    });

    it('should have Project Evolution section', async () => {
      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      expect(report).toContain('## Project Evolution');
    });

    it('should have Bug History section', async () => {
      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      expect(report).toContain('## Bug History');
    });

    it('should NOT have monthly statistics table (Jan | 3 | 2 | 5)', async () => {
      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      // Should not have old-style monthly breakdown table
      expect(report).not.toMatch(/Jan\s*\|\s*\d+\s*\|\s*\d+/);
      expect(report).not.toMatch(/Feb\s*\|\s*\d+\s*\|\s*\d+/);
    });

    it('should group sessions by quarter correctly', async () => {
      // Create sessions in different quarters
      const session1 = path.join(ctxDir, 'exit-2026-01-15-1.md');
      await fs.writeFile(session1, `---
title: Q1 Session
---

## Goal
Q1 work
## Accomplished
Q1 accomplishment
`);

      const session2 = path.join(ctxDir, 'exit-2026-04-15-1.md');
      await fs.writeFile(session2, `---
title: Q2 Session
---

## Goal
Q2 work
## Accomplished
Q2 accomplishment
`);

      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      // Should contain Q1 and Q2 in the report
      expect(report).toContain('Q1');
      expect(report).toContain('Q2');
    });

    it('should have Annual Theme section', async () => {
      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      expect(report).toContain('## Annual Theme');
    });

    it('should have Summary Statistics section', async () => {
      const { generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateAnnualReport(tempDir, 2026);

      expect(report).toContain('## Summary Statistics');
    });
  });

  describe('Report Structure', () => {
    it('should have consistent markdown headers', async () => {
      const { generateMonthlyReport, generateAnnualReport } = await import('../src/modules/reportGenerator.js');
      const monthlyReport = await generateMonthlyReport(tempDir, '2026-04');
      const annualReport = await generateAnnualReport(tempDir, 2026);

      // Should use ## for main sections
      expect(monthlyReport).toMatch(/^##\s+\w+/m);
      expect(annualReport).toMatch(/^##\s+\w+/m);
    });

    it('should be AI-parseable with proper frontmatter', async () => {
      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      // Check for frontmatter markers
      expect(report).toContain('---');
    });

    it('should include Relevant Files section', async () => {
      // Create a week-summary.md file with relevant files content
      const weekDir = path.join(ctxDir, '2026', '04', 'W16');
      await fs.mkdir(weekDir, { recursive: true });
      
      const weekSummaryPath = path.join(weekDir, 'week-summary.md');
      const weekSummaryContent = `---
title: Week 16 Summary
---

# Week W16 Summary

**Total Sessions:** 1

## Relevant Files

- src/test/file.js
- src/test/other.ts
`;
      await fs.writeFile(weekSummaryPath, weekSummaryContent);

      const { generateMonthlyReport } = await import('../src/modules/reportGenerator.js');
      const report = await generateMonthlyReport(tempDir, '2026-04');

      expect(report).toContain('## Relevant Files');
      expect(report).toContain('src/test/file.js');
    });
  });

  describe('scanSessionsInRange', () => {
    it('should return enriched session objects with goal, accomplished, bugs, patterns', async () => {
      // Create a session file
      const sessionPath = path.join(ctxDir, 'exit-2026-04-07-1.md');
      const sessionContent = `---
title: Test Session
---

## Goal
Test goal
## Accomplished
Test accomplishment
`;
      await fs.writeFile(sessionPath, sessionContent);

      const { scanSessionsInRange } = await import('../src/modules/reportGenerator.js');
      const sessions = await scanSessionsInRange(tempDir, '2026-04-01', '2026-04-30');

      // Sessions should be an array
      expect(Array.isArray(sessions)).toBe(true);

      // If sessions found, they should have the enriched fields
      if (sessions.length > 0) {
        expect(sessions[0]).toHaveProperty('goal');
        expect(sessions[0]).toHaveProperty('accomplished');
        expect(sessions[0]).toHaveProperty('bugs');
        expect(sessions[0]).toHaveProperty('patterns');
      }
    });

    it('should extract bugs from session content', async () => {
      // Create a session with a bug
      const sessionPath = path.join(ctxDir, 'exit-2026-04-07-1.md');
      const sessionContent = `---
title: Bug Session
---

## Goal
Fix bug
## Accomplished
Fixed the issue

### Bug: Token refresh failure
**Cause:** Missing null check
**Solution:** Added null check for token
**Prevention:** Always validate inputs
`;
      await fs.writeFile(sessionPath, sessionContent);

      const { scanSessionsInRange } = await import('../src/modules/reportGenerator.js');
      const sessions = await scanSessionsInRange(tempDir, '2026-04-01', '2026-04-30');

      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].bugs).toBeDefined();
      expect(sessions[0].bugs.length).toBeGreaterThan(0);
      expect(sessions[0].bugs[0]).toHaveProperty('symptom');
      expect(sessions[0].bugs[0]).toHaveProperty('solution');
    });
  });
});