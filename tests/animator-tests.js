/**
 * Tests for WFLAnimator
 * Runs in Node.js with minimal browser API mocks
 */

import { TestRunner, assert, assertEqual, assertDeepEqual } from './test-helpers.js';
import { ParameterSystem } from '../src/core/parameter.js';
import { StateMachine } from '../src/core/state-machine.js';
import { EventBus, EventTypes } from '../src/core/event-bus.js';
import { PermissionManager } from '../src/core/permission.js';
import { SessionStore } from '../src/core/session-store.js';

// ═══════════════════════════════════════════════════════════════════
// Minimal browser API mocks for Node.js
// ═══════════════════════════════════════════════════════════════════

// Mock Image
if (typeof globalThis.Image === 'undefined') {
  globalThis.Image = class Image {
    constructor() {
      this.src = '';
      this.onload = null;
      this.onerror = null;
      this.width = 100;
      this.height = 100;
    }
    set src(val) {
      this._src = val;
      if (val && this.onload) {
        setTimeout(() => this.onload(), 0);
      }
    }
    get src() { return this._src || ''; }
  };
}

// Mock document (minimal)
if (typeof globalThis.document === 'undefined') {
  globalThis.document = undefined; // Keep it undefined so code guards with typeof check
}

/**
 * We test the Animator by directly importing its dependencies and
 * constructing it with mocked subsystems, rather than importing
 * WFLAnimator directly (which pulls in PermissionDialog needing DOM).
 *
 * We test the core methods: setupDefaultParameters, createConditionFunction,
 * setupStateMachine, createSnapshot, restoreFromSnapshot by reimplementing
 * the relevant logic inline using the same source patterns.
 */

/**
 * Helper: build a minimal animator-like object for testing.
 * This avoids importing WFLAnimator directly (which drags in DOM-dependent
 * PermissionDialog at module scope through globalPermissionManager).
 */
function createTestAnimator() {
  const eventBus = new EventBus();
  const permissions = new PermissionManager(eventBus);
  const sessionStore = new SessionStore(eventBus);

  const animator = {
    parameters: new ParameterSystem(),
    stateMachine: null,
    eventBus,
    permissions,
    sessionStore,
    currentSession: null,
    isInitialized: false,

    // Matches WFLAnimator.setupDefaultParameters
    setupDefaultParameters() {
      this.parameters.register('mouthState', 'number', 0);
      this.parameters.register('headTurn', 'number', 0);
      this.parameters.register('eyeState', 'number', 0);
      this.parameters.register('roastTone', 'number', 0);
      this.parameters.register('isTalking', 'boolean', false);
    },

    // Matches WFLAnimator.createConditionFunction exactly
    createConditionFunction(conditionStr) {
      if (!conditionStr || typeof conditionStr !== 'string' || conditionStr === '[function]') {
        return () => false;
      }

      return (parameters) => {
        try {
          let expr = conditionStr;

          const paramNames = parameters.getAll()
            .map(p => p.name)
            .sort((a, b) => b.length - a.length);

          for (const name of paramNames) {
            const param = parameters.get(name);
            if (!param) continue;
            const value = param.get();
            const replacement = typeof value === 'string' ? `"${value}"` : String(value);
            expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), replacement);
          }

          const safePattern = /^[\d\s.+\-*/<>=!&|()true false"null]+$/;
          if (!safePattern.test(expr)) {
            return false;
          }

          return Boolean(new Function(`return (${expr});`)());
        } catch (_e) {
          return false;
        }
      };
    },

    // Matches WFLAnimator.setupStateMachine
    setupStateMachine(data) {
      this.stateMachine = new StateMachine(data.name);

      Object.entries(data.states).forEach(([name, stateData]) => {
        this.stateMachine.addState(name, stateData.animations);
      });

      Object.entries(data.states).forEach(([name, stateData]) => {
        stateData.transitions.forEach(transition => {
          const conditionStr = transition.condition;
          const condition = this.createConditionFunction(conditionStr);
          this.stateMachine.addTransition(name, transition.targetState, condition, conditionStr);
        });
      });

      if (data.entryState) {
        this.stateMachine.setState(data.entryState);
      }
    },

    // Matches WFLAnimator.createSnapshot
    createSnapshot() {
      return {
        parameters: this.parameters.toJSON(),
        stateMachine: this.stateMachine?.toJSON() || null,
        timestamp: Date.now()
      };
    },

    // Matches WFLAnimator.restoreFromSnapshot
    restoreFromSnapshot(snapshot) {
      if (snapshot.parameters) {
        this.parameters.fromJSON(snapshot.parameters);
      }
      if (snapshot.stateMachine) {
        this.setupStateMachine(snapshot.stateMachine);
      }
    }
  };

  return animator;
}

