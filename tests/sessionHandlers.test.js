import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('../src/handlers/lifecycle.js', () => ({
  isDestroyed: jest.fn(() => false),
  setDestroyed: jest.fn(),
  destroy: jest.fn(async () => { }),
  init: jest.fn(async () => { })
}));

jest.unstable_mockModule('../src/modules/saveContext.js', () => ({
  saveContext: jest.fn().mockResolvedValue('/path')
}));

jest.unstable_mockModule('../src/modules/remoteSync.js', () => ({
  syncToRemote: jest.fn().mockResolvedValue({})
}));

jest.unstable_mockModule('../src/modules/sessionGuidance.js', () => ({
  getSessionGuidance: jest.fn().mockResolvedValue(null)
}));

jest.unstable_mockModule('../src/config.js', () => ({
  getConfig: jest.fn(() => ({ debug: false, remoteSync: { enabled: true } })),
  CONTEXT_SESSION_DIR: '.opencode/context-session'
}));

jest.unstable_mockModule('../src/utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => jest.fn()),
  DEBUG_KEY: 'context-plugin'
}));

jest.unstable_mockModule('../src/handlers/sessionState.js', () => {
  class MockSessionState {
    constructor() {
      this._currentSessionId = null;
      this._hasInjectedContext = false;
      this._lastSession = null;
    }

    getCurrentSessionId() { return this._currentSessionId; }
    setCurrentSessionId(v) { this._currentSessionId = v; }
    getHasInjectedContext() { return this._hasInjectedContext; }
    setHasInjectedContext(v) { this._hasInjectedContext = v; }
    getLastSession() { return this._lastSession; }
    setLastSession(v) { this._lastSession = v; }

    async createSession(event) {
      this._currentSessionId = event?.sessionId || event?.sessionID || event?.session?.id;
      this._hasInjectedContext = false;
      this._lastSession = null;
    }

    async updateSession(info) {
      if (!this._lastSession) this._lastSession = {};
      Object.assign(this._lastSession, info);
    }

    async getClonedSession() {
      return this._lastSession ? JSON.parse(JSON.stringify(this._lastSession)) : null;
    }

    async reset() {
      this._currentSessionId = null;
      this._hasInjectedContext = false;
      this._lastSession = null;
    }
  }

  const state = new MockSessionState();
  return { sessionState: state };
});

const {
  getCurrentSessionId,
  setCurrentSessionId,
  getHasInjectedContext,
  setHasInjectedContext,
  getLastSession,
  setLastSession,
  resetSessionState,
  handleSessionCreated,
  handleSessionUpdated,
  handleSessionEnd,
  handleSessionIdle,
  handleSessionCompacted
} = await import('../src/handlers/sessionHandlers.js');

const { saveContext } = await import('../src/modules/saveContext.js');
const { syncToRemote } = await import('../src/modules/remoteSync.js');
const { getSessionGuidance } = await import('../src/modules/sessionGuidance.js');
const { getConfig } = await import('../src/config.js');
const { sessionState } = await import('../src/handlers/sessionState.js');
const { isDestroyed, setDestroyed } = await import('../src/handlers/lifecycle.js');

describe('sessionHandlers', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await sessionState.reset();
  });

  describe('getters/setters', () => {
    it('should set and get currentSessionId', () => {
      setCurrentSessionId('test-id');
      expect(getCurrentSessionId()).toBe('test-id');
    });

    it('should set and get hasInjectedContext', () => {
      setHasInjectedContext(true);
      expect(getHasInjectedContext()).toBe(true);
    });

    it('should set and get lastSession', () => {
      const session = { id: 's1', messages: [] };
      setLastSession(session);
      expect(getLastSession()).toEqual(session);
    });
  });

  describe('handleSessionCreated', () => {
    it('should set session ID and reset injected context', async () => {
      const event = { sessionId: 'session-123' };

      await handleSessionCreated(event, '/tmp');

      expect(getCurrentSessionId()).toBe('session-123');
      expect(getHasInjectedContext()).toBe(false);
    });

    it('should call getSessionGuidance with correct args', async () => {
      const event = { sessionId: 'session-456', title: 'Test' };

      await handleSessionCreated(event, '/work/dir');

      expect(getSessionGuidance).toHaveBeenCalledWith('/work/dir', {
        id: 'session-456',
        sessionId: 'session-456',
        title: 'Test'
      });
    });

    it('should fall back to event.session.id when sessionId is missing', async () => {
      const event = { session: { id: 'nested-id' } };

      await handleSessionCreated(event, '/tmp');

      expect(getCurrentSessionId()).toBe('nested-id');
    });
  });

  describe('handleSessionUpdated', () => {
    it('should merge session info when event has properties.info', async () => {
      setLastSession({ id: 's1', messages: [] });

      await handleSessionUpdated({ properties: { info: { title: 'Updated' } } });

      expect(getLastSession().title).toBe('Updated');
    });

    it('should do nothing when event has no properties.info', async () => {
      setLastSession({ id: 's1' });
      const before = getLastSession();

      await handleSessionUpdated({});

      expect(getLastSession()).toEqual(before);
    });
  });

  describe('handleSessionEnd', () => {
    it('should call saveContext with deep-cloned session', async () => {
      const session = { id: 'exit-session', messages: [{ id: 'm1', role: 'user', content: 'hi' }] };
      setLastSession(session);
      const config = { remoteSync: { enabled: false } };

      await handleSessionEnd('/dir', null, config);

      expect(saveContext).toHaveBeenCalledWith('/dir', session, 'exit', null);

      const savedArg = saveContext.mock.calls[0][1];
      expect(savedArg).toEqual(session);
      expect(savedArg).not.toBe(session);
    });

    it('should sync to remote when config.remoteSync.enabled is true', async () => {
      setLastSession({ id: 's1', messages: [] });
      const config = { remoteSync: { enabled: true } };

      await handleSessionEnd('/dir', null, config);

      expect(syncToRemote).toHaveBeenCalledWith('/dir');
    });

    it('should not fail when lastSession is null', async () => {
      const config = { remoteSync: { enabled: false } };

      await expect(handleSessionEnd('/dir', null, config)).resolves.toBeUndefined();

      expect(saveContext).not.toHaveBeenCalled();
    });
  });

  describe('handleSessionIdle', () => {
    it('should handle missing client gracefully', async () => {
      await expect(handleSessionIdle('/dir', null, 'session-idle')).resolves.toBeUndefined();
    });

    it('should handle client without sessions property gracefully', async () => {
      const client = {};

      await expect(handleSessionIdle('/dir', client, 'session-idle')).resolves.toBeUndefined();
    });
  });

  describe('handleSessionCompacted', () => {
    it('should call saveContext with type compact', async () => {
      const session = { id: 'compact-session', messages: [] };
      setLastSession(session);

      await handleSessionCompacted('/dir', 'client');

      expect(saveContext).toHaveBeenCalledWith('/dir', session, 'compact', 'client');
    });

    it('should handle missing lastSession gracefully', async () => {
      await handleSessionCompacted('/dir', 'client');

      expect(saveContext).not.toHaveBeenCalled();
    });

    it('should trigger remote sync when enabled in config', async () => {
      setLastSession({ id: 's1', messages: [] });

      await handleSessionCompacted('/dir', 'client');

      expect(syncToRemote).toHaveBeenCalledWith('/dir');
    });
  });

  describe('resetSessionState', () => {
    it('should clear all state', async () => {
      setCurrentSessionId('old-id');
      setHasInjectedContext(true);
      setLastSession({ id: 'old' });

      await resetSessionState();

      expect(getCurrentSessionId()).toBeNull();
      expect(getHasInjectedContext()).toBe(false);
      expect(getLastSession()).toBeNull();
    });

    it('should be idempotent - safe to call multiple times', async () => {
      setCurrentSessionId('session-id');
      setHasInjectedContext(true);
      setLastSession({ id: 'session' });

      await resetSessionState();
      await resetSessionState();
      await resetSessionState();

      expect(getCurrentSessionId()).toBeNull();
      expect(getHasInjectedContext()).toBe(false);
      expect(getLastSession()).toBeNull();
    });

    it('should work when state is already null', async () => {
      await sessionState.reset();

      await expect(resetSessionState()).resolves.toBeUndefined();
      expect(getCurrentSessionId()).toBeNull();
    });
  });

  describe('lifecycle guards', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      await sessionState.reset();
      isDestroyed.mockReturnValue(false);
    });

    it('handleSessionCreated returns early after destroy', async () => {
      isDestroyed.mockReturnValue(true);
      const result = await handleSessionCreated({ sessionId: 'test-session' }, '/tmp');
      expect(result).toBeUndefined();
      expect(getCurrentSessionId()).toBeNull();
    });

    it('handleSessionUpdated returns early after destroy', async () => {
      setLastSession({ id: 's1', messages: [] });
      isDestroyed.mockReturnValue(true);
      await handleSessionUpdated({ properties: { info: { title: 'Updated' } } });
      expect(getLastSession().title).toBeUndefined();
    });

    it('handleSessionEnd returns early after destroy', async () => {
      setLastSession({ id: 's1', messages: [] });
      isDestroyed.mockReturnValue(true);
      await handleSessionEnd('/dir', null, { remoteSync: { enabled: false } });
      expect(saveContext).not.toHaveBeenCalled();
    });

    it('handleSessionIdle returns early after destroy', async () => {
      isDestroyed.mockReturnValue(true);
      await handleSessionIdle('/dir', { sessions: {} }, 'session-id');
    });

    it('handleSessionCompacted returns early after destroy', async () => {
      setLastSession({ id: 's1', messages: [] });
      isDestroyed.mockReturnValue(true);
      await handleSessionCompacted('/dir', 'client');
      expect(saveContext).not.toHaveBeenCalled();
    });
  });
});
