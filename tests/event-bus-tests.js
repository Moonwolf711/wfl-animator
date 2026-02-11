/**
 * Tests for EventBus and EventTypes
 */

import { TestRunner, assert, assertEqual } from './test-helpers.js';
import { EventBus, EventTypes, globalEventBus } from '../src/core/event-bus.js';

export async function runEventBusTests() {
  console.log('Event Bus Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // CONSTRUCTOR / DEFAULTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - Constructor');

  TestRunner.test('should create with empty listeners map', () => {
    const bus = new EventBus();
    assert(bus.listeners instanceof Map, 'listeners should be a Map');
    assertEqual(bus.listeners.size, 0, 'listeners should be empty');
  });

  TestRunner.test('should create with empty history', () => {
    const bus = new EventBus();
    assert(Array.isArray(bus.history), 'history should be an array');
    assertEqual(bus.history.length, 0, 'history should be empty');
  });

  TestRunner.test('should set maxHistory to 100', () => {
    const bus = new EventBus();
    assertEqual(bus.maxHistory, 100, 'maxHistory should default to 100');
  });

  TestRunner.test('should set onError to null', () => {
    const bus = new EventBus();
    assertEqual(bus.onError, null, 'onError should default to null');
  });

  // ─────────────────────────────────────────────────────────────────
  // ON / OFF SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - on/off subscription');

  TestRunner.test('should subscribe to an event type', () => {
    const bus = new EventBus();
    const callback = () => {};
    bus.on('test.event', callback);
    assert(bus.listeners.has('test.event'), 'Should have listener for test.event');
    assertEqual(bus.listeners.get('test.event').size, 1, 'Should have one listener');
  });

  TestRunner.test('should return unsubscribe function from on()', () => {
    const bus = new EventBus();
    const unsub = bus.on('test.event', () => {});
    assert(typeof unsub === 'function', 'on() should return a function');
  });

  TestRunner.test('should unsubscribe via returned function', () => {
    const bus = new EventBus();
    let callCount = 0;
    const unsub = bus.on('test.event', () => { callCount++; });

    bus.emit({ type: 'test.event' });
    assertEqual(callCount, 1, 'Should fire before unsub');

    unsub();
    bus.emit({ type: 'test.event' });
    assertEqual(callCount, 1, 'Should not fire after unsub');
  });

  TestRunner.test('should clean up empty listener sets after unsubscribe', () => {
    const bus = new EventBus();
    const unsub = bus.on('test.event', () => {});
    unsub();
    assertEqual(bus.listeners.has('test.event'), false, 'Empty set should be removed from map');
  });

  // ─────────────────────────────────────────────────────────────────
  // EMIT
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - emit');

  TestRunner.test('should fire all listeners for an event', () => {
    const bus = new EventBus();
    let count1 = 0;
    let count2 = 0;
    bus.on('test.event', () => { count1++; });
    bus.on('test.event', () => { count2++; });

    bus.emit({ type: 'test.event' });
    assertEqual(count1, 1, 'First listener should fire');
    assertEqual(count2, 1, 'Second listener should fire');
  });

  TestRunner.test('should throw if event has no type', () => {
    const bus = new EventBus();
    let threw = false;
    try {
      bus.emit({});
    } catch (e) {
      threw = true;
      assert(e.message.includes('type'), 'Error should mention type');
    }
    assert(threw, 'Should throw for event without type');
  });

  TestRunner.test('should pass payload data correctly', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('test.event', (event) => { received = event; });

    bus.emit({ type: 'test.event', payload: { value: 42, name: 'test' } });
    assertEqual(received.type, 'test.event', 'Should receive correct type');
    assertEqual(received.payload.value, 42, 'Should receive correct payload value');
    assertEqual(received.payload.name, 'test', 'Should receive correct payload name');
  });

  TestRunner.test('should add timestamp to emitted events', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('test.event', (event) => { received = event; });

    const before = Date.now();
    bus.emit({ type: 'test.event' });
    const after = Date.now();

    assert(typeof received.timestamp === 'number', 'Should have timestamp');
    assert(received.timestamp >= before && received.timestamp <= after, 'Timestamp should be current');
  });

  TestRunner.test('should store events in history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'test.event', payload: { n: 1 } });
    bus.emit({ type: 'test.event', payload: { n: 2 } });

    assertEqual(bus.history.length, 2, 'History should have 2 events');
    assertEqual(bus.history[0].payload.n, 1, 'First event should be first');
    assertEqual(bus.history[1].payload.n, 2, 'Second event should be second');
  });

  TestRunner.test('should trim history beyond maxHistory', () => {
    const bus = new EventBus();
    bus.maxHistory = 3;

    for (let i = 0; i < 5; i++) {
      bus.emit({ type: 'test', payload: { i } });
    }

    assertEqual(bus.history.length, 3, 'History should be capped at maxHistory');
    assertEqual(bus.history[0].payload.i, 2, 'Oldest should be trimmed');
    assertEqual(bus.history[2].payload.i, 4, 'Newest should be kept');
  });

  TestRunner.test('should not error when emitting with no listeners', () => {
    const bus = new EventBus();
    // Should not throw
    bus.emit({ type: 'unheard.event', payload: { data: 'ignored' } });
    assertEqual(bus.history.length, 1, 'Should still record in history');
  });

  // ─────────────────────────────────────────────────────────────────
  // ONCE
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - once');

  TestRunner.test('should fire listener only once then auto-remove', () => {
    const bus = new EventBus();
    let callCount = 0;
    bus.once('test.event', () => { callCount++; });

    bus.emit({ type: 'test.event' });
    bus.emit({ type: 'test.event' });
    bus.emit({ type: 'test.event' });

    assertEqual(callCount, 1, 'once listener should fire exactly once');
  });

  TestRunner.test('should receive event data in once callback', () => {
    const bus = new EventBus();
    let received = null;
    bus.once('test.event', (event) => { received = event; });

    bus.emit({ type: 'test.event', payload: { msg: 'hello' } });
    assertEqual(received.payload.msg, 'hello', 'once should receive payload');
  });

  TestRunner.test('once should return unsubscribe function', () => {
    const bus = new EventBus();
    let callCount = 0;
    const unsub = bus.once('test.event', () => { callCount++; });

    unsub();
    bus.emit({ type: 'test.event' });
    assertEqual(callCount, 0, 'Should not fire if unsubscribed before emit');
  });

  // ─────────────────────────────────────────────────────────────────
  // OFF (unsubscribe via returned function)
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - off (unsubscribe)');

  TestRunner.test('should remove specific listener via unsubscribe', () => {
    const bus = new EventBus();
    let countA = 0;
    let countB = 0;

    const unsubA = bus.on('test.event', () => { countA++; });
    bus.on('test.event', () => { countB++; });

    bus.emit({ type: 'test.event' });
    assertEqual(countA, 1, 'A should fire before unsub');
    assertEqual(countB, 1, 'B should fire before unsub');

    unsubA();
    bus.emit({ type: 'test.event' });
    assertEqual(countA, 1, 'A should not fire after unsub');
    assertEqual(countB, 2, 'B should still fire after A unsub');
  });

  TestRunner.test('double unsubscribe should not throw', () => {
    const bus = new EventBus();
    const unsub = bus.on('test.event', () => {});
    unsub();
    // Should not throw
    unsub();
  });

  // ─────────────────────────────────────────────────────────────────
  // CLEAR
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - clear');

  TestRunner.test('should remove all listeners', () => {
    const bus = new EventBus();
    bus.on('event.a', () => {});
    bus.on('event.b', () => {});
    bus.on('event.c', () => {});

    assertEqual(bus.listeners.size, 3, 'Should have 3 event types');

    bus.clear();
    assertEqual(bus.listeners.size, 0, 'Should have 0 event types after clear');
  });

  TestRunner.test('listeners should not fire after clear', () => {
    const bus = new EventBus();
    let callCount = 0;
    bus.on('test.event', () => { callCount++; });

    bus.clear();
    bus.emit({ type: 'test.event' });
    assertEqual(callCount, 0, 'Should not fire after clear');
  });

  // ─────────────────────────────────────────────────────────────────
  // ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - error handling');

  TestRunner.test('error in listener should not break other listeners', () => {
    const bus = new EventBus();
    bus.onError = () => {}; // suppress
    let secondCalled = false;

    bus.on('test.event', () => { throw new Error('boom'); });
    bus.on('test.event', () => { secondCalled = true; });

    bus.emit({ type: 'test.event' });
    assertEqual(secondCalled, true, 'Second listener should still fire');
  });

  TestRunner.test('onError handler receives event type and error', () => {
    const bus = new EventBus();
    let receivedType = null;
    let receivedError = null;

    bus.onError = (type, error) => {
      receivedType = type;
      receivedError = error;
    };

    bus.on('test.event', () => { throw new Error('test error'); });
    bus.emit({ type: 'test.event' });

    assertEqual(receivedType, 'test.event', 'Should receive event type');
    assert(receivedError instanceof Error, 'Should receive Error instance');
    assertEqual(receivedError.message, 'test error', 'Should receive correct error message');
  });

  TestRunner.test('error without onError handler does not throw', () => {
    const bus = new EventBus();
    assertEqual(bus.onError, null, 'onError should be null by default');

    bus.on('test.event', () => { throw new Error('unhandled'); });
    // Should not throw
    bus.emit({ type: 'test.event' });
  });

  // ─────────────────────────────────────────────────────────────────
  // WILDCARD LISTENERS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - wildcard listeners');

  TestRunner.test('wildcard * listener fires for any event', () => {
    const bus = new EventBus();
    const received = [];
    bus.on('*', (event) => { received.push(event.type); });

    bus.emit({ type: 'event.a' });
    bus.emit({ type: 'event.b' });
    bus.emit({ type: 'event.c' });

    assertEqual(received.length, 3, 'Wildcard should fire for all events');
    assertEqual(received[0], 'event.a', 'Should receive event.a');
    assertEqual(received[1], 'event.b', 'Should receive event.b');
    assertEqual(received[2], 'event.c', 'Should receive event.c');
  });

  TestRunner.test('unknown event type emits without error', () => {
    const bus = new EventBus();
    // Should not throw
    bus.emit({ type: 'completely.unknown.event.type' });
    assertEqual(bus.history.length, 1, 'Should still record in history');
  });

  // ─────────────────────────────────────────────────────────────────
  // MULTIPLE LISTENERS ON SAME EVENT
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - multiple listeners');

  TestRunner.test('multiple listeners on same event all fire', () => {
    const bus = new EventBus();
    const results = [];
    bus.on('test.event', () => { results.push('A'); });
    bus.on('test.event', () => { results.push('B'); });
    bus.on('test.event', () => { results.push('C'); });

    bus.emit({ type: 'test.event' });
    assertEqual(results.length, 3, 'All three listeners should fire');
    assert(results.includes('A'), 'A should fire');
    assert(results.includes('B'), 'B should fire');
    assert(results.includes('C'), 'C should fire');
  });

  // ─────────────────────────────────────────────────────────────────
  // BROADCAST (alias for emit)
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - broadcast');

  TestRunner.test('broadcast should work as alias for emit', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('test.event', (event) => { received = event; });

    bus.broadcast({ type: 'test.event', payload: { data: 'broadcast' } });
    assertEqual(received.payload.data, 'broadcast', 'broadcast should work like emit');
  });

  // ─────────────────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - history');

  TestRunner.test('getHistory returns all events by default', () => {
    const bus = new EventBus();
    bus.emit({ type: 'a' });
    bus.emit({ type: 'b' });
    bus.emit({ type: 'c' });

    const history = bus.getHistory();
    assertEqual(history.length, 3, 'Should return all 3 events');
  });

  TestRunner.test('getHistory filters by type', () => {
    const bus = new EventBus();
    bus.emit({ type: 'a' });
    bus.emit({ type: 'b' });
    bus.emit({ type: 'a' });

    const history = bus.getHistory('a');
    assertEqual(history.length, 2, 'Should return 2 events of type a');
  });

  TestRunner.test('getHistory respects limit', () => {
    const bus = new EventBus();
    for (let i = 0; i < 10; i++) {
      bus.emit({ type: 'test', payload: { i } });
    }

    const history = bus.getHistory(null, 3);
    assertEqual(history.length, 3, 'Should return only 3 events');
    assertEqual(history[0].payload.i, 7, 'Should return last 3 events');
  });

  TestRunner.test('clearHistory empties history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'test' });
    bus.emit({ type: 'test' });
    assertEqual(bus.history.length, 2, 'Should have 2 events');

    bus.clearHistory();
    assertEqual(bus.history.length, 0, 'History should be empty after clearHistory');
  });

  // ─────────────────────────────────────────────────────────────────
  // EVENT TYPES CONSTANTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventTypes - constants');

  TestRunner.test('EventTypes should exist and be an object', () => {
    assert(typeof EventTypes === 'object', 'EventTypes should be an object');
    assert(EventTypes !== null, 'EventTypes should not be null');
  });

  TestRunner.test('animation event types have correct values', () => {
    assertEqual(EventTypes.ANIMATION_START, 'animation.start', 'ANIMATION_START');
    assertEqual(EventTypes.ANIMATION_STOP, 'animation.stop', 'ANIMATION_STOP');
    assertEqual(EventTypes.ANIMATION_FRAME, 'animation.frame', 'ANIMATION_FRAME');
    assertEqual(EventTypes.ANIMATION_COMPLETE, 'animation.complete', 'ANIMATION_COMPLETE');
  });

  TestRunner.test('parameter event types have correct values', () => {
    assertEqual(EventTypes.PARAMETER_CHANGE, 'parameter.change', 'PARAMETER_CHANGE');
    assertEqual(EventTypes.PARAMETER_REGISTER, 'parameter.register', 'PARAMETER_REGISTER');
  });

  TestRunner.test('state machine event types have correct values', () => {
    assertEqual(EventTypes.STATE_CHANGE, 'state.change', 'STATE_CHANGE');
    assertEqual(EventTypes.STATE_ENTER, 'state.enter', 'STATE_ENTER');
    assertEqual(EventTypes.STATE_EXIT, 'state.exit', 'STATE_EXIT');
    assertEqual(EventTypes.TRANSITION_START, 'transition.start', 'TRANSITION_START');
    assertEqual(EventTypes.TRANSITION_COMPLETE, 'transition.complete', 'TRANSITION_COMPLETE');
  });

  TestRunner.test('session event types have correct values', () => {
    assertEqual(EventTypes.SESSION_CREATE, 'session.create', 'SESSION_CREATE');
    assertEqual(EventTypes.SESSION_LOAD, 'session.load', 'SESSION_LOAD');
    assertEqual(EventTypes.SESSION_SAVE, 'session.save', 'SESSION_SAVE');
    assertEqual(EventTypes.SESSION_DELETE, 'session.delete', 'SESSION_DELETE');
    assertEqual(EventTypes.SESSION_LIST, 'session.list', 'SESSION_LIST');
  });

  TestRunner.test('stream event types have correct values', () => {
    assertEqual(EventTypes.STREAM_START, 'stream.start', 'STREAM_START');
    assertEqual(EventTypes.STREAM_UPDATE, 'stream.update', 'STREAM_UPDATE');
    assertEqual(EventTypes.STREAM_COMPLETE, 'stream.complete', 'STREAM_COMPLETE');
    assertEqual(EventTypes.STREAM_ERROR, 'stream.error', 'STREAM_ERROR');
  });

  TestRunner.test('error event types have correct values', () => {
    assertEqual(EventTypes.ERROR, 'error', 'ERROR');
    assertEqual(EventTypes.WARNING, 'warning', 'WARNING');
  });

  TestRunner.test('permission event types have correct values', () => {
    assertEqual(EventTypes.PERMISSION_REQUEST, 'permission.request', 'PERMISSION_REQUEST');
    assertEqual(EventTypes.PERMISSION_RESPONSE, 'permission.response', 'PERMISSION_RESPONSE');
  });

  // ─────────────────────────────────────────────────────────────────
  // GLOBAL EVENT BUS SINGLETON
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('EventBus - globalEventBus singleton');

  TestRunner.test('globalEventBus should be an EventBus instance', () => {
    assert(globalEventBus instanceof EventBus, 'Should be an EventBus instance');
  });

  return TestRunner.summary();
}
