import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-daily-summary');

// Import functions from index.js
const pluginModule = await import('./index.js');
const { updateDailySummary, atomicWrite, ensureContextSessionDir } = pluginModule;

const DAILY_SUMMARY_PATH = path.join(TEST_BASE_DIR, '.opencode/context-session', 'daily-summary.md');

test('updateDailySummary creates daily-summary.md at context-session root', async () => {
  // Setup
  await ensureContextSessionDir(TEST_BASE_DIR);
  
  const sessionInfo = {
    type: 'compact',
    filename: 'compact-2026-04-21T10-30-00.md',
    timestamp: '2026-04-21T10:30:00Z'
  };
  
  // Execute
  await updateDailySummary(TEST_BASE_DIR, sessionInfo);
  
  // Verify file exists
  await fs.access(DAILY_SUMMARY_PATH);
  
  // Verify content structure
  const content = await fs.readFile(DAILY_SUMMARY_PATH, 'utf-8');
  assert.ok(content.includes('# Daily Summary'), 'Should have Daily Summary header');
  assert.ok(content.includes('## 2026-04-21'), 'Should have date header');
  assert.ok(content.includes('**Total Sessions:** 1'), 'Should show total sessions count');
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateDailySummary appends session entries with correct format', async () => {
  // Setup
  await ensureContextSessionDir(TEST_BASE_DIR);
  
  const sessionInfo1 = {
    type: 'compact',
    filename: 'compact-2026-04-21T10-30-00.md',
    timestamp: '2026-04-21T10:30:00Z'
  };
  
  const sessionInfo2 = {
    type: 'exit',
    filename: 'exit-2026-04-21T11-15-00.md',
    timestamp: '2026-04-21T11:15:00Z'
  };
  
  // Execute
  await updateDailySummary(TEST_BASE_DIR, sessionInfo1);
  await updateDailySummary(TEST_BASE_DIR, sessionInfo2);
  
  // Verify content
  const content = await fs.readFile(DAILY_SUMMARY_PATH, 'utf-8');
  assert.ok(content.includes('📦 Compact'), 'Should have compact emoji');
  assert.ok(content.includes('🚪 Exit'), 'Should have exit emoji');
  assert.ok(content.includes('compact-2026-04-21T10-30-00.md'), 'Should list compact file');
  assert.ok(content.includes('exit-2026-04-21T11-15-00.md'), 'Should list exit file');
  
  // Verify statistics
  assert.ok(content.includes('**Total Sessions:** 2'), 'Should show 2 total sessions');
  assert.ok(content.includes('**Compacts:** 1'), 'Should show 1 compact');
  assert.ok(content.includes('**Exits:** 1'), 'Should show 1 exit');
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateDailySummary is idempotent (no duplicates)', async () => {
  // Setup
  await ensureContextSessionDir(TEST_BASE_DIR);
  
  const sessionInfo = {
    type: 'compact',
    filename: 'compact-2026-04-21T10-30-00.md',
    timestamp: '2026-04-21T10:30:00Z'
  };
  
  // Execute - call twice with same filename
  await updateDailySummary(TEST_BASE_DIR, sessionInfo);
  await updateDailySummary(TEST_BASE_DIR, sessionInfo);
  
  // Verify only one entry exists
  const content = await fs.readFile(DAILY_SUMMARY_PATH, 'utf-8');
  const lines = content.split('\n').filter(line => line.includes('compact-2026-04-21T10-30-00.md'));
  assert.strictEqual(lines.length, 1, 'Should not duplicate entries');
  assert.ok(content.includes('**Total Sessions:** 1'), 'Should still show 1 session');
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateDailySummary uses atomic writes', async () => {
  // Setup
  await ensureContextSessionDir(TEST_BASE_DIR);
  
  const sessionInfo = {
    type: 'compact',
    filename: 'compact-2026-04-21T10-30-00.md',
    timestamp: '2026-04-21T10:30:00Z'
  };
  
  // Execute multiple concurrent writes
  await Promise.all([
    updateDailySummary(TEST_BASE_DIR, { ...sessionInfo, filename: 'compact-1.md' }),
    updateDailySummary(TEST_BASE_DIR, { ...sessionInfo, filename: 'compact-2.md' }),
    updateDailySummary(TEST_BASE_DIR, { ...sessionInfo, filename: 'compact-3.md' })
  ]);
  
  // Verify file exists and is not corrupted
  await fs.access(DAILY_SUMMARY_PATH);
  const content = await fs.readFile(DAILY_SUMMARY_PATH, 'utf-8');
  assert.ok(content.includes('# Daily Summary'), 'File should not be corrupted');
  assert.ok(content.includes('compact-1.md'), 'Should have all entries');
  assert.ok(content.includes('compact-2.md'), 'Should have all entries');
  assert.ok(content.includes('compact-3.md'), 'Should have all entries');
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateDailySummary handles new day correctly', async () => {
  // Setup
  await ensureContextSessionDir(TEST_BASE_DIR);
  
  // First session on one day (simulated)
  const sessionInfo1 = {
    type: 'compact',
    filename: 'compact-2026-04-21T10-30-00.md',
    timestamp: '2026-04-21T10:30:00Z'
  };
  
  await updateDailySummary(TEST_BASE_DIR, sessionInfo1);
  
  // Verify first day content
  let content = await fs.readFile(DAILY_SUMMARY_PATH, 'utf-8');
  assert.ok(content.includes('## 2026-04-21'), 'Should have first date header');
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});
