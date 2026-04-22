/**
 * Smart Trigger Tests - shouldRegenerate and hasNewSessions
 */

import { describe, it, expect } from '@jest/globals';
import { shouldRegenerate, hasNewSessions } from '../src/modules/summaries.js';

describe('shouldRegenerate', () => {
  it('returns shouldRegenerate: true when no old content', () => {
    const result = shouldRegenerate(null, 'new content');
    expect(result.shouldRegenerate).toBe(true);
    expect(result.changePercent).toBe(100);
  });

  it('returns shouldRegenerate: false when content identical', () => {
    const content = 'same content';
    const result = shouldRegenerate(content, content);
    expect(result.shouldRegenerate).toBe(false);
    expect(result.changePercent).toBe(0);
  });

  it('returns shouldRegenerate: false when change < 5%', () => {
    const old = 'a'.repeat(1000);
    const newContent = 'a'.repeat(1030); // 3% change
    const result = shouldRegenerate(old, newContent, 0.05);
    expect(result.shouldRegenerate).toBe(false);
    expect(result.changePercent).toBe(3);
  });

  it('returns shouldRegenerate: true when change >= 5%', () => {
    const old = 'a'.repeat(1000);
    const newContent = 'a'.repeat(1060); // 6% change
    const result = shouldRegenerate(old, newContent, 0.05);
    expect(result.shouldRegenerate).toBe(true);
    expect(result.changePercent).toBe(6);
  });

  it('uses custom threshold when provided', () => {
    const old = 'a'.repeat(1000);
    const newContent = 'a'.repeat(1020); // 2% change
    const result = shouldRegenerate(old, newContent, 0.01); // 1% threshold
    expect(result.shouldRegenerate).toBe(true);
  });
});

describe('hasNewSessions', () => {
  it('returns true when no existing summary', () => {
    const sessions = [{ filename: 'exit-1.md' }];
    const result = hasNewSessions(null, sessions);
    expect(result).toBe(true);
  });

  it('returns true when new sessions array has entries', () => {
    const sessions = [{ filename: 'exit-1.md' }];
    const result = hasNewSessions('', sessions);
    expect(result).toBe(true);
  });

  it('returns false when existing summary has more sessions', () => {
    const existing = '- [2026-04-22] Exit: exit-1.md\n- [2026-04-22] Exit: exit-2.md';
    const sessions = [{ filename: 'exit-1.md' }];
    const result = hasNewSessions(existing, sessions);
    expect(result).toBe(false);
  });

  it('returns true when new sessions exceed existing count', () => {
    const existing = '- [2026-04-22] Exit: exit-1.md';
    const sessions = [
      { filename: 'exit-1.md' },
      { filename: 'exit-2.md' }
    ];
    const result = hasNewSessions(existing, sessions);
    expect(result).toBe(true);
  });
});