export class SessionState {
  #currentSessionId = null;
  #hasInjectedContext = false;
  #lastSession = null;
  #queue = Promise.resolve();

  async #withLock(fn) {
    const prev = this.#queue;
    let nextResolve;
    this.#queue = new Promise(r => { nextResolve = r; });
    await prev;
    try {
      return await fn();
    } finally {
      nextResolve();
    }
  }

  getCurrentSessionId() {
    return this.#currentSessionId;
  }

  async setCurrentSessionId(v) {
    return this.#withLock(() => { this.#currentSessionId = v; });
  }

  getHasInjectedContext() {
    return this.#hasInjectedContext;
  }

  async setHasInjectedContext(v) {
    return this.#withLock(() => { this.#hasInjectedContext = v; });
  }

  getLastSession() {
    return this.#lastSession;
  }

  async setLastSession(v) {
    return this.#withLock(() => { this.#lastSession = v; });
  }

  async createSession(event) {
    return this.#withLock(() => {
      this.#currentSessionId = event?.sessionId || event?.sessionID || event?.session?.id;
      this.#hasInjectedContext = false;
      this.#lastSession = null;
    });
  }

  async updateSession(info) {
    return this.#withLock(() => {
      if (!this.#lastSession) this.#lastSession = {};
      Object.assign(this.#lastSession, info);
    });
  }

  async getClonedSession() {
    return this.#withLock(() => {
      return this.#lastSession ? JSON.parse(JSON.stringify(this.#lastSession)) : null;
    });
  }

  async addMessage(msgId, role) {
    return this.#withLock(() => {
      if (!this.#lastSession) this.#lastSession = { messages: [] };
      if (!this.#lastSession.messages) this.#lastSession.messages = [];
      const existing = this.#lastSession.messages.findIndex(m => m.id === msgId);
      if (existing === -1) {
        this.#lastSession.messages.push({ id: msgId, role, content: '' });
        return { added: true, total: this.#lastSession.messages.length };
      }
      return { added: false };
    });
  }

  async findMessage(msgId) {
    return this.#withLock(() => {
      if (!this.#lastSession?.messages) return null;
      return this.#lastSession.messages.find(m => m.id === msgId) || null;
    });
  }

  async appendDelta(msgId, delta) {
    return this.#withLock(() => {
      if (!this.#lastSession?.messages) return false;
      const msg = this.#lastSession.messages.find(m => m.id === msgId);
      if (!msg) return false;
      msg.content = (msg.content || '') + delta;
      return true;
    });
  }

  async updateMessageContent(msgId, text) {
    return this.#withLock(() => {
      if (!this.#lastSession?.messages) return false;
      const msg = this.#lastSession.messages.find(m => m.id === msgId);
      if (!msg || msg.content) return false;
      msg.content = text;
      return true;
    });
  }

  async updateMessage(msgId, info) {
    return this.#withLock(() => {
      if (!this.#lastSession?.messages) return false;
      const msg = this.#lastSession.messages.find(m => m.id === msgId);
      if (!msg) return false;
      Object.assign(msg, info);
      return true;
    });
  }

  async reset() {
    return this.#withLock(() => {
      this.#currentSessionId = null;
      this.#hasInjectedContext = false;
      this.#lastSession = null;
    });
  }
}

export const sessionState = new SessionState();