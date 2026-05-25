import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { sessionState } from '../src/handlers/sessionState.js';

jest.unstable_mockModule('../src/handlers/lifecycle.js', () => ({
  isDestroyed: jest.fn(() => false),
  setDestroyed: jest.fn(),
  destroy: jest.fn(async () => { }),
  init: jest.fn(async () => { })
}));

describe('Message Handlers', () => {
  let isDestroyed;

  beforeEach(async () => {
    await sessionState.reset();
    await sessionState.createSession({ sessionId: 'test-session' });
    await sessionState.addMessage('msg-1', 'user');
    const lifecycle = await import('../src/handlers/lifecycle.js');
    isDestroyed = lifecycle.isDestroyed;
    isDestroyed.mockReturnValue(false);
  });

  afterEach(async () => {
    await sessionState.reset();
  });

  describe('handleMessageUpdatedOrCreated()', () => {
    it('should add a new message', async () => {
      const { handleMessageUpdatedOrCreated } = await import('../src/handlers/messageHandlers.js');
      await handleMessageUpdatedOrCreated({
        properties: { info: { id: 'msg-2', role: 'assistant' } }
      });
      const session = await sessionState.getClonedSession();
      expect(session.messages).toHaveLength(2);
    });

    it('should update existing message by ID', async () => {
      const { handleMessageUpdatedOrCreated } = await import('../src/handlers/messageHandlers.js');
      await handleMessageUpdatedOrCreated({
        properties: { info: { id: 'msg-1', role: 'user', content: 'updated' } }
      });
      const session = await sessionState.getClonedSession();
      expect(session.messages).toHaveLength(1);
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('updated');
    });

    it('should do nothing when info is missing', async () => {
      const { handleMessageUpdatedOrCreated } = await import('../src/handlers/messageHandlers.js');
      await handleMessageUpdatedOrCreated({ properties: {} });
      const session = await sessionState.getClonedSession();
      expect(session.messages).toHaveLength(1);
    });

    it('should do nothing when msgId is missing', async () => {
      const { handleMessageUpdatedOrCreated } = await import('../src/handlers/messageHandlers.js');
      await handleMessageUpdatedOrCreated({
        properties: { info: { role: 'user' } }
      });
      const session = await sessionState.getClonedSession();
      expect(session.messages).toHaveLength(1);
    });
  });

  describe('handleMessagePartDelta()', () => {
    it('should append delta to message content', async () => {
      const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartDelta({
        properties: { messageID: 'msg-1', delta: 'Hello' }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('Hello');
    });

    it('should append multiple deltas', async () => {
      const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');
      const handler = await import('../src/handlers/messageHandlers.js');
      await handler.handleMessagePartDelta({
        properties: { messageID: 'msg-1', delta: 'Hello' }
      });
      await handler.handleMessagePartDelta({
        properties: { messageID: 'msg-1', delta: ' World' }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('Hello World');
    });

    it('should do nothing when delta is missing', async () => {
      const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartDelta({
        properties: { messageID: 'msg-1' }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('');
    });

    it('should do nothing when messageID is missing', async () => {
      const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartDelta({
        properties: { delta: 'text' }
      });
    });

    it('should handle message with undefined content gracefully', async () => {
      await sessionState.addMessage('msg-undef', 'user');
      const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartDelta({
        properties: { messageID: 'msg-undef', delta: 'test' }
      });
      const msg = await sessionState.findMessage('msg-undef');
      expect(msg.content).toBe('test');
    });
  });

  describe('handleMessagePartUpdated()', () => {
    it('should set content from part update', async () => {
      const { handleMessagePartUpdated } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartUpdated({
        properties: { part: { messageID: 'msg-1', text: 'hello world' } }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('hello world');
    });

    it('should do nothing when text is missing', async () => {
      const { handleMessagePartUpdated } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartUpdated({
        properties: { part: { messageID: 'msg-1' } }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('');
    });

    it('should do nothing when part is missing', async () => {
      const { handleMessagePartUpdated } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartUpdated({ properties: {} });
    });

    it('should handle part with text even without messageID', async () => {
      const { handleMessagePartUpdated } = await import('../src/handlers/messageHandlers.js');
      await handleMessagePartUpdated({
        properties: { part: { text: 'orphan' } }
      });
    });
  });

  describe('lifecycle guards', () => {
    it('handleMessageUpdatedOrCreated returns early after destroy', async () => {
      const { handleMessageUpdatedOrCreated } = await import('../src/handlers/messageHandlers.js');
      isDestroyed.mockReturnValue(true);
      await handleMessageUpdatedOrCreated({
        properties: { info: { id: 'msg-lifecycle', role: 'user' } }
      });
      const session = await sessionState.getClonedSession();
      expect(session.messages).toHaveLength(1);
    });

    it('handleMessagePartDelta returns early after destroy', async () => {
      const { handleMessagePartDelta } = await import('../src/handlers/messageHandlers.js');
      isDestroyed.mockReturnValue(true);
      await handleMessagePartDelta({
        properties: { messageID: 'msg-1', delta: 'should not append' }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('');
    });

    it('handleMessagePartUpdated returns early after destroy', async () => {
      const { handleMessagePartUpdated } = await import('../src/handlers/messageHandlers.js');
      isDestroyed.mockReturnValue(true);
      await handleMessagePartUpdated({
        properties: { part: { messageID: 'msg-1', text: 'should not set' } }
      });
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBe('');
    });

    it('no state mutation after destroy', async () => {
      const { handleMessageUpdatedOrCreated, handleMessagePartDelta, handleMessagePartUpdated } = await import('../src/handlers/messageHandlers.js');
      isDestroyed.mockReturnValue(true);

      await handleMessageUpdatedOrCreated({
        properties: { info: { id: 'msg-new', role: 'assistant' } }
      });
      await handleMessagePartDelta({
        properties: { messageID: 'msg-1', delta: 'delta' }
      });
      await handleMessagePartUpdated({
        properties: { part: { messageID: 'msg-1', text: 'text' } }
      });

      const session = await sessionState.getClonedSession();
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].content).toBe('');
    });
  });
});
