/**
 * Cleanup script for deprecated root-level daily-summary.md
 * 
 * The hierarchical day-summary.md (in YYYY/MM/WW/DD/) is now the standard.
 * This script removes the old root-level daily-summary.md.
 * 
 * Usage: node scripts/cleanup-old-daily-summary.js [--dry-run]
 * 
 * --dry-run: Show what would be deleted without actually deleting
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const OLD_DAILY_SUMMARY = path.join(ROOT_DIR, '.opencode', 'context-session', 'daily-summary.md');

const dryRun = process.argv.includes('--dry-run');

async function cleanup() {
  console.log('🧹 Cleaning up deprecated root daily-summary.md...\n');

  if (dryRun) {
    console.log('🔍 DRY RUN - would delete:');
  } else {
    console.log('🗑️  Deleting:');
  }

  try {
    await fs.access(OLD_DAILY_SUMMARY);
    console.log(`  ${OLD_DAILY_SUMMARY}`);

    if (!dryRun) {
      await fs.unlink(OLD_DAILY_SUMMARY);
      console.log('✅ Removed deprecated daily-summary.md');
    }
  } catch {
    console.log('ℹ️  No deprecated daily-summary.md found (may already be cleaned up)');
  }

  console.log('\n📋 Note: The hierarchical day-summary.md (YYYY/MM/WW/DD/day-summary.md) is now the standard.');
}

cleanup().catch(console.error);
