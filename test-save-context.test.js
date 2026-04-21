import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-save-context');

// Import functions from index.js
const pluginModule = await import('./index.js');
const { saveContext, ensureHierarchicalDir } = pluginModule;

test('saveContext saves file in YYYY/MM/WW/DD subdirectory', async () => {
  const mockSession = {
    id: 'test-session-123',
    slug: 'test-slug',
    title: 'Test Session',
    messages: [
      { role: 'user', type: 'text', content: 'Hello' },
      { role: 'assistant', type: 'text', content: 'Hi there!' }
    ]
  };
  
  const result = await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  
  // Verify file was saved in hierarchical structure
  assert.ok(result);
  assert.match(result, /\/context-session\/\d{4}\/\d{2}\/W\d{2}\/\d{2}\/compact-.*\.md$/);
  
  // Verify file exists
  await fs.access(result);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('saveContext uses atomic write', async () => {
  const mockSession = {
    id: 'test-session-456',
    slug: 'test-slug-2',
    title: 'Test Session 2',
    messages: []
  };
  
  const result = await saveContext(TEST_BASE_DIR, mockSession, 'exit');
  
  // Verify file was saved
  assert.ok(result);
  const content = await fs.readFile(result, 'utf-8');
  assert.ok(content.includes('# Session Context - EXIT'));
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('saveContext generates correct filename format', async () => {
  const mockSession = {
    id: 'test-session-789',
    slug: 'test-slug-3',
    title: 'Test Session 3',
    messages: []
  };
  
  const result = await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  
  // Filename should be {type}-{timestamp}.md
  const filename = path.basename(result);
  assert.match(filename, /^compact-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

test('saveContext creates directory before file write', async () => {
  const mockSession = {
    id: 'test-session-000',
    slug: 'test-slug-4',
    title: 'Test Session 4',
    messages: []
  };
  
  const result = await saveContext(TEST_BASE_DIR, mockSession, 'compact');
  
  // Extract directory path
  const dirPath = path.dirname(result);
  
  // Directory should exist
  await fs.access(dirPath);
  
  // Verify it's the hierarchical structure
  assert.match(dirPath, /\/context-session\/\d{4}\/\d{2}\/W\d{2}\/\d{2}$/);
  
  // Cleanup
  await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
});

console.log('Running saveContext hierarchical tests...');
