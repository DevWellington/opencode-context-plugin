#!/usr/bin/env node
/**
 * Cross-Project Search CLI
 * 
 * Search for sessions across all projects using global intelligence.
 * 
 * Usage:
 *   opencode context-search --global --keyword {term}
 *   opencode context-search --global --bug {symptom}
 *   opencode context-search --project {name} --session {id}
 */

import { parseArgs } from 'node:util';
import { findRelatedSessions, resolveCrossProjectLink, parseCrossProjectLink, formatCrossProjectLink } from '../utils/crossProjectLinks.js';
import { extractSessionContent } from '../modules/contentExtractor.js';
import fs from 'fs/promises';
import path from 'path';

const GLOBAL_INTEL_PATH = path.join(process.env.HOME || '/root', '.opencode', 'global-intelligence.md');

/**
 * Parse global intelligence to find project paths
 */
async function findAllProjects() {
  try {
    const content = await fs.readFile(GLOBAL_INTEL_PATH, 'utf-8');
    // Simple project extraction from section headers
    const projects = [];
    const headerPattern = /^###\s+(.+)/gm;
    let match;
    while ((match = headerPattern.exec(content)) !== null) {
      projects.push(match[1].trim());
    }
    return projects;
  } catch {
    return [];
  }
}

/**
 * Search all projects for keyword
 */
async function searchGlobal(keyword, options = {}) {
  const { maxResults = 10 } = options;
  console.log(`Searching all projects for: "${keyword}"\n`);

  const projects = await findAllProjects();
  if (projects.length === 0) {
    console.log('No projects found in global intelligence.');
    console.log('Make sure you have run sessions in multiple projects.');
    return;
  }

  console.log(`Found ${projects.length} projects in global intelligence.\n`);

  const results = [];
  
  // For each project, search for sessions containing the keyword
  for (const projectName of projects) {
    const resolved = await resolveCrossProjectLink(
      formatCrossProjectLink(projectName, 'test'),
      process.cwd()
    );
    
    if (resolved.projectPath) {
      // Search in project
      const matches = await searchProjectForKeyword(resolved.projectPath, keyword);
      for (const match of matches) {
        results.push({
          project: projectName,
          ...match
        });
      }
    }
  }

  // Display results
  if (results.length === 0) {
    console.log('No matching sessions found.');
    return;
  }

  console.log(`Found ${results.length} matching session(s):\n`);
  
  for (const result of results.slice(0, maxResults)) {
    console.log(`## [[${result.project}:${path.basename(result.sessionPath, '.md')}]]`);
    console.log(`   Project: ${result.project}`);
    console.log(`   Path: ${result.sessionPath}`);
    if (result.preview) {
      console.log(`   Preview: ${result.preview.slice(0, 100)}`);
    }
    console.log('');
  }
}

/**
 * Search a specific project directory for keyword matches
 */
async function searchProjectForKeyword(projectDir, keyword) {
  const contextDir = path.join(projectDir, '.opencode', 'context-session');
  const matches = [];

  try {
    async function searchDir(dir, depth = 0) {
      if (depth > 5) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isFile() && entry.name.endsWith('.md')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              if (content.toLowerCase().includes(keyword.toLowerCase())) {
                const extracted = extractSessionContent(content);
                matches.push({
                  sessionPath: fullPath,
                  preview: extracted.goal || extracted.accomplished || content.slice(0, 100)
                });
              }
            } catch {
              // Skip unreadable files
            }
          } else if (entry.isDirectory()) {
            await searchDir(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }

    await searchDir(contextDir);
  } catch {
    // Project has no context session directory
  }

  return matches;
}

/**
 * Search for bug solutions across projects
 */
async function searchBugSolutions(bugSymptom) {
  console.log(`Searching for bug solutions: "${bugSymptom}"\n`);

  // Use findRelatedSessions with bug option
  const currentSession = {
    content: `Bug: ${bugSymptom}`,
    bug: bugSymptom
  };

  const related = await findRelatedSessions(currentSession, {
    bug: bugSymptom,
    maxResults: 5
  });

  if (related.length === 0) {
    console.log('No solutions found for this bug in other projects.');
    return;
  }

  console.log(`Found ${related.length} solution(s) in other projects:\n`);

  for (const result of related) {
    console.log(`## [[${result.project}:${path.basename(result.session, '.md')}]]`);
    console.log(`   Relevance: ${Math.round(result.relevance * 100)}%`);
    console.log(`   Reason: ${result.reason}`);
    if (result.preview) {
      console.log(`   Preview: ${result.preview.slice(0, 100)}`);
    }
    console.log('');
  }
}

/**
 * Get specific session from a project
 */
async function getSession(projectName, sessionId) {
  console.log(`Fetching session [[${projectName}:${sessionId}]]...\n`);

  const link = formatCrossProjectLink(projectName, sessionId);
  const resolved = await resolveCrossProjectLink(link, process.cwd());

  if (!resolved.exists) {
    console.log(`Session not found: ${resolved.preview || 'Unknown error'}`);
    return;
  }

  console.log(`Project: ${resolved.projectPath}`);
  console.log(`Session: ${resolved.sessionPath}`);
  console.log('\n--- Content Preview ---\n');
  
  if (resolved.content) {
    const extracted = extractSessionContent(resolved.content);
    if (extracted.goal) {
      console.log(`**Goal:** ${extracted.goal}\n`);
    }
    if (extracted.accomplished) {
      console.log(`**Accomplished:** ${extracted.accomplished}\n`);
    }
    if (extracted.discoveries) {
      console.log(`**Discoveries:** ${extracted.discoveries}\n`);
    }
    if (!extracted.goal && !extracted.accomplished) {
      console.log(resolved.content.slice(0, 500) + '...\n');
    }
  } else {
    console.log('Could not read session content.\n');
  }
}

// Main CLI entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(`
Cross-Project Context Search

Search for sessions and bug solutions across all your projects.

Usage:
  opencode context-search --global --keyword {term}
    Search all projects for sessions containing the keyword

  opencode context-search --global --bug {symptom}
    Search for bug solutions across projects

  opencode context-search --project {name} --session {id}
    Get a specific session from a project

Options:
  --global          Search across all projects
  --keyword, -k     Keyword to search for
  --bug, -b         Bug symptom to find solutions for
  --project         Project name
  --session         Session ID/path
  --max-results     Maximum number of results (default: 10)
  --help, -h        Show this help message

Examples:
  opencode context-search --global --keyword "authentication"
  opencode context-search --global --bug "null pointer exception"
  opencode context-search --project my-plugin --session 2026/04/session-end
`);
    process.exit(0);
  }

  try {
    const { values, positionals } = parseArgs({
      args,
      options: {
        'global': { type: 'boolean', default: false },
        'keyword': { type: 'string', short: 'k' },
        'bug': { type: 'string', short: 'b' },
        'project': { type: 'string' },
        'session': { type: 'string' },
        'max-results': { type: 'string', default: '10' }
      },
      allowPositionals: true
    });

    if (values.global) {
      if (values.bug) {
        await searchBugSolutions(values.bug);
      } else if (values.keyword) {
        await searchGlobal(values.keyword, { 
          maxResults: parseInt(values['max-results'], 10) || 10 
        });
      } else {
        console.error('Error: --global requires --keyword or --bug');
        process.exit(1);
      }
    } else if (values.project && values.session) {
      await getSession(values.project, values.session);
    } else {
      console.error('Error: Specify --global with --keyword/--bug, or --project with --session');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();