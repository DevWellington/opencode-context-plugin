import fs from "fs/promises";
import path from "path";
import { getConfig } from '../config.js';
import { createDebugLogger } from '../utils/debug.js';
import { debounce } from '../utils/debounce.js';
import { atomicWrite, getTimestamp } from '../utils/fileUtils.js';

const logger = createDebugLogger('context-plugin');

// Constants
const CONTEXT_SESSION_DIR = '.opencode/context-session';

// In-memory lock for daily summary updates to prevent race conditions
let dailySummaryLock = Promise.resolve();

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
 */
async function updateDaySummary(dirPath, sessionInfo) {
  try {
    const summaryPath = path.join(dirPath, 'day-summary.md');
    
    // Read existing summary or create new
    let content = '';
    try {
      content = await fs.readFile(summaryPath, 'utf-8');
    } catch (e) {
      // File doesn't exist yet
      content = `# Day Summary\n\n`;
      content += `**Date:** ${sessionInfo.year}-${sessionInfo.month}-${sessionInfo.day}\n\n`;
      content += `## Sessions\n\n`;
    }
    
    // Append new session info
    const timestamp = new Date().toISOString();
    const type = sessionInfo.type === 'compact' ? '📦 Compact' : '🚪 Exit';
    const entry = `- [${timestamp}] ${type}: ${sessionInfo.filename}\n`;
    
    // Check if already recorded (idempotency)
    if (!content.includes(sessionInfo.filename)) {
      content += entry;
      await atomicWrite(summaryPath, content);
      logger(`[context-plugin] Updated day summary: ${summaryPath}`);
    }
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
