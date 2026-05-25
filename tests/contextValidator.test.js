import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const FULL_STRUCTURED_CONTENT = `## Goal
Implement user authentication with JWT tokens

## Accomplished
- Created auth middleware
- Implemented login endpoint

## Discoveries
- JWT tokens should have expiration time

## Relevant Files
- src/middleware/auth.js
`;

const TOO_SHORT_CONTENT = 'Hello';

const MISSING_GOAL = `## Accomplished
- Created auth middleware

## Discoveries
- Some discovery

## Relevant Files
- src/file.js
`;

const MISSING_ACCOMPLISHED = `## Goal
Implement auth

## Discoveries
- Some discovery

## Relevant Files
- src/file.js
`;

const MISSING_DISCOVERIES_AND_FILES = `## Goal
Implement auth

## Accomplished
- Created auth middleware
`;

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({ debug: false, debounceMs: 500 })),
  defaultConfig: {},
  CONTEXT_SESSION_DIR: '.opencode/context-session',
  LOG_FILE: '/tmp/test-validator.log'
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn()),
  DEBUG_KEY: 'debug'
}));

const { validateSessionContent, getSuggestions, validateAfterSave, logFailedValidation } = await import('../src/modules/contextValidator.js');

describe('validateSessionContent', () => {
  it('returns valid for full structured content', () => {
    const result = validateSessionContent(FULL_STRUCTURED_CONTENT, 'test-session.md');
    expect(result.isValid).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.missingFields).toEqual([]);
  });

  it('returns invalid for content too short (< 50 chars)', () => {
    const result = validateSessionContent(TOO_SHORT_CONTENT, 'short.md');
    expect(result.isValid).toBe(false);
    expect(result.warnings).toContain('Content too short to validate');
    expect(result.missingFields).toContain('content');
  });

  it('returns invalid for null content', () => {
    const result = validateSessionContent(null, 'null.md');
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('content');
  });

  it('returns invalid for empty content', () => {
    const result = validateSessionContent('', 'empty.md');
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('content');
  });

  it('identifies missing Goal section', () => {
    const result = validateSessionContent(MISSING_GOAL, 'no-goal.md');
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Goal');
    expect(result.warnings.some(w => w.includes('Goal'))).toBe(true);
  });

  it('identifies missing Accomplished section', () => {
    const result = validateSessionContent(MISSING_ACCOMPLISHED, 'no-accomplished.md');
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Accomplished');
    expect(result.warnings.some(w => w.includes('Accomplished'))).toBe(true);
  });

  it('identifies missing Discoveries AND Relevant Files', () => {
    const result = validateSessionContent(MISSING_DISCOVERIES_AND_FILES, 'no-discovery.md');
    expect(result.isValid).toBe(false);
    expect(result.missingFields).toContain('Discovery OR Relevant Files');
    expect(result.warnings.some(w => w.includes('Discovery'))).toBe(true);
  });
});

describe('getSuggestions', () => {
  it('returns suggestion for missing Goal', () => {
    const result = { isValid: false, warnings: [], missingFields: ['Goal'] };
    const suggestions = getSuggestions(result);
    expect(suggestions).toContain('Add "## Goal" section at start describing what you plan to accomplish');
  });

  it('returns suggestion for missing Accomplished', () => {
    const result = { isValid: false, warnings: [], missingFields: ['Accomplished'] };
    const suggestions = getSuggestions(result);
    expect(suggestions).toContain('Add "## Accomplished" section before session ends listing completed work');
  });

  it('returns suggestion for missing Discovery OR Relevant Files', () => {
    const result = { isValid: false, warnings: [], missingFields: ['Discovery OR Relevant Files'] };
    const suggestions = getSuggestions(result);
    expect(suggestions).toContain('Add "## Discoveries" section with findings or "## Relevant Files" section with file paths');
  });

  it('returns empty array for valid result', () => {
    const result = { isValid: true, warnings: [], missingFields: [] };
    expect(getSuggestions(result)).toEqual([]);
  });

  it('returns multiple suggestions for multiple missing fields', () => {
    const result = { isValid: false, warnings: [], missingFields: ['Goal', 'Accomplished'] };
    const suggestions = getSuggestions(result);
    expect(suggestions.length).toBe(2);
  });
});

describe('logFailedValidation', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validator-test-'));
    await fs.mkdir(path.join(tempDir, '.opencode', 'context-session'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true }).catch(() => {});
  });

  it('does nothing when result is valid', async () => {
    const result = { isValid: true, warnings: [], missingFields: [] };
    await logFailedValidation(tempDir, result, 'session.md');
    const intelPath = path.join(tempDir, '.opencode', 'context-session', 'intelligence-learning.md');
    await expect(fs.access(intelPath)).rejects.toThrow();
  });

  it('writes to intelligence-learning.md on failed validation', async () => {
    const result = { isValid: false, warnings: ['Missing Goal'], missingFields: ['Goal'] };
    await logFailedValidation(tempDir, result, 'bad-session.md');
    const intelPath = path.join(tempDir, '.opencode', 'context-session', 'intelligence-learning.md');
    const content = await fs.readFile(intelPath, 'utf-8');
    expect(content).toContain('## Failed Approaches');
    expect(content).toContain('ANTI-PATTERN');
    expect(content).toContain('bad-session.md');
    expect(content).toContain('Goal');
  });

  it('appends to existing intelligence-learning.md', async () => {
    const intelPath = path.join(tempDir, '.opencode', 'context-session', 'intelligence-learning.md');
    await fs.writeFile(intelPath, '## Existing Section\ncontent\n\n## Failed Approaches\n- Existing entry\n');

    const result = { isValid: false, warnings: [], missingFields: ['Accomplished'] };
    await logFailedValidation(tempDir, result, 'another-session.md');

    const content = await fs.readFile(intelPath, 'utf-8');
    expect(content).toContain('Existing entry');
    expect(content).toContain('another-session.md');
    expect(content).toContain('Accomplished');
  });
});

describe('validateAfterSave', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validator-after-save-'));
    await fs.mkdir(path.join(tempDir, '.opencode', 'context-session'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true }).catch(() => {});
  });

  it('returns valid result for good content without writing to intelligence', async () => {
    const result = await validateAfterSave(tempDir, FULL_STRUCTURED_CONTENT, 'good-session.md');
    expect(result.isValid).toBe(true);

    const intelPath = path.join(tempDir, '.opencode', 'context-session', 'intelligence-learning.md');
    await expect(fs.access(intelPath)).rejects.toThrow();
  });

  it('returns invalid result for bad content and logs failure', async () => {
    const result = await validateAfterSave(tempDir, TOO_SHORT_CONTENT, 'bad-session.md');
    expect(result.isValid).toBe(false);

    const intelPath = path.join(tempDir, '.opencode', 'context-session', 'intelligence-learning.md');
    const content = await fs.readFile(intelPath, 'utf-8');
    expect(content).toContain('bad-session.md');
  });
});
