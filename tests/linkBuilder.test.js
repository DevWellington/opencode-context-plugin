/**
 * linkBuilder Module Tests
 */

import { describe, it, expect } from '@jest/globals';
import { addKeywordNavigation, generateKeywordLinks } from '../src/agents/utils/linkBuilder.js';

describe('linkBuilder wiki-links', () => {
  describe('addKeywordNavigation', () => {
    it('generates vault-root-relative paths with CONTEXT_SESSION_DIR prefix', () => {
      const nav = addKeywordNavigation({ type: 'daily', year: 2026, month: '04', week: 'W17' });
      expect(nav).toContain('.opencode/context-session');
      expect(nav).toContain('[[.opencode/context-session/2026/04/W17/week-summary.md|This Week]]');
    });

    it('generates correct paths for weekly type', () => {
      const nav = addKeywordNavigation({ type: 'weekly', year: 2026, month: '04', week: 'W17' });
      expect(nav).toContain('[[.opencode/context-session/2026/04/monthly-2026-04.md|This Month]]');
      expect(nav).toContain('[[.opencode/context-session/intelligence-learning.md|Intelligence]]');
    });

    it('generates correct paths for monthly type', () => {
      const nav = addKeywordNavigation({ type: 'monthly', year: 2026, month: '04', week: 'W17' });
      expect(nav).toContain('[[.opencode/context-session/2026/04/W17/week-summary.md|Weekly Summaries]]');
      expect(nav).toContain('[[.opencode/context-session/2026/annual-2026.md|Annual]]');
    });

    it('generates correct paths for annual type', () => {
      const nav = addKeywordNavigation({ type: 'annual', year: 2026, month: '04', week: 'W17' });
      expect(nav).toContain('[[.opencode/context-session/2026/01/monthly-2026-01.md|January]]');
      expect(nav).toContain('[[.opencode/context-session/intelligence-learning.md|Intelligence]]');
    });
  });

  describe('generateKeywordLinks', () => {
    it('generates vault-root-relative paths with CONTEXT_SESSION_DIR prefix', () => {
      const links = generateKeywordLinks({ keywords: ['authentication'], year: 2026, month: '04', maxLinks: 6 });
      expect(links).toContain('.opencode/context-session');
      expect(links).toContain('[[.opencode/context-session/2026/04/monthly-2026-04.md|authentication]]');
    });

    it('uses zero-padded month in paths', () => {
      const links = generateKeywordLinks({ keywords: ['database'], year: 2026, month: '04', maxLinks: 6 });
      expect(links).toContain('[[.opencode/context-session/2026/04/monthly-2026-04.md|database]]');
      expect(links).not.toContain('[[.opencode/context-session/2026/4/');
    });

    it('returns empty string when no keywords', () => {
      const links = generateKeywordLinks({ keywords: [], year: 2026, month: '04', maxLinks: 6 });
      expect(links).toBe('');
    });
  });
});