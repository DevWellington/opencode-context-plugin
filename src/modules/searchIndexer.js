import fs from "fs/promises";
import path from "path";
import { createDebugLogger } from '../utils/debug.js';

const logger = createDebugLogger('search-indexer');

const SEARCH_INDEX_DIR = '.opencode/context-session';
const SEARCH_INDEX_FILE = '.search-index.json';

/**
 * Normalize word for indexing
 */
function normalizeWord(word) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extract words from content
 */
function extractWords(content) {
  const words = content.split(/\s+/);
  return words.filter(w => w.length > 2).map(normalizeWord);
}

/**
 * Build search index for all session files in directory
 */
export async function buildSearchIndex(directory) {
  logger('[searchIndexer] Building search index...');
  const contextDir = path.join(directory, SEARCH_INDEX_DIR);
  const indexPath = path.join(contextDir, SEARCH_INDEX_FILE);

  try {
    // Ensure directory exists
    await fs.mkdir(contextDir, { recursive: true });

    // Recursively find all .md files
    const files = await findSessionFiles(contextDir);
    logger(`[searchIndexer] Found ${files.length} session files`);

    const indexedFiles = [];
    const contentIndex = {};

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const relativePath = path.relative(contextDir, filePath);
        
        // Extract info for index
        const lines = content.split('\n');
        const firstLine = lines.find(l => l.trim()) || '';
        const wordCount = content.split(/\s+/).length;

        // Extract id from filename
        const filename = path.basename(filePath, '.md');
        const id = filename;

        // Index words
        const words = extractWords(content);
        const wordCounts = {};
        words.forEach(word => {
          if (word.length > 2) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
          }
        });

        // Add to content index
        Object.keys(wordCounts).forEach(word => {
          if (!contentIndex[word]) {
            contentIndex[word] = [];
          }
          contentIndex[word].push({
            id,
            count: wordCounts[word],
            path: relativePath
          });
        });

        indexedFiles.push({
          path: relativePath,
          id,
          type: filename.startsWith('exit-') ? 'exit' : filename.startsWith('compact-') ? 'compact' : 'unknown',
          date: extractDateFromPath(relativePath),
          wordCount,
          firstLine: firstLine.slice(0, 100)
        });
      } catch (error) {
        logger(`[searchIndexer] Error indexing ${filePath}: ${error.message}`);
      }
    }

    const index = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      indexedFiles,
      contentIndex
    };

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    logger(`[searchIndexer] Index built with ${indexedFiles.length} files, ${Object.keys(contentIndex).length} unique words`);

    return index;
  } catch (error) {
    logger(`[searchIndexer] Error building index: ${error.message}`);
    throw error;
  }
}

/**
 * Recursively find all .md session files
 */
async function findSessionFiles(dir, files = []) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findSessionFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or is empty
  }
  return files;
}

/**
 * Extract date from path like "2026/04/W1/2026-04-21/exit-xxx.md"
 */
