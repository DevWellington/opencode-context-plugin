import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const mockConfig = (overrides = {}) => {
  const defaultProtected = { enabled: false, patterns: [], mode: 'content', sessionsDir: '.opencode/context-session' };
  return {
    getConfig: jest.fn(() => ({
      protected: { ...defaultProtected, ...overrides },
      debug: false,
      debounceMs: 500
    })),
    defaultConfig: { protected: defaultProtected },
    CONTEXT_SESSION_DIR: '.opencode/context-session',
    LOG_FILE: '/tmp/test-pattern-matcher.log'
  };
};

describe('matchesAnyPattern', () => {
  let configModule;

  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns false for null content', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesAnyPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesAnyPattern(null, ['*'])).toBe(false);
  });

  it('returns false for empty content', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesAnyPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesAnyPattern('', ['*'])).toBe(false);
  });

  it('returns false for empty patterns array', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesAnyPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesAnyPattern('test', [])).toBe(false);
  });

  it('returns false when patterns is null', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesAnyPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesAnyPattern('test', null)).toBe(false);
  });

  it('returns true when match is found', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesAnyPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesAnyPattern('secret-file.md', ['*.md', '*.txt'])).toBe(true);
  });

  it('returns false when no pattern matches', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesAnyPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesAnyPattern('notes.txt', ['*.json', '*.yaml'])).toBe(false);
  });
});

describe('matchesPattern', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('handles null content', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern(null, 'test')).toBe(false);
  });

  it('handles null pattern', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('test', null)).toBe(false);
  });

  it('matches regex patterns prefixed with ^', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('secret-api-key', '^secret-')).toBe(true);
  });

  it('does not match non-matching regex patterns', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('public-data', '^secret-')).toBe(false);
  });

  it('matches glob patterns with *', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('hello.md', '*.md')).toBe(true);
  });

  it('matches glob patterns with ?', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('cat.txt', '?at.txt')).toBe(true);
  });

  it('falls back to includes for literal strings', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('my-super-secret', 'secret')).toBe(true);
  });

  it('does not include non-matching literal strings', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('hello-world', 'secret')).toBe(false);
  });

  it('falls back to includes when regex is invalid', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { matchesPattern } = await import('../src/utils/patternMatcher.js');
    expect(matchesPattern('^invalid [regex', '^invalid [regex')).toBe(true);
  });
});

describe('isProtectedSession', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns false when sessionInfo is null', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true }));
    const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedSession(null)).toBe(false);
  });

  it('returns false when protected is disabled', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: false }));
    const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedSession({ filename: 'exit-protected-test.md', path: '/tmp/test.md' })).toBe(false);
  });

  it('returns false when mode is content', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['exit-protected-*'] }));
    const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedSession({ filename: 'exit-protected-test.md', path: '/tmp/exit-protected-test.md' })).toBe(false);
  });

  it('returns true when filename matches pattern in session mode', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['exit-protected-*'] }));
    const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedSession({ filename: 'exit-protected-test.md', path: '/tmp/test.md' })).toBe(true);
  });

  it('returns true when path matches pattern in session mode', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['*/secret/*'] }));
    const { isProtectedSession } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedSession({ filename: 'session.md', path: 'projects/secret/session.md' })).toBe(true);
  });
});

describe('isProtectedContent', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns false for null content', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['secret'] }));
    const { isProtectedContent } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedContent(null)).toBe(false);
  });

  it('returns false when protected is disabled', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: false }));
    const { isProtectedContent } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedContent('this contains secret info')).toBe(false);
  });

  it('returns false when mode is session', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['secret'] }));
    const { isProtectedContent } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedContent('this contains secret info')).toBe(false);
  });

  it('returns true when content matches pattern', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['secret'] }));
    const { isProtectedContent } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedContent('this contains secret info')).toBe(true);
  });

  it('returns false when content does not match pattern', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['secret'] }));
    const { isProtectedContent } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedContent('this is public info')).toBe(false);
  });
});

describe('getProtectionStatus', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns skipSession false when not protected', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig());
    const { getProtectionStatus } = await import('../src/utils/patternMatcher.js');
    const result = getProtectionStatus({ filename: 'test.md', path: '/tmp/test.md' });
    expect(result).toEqual({ skipSession: false, skipContent: false });
  });

  it('returns skipSession true and skipContent false for session mode', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['exit-protected-*'] }));
    const { getProtectionStatus } = await import('../src/utils/patternMatcher.js');
    const result = getProtectionStatus({ filename: 'exit-protected-test.md', path: '/tmp/test.md' }, 'some content');
    expect(result).toEqual({ skipSession: true, skipContent: false });
  });

  it('returns skipContent true for content mode', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['secret'] }));
    const { getProtectionStatus } = await import('../src/utils/patternMatcher.js');
    const result = getProtectionStatus({ filename: 'test.md', path: '/tmp/test.md' }, 'this is secret content');
    expect(result).toEqual({ skipSession: false, skipContent: true });
  });
});

describe('isProtected', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns false for null/undefined', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['test'] }));
    const { isProtected } = await import('../src/utils/patternMatcher.js');
    expect(isProtected(null)).toBe(false);
    expect(isProtected(undefined)).toBe(false);
  });

  it('auto-detects session object and checks session protection', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['exit-protected-*'] }));
    const { isProtected } = await import('../src/utils/patternMatcher.js');
    expect(isProtected({ filename: 'exit-protected-test.md', path: '/tmp/test.md' })).toBe(true);
  });

  it('auto-detects content string and checks content protection', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['secret'] }));
    const { isProtected } = await import('../src/utils/patternMatcher.js');
    expect(isProtected('this has secret info')).toBe(true);
  });

  it('returns false for unprotected content string', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'content', patterns: ['secret'] }));
    const { isProtected } = await import('../src/utils/patternMatcher.js');
    expect(isProtected('public info')).toBe(false);
  });
});

describe('isProtectedPath', () => {
  beforeEach(async () => {
    jest.resetModules();
  });

  it('returns false when protected is disabled', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: false }));
    const { isProtectedPath } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedPath('/tmp/secret/file.md', 'file.md')).toBe(false);
  });

  it('returns true when full path matches pattern', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['*/secret/*'] }));
    const { isProtectedPath } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedPath('projects/secret/file.md', 'file.md')).toBe(true);
  });

  it('returns true when filename matches pattern', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['exit-protected-*'] }));
    const { isProtectedPath } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedPath('/tmp/exit-protected-test.md', 'exit-protected-test.md')).toBe(true);
  });

  it('returns false when nothing matches pattern', async () => {
    jest.unstable_mockModule('../src/config.js', () => mockConfig({ enabled: true, mode: 'session', patterns: ['secret'] }));
    const { isProtectedPath } = await import('../src/utils/patternMatcher.js');
    expect(isProtectedPath('/tmp/public/file.md', 'file.md')).toBe(false);
  });
});
