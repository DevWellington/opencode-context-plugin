#!/usr/bin/env node
/**
 * Force regeneration of all summary files
 * 
 * Usage: node scripts/regenerate-summaries.js [--directory <path>]
 * 
 * Options:
 *   --directory <path>  Target directory (default: process.cwd())
 * 
 * This script:
 * 1. Finds and deletes all existing summary files
 * 2. Regenerates them in hierarchical order (today → weekly → monthly → annual → intelligence)
 * 3. Ensures bug fixes from Phase 22 are applied to existing content
 */

import fs from 'fs/promises';
import path from 'path';
import { generateTodaySummary } from '../src/agents/generateToday.js';
import { generateWeeklySummary } from '../src/agents/generateWeekly.js';
import { generateMonthlySummary } from '../src/agents/generateMonthly.js';
import { generateAnnualSummary } from '../src/agents/generateAnnual.js';
import { updateIntelligenceLearning } from '../src/agents/generateIntelligenceLearning.js';
import { CONTEXT_SESSION_DIR } from '../src/agents/utils/linkBuilder.js';

/**
 * Find all summary files in the context-session directory
 */
async function findSummaryFiles(baseDir) {
  const sessionDir = path.join(baseDir, CONTEXT_SESSION_DIR);
  const files = [];
  
  try {
    // Root-level summary files
    const rootFiles = ['daily-summary.md', 'intelligence-learning.md'];
    for (const file of rootFiles) {
      const filePath = path.join(sessionDir, file);
      try {
        await fs.access(filePath);
        files.push(filePath);
      } catch {
        // File doesn't exist
      }
    }
    
    // Scan year directories
    const yearEntries = await fs.readdir(sessionDir, { withFileTypes: true });
    for (const yearEntry of yearEntries) {
      if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;
      
      const yearPath = path.join(sessionDir, yearEntry.name);
      
      // Annual summary
      const annualFile = path.join(yearPath, `annual-${yearEntry.name}.md`);
      try {
        await fs.access(annualFile);
        files.push(annualFile);
      } catch {
        // File doesn't exist
      }
      
      // Scan month directories
      const monthEntries = await fs.readdir(yearPath, { withFileTypes: true });
      for (const monthEntry of monthEntries) {
        if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) continue;
        
        const monthPath = path.join(yearPath, monthEntry.name);
        
        // Monthly summary
        const monthlyFile = path.join(monthPath, `monthly-${yearEntry.name}-${monthEntry.name}.md`);
        try {
          await fs.access(monthlyFile);
          files.push(monthlyFile);
        } catch {
          // File doesn't exist
        }
        
        // Scan week directories
        const weekEntries = await fs.readdir(monthPath, { withFileTypes: true });
        for (const weekEntry of weekEntries) {
          if (!weekEntry.isDirectory() || !/^W\d{2}$/.test(weekEntry.name)) continue;
          
          const weekPath = path.join(monthPath, weekEntry.name);
          
          // Week summary
          const weekFile = path.join(weekPath, 'week-summary.md');
          try {
            await fs.access(weekFile);
            files.push(weekFile);
          } catch {
            // File doesn't exist
          }
          
          // Scan day directories
          const dayEntries = await fs.readdir(weekPath, { withFileTypes: true });
          for (const dayEntry of dayEntries) {
            if (!dayEntry.isDirectory() || !/^\d{2}$/.test(dayEntry.name)) continue;
            
            // Day summary
            const dayFile = path.join(weekPath, dayEntry.name, 'day-summary.md');
            try {
              await fs.access(dayFile);
              files.push(dayFile);
            } catch {
              // File doesn't exist
            }
          }
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or other error
    if (error.code !== 'ENOENT') {
      console.error(`[regenerate] Warning: ${error.message}`);
    }
  }
  
  return files;
}

/**
 * Delete all existing summary files
 */
async function deleteSummaryFiles(baseDir) {
  const files = await findSummaryFiles(baseDir);
  
  for (const file of files) {
    try {
      await fs.unlink(file);
      console.log(`[regenerate] Deleted: ${path.relative(baseDir, file)}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`[regenerate] Failed to delete ${file}: ${error.message}`);
      }
    }
  }
  
  return files.length;
}

/**
 * Find session directories to regenerate from
 */
async function findSessionDirectories(baseDir) {
  const sessionDir = path.join(baseDir, CONTEXT_SESSION_DIR);
  const sessions = [];
  
  try {
    const yearEntries = await fs.readdir(sessionDir, { withFileTypes: true });
    
    for (const yearEntry of yearEntries) {
      if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;
      
      const yearPath = path.join(sessionDir, yearEntry.name);
      const monthEntries = await fs.readdir(yearPath, { withFileTypes: true });
      
      for (const monthEntry of monthEntries) {
        if (!monthEntry.isDirectory() || !/^\d{2}$/.test(monthEntry.name)) continue;
        
        const monthPath = path.join(yearPath, monthEntry.name);
        const weekEntries = await fs.readdir(monthPath, { withFileTypes: true });
        
        for (const weekEntry of weekEntries) {
          if (!weekEntry.isDirectory() || !/^W\d{2}$/.test(weekEntry.name)) continue;
          
          const weekPath = path.join(monthPath, weekEntry.name);
          const dayEntries = await fs.readdir(weekPath, { withFileTypes: true });
          
          for (const dayEntry of dayEntries) {
            if (!dayEntry.isDirectory() || !/^\d{2}$/.test(dayEntry.name)) continue;
            
            const dayPath = path.join(weekPath, dayEntry.name);
            const dayFiles = await fs.readdir(dayPath);
            const sessionFiles = dayFiles.filter(f =>
              f.endsWith('.md') && (f.startsWith('compact-') || f.startsWith('exit-'))
            );
            
            if (sessionFiles.length > 0) {
              sessions.push({
                dirPath: dayPath,
                year: yearEntry.name,
                month: monthEntry.name,
                week: weekEntry.name,
                day: dayEntry.name,
                sessionFiles
              });
            }
          }
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`[regenerate] Error finding sessions: ${error.message}`);
    }
  }
  
  return sessions;
}

async function main() {
  // Parse --directory argument
  const directory = process.argv.includes('--directory')
    ? process.argv[process.argv.indexOf('--directory') + 1]
    : process.cwd();
  
  console.log(`[regenerate] Starting full regeneration in: ${directory}`);
  
  // Step 1: Delete existing summary files
  const deletedCount = await deleteSummaryFiles(directory);
  console.log(`[regenerate] Deleted ${deletedCount} existing summary files`);
  
  // Find session directories
  const sessions = await findSessionDirectories(directory);
  console.log(`[regenerate] Found ${sessions.length} days with sessions\n`);
  
  if (sessions.length === 0) {
    console.log('[regenerate] No sessions found - nothing to regenerate');
    console.log('[regenerate] Complete!');
    process.exit(0);
  }
  
  const now = new Date();
  const year = now.getFullYear();
  const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Import updateDaySummary for day summaries
  const { updateDaySummary } = await import('../src/modules/summaries.js');
  
  // Step 2: Generate day-summary.md for each day (base for hierarchy)
  console.log('[regenerate] [1/5] Generating day summaries...');
  for (const session of sessions) {
    try {
      await updateDaySummary(session.dirPath, {
        type: 'compact',
        filename: session.sessionFiles[0],
        year: session.year,
        month: session.month,
        day: session.day,
        week: session.week
      });
      console.log(`  ✓ ${session.year}/${session.month}/${session.week}/${session.day}/day-summary.md`);
    } catch (error) {
      console.error(`  ✗ Failed: ${session.dirPath} - ${error.message}`);
    }
  }
  
  // Step 3: Generate daily-summary.md (root)
  console.log('\n[regenerate] [2/5] Generating today summary...');
  try {
    await generateTodaySummary(directory);
    console.log('  ✓ daily-summary.md');
  } catch (error) {
    console.error('  ✗ daily-summary.md failed:', error.message);
  }
  
  // Step 4: Generate week summaries
  console.log('\n[regenerate] [3/5] Generating weekly summaries...');
  const uniqueWeeks = [...new Set(sessions.map(s => `${s.year}-${s.month}-${s.week}`))];
  for (const weekKey of uniqueWeeks) {
    const [yearStr, monthStr, weekStr] = weekKey.split('-');
    try {
      const sampleSession = sessions.find(s => s.year === yearStr && s.month === monthStr && s.week === weekStr);
      const sampleDate = `${yearStr}-${monthStr}-${sampleSession.day}`;
      await generateWeeklySummary(directory, sampleDate);
      console.log(`  ✓ ${yearStr}/${monthStr}/${weekStr}/week-summary.md`);
    } catch (error) {
      console.error(`  ✗ ${weekKey} failed:`, error.message);
    }
  }
  
  // Step 5: Generate monthly summaries
  console.log('\n[regenerate] [4/5] Generating monthly summaries...');
  const uniqueMonths = [...new Set(sessions.map(s => `${s.year}-${s.month}`))];
  for (const monthKey of uniqueMonths) {
    try {
      await generateMonthlySummary(directory, monthKey);
      console.log(`  ✓ monthly-${monthKey}.md`);
    } catch (error) {
      console.error(`  ✗ monthly-${monthKey} failed:`, error.message);
    }
  }
  
  // Step 6: Generate annual summaries
  console.log('\n[regenerate] [5/5] Generating annual summaries...');
  const uniqueYears = [...new Set(sessions.map(s => s.year))];
  for (const yearStr of uniqueYears) {
    try {
      await generateAnnualSummary(directory, parseInt(yearStr));
      console.log(`  ✓ annual-${yearStr}.md`);
    } catch (error) {
      console.error(`  ✗ annual-${yearStr} failed:`, error.message);
    }
  }
  
  // Step 7: Generate intelligence-learning.md
  console.log('\n[regenerate] Updating intelligence learning...');
  try {
    const result = await updateIntelligenceLearning(directory);
    if (result.skipped) {
      console.log(`  ✓ intelligence-learning.md (skipped: ${result.reason})`);
    } else {
      console.log(`  ✓ intelligence-learning.md (${result.newSessions || 0} new sessions)`);
    }
  } catch (error) {
    console.error('  ✗ intelligence-learning.md failed:', error.message);
  }
  
  console.log('\n[regenerate] Complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('[regenerate] Failed:', err.message);
  process.exit(1);
});