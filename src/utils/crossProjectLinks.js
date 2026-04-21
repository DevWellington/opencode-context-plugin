/**
 * Cross-Project Links Module
 * 
 * Enables referencing sessions across different projects using [[project:session-id]] format.
 * Uses global intelligence to discover and resolve cross-project references.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createDebugLogger } from './debug.js';

const logger = createDebugLogger('cross-project-links');

/**
 * Get the global intelligence file path
 * @returns {string} Path to ~/.opencode/global-intelligence.md
 */
export function getGlobalIntelligencePath() {
  return path.join(os.homedir(), '.opencode', 'global-intelligence.md');
}

/**
 * Get the global intelligence directory
 * @returns {string} Path to ~/.opencode/
 */
function getGlobalDirectory() {
  return path.join(os.homedir(), '.opencode');
}

/**
 * Parse a cross-project link in [[project:session-id]] format
 * @param {string} link - The link to parse (e.g., "my-plugin:2026/04/session-end")
 * @returns {Object} { projectName, sessionPath, isValid }
 */
export function parseCrossProjectLink(link) {
  if (!link || typeof link !== 'string') {
    return { projectName: null, sessionPath: null, isValid: false };
  }

  // Match [[project:session-id]] or [[project:path/to/session]]
  const match = link.match(/^\[\[([^\]:]+):([^\]]+)\]\]$/);
  
  if (match) {
    return {
      projectName: match[1].trim(),
      sessionPath: match[2].trim(),
      isValid: true
    };
  }

  // Also match bare project:session-id format (without brackets)
  const bareMatch = link.match(/^([^\:]+):([^\:]+)$/);
  if (bareMatch) {
    return {
      projectName: bareMatch[1].trim(),
      sessionPath: bareMatch[2].trim(),
      isValid: true
    };
  }

  return { projectName: null, sessionPath: null, isValid: false };
}

/**
 * Format a cross-project link in [[project:session-id]] format
 * @param {string} projectName - Name of the project
 * @param {string} sessionPath - Path or identifier for the session
 * @returns {string} Formatted link like [[project:session-id]]
 */
export function formatCrossProjectLink(projectName, sessionPath) {
  if (!projectName || !sessionPath) {
    return '';
  }
  return `[[${projectName}:${sessionPath}]]`;
}

/**
 * Read global intelligence file to find project paths
 * @returns {Promise<Object>} Map of project names to their paths/info
 */
async function readGlobalIntelligence() {
  const globalPath = getGlobalIntelligencePath();
  
  try {
    const content = await fs.readFile(globalPath, 'utf-8');
    return parseGlobalIntelligenceContent(content);
  } catch (error) {
    logger(`[resolve] Could not read global intelligence: ${error.message}`);
    return { projects: {}, lastUpdate: null };
  }
}

/**
 * Parse global intelligence content to extract project information
 * @param {string} content - Raw global intelligence file content
 * @returns {Object} { projects: { name: { path, lastUpdated, keywords } }, lastUpdate }
 */
