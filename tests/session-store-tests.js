/**
 * Tests for SessionStore
 * Since IndexedDB is not available in Node, we test the in-memory fallback paths,
 * constructor defaults, session CRUD, serialization, and utility functions.
 */

import { TestRunner, assert, assertEqual } from './test-helpers.js';
import { SessionStore } from '../src/core/session-store.js';
import { EventBus } from '../src/core/event-bus.js';

export async function runSessionStoreTests() {
  console.log('Session Store Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // CONSTRUCTOR DEFAULTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - Constructor');

  TestRunner.test('should create with default eventBus', () => {
    const store = new SessionStore();
    assert(store.eventBus !== null, 'eventBus should not be null');
  });

  TestRunner.test('should accept custom eventBus', () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    assertEqual(store.eventBus, bus, 'Should use the provided eventBus');
  });

  TestRunner.test('should initialize with null db', () => {
    const store = new SessionStore();
    assertEqual(store.db, null, 'db should be null');
  });

  TestRunner.test('should initialize with empty sessions map', () => {
    const store = new SessionStore();
    assert(store.sessions instanceof Map, 'sessions should be a Map');
    assertEqual(store.sessions.size, 0, 'sessions should be empty');
  });

  TestRunner.test('should initialize with empty messages map', () => {
    const store = new SessionStore();
    assert(store.messages instanceof Map, 'messages should be a Map');
    assertEqual(store.messages.size, 0, 'messages should be empty');
  });

  TestRunner.test('should initialize as not initialized', () => {
    const store = new SessionStore();
    assertEqual(store.initialized, false, 'initialized should be false');
  });

  TestRunner.test('should initialize _initPromise as null', () => {
    const store = new SessionStore();
    assertEqual(store._initPromise, null, '_initPromise should be null');
  });

  // ─────────────────────────────────────────────────────────────────
  // INIT (graceful fallback without IndexedDB)
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - init()');

  await TestRunner.testAsync('should resolve when indexedDB is undefined', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();
    assertEqual(store.initialized, true, 'Should be initialized after init()');
    assertEqual(store.db, null, 'db should remain null without indexedDB');
  });

  await TestRunner.testAsync('should not re-initialize if already initialized', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();
    assertEqual(store.initialized, true, 'First init');

    // Call init again -- should resolve immediately
    await store.init();
    assertEqual(store.initialized, true, 'Should still be initialized');
  });

  await TestRunner.testAsync('concurrent init calls should not error', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    // Fire two concurrent inits
    await Promise.all([store.init(), store.init()]);
    assertEqual(store.initialized, true, 'Should be initialized after concurrent inits');
  });

  // ─────────────────────────────────────────────────────────────────
  // METHOD EXISTENCE
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - method existence');

  TestRunner.test('should have getSession method', () => {
    const store = new SessionStore();
    assert(typeof store.getSession === 'function', 'getSession should be a function');
  });

  TestRunner.test('should have listSessions method', () => {
    const store = new SessionStore();
    assert(typeof store.listSessions === 'function', 'listSessions should be a function');
  });

  TestRunner.test('should have deleteSession method', () => {
    const store = new SessionStore();
    assert(typeof store.deleteSession === 'function', 'deleteSession should be a function');
  });

  TestRunner.test('should have createSession method', () => {
    const store = new SessionStore();
    assert(typeof store.createSession === 'function', 'createSession should be a function');
  });

  TestRunner.test('should have updateSession method', () => {
    const store = new SessionStore();
    assert(typeof store.updateSession === 'function', 'updateSession should be a function');
  });

  TestRunner.test('should have exportSession method', () => {
    const store = new SessionStore();
    assert(typeof store.exportSession === 'function', 'exportSession should be a function');
  });

  TestRunner.test('should have importSession method', () => {
    const store = new SessionStore();
    assert(typeof store.importSession === 'function', 'importSession should be a function');
  });

  TestRunner.test('should have recordMessage method', () => {
    const store = new SessionStore();
    assert(typeof store.recordMessage === 'function', 'recordMessage should be a function');
  });

  TestRunner.test('should have saveSnapshot method', () => {
    const store = new SessionStore();
    assert(typeof store.saveSnapshot === 'function', 'saveSnapshot should be a function');
  });

  TestRunner.test('should have loadSnapshot method', () => {
    const store = new SessionStore();
    assert(typeof store.loadSnapshot === 'function', 'loadSnapshot should be a function');
  });

  // ─────────────────────────────────────────────────────────────────
  // CREATE SESSION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - createSession');

  await TestRunner.testAsync('should create a session with defaults', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    assert(session.id !== undefined, 'Session should have an id');
    assert(session.title.startsWith('Session '), 'Default title should start with Session');
    assertEqual(session.status, 'idle', 'Default status should be idle');
    assert(typeof session.createdAt === 'number', 'createdAt should be a number');
    assert(typeof session.updatedAt === 'number', 'updatedAt should be a number');
  });

  await TestRunner.testAsync('should create a session with custom options', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({
      title: 'My Test Session',
      parameters: { speed: 5 },
      cwd: '/test/path'
    });

    assertEqual(session.title, 'My Test Session', 'Title should match');
    assertEqual(session.parameters.speed, 5, 'Parameters should match');
    assertEqual(session.cwd, '/test/path', 'cwd should match');
  });

  await TestRunner.testAsync('should emit SESSION_CREATE event', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    let emittedEvent = null;
    bus.on('session.create', (event) => { emittedEvent = event; });

    await store.createSession({ title: 'Event Test' });
    assert(emittedEvent !== null, 'Should emit session.create event');
    assert(emittedEvent.payload.session !== undefined, 'Payload should have session');
  });

  await TestRunner.testAsync('should store session in sessions map', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    const retrieved = store.getSession(session.id);
    assertEqual(retrieved.id, session.id, 'Should retrieve same session by id');
  });

  // ─────────────────────────────────────────────────────────────────
  // GET / LIST SESSIONS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - getSession / listSessions');

  await TestRunner.testAsync('should return undefined for non-existent session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = store.getSession('nonexistent-id');
    assertEqual(result, undefined, 'Should return undefined for unknown id');
  });

  await TestRunner.testAsync('should list sessions sorted by updatedAt desc', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    await store.createSession({ title: 'First' });
    await store.createSession({ title: 'Second' });
    await store.createSession({ title: 'Third' });

    const list = store.listSessions();
    assertEqual(list.length, 3, 'Should have 3 sessions');
    // Most recent should be first
    assert(list[0].updatedAt >= list[1].updatedAt, 'Should be sorted by updatedAt descending');
    assert(list[1].updatedAt >= list[2].updatedAt, 'Should be sorted by updatedAt descending');
  });

  // ─────────────────────────────────────────────────────────────────
  // UPDATE SESSION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - updateSession');

  await TestRunner.testAsync('should update session properties', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({ title: 'Original' });
    const updated = await store.updateSession(session.id, { title: 'Updated' });

    assertEqual(updated.title, 'Updated', 'Title should be updated');
    assert(updated.updatedAt >= session.updatedAt, 'updatedAt should be refreshed');
  });

  await TestRunner.testAsync('should return null for non-existent session update', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = await store.updateSession('nonexistent', { title: 'x' });
    assertEqual(result, null, 'Should return null for unknown id');
  });

  // ─────────────────────────────────────────────────────────────────
  // DELETE SESSION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - deleteSession');

  await TestRunner.testAsync('should delete an existing session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    const result = await store.deleteSession(session.id);

    assertEqual(result, true, 'Should return true on successful delete');
    assertEqual(store.getSession(session.id), undefined, 'Session should no longer exist');
  });

  await TestRunner.testAsync('should return false for deleting non-existent session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = await store.deleteSession('nonexistent');
    assertEqual(result, false, 'Should return false for unknown id');
  });

  await TestRunner.testAsync('should emit SESSION_DELETE event', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    let emittedEvent = null;
    bus.on('session.delete', (event) => { emittedEvent = event; });

    const session = await store.createSession();
    await store.deleteSession(session.id);

    assert(emittedEvent !== null, 'Should emit session.delete event');
    assertEqual(emittedEvent.payload.sessionId, session.id, 'Payload should have sessionId');
  });

  // ─────────────────────────────────────────────────────────────────
  // RECORD / GET MESSAGES (in-memory fallback)
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - recordMessage (in-memory)');

  await TestRunner.testAsync('should record message in memory when no db', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    const record = await store.recordMessage(session.id, { role: 'user', text: 'hello' });

    assert(record.id !== undefined, 'Record should have an id');
    assertEqual(record.sessionId, session.id, 'Record should reference session');
    assertEqual(record.data.text, 'hello', 'Record data should match');
  });

  await TestRunner.testAsync('should retrieve messages via getSessionHistory', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    await store.recordMessage(session.id, { text: 'msg1' });
    await store.recordMessage(session.id, { text: 'msg2' });

    const history = await store.getSessionHistory(session.id);
    assert(history !== null, 'History should not be null');
    assertEqual(history.messages.length, 2, 'Should have 2 messages');
    assertEqual(history.messages[0].text, 'msg1', 'First message should match');
    assertEqual(history.messages[1].text, 'msg2', 'Second message should match');
  });

  await TestRunner.testAsync('getSessionHistory returns null for unknown session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = await store.getSessionHistory('nonexistent');
    assertEqual(result, null, 'Should return null for unknown session');
  });

  // ─────────────────────────────────────────────────────────────────
  // EXPORT / IMPORT SESSION FORMAT
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - exportSession / importSession');

  await TestRunner.testAsync('exportSession should return correct format', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({ title: 'Export Test' });
    await store.recordMessage(session.id, { text: 'test message' });

    const exported = await store.exportSession(session.id);
    assertEqual(exported.version, '1.0', 'Should have version 1.0');
    assert(typeof exported.exportedAt === 'string', 'exportedAt should be a string');
    assert(exported.session !== undefined, 'Should have session data');
    assert(Array.isArray(exported.messages), 'messages should be an array');
    assertEqual(exported.messages.length, 1, 'Should have 1 message');
  });

  await TestRunner.testAsync('exportSession returns null for unknown session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = await store.exportSession('nonexistent');
    assertEqual(result, null, 'Should return null for unknown session');
  });

  await TestRunner.testAsync('importSession should create a new session from exported data', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const original = await store.createSession({ title: 'Original' });
    await store.recordMessage(original.id, { text: 'msg1' });
    const exported = await store.exportSession(original.id);

    const imported = await store.importSession(exported);
    assert(imported.id !== original.id, 'Imported session should have a new id');
    assert(imported.title.includes('(imported)'), 'Imported title should have (imported) suffix');
  });

  await TestRunner.testAsync('importSession should throw for invalid data', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    let threw = false;
    try {
      await store.importSession({});
    } catch (e) {
      threw = true;
      assert(e.message.includes('Invalid session data'), 'Should mention invalid data');
    }
    assert(threw, 'Should throw for data without session field');
  });

  await TestRunner.testAsync('importSession should import messages', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const imported = await store.importSession({
      session: { title: 'Test', parameters: {} },
      messages: [
        { data: { text: 'msg1' } },
        { data: { text: 'msg2' } }
      ]
    });

    const history = await store.getSessionHistory(imported.id);
    assertEqual(history.messages.length, 2, 'Should import 2 messages');
  });

  // ─────────────────────────────────────────────────────────────────
  // SNAPSHOT SAVE / LOAD
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - saveSnapshot / loadSnapshot');

  await TestRunner.testAsync('should save and load a snapshot', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    const snapshot = { parameters: { speed: 10 }, state: 'running' };

    await store.saveSnapshot(session.id, snapshot);
    const loaded = await store.loadSnapshot(session.id);

    assertEqual(loaded.parameters.speed, 10, 'Loaded snapshot should match saved');
    assertEqual(loaded.state, 'running', 'Loaded state should match');
  });

  await TestRunner.testAsync('saveSnapshot returns null for unknown session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = await store.saveSnapshot('nonexistent', {});
    assertEqual(result, null, 'Should return null for unknown session');
  });

  await TestRunner.testAsync('loadSnapshot returns null for unknown session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const result = await store.loadSnapshot('nonexistent');
    assertEqual(result, null, 'Should return null for unknown session');
  });

  await TestRunner.testAsync('loadSnapshot returns null when no snapshot saved', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    const result = await store.loadSnapshot(session.id);
    assertEqual(result, null, 'Should return null when no snapshot exists');
  });

  // ─────────────────────────────────────────────────────────────────
  // SANITIZE SESSION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - sanitizeSession');

  await TestRunner.testAsync('sanitizeSession should strip internal fields', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({
      title: 'Sanitize Test',
      parameters: { speed: 5 }
    });

    const sanitized = store.sanitizeSession(session);
    assert(sanitized.id !== undefined, 'Should keep id');
    assert(sanitized.title !== undefined, 'Should keep title');
    assert(sanitized.status !== undefined, 'Should keep status');
    assertEqual(sanitized.parameters, undefined, 'Should strip parameters');
    assertEqual(sanitized.stateMachine, undefined, 'Should strip stateMachine');
    assertEqual(sanitized.hasSnapshot, false, 'hasSnapshot should be false');
  });

  await TestRunner.testAsync('sanitizeSession hasSnapshot should be true when snapshot exists', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    await store.saveSnapshot(session.id, { data: 'test' });

    const sanitized = store.sanitizeSession(store.getSession(session.id));
    assertEqual(sanitized.hasSnapshot, true, 'hasSnapshot should be true');
  });

  // ─────────────────────────────────────────────────────────────────
  // GENERATE ID
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - generateId');

  TestRunner.test('should generate unique IDs', () => {
    const store = new SessionStore();
    const id1 = store.generateId();
    const id2 = store.generateId();
    assert(typeof id1 === 'string', 'ID should be a string');
    assert(id1.length > 0, 'ID should not be empty');
    assert(id1 !== id2, 'IDs should be unique');
  });

  TestRunner.test('generated ID should contain a dash', () => {
    const store = new SessionStore();
    const id = store.generateId();
    assert(id.includes('-'), 'ID should contain a dash separator');
  });

  // ─────────────────────────────────────────────────────────────────
  // LIST RECENT CWDS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - listRecentCwds');

  await TestRunner.testAsync('should list recent working directories', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    await store.createSession({ cwd: '/path/a' });
    await store.createSession({ cwd: '/path/b' });
    await store.createSession({ cwd: null });

    const cwds = store.listRecentCwds();
    assertEqual(cwds.length, 2, 'Should have 2 unique cwds');
    assert(cwds.includes('/path/a'), 'Should include /path/a');
    assert(cwds.includes('/path/b'), 'Should include /path/b');
  });

  await TestRunner.testAsync('should respect limit parameter', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    for (let i = 0; i < 5; i++) {
      await store.createSession({ cwd: `/path/${i}` });
    }

    const cwds = store.listRecentCwds(2);
    assertEqual(cwds.length, 2, 'Should respect limit');
  });

  // ─────────────────────────────────────────────────────────────────
  // DELETE CLEANS UP MESSAGES
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - delete cleanup');

  await TestRunner.testAsync('delete should clean up in-memory messages', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession();
    await store.recordMessage(session.id, { text: 'test' });
    assert(store.messages.has(session.id), 'Messages should exist before delete');

    await store.deleteSession(session.id);
    assertEqual(store.messages.has(session.id), false, 'Messages should be cleaned up after delete');
  });

  return TestRunner.summary();
}
