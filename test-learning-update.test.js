import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_BASE_DIR = path.join(__dirname, 'test-learning-update');

// Import functions from index.js
const pluginModule = await import('./index.js');
const { initializeIntelligenceLearning, updateIntelligenceLearning } = pluginModule;

describe('Intelligence Learning Update Function', () => {
  before(async () => {
    // Clean up test directory
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
    } catch {}
    
    // Initialize the learning file
    await initializeIntelligenceLearning(TEST_BASE_DIR);
  });

  after(async () => {
    // Clean up after tests
    try {
      await fs.rm(TEST_BASE_DIR, { recursive: true, force: true });
    } catch {}
  });

  test('updateIntelligenceLearning function exists', () => {
    assert.ok(updateIntelligenceLearning, 'updateIntelligenceLearning should be exported');
    assert.strictEqual(typeof updateIntelligenceLearning, 'function', 'should be a function');
  });

  test('updateIntelligenceLearning updates Last Updated section', async () => {
    const sessionInfo = {
      type: 'compact',
      filename: 'compact-2026-04-21T12-00-00.md',
      timestamp: '2026-04-21T12:00:00Z',
      sessionId: 'test-session-123',
      messageCount: 10
    };
    
    await updateIntelligenceLearning(TEST_BASE_DIR, sessionInfo);
    
    const filePath = path.join(TEST_BASE_DIR, '.opencode/context-session', 'intelligence-learning.md');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check timestamp was updated
    assert.match(content, /2026-04-21T12:00:00Z/, 'Should update timestamp');
    assert.match(content, /\*\*Sessions Analyzed:\*\* 1/, 'Should increment session count');
    assert.match(content, /\*\*Last Session Type:\*\* compact/, 'Should update session type');
  });

  test('updateIntelligenceLearning appends to Key Learnings section', async () => {
    const sessionInfo = {
      type: 'exit',
      filename: 'exit-2026-04-21T12-30-00.md',
      timestamp: '2026-04-21T12:30:00Z',
      sessionId: 'test-session-456',
      messageCount: 25
    };
    
    await updateIntelligenceLearning(TEST_BASE_DIR, sessionInfo);
    
    const filePath = path.join(TEST_BASE_DIR, '.opencode/context-session', 'intelligence-learning.md');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Check learning entry was appended
    assert.match(content, /test-session-456/, 'Should include session ID');
    assert.match(content, /exit/, 'Should include session type');
    assert.match(content, /25 messages/, 'Should include message count');
  });

  test('updateIntelligenceLearning limits Key Learnings to last 20 entries', async () => {
    // Simulate 25 updates
    for (let i = 0; i < 25; i++) {
      const sessionInfo = {
        type: i % 2 === 0 ? 'compact' : 'exit',
        filename: `${i % 2 === 0 ? 'compact' : 'exit'}-2026-04-21T12-${String(i).padStart(2, '0')}-00.md`,
        timestamp: `2026-04-21T12:${String(i).padStart(2, '0')}:00Z`,
        sessionId: `test-session-${i}`,
        messageCount: 10 + i
      };
      
      await updateIntelligenceLearning(TEST_BASE_DIR, sessionInfo);
    }
    
    const filePath = path.join(TEST_BASE_DIR, '.opencode/context-session', 'intelligence-learning.md');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Count session entries (look for session ID patterns)
    const sessionMatches = content.match(/test-session-\d+/g) || [];
    
    // Should have at most 20 entries (latest 20)
    assert.ok(sessionMatches.length <= 20, `Should limit to 20 entries, found ${sessionMatches.length}`);
  });

  test('updateIntelligenceLearning handles errors gracefully', async () => {
    const invalidSessionInfo = null;
    
    // Should not throw
    await assert.doesNotReject(
      async () => {
        await updateIntelligenceLearning(TEST_BASE_DIR, invalidSessionInfo);
      },
      'Should handle null session info gracefully'
    );
  });

  test('updateIntelligenceLearning deduplicates session entries', async () => {
    const sessionInfo = {
      type: 'compact',
      filename: 'compact-unique-test.md',
      timestamp: '2026-04-21T13:00:00Z',
      sessionId: 'unique-session-999',
      messageCount: 15
    };
    
    // Update twice with same session
    await updateIntelligenceLearning(TEST_BASE_DIR, sessionInfo);
    await updateIntelligenceLearning(TEST_BASE_DIR, sessionInfo);
    
    const filePath = path.join(TEST_BASE_DIR, '.opencode/context-session', 'intelligence-learning.md');
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Count occurrences of session ID
    const matches = content.match(/unique-session-999/g) || [];
    
    // Should appear only once (deduplicated)
    assert.strictEqual(matches.length, 1, 'Should deduplicate session entries');
  });
});
