/**
 * Session Store - IndexedDB persistence for animation sessions
 * Inspired by Claude-Cowork's SQLite session-store pattern
 */

import { EventTypes, globalEventBus } from './event-bus.js';

const DB_NAME = 'wfl-animator';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const MESSAGES_STORE = 'messages';

export class SessionStore {
  constructor(eventBus = globalEventBus) {
    this.eventBus = eventBus;
    this.db = null;
    this.sessions = new Map();
    this.messages = new Map(); // In-memory message storage
    this.initialized = false;
    this._initPromise = null;
  }

  /**
   * Initialize the database
   */
  async init() {
    if (this.initialized) return;

    // Prevent race condition on concurrent init() calls
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  async _doInit() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        this.initialized = true;
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        this.loadSessions().then(resolve).catch(reject);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Sessions store
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
          sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          sessionsStore.createIndex('title', 'title', { unique: false });
        }

        // Messages store (for session history)
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          messagesStore.createIndex('sessionId', 'sessionId', { unique: false });
          messagesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * Create a new session
   */
  async createSession(options = {}) {
    const id = this.generateId();
    const now = Date.now();

    const session = {
      id,
      title: options.title || `Session ${new Date().toLocaleString()}`,
      status: 'idle',
      parameters: options.parameters || {},
      stateMachine: options.stateMachine || null,
      cwd: options.cwd || null,
      createdAt: now,
      updatedAt: now
    };

    this.sessions.set(id, session);
    await this.persistSession(session);

    this.eventBus.emit({
      type: EventTypes.SESSION_CREATE,
      payload: { session: this.sanitizeSession(session) }
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id) {
    return this.sessions.get(id);
  }

  /**
   * List all sessions
   */
  listSessions() {
    return Array.from(this.sessions.values())
      .map(s => this.sanitizeSession(s))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * List recent working directories
   */
  listRecentCwds(limit = 8) {
    const cwds = new Map();

    this.sessions.forEach(session => {
      if (session.cwd) {
        const existing = cwds.get(session.cwd);
        if (!existing || session.updatedAt > existing) {
          cwds.set(session.cwd, session.updatedAt);
        }
      }
    });

    return Array.from(cwds.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cwd]) => cwd);
  }

  /**
   * Update a session
   */
  async updateSession(id, updates) {
    const session = this.sessions.get(id);
    if (!session) return null;

    Object.assign(session, updates, { updatedAt: Date.now() });
    await this.persistSession(session);

    return session;
  }

  /**
   * Delete a session
   */
  async deleteSession(id) {
    const session = this.sessions.get(id);
    if (!session) return false;

    this.sessions.delete(id);

    // Always clean up in-memory messages
    this.messages.delete(id);

    if (this.db) {
      await this.deleteFromStore(SESSIONS_STORE, id);
      await this.deleteMessagesBySessionId(id);
    }

    this.eventBus.emit({
      type: EventTypes.SESSION_DELETE,
      payload: { sessionId: id }
    });

    return true;
  }

  /**
   * Get session history (all recorded messages)
   */
  async getSessionHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const messages = await this.getMessagesBySessionId(sessionId);

    return {
      session: this.sanitizeSession(session),
      messages
    };
  }

  /**
   * Record a message/event for a session
   */
  async recordMessage(sessionId, message) {
    const id = message.uuid || this.generateId();
    const record = {
      id,
      sessionId,
      data: message,
      createdAt: Date.now()
    };

    if (this.db) {
      await this.saveToStore(MESSAGES_STORE, record);
    } else {
      // In-memory storage fallback
      if (!this.messages.has(sessionId)) {
        this.messages.set(sessionId, []);
      }
      this.messages.get(sessionId).push(record);
    }

    return record;
  }

  /**
   * Save session state snapshot
   */
  async saveSnapshot(sessionId, snapshot) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.snapshot = snapshot;
    session.updatedAt = Date.now();

    await this.persistSession(session);

    this.eventBus.emit({
      type: EventTypes.SESSION_SAVE,
      payload: { sessionId, snapshot }
    });

    return session;
  }

  /**
   * Load session snapshot
   */
  async loadSnapshot(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.snapshot) return null;

    this.eventBus.emit({
      type: EventTypes.SESSION_LOAD,
      payload: { sessionId, snapshot: session.snapshot }
    });

    return session.snapshot;
  }

  /**
   * Export session to JSON
   */
  async exportSession(sessionId) {
    const history = await this.getSessionHistory(sessionId);
    if (!history) return null;

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      session: history.session,
      messages: history.messages
    };
  }

  /**
   * Import session from JSON
   */
  async importSession(data) {
    if (!data.session) {
      throw new Error('Invalid session data');
    }

    const session = await this.createSession({
      title: `${data.session.title} (imported)`,
      parameters: data.session.parameters,
      stateMachine: data.session.stateMachine
    });

    // Import messages
    if (data.messages && Array.isArray(data.messages)) {
      for (const msg of data.messages) {
        await this.recordMessage(session.id, msg.data || msg);
      }
    }

    return session;
  }

  // ─────────────────────────────────────────────────────────────────
  // Private methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Load sessions from IndexedDB
   */
  async loadSessions() {
    if (!this.db) return;

    try {
      const sessions = await this.getAllFromStore(SESSIONS_STORE);
      sessions.forEach(session => {
        this.sessions.set(session.id, session);
      });
    } catch (error) {
      this.eventBus.emit({
        type: EventTypes.ERROR,
        payload: { message: `Failed to load sessions: ${error.message}`, error }
      });
    }
  }

  /**
   * Persist session to IndexedDB
   */
  async persistSession(session) {
    if (!this.db) return;
    await this.saveToStore(SESSIONS_STORE, session);
  }

  /**
   * Get messages by session ID
   */
  async getMessagesBySessionId(sessionId) {
    if (!this.db) {
      // In-memory storage fallback
      const records = this.messages.get(sessionId) || [];
      return records.map(r => r.data);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(MESSAGES_STORE, 'readonly');
      const store = tx.objectStore(MESSAGES_STORE);
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => resolve(request.result.map(r => r.data));
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete messages by session ID
   */
  async deleteMessagesBySessionId(sessionId) {
    // Clean up in-memory messages
    this.messages.delete(sessionId);

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(MESSAGES_STORE, 'readwrite');
      const store = tx.objectStore(MESSAGES_STORE);
      const index = store.index('sessionId');
      const request = index.getAllKeys(sessionId);

      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => store.delete(key));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic save to store
   */
  async saveToStore(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic get all from store
   */
  async getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generic delete from store
   */
  async deleteFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Sanitize session for external use (remove internal fields)
   */
  sanitizeSession(session) {
    return {
      id: session.id,
      title: session.title,
      status: session.status,
      cwd: session.cwd,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      hasSnapshot: !!session.snapshot
    };
  }
}

// Singleton instance
export const globalSessionStore = new SessionStore();
