/**
 * Mock OpenCode Client API for Testing
 * Provides realistic session data for unit and integration tests
 */

/**
 * Mock Message class
 */
export class MockMessage {
  constructor({ id, role = 'user', type = 'text', content = '' }) {
    this.id = id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.role = role;
    this.type = type;
    this.content = content;
  }

  toJSON() {
    return {
      id: this.id,
      role: this.role,
      type: this.type,
      content: this.content
    };
  }
}

/**
 * Mock Session class
 */
export class MockSession {
  constructor({ id = 'test-session-id', slug = 'test-session', title = 'Test Session', messages = [] }) {
    this.id = id;
    this.sessionID = id;
    this.slug = slug;
    this.title = title;
    this.messages = messages;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Create a session with specific message count for performance testing
   */
  static withMessageCount(count, baseId = 'perf-session') {
    const messages = [];
    for (let i = 0; i < count; i++) {
      messages.push(new MockMessage({
        id: `${baseId}-msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        type: 'text',
        content: `Message content ${i} - Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
      }));
    }
    return new MockSession({
      id: baseId,
      slug: `perf-test-${Date.now()}`,
      title: `Performance Test Session with ${count} messages`,
      messages
    });
  }

  /**
   * Create a session with specific ID for deduplication testing
   */
  static withId(sessionId, messageCount = 5) {
    const messages = [];
    for (let i = 0; i < messageCount; i++) {
      messages.push(new MockMessage({
        id: `${sessionId}-msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        type: 'text',
        content: `Test message ${i}`
      }));
    }
    return new MockSession({
      id: sessionId,
      slug: `session-${sessionId}`,
      title: `Session ${sessionId}`,
      messages
    });
  }

  toJSON() {
    return {
      id: this.id,
      sessionID: this.sessionID,
      slug: this.slug,
      title: this.title,
      messages: this.messages.map(m => m.toJSON ? m.toJSON() : m),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

/**
 * Create a mock OpenCode client with configurable session data
 * @param {Object} options - Configuration options
 * @param {Object} options.sessionData - Default session data to return
 * @returns {Object} Mock client with sessions.get() method
 */
export function createMockClient(options = {}) {
  const defaultSession = new MockSession({
    id: 'default-session-id',
    slug: 'default-session',
    title: 'Default Test Session',
    messages: Array.from({ length: 5 }, (_, i) => new MockMessage({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      type: 'text',
      content: `Message ${i} content`
    }))
  });

  // Call log for verification
  const callLog = [];

  const client = {
    sessions: {
      get: async (sessionId) => {
        callLog.push({ method: 'sessions.get', args: [sessionId], timestamp: Date.now() });

        // If custom session data provided for this ID, return it
        if (options.sessionData) {
          if (typeof options.sessionData === 'function') {
            return options.sessionData(sessionId);
          }
          if (options.sessionData.id === sessionId || options.sessionData.sessionID === sessionId) {
            return options.sessionData;
          }
        }

        // Return default session with the requested ID if specified
        if (sessionId && sessionId !== 'default-session-id') {
          return MockSession.withId(sessionId);
        }

        return defaultSession;
      }
    },
    // Expose call log for test verification
    _getCallLog: () => [...callLog],
    _clearCallLog: () => callLog.length = 0
  };

  return client;
}

export default { createMockClient, MockSession, MockMessage };
