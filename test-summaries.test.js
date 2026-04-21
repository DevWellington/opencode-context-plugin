import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-summaries');

// Import functions from index.js
const pluginModule = await import('./index.js');
const { saveContext, updateDaySummary, updateWeekSummary } = pluginModule;

test('updateDaySummary creates day-summary.md in day directory', async () => {
  const mockSession = {
    id: 'test-session-summary-1',
    slug: 'test-slug',
    title: 'Test Session',
    messages: []
  };
  
  await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  
  // Get the path components
  const pathComponents = await pluginModule.ensureHierarchicalDir(TEST_BASE_DIR);
  const daySummaryPath = path.join(pathComponents.dirPath, 'day-summary.md');
  
  // Verify day summary exists
  await fs.access(daySummaryPath);
  
  // Verify content
  const content = await fs.readFile(daySummaryPath, 'utf-8');
  assert.ok(content.includes('# Day Summary'));
  assert.ok(content.includes(`**Date:** ${pathComponents.year}-${pathComponents.month}-${pathComponents.day}`));
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateDaySummary appends session entries', async () => {
  const mockSession1 = {
    id: 'test-session-summary-2a',
    slug: 'test-slug-2a',
    title: 'Test Session 2a',
    messages: []
  };
  
  const mockSession2 = {
    id: 'test-session-summary-2b',
    slug: 'test-slug-2b',
    title: 'Test Session 2b',
    messages: []
  };
  
  // Save two sessions
  await saveContext(TEST_BASE_DIR, mockSession1, 'compact');
  await saveContext(TEST_BASE_DIR, mockSession2, 'exit');
  
  // Get the path components
  const pathComponents = await pluginModule.ensureHierarchicalDir(TEST_BASE_DIR);
  const daySummaryPath = path.join(pathComponents.dirPath, 'day-summary.md');
  
  // Verify content has both entries
  const content = await fs.readFile(daySummaryPath, 'utf-8');
  assert.ok(content.includes('📦 Compact'));
  assert.ok(content.includes('🚪 Exit'));
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateDaySummary is idempotent (no duplicates)', async () => {
  const mockSession = {
    id: 'test-session-summary-3',
    slug: 'test-slug-3',
    title: 'Test Session 3',
    messages: []
  };
  
  // Save same session twice
  await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  
  // Get the path components
  const pathComponents = await pluginModule.ensureHierarchicalDir(TEST_BASE_DIR);
  const daySummaryPath = path.join(pathComponents.dirPath, 'day-summary.md');
  
  // Verify content has only one entry
  const content = await fs.readFile(daySummaryPath, 'utf-8');
  const matches = content.match(/compact-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md/g);
  assert.strictEqual(matches?.length, 1);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateWeekSummary creates week-summary.md in week directory', async () => {
  const mockSession = {
    id: 'test-session-summary-4',
    slug: 'test-slug-4',
    title: 'Test Session 4',
    messages: []
  };
  
  await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  
  // Get the path components
  const pathComponents = await pluginModule.ensureHierarchicalDir(TEST_BASE_DIR);
  const weekDir = path.join(TEST_BASE_DIR, '.opencode/context-session', String(pathComponents.year), pathComponents.month, pathComponents.week);
  const weekSummaryPath = path.join(weekDir, 'week-summary.md');
  
  // Verify week summary exists
  await fs.access(weekSummaryPath);
  
  // Verify content
  const content = await fs.readFile(weekSummaryPath, 'utf-8');
  assert.ok(content.includes(`# Week ${pathComponents.week} Summary`));
  assert.ok(content.includes(`**Period:** ${pathComponents.year}-${pathComponents.month}`));
  assert.ok(content.includes('## Days'));
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('updateWeekSummary counts files per day', async () => {
  const mockSession1 = {
    id: 'test-session-summary-5a',
    slug: 'test-slug-5a',
    title: 'Test Session 5a',
    messages: []
  };
  
  const mockSession2 = {
    id: 'test-session-summary-5b',
    slug: 'test-slug-5b',
    title: 'Test Session 5b',
    messages: []
  };
  
  // Save one compact and one exit (with delay to get different timestamps)
  await saveContext(TEST_BASE_DIR, mockSession1, 'compact');
  await new Promise(resolve => setTimeout(resolve, 10));
  await saveContext(TEST_BASE_DIR, mockSession2, 'exit');
  
  // Get the path components
  const pathComponents = await pluginModule.ensureHierarchicalDir(TEST_BASE_DIR);
  const weekDir = path.join(TEST_BASE_DIR, '.opencode/context-session', String(pathComponents.year), pathComponents.month, pathComponents.week);
  const weekSummaryPath = path.join(weekDir, 'week-summary.md');
  
  // Verify content has counts
  const content = await fs.readFile(weekSummaryPath, 'utf-8');
  assert.ok(content.includes(`### Day ${pathComponents.day}`));
  assert.ok(content.includes('📦 Compact files: 1'));
  assert.ok(content.includes('🚪 Exit files: 1'));
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

console.log('Running summary generation tests...');
