import fs from "fs/promises";
import path from "path";
import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { debounce } from '../utils/debounce.js';
import { atomicWrite, getTimestamp } from '../utils/fileUtils.js';
import { extractSessionContent, extractBugs } from './contentExtractor.js';

const logger = createDebugLogger('context-plugin');

// Constants
const CONTEXT_SESSION_DIR = '.opencode/context-session';

// In-memory lock for daily summary updates to prevent race conditions
let dailySummaryLock = Promise.resolve();

/**
 * Read all session files from a day directory
 * @param {string} dirPath - Path to day directory
 * @returns {Array} Array of { filename, content, extracted, bugs }
 */
async function readDaySessions(dirPath) {
  const sessions = [];
  
  try {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      // Skip summary files and non-session files
      if (file.endsWith('-summary.md') || (!file.startsWith('exit-') && !file.startsWith('compact-'))) {
        continue;
      }
      
      if (file.endsWith('.md')) {
        try {
          const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
          const extracted = extractSessionContent(content);
          const bugs = extractBugs(content);
          sessions.push({ filename: file, content, extracted, bugs });
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  
  return sessions;
}

/**
 * Format day content with structured sections
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {Array} sessionsData - Array from readDaySessions
 * @returns {string} Formatted day summary content
 */
function formatDayContent(dateStr, sessionsData) {
  // Collect goals, accomplishments, discoveries, bugs, files
  const goals = [];
  const accomplishments = [];
  const discoveries = [];
  const bugs = [];
  const relevantFiles = new Set();
  
  for (const session of sessionsData) {
    if (session.extracted.goal && session.extracted.goal.length > 5) {
      goals.push({ text: session.extracted.goal, source: session.filename });
    }
    if (session.extracted.accomplished && session.extracted.accomplished.length > 5) {
      accomplishments.push({ text: session.extracted.accomplished, source: session.filename });
    }
    if (session.extracted.discoveries && session.extracted.discoveries.length > 5) {
      discoveries.push({ text: session.extracted.discoveries, source: session.filename });
    }
    for (const bug of session.bugs) {
      if (bug.solution) {
        bugs.push({ ...bug, source: session.filename });
      }
    }
    for (const file of session.extracted.relevantFiles || []) {
      if (file) relevantFiles.add(file);
    }
  }
  
  // Deduplicate by first 50 chars
  const seenGoals = new Set();
  const uniqueGoals = goals.filter(g => {
    const key = g.text.slice(0, 50).toLowerCase().trim();
    if (seenGoals.has(key) || key.length < 5) return false;
    seenGoals.add(key);
    return true;
  });
  
  const seenAccomplishments = new Set();
  const uniqueAccomplishments = accomplishments.filter(a => {
    const key = a.text.slice(0, 50).toLowerCase().trim();
    if (seenAccomplishments.has(key) || key.length < 5) return false;
    seenAccomplishments.add(key);
    return true;
  });
  
  const seenDiscoveries = new Set();
  const uniqueDiscoveries = discoveries.filter(d => {
    const key = d.text.slice(0, 50).toLowerCase().trim();
    if (seenDiscoveries.has(key) || key.length < 5) return false;
    seenDiscoveries.add(key);
    return true;
  });
  
  // Build content
  let content = `# Day Summary\n\n`;
  content += `**Date:** ${dateStr}\n\n`;
  
  // Sessions overview
  const compactCount = sessionsData.filter(s => s.filename.startsWith('compact-')).length;
  const exitCount = sessionsData.filter(s => s.filename.startsWith('exit-')).length;
  content += `**Sessions:** ${sessionsData.length} (Compacts: ${compactCount}, Exits: ${exitCount})\n\n`;
  
  // Goals section
  if (uniqueGoals.length > 0) {
    content += `## Goals\n\n`;
    for (const goal of uniqueGoals) {
      content += `- ${goal.text}\n`;
    }
    content += '\n';
  }
  
  // Accomplishments section
  if (uniqueAccomplishments.length > 0) {
    content += `## Accomplishments\n\n`;
    for (const acc of uniqueAccomplishments) {
      // Handle multiline content
      const lines = acc.text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        content += `- ✅ ${line}\n`;
      }
    }
    content += '\n';
  }
  
  // Discoveries section
  if (uniqueDiscoveries.length > 0) {
    content += `## Discoveries\n\n`;
    for (const disc of uniqueDiscoveries) {
      content += `- 💡 ${disc.text}\n`;
    }
    content += '\n';
  }
  
  // Bugs Fixed section
  if (bugs.length > 0) {
    content += `## Bugs Fixed\n\n`;
    for (const bug of bugs) {
      content += `- **${bug.symptom}:** ${bug.solution}\n`;
      if (bug.cause) {
        content += `  - Cause: ${bug.cause}\n`;
      }
    }
    content += '\n';
  }
  
  // Relevant Files section
  if (relevantFiles.size > 0) {
    content += `## Relevant Files\n\n`;
    for (const file of relevantFiles) {
      content += `- ${file}\n`;
    }
    content += '\n';
  }
  
  return content;
}

/**
 * Update daily summary at context-session root
 * This file is debounced to prevent excessive I/O on rapid saves
 */
async function updateDailySummaryImpl(baseDir, sessionInfo) {
  try {
    const summaryPath = path.join(baseDir, CONTEXT_SESSION_DIR, 'daily-summary.md');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Use lock to serialize writes and prevent race conditions
    // Chain the promise BEFORE doing any work
    const currentLock = dailySummaryLock;
    
    dailySummaryLock = (async () => {
      // Wait for previous operation to complete
      await currentLock.catch(() => {});
      
      // Read existing summary or create new
      let existingEntries = [];
      let currentHeader = null;
      
      try {
        const content = await fs.readFile(summaryPath, 'utf-8');
        
        // Parse existing content to extract entries and current date header
        const lines = content.split('\n');
        const entriesStart = lines.findIndex(line => line.startsWith('- ['));
        
        if (entriesStart !== -1) {
          // Extract existing entries
          for (let i = entriesStart; i < lines.length; i++) {
            if (lines[i].startsWith('- [')) {
              existingEntries.push(lines[i]);
            }
          }
          
          // Check current date header
          const dateHeaderIdx = lines.findIndex(line => line.startsWith('## '));
          if (dateHeaderIdx !== -1) {
            currentHeader = lines[dateHeaderIdx].replace('## ', '').trim();
          }
        }
      } catch (e) {
        // File doesn't exist yet
      }
      
      // Check if we need to update the date header (new day)
      if (currentHeader !== today) {
        // New day - reset content with new date header
        existingEntries = [];
      }
      
      // Format new entry
      const typeEmoji = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
      const newEntry = `- [${sessionInfo.timestamp}] ${typeEmoji}: ${sessionInfo.filename}`;
      
      // Check if filename already exists (idempotency)
      const alreadyExists = existingEntries.some(entry => entry.includes(sessionInfo.filename));
      
      if (!alreadyExists) {
        existingEntries.push(newEntry);
        
        // Calculate statistics
        const totalSessions = existingEntries.length;
        const compactCount = existingEntries.filter(e => e.includes('📦')).length;
        const exitCount = existingEntries.filter(e => e.includes('🚪')).length;
        
        // Build final content from scratch
        let finalContent = `# Daily Summary\n\n`;
        finalContent += `## ${today}\n\n`;
        finalContent += `**Total Sessions:** ${totalSessions}\n`;
        finalContent += `**Compacts:** ${compactCount} | **Exits:** ${exitCount}\n\n`;
        finalContent += existingEntries.join('\n') + '\n';
        
        await atomicWrite(summaryPath, finalContent);
        logger(`[context-plugin] Updated daily summary: ${summaryPath}`);
      }
    })();
    
    // Wait for our turn to complete
    await dailySummaryLock;
    
  } catch (error) {
    logger(`[context-plugin] Error updating daily summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

/**
 * Update day summary in hierarchical folder
 * Now uses contentExtractor to extract Goals, Accomplishments, Discoveries, Bugs, Relevant Files
 */
async function updateDaySummary(dirPath, sessionInfo) {
  try {
    // Read all session files from this day directory to build comprehensive summary
    const sessionsData = await readDaySessions(dirPath);
    
    // Format date string
    const dateStr = `${sessionInfo.year}-${sessionInfo.month}-${sessionInfo.day}`;
    
    // Generate comprehensive day summary with extracted content
    const content = formatDayContent(dateStr, sessionsData);
    
    const summaryPath = path.join(dirPath, 'day-summary.md');
    await atomicWrite(summaryPath, content);
    logger(`[context-plugin] Updated day summary with content extraction: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating day summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

/**
 * Update week summary aggregating all days in the week
 */
async function updateWeekSummaryImpl(baseDir, year, month, week) {
  try {
    const weekDir = path.join(baseDir, CONTEXT_SESSION_DIR, String(year), month, week);
    const summaryPath = path.join(weekDir, 'week-summary.md');
    
    // Read day directories
    let dayDirs = [];
    try {
      const entries = await fs.readdir(weekDir, { withFileTypes: true });
      dayDirs = entries
        .filter(d => d.isDirectory() && /^\d{2}$/.test(d.name))
        .map(d => d.name)
        .sort();
    } catch (e) {
      logger(`[context-plugin] Error reading week directory: ${e.message}`);
      return;
    }
    
    // Generate week summary from day folders
    let content = `# Week ${week} Summary\n\n`;
    content += `**Period:** ${year}-${month}\n`;
    content += `**Week:** ${week}\n\n`;
    content += `## Days\n\n`;
    
    for (const dayDir of dayDirs) {
      const dayPath = path.join(weekDir, dayDir);
      let files = [];
      try {
        files = await fs.readdir(dayPath);
      } catch (e) {
        continue;
      }
      
      const compacts = files.filter(f => f.startsWith('compact-')).length;
      const exits = files.filter(f => f.startsWith('exit-')).length;
      const summaries = files.filter(f => f.endsWith('-summary.md')).length;
      
      content += `### Day ${dayDir}\n\n`;
      content += `- 📦 Compact files: ${compacts}\n`;
      content += `- 🚪 Exit files: ${exits}\n`;
      content += `- 📄 Summary files: ${summaries}\n\n`;
    }
    
    content += `## Summary\n\n`;
    content += `Total days with sessions: ${dayDirs.length}\n`;
    
    await atomicWrite(summaryPath, content);
    logger(`[context-plugin] Updated week summary: ${summaryPath}`);
  } catch (error) {
    logger(`[context-plugin] Error updating week summary: ${error.message}`);
    // Don't fail session save if summary update fails
  }
}

// Create debounced versions using config's debounceMs
const config = getConfig();
const debounceMs = config.debounceMs || 500;

export const updateDailySummary = debounce(updateDailySummaryImpl, debounceMs);
export const updateWeekSummary = debounce(updateWeekSummaryImpl, debounceMs);
export { updateDaySummary };