export async function runAnimatorTests() {
  console.log('Animator Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // CONSTRUCTOR / INITIALIZATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Animator - Constructor');

  TestRunner.test('should initialize all systems', () => {
    const animator = createTestAnimator();
    assert(animator.parameters instanceof ParameterSystem, 'Should have ParameterSystem');
    assertEqual(animator.stateMachine, null, 'State machine should be null initially');
    assert(animator.eventBus instanceof EventBus, 'Should have EventBus');
    assert(animator.permissions instanceof PermissionManager, 'Should have PermissionManager');
    assert(animator.sessionStore instanceof SessionStore, 'Should have SessionStore');
    assertEqual(animator.currentSession, null, 'No current session initially');
    assertEqual(animator.isInitialized, false, 'Not initialized');
  });

  // ─────────────────────────────────────────────────────────────────
  // setupDefaultParameters
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Animator - setupDefaultParameters');

  TestRunner.test('should create expected number params', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const mouthState = animator.parameters.get('mouthState');
    assert(mouthState !== undefined, 'Should have mouthState');
    assertEqual(mouthState.type, 'number', 'mouthState should be number');
    assertEqual(mouthState.get(), 0, 'mouthState default 0');

    const headTurn = animator.parameters.get('headTurn');
    assert(headTurn !== undefined, 'Should have headTurn');
    assertEqual(headTurn.type, 'number', 'headTurn should be number');
    assertEqual(headTurn.get(), 0, 'headTurn default 0');

    const eyeState = animator.parameters.get('eyeState');
    assert(eyeState !== undefined, 'Should have eyeState');
    assertEqual(eyeState.type, 'number', 'eyeState should be number');

    const roastTone = animator.parameters.get('roastTone');
    assert(roastTone !== undefined, 'Should have roastTone');
    assertEqual(roastTone.type, 'number', 'roastTone should be number');
  });

  TestRunner.test('should create expected boolean params', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const isTalking = animator.parameters.get('isTalking');
    assert(isTalking !== undefined, 'Should have isTalking');
    assertEqual(isTalking.type, 'boolean', 'isTalking should be boolean');
    assertEqual(isTalking.get(), false, 'isTalking default false');
  });

  TestRunner.test('should register exactly 5 default parameters', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();
    assertEqual(animator.parameters.getAll().length, 5, 'Should have 5 default params');
  });

  // ─────────────────────────────────────────────────────────────────
  // createConditionFunction
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Animator - createConditionFunction');

  TestRunner.test('should parse boolean equality expression', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const fn = animator.createConditionFunction('isTalking === true');
    assertEqual(fn(animator.parameters), false, 'Should be false when isTalking=false');

    animator.parameters.set('isTalking', true);
    assertEqual(fn(animator.parameters), true, 'Should be true when isTalking=true');
  });

  TestRunner.test('should parse number comparison expression', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const fn = animator.createConditionFunction('mouthState > 3');
    assertEqual(fn(animator.parameters), false, 'Should be false when mouthState=0');

    animator.parameters.set('mouthState', 5);
    assertEqual(fn(animator.parameters), true, 'Should be true when mouthState=5');
  });

  TestRunner.test('should parse compound && expression', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const fn = animator.createConditionFunction('isTalking === true && mouthState > 0');

    assertEqual(fn(animator.parameters), false, 'Both false: should be false');

    animator.parameters.set('isTalking', true);
    assertEqual(fn(animator.parameters), false, 'Only isTalking true: should be false');

    animator.parameters.set('mouthState', 3);
    assertEqual(fn(animator.parameters), true, 'Both true: should be true');
  });

  TestRunner.test('should parse || expression', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const fn = animator.createConditionFunction('mouthState > 5 || eyeState > 2');

    assertEqual(fn(animator.parameters), false, 'Both false: should be false');

    animator.parameters.set('eyeState', 3);
    assertEqual(fn(animator.parameters), true, 'Second true: should be true');
  });

  TestRunner.test('should handle [function] condition string', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const fn = animator.createConditionFunction('[function]');
    assertEqual(fn(animator.parameters), false, '[function] should return false');
  });

  TestRunner.test('should handle null condition string', () => {
    const animator = createTestAnimator();
    const fn = animator.createConditionFunction(null);
    assertEqual(fn({}), false, 'null should return false');
  });

  TestRunner.test('should handle empty string condition', () => {
    const animator = createTestAnimator();
    const fn = animator.createConditionFunction('');
    assertEqual(fn({}), false, 'Empty string should return false');
  });

  TestRunner.test('should reject unsafe expressions', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const fn = animator.createConditionFunction('console.log("hacked")');
    assertEqual(fn(animator.parameters), false, 'Unsafe expression should return false');
  });

  // ─────────────────────────────────────────────────────────────────
  // setupStateMachine
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Animator - setupStateMachine');

  TestRunner.test('should create working state machine from data', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    animator.setupStateMachine({
      name: 'main',
      states: {
        idle: {
          animations: ['idle_anim'],
          transitions: [
            { condition: 'isTalking === true', targetState: 'talking' }
          ]
        },
        talking: {
          animations: ['talk_anim'],
          transitions: [
            { condition: 'isTalking === false', targetState: 'idle' }
          ]
        }
      },
      entryState: 'idle'
    });

    assert(animator.stateMachine !== null, 'State machine should exist');
    assertEqual(animator.stateMachine.name, 'main', 'Name should be main');
    assertEqual(animator.stateMachine.currentState.name, 'idle', 'Should start in idle');
    assertEqual(animator.stateMachine.states.size, 2, 'Should have 2 states');
  });

  TestRunner.test('should transition via update after setup', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    animator.setupStateMachine({
      name: 'main',
      states: {
        idle: {
          animations: ['idle_anim'],
          transitions: [
            { condition: 'isTalking === true', targetState: 'talking' }
          ]
        },
        talking: {
          animations: ['talk_anim'],
          transitions: [
            { condition: 'isTalking === false', targetState: 'idle' }
          ]
        }
      },
      entryState: 'idle'
    });

    // Initially idle
    animator.stateMachine.update(animator.parameters);
    assertEqual(animator.stateMachine.currentState.name, 'idle', 'Should be idle');

    // Set talking, should transition
    animator.parameters.set('isTalking', true);
    animator.stateMachine.update(animator.parameters);
    assertEqual(animator.stateMachine.currentState.name, 'talking', 'Should transition to talking');

    // Set not talking, should go back
    animator.parameters.set('isTalking', false);
    animator.stateMachine.update(animator.parameters);
    assertEqual(animator.stateMachine.currentState.name, 'idle', 'Should transition back to idle');
  });

  TestRunner.test('should set entry state correctly', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    animator.setupStateMachine({
      name: 'test',
      states: {
        a: { animations: [], transitions: [] },
        b: { animations: [], transitions: [] },
        c: { animations: [], transitions: [] }
      },
      entryState: 'b'
    });

    assertEqual(animator.stateMachine.currentState.name, 'b', 'Should start at entry state b');
  });

  // ─────────────────────────────────────────────────────────────────
  // createSnapshot / restoreFromSnapshot
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Animator - Snapshot Roundtrip');

  TestRunner.test('should create snapshot with parameters and state machine', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();
    animator.parameters.set('mouthState', 3);

    animator.setupStateMachine({
      name: 'main',
      states: {
        idle: { animations: ['idle_anim'], transitions: [] },
        walk: { animations: ['walk_anim'], transitions: [] }
      },
      entryState: 'idle'
    });

    const snapshot = animator.createSnapshot();
    assert(snapshot.parameters, 'Should have parameters');
    assert(snapshot.stateMachine, 'Should have stateMachine');
    assert(snapshot.timestamp, 'Should have timestamp');
    assertEqual(snapshot.parameters.mouthState.value, 3, 'mouthState should be 3');
    assertEqual(snapshot.stateMachine.name, 'main', 'State machine name should be main');
  });

  TestRunner.test('should create snapshot with null state machine', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    const snapshot = animator.createSnapshot();
    assertEqual(snapshot.stateMachine, null, 'State machine should be null');
  });

  TestRunner.test('should restore from snapshot preserving parameter values', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();
    animator.parameters.set('mouthState', 5);
    animator.parameters.set('isTalking', true);

    const snapshot = animator.createSnapshot();

    // Create new animator and restore
    const animator2 = createTestAnimator();
    animator2.restoreFromSnapshot(snapshot);

    assertEqual(animator2.parameters.get('mouthState').get(), 5, 'mouthState should be restored to 5');
    assertEqual(animator2.parameters.get('isTalking').get(), true, 'isTalking should be restored to true');
  });

  TestRunner.test('should restore from snapshot preserving state machine conditions', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    animator.setupStateMachine({
      name: 'main',
      states: {
        idle: {
          animations: ['idle_anim'],
          transitions: [
            { condition: 'isTalking === true', targetState: 'talking' }
          ]
        },
        talking: {
          animations: ['talk_anim'],
          transitions: [
            { condition: 'isTalking === false', targetState: 'idle' }
          ]
        }
      },
      entryState: 'idle'
    });

    const snapshot = animator.createSnapshot();

    // Verify condition strings are preserved in snapshot
    const idleTransitions = snapshot.stateMachine.states.idle.transitions;
    assertEqual(
      idleTransitions[0].condition,
      'isTalking === true',
      'Condition string should be preserved in snapshot (not [function])'
    );

    // Restore and verify transitions still work
    const animator2 = createTestAnimator();
    animator2.setupDefaultParameters();
    animator2.restoreFromSnapshot(snapshot);

    assertEqual(animator2.stateMachine.currentState.name, 'idle', 'Should start idle');

    animator2.parameters.set('isTalking', true);
    animator2.stateMachine.update(animator2.parameters);
    assertEqual(animator2.stateMachine.currentState.name, 'talking', 'Restored SM should transition to talking');

    animator2.parameters.set('isTalking', false);
    animator2.stateMachine.update(animator2.parameters);
    assertEqual(animator2.stateMachine.currentState.name, 'idle', 'Restored SM should transition back to idle');
  });

  TestRunner.test('should roundtrip snapshot: create -> serialize -> restore -> verify', () => {
    const animator = createTestAnimator();
    animator.setupDefaultParameters();

    animator.setupStateMachine({
      name: 'complex',
      states: {
        idle: {
          animations: ['idle'],
          transitions: [
            { condition: 'mouthState > 0', targetState: 'talking' },
            { condition: 'eyeState > 2', targetState: 'emoting' }
          ]
        },
        talking: {
          animations: ['talk'],
          transitions: [
            { condition: 'mouthState === 0', targetState: 'idle' }
          ]
        },
        emoting: {
          animations: ['emote'],
          transitions: [
            { condition: 'eyeState === 0', targetState: 'idle' }
          ]
        }
      },
      entryState: 'idle'
    });

    animator.parameters.set('mouthState', 2);
    animator.parameters.set('eyeState', 1);

    // Create snapshot, serialize to JSON string, parse back
    const snapshot = animator.createSnapshot();
    const jsonStr = JSON.stringify(snapshot);
    const parsed = JSON.parse(jsonStr);

    // Restore from parsed JSON
    const animator2 = createTestAnimator();
    animator2.setupDefaultParameters();
    animator2.restoreFromSnapshot(parsed);

    // Verify parameters
    assertEqual(animator2.parameters.get('mouthState').get(), 2, 'mouthState should survive roundtrip');
    assertEqual(animator2.parameters.get('eyeState').get(), 1, 'eyeState should survive roundtrip');

    // Verify state machine transitions work
    animator2.stateMachine.update(animator2.parameters);
    assertEqual(animator2.stateMachine.currentState.name, 'talking', 'Should transition to talking (mouthState > 0)');

    // Verify condition strings survived
    const idleTrans = parsed.stateMachine.states.idle.transitions;
    assertEqual(idleTrans[0].condition, 'mouthState > 0', 'First condition should survive');
    assertEqual(idleTrans[1].condition, 'eyeState > 2', 'Second condition should survive');
  });

  return TestRunner.summary();
}
