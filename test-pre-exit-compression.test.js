import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-pre-exit');

// Import functions from index.js
const pluginModule = await import('./index.js');
const { triggerPreExitCompression, saveContext } = pluginModule;

describe('Pre-Exit Compression Trigger', () => {
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

  test('triggerPreExitCompression function exists', () => {
    assert.ok(triggerPreExitCompression, 'triggerPreExitCompression should be exported');
    assert.strictEqual(typeof triggerPreExitCompression, 'function', 'should be a function');
  });

  test('triggerPreExitCompression calls saveContext with type=exit', async () => {
    // Mock client with sessions.get method
    const mockSession = {
      id: 'test-exit-session-123',
      slug: 'test-exit-slug',
      title: 'Test Exit Session',
      messages: [
        { role: 'user', type: 'text', content: 'Hello' },
        { role: 'assistant', type: 'text', content: 'Hi there!' }
      ]
    };

    const mockClient = {
      sessions: {
        get: async (sessionId) => {
          assert.strictEqual(sessionId, 'test-exit-session-123');
          return mockSession;
        }
      }
    };

    // Call the function
    const result = await triggerPreExitCompression('test-exit-session-123', TEST_BASE_DIR, mockClient);

    // Verify it returned a path (from saveContext)
    assert.ok(result, 'Should return a file path');
    assert.match(result, /\/exit-.*\.md$/, 'Should save as exit- file');

    // Verify file exists
    const fileExists = await fs.access(result).then(() => true).catch(() => false);
    assert.ok(fileExists, 'Exit file should exist');
  });

  test('triggerPreExitCompression handles client errors gracefully', async () => {
    const mockClient = {
      sessions: {
        get: async (sessionId) => {
          throw new Error('Client not available');
        }
      }
    };

    // Should not throw, should handle error gracefully
    const result = await triggerPreExitCompression('test-session-456', TEST_BASE_DIR, mockClient);
    
    // Should return null on error (graceful degradation)
    assert.strictEqual(result, null, 'Should return null on error');
  });

  test('triggerPreExitCompression handles missing session data', async () => {
    const mockClient = {
      sessions: {
        get: async (sessionId) => {
          return null; // Session not found
        }
      }
    };

    const result = await triggerPreExitCompression('nonexistent-session', TEST_BASE_DIR, mockClient);
    
    // Should handle gracefully
    assert.strictEqual(result, null, 'Should return null when session not found');
  });
});