function parseGlobalIntelligenceContent(content) {
  const result = {
    projects: {},
    lastUpdate: null
  };

  if (!content) return result;

  // Find the Cross-Project Learnings section
  const sectionMatch = content.match(/##\s*Cross-Project Learnings\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!sectionMatch) {
    // Try alternative parsing - look for project headers
    const projectHeaders = content.match(/^###\s+(.+)/gm);
    if (projectHeaders) {
      for (const header of projectHeaders) {
        const name = header.replace(/^###\s+/, '').trim();
        result.projects[name] = {
          path: null, // Will be discovered from intelligence learning
          lastUpdated: null,
          keywords: []
        };
      }
    }
    return result;
  }

  const sectionContent = sectionMatch[1];
  
  // Parse each project's entry
  const projectBlocks = sectionContent.split(/^###\s+/m);
  
  for (const block of projectBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.split('\n');
    const projectName = lines[0]?.trim();
    if (!projectName) continue;

    const projectInfo = {
      path: null,
      lastUpdated: null,
      keywords: []
    };

    // Extract last updated timestamp
    const updatedMatch = block.match(/\*\*Last Updated:\*\*\s*(.+)/i);
    if (updatedMatch) {
      projectInfo.lastUpdated = updatedMatch[1].trim();
    }

    // Extract key learnings (keywords)
    const learningsMatch = block.match(/\*\*Key Learnings:\*\*\s*([\s\S]*?)(?=\n-|\n\n|$)/i);
    if (learningsMatch) {
      const learnings = learningsMatch[1];
      // Extract keywords/bullet points
      const keywords = [];
      const keywordMatches = learnings.matchAll(/-?\s*\*?\*?([^\n\*]+)/g);
      for (const match of keywordMatches) {
        const keyword = match[1].trim();
        if (keyword && keyword.length > 2) {
          keywords.push(keyword);
        }
      }
      projectInfo.keywords = keywords;
    }

    result.projects[projectName] = projectInfo;
  }

  return result;
}

/**
 * Discover project directories by scanning common locations
 * @param {string} projectName - Name of the project to find
 * @returns {Promise<string|null>} Path to project or null if not found
 */
async function discoverProjectPath(projectName) {
  // Common locations to look for projects
  const searchPaths = [
    path.join(os.homedir(), 'projects', projectName),
    path.join(os.homedir(), 'code', projectName),
    path.join(os.homedir(), 'repos', projectName),
    path.join(os.homedir(), 'work', projectName),
    path.join(process.cwd(), '..', projectName), // sibling to current project
  ];

  // Also check workspace roots mentioned in git config
  try {
    const gitConfigPath = path.join(os.homedir(), '.gitconfig');
    const gitConfig = await fs.readFile(gitConfigPath, 'utf-8').catch(() => '');
    
    // Look for project-specific paths in git config
    const projectPathMatches = gitConfig.matchAll(/\[.*\]\s*\n\s*directory\s*=\s*(.+)/gi);
    for (const match of projectPathMatches) {
      const dir = match[1].trim();
      searchPaths.push(dir);
    }
  } catch {
    // Ignore gitconfig errors
  }

  for (const searchPath of searchPaths) {
    try {
      const stat = await fs.stat(searchPath);
      if (stat.isDirectory()) {
        // Check if this looks like an opencode project
        const opencodeDir = path.join(searchPath, '.opencode');
        try {
          await fs.stat(opencodeDir);
          return searchPath;
        } catch {
          // Not an opencode project, continue searching
        }
      }
    } catch {
      // Path doesn't exist, continue
    }
  }

  return null;
}

/**
 * Search for a session file in a project directory
 * @param {string} projectDir - Project directory path
 * @param {string} sessionPath - Session path to find
 * @returns {Promise<string|null>} Full path to session file or null
 */
async function findSessionFile(projectDir, sessionPath) {
  const contextSessionDir = path.join(projectDir, '.opencode', 'context-session');
  
  try {
    // Check if it's a direct path
    const directPath = path.join(projectDir, sessionPath);
    try {
      const stat = await fs.stat(directPath);
      if (stat.isFile()) {
        return directPath;
      }
    } catch {
      // Not a direct file
    }

    // Check in context-session directory
    const fullPath = path.join(contextSessionDir, sessionPath);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        return fullPath;
      }
    } catch {
      // Not found at that path either
    }

    // Try to find by partial match (session ID)
    // Search recursively for files matching the session identifier
    const searchTerms = sessionPath.toLowerCase().split(/[\/\-_]/);
    
    async function searchDir(dir, depth = 0) {
      if (depth > 5) return null; // Limit recursion
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullEntryPath = path.join(dir, entry.name);
          
          // Check if filename contains search terms
          const lowerName = entry.name.toLowerCase();
          if (searchTerms.every(term => lowerName.includes(term))) {
            if (entry.isFile() && (entry.name.endsWith('.md'))) {
              return fullEntryPath;
            }
          }
          
          if (entry.isDirectory()) {
            const found = await searchDir(fullEntryPath, depth + 1);
            if (found) return found;
          }
        }
      } catch {
        // Continue searching
      }
      
      return null;
    }

    return await searchDir(contextSessionDir);
  } catch {
    return null;
  }
}

