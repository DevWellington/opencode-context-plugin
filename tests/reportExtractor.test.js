import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('Report Extractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isLowQualityPattern()', () => {
    it('should reject "no actual" patterns', async () => {
      const { isLowQualityPattern } = await import('../src/agents/reportExtractor.js');
      expect(isLowQualityPattern('no actual work done')).toBe(true);
    });

    it('should reject "the user" patterns', async () => {
      const { isLowQualityPattern } = await import('../src/agents/reportExtractor.js');
      expect(isLowQualityPattern('the user asked a question')).toBe(true);
    });

    it('should reject very short patterns (<20 chars)', async () => {
      const { isLowQualityPattern } = await import('../src/agents/reportExtractor.js');
      expect(isLowQualityPattern('short pattern!')).toBe(true);
    });

    it('should reject generic placeholders', async () => {
      const { isLowQualityPattern } = await import('../src/agents/reportExtractor.js');
      expect(isLowQualityPattern('no files modified yet')).toBe(true);
      expect(isLowQualityPattern('no work completed')).toBe(true);
    });

    it('should accept valid substantive patterns', async () => {
      const { isLowQualityPattern } = await import('../src/agents/reportExtractor.js');
      expect(isLowQualityPattern('Implemented JWT authentication with refresh token rotation')).toBe(false);
    });

    it('should accept long substantive patterns with edge length', async () => {
      const { isLowQualityPattern } = await import('../src/agents/reportExtractor.js');
      expect(isLowQualityPattern('x'.repeat(25))).toBe(false);
    });
  });

  describe('extractPendingItemsFromContent()', () => {
    it('should extract ⏳ PENDENTE patterns', async () => {
      const { extractPendingItemsFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '⏳ Fix login bug - **PENDENTE**\n⏳ Add tests - **PENDENTE**';
      const result = extractPendingItemsFromContent(content);
      expect(result).toHaveLength(2);
      expect(result[0].issue).toBe('Fix login bug');
      expect(result[0].type).toBe('pending');
      expect(result[1].issue).toBe('Add tests');
    });

    it('should extract **Bug encontrado:** patterns', async () => {
      const { extractPendingItemsFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '**Bug encontrado:** null pointer on startup';
      const result = extractPendingItemsFromContent(content);
      expect(result).toHaveLength(1);
      expect(result[0].issue).toBe('null pointer on startup');
      expect(result[0].type).toBe('bug');
    });

    it('should return empty array for content without patterns', async () => {
      const { extractPendingItemsFromContent } = await import('../src/agents/reportExtractor.js');
      const result = extractPendingItemsFromContent('Just regular text');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty content', async () => {
      const { extractPendingItemsFromContent } = await import('../src/agents/reportExtractor.js');
      const result = extractPendingItemsFromContent('');
      expect(result).toEqual([]);
    });

    it('should handle PENDENTE with em dash separator', async () => {
      const { extractPendingItemsFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '⏳ Refactor module – **PENDENTE**';
      const result = extractPendingItemsFromContent(content);
      expect(result).toHaveLength(1);
      expect(result[0].issue).toBe('Refactor module');
    });
  });

  describe('extractAccomplishedFromContent()', () => {
    it('should extract ✅ patterns', async () => {
      const { extractAccomplishedFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '- ✅ Implemented login\n- ✅ Added tests';
      const result = extractAccomplishedFromContent(content);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('Implemented login');
      expect(result[1]).toBe('Added tests');
    });

    it('should handle ✅✅ double checkmark', async () => {
      const { extractAccomplishedFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '- ✅✅ Fixed critical bug';
      const result = extractAccomplishedFromContent(content);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Fixed critical bug');
    });

    it('should filter out items containing PENDENTE', async () => {
      const { extractAccomplishedFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '- ✅ Implemented login\n- ✅ ✅ ⏳ In progress - **PENDENTE**';
      const result = extractAccomplishedFromContent(content);
      expect(result).toHaveLength(1);
    });

    it('should return empty array for content without accomplished items', async () => {
      const { extractAccomplishedFromContent } = await import('../src/agents/reportExtractor.js');
      const result = extractAccomplishedFromContent('No checkmarks here');
      expect(result).toEqual([]);
    });

    it('should filter very short items (<=5 chars)', async () => {
      const { extractAccomplishedFromContent } = await import('../src/agents/reportExtractor.js');
      const content = '- ✅ hi\n- ✅ done';
      const result = extractAccomplishedFromContent(content);
      expect(result).toEqual([]);
    });
  });

  describe('mergePatterns()', () => {
    it('should deduplicate by normalized key', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const reportPatterns = [
        { pattern: 'Fix login bug', frequency: 1 },
        { pattern: 'Add missing validation', frequency: 1 }
      ];
      const sessionPatterns = [
        { pattern: 'Fix login bug', frequency: 1 }
      ];
      const result = mergePatterns(reportPatterns, sessionPatterns);
      expect(result).toHaveLength(2);
      const fixLoginBug = result.find(p => p.pattern === 'Fix login bug');
      expect(fixLoginBug.frequency).toBe(2);
    });

    it('should accumulate frequency for duplicates', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const reportPatterns = [
        { pattern: 'A', frequency: 1 },
        { pattern: 'A', frequency: 1 }
      ];
      const result = mergePatterns(reportPatterns, []);
      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe(2);
    });

    it('should sort results by frequency descending', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const patterns = [
        { pattern: 'Low', frequency: 1 },
        { pattern: 'High', frequency: 5 },
        { pattern: 'Medium', frequency: 3 }
      ];
      const result = mergePatterns(patterns, []);
      expect(result[0].pattern).toBe('High');
      expect(result[1].pattern).toBe('Medium');
      expect(result[2].pattern).toBe('Low');
    });

    it('should handle null sessionPatterns', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const reportPatterns = [{ pattern: 'Test', frequency: 1 }];
      const result = mergePatterns(reportPatterns, null);
      expect(result).toHaveLength(1);
    });

    it('should handle empty arrays', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const result = mergePatterns([], []);
      expect(result).toEqual([]);
    });

    it('should use issue field as key when pattern is missing', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const patterns = [
        { issue: 'Bug A', frequency: 1 },
        { issue: 'Bug A', frequency: 1 }
      ];
      const result = mergePatterns(patterns, []);
      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe(2);
    });

    it('should skip entries with empty key', async () => {
      const { mergePatterns } = await import('../src/agents/reportExtractor.js');
      const patterns = [
        { frequency: 1 },
        { pattern: 'Valid', frequency: 1 }
      ];
      const result = mergePatterns(patterns, []);
      expect(result).toHaveLength(1);
    });
  });
});
