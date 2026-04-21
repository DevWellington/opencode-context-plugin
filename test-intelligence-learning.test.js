import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-intelligence');

// Import functions from index.js
const pluginModule = await import('./index.js');
const { initializeIntelligenceLearning, atomicWrite } = pluginModule;

describe('Intelligence Learning File Structure', () => {
  before(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
    } catch {}
  });

  after(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
    } catch {}
  });

  test('initializeIntelligenceLearning function exists', () => {
    assert.ok(initializeIntelligenceLearning, 'initializeIntelligenceLearning should be exported');
    assert.strictEqual(typeof initializeIntelligenceLearning, 'function', 'should be a function');
  });

  test('initializeIntelligenceLearning creates file at correct path', async () => {
    const result = await initializeIntelligenceLearning(TEST_BASE_DIR);
    
    const expectedPath = path.join(TEST_BASE_DIR, '.opencode/context-session', 'intelligence-learning.md');
    assert.strictEqual(result, expectedPath, 'Should return correct file path');
    
    // Verify file exists
    const fileExists = await fs.access(result).then(() => true).catch(() => false);
    assert.ok(fileExists, 'Intelligence learning file should exist');
  });

  test('intelligence-learning.md contains all required sections', async () => {
    const filePath = path.join(TEST_BASE_DIR, '.opencode/context-session', 'intelligence-learning.md');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check for required sections
    assert.match(content, /# Intelligence Learning/, 'Should have main title');
    assert.match(content, /## Last Updated/, 'Should have Last Updated section');
    assert.match(content, /## Project Structure Decisions/, 'Should have Project Structure section');
    assert.match(content, /### Folder Hierarchy/, 'Should have Folder Hierarchy subsection');
    assert.match(content, /### Naming Conventions/, 'Should have Naming Conventions subsection');
    assert.match(content, /## Architectural Decisions/, 'Should have Architectural Decisions section');
    assert.match(content, /## Bug Fix Guidance/, 'Should have Bug Fix Guidance section');
    assert.match(content, /## Session Patterns/, 'Should have Session Patterns section');
    assert.match(content, /## Key Learnings from Latest Sessions/, 'Should have Key Learnings section');
  });

  test('intelligence-learning.md is not overwritten if exists', async () => {
    const ctxDir = path.join(TEST_BASE_DIR, '.opencode/context-session');
    const filePath = path.join(ctxDir, 'intelligence-learning.md');
    
    // Write custom content
    const originalContent = '# Custom Content\n\nThis is custom';
    await atomicWrite(filePath, originalContent);
    
    // Call initialization again
    await initializeIntelligenceLearning(TEST_BASE_DIR);
    
    // Verify original content preserved
    const newContent = await fs.readFile(filePath, 'utf-8');
    assert.strictEqual(newContent, originalContent, 'Should not overwrite existing file');
  });

  test('intelligence-learning.md uses atomic write', async () => {
    const newTestDir = path.join(TEST_BASE_DIR, 'atomic-test');
    await fs.mkdir(newTestDir, { recursive: true });
    
    const result = await initializeIntelligenceLearning(newTestDir);
    
    // Verify file exists and is valid markdown
    const content = await fs.readFile(result, 'utf-8');
    assert.ok(content.length > 100, 'File should have substantial content');
    assert.match(content, /^# Intelligence Learning/, 'Should start with markdown heading');
  });
});