/**
 * Resolve a cross-project link to actual session content or path
 * @param {string} link - Cross-project link (e.g., "my-plugin:2026/04/session-end")
 * @param {string} currentProjectDir - Current project directory (for relative resolution)
 * @returns {Promise<Object>} { projectPath, sessionPath, exists, content, preview }
 */
export async function resolveCrossProjectLink(link, currentProjectDir = null) {
  const parsed = parseCrossProjectLink(link);
  
  if (!parsed.isValid) {
    return { projectPath: null, sessionPath: null, exists: false, content: null, preview: null };
  }

  const { projectName, sessionPath } = parsed;

  // First, try to find project in global intelligence
  const globalIntel = await readGlobalIntelligence();
  let projectDir = null;

  // Check if global intelligence knows about this project
  if (globalIntel.projects[projectName]?.path) {
    projectDir = globalIntel.projects[projectName].path;
  } else {
    // Try to discover project path
    projectDir = await discoverProjectPath(projectName);
  }

  if (!projectDir) {
    logger(`[resolve] Could not find project: ${projectName}`);
    return {
      projectPath: null,
      sessionPath: null,
      exists: false,
      content: null,
      preview: `Project "${projectName}" not found`
    };
  }

  // Find the session file
  const sessionFilePath = await findSessionFile(projectDir, sessionPath);
  
  if (!sessionFilePath) {
    logger(`[resolve] Could not find session: ${sessionPath} in project ${projectName}`);
    return {
      projectPath: projectDir,
      sessionPath: null,
      exists: false,
      content: null,
      preview: `Session "${sessionPath}" not found in ${projectName}`
    };
  }

  // Read session content for preview
  try {
    const content = await fs.readFile(sessionFilePath, 'utf-8');
    const preview = extractSessionPreview(content);
    
    return {
      projectPath: projectDir,
      sessionPath: sessionFilePath,
      exists: true,
      content,
      preview
    };
  } catch (error) {
    logger(`[resolve] Could not read session file: ${error.message}`);
    return {
      projectPath: projectDir,
      sessionPath: sessionFilePath,
      exists: true,
      content: null,
      preview: `Could not read session content`
    };
  }
}

/**
 * Extract a preview from session content
 * @param {string} content - Raw session content
 * @returns {string} Preview string (first ~150 chars)
 */
function extractSessionPreview(content) {
  if (!content) return '';

  // Try to extract goal or first substantial line
  const goalMatch = content.match(/^##\s*Goal:\s*([^\n]+)/m);
  if (goalMatch) {
    return goalMatch[1].slice(0, 150);
  }

  // Fall back to first line
  const firstLine = content.split('\n').find(l => l.trim().length > 10);
  return firstLine?.slice(0, 150) || '';
}

/**
 * Find related sessions across projects based on keywords, goals, or bugs
 * @param {Object} currentSession - Current session object with content, goal, etc.
 * @param {Object} options - Search options
 * @param {string} options.keyword - Keyword to search for
 * @param {string} options.goal - Goal to match
 * @param {string} options.bug - Bug symptom to search
 * @param {number} options.maxResults - Maximum number of results (default: 3)
 * @returns {Promise<Array>} Array of { project, session, relevance, reason }
 */
export async function findRelatedSessions(currentSession, options = {}) {
  const {
    keyword = '',
    goal = '',
    bug = '',
    maxResults = 3
  } = options;

  const searchTerms = [keyword, goal, bug].filter(Boolean);
  if (searchTerms.length === 0) {
    return [];
  }

  // Read global intelligence to discover all known projects
  const globalIntel = await readGlobalIntelligence();
  const projects = Object.keys(globalIntel.projects);

  const relatedSessions = [];

  // Search each known project
  for (const projectName of projects) {
    try {
      const projectDir = globalIntel.projects[projectName]?.path || 
                         await discoverProjectPath(projectName);
      
      if (!projectDir) continue;

      // Search for matching sessions
      const matches = await searchProjectSessions(projectDir, searchTerms);
      
      for (const match of matches) {
        // Calculate relevance score
        const relevance = calculateRelevance(match, searchTerms);
        
        relatedSessions.push({
          project: projectName,
          session: match.path,
          relevance,
          reason: match.reason,
          preview: match.preview
        });
      }
    } catch (error) {
      logger(`[findRelated] Error searching project ${projectName}: ${error.message}`);
    }
  }

  // Sort by relevance and limit results
  return relatedSessions
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxResults);
}

