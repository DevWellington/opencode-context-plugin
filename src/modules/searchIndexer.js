#!/usr/bin/env node
/**
 * Search indexer module
 * Builds and maintains a search index of context files
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const CONTEXT_SESSION_DIR = '.opencode/context-session';
const INDEX_DIR = '.opencode/context-session/.index';

/**
 * Extract text content from context file
 */
function extractText(content) {
  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/m, '');
  // Remove markdown formatting but keep text
  return withoutFrontmatter
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

/**
 * Simple tokenizer for search
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 2)
    .filter(t => !/^\d+$/.test(t));
}

/**
 * Build search index from context files
 */
export async function buildSearchIndex(directory = process.cwd()) {
  const indexPath = path.join(directory, INDEX_DIR);
  const contextDir = path.join(directory, CONTEXT_SESSION_DIR);

  const index = {
    builtAt: new Date().toISOString(),
    files: []
  };

  try {
    await fs.mkdir(indexPath, { recursive: true });

    // Scan for all context files
    const files = await scanDirectory(contextDir);

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = matter(content);
        const text = extractText(content);
        const tokens = tokenize(text);

        const stat = await fs.stat(filePath);
        const filename = path.basename(filePath, '.md');

        // Parse type from filename (exit- or compact-)
        const type = filename.startsWith('exit-') ? 'exit' :
                     filename.startsWith('compact-') ? 'compact' : 'unknown';

        // Parse date from filename
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? dateMatch[1] : null;

        index.files.push({
          id: filename,
          path: filePath,
          type,
          date,
          tokens,
          tokenCount: tokens.length,
          mtime: stat.mtime.toISOString(),
          snippet: text.slice(0, 500) // First 500 chars for preview
        });
      } catch (err) {
        // Skip problematic files
      }
    }

    // Save index
    const indexFile = path.join(indexPath, 'search-index.json');
    await fs.writeFile(indexFile, JSON.stringify(index, null, 2));

    return index;
  } catch (error) {
    throw error;
  }
}

/**
 * Scan directory for context files recursively
 */
async function scanDirectory(dir) {
  const results = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip .index directory
        if (entry.name === '.index') continue;
        const subResults = await scanDirectory(fullPath);
        results.push(...subResults);
      } else if (entry.name.startsWith('exit-') || entry.name.startsWith('compact-')) {
        if (entry.name.endsWith('.md')) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return results;
}

/**
 * Load search index
 */
export async function loadSearchIndex(directory = process.cwd()) {
  const indexFile = path.join(directory, INDEX_DIR, 'search-index.json');

  try {
    const content = await fs.readFile(indexFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Search sessions with query and options
 */
export async function searchSessions(directory, query, options = {}) {
  const { limit = 10, snippetLength = 200 } = options;

  // Load or build index
  let index = await loadSearchIndex(directory);

  if (!index || !index.files || index.files.length === 0) {
    // Try to build index
    try {
      index = await buildSearchIndex(directory);
    } catch {
      return [];
    }
  }

  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    // Return recent files if no query
    return index.files
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
      .slice(0, limit)
      .map(f => ({
        id: f.id,
        path: f.path,
        score: 1,
        snippet: f.snippet.slice(0, snippetLength),
        date: f.date,
        type: f.type
      }));
  }

  // Score each file
  const scored = index.files.map(file => {
    let score = 0;
    const fileTokens = new Set(file.tokens);

    for (const qt of queryTokens) {
      for (const ft of fileTokens) {
        if (ft.includes(qt) || qt.includes(ft)) {
          score += 1;
          // Exact match bonus
          if (ft === qt) score += 2;
        }
      }
      // Also check snippet
      if (file.snippet.toLowerCase().includes(qt)) {
        score += 0.5;
      }
    }

    return { ...file, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Get top results
  const results = scored.slice(0, limit).map(f => {
    // Find snippet around match
    const lowerSnippet = f.snippet.toLowerCase();
    let snippetStart = 0;
    for (const qt of queryTokens) {
      const pos = lowerSnippet.indexOf(qt);
      if (pos !== -1) {
        snippetStart = Math.max(0, pos - 50);
        break;
      }
    }

    return {
      id: f.id,
      path: f.path,
      score: f.score / (queryTokens.length * 3), // Normalize
      snippet: f.snippet.slice(snippetStart, snippetStart + snippetLength),
      date: f.date,
      type: f.type
    };
  });

  return results;
}

/**
 * Get index statistics
 */
export async function getIndexStats(directory = process.cwd()) {
  const index = await loadSearchIndex(directory);

  if (!index || !index.files) {
    return { total: 0, exit: 0, compact: 0, lastBuilt: null };
  }

  const exit = index.files.filter(f => f.type === 'exit').length;
  const compact = index.files.filter(f => f.type === 'compact').length;

  return {
    total: index.files.length,
    exit,
    compact,
    lastBuilt: index.builtAt
  };
}

/**
 * Update search index with a new or modified session file
 * This is called by saveContext.js when a new session is saved
 */
export async function updateSearchIndex(directory, sessionFilePath) {
  const indexFile = path.join(directory, INDEX_DIR, 'search-index.json');
  
  try {
    // Load existing index
    let index = await loadSearchIndex(directory);
    
    // If no index exists, build from scratch
    if (!index || !index.files) {
      return await buildSearchIndex(directory);
    }

    // Get absolute path to the session file
    const absPath = path.isAbsolute(sessionFilePath) 
      ? sessionFilePath 
      : path.join(directory, sessionFilePath);

    // Check if file exists
    try {
      await fs.access(absPath);
    } catch {
      // File doesn't exist, skip update
      return index;
    }

    // Read and parse the session file
    const content = await fs.readFile(absPath, 'utf-8');
    const text = extractText(content);
    const tokens = tokenize(text);
    const filename = path.basename(absPath, '.md');
    const stat = await fs.stat(absPath);

    // Parse type from filename
    const type = filename.startsWith('exit-') ? 'exit' :
                 filename.startsWith('compact-') ? 'compact' : 'unknown';

    // Parse date from filename
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : null;

    // Create file entry
    const fileEntry = {
      id: filename,
      path: absPath,
      type,
      date,
      tokens,
      tokenCount: tokens.length,
      mtime: stat.mtime.toISOString(),
      snippet: text.slice(0, 500)
    };

    // Find and update existing entry or add new one
    const existingIdx = index.files.findIndex(f => f.id === filename);
    if (existingIdx >= 0) {
      index.files[existingIdx] = fileEntry;
    } else {
      index.files.push(fileEntry);
    }

    // Update built timestamp
    index.builtAt = new Date().toISOString();

    // Save updated index
    await fs.writeFile(indexFile, JSON.stringify(index, null, 2));

    return index;
  } catch (error) {
    // If update fails, return null (caller should handle gracefully)
    return null;
  }
}