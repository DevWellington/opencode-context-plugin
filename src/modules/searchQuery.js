import { searchSessions } from './searchIndexer.js';

/**
 * Parse search query into structured search options
 * 
 * Supports:
 *   - Simple text: "error fix"
 *   - Quoted phrases: "\"session end\""
 *   - Type filter: type:exit type:compact
 *   - Date range: date:2026-04-01..2026-04-21
 *   - Single date: date:2026-04-21
 * 
 * @param {string} rawQuery - Raw query string
 * @returns {{ text: string, type: string[], dateRange: { start: string|null, end: string|null } }}
 */
export function parseSearchQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    return { text: '', type: [], dateRange: { start: null, end: null } };
  }

  let query = rawQuery.trim();
  const types = [];
  let dateRange = { start: null, end: null };

  // Extract type filters
  const typeRegex = /type:(\w+)/gi;
  let match;
  while ((match = typeRegex.exec(query)) !== null) {
    types.push(match[1].toLowerCase());
  }
  query = query.replace(typeRegex, '').trim();

  // Extract date range
  const dateRangeRegex = /date:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/i;
  const dateRangeMatch = dateRangeRegex.exec(query);
  if (dateRangeMatch) {
    dateRange = { start: dateRangeMatch[1], end: dateRangeMatch[2] };
    query = query.replace(dateRangeRegex, '').trim();
  }

  // Extract single date
  const singleDateRegex = /date:(\d{4}-\d{2}-\d{2})/i;
  const singleDateMatch = singleDateRegex.exec(query);
  if (singleDateMatch) {
    dateRange = { start: singleDateMatch[1], end: singleDateMatch[1] };
    query = query.replace(singleDateRegex, '').trim();
  }

  // Handle quoted phrases - extract them as exact phrases
  const phrases = [];
  const phraseRegex = /"([^"]+)"/g;
  let phraseMatch;
  while ((phraseMatch = phraseRegex.exec(query)) !== null) {
    phrases.push(phraseMatch[1]);
  }
  query = query.replace(phraseRegex, '').trim();

  return {
    text: query,
    phrases,
    type: types,
    dateRange
  };
}

/**
 * Check if a date falls within the range
 */
function isInDateRange(date, start, end) {
  if (!date) return false;
  if (start && end && start === end) {
    return date === start;
  }
  if (start && end) {
    return date >= start && date <= end;
  }
  if (start) {
    return date >= start;
  }
  if (end) {
    return date <= end;
  }
  return true;
}

/**
 * Execute search with parsed query and filters
 * 
 * @param {string} directory - Base directory to search
 * @param {string} query - Search query (raw or parsed)
 * @param {Object} options - Search options
 * @param {number} options.limit - Max results to return (default: 10)
 * @param {number} options.snippetLength - Length of snippets (default: 200)
 * @returns {Promise<Array>} Search results with scores and snippets
 */
export async function executeSearch(directory, query, options = {}) {
  const { limit = 10, snippetLength = 200 } = options;
  
  // Parse query if string
  const parsedQuery = typeof query === 'string' 
    ? parseSearchQuery(query) 
    : query;

  // Build search text from query
  let searchText = parsedQuery.text || '';
  if (parsedQuery.phrases && parsedQuery.phrases.length > 0) {
    searchText = searchText ? `${searchText} ${parsedQuery.phrases.join(' ')}` : parsedQuery.phrases.join(' ');
  }

  // If no search text and no filters, return empty
  if (!searchText && parsedQuery.type.length === 0 && !parsedQuery.dateRange.start) {
    return [];
  }

  // Execute search if we have text
  let results = [];
  if (searchText) {
    results = await searchSessions(directory, searchText, { limit, snippetLength });
  } else {
    // If no text query, get all indexed files and filter
    const { getIndexStats } = await import('./searchIndexer.js');
    const stats = await getIndexStats(directory);
    
    // Without text search we need a different approach - load index and filter
    // For now, if no text, return empty results (would need full scan)
    // This handles cases like "type:exit" without search text
    const fs = await import('fs/promises');
    const path = await import('path');
    const indexPath = path.join(directory, '.opencode/context-session/.search-index.json');
    
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(content);
      
      for (const file of index.indexedFiles) {
        if (parsedQuery.type.length > 0 && !parsedQuery.type.includes(file.type)) {
          continue;
        }
        if (!isInDateRange(file.date, parsedQuery.dateRange.start, parsedQuery.dateRange.end)) {
          continue;
        }
        results.push({
          id: file.id,
          path: file.path,
          score: 1,
          snippet: file.firstLine,
          date: file.date,
          type: file.type
        });
      }
    } catch {
      // Index doesn't exist
      return [];
    }
  }

  // Apply type filter if specified
  if (parsedQuery.type.length > 0) {
    results = results.filter(r => parsedQuery.type.includes(r.type));
  }

  // Apply date filter if specified
  if (parsedQuery.dateRange.start) {
    results = results.filter(r => isInDateRange(r.date, parsedQuery.dateRange.start, parsedQuery.dateRange.end));
  }

  return results;
}

export { parseSearchQuery as default };