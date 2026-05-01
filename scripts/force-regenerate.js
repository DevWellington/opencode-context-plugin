#!/usr/bin/env node
/**
 * Force regeneration of all context summary files
 * Deletes old summaries and regenerates from session files
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { updateDaySummary } from '../src/modules/summaries.js';
import { generateTodaySummary } from '../src/agents/generateToday.js';
import { generateWeeklySummary } from '../src/agents/generateWeekly.js';
import { generateMonthlySummary } from '../src/agents/generateMonthly.js';
import { generateAnnualSummary } from '../src/agents/generateAnnual.js';
import { updateIntelligenceLearning } from '../src/agents/generateIntelligenceLearning.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const CONTEXT_DIR = path.join(PROJECT_ROOT, '.opencode', 'context-session');

async function findSessionDirectories() {
  const sessions = [];
  
  try {
    const yearDirs = await fs.readdir(CONTEXT_DIR, { withFileTypes: true });
    for (const yearDir of yearDirs) {
      if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) continue;
      
      const yearPath = path.join(CONTEXT_DIR, yearDir.name);
      const monthDirs = await fs.readdir(yearPath, { withFileTypes: true });
      
      for (const monthDir of monthDirs) {
        if (!monthDir.isDirectory() || !/^\d{2}$/.test(monthDir.name)) continue;
        
        const monthPath = path.join(yearPath, monthDir.name);
        const weekDirs = await fs.readdir(monthPath, { withFileTypes: true });
        
        for (const weekDir of weekDirs) {
          if (!weekDir.isDirectory() || !/^W\d{2}$/.test(weekDir.name)) continue;
          
          const weekPath = path.join(monthPath, weekDir.name);
          const dayDirs = await fs.readdir(weekPath, { withFileTypes: true });
          
          for (const dayDir of dayDirs) {
            if (!dayDir.isDirectory() || !/^\d{2}$/.test(dayDir.name)) continue;
            
            const dayPath = path.join(weekPath, dayDir.name);
            const files = await fs.readdir(dayPath);
            const sessionFiles = files.filter(f => 
              f.endsWith('.md') && (f.startsWith('compact-') || f.startsWith('exit-'))
            );
            
            if (sessionFiles.length > 0) {
              sessions.push({
                dirPath: dayPath,
                year: yearDir.name,
                month: monthDir.name,
                week: weekDir.name,
                day: dayDir.name,
                sessionFiles
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error finding sessions:', error.message);
  }
  
  return sessions;
}

async function deleteAllSummaries() {
  const summaryFiles = [
    path.join(CONTEXT_DIR, 'daily-summary.md'),
    path.join(CONTEXT_DIR, 'intelligence-learning.md'),
  ];
  
  // Find and delete all week/monthly/annual summaries
  try {
    const yearDirs = await fs.readdir(CONTEXT_DIR, { withFileTypes: true });
    for (const yearDir of yearDirs) {
      if (!yearDir.isDirectory() || !/^\d{4}$/.test(yearDir.name)) continue;
      const yearPath = path.join(CONTEXT_DIR, yearDir.name);
      
      // Annual summary
      summaryFiles.push(path.join(yearPath, `annual-${yearDir.name}.md`));
      
      const monthDirs = await fs.readdir(yearPath, { withFileTypes: true });
      for (const monthDir of monthDirs) {
        if (!monthDir.isDirectory() || !/^\d{2}$/.test(monthDir.name)) continue;
        const monthPath = path.join(yearPath, monthDir.name);
        
        // Monthly summary
        summaryFiles.push(path.join(monthPath, `monthly-${yearDir.name}-${monthDir.name}.md`));
        
        const weekDirs = await fs.readdir(monthPath, { withFileTypes: true });
        for (const weekDir of weekDirs) {
          if (!weekDir.isDirectory() || !/^W\d{2}$/.test(weekDir.name)) continue;
          const weekPath = path.join(monthPath, weekDir.name);
          
          // Week summary
          summaryFiles.push(path.join(weekPath, 'week-summary.md'));
          
          const dayDirs = await fs.readdir(weekPath, { withFileTypes: true });
          for (const dayDir of dayDirs) {
            if (!dayDir.isDirectory() || !/^\d{2}$/.test(dayDir.name)) continue;
            // Day summary
            summaryFiles.push(path.join(weekPath, dayDir.name, 'day-summary.md'));
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  for (const file of summaryFiles) {
    try {
      await fs.unlink(file);
    } catch {
      // File doesn't exist, ignore
    }
  }
  
  console.log('Deleted old summary files\n');
}

async function regenerateAll() {
  console.log('=== Force Regeneration of All Context Summaries ===\n');
  
  // Step 0: Delete all old summaries
  await deleteAllSummaries();
  
  // Find all session directories
  const sessions = await findSessionDirectories();
  console.log(`Found ${sessions.length} days with sessions\n`);
  
  // Step 1: Generate day-summary.md for each day
  console.log('Step 1: Generating day summaries...');
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
      console.log(`  ✓ day-summary.md: ${session.year}/${session.month}/${session.week}/${session.day}`);
    } catch (error) {
      console.error(`  ✗ day-summary.md failed: ${session.dirPath}`, error.message);
    }
  }
  
  // Step 2: Generate daily-summary.md (root)
  console.log('\nStep 2: Generating daily summary (root)...');
  try {
    await generateTodaySummary(PROJECT_ROOT);
    console.log('  ✓ daily-summary.md');
  } catch (error) {
    console.error('  ✗ daily-summary.md failed:', error.message);
  }
  
  // Step 3: Generate week summaries
  console.log('\nStep 3: Generating week summaries...');
  const uniqueWeeks = [...new Set(sessions.map(s => `${s.year}-${s.month}-${s.week}`))];
  for (const weekKey of uniqueWeeks) {
    const [year, month, week] = weekKey.split('-');
    try {
      // Find a sample date for this week to pass to the generator
      const sampleSession = sessions.find(s => s.year === year && s.month === month && s.week === week);
      const sampleDate = `${year}-${month}-${sampleSession.day}`;
      await generateWeeklySummary(PROJECT_ROOT, sampleDate);
      console.log(`  ✓ week-summary.md: ${year}/${month}/${week}`);
    } catch (error) {
      console.error(`  ✗ week-summary.md failed: ${year}/${month}/${week}`, error.message);
    }
  }
  
  // Step 4: Generate monthly summaries
  console.log('\nStep 4: Generating monthly summaries...');
  const uniqueMonths = [...new Set(sessions.map(s => `${s.year}-${s.month}`))];
  for (const monthKey of uniqueMonths) {
    try {
      await generateMonthlySummary(PROJECT_ROOT, monthKey);
      console.log(`  ✓ monthly: ${monthKey}`);
    } catch (error) {
      console.error(`  ✗ monthly failed: ${monthKey}`, error.message);
    }
  }
  
  // Step 5: Generate annual summaries
  console.log('\nStep 5: Generating annual summaries...');
  const uniqueYears = [...new Set(sessions.map(s => s.year))];
  for (const year of uniqueYears) {
    try {
      await generateAnnualSummary(PROJECT_ROOT, parseInt(year));
      console.log(`  ✓ annual: ${year}`);
    } catch (error) {
      console.error(`  ✗ annual failed: ${year}`, error.message);
    }
  }
  
  // Step 6: Generate intelligence-learning.md
  console.log('\nStep 6: Generating intelligence learning...');
  try {
    await updateIntelligenceLearning(PROJECT_ROOT);
    console.log('  ✓ intelligence-learning.md');
  } catch (error) {
    console.error('  ✗ intelligence-learning.md failed:', error.message);
  }
  
  console.log('\n=== Regeneration Complete ===');
}

regenerateAll().catch(console.error);