function extractDateFromPath(relativePath) {
  const match = relativePath.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Update search index with a new or modified session file
 */
export async function updateSearchIndex(directory, newSessionPath) {
  logger(`[searchIndexer] Updating index with: ${newSessionPath}`);
  const contextDir = path.join(directory, SEARCH_INDEX_DIR);
  const indexPath = path.join(contextDir, SEARCH_INDEX_FILE);

  try {
    // Load existing index or create new one
    let index;
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(content);
    } catch {
      // Index doesn't exist, build from scratch
      return await buildSearchIndex(directory);
    }

    // Get absolute path
    const absPath = newSessionPath.startsWith('/') 
      ? newSessionPath 
      : path.join(directory, newSessionPath);

    // Check if file exists
    let fileExists = false;
    try {
      await fs.access(absPath);
      fileExists = true;
    } catch {}

    if (!fileExists) {
      logger(`[searchIndexer] File not found: ${absPath}`);
      return index;
    }

    const content = await fs.readFile(absPath, 'utf-8');
    const relativePath = path.relative(contextDir, absPath);
    const filename = path.basename(absPath, '.md');
    const id = filename;
    const lines = content.split('\n');
    const firstLine = lines.find(l => l.trim()) || '';
    const wordCount = content.split(/\s+/).length;

    // Find existing entry and update or add new
    const existingIdx = index.indexedFiles.findIndex(f => f.id === id);
    const fileEntry = {
      path: relativePath,
      id,
      type: filename.startsWith('exit-') ? 'exit' : filename.startsWith('compact-') ? 'compact' : 'unknown',
      date: extractDateFromPath(relativePath),
      wordCount,
      firstLine: firstLine.slice(0, 100)
    };

    if (existingIdx >= 0) {
      index.indexedFiles[existingIdx] = fileEntry;
    } else {
      index.indexedFiles.push(fileEntry);
    }

    // Rebuild content index for this file
    const words = extractWords(content);
    const wordCounts = {};
    words.forEach(word => {
      if (word.length > 2) {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    });

    // Remove old entries for this file from content index
    Object.keys(index.contentIndex).forEach(word => {
      index.contentIndex[word] = index.contentIndex[word].filter(e => e.id !== id);
      if (index.contentIndex[word].length === 0) {
        delete index.contentIndex[word];
      }
    });

    // Add new entries
    Object.keys(wordCounts).forEach(word => {
      if (!index.contentIndex[word]) {
        index.contentIndex[word] = [];
      }
      index.contentIndex[word].push({
        id,
        count: wordCounts[word],
        path: relativePath
      });
    });

    index.lastUpdated = new Date().toISOString();

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    logger(`[searchIndexer] Index updated for ${id}`);

    return index;
  } catch (error) {
    logger(`[searchIndexer] Error updating index: ${error.message}`);
    throw error;
  }
}

/**
 * Search sessions for matching query
 */
export async function searchSessions(directory, query, options = {}) {
  const { limit = 10, snippetLength = 200 } = options;
  logger(`[searchIndexer] Searching for: ${query}`);

  const contextDir = path.join(directory, SEARCH_INDEX_DIR);
  const indexPath = path.join(contextDir, SEARCH_INDEX_FILE);

  try {
    // Load index
    let index;
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(content);
    } catch {
      // Index doesn't exist, build it
      index = await buildSearchIndex(directory);
    }

    // Parse query into words
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0) {
      return [];
    }

    // Score each file
    const scores = {};
    for (const word of queryWords) {
      const normalizedWord = normalizeWord(word);
      const entries = index.contentIndex[normalizedWord] || [];
      for (const entry of entries) {
        if (!scores[entry.id]) {
          scores[entry.id] = { score: 0, entry };
        }
        // Score based on word count (more occurrences = higher score)
        scores[entry.id].score += entry.count;
      }
    }

    // Sort by score
    const sortedIds = Object.keys(scores).sort((a, b) => scores[b].score - scores[a].score);
    const results = [];

    for (const id of sortedIds.slice(0, limit)) {
      const fileEntry = index.indexedFiles.find(f => f.id === id);
      if (!fileEntry) continue;

      const filePath = path.join(contextDir, fileEntry.path);
      
      // Load content for snippet
      let snippet = '';
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        snippet = extractSnippet(content, queryWords, snippetLength);
      } catch {
        snippet = fileEntry.firstLine;
      }

      results.push({
        id: fileEntry.id,
        path: fileEntry.path,
        score: scores[id].score,
        snippet,
        date: fileEntry.date,
        type: fileEntry.type
      });
    }

    logger(`[searchIndexer] Found ${results.length} results`);
    return results;
  } catch (error) {
    logger(`[searchIndexer] Search error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract snippet around matching words
 */
function extractSnippet(content, queryWords, maxLength) {
  const lowerContent = content.toLowerCase();
  
  // Find first occurrence of any query word
  let firstMatchPos = -1;
  for (const word of queryWords) {
    const pos = lowerContent.indexOf(word);
    if (pos >= 0 && (firstMatchPos < 0 || pos < firstMatchPos)) {
      firstMatchPos = pos;
    }
  }

  if (firstMatchPos < 0) {
    // No exact match, return beginning
    return content.slice(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  // Extract surrounding context
  const start = Math.max(0, firstMatchPos - maxLength / 2);
  const end = Math.min(content.length, firstMatchPos + maxLength / 2);
  
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  // Highlight matching words
  for (const word of queryWords) {
    const regex = new RegExp(`(${word})`, 'gi');
    snippet = snippet.replace(regex, '**$1**');
  }

  return snippet;
}

/**
 * Get index statistics
 */
export async function getIndexStats(directory) {
  const contextDir = path.join(directory, SEARCH_INDEX_DIR);
  const indexPath = path.join(contextDir, SEARCH_INDEX_FILE);

  try {
    let index;
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(content);
    } catch {
      return { fileCount: 0, wordCount: 0, lastUpdated: null };
    }

    return {
      fileCount: index.indexedFiles.length,
      wordCount: Object.keys(index.contentIndex).length,
      lastUpdated: index.lastUpdated,
      version: index.version
    };
  } catch (error) {
    logger(`[searchIndexer] Error getting stats: ${error.message}`);
    return { fileCount: 0, wordCount: 0, lastUpdated: null };
  }
}

export { SEARCH_INDEX_DIR, SEARCH_INDEX_FILE };