import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { SessionState } from '../src/handlers/sessionState.js';
import { handleSessionCreated, handleSessionEnd, resetSessionState } from '../src/handlers/sessionHandlers.js';
import { handleMessageUpdatedOrCreated, handleMessagePartDelta } from '../src/handlers/messageHandlers.js';

jest.mock('../src/handlers/lifecycle.js', () => ({
  isDestroyed: () => false
}));

jest.mock('../src/modules/sessionGuidance.js', () => ({
  getSessionGuidance: jest.fn().mockResolvedValue(null)
}));

jest.mock('../src/modules/saveContext.js', () => ({
  saveContext: jest.fn().mockResolvedValue('/mock/path.md'),
  ensureHierarchicalDir: jest.fn().mockResolvedValue({
    dirPath: '/mock/dir',
    year: 2024,
    month: '01',
    week: 'W01',
    day: '01'
  }),
  extractSessionSummary: jest.fn().mockReturnValue({
    sessionId: 'test',
    messageCount: 1,
    messages: [{ index: 0, role: 'user', content: 'test' }]
  })
}));

jest.mock('../src/modules/remoteSync.js', () => ({
  syncToRemote: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/config.js', () => ({
  getConfig: jest.fn().mockReturnValue({})
}));

describe('stress concurrency', () => {
  let sessionState;

  beforeEach(async () => {
    sessionState = new SessionState();
    jest.clearAllMocks();
  });

  describe('HD-01: burst of events', () => {
    it('handles burst of 100 concurrent session operations', async () => {
      const ops = [];
      for (let i = 0; i < 100; i++) {
        ops.push(sessionState.createSession({ sessionId: `session-${i}` }));
      }
      await Promise.all(ops);
      
      const sessionId = sessionState.getCurrentSessionId();
      expect(sessionId).toMatch(/^session-\d+$/);
      expect(sessionState.getHasInjectedContext()).toBe(false);
    });

    it('handles burst of 500 concurrent message additions', async () => {
      await sessionState.createSession({ sessionId: 'burst-test' });
      
      const ops = [];
      for (let i = 0; i < 500; i++) {
        ops.push(sessionState.addMessage(`msg-${i}`, i % 2 === 0 ? 'user' : 'assistant'));
      }
      const results = await Promise.all(ops);
      
      const added = results.filter(r => r.added);
      expect(added.length).toBe(500);
      
      const session = await sessionState.getClonedSession();
      expect(session.messages.length).toBe(500);
      
      const ids = session.messages.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(500);
    });

    it('handles burst of 1000 concurrent delta appends without corruption', async () => {
      await sessionState.createSession({ sessionId: 'delta-burst' });
      await sessionState.addMessage('msg-1', 'assistant');
      
      const ops = [];
      for (let i = 0; i < 1000; i++) {
        ops.push(sessionState.appendDelta('msg-1', `${i}|`));
      }
      await Promise.all(ops);
      
      const msg = await sessionState.findMessage('msg-1');
      expect(msg.content).toBeDefined();
      
      const parts = msg.content.split('|').filter(p => p !== '');
      expect(parts.length).toBe(1000);
      
      const nums = parts.map(Number).sort((a, b) => a - b);
      expect(nums[0]).toBe(0);
      expect(nums[999]).toBe(999);
    });
  });

  describe('HD-01: interleaved events', () => {
    it('handles interleaved session + message events', async () => {
      await sessionState.createSession({ sessionId: 'interleave-test' });
      
      const ops = [];
      for (let i = 0; i < 50; i++) {
        ops.push(sessionState.addMessage(`msg-${i}`, 'user'));
        ops.push(sessionState.appendDelta(`msg-${i}`, `content-${i}`));
      }
      
      await Promise.all(ops);
      
      const session = await sessionState.getClonedSession();
      expect(session.messages.length).toBe(50);
      
      for (let i = 0; i < 50; i++) {
        const msg = session.messages.find(m => m.id === `msg-${i}`);
        expect(msg).toBeDefined();
        expect(msg.content).toContain(`${i}`);
      }
    });

    it('handles mixed create/update/reset operations', async () => {
      const ops = [];
      
      for (let cycle = 0; cycle < 10; cycle++) {
        ops.push(
          sessionState.createSession({ sessionId: `cycle-${cycle}` })
            .then(() => sessionState.addMessage(`msg-${cycle}`, 'user'))
            .then(() => sessionState.updateMessage(`msg-${cycle}`, { content: `cycle-${cycle}` }))
        );
      }
      
      await Promise.all(ops);
      
      const sessionId = sessionState.getCurrentSessionId();
      expect(sessionId).toMatch(/^cycle-\d+$/);
      
      const session = await sessionState.getClonedSession();
      expect(session.messages.length).toBeGreaterThan(0);
    });

    it('handles concurrent find operations during modifications', async () => {
      await sessionState.createSession({ sessionId: 'find-test' });
      
      const writerOps = [];
      const readerOps = [];
      
      for (let i = 0; i < 100; i++) {
        writerOps.push(sessionState.addMessage(`msg-${i}`, 'user'));
        writerOps.push(sessionState.updateMessage(`msg-${i}`, { content: `test-${i}` }));
        
        readerOps.push(sessionState.findMessage(`msg-${i % 20}`));
      }
      
      const [, reads] = await Promise.all([
        Promise.all(writerOps),
        Promise.all(readerOps)
      ]);
      
      const found = reads.filter(r => r !== null);
      expect(found.length).toBeGreaterThan(0);
    });
  });

  describe('HD-01: rapid cycles', () => {
    it('no deadlock under rapid create/destroy cycles', async () => {
      const start = Date.now();
      
      for (let i = 0; i < 20; i++) {
        await sessionState.createSession({ sessionId: `cycle-${i}` });
        await sessionState.addMessage(`msg-${i}`, 'user');
        await sessionState.reset();
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
      
      expect(sessionState.getCurrentSessionId()).toBeNull();
      expect(sessionState.getLastSession()).toBeNull();
    });

    it('handles rapid session switches with state preservation', async () => {
      await sessionState.createSession({ sessionId: 'switch-session' });
      
      for (let i = 0; i < 10; i++) {
        await sessionState.addMessage(`msg-${i}`, 'user');
        await sessionState.updateMessage(`msg-${i}`, { tokens: i * 100 });
        
        const session = await sessionState.getClonedSession();
        expect(session.messages.length).toBe(i + 1);
      }
      
      const finalSession = await sessionState.getClonedSession();
      expect(finalSession.messages.length).toBe(10);
    });

    it('maintains lock integrity under high contention', async () => {
      await sessionState.createSession({ sessionId: 'lock-test' });
      
      const contentionOps = [];
      const results = [];
      
      for (let i = 0; i < 200; i++) {
        contentionOps.push(
          sessionState.addMessage(`msg-${i}`, 'user')
            .then(r => results.push({ type: 'add', seq: i, ...r }))
        );
      }
      
      await Promise.all(contentionOps);
      
      const sortedBySeq = results.sort((a, b) => a.seq - b.seq);
      const totals = sortedBySeq.map(r => r.total);
      
      for (let i = 0; i < totals.length - 1; i++) {
        expect(totals[i + 1]).toBeGreaterThanOrEqual(totals[i]);
      }
      
      const finalSession = await sessionState.getClonedSession();
      expect(finalSession.messages.length).toBe(200);
    });
  });

  describe('HD-01: state integrity', () => {
    it('no state corruption under mixed operations', async () => {
      await sessionState.createSession({ sessionId: 'corrupt-test' });
      
      const operations = [];
      
      operations.push(sessionState.setHasInjectedContext(true));
      operations.push(sessionState.setHasInjectedContext(false));
      operations.push(sessionState.setHasInjectedContext(true));
      
      for (let i = 0; i < 50; i++) {
        operations.push(sessionState.addMessage(`msg-${i}`, 'user'));
        operations.push(sessionState.appendDelta(`msg-${i}`, `delta-${i}`));
        operations.push(sessionState.updateMessage(`msg-${i}`, { extra: `extra-${i}` }));
      }
      
      operations.push(sessionState.updateSession({ metadata: 'test' }));
      
      await Promise.all(operations);
      
      const session = await sessionState.getClonedSession();
      expect(session.messages.length).toBe(50);
      expect(session.metadata).toBe('test');
      
      for (const msg of session.messages) {
        expect(msg.id).toBeDefined();
        expect(msg.role).toBeDefined();
        expect(msg.content).toBeDefined();
      }
    });

    it('preserves message order under concurrent additions', async () => {
      await sessionState.createSession({ sessionId: 'order-test' });
      
      const addOps = [];
      for (let i = 0; i < 100; i++) {
        addOps.push(sessionState.addMessage(`msg-${i}`, 'user'));
      }
      
      const results = await Promise.all(addOps);
      const totals = results.map(r => r.total);
      
      const maxTotals = Math.max(...totals);
      expect(maxTotals).toBe(100);
      
      const session = await sessionState.getClonedSession();
      expect(session.messages.length).toBe(100);
    });

    it('handles duplicate message IDs gracefully under burst', async () => {
      await sessionState.createSession({ sessionId: 'dup-test' });
      
      const ops = [];
      for (let i = 0; i < 100; i++) {
        ops.push(sessionState.addMessage('same-id', 'user'));
      }
      
      const results = await Promise.all(ops);
      
      const addedCount = results.filter(r => r.added === true).length;
      const skippedCount = results.filter(r => r.added === false).length;
      
      expect(addedCount).toBe(1);
      expect(skippedCount).toBe(99);
      
      const session = await sessionState.getClonedSession();
      expect(session.messages.length).toBe(1);
      expect(session.messages[0].id).toBe('same-id');
    });
  });
});