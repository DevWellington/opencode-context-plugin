/**
 * TokenLimit Module Tests
 */

import { describe, it, expect } from '@jest/globals';
import { countTokens, isCodeContent } from '../src/modules/tokenLimit.js';

describe('isCodeContent', () => {
  it('detects JavaScript code', () => {
    const code = 'function test() { return 42; }';
    expect(isCodeContent(code)).toBe(true);
  });
  
  it('returns false for prose', () => {
    const prose = 'This is a simple paragraph of text.';
    expect(isCodeContent(prose)).toBe(false);
  });
});

describe('countTokens', () => {
  it('uses 3 chars/token for code content', () => {
    const code = 'const x = 1;'; // 12 chars
    expect(countTokens(code)).toBe(4); // ceil(12/3) = 4
  });
  
  it('uses 4 chars/token for prose', () => {
    const prose = 'This is a simple sentence.'; // 26 chars  
    expect(countTokens(prose)).toBe(7); // ceil(26/4) = 7
  });
  
  it('returns 0 for empty content', () => {
    expect(countTokens('')).toBe(0);
    expect(countTokens(null)).toBe(0);
  });
  
  it('accepts explicit type parameter', () => {
    const mixed = 'some text with some code { }'; // 28 chars
    expect(countTokens(mixed, 'code')).toBe(10); // ceil(28/3) = 10
    expect(countTokens(mixed, 'prose')).toBe(7); // ceil(28/4) = 7
  });
});