/**
 * Tests for StreamingState and StreamingAnimationLoader
 * Tests what can be tested without DOM/fetch: constructors, mergeState,
 * stream lifecycle, progress tracking, error handling, and utility functions.
 */

import { TestRunner, assert, assertEqual, assertDeepEqual } from './test-helpers.js';
import { StreamingState, StreamingAnimationLoader } from '../src/core/streaming.js';
import { EventBus, EventTypes } from '../src/core/event-bus.js';

export async function runStreamingTests() {
  console.log('Streaming Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - Constructor');

  TestRunner.test('should create with default eventBus', () => {
    const ss = new StreamingState();
    assert(ss.eventBus !== null, 'eventBus should not be null');
  });

  TestRunner.test('should accept custom eventBus', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    assertEqual(ss.eventBus, bus, 'Should use the provided eventBus');
  });

  TestRunner.test('should initialize with empty activeStreams map', () => {
    const ss = new StreamingState();
    assert(ss.activeStreams instanceof Map, 'activeStreams should be a Map');
    assertEqual(ss.activeStreams.size, 0, 'activeStreams should be empty');
  });

  TestRunner.test('should initialize with empty partialState', () => {
    const ss = new StreamingState();
    assertDeepEqual(ss.partialState, {}, 'partialState should be empty object');
  });

  TestRunner.test('should initialize isStreaming as false', () => {
    const ss = new StreamingState();
    assertEqual(ss.isStreaming, false, 'isStreaming should be false');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - startStream
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - startStream');

  TestRunner.test('should start a stream and return stream object', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    const stream = ss.startStream('stream-1', { url: '/test' });
    assertEqual(stream.id, 'stream-1', 'Stream id should match');
    assertEqual(stream.status, 'active', 'Status should be active');
    assertEqual(stream.metadata.url, '/test', 'Metadata should match');
    assert(Array.isArray(stream.buffer), 'Buffer should be an array');
    assertEqual(stream.buffer.length, 0, 'Buffer should start empty');
    assert(typeof stream.startTime === 'number', 'startTime should be a number');
  });

  TestRunner.test('should add stream to activeStreams', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    assert(ss.activeStreams.has('stream-1'), 'Should be in activeStreams');
    assertEqual(ss.activeStreams.size, 1, 'Should have 1 active stream');
  });

  TestRunner.test('should set isStreaming to true', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    assertEqual(ss.isStreaming, true, 'isStreaming should be true');
  });

  TestRunner.test('should emit STREAM_START event', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = null;

    bus.on(EventTypes.STREAM_START, (event) => { emitted = event; });
    ss.startStream('stream-1', { url: '/test' });

    assert(emitted !== null, 'Should emit STREAM_START');
    assertEqual(emitted.payload.streamId, 'stream-1', 'Payload should have streamId');
    assertEqual(emitted.payload.metadata.url, '/test', 'Payload should have metadata');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - pushUpdate
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - pushUpdate');

  TestRunner.test('should buffer delta updates', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { progress: 0.5 });
    ss.pushUpdate('stream-1', { progress: 0.8 });

    const stream = ss.activeStreams.get('stream-1');
    assertEqual(stream.buffer.length, 2, 'Buffer should have 2 entries');
  });

  TestRunner.test('should merge delta into partialState', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { x: 1, y: 2 });
    ss.pushUpdate('stream-1', { z: 3 });

    const partial = ss.getPartialState();
    assertEqual(partial.x, 1, 'x should be merged');
    assertEqual(partial.y, 2, 'y should be merged');
    assertEqual(partial.z, 3, 'z should be merged');
  });

  TestRunner.test('should emit STREAM_UPDATE event', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = null;

    bus.on(EventTypes.STREAM_UPDATE, (event) => { emitted = event; });
    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { progress: 0.5 });

    assert(emitted !== null, 'Should emit STREAM_UPDATE');
    assertEqual(emitted.payload.streamId, 'stream-1', 'Payload should have streamId');
    assertEqual(emitted.payload.delta.progress, 0.5, 'Payload should have delta');
  });

  TestRunner.test('should ignore pushUpdate for unknown stream', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = false;

    bus.on(EventTypes.STREAM_UPDATE, () => { emitted = true; });
    // Should not throw, should not emit
    ss.pushUpdate('nonexistent', { data: 'ignored' });
    assertEqual(emitted, false, 'Should not emit for unknown stream');
  });

  TestRunner.test('should ignore pushUpdate for non-active stream', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.completeStream('stream-1');

    let emitted = false;
    bus.on(EventTypes.STREAM_UPDATE, () => { emitted = true; });

    ss.pushUpdate('stream-1', { data: 'ignored' });
    assertEqual(emitted, false, 'Should not emit for completed stream');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - completeStream
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - completeStream');

  TestRunner.test('should complete a stream and return final state', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { x: 1 });
    const result = ss.completeStream('stream-1');

    assertEqual(result.x, 1, 'Should return accumulated partial state');
  });

  TestRunner.test('should accept optional finalState override', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { x: 1 });
    const finalState = { complete: true, data: 'final' };
    const result = ss.completeStream('stream-1', finalState);

    assertEqual(result.complete, true, 'Should return provided finalState');
    assertEqual(result.data, 'final', 'Should return provided data');
  });

  TestRunner.test('should remove stream from activeStreams', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.completeStream('stream-1');

    assertEqual(ss.activeStreams.has('stream-1'), false, 'Should be removed from activeStreams');
  });

  TestRunner.test('should set isStreaming to false when last stream completes', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    assertEqual(ss.isStreaming, true, 'Should be streaming');

    ss.completeStream('stream-1');
    assertEqual(ss.isStreaming, false, 'Should not be streaming after completion');
  });

  TestRunner.test('should keep isStreaming true if other streams active', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.startStream('stream-2');
    ss.completeStream('stream-1');

    assertEqual(ss.isStreaming, true, 'Should still be streaming with stream-2 active');
  });

  TestRunner.test('should reset partialState after completion', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { x: 1 });
    ss.completeStream('stream-1');

    assertDeepEqual(ss.partialState, {}, 'partialState should be reset');
  });

  TestRunner.test('should emit STREAM_COMPLETE event with duration and updateCount', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = null;

    bus.on(EventTypes.STREAM_COMPLETE, (event) => { emitted = event; });

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { x: 1 });
    ss.pushUpdate('stream-1', { y: 2 });
    ss.completeStream('stream-1');

    assert(emitted !== null, 'Should emit STREAM_COMPLETE');
    assertEqual(emitted.payload.streamId, 'stream-1', 'Payload should have streamId');
    assertEqual(emitted.payload.updateCount, 2, 'Should track update count');
    assert(typeof emitted.payload.duration === 'number', 'Should have duration');
    assert(emitted.payload.duration >= 0, 'Duration should be non-negative');
  });

  TestRunner.test('completeStream returns undefined for unknown stream', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    const result = ss.completeStream('nonexistent');
    assertEqual(result, undefined, 'Should return undefined for unknown stream');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - errorStream
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - errorStream');

  TestRunner.test('should handle error with Error object', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = null;

    bus.on(EventTypes.STREAM_ERROR, (event) => { emitted = event; });

    ss.startStream('stream-1');
    ss.errorStream('stream-1', new Error('test error'));

    assert(emitted !== null, 'Should emit STREAM_ERROR');
    assertEqual(emitted.payload.streamId, 'stream-1', 'Payload should have streamId');
    assertEqual(emitted.payload.error, 'test error', 'Should extract error message');
  });

  TestRunner.test('should handle error with string', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = null;

    bus.on(EventTypes.STREAM_ERROR, (event) => { emitted = event; });

    ss.startStream('stream-1');
    ss.errorStream('stream-1', 'string error');

    assertEqual(emitted.payload.error, 'string error', 'Should pass string error directly');
  });

  TestRunner.test('should remove stream from activeStreams on error', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.errorStream('stream-1', 'fail');

    assertEqual(ss.activeStreams.has('stream-1'), false, 'Should be removed on error');
  });

  TestRunner.test('should set isStreaming to false after error (last stream)', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.errorStream('stream-1', 'fail');

    assertEqual(ss.isStreaming, false, 'isStreaming should be false');
  });

  TestRunner.test('errorStream does nothing for unknown stream', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    let emitted = false;

    bus.on(EventTypes.STREAM_ERROR, () => { emitted = true; });
    // Should not throw, should not emit
    ss.errorStream('nonexistent', 'fail');
    assertEqual(emitted, false, 'Should not emit for unknown stream');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - getPartialState / isActive
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - getPartialState / isActive');

  TestRunner.test('getPartialState returns a copy', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    ss.startStream('stream-1');
    ss.pushUpdate('stream-1', { x: 1 });

    const partial = ss.getPartialState();
    partial.x = 999;

    assertEqual(ss.getPartialState().x, 1, 'Original should not be modified');
  });

  TestRunner.test('isActive returns current streaming state', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);

    assertEqual(ss.isActive(), false, 'Should be false initially');

    ss.startStream('stream-1');
    assertEqual(ss.isActive(), true, 'Should be true when streaming');

    ss.completeStream('stream-1');
    assertEqual(ss.isActive(), false, 'Should be false after completion');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING STATE - mergeState (deep merge)
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - mergeState');

  TestRunner.test('should merge flat objects', () => {
    const ss = new StreamingState();
    const result = ss.mergeState({ a: 1 }, { b: 2 });
    assertEqual(result.a, 1, 'Should keep existing keys');
    assertEqual(result.b, 2, 'Should add new keys');
  });

  TestRunner.test('should overwrite existing keys', () => {
    const ss = new StreamingState();
    const result = ss.mergeState({ a: 1 }, { a: 2 });
    assertEqual(result.a, 2, 'Should overwrite existing key');
  });

  TestRunner.test('should deep merge nested objects', () => {
    const ss = new StreamingState();
    const result = ss.mergeState(
      { nested: { x: 1, y: 2 } },
      { nested: { y: 3, z: 4 } }
    );
    assertEqual(result.nested.x, 1, 'Should keep nested.x');
    assertEqual(result.nested.y, 3, 'Should overwrite nested.y');
    assertEqual(result.nested.z, 4, 'Should add nested.z');
  });

  TestRunner.test('should not deep merge arrays (overwrite instead)', () => {
    const ss = new StreamingState();
    const result = ss.mergeState(
      { arr: [1, 2, 3] },
      { arr: [4, 5] }
    );
    assertDeepEqual(result.arr, [4, 5], 'Arrays should be overwritten, not merged');
  });

  TestRunner.test('should handle null values in source', () => {
    const ss = new StreamingState();
    const result = ss.mergeState({ a: 1 }, { a: null });
    assertEqual(result.a, null, 'Should allow null to overwrite');
  });

  TestRunner.test('should not mutate the target', () => {
    const ss = new StreamingState();
    const target = { a: 1, b: 2 };
    ss.mergeState(target, { c: 3 });
    assertEqual(target.c, undefined, 'Target should not be mutated');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING ANIMATION LOADER - CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingAnimationLoader - Constructor');

  TestRunner.test('should create with default eventBus', () => {
    const loader = new StreamingAnimationLoader();
    assert(loader.eventBus !== null, 'eventBus should not be null');
    assert(loader.streaming instanceof StreamingState, 'streaming should be a StreamingState');
  });

  TestRunner.test('should accept custom eventBus', () => {
    const bus = new EventBus();
    const loader = new StreamingAnimationLoader(bus);
    assertEqual(loader.eventBus, bus, 'Should use provided eventBus');
    assertEqual(loader.streaming.eventBus, bus, 'StreamingState should use same eventBus');
  });

  TestRunner.test('should initialize with empty loadingIndicators map', () => {
    const loader = new StreamingAnimationLoader();
    assert(loader.loadingIndicators instanceof Map, 'loadingIndicators should be a Map');
    assertEqual(loader.loadingIndicators.size, 0, 'loadingIndicators should be empty');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING ANIMATION LOADER - showLoadingIndicator / hideLoadingIndicator
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingAnimationLoader - loading indicators (without DOM)');

  TestRunner.test('showLoadingIndicator should track indicator without DOM', () => {
    const loader = new StreamingAnimationLoader();
    const indicator = loader.showLoadingIndicator('load-1', null);

    assertEqual(indicator.id, 'load-1', 'Indicator id should match');
    assertEqual(indicator.target, null, 'Target should be null');
    assertEqual(indicator.element, null, 'Element should be null (no DOM)');
    assert(loader.loadingIndicators.has('load-1'), 'Should be tracked in map');
  });

  TestRunner.test('hideLoadingIndicator should remove indicator', () => {
    const loader = new StreamingAnimationLoader();
    loader.showLoadingIndicator('load-1', null);
    assertEqual(loader.loadingIndicators.size, 1, 'Should have 1 indicator');

    loader.hideLoadingIndicator('load-1');
    assertEqual(loader.loadingIndicators.size, 0, 'Should have 0 indicators after hide');
  });

  TestRunner.test('hideLoadingIndicator for unknown id should not throw', () => {
    const loader = new StreamingAnimationLoader();
    // Should not throw
    loader.hideLoadingIndicator('nonexistent');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING ANIMATION LOADER - getSkeletonCSS (static)
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingAnimationLoader - getSkeletonCSS');

  TestRunner.test('should return CSS string', () => {
    const css = StreamingAnimationLoader.getSkeletonCSS();
    assert(typeof css === 'string', 'Should return a string');
    assert(css.includes('.wfl-streaming-loader'), 'Should contain loader class');
    assert(css.includes('.wfl-skeleton'), 'Should contain skeleton class');
    assert(css.includes('wfl-shimmer'), 'Should contain shimmer animation');
  });

  // ─────────────────────────────────────────────────────────────────
  // STREAMING ANIMATION LOADER - method existence
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingAnimationLoader - method existence');

  TestRunner.test('should have loadWithStreaming method', () => {
    const loader = new StreamingAnimationLoader();
    assert(typeof loader.loadWithStreaming === 'function', 'loadWithStreaming should be a function');
  });

  TestRunner.test('should have showLoadingIndicator method', () => {
    const loader = new StreamingAnimationLoader();
    assert(typeof loader.showLoadingIndicator === 'function', 'showLoadingIndicator should be a function');
  });

  TestRunner.test('should have hideLoadingIndicator method', () => {
    const loader = new StreamingAnimationLoader();
    assert(typeof loader.hideLoadingIndicator === 'function', 'hideLoadingIndicator should be a function');
  });

  // ─────────────────────────────────────────────────────────────────
  // FULL STREAM LIFECYCLE
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StreamingState - full stream lifecycle');

  TestRunner.test('should handle complete start -> update -> complete lifecycle', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    const events = [];

    bus.on('*', (event) => { events.push(event.type); });

    // Start
    ss.startStream('lifecycle-1');
    assertEqual(ss.isActive(), true, 'Should be active after start');

    // Update
    ss.pushUpdate('lifecycle-1', { frame: 0 });
    ss.pushUpdate('lifecycle-1', { frame: 1 });
    ss.pushUpdate('lifecycle-1', { frame: 2 });

    // Complete
    const result = ss.completeStream('lifecycle-1');
    assertEqual(ss.isActive(), false, 'Should not be active after complete');
    assertEqual(result.frame, 2, 'Final state should have last update');

    // Verify events
    assert(events.includes(EventTypes.STREAM_START), 'Should have emitted STREAM_START');
    assert(events.includes(EventTypes.STREAM_UPDATE), 'Should have emitted STREAM_UPDATE');
    assert(events.includes(EventTypes.STREAM_COMPLETE), 'Should have emitted STREAM_COMPLETE');
  });

  TestRunner.test('should handle start -> update -> error lifecycle', () => {
    const bus = new EventBus();
    const ss = new StreamingState(bus);
    const events = [];

    bus.on('*', (event) => { events.push(event.type); });

    ss.startStream('error-lifecycle');
    ss.pushUpdate('error-lifecycle', { frame: 0 });
    ss.errorStream('error-lifecycle', 'connection lost');

    assertEqual(ss.isActive(), false, 'Should not be active after error');
    assert(events.includes(EventTypes.STREAM_ERROR), 'Should have emitted STREAM_ERROR');
  });

  return TestRunner.summary();
}
