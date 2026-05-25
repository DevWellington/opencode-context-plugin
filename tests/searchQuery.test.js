/**
 * Search Query Module Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('../src/modules/searchIndexer.js', () => ({
  searchSessions: jest.fn()
}));

const { parseSearchQuery, executeSearch, formatSearchResults } = await import('../src/modules/searchQuery.js');
const { searchSessions } = await import('../src/modules/searchIndexer.js');

describe('parseSearchQuery', () => {
  it('should parse type:exit filter', () => {
    const result = parseSearchQuery('type:exit');
    expect(result.text).toBe('');
    expect(result.type).toEqual(['exit']);
    expect(result.dateRange).toBeNull();
  });

  it('should parse type:compact filter', () => {
    const result = parseSearchQuery('type:compact');
    expect(result.type).toEqual(['compact']);
  });

  it('should parse date:YYYY-MM-DD filter', () => {
    const result = parseSearchQuery('date:2026-04-21');
    expect(result.dateRange).toEqual({ start: '2026-04-21', end: '2026-04-21' });
  });

  it('should parse from: and to: date range', () => {
    const result = parseSearchQuery('from:2026-04-01 to:2026-04-30');
    expect(result.dateRange).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('should handle from: without to:', () => {
    const result = parseSearchQuery('from:2026-04-01');
    expect(result.dateRange).toEqual({ start: '2026-04-01', end: null });
  });

  it('should handle to: without from:', () => {
    const result = parseSearchQuery('to:2026-04-30');
    expect(result.dateRange).toEqual({ start: null, end: '2026-04-30' });
  });

  it('should combine multiple filters', () => {
    const result = parseSearchQuery('type:exit date:2026-04-21');
    expect(result.type).toEqual(['exit']);
    expect(result.dateRange).toEqual({ start: '2026-04-21', end: '2026-04-21' });
  });

  it('should handle null input', () => {
    const result = parseSearchQuery(null);
    expect(result.text).toBe('');
    expect(result.type).toEqual([]);
    expect(result.dateRange).toBeNull();
  });

  it('should handle undefined input', () => {
    const result = parseSearchQuery(undefined);
    expect(result.text).toBe('');
    expect(result.type).toEqual([]);
  });

  it('should handle empty string input', () => {
    const result = parseSearchQuery('');
    expect(result.text).toBe('');
    expect(result.type).toEqual([]);
  });

  it('should separate text from filter tokens', () => {
    const result = parseSearchQuery('authentication type:exit login');
    expect(result.text).toBe('authentication login');
    expect(result.type).toEqual(['exit']);
  });

  it('should silently drop invalid type values without adding to text', () => {
    const result = parseSearchQuery('type:invalid');
    expect(result.type).toEqual([]);
    expect(result.text).toBe('');
  });

  it('should silently drop malformed date values', () => {
    const result = parseSearchQuery('date:not-a-date');
    expect(result.dateRange).toBeNull();
    expect(result.text).toBe('');
  });

  it('should silently drop malformed from/to values', () => {
    const result = parseSearchQuery('from:bad to:also-bad');
    expect(result.dateRange).toBeNull();
    expect(result.text).toBe('');
  });
});

describe('executeSearch', () => {
  const mockResults = [
    { id: 'exit-auth-1', path: '/sessions/exit-auth-1.md', score: 0.95, snippet: 'Implemented JWT auth', date: '2026-04-20', type: 'exit' },
    { id: 'compact-cache', path: '/sessions/compact-cache.md', score: 0.85, snippet: 'Added caching layer', date: '2026-04-21', type: 'compact' },
    { id: 'exit-middleware', path: '/sessions/exit-middleware.md', score: 0.75, snippet: 'Created middleware', date: '2026-04-22', type: 'exit' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    searchSessions.mockResolvedValue(mockResults);
  });

  it('should return filtered results by type', async () => {
    const results = await executeSearch('/tmp', 'type:exit');
    expect(results).toHaveLength(2);
    expect(results.every(r => r.type === 'exit')).toBe(true);
  });

  it('should return filtered results by compact type', async () => {
    const results = await executeSearch('/tmp', 'type:compact');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('compact');
  });

  it('should filter by date start range', async () => {
    const results = await executeSearch('/tmp', 'from:2026-04-21');
    expect(results).toHaveLength(2);
    expect(results.every(r => r.date >= '2026-04-21')).toBe(true);
    expect(results[0].id).toBe('compact-cache');
    expect(results[1].id).toBe('exit-middleware');
  });

  it('should filter by date end range', async () => {
    const results = await executeSearch('/tmp', 'to:2026-04-21');
    expect(results).toHaveLength(2);
    expect(results.every(r => r.date <= '2026-04-21')).toBe(true);
  });

  it('should filter by exact date', async () => {
    const results = await executeSearch('/tmp', 'date:2026-04-21');
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe('2026-04-21');
  });

  it('should combine type and date filters', async () => {
    const results = await executeSearch('/tmp', 'type:exit from:2026-04-21');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('exit-middleware');
  });

  it('should handle no results gracefully', async () => {
    searchSessions.mockResolvedValue([]);
    const results = await executeSearch('/tmp', 'something-unlikely');
    expect(results).toEqual([]);
  });

  it('should round scores to 2 decimal places', async () => {
    searchSessions.mockResolvedValue([
      { id: 'test', path: '/test.md', score: 0.123456, snippet: 'test', date: '2026-04-21', type: 'exit' }
    ]);
    const results = await executeSearch('/tmp', 'test');
    expect(results[0].score).toBe(0.12);
  });
});

describe('formatSearchResults', () => {
  const results = [
    { id: 'exit-auth', date: '2026-04-20', type: 'exit', score: 0.95, snippet: 'JWT auth implemented' },
    { id: 'compact-cache', date: '2026-04-21', type: 'compact', score: 0.85, snippet: 'Cache layer added' }
  ];

  it('should format as JSON when json option is true', () => {
    const output = formatSearchResults(results, { json: true });
    const parsed = JSON.parse(output);
    expect(parsed).toEqual(results);
  });

  it('should format as text by default', () => {
    const output = formatSearchResults(results);
    expect(output).toContain('Search Results (2 matches)');
    expect(output).toContain('exit-auth');
    expect(output).toContain('compact-cache');
    expect(output).toContain('JWT auth implemented');
    expect(output).toContain('Cache layer added');
    expect(output).toContain('exit');
    expect(output).toContain('compact');
    expect(output).toContain('0.95');
    expect(output).toContain('0.85');
  });

  it('should include emoji for exit type', () => {
    const output = formatSearchResults([results[0]]);
    expect(output).toContain('\u2709');
  });

  it('should include emoji for compact type', () => {
    const output = formatSearchResults([results[1]]);
    expect(output).toContain('\u2318');
  });

  it('should return message for empty results', () => {
    const output = formatSearchResults([]);
    expect(output).toBe('No results found.');
  });

  it('should return empty results message even when json is true', () => {
    const output = formatSearchResults([], { json: true });
    expect(output).toBe('[]');
  });

  it('should handle results without snippet', () => {
    const noSnippet = [{ id: 'test', date: '2026-04-21', type: 'exit', score: 0.5 }];
    const output = formatSearchResults(noSnippet);
    expect(output).toContain('test');
    expect(output).not.toContain('snippet');
  });

  it('should handle results without date', () => {
    const noDate = [{ id: 'test', type: 'exit', score: 0.5, snippet: 'something' }];
    const output = formatSearchResults(noDate);
    expect(output).toContain('unknown');
  });
});
