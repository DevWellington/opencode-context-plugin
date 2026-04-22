#!/usr/bin/env node
/**
 * CLI search tool for context files
 * Usage: node src/cli/search.js [options] [search query]
 */

import { executeSearch, formatSearchResults, parseSearchQuery } from '../modules/searchQuery.js';
import { buildSearchIndex, getIndexStats } from '../modules/searchIndexer.js';
import { loadConfig } from '../config.js';

const HELP = `
Context Search CLI
==================

Usage:
  node src/cli/search.js [options] [search query]

Options:
  --limit N         Max results (default: 10)
  --type TYPE       Filter by type: exit, compact, or both
  --from DATE       Start date (YYYY-MM-DD)
  --to DATE         End date (YYYY-MM-DD)
  --json            Output as JSON
  --build-index     Rebuild search index before searching
  --stats           Show index statistics

Query syntax:
  node src/cli/search.js "error fix"
  node src/cli/search.js --type exit "authentication"
  node src/cli/search.js --from 2026-04-01 --to 2026-04-21 "bug"
  node src/cli/search.js --type compact --from 2026-04-15 "performance"

Inline filters:
  type:exit date:2026-04-21 "search terms"
  from:2026-04-01 to:2026-04-15 "query"
`.trim();

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  // Parse arguments
  let query = '';
  let limit = 10;
  let typeFilter = null;
  let dateFrom = null;
  let dateTo = null;
  let jsonOutput = false;
  let buildIndex = false;
  let showStats = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[++i], 10);
    } else if (arg === '--type' && i + 1 < args.length) {
      typeFilter = args[++i];
    } else if (arg === '--from' && i + 1 < args.length) {
      dateFrom = args[++i];
    } else if (arg === '--to' && i + 1 < args.length) {
      dateTo = args[++i];
    } else if (arg === '--json') {
      jsonOutput = true;
    } else if (arg === '--build-index') {
      buildIndex = true;
    } else if (arg === '--stats') {
      showStats = true;
    } else if (!arg.startsWith('--')) {
      // Accumulate as search query
      query = query ? `${query} ${arg}` : arg;
    }
  }

  const directory = process.cwd();

  // Load config
  await loadConfig(directory);

  // Show stats if requested
  if (showStats) {
    const stats = await getIndexStats(directory);
    console.log('\nIndex Statistics:');
    console.log(`  Total files: ${stats.total}`);
    console.log(`  Exit sessions: ${stats.exit}`);
    console.log(`  Compact sessions: ${stats.compact}`);
    console.log(`  Last built: ${stats.lastBuilt || 'never'}`);
    return;
  }

  // Build index if requested
  if (buildIndex) {
    console.log('Building search index...');
    await buildSearchIndex(directory);
    console.log('Index built successfully.');
  }

  // Execute search
  const results = await executeSearch(directory, query, {
    limit,
    type: typeFilter,
    from: dateFrom,
    to: dateTo,
    json: jsonOutput
  });

  // Output results
  const output = formatSearchResults(results, { json: jsonOutput });
  console.log(output);
}

main().catch(err => {
  console.error('Search error:', err.message);
  process.exit(1);
});