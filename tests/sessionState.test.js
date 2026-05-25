/**
 * SessionState Tests
 * Tests lock serialization, error propagation, message operations, and reset
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SessionState } from '../src/handlers/sessionState.js';

describe('SessionState', () => {
  let session;

  beforeEach(() => {
    session = new SessionState();
  });

  describe('Lock Serialization', () => {
    it('should execute concurrent operations in order (not interleaved)', async () => {
      const executionOrder = [];
      
      const operations = [
        session.createSession({ sessionId: 's1' }).then(() => {
          executionOrder.push('session-1');
        }),
        session.addMessage('msg-1', 'user').then(() => {
          executionOrder.push('msg-1');
        }),
        session.addMessage('msg-2', 'assistant').then(() => {
          executionOrder.push('msg-2');
        })
      ];
      
      await Promise.all(operations);
      
      expect(executionOrder).toEqual(['session-1', 'msg-1', 'msg-2']);
    });

    it('should not interleave concurrent message additions', async () => {
      await session.createSession({ sessionId: 'test' });
      
      const additions = Array.from({ length: 10 }, (_, i) => 
        session.addMessage(`msg-${i}`, 'user')
      );
      
      const results = await Promise.all(additions);
      
      const totals = results.map(r => r.total);
      expect(totals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should handle rapid concurrent operations correctly', async () => {
      await session.createSession({ sessionId: 'test' });
      
      const ops = Array.from({ length: 50 }, (_, i) => 
        session.addMessage(`msg-${i}`, i % 2 === 0 ? 'user' : 'assistant')
      );
      
      const results = await Promise.all(ops);
      
      const added = results.filter(r => r.added);
      expect(added).toHaveLength(50);
    });

    it('should serialize updates to prevent race conditions', async () => {
      await session.createSession({ sessionId: 'test' });
      await session.addMessage('msg-1', 'assistant');
      
      const appends = Array.from({ length: 100 }, (_, i) => 
        session.appendDelta('msg-1', `${i},`)
      );
      
      await Promise.all(appends);
      
      const msg = await session.findMessage('msg-1');
      const parts = msg.content.split(',').filter(p => p !== '');
      
      expect(parts).toHaveLength(100);
    });
  });

  describe('Message Operations', () => {
    beforeEach(async () => {
      await session.createSession({ sessionId: 'test-session' });
    });

    describe('addMessage(msgId, role)', () => {
      it('should add a new message to the session', async () => {
        const result = await session.addMessage('msg-1', 'user');
        
        expect(result).toEqual({ added: true, total: 1 });
        
        const msg = await session.findMessage('msg-1');
        expect(msg).toEqual({ id: 'msg-1', role: 'user', content: '' });
      });

      it('should not add duplicate message (same msgId)', async () => {
        await session.addMessage('msg-1', 'user');
        const result = await session.addMessage('msg-1', 'assistant');
        
        expect(result).toEqual({ added: false });
        
        const msg = await session.findMessage('msg-1');
        expect(msg.role).toBe('user');
      });

      it('should track total messages correctly', async () => {
        const r1 = await session.addMessage('msg-1', 'user');
        const r2 = await session.addMessage('msg-2', 'assistant');
        const r3 = await session.addMessage('msg-3', 'user');
        
        expect(r1.total).toBe(1);
        expect(r2.total).toBe(2);
        expect(r3.total).toBe(3);
      });

      it('should initialize messages array if it does not exist', async () => {
        await session.updateSession({}); // Ensure lastSession exists without messages
        const result = await session.addMessage('msg-1', 'user');
        
        expect(result.added).toBe(true);
      });
    });

    describe('appendDelta(msgId, delta)', () => {
      it('should append delta to message content', async () => {
        await session.addMessage('msg-1', 'assistant');
        
        await session.appendDelta('msg-1', 'Hello');
        await session.appendDelta('msg-1', ' ');
        await session.appendDelta('msg-1', 'World');
        
        const msg = await session.findMessage('msg-1');
        expect(msg.content).toBe('Hello World');
      });

      it('should return false if message does not exist', async () => {
        const result = await session.appendDelta('non-existent', 'text');
        expect(result).toBe(false);
      });

      it('should return false if no session exists', async () => {
        await session.reset();
        const result = await session.appendDelta('msg-1', 'text');
        expect(result).toBe(false);
      });

      it('should handle empty delta correctly', async () => {
        await session.addMessage('msg-1', 'assistant');
        await session.appendDelta('msg-1', '');
        
        const msg = await session.findMessage('msg-1');
        expect(msg.content).toBe('');
      });
    });

    describe('updateMessageContent(msgId, content)', () => {
      it('should set message content when content is empty', async () => {
        await session.addMessage('msg-1', 'assistant');
        
        const result = await session.updateMessageContent('msg-1', 'New content');
        expect(result).toBe(true);
        
        const msg = await session.findMessage('msg-1');
        expect(msg.content).toBe('New content');
      });

      it('should return false if message already has content', async () => {
        await session.addMessage('msg-1', 'assistant');
        await session.appendDelta('msg-1', 'Existing');
        
        const result = await session.updateMessageContent('msg-1', 'New content');
        expect(result).toBe(false);
        
        const msg = await session.findMessage('msg-1');
        expect(msg.content).toBe('Existing');
      });

      it('should return false if message does not exist', async () => {
        const result = await session.updateMessageContent('non-existent', 'content');
        expect(result).toBe(false);
      });

      it('should return false if no session exists', async () => {
        await session.reset();
        const result = await session.updateMessageContent('msg-1', 'content');
        expect(result).toBe(false);
      });
    });

    describe('findMessage(msgId)', () => {
      it('should return message if found', async () => {
        await session.addMessage('msg-1', 'user');
        await session.appendDelta('msg-1', 'Test content');
        
        const msg = await session.findMessage('msg-1');
        expect(msg).toEqual({
          id: 'msg-1',
          role: 'user',
          content: 'Test content'
        });
      });

      it('should return null if message not found', async () => {
        const msg = await session.findMessage('non-existent');
        expect(msg).toBeNull();
      });

      it('should return null if no session exists', async () => {
        await session.reset();
        const msg = await session.findMessage('msg-1');
        expect(msg).toBeNull();
      });
    });

    describe('updateMessage(msgId, updates)', () => {
      it('should update message fields', async () => {
        await session.addMessage('msg-1', 'assistant');
        
        const result = await session.updateMessage('msg-1', {
          content: 'Updated',
          tokens: 100,
          model: 'gpt-4'
        });
        
        expect(result).toBe(true);
        
        const msg = await session.findMessage('msg-1');
        expect(msg.content).toBe('Updated');
        expect(msg.tokens).toBe(100);
        expect(msg.model).toBe('gpt-4');
      });

      it('should return false if message does not exist', async () => {
        const result = await session.updateMessage('non-existent', { content: 'test' });
        expect(result).toBe(false);
      });

      it('should return false if no session exists', async () => {
        await session.reset();
        const result = await session.updateMessage('msg-1', { content: 'test' });
        expect(result).toBe(false);
      });

      it('should allow overwriting existing fields', async () => {
        await session.addMessage('msg-1', 'user');
        await session.updateMessage('msg-1', { custom: 'value1' });
        await session.updateMessage('msg-1', { custom: 'value2' });
        
        const msg = await session.findMessage('msg-1');
        expect(msg.custom).toBe('value2');
      });
    });
  });

  describe('Error Propagation', () => {
    it('should handle operations gracefully when session not initialized', async () => {
      const result1 = await session.appendDelta('msg-1', 'text');
      expect(result1).toBe(false);
      
      const result2 = await session.updateMessageContent('msg-1', 'content');
      expect(result2).toBe(false);
      
      const result3 = await session.updateMessage('msg-1', { content: 'test' });
      expect(result3).toBe(false);
      
      const msg = await session.findMessage('msg-1');
      expect(msg).toBeNull();
    });

    it('should handle multiple operations on non-existent messages', async () => {
      await session.createSession({ sessionId: 'test' });
      
      const results = await Promise.all([
        session.appendDelta('non-existent', 'text'),
        session.updateMessageContent('non-existent', 'content'),
        session.updateMessage('non-existent', { field: 'value' }),
        session.findMessage('non-existent')
      ]);
      
      expect(results[0]).toBe(false);
      expect(results[1]).toBe(false);
      expect(results[2]).toBe(false);
      expect(results[3]).toBeNull();
    });

    it('should handle duplicate message additions gracefully', async () => {
      await session.createSession({ sessionId: 'test' });
      
      const results = await Promise.all([
        session.addMessage('msg-1', 'user'),
        session.addMessage('msg-1', 'assistant'), // Duplicate
        session.addMessage('msg-1', 'system') // Another duplicate
      ]);
      
      expect(results[0].added).toBe(true);
      expect(results[1].added).toBe(false);
      expect(results[2].added).toBe(false);
      
      const msg = await session.findMessage('msg-1');
      expect(msg.role).toBe('user');
    });

    it('should continue working after error conditions', async () => {
      await session.createSession({ sessionId: 'test' });
      
      await session.appendDelta('non-existent', 'text');
      
      await session.addMessage('msg-1', 'user');
      const msg = await session.findMessage('msg-1');
      expect(msg).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should clear all state', async () => {
      await session.createSession({ sessionId: 'test-session' });
      await session.addMessage('msg-1', 'user');
      await session.setHasInjectedContext(true);
      
      await session.reset();
      
      expect(session.getCurrentSessionId()).toBeNull();
      expect(session.getHasInjectedContext()).toBe(false);
      expect(session.getLastSession()).toBeNull();
    });

    it('should be idempotent (multiple resets are safe)', async () => {
      await session.createSession({ sessionId: 'test-session' });
      
      await session.reset();
      await session.reset();
      await session.reset();
      
      expect(session.getCurrentSessionId()).toBeNull();
      expect(session.getHasInjectedContext()).toBe(false);
      expect(session.getLastSession()).toBeNull();
    });

    it('should work on fresh session', async () => {
      await expect(session.reset()).resolves.not.toThrow();
      expect(session.getCurrentSessionId()).toBeNull();
    });

    it('should clear messages', async () => {
      await session.createSession({ sessionId: 'test-session' });
      await session.addMessage('msg-1', 'user');
      await session.addMessage('msg-2', 'assistant');
      
      await session.reset();
      
      const msg = await session.findMessage('msg-1');
      expect(msg).toBeNull();
    });
  });

  describe('Concurrent Race Tests', () => {
    it('should handle concurrent message additions deterministically', async () => {
      await session.createSession({ sessionId: 'test-session' });
      
      const additions = Array.from({ length: 10 }, (_, i) => 
        session.addMessage(`msg-${i}`, i % 2 === 0 ? 'user' : 'assistant')
      );
      
      await Promise.all(additions);
      
      const sessionData = await session.getClonedSession();
      expect(sessionData.messages).toHaveLength(10);
      
      for (let i = 0; i < 10; i++) {
        const msg = sessionData.messages.find(m => m.id === `msg-${i}`);
        expect(msg).toBeDefined();
        expect(msg.role).toBe(i % 2 === 0 ? 'user' : 'assistant');
      }
    });

    it('should handle concurrent updates to different messages', async () => {
      await session.createSession({ sessionId: 'test-session' });
      await session.addMessage('msg-1', 'user');
      await session.addMessage('msg-2', 'assistant');
      
      const updates = [
        session.updateMessage('msg-1', { content: 'content-1' }),
        session.updateMessage('msg-2', { content: 'content-2' }),
        session.updateMessage('msg-1', { extra: 'extra-1' }),
        session.updateMessage('msg-2', { extra: 'extra-2' })
      ];
      
      await Promise.all(updates);
      
      const msg1 = await session.findMessage('msg-1');
      const msg2 = await session.findMessage('msg-2');
      
      expect(msg1.content).toBe('content-1');
      expect(msg1.extra).toBe('extra-1');
      expect(msg2.content).toBe('content-2');
      expect(msg2.extra).toBe('extra-2');
    });

    it('should maintain consistency under concurrent append operations', async () => {
      await session.createSession({ sessionId: 'test-session' });
      await session.addMessage('msg-1', 'assistant');
      
      const appends = Array.from({ length: 100 }, (_, i) => 
        session.appendDelta('msg-1', `${i},`)
      );
      
      await Promise.all(appends);
      
      const msg = await session.findMessage('msg-1');
      const parts = msg.content.split(',').filter(p => p !== '');
      
      expect(parts).toHaveLength(100);
      expect(parts.map(Number).sort((a, b) => a - b)).toEqual(
        Array.from({ length: 100 }, (_, i) => i)
      );
    });

    it('should handle mixed concurrent operations', async () => {
      await session.createSession({ sessionId: 'test-session' });
      
      const operations = [
        session.addMessage('msg-1', 'user'),
        session.addMessage('msg-2', 'assistant'),
        session.addMessage('msg-1', 'user'), // Duplicate
        session.updateMessage('msg-1', { content: 'hello' }),
        session.appendDelta('msg-2', 'world'),
        session.findMessage('msg-1'),
        session.addMessage('msg-3', 'user')
      ];
      
      await Promise.all(operations);
      
      const sessionData = await session.getClonedSession();
      expect(sessionData.messages).toHaveLength(3);
      expect(sessionData.messages[0].content).toBe('hello');
      expect(sessionData.messages[1].content).toBe('world');
    });
  });

  describe('Session Management', () => {
    it('should create session with sessionId from event', async () => {
      await session.createSession({ sessionId: 'session-123' });
      
      expect(session.getCurrentSessionId()).toBe('session-123');
      expect(session.getHasInjectedContext()).toBe(false);
      expect(session.getLastSession()).toBeNull();
    });

    it('should create session with sessionID (alternate key)', async () => {
      await session.createSession({ sessionID: 'session-456' });
      expect(session.getCurrentSessionId()).toBe('session-456');
    });

    it('should create session with nested session.id', async () => {
      await session.createSession({ session: { id: 'session-789' } });
      expect(session.getCurrentSessionId()).toBe('session-789');
    });

    it('should update session info', async () => {
      await session.createSession({ sessionId: 'test' });
      
      await session.updateSession({ model: 'gpt-4', tokens: 100 });
      await session.updateSession({ tokens: 200 });
      
      const lastSession = session.getLastSession();
      expect(lastSession.model).toBe('gpt-4');
      expect(lastSession.tokens).toBe(200);
    });

    it('should get cloned session (deep copy)', async () => {
      await session.createSession({ sessionId: 'test' });
      await session.updateSession({ key: 'value' });
      
      const clone1 = await session.getClonedSession();
      clone1.key = 'modified';
      
      const clone2 = await session.getClonedSession();
      expect(clone2.key).toBe('value');
    });

    it('should return null from getClonedSession when no session', async () => {
      const clone = await session.getClonedSession();
      expect(clone).toBeNull();
    });
  });

  describe('Direct Property Access', () => {
    it('should get and set currentSessionId', async () => {
      await session.setCurrentSessionId('direct-set');
      expect(session.getCurrentSessionId()).toBe('direct-set');
    });

    it('should get and set hasInjectedContext', async () => {
      await session.setHasInjectedContext(true);
      expect(session.getHasInjectedContext()).toBe(true);
      
      await session.setHasInjectedContext(false);
      expect(session.getHasInjectedContext()).toBe(false);
    });

    it('should get and set lastSession directly', async () => {
      const data = { messages: [] };
      await session.setLastSession(data);
      expect(session.getLastSession()).toBe(data);
    });
  });
});