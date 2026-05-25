import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockFs = { readFile: jest.fn(), stat: jest.fn(), readdir: jest.fn() };

jest.unstable_mockModule('fs/promises', () => ({
  ...mockFs,
  default: mockFs,
}));

describe('Cross Project Links', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGlobalIntelligencePath()', () => {
    it('should return path ending with global-intelligence.md', async () => {
      const { getGlobalIntelligencePath } = await import('../src/utils/crossProjectLinks.js');
      const result = getGlobalIntelligencePath();
      expect(result.endsWith('global-intelligence.md')).toBe(true);
    });

    it('should contain .opencode in path', async () => {
      const { getGlobalIntelligencePath } = await import('../src/utils/crossProjectLinks.js');
      const result = getGlobalIntelligencePath();
      expect(result).toContain('.opencode');
    });
  });

  describe('parseCrossProjectLink()', () => {
    it('should parse [[project:session-id]] format', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink('[[my-plugin:2026/04/session-end]]');
      expect(result).toEqual({
        projectName: 'my-plugin',
        sessionPath: '2026/04/session-end',
        isValid: true
      });
    });

    it('should parse bare project:session-id format', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink('my-plugin:session-abc');
      expect(result).toEqual({
        projectName: 'my-plugin',
        sessionPath: 'session-abc',
        isValid: true
      });
    });

    it('should trim whitespace from project name and path', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink('[[  my-plugin  :  path/to/session  ]]');
      expect(result.projectName).toBe('my-plugin');
      expect(result.sessionPath).toBe('path/to/session');
      expect(result.isValid).toBe(true);
    });

    it('should return isValid=false for invalid link', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink('just-regular-text');
      expect(result.isValid).toBe(false);
      expect(result.projectName).toBeNull();
    });

    it('should handle null input', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink(null);
      expect(result.isValid).toBe(false);
    });

    it('should handle undefined input', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink(undefined);
      expect(result.isValid).toBe(false);
    });

    it('should return isValid=false for non-string input', async () => {
      const { parseCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = parseCrossProjectLink(123);
      expect(result.isValid).toBe(false);
    });
  });

  describe('formatCrossProjectLink()', () => {
    it('should format as [[project:path]]', async () => {
      const { formatCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = formatCrossProjectLink('my-plugin', 'session-123');
      expect(result).toBe('[[my-plugin:session-123]]');
    });

    it('should return empty string when projectName is missing', async () => {
      const { formatCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      expect(formatCrossProjectLink(null, 'session-123')).toBe('');
      expect(formatCrossProjectLink(undefined, 'session-123')).toBe('');
      expect(formatCrossProjectLink('', 'session-123')).toBe('');
    });

    it('should return empty string when sessionPath is missing', async () => {
      const { formatCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      expect(formatCrossProjectLink('my-plugin', null)).toBe('');
      expect(formatCrossProjectLink('my-plugin', undefined)).toBe('');
      expect(formatCrossProjectLink('my-plugin', '')).toBe('');
    });

    it('should return empty string when both args are missing', async () => {
      const { formatCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      expect(formatCrossProjectLink()).toBe('');
    });
  });

  describe('resolveCrossProjectLink()', () => {
    it('should return empty result for invalid link', async () => {
      const { resolveCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = await resolveCrossProjectLink('not-a-link');
      expect(result.exists).toBe(false);
      expect(result.projectPath).toBeNull();
      expect(result.sessionPath).toBeNull();
      expect(result.content).toBeNull();
      expect(result.preview).toBeNull();
    });

    it('should return "not found" for unknown project', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const { resolveCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = await resolveCrossProjectLink('[[unknown-project:session-1]]');
      expect(result.exists).toBe(false);
      expect(result.preview).toContain('not found');
    });

    it('should return "not found" when global intel has project but no path', async () => {
      mockFs.readFile.mockResolvedValue('## Cross-Project Learnings\n### known-project\n**Last Updated:** 2026-05-01\n');
      mockFs.stat.mockRejectedValue(new Error('ENOENT'));

      const { resolveCrossProjectLink } = await import('../src/utils/crossProjectLinks.js');
      const result = await resolveCrossProjectLink('[[known-project:session-1]]');
      expect(result.exists).toBe(false);
    });
  });

  describe('resolveLinksInContent()', () => {
    it('should mark unresolvable links as (unresolved)', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const { resolveLinksInContent } = await import('../src/utils/crossProjectLinks.js');
      const content = 'Check [[other-project:session-abc]] for details';
      const result = await resolveLinksInContent(content);
      expect(result).toContain('(unresolved)');
    });

    it('should handle null content', async () => {
      const { resolveLinksInContent } = await import('../src/utils/crossProjectLinks.js');
      const result = await resolveLinksInContent(null);
      expect(result).toBeNull();
    });

    it('should handle empty content', async () => {
      const { resolveLinksInContent } = await import('../src/utils/crossProjectLinks.js');
      const result = await resolveLinksInContent('');
      expect(result).toBe('');
    });

    it('should return content unchanged if no links present', async () => {
      const { resolveLinksInContent } = await import('../src/utils/crossProjectLinks.js');
      const content = 'Just regular text without any links';
      const result = await resolveLinksInContent(content);
      expect(result).toBe(content);
    });
  });
});
