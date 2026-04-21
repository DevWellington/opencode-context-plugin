import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWeek } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-context-session');

// Import the actual function from index.js
const pluginModule = await import('./index.js');
const ensureHierarchicalDir = pluginModule.ensureHierarchicalDir || pluginModule.default.ensureHierarchicalDir;

test('ensureHierarchicalDir creates YYYY/MM/WW/DD structure', async () => {
  const result = await ensureHierarchicalDir(TEST_BASE_DIR);
  
  // Verify structure matches pattern
  assert.match(result.dirPath, /\/context-session\/\d{4}\/\d{2}\/W\d{2}\/\d{2}$/);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('ensureHierarchicalDir uses ISO week (W01-W53 format)', async () => {
  const result = await ensureHierarchicalDir(TEST_BASE_DIR);
  
  // Week should be W01-W53
  assert.match(result.week, /^W(0[1-9]|[1-4][0-9]|5[0-3])$/);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('ensureHierarchicalDir zero-pads month and day', async () => {
  const result = await ensureHierarchicalDir(TEST_BASE_DIR);
  
  // Month should be 2 digits
  assert.match(result.month, /^(0[1-9]|1[0-2])$/);
  
  // Day should be 2 digits
  assert.match(result.day, /^(0[1-9]|[12][0-9]|3[01])$/);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('ensureHierarchicalDir returns all path components', async () => {
  const result = await ensureHierarchicalDir(TEST_BASE_DIR);
  
  assert.ok(result.dirPath);
  assert.ok(result.year);
  assert.ok(result.month);
  assert.ok(result.week);
  assert.ok(result.day);
  
  // Year should be 4 digits
  assert.match(String(result.year), /^\d{4}$/);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('ensureHierarchicalDir is idempotent', async () => {
  const result1 = await ensureHierarchicalDir(TEST_BASE_DIR);
  const result2 = await ensureHierarchicalDir(TEST_BASE_DIR);
  
  // Should return same path
  assert.strictEqual(result1.dirPath, result2.dirPath);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

console.log('Running hierarchical directory tests...');
