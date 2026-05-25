import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('isGreeting', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns true for "hi"', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('hi')).toBe(true);
  });

  it('returns true for "hello"', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('hello')).toBe(true);
  });

  it('returns true for "olá"', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('olá')).toBe(true);
  });

  it('returns true for "hey"', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('hey')).toBe(true);
  });

  it('returns true for "bom dia"', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('bom dia')).toBe(true);
  });

  it('returns true for "boa tarde"', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('boa tarde')).toBe(true);
  });

  it('returns true for very short content (< 5 chars)', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('ok')).toBe(true);
    expect(isGreeting('no')).toBe(true);
    expect(isGreeting('yep')).toBe(true);
  });

  it('returns false for meaningful content longer than 30 chars', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    const longContent = 'Implement user authentication with JWT tokens and middleware validation';
    expect(isGreeting(longContent)).toBe(false);
  });

  it('handles null content', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting(null)).toBe(false);
  });

  it('handles undefined content', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting(undefined)).toBe(false);
  });

  it('returns false for non-greeting short content that is 5+ chars', async () => {
    const { isGreeting } = await import('../src/utils/greetingFilter.js');
    expect(isGreeting('debug')).toBe(false);
  });
});

describe('isGreetingTitle', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('detects timestamp-only titles', async () => {
    const { isGreetingTitle } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingTitle('New session - 2026-04-30T16:48:16')).toBe(true);
  });

  it('returns false when hasStructuredContent is true', async () => {
    const { isGreetingTitle } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingTitle('Greeting - Phase 24 analysis', true)).toBe(false);
  });

  it('detects greeting keywords in short titles (< 30 chars)', async () => {
    const { isGreetingTitle } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingTitle('Quick check-in')).toBe(true);
  });

  it('does NOT flag long titles with greeting words', async () => {
    const { isGreetingTitle } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingTitle('Greeting - Phase 24 architecture review and planning meeting')).toBe(false);
  });

  it('returns false for null title', async () => {
    const { isGreetingTitle } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingTitle(null)).toBe(false);
  });

  it('returns false for undefined title', async () => {
    const { isGreetingTitle } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingTitle(undefined)).toBe(false);
  });
});

describe('hasStructuredWorkContent', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('detects ## Goal section', async () => {
    const { hasStructuredWorkContent } = await import('../src/utils/greetingFilter.js');
    const content = '## Goal\nImplement auth\n\n## Accomplished\nDone';
    expect(hasStructuredWorkContent(content)).toBe(true);
  });

  it('detects **Goal:** pattern', async () => {
    const { hasStructuredWorkContent } = await import('../src/utils/greetingFilter.js');
    const content = '- **Goal:** Implement auth\n- **Accomplished:** Done';
    expect(hasStructuredWorkContent(content)).toBe(true);
  });

  it('returns false for unstructured content', async () => {
    const { hasStructuredWorkContent } = await import('../src/utils/greetingFilter.js');
    const content = 'Just a quick hello and some rambling text without structure.';
    expect(hasStructuredWorkContent(content)).toBe(false);
  });

  it('returns false for null content', async () => {
    const { hasStructuredWorkContent } = await import('../src/utils/greetingFilter.js');
    expect(hasStructuredWorkContent(null)).toBe(false);
  });

  it('returns false for empty content', async () => {
    const { hasStructuredWorkContent } = await import('../src/utils/greetingFilter.js');
    expect(hasStructuredWorkContent('')).toBe(false);
  });
});

describe('isGreetingContent', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns true when content is a greeting', async () => {
    const { isGreetingContent } = await import('../src/utils/greetingFilter.js');
    expect(isGreetingContent('hi', 'Some title')).toBe(true);
  });

  it('returns true when title is a greeting even if content is not', async () => {
    const { isGreetingContent } = await import('../src/utils/greetingFilter.js');
    const longContent = 'Implement user authentication with JWT tokens and middleware';
    expect(isGreetingContent(longContent, 'Quick check-in')).toBe(true);
  });

  it('returns false when neither content nor title is a greeting', async () => {
    const { isGreetingContent } = await import('../src/utils/greetingFilter.js');
    const longContent = 'Implement user authentication with JWT tokens and middleware';
    expect(isGreetingContent(longContent, 'Auth Implementation')).toBe(false);
  });
});