/**
 * Search a project directory for matching sessions
 * @param {string} projectDir - Project directory path
 * @param {Array<string>} searchTerms - Terms to search for
 * @returns {Promise<Array>} Matching sessions with relevance info
 */
async function searchProjectSessions(projectDir, searchTerms) {
  const matches = [];
  const contextSessionDir = path.join(projectDir, '.opencode', 'context-session');

  async function searchDir(dir, depth = 0) {
    if (depth > 4) return; // Limit recursion

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = path.join(dir, entry.name);
          
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const matchResult = matchSessionContent(content, searchTerms);
            
            if (matchResult.score > 0) {
              matches.push({
                path: filePath,
                score: matchResult.score,
                reason: matchResult.reason,
                preview: extractSessionPreview(content)
              });
            }
          } catch {
            // Skip unreadable files
          }
        } else if (entry.isDirectory()) {
          await searchDir(path.join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Continue searching other directories
    }
  }

  await searchDir(contextSessionDir);
  return matches;
}

/**
 * Calculate relevance score between session and search terms
 * @param {Object} session - Session match result
 * @param {Array<string>} searchTerms - Search terms
 * @returns {number} Relevance score 0-1
 */
function calculateRelevance(session, searchTerms) {
  let score = 0;
  const contentLower = (session.preview || '').toLowerCase();
  const pathLower = (session.path || '').toLowerCase();

  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    
    // Check preview content
    if (contentLower.includes(termLower)) {
      score += 0.4;
    }
    
    // Check path/filename
    if (pathLower.includes(termLower)) {
      score += 0.2;
    }
  }

  // Normalize by number of terms
  return Math.min(score / searchTerms.length, 1);
}

/**
 * Match session content against search terms
 * @param {string} content - Session content
 * @param {Array<string>} searchTerms - Terms to search for
 * @returns {Object} { score, reason }
 */
function matchSessionContent(content, searchTerms) {
  let score = 0;
  const reasons = [];

  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    
    // Check for keyword matches
    if (content.toLowerCase().includes(termLower)) {
      // Higher score for matches in goal/accomplished sections
      if (content.match(new RegExp(`##\\s+(Goal|Accomplished|Discoveries|Bug)[:\\s]*.*${termLower}`, 'i'))) {
        score += 0.8;
        reasons.push(`Found "${term}" in structured section`);
      } else {
        score += 0.4;
        reasons.push(`Found "${term}" in content`);
      }
    }
  }

  return {
    score,
    reason: reasons[0] || ''
  };
}

/**
 * Resolve links in content (e.g., in reports)
 * Replaces [[project:session-id]] with resolved preview
 * @param {string} content - Content containing cross-project links
 * @param {string} currentProjectDir - Current project directory
 * @returns {Promise<string>} Content with resolved links
 */
export async function resolveLinksInContent(content, currentProjectDir = null) {
  if (!content) return content;

  // Find all [[project:session-id]] patterns
  const linkPattern = /\[\[([^\]:]+):([^\]]+)\]\]/g;
  
  let resolvedContent = content;
  const matches = content.matchAll(linkPattern);
  
  for (const match of matches) {
    const link = match[0];
    const result = await resolveCrossProjectLink(link, currentProjectDir);
    
    if (result.exists) {
      // Replace with preview format
      const preview = result.preview ? ` (${result.preview.slice(0, 80)})` : '';
      resolvedContent = resolvedContent.replace(
        link,
        `[[${match[1]}:${match[2]}]]${preview}`
      );
    } else {
      // Mark as unresolved
      resolvedContent = resolvedContent.replace(
        link,
        `[[${match[1]}:${match[2]}]] (unresolved)`
      );
    }
  }

  return resolvedContent;
}