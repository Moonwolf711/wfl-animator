/**
 * Tests for Claude-Cowork patterns integrated into WFL Animator
 * Tests: EventBus, Streaming, Permission, SessionStore
 */

// ═══════════════════════════════════════════════════════════════════
// Test Framework
// ═══════════════════════════════════════════════════════════════════

const TestRunner = {
  passed: 0,
  failed: 0,
  errors: [],
  currentCategory: '',

  category(name) {
    this.currentCategory = name;
    console.log(`\n━━━ ${name} ━━━`);
  },

  test(name, fn) {
    try {
      fn();
      this.passed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      this.failed++;
      this.errors.push({ category: this.currentCategory, name, error: error.message });
      console.log(`  ✗ ${name}`);
      console.log(`    └─ ${error.message}`);
    }
  },

  async testAsync(name, fn) {
    try {
      await fn();
      this.passed++;
      console.log(`  ✓ ${name}`);
    } catch (error) {
      this.failed++;
      this.errors.push({ category: this.currentCategory, name, error: error.message });
      console.log(`  ✗ ${name}`);
      console.log(`    └─ ${error.message}`);
    }
  },

  summary() {
    const total = this.passed + this.failed;
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`Results: ${this.passed}/${total} passed (${Math.round(this.passed/total*100)}%)`);
    if (this.failed > 0) {
      console.log(`\nFailed tests:`);
      this.errors.forEach(e => console.log(`  - [${e.category}] ${e.name}: ${e.error}`));
    }
    console.log('═══════════════════════════════════════════════════════\n');
    return { passed: this.passed, failed: this.failed, total };
  }
};

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Import modules (dynamic import for ES modules)
// ═══════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('WFL Animator - Claude-Cowork Patterns Test Suite');
  console.log('═══════════════════════════════════════════════════════\n');

  // Import modules
  const { EventBus, EventTypes } = await import('../src/core/event-bus.js');
  const { StreamingState, StreamingAnimationLoader } = await import('../src/core/streaming.js');
  const { PermissionManager, PermissionActions, PermissionBehavior } = await import('../src/core/permission.js');
  const { SessionStore } = await import('../src/core/session-store.js');

  // ─────────────────────────────────────────────────────────────────
  // EVENT BUS TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - Basic');

  TestRunner.test('should create EventBus instance', () => {
    const bus = new EventBus();
    assert(bus instanceof EventBus, 'Should be EventBus instance');
    assert(bus.listeners instanceof Map, 'Should have listeners Map');
  });

  TestRunner.test('should subscribe and receive events', () => {
    const bus = new EventBus();
    let received = null;

    bus.on('test.event', (event) => {
      received = event;
    });

    bus.emit({ type: 'test.event', payload: { data: 'hello' } });

    assert(received !== null, 'Should receive event');
    assertEqual(received.type, 'test.event', 'Event type should match');
    assertEqual(received.payload.data, 'hello', 'Payload should match');
  });

  TestRunner.test('should unsubscribe correctly', () => {
    const bus = new EventBus();
    let count = 0;

    const unsubscribe = bus.on('test.event', () => count++);
    bus.emit({ type: 'test.event' });
    assertEqual(count, 1, 'Should receive first event');

    unsubscribe();
    bus.emit({ type: 'test.event' });
    assertEqual(count, 1, 'Should not receive after unsubscribe');
  });

  TestRunner.test('should support once() for single-fire listeners', () => {
    const bus = new EventBus();
    let count = 0;

    bus.once('test.event', () => count++);
    bus.emit({ type: 'test.event' });
    bus.emit({ type: 'test.event' });
    bus.emit({ type: 'test.event' });

    assertEqual(count, 1, 'Should only fire once');
  });

  TestRunner.test('should support wildcard listeners', () => {
    const bus = new EventBus();
    const events = [];

    bus.on('*', (event) => events.push(event.type));
    bus.emit({ type: 'event.one' });
    bus.emit({ type: 'event.two' });

    assertEqual(events.length, 2, 'Should receive all events');
    assert(events.includes('event.one'), 'Should have event.one');
    assert(events.includes('event.two'), 'Should have event.two');
  });

  TestRunner.test('should add timestamp to events', () => {
    const bus = new EventBus();
    let event = null;

    bus.on('test.event', (e) => event = e);
    bus.emit({ type: 'test.event' });

    assert(event.timestamp !== undefined, 'Should have timestamp');
    assert(typeof event.timestamp === 'number', 'Timestamp should be number');
  });

  TestRunner.test('should track event history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'event.1' });
    bus.emit({ type: 'event.2' });
    bus.emit({ type: 'event.3' });

    const history = bus.getHistory();
    assertEqual(history.length, 3, 'Should have 3 events in history');
  });

  TestRunner.test('should filter history by type', () => {
    const bus = new EventBus();
    bus.emit({ type: 'type.a' });
    bus.emit({ type: 'type.b' });
    bus.emit({ type: 'type.a' });

    const filtered = bus.getHistory('type.a');
    assertEqual(filtered.length, 2, 'Should have 2 type.a events');
  });

  TestRunner.test('should handle errors in listeners gracefully', () => {
    const bus = new EventBus();
    let secondCalled = false;

    bus.on('test.event', () => { throw new Error('Test error'); });
    bus.on('test.event', () => { secondCalled = true; });

    bus.emit({ type: 'test.event' });
    assert(secondCalled, 'Should continue to other listeners after error');
  });

  TestRunner.test('should clear all listeners', () => {
    const bus = new EventBus();
    let count = 0;

    bus.on('event.1', () => count++);
    bus.on('event.2', () => count++);
    bus.clear();

    bus.emit({ type: 'event.1' });
    bus.emit({ type: 'event.2' });

    assertEqual(count, 0, 'Should not receive events after clear');
  });

  // ─────────────────────────────────────────────────────────────────
  // EVENT TYPES TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - Event Types');

  TestRunner.test('should have animation event types', () => {
    assert(EventTypes.ANIMATION_START, 'Should have ANIMATION_START');
    assert(EventTypes.ANIMATION_STOP, 'Should have ANIMATION_STOP');
    assert(EventTypes.ANIMATION_FRAME, 'Should have ANIMATION_FRAME');
  });

  TestRunner.test('should have parameter event types', () => {
    assert(EventTypes.PARAMETER_CHANGE, 'Should have PARAMETER_CHANGE');
    assert(EventTypes.PARAMETER_REGISTER, 'Should have PARAMETER_REGISTER');
  });

  TestRunner.test('should have session event types', () => {
    assert(EventTypes.SESSION_CREATE, 'Should have SESSION_CREATE');
    assert(EventTypes.SESSION_LOAD, 'Should have SESSION_LOAD');
    assert(EventTypes.SESSION_SAVE, 'Should have SESSION_SAVE');
    assert(EventTypes.SESSION_DELETE, 'Should have SESSION_DELETE');
  });

  TestRunner.test('should have stream event types', () => {
    assert(EventTypes.STREAM_START, 'Should have STREAM_START');
    assert(EventTypes.STREAM_UPDATE, 'Should have STREAM_UPDATE');
    assert(EventTypes.STREAM_COMPLETE, 'Should have STREAM_COMPLETE');
    assert(EventTypes.STREAM_ERROR, 'Should have STREAM_ERROR');
  });

  TestRunner.test('should have permission event types', () => {
    assert(EventTypes.PERMISSION_REQUEST, 'Should have PERMISSION_REQUEST');
    assert(EventTypes.PERMISSION_RESPONSE, 'Should have PERMISSION_RESPONSE');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Streaming - StreamingState');

  TestRunner.test('should create StreamingState instance', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    assert(streaming instanceof StreamingState, 'Should be StreamingState instance');
    assertEqual(streaming.isActive(), false, 'Should not be active initially');
  });

  TestRunner.test('should start a stream', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    let startEvent = null;

    bus.on(EventTypes.STREAM_START, (e) => startEvent = e);

    const stream = streaming.startStream('test-stream', { source: 'test' });

    assert(stream !== null, 'Should return stream object');
    assertEqual(stream.id, 'test-stream', 'Stream ID should match');
    assertEqual(stream.status, 'active', 'Stream should be active');
    assertEqual(streaming.isActive(), true, 'Streaming should be active');
    assert(startEvent !== null, 'Should emit STREAM_START event');
  });

  TestRunner.test('should push updates to stream', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    const updates = [];

    bus.on(EventTypes.STREAM_UPDATE, (e) => updates.push(e.payload));

    streaming.startStream('test-stream');
    streaming.pushUpdate('test-stream', { progress: 0.25 });
    streaming.pushUpdate('test-stream', { progress: 0.50 });
    streaming.pushUpdate('test-stream', { progress: 0.75 });

    assertEqual(updates.length, 3, 'Should have 3 updates');
    assertEqual(updates[2].delta.progress, 0.75, 'Last update should have 0.75 progress');
  });

  TestRunner.test('should merge partial state correctly', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);

    streaming.startStream('test-stream');
    streaming.pushUpdate('test-stream', { a: 1 });
    streaming.pushUpdate('test-stream', { b: 2 });
    streaming.pushUpdate('test-stream', { a: 3 }); // Override

    const state = streaming.getPartialState();
    assertEqual(state.a, 3, 'Should have updated a');
    assertEqual(state.b, 2, 'Should have b');
  });

  TestRunner.test('should deep merge nested objects', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);

    streaming.startStream('test-stream');
    streaming.pushUpdate('test-stream', { nested: { a: 1 } });
    streaming.pushUpdate('test-stream', { nested: { b: 2 } });

    const state = streaming.getPartialState();
    assertEqual(state.nested.a, 1, 'Should preserve nested.a');
    assertEqual(state.nested.b, 2, 'Should have nested.b');
  });

  TestRunner.test('should complete stream', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    let completeEvent = null;

    bus.on(EventTypes.STREAM_COMPLETE, (e) => completeEvent = e);

    streaming.startStream('test-stream');
    streaming.pushUpdate('test-stream', { data: 'test' });
    const result = streaming.completeStream('test-stream');

    assert(completeEvent !== null, 'Should emit STREAM_COMPLETE');
    assertEqual(streaming.isActive(), false, 'Should not be active after complete');
    assertEqual(result.data, 'test', 'Should return final state');
  });

  TestRunner.test('should handle stream errors', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    let errorEvent = null;

    bus.on(EventTypes.STREAM_ERROR, (e) => errorEvent = e);

    streaming.startStream('test-stream');
    streaming.errorStream('test-stream', 'Test error');

    assert(errorEvent !== null, 'Should emit STREAM_ERROR');
    assertEqual(errorEvent.payload.error, 'Test error', 'Error message should match');
    assertEqual(streaming.isActive(), false, 'Should not be active after error');
  });

  TestRunner.test('should track stream duration', () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    let duration = null;

    bus.on(EventTypes.STREAM_COMPLETE, (e) => duration = e.payload.duration);

    streaming.startStream('test-stream');
    streaming.completeStream('test-stream');

    assert(duration !== undefined, 'Should have duration');
    assert(duration >= 0, 'Duration should be non-negative');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING ANIMATION LOADER TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Streaming - AnimationLoader');

  TestRunner.test('should create StreamingAnimationLoader instance', () => {
    const bus = new EventBus();
    const loader = new StreamingAnimationLoader(bus);
    assert(loader instanceof StreamingAnimationLoader, 'Should be StreamingAnimationLoader');
  });

  TestRunner.test('should have skeleton CSS', () => {
    const css = StreamingAnimationLoader.getSkeletonCSS();
    assert(typeof css === 'string', 'CSS should be string');
    assert(css.includes('.wfl-streaming-loader'), 'Should have loader class');
    assert(css.includes('.wfl-skeleton'), 'Should have skeleton class');
    assert(css.includes('@keyframes wfl-shimmer'), 'Should have shimmer animation');
  });

  // ─────────────────────────────────────────────────────────────────
  // PERMISSION MANAGER TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Permission - PermissionManager');

  TestRunner.test('should create PermissionManager instance', () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);
    assert(perms instanceof PermissionManager, 'Should be PermissionManager');
    assertEqual(perms.permissionMode, 'ask', 'Default mode should be ask');
  });

  TestRunner.test('should allow all in allow mode', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);
    perms.setMode('allow');

    const result = await perms.requestPermission('test.action', {});
    assertEqual(result.behavior, 'allow', 'Should allow');
  });

  TestRunner.test('should deny all in deny mode', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);
    perms.setMode('deny');

    const result = await perms.requestPermission('test.action', {});
    assertEqual(result.behavior, 'deny', 'Should deny');
  });

  TestRunner.test('should auto-approve specific action types', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);
    perms.autoApprove('test.auto');

    const result = await perms.requestPermission('test.auto', {});
    assertEqual(result.behavior, 'allow', 'Should auto-approve');
  });

  TestRunner.test('should auto-deny specific action types', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);
    perms.autoDeny('test.deny');

    const result = await perms.requestPermission('test.deny', {});
    assertEqual(result.behavior, 'deny', 'Should auto-deny');
  });

  TestRunner.test('should emit permission request event', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);
    let requestEvent = null;

    bus.on(EventTypes.PERMISSION_REQUEST, (e) => {
      requestEvent = e;
      // Auto-respond to prevent timeout
      perms.respondToPermission(e.payload.requestId, { behavior: 'allow' });
    });

    await perms.requestPermission('test.action', { detail: 'test' });

    assert(requestEvent !== null, 'Should emit PERMISSION_REQUEST');
    assertEqual(requestEvent.payload.actionType, 'test.action', 'Action type should match');
  });

  TestRunner.test('should respond to permission request', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);

    bus.on(EventTypes.PERMISSION_REQUEST, (e) => {
      setTimeout(() => {
        perms.respondToPermission(e.payload.requestId, { behavior: 'deny', message: 'User denied' });
      }, 10);
    });

    const result = await perms.requestPermission('test.action', {});
    assertEqual(result.behavior, 'deny', 'Should be denied');
    assertEqual(result.message, 'User denied', 'Message should match');
  });

  TestRunner.test('should have predefined permission actions', () => {
    assert(PermissionActions.SESSION_DELETE, 'Should have SESSION_DELETE');
    assert(PermissionActions.STATE_DELETE, 'Should have STATE_DELETE');
    assert(PermissionActions.STATE_RESET, 'Should have STATE_RESET');
    assert(PermissionActions.PARAMETER_RESET, 'Should have PARAMETER_RESET');
    assert(PermissionActions.ANIMATION_CLEAR, 'Should have ANIMATION_CLEAR');
  });

  TestRunner.test('should generate user-friendly messages', () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);

    const msg1 = perms.getPermissionMessage('session.delete', { sessionName: 'Test' });
    assert(msg1.includes('Test'), 'Should include session name');

    const msg2 = perms.getPermissionMessage('state.reset', {});
    assert(msg2.includes('Reset'), 'Should mention reset');
  });

  TestRunner.test('should track pending requests', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);

    // Don't auto-respond
    const promise = perms.requestPermission('test.action', {});

    const pending = perms.getPendingRequests();
    assertEqual(pending.length, 1, 'Should have 1 pending request');

    // Cleanup - respond to prevent hanging
    perms.respondToPermission(pending[0].id, { behavior: 'allow' });
    await promise;
  });

  TestRunner.test('should cancel all pending requests', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);

    const promise1 = perms.requestPermission('action.1', {});
    const promise2 = perms.requestPermission('action.2', {});

    perms.cancelAll();

    const [result1, result2] = await Promise.all([promise1, promise2]);
    assertEqual(result1.behavior, 'deny', 'First should be denied');
    assertEqual(result2.behavior, 'deny', 'Second should be denied');
  });

  TestRunner.test('should clear auto-response', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);

    perms.autoApprove('test.action');
    perms.clearAutoResponse('test.action');

    // Now it should emit request instead of auto-approving
    let emitted = false;
    bus.on(EventTypes.PERMISSION_REQUEST, (e) => {
      emitted = true;
      perms.respondToPermission(e.payload.requestId, { behavior: 'allow' });
    });

    await perms.requestPermission('test.action', {});
    assert(emitted, 'Should emit request after clearing auto-response');
  });

  // ─────────────────────────────────────────────────────────────────
  // SESSION STORE TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('SessionStore - Basic');

  TestRunner.test('should create SessionStore instance', () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    assert(store instanceof SessionStore, 'Should be SessionStore');
  });

  await TestRunner.testAsync('should initialize store', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();
    assert(store.initialized, 'Should be initialized');
  });

  await TestRunner.testAsync('should create session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    let createEvent = null;
    bus.on(EventTypes.SESSION_CREATE, (e) => createEvent = e);

    const session = await store.createSession({ title: 'Test Session' });

    assert(session.id, 'Should have ID');
    assertEqual(session.title, 'Test Session', 'Title should match');
    assertEqual(session.status, 'idle', 'Status should be idle');
    assert(createEvent !== null, 'Should emit SESSION_CREATE');
  });

  await TestRunner.testAsync('should get session by ID', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const created = await store.createSession({ title: 'Test' });
    const retrieved = store.getSession(created.id);

    assertEqual(retrieved.id, created.id, 'IDs should match');
    assertEqual(retrieved.title, 'Test', 'Titles should match');
  });

  await TestRunner.testAsync('should list sessions', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    await store.createSession({ title: 'Session 1' });
    await store.createSession({ title: 'Session 2' });
    await store.createSession({ title: 'Session 3' });

    const list = store.listSessions();
    assert(list.length >= 3, 'Should have at least 3 sessions');
  });

  await TestRunner.testAsync('should update session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({ title: 'Original' });
    await store.updateSession(session.id, { title: 'Updated', status: 'running' });

    const updated = store.getSession(session.id);
    assertEqual(updated.title, 'Updated', 'Title should be updated');
    assertEqual(updated.status, 'running', 'Status should be updated');
  });

  await TestRunner.testAsync('should delete session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    let deleteEvent = null;
    bus.on(EventTypes.SESSION_DELETE, (e) => deleteEvent = e);

    const session = await store.createSession({ title: 'ToDelete' });
    const result = await store.deleteSession(session.id);

    assert(result, 'Should return true');
    assertEqual(store.getSession(session.id), undefined, 'Should be deleted');
    assert(deleteEvent !== null, 'Should emit SESSION_DELETE');
  });

  await TestRunner.testAsync('should save and load snapshots', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    let saveEvent = null;
    bus.on(EventTypes.SESSION_SAVE, (e) => saveEvent = e);

    const session = await store.createSession({ title: 'SnapshotTest' });
    const snapshot = { parameters: { test: 123 }, timestamp: Date.now() };

    await store.saveSnapshot(session.id, snapshot);
    const loaded = await store.loadSnapshot(session.id);

    assertEqual(loaded.parameters.test, 123, 'Snapshot data should match');
    assert(saveEvent !== null, 'Should emit SESSION_SAVE');
  });

  await TestRunner.testAsync('should record messages', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({ title: 'MessageTest' });

    await store.recordMessage(session.id, { type: 'test', data: 'message1' });
    await store.recordMessage(session.id, { type: 'test', data: 'message2' });

    const history = await store.getSessionHistory(session.id);
    assert(history.messages.length >= 2, 'Should have messages');
  });

  await TestRunner.testAsync('should export session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const session = await store.createSession({ title: 'ExportTest' });
    await store.recordMessage(session.id, { type: 'test', data: 'export' });

    const exported = await store.exportSession(session.id);

    assert(exported.version, 'Should have version');
    assert(exported.exportedAt, 'Should have exportedAt');
    assert(exported.session, 'Should have session');
    assert(exported.messages, 'Should have messages');
  });

  await TestRunner.testAsync('should import session', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const importData = {
      session: { title: 'Imported', parameters: { x: 1 } },
      messages: [{ type: 'test', data: 'imported' }]
    };

    const imported = await store.importSession(importData);

    assert(imported.id, 'Should have new ID');
    assert(imported.title.includes('imported'), 'Title should indicate import');
  });

  await TestRunner.testAsync('should list recent cwds', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    await store.createSession({ title: 'S1', cwd: '/path/a' });
    await store.createSession({ title: 'S2', cwd: '/path/b' });
    await store.createSession({ title: 'S3', cwd: '/path/a' }); // Duplicate

    const cwds = store.listRecentCwds();
    assert(cwds.includes('/path/a'), 'Should have /path/a');
    assert(cwds.includes('/path/b'), 'Should have /path/b');
  });

  await TestRunner.testAsync('should generate unique IDs', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    await store.init();

    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(store.generateId());
    }

    assertEqual(ids.size, 100, 'All IDs should be unique');
  });

  // ─────────────────────────────────────────────────────────────────
  // INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Integration');

  await TestRunner.testAsync('EventBus + Streaming integration', async () => {
    const bus = new EventBus();
    const streaming = new StreamingState(bus);
    const events = [];

    bus.on('*', (e) => events.push(e.type));

    streaming.startStream('test');
    streaming.pushUpdate('test', { p: 1 });
    streaming.completeStream('test');

    assert(events.includes(EventTypes.STREAM_START), 'Should have START');
    assert(events.includes(EventTypes.STREAM_UPDATE), 'Should have UPDATE');
    assert(events.includes(EventTypes.STREAM_COMPLETE), 'Should have COMPLETE');
  });

  await TestRunner.testAsync('EventBus + Permission integration', async () => {
    const bus = new EventBus();
    const perms = new PermissionManager(bus);

    let requestId = null;
    bus.on(EventTypes.PERMISSION_REQUEST, (e) => {
      requestId = e.payload.requestId;
      bus.emit({
        type: EventTypes.PERMISSION_RESPONSE,
        payload: { requestId, result: { behavior: 'allow' } }
      });
    });

    // Listen for response via bus
    bus.on(EventTypes.PERMISSION_RESPONSE, (e) => {
      perms.respondToPermission(e.payload.requestId, e.payload.result);
    });

    const result = await perms.requestPermission('test.action', {});
    assertEqual(result.behavior, 'allow', 'Should be allowed via bus');
  });

  await TestRunner.testAsync('Full workflow: Session + Streaming + Events', async () => {
    const bus = new EventBus();
    const store = new SessionStore(bus);
    const streaming = new StreamingState(bus);
    await store.init();

    const timeline = [];
    bus.on('*', (e) => timeline.push(e.type));

    // Create session
    const session = await store.createSession({ title: 'Workflow Test' });
    assert(timeline.includes(EventTypes.SESSION_CREATE), 'Should have session create');

    // Simulate loading with streaming
    streaming.startStream('load-anim');
    streaming.pushUpdate('load-anim', { progress: 0.5 });
    streaming.completeStream('load-anim', { animation: 'loaded' });

    assert(timeline.includes(EventTypes.STREAM_START), 'Should have stream start');
    assert(timeline.includes(EventTypes.STREAM_COMPLETE), 'Should have stream complete');

    // Save session
    await store.saveSnapshot(session.id, { loaded: true });
    assert(timeline.includes(EventTypes.SESSION_SAVE), 'Should have session save');
  });

  // ─────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────
  return TestRunner.summary();
}

// Run tests
runTests().then(result => {
  process.exit(result.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
