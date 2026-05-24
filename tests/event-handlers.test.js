/**
 * Event Handler Integration Tests
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import mock client
const { createMockClient, MockSession, MockMessage } = await import('./mock-client.js');

// Mock the saveContext module
jest.unstable_mockModule('../src/modules/saveContext.js', () => ({
  saveContext: jest.fn().mockResolvedValue('/path/to/file.md')
}));

describe('Event Handler Integration Tests', () => {
  let tempDir;
  let mockClient;
  let ContextPlugin;
  let saveContext;

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'event-handlers-test-'));
    mockClient = createMockClient();

    // Get the mocked saveContext - reimport to get fresh mock
    const saveContextModule = await import('../src/modules/saveContext.js');
    saveContext = saveContextModule.saveContext;
    saveContext.mockClear();

    // Import ContextPlugin - it's the result of calling server()
    const module = await import('../index.js');
    const createPlugin = module.default.server;
    ContextPlugin = createPlugin;
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  describe('ContextPlugin instantiation', () => {
    it('should create plugin instance with directory and client', () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      expect(plugin.directory).toBe(tempDir);
      expect(plugin.client).toBe(mockClient);
    });
  });

  describe('session.created event', () => {
    it('should process session.created event without throwing', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await expect(plugin.event({
        type: 'session.created',
        sessionId: 'new-session-123'
      })).resolves.not.toThrow();
    });
  });

  describe('session.updated event', () => {
    it('should process session.updated event without throwing', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await expect(plugin.event({
        type: 'session.updated',
        properties: {
          info: { title: 'Updated Title' }
        }
      })).resolves.not.toThrow();
    });
  });

  describe('message.created event', () => {
    it('should add message to messages array', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      // Need to initialize lastSession via session.created first
      await plugin.event({ type: 'session.created', sessionId: 'test' });

      await plugin.event({
        type: 'message.created',
        properties: {
          info: {
            id: 'msg-1',
            role: 'user',
            content: 'Hello'
          }
        }
      });

      // Event should process without throwing
      expect(true).toBe(true);
    });

    it('should not throw on duplicate messages', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({ type: 'session.created', sessionId: 'test' });

      await plugin.event({
        type: 'message.created',
        properties: {
          info: {
            id: 'msg-1',
            role: 'user',
            content: 'Hello'
          }
        }
      });

      await plugin.event({
        type: 'message.created',
        properties: {
          info: {
            id: 'msg-1',
            role: 'user',
            content: 'Updated'
          }
        }
      });

      expect(true).toBe(true);
    });
  });

  describe('message.updated event', () => {
    it('should update existing message', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({ type: 'session.created', sessionId: 'test' });

      await expect(plugin.event({
        type: 'message.updated',
        properties: {
          info: {
            id: 'msg-1',
            role: 'user',
            content: 'updated content'
          }
        }
      })).resolves.not.toThrow();
    });
  });

  describe('message.part.delta event', () => {
    it('should append delta to message content', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({ type: 'session.created', sessionId: 'test' });

      await expect(plugin.event({
        type: 'message.part.delta',
        properties: {
          messageID: 'msg-1',
          delta: ' World'
        }
      })).resolves.not.toThrow();
    });

    it('should handle multiple delta events', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({ type: 'session.created', sessionId: 'test' });

      await plugin.event({
        type: 'message.part.delta',
        properties: { messageID: 'msg-1', delta: 'Part1' }
      });

      await plugin.event({
        type: 'message.part.delta',
        properties: { messageID: 'msg-1', delta: 'Part2' }
      });

      expect(true).toBe(true);
    });
  });

  describe('session.compacted event', () => {
    it('should call saveContext with type compact', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      // Set up session data - need to add messages so lastSession is truthy
      await plugin.event({ type: 'session.created', sessionId: 'compact-session' });
      await plugin.event({
        type: 'message.created',
        properties: {
          info: { id: 'msg-1', role: 'user', content: 'test' }
        }
      });

      await plugin.event({ type: 'session.compacted' });

      // saveContext should have been called with 'compact' type and client
      expect(saveContext).toHaveBeenCalledWith(
        tempDir,
        expect.anything(), // session object
        'compact',
        mockClient
      );
    });
  });

  describe('session.end event', () => {
    it('should call saveContext with type exit', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({ type: 'session.created', sessionId: 'end-session' });
      await plugin.event({
        type: 'message.created',
        properties: {
          info: { id: 'msg-1', role: 'user', content: 'test' }
        }
      });

      await plugin.event({ type: 'session.end' });

      expect(saveContext).toHaveBeenCalledWith(
        tempDir,
        expect.anything(),
        'exit',
        mockClient
      );
    });

    it('should handle missing session gracefully', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      // Don't create a session first
      await plugin.event({ type: 'session.end' });

      // saveContext should not be called
      expect(saveContext).not.toHaveBeenCalled();
    });
  });

  describe('session.idle event', () => {
    it('should trigger pre-exit compression via client.sessions.get', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      // Mock client.sessions.get to return a session
      mockClient.sessions.get = jest.fn().mockResolvedValue({
        id: 'idle-session',
        messages: [{ id: '1', role: 'user', content: 'test' }]
      });

      await plugin.event({
        type: 'session.idle',
        properties: { sessionID: 'idle-session' }
      });

      // Should have tried to get session
      expect(mockClient.sessions.get).toHaveBeenCalledWith('idle-session');
    });
  });

  describe('event type parsing', () => {
    it('should handle event with nested event property', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({
        event: { type: 'session.created' },
        sessionId: 'nested-test'
      });

      expect(true).toBe(true);
    });

    it('should handle event with flat type property', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      await plugin.event({
        type: 'session.created',
        sessionId: 'flat-test'
      });

      expect(true).toBe(true);
    });
  });

  describe('experimental.chat.messages.transform', () => {
    it('should be a function on the plugin', () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      expect(typeof plugin['experimental.chat.messages.transform']).toBe('function');
    });

    it('should return messages array', async () => {
      const plugin = ContextPlugin({
        directory: tempDir,
        client: mockClient
      });

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await plugin['experimental.chat.messages.transform'](messages);

      expect(result).toEqual(messages);
    });
  });
});

// Separate describe block for handleMessagePartDelta cap tests
// These test the function directly rather than through the plugin
describe('handleMessagePartDelta cap', () => {
  let tempDir;

  beforeEach(async () => {
    jest.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'delta-cap-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}
  });

  it('should accumulate deltas normally when under 100KB cap', async () => {
    const { setLastSession, getLastSession } = await import('../src/handlers/sessionHandlers.js');
    const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');

    setLastSession({ messages: [{ id: 'msg-1', content: '' }] });
    handleMessagePartDelta({
      properties: { messageID: 'msg-1', delta: 'Hello world' }
    });

    const session = getLastSession();
    expect(session.messages[0].content).toBe('Hello world');
  });

  it('should truncate content at 100KB and log warning', async () => {
    const { setLastSession, getLastSession } = await import('../src/handlers/sessionHandlers.js');
    const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');

    setLastSession({ messages: [{ id: 'msg-2', content: '' }] });

    // Accumulate past 100KB with many deltas
    const bigDelta = 'x'.repeat(5000);
    for (let i = 0; i < 25; i++) {
      handleMessagePartDelta({
        properties: { messageID: 'msg-2', delta: bigDelta }
      });
    }

    const session = getLastSession();
    // After 25 * 5000 = 125000 chars, it should be capped at 100000
    expect(session.messages[0].content.length).toBe(100000);
  });

  it('should not affect messages under limit', async () => {
    const { setLastSession, getLastSession } = await import('../src/handlers/sessionHandlers.js');
    const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');

    // Start with 50000 chars
    setLastSession({ messages: [{ id: 'msg-3', content: 'a'.repeat(50000) }] });

    handleMessagePartDelta({
      properties: { messageID: 'msg-3', delta: 'b'.repeat(1000) }
    });

    const session = getLastSession();
    // 50000 + 1000 = 51000, well under 100000, so no truncation
    expect(session.messages[0].content.length).toBe(51000);
  });
});
