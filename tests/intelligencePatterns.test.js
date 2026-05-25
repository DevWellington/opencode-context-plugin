import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../src/agents/reportExtractor.js', () => ({
  isLowQualityPattern: jest.fn(() => false),
}));

describe('Intelligence Patterns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ISSUE_PATTERNS', () => {
    it('should match "not working"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('something is not working'));
      expect(matched).toBe(true);
    });

    it('should match "is broken"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('the feature is broken'));
      expect(matched).toBe(true);
    });

    it('should match "bug:"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('bug: null pointer'));
      expect(matched).toBe(true);
    });

    it('should match "error:" prefix', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('error: something failed'));
      expect(matched).toBe(true);
    });

    it('should match "crash" variations', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      expect(ISSUE_PATTERNS.some(p => p.test('the app crashed'))).toBe(true);
      expect(ISSUE_PATTERNS.some(p => p.test('crashing on startup'))).toBe(true);
    });

    it('should match "found a bug"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('found a bug in the parser'));
      expect(matched).toBe(true);
    });

    it('should match "fails" and "failed"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      expect(ISSUE_PATTERNS.some(p => p.test('the test fails'))).toBe(true);
      expect(ISSUE_PATTERNS.some(p => p.test('failed to load'))).toBe(true);
    });

    it('should match Portuguese "não funciona"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('o código não funciona'));
      expect(matched).toBe(true);
    });

    it('should match "duplicate"', async () => {
      const { ISSUE_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_PATTERNS.some(p => p.test('duplicate entries found'));
      expect(matched).toBe(true);
    });
  });

  describe('ISSUE_ANTI_PATTERNS', () => {
    it('should match "bug fixed" as non-issue', async () => {
      const { ISSUE_ANTI_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_ANTI_PATTERNS.some(p => p.test('bug fixed in module'));
      expect(matched).toBe(true);
    });

    it('should match "issue resolved" as non-issue', async () => {
      const { ISSUE_ANTI_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_ANTI_PATTERNS.some(p => p.test('issue resolved'));
      expect(matched).toBe(true);
    });

    it('should match "error resolved" as non-issue', async () => {
      const { ISSUE_ANTI_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_ANTI_PATTERNS.some(p => p.test('error resolved'));
      expect(matched).toBe(true);
    });

    it('should match "problem solved" as non-issue', async () => {
      const { ISSUE_ANTI_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_ANTI_PATTERNS.some(p => p.test('problem solved'));
      expect(matched).toBe(true);
    });

    it('should match "successfully" as non-issue', async () => {
      const { ISSUE_ANTI_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_ANTI_PATTERNS.some(p => p.test('successfully fixed the bug'));
      expect(matched).toBe(true);
    });

    it('should match "fixed the bug" as non-issue', async () => {
      const { ISSUE_ANTI_PATTERNS } = await import('../src/agents/intelligencePatterns.js');
      const matched = ISSUE_ANTI_PATTERNS.some(p => p.test('fixed the bug'));
      expect(matched).toBe(true);
    });
  });

  describe('containsIssuePattern()', () => {
    it('should return true for "not working"', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern('this is not working')).toBe(true);
    });

    it('should return true for "is broken"', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern('the API is broken')).toBe(true);
    });

    it('should return false for anti-patterns like "bug fixed"', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern('bug fixed')).toBe(false);
    });

    it('should return false for anti-patterns like "issue resolved"', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern('issue resolved')).toBe(false);
    });

    it('should return false for null input', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern(null)).toBe(false);
    });

    it('should return false for empty string', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern('')).toBe(false);
    });

    it('should return false when anti-pattern overrides issue pattern', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern('bug fixed and error resolved')).toBe(false);
    });

    it('should return false for undefined input', async () => {
      const { containsIssuePattern } = await import('../src/agents/intelligencePatterns.js');
      expect(containsIssuePattern(undefined)).toBe(false);
    });
  });

  describe('isLowQualityAccomplishment()', () => {
    it('should return true for very short text (<12 chars)', async () => {
      const { isLowQualityAccomplishment } = await import('../src/agents/intelligencePatterns.js');
      expect(isLowQualityAccomplishment('hi')).toBe(true);
      expect(isLowQualityAccomplishment('12345678901')).toBe(true);
    });

    it('should return false for valid text of sufficient length', async () => {
      const { isLowQualityAccomplishment } = await import('../src/agents/intelligencePatterns.js');
      expect(isLowQualityAccomplishment('Implemented JWT authentication with refresh tokens')).toBe(false);
    });

    it('should return true for null input', async () => {
      const { isLowQualityAccomplishment } = await import('../src/agents/intelligencePatterns.js');
      expect(isLowQualityAccomplishment(null)).toBe(true);
    });

    it('should return true for empty string', async () => {
      const { isLowQualityAccomplishment } = await import('../src/agents/intelligencePatterns.js');
      expect(isLowQualityAccomplishment('')).toBe(true);
    });

    it('should return true for "Successfully" prefixed text', async () => {
      const { isLowQualityAccomplishment } = await import('../src/agents/intelligencePatterns.js');
      expect(isLowQualityAccomplishment('Successfully completed the task')).toBe(true);
    });
  });
});
