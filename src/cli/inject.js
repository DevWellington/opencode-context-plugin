#!/usr/bin/env node
/**
 * Manual context injection CLI
 * Usage: node src/cli/inject.js [--limit 5] [--tokens 8000]
 */

import { fileURLToPath } from 'url';
import { getRelevantContexts, formatForInjection } from '../modules/contextInjector.js';
import { loadConfig } from '../config.js';

export async function main(args = process.argv.slice(2)) {
  const limitIndex = args.indexOf('--limit');
  const tokensIndex = args.indexOf('--tokens');

  const maxContexts = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 5;
  const maxTokens = tokensIndex !== -1 ? parseInt(args[tokensIndex + 1]) : 8000;

  // Load config
  const directory = process.cwd();
  await loadConfig(directory);

  // Mock current session for CLI
  const currentSession = {
    slug: 'cli-session',
    title: 'Manual CLI Context Injection',
    messages: []
  };

  const scoredContexts = await getRelevantContexts(currentSession, {
    maxContexts,
    maxTokens,
    baseDir: directory
  });

  if (scoredContexts.length === 0) {
    console.log('No relevant contexts found.');
    return;
  }

  console.log(formatForInjection(scoredContexts));
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main(process.argv.slice(2)).catch(console.error);