/**
 * TokenLimit Module Tests
 */

import { describe, it, expect } from '@jest/globals';
import { countTokens, isCodeContent, countSessionTokens } from '../src/modules/tokenLimit.js';

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

describe('countSessionTokens', () => {
  it('returns zero values for empty session', () => {
    const result = countSessionTokens([]);
    expect(result.total).toBe(0);
    expect(result.byRole.user).toBe(0);
    expect(result.byRole.assistant).toBe(0);
    expect(result.byRole.system).toBe(0);
    expect(result.byMessage).toEqual([]);
  });
  
  it('returns zero values for null/undefined session', () => {
    const result = countSessionTokens(null);
    expect(result.total).toBe(0);
    expect(result.byMessage).toEqual([]);
  });
  
  it('counts user message tokens correctly', () => {
    const messages = [
      { content: 'Hello world', role: 'user' }
    ];
    const result = countSessionTokens(messages);
    // "Hello world" = 11 chars, prose = ceil(11/4) = 3
    expect(result.total).toBe(3);
    expect(result.byRole.user).toBe(3);
    expect(result.byRole.assistant).toBe(0);
  });
  
  it('counts mixed roles correctly', () => {
    const messages = [
      { content: 'Hello', role: 'user' },
      { content: 'Hi there!', role: 'assistant' },
      { content: 'System prompt here', role: 'system' }
    ];
    const result = countSessionTokens(messages);
    expect(result.total).toBe(result.byRole.user + result.byRole.assistant + result.byRole.system);
  });
  
  it('byMessage contains preview of first 50 chars', () => {
    const longContent = 'This is a very long message that exceeds fifty characters in length';
    const messages = [
      { content: longContent, role: 'user' }
    ];
    const result = countSessionTokens(messages);
    expect(result.byMessage[0].preview).toBe(longContent.slice(0, 50));
  });
  
  it('byMessage has index, role, tokens fields', () => {
    const messages = [
      { content: 'Test', role: 'user' }
    ];
    const result = countSessionTokens(messages);
    expect(result.byMessage[0]).toHaveProperty('index', 0);
    expect(result.byMessage[0]).toHaveProperty('role', 'user');
    expect(result.byMessage[0]).toHaveProperty('tokens');
    expect(result.byMessage[0]).toHaveProperty('preview', 'Test');
  });
});