/**
 * Search query parser and executor
 */

import { searchSessions } from './searchIndexer.js';

/**
 * Parse search query with inline filters
 * Supports: type:exit, type:compact, date:YYYY-MM-DD, "exact phrase"
 */
export function parseSearchQuery(rawQuery) {
  const result = {
    text: '',
    type: [],
    dateRange: null
  };

  if (!rawQuery || typeof rawQuery !== 'string') {
    return result;
  }

  const parts = rawQuery.split(/\s+/);
  const textParts = [];

  for (const part of parts) {
    // Type filter: type:exit or type:compact
    if (part.startsWith('type:')) {
      const typeValue = part.slice(5).toLowerCase();
      if (typeValue === 'exit' || typeValue === 'compact') {
        result.type.push(typeValue);
      }
    }
    // Date filter: date:YYYY-MM-DD
    else if (part.startsWith('date:')) {
      const dateValue = part.slice(5);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        result.dateRange = {
          start: dateValue,
          end: dateValue
        };
      }
    }
    // Range filter: from:YYYY-MM-DD or to:YYYY-MM-DD
    else if (part.startsWith('from:')) {
      const dateValue = part.slice(5);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        if (!result.dateRange) result.dateRange = { start: null, end: null };
        result.dateRange.start = dateValue;
      }
    }
    else if (part.startsWith('to:')) {
      const dateValue = part.slice(3);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        if (!result.dateRange) result.dateRange = { start: null, end: null };
        result.dateRange.end = dateValue;
      }
    }
    else {
      textParts.push(part);
    }
  }

  result.text = textParts.join(' ');

  return result;
}

/**
 * Execute search with parsed query and CLI options
 */
export async function executeSearch(directory, query, options = {}) {
  const {
    limit = 10,
    snippetLength = 200,
    type: cliType = null,
    from: cliFrom = null,
    to: cliTo = null,
    json = false
  } = options;

  // Parse the query
  const parsed = typeof query === 'string' ? parseSearchQuery(query) : query;

  // Merge CLI options with parsed query
  const typeFilter = parsed.type.length > 0 ? parsed.type : (cliType ? [cliType] : []);

  // Build date range from parsed or CLI options
  let dateRange = parsed.dateRange;
  if (cliFrom || cliTo) {
    dateRange = {
      start: cliFrom || parsed.dateRange?.start || null,
      end: cliTo || parsed.dateRange?.end || null
    };
  }

  // Get base search text
  const searchText = parsed.text;

  // Execute search
  let results = await searchSessions(directory, searchText, { limit, snippetLength });

  // Apply filters
  if (typeFilter.length > 0) {
    results = results.filter(r => typeFilter.includes(r.type));
  }

  if (dateRange) {
    results = results.filter(r => {
      if (!r.date) return false;
      if (dateRange.start && r.date < dateRange.start) return false;
      if (dateRange.end && r.date > dateRange.end) return false;
      return true;
    });
  }

  // Round scores
  results = results.map(r => ({
    ...r,
    score: Math.round(r.score * 100) / 100
  }));

  return results;
}

/**
 * Format results for CLI output
 */
export function formatSearchResults(results, options = {}) {
  const { json = false } = options;

  if (json) {
    return JSON.stringify(results, null, 2);
  }

  if (results.length === 0) {
    return 'No results found.';
  }

  const lines = [];
  lines.push(`\u2501${'\u2501'.repeat(29)} Search Results (${results.length} matches) ${'\u2501'.repeat(29)}`);
  lines.push('');

  for (const result of results) {
    const emoji = result.type === 'exit' ? '\u2709' : '\u2318'; // exit vs compact
    lines.push(`${emoji} ${result.id}`);
    lines.push(`   Date: ${result.date || 'unknown'} | Type: ${result.type}`);
    lines.push(`   Score: ${result.score}`);

    if (result.snippet) {
      lines.push('');
      lines.push(`   ...${result.snippet}...`);
    }

    lines.push('');
    lines.push(`\u2500${'\u2500'.repeat(58)}`);
    lines.push('');
  }

  return lines.join('\n');
}