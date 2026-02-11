/**
 * Tests for State and StateMachine
 */

import { TestRunner, assert, assertEqual, assertDeepEqual } from './test-helpers.js';
import { State, StateMachine } from '../src/core/state-machine.js';
import { ParameterSystem } from '../src/core/parameter.js';

export async function runStateMachineTests() {
  console.log('State Machine Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // STATE CREATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - State Creation');

  TestRunner.test('should create a state machine', () => {
    const sm = new StateMachine('test');
    assertEqual(sm.name, 'test', 'Name should match');
    assertEqual(sm.currentState, null, 'No current state initially');
    assertEqual(sm.entryState, null, 'No entry state initially');
  });

  TestRunner.test('should add states', () => {
    const sm = new StateMachine('test');
    const idle = sm.addState('idle', ['idle_anim']);
    const walk = sm.addState('walk', ['walk_anim']);

    assert(idle instanceof State, 'Should return State instance');
    assertEqual(idle.name, 'idle', 'State name should match');
    assertDeepEqual(idle.animations, ['idle_anim'], 'Animations should match');
    assertEqual(sm.states.size, 2, 'Should have 2 states');
  });

  TestRunner.test('should set first added state as entry and current', () => {
    const sm = new StateMachine('test');
    const idle = sm.addState('idle', ['idle_anim']);
    sm.addState('walk', ['walk_anim']);

    assertEqual(sm.entryState, idle, 'Entry state should be first added');
    assertEqual(sm.currentState, idle, 'Current state should be first added');
  });

  TestRunner.test('should create state with empty animations', () => {
    const sm = new StateMachine('test');
    const state = sm.addState('empty');
    assertDeepEqual(state.animations, [], 'Default animations should be empty array');
  });

  // ─────────────────────────────────────────────────────────────────
  // TRANSITIONS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - Transitions');

  TestRunner.test('should add transition between states', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');

    sm.addTransition('idle', 'walk', () => true, 'always');
    const idle = sm.states.get('idle');
    assertEqual(idle.transitions.length, 1, 'Should have 1 transition');
    assertEqual(idle.transitions[0].targetState.name, 'walk', 'Target should be walk');
    assertEqual(idle.transitions[0].conditionStr, 'always', 'conditionStr should be preserved');
  });

  TestRunner.test('should throw for non-existent states in transition', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');

    let threw = false;
    try {
      sm.addTransition('idle', 'nonexistent', () => true);
    } catch (e) {
      threw = true;
      assert(e.message.includes('State not found'), 'Error should mention state not found');
    }
    assert(threw, 'Should throw for non-existent target state');
  });

  TestRunner.test('should transition when condition is true', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');

    const params = new ParameterSystem();
    params.register('isWalking', 'boolean', false);

    sm.addTransition('idle', 'walk', (p) => {
      const param = p.get('isWalking');
      return param && param.get() === true;
    });

    // Should stay in idle when isWalking is false
    sm.update(params);
    assertEqual(sm.currentState.name, 'idle', 'Should stay in idle');

    // Should transition when isWalking becomes true
    params.set('isWalking', true);
    sm.update(params);
    assertEqual(sm.currentState.name, 'walk', 'Should transition to walk');
  });

  TestRunner.test('should not transition when condition is false', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');

    sm.addTransition('idle', 'walk', () => false);

    const params = new ParameterSystem();
    sm.update(params);
    assertEqual(sm.currentState.name, 'idle', 'Should remain in idle');
  });

  // ─────────────────────────────────────────────────────────────────
  // CONDITION EVALUATION WITH PARAMETERS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - Condition Evaluation');

  TestRunner.test('should evaluate number comparison condition', () => {
    const sm = new StateMachine('test');
    sm.addState('low');
    sm.addState('high');

    const params = new ParameterSystem();
    params.register('score', 'number', 0);

    sm.addTransition('low', 'high', (p) => {
      const param = p.get('score');
      return param && param.get() > 50;
    });

    sm.update(params);
    assertEqual(sm.currentState.name, 'low', 'Should be low when score=0');

    params.set('score', 75);
    sm.update(params);
    assertEqual(sm.currentState.name, 'high', 'Should be high when score=75');
  });

  TestRunner.test('should evaluate compound condition', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('running');

    const params = new ParameterSystem();
    params.register('speed', 'number', 0);
    params.register('isActive', 'boolean', false);

    sm.addTransition('idle', 'running', (p) => {
      const speed = p.get('speed');
      const active = p.get('isActive');
      return speed && active && speed.get() > 0 && active.get() === true;
    });

    // Neither condition met
    sm.update(params);
    assertEqual(sm.currentState.name, 'idle', 'Should be idle initially');

    // Only speed met
    params.set('speed', 5);
    sm.update(params);
    assertEqual(sm.currentState.name, 'idle', 'Should be idle with only speed set');

    // Both conditions met
    params.set('isActive', true);
    sm.update(params);
    assertEqual(sm.currentState.name, 'running', 'Should transition to running');
  });

  // ─────────────────────────────────────────────────────────────────
  // toJSON SERIALIZATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - toJSON Serialization');

  TestRunner.test('should serialize to JSON', () => {
    const sm = new StateMachine('main');
    sm.addState('idle', ['idle_anim']);
    sm.addState('walk', ['walk_anim']);
    sm.addTransition('idle', 'walk', () => true, 'isWalking === true');

    const json = sm.toJSON();
    assertEqual(json.name, 'main', 'Name should be serialized');
    assertEqual(json.entryState, 'idle', 'Entry state should be serialized');
    assertEqual(json.currentState, 'idle', 'Current state should be serialized');
    assert(json.states.idle, 'Should have idle state');
    assert(json.states.walk, 'Should have walk state');
    assertDeepEqual(json.states.idle.animations, ['idle_anim'], 'Idle animations should serialize');
  });

  TestRunner.test('should preserve condition strings in toJSON', () => {
    const sm = new StateMachine('main');
    sm.addState('idle');
    sm.addState('walk');

    const conditionStr = 'isWalking === true';
    sm.addTransition('idle', 'walk', () => true, conditionStr);

    const json = sm.toJSON();
    assertEqual(
      json.states.idle.transitions[0].condition,
      conditionStr,
      'Condition string should be preserved in JSON'
    );
  });

  TestRunner.test('should use [function] when no conditionStr provided', () => {
    const sm = new StateMachine('main');
    sm.addState('idle');
    sm.addState('walk');
    sm.addTransition('idle', 'walk', () => true);

    const json = sm.toJSON();
    assertEqual(
      json.states.idle.transitions[0].condition,
      '[function]',
      'Should fall back to [function] when no conditionStr'
    );
  });

  TestRunner.test('should serialize target state name', () => {
    const sm = new StateMachine('main');
    sm.addState('a');
    sm.addState('b');
    sm.addTransition('a', 'b', () => true, 'test');

    const json = sm.toJSON();
    assertEqual(json.states.a.transitions[0].targetState, 'b', 'Target should be state name string');
  });

  // ─────────────────────────────────────────────────────────────────
  // setState
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - setState');

  TestRunner.test('should set state by name', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');

    sm.setState('walk');
    assertEqual(sm.currentState.name, 'walk', 'Should be walk after setState by name');
  });

  TestRunner.test('should set state by object', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    const walk = sm.addState('walk');

    sm.setState(walk);
    assertEqual(sm.currentState.name, 'walk', 'Should be walk after setState by object');
  });

  TestRunner.test('should fire onStateChange callback', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');

    let newName = null;
    let oldName = null;
    sm.onStateChange = (n, o) => {
      newName = n;
      oldName = o;
    };

    sm.setState('walk');
    assertEqual(newName, 'walk', 'New state name should be walk');
    assertEqual(oldName, 'idle', 'Old state name should be idle');
  });

  TestRunner.test('should do nothing for non-existent state name', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');

    sm.setState('nonexistent');
    assertEqual(sm.currentState.name, 'idle', 'Should remain in idle');
  });

  // ─────────────────────────────────────────────────────────────────
  // getCurrentAnimations
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - getCurrentAnimations');

  TestRunner.test('should return current state animations', () => {
    const sm = new StateMachine('test');
    sm.addState('idle', ['idle_anim', 'breathe']);
    sm.addState('walk', ['walk_anim']);

    assertDeepEqual(sm.getCurrentAnimations(), ['idle_anim', 'breathe'], 'Should return idle animations');

    sm.setState('walk');
    assertDeepEqual(sm.getCurrentAnimations(), ['walk_anim'], 'Should return walk animations');
  });

  TestRunner.test('should return empty array when no current state', () => {
    const sm = new StateMachine('test');
    // No states added, currentState is null
    assertDeepEqual(sm.getCurrentAnimations(), [], 'Should return empty array');
  });

  // ─────────────────────────────────────────────────────────────────
  // reset()
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('StateMachine - reset');

  TestRunner.test('should reset to entry state', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');
    sm.addState('run');

    sm.setState('run');
    assertEqual(sm.currentState.name, 'run', 'Should be in run');

    sm.reset();
    assertEqual(sm.currentState.name, 'idle', 'Should be back in idle after reset');
  });

  TestRunner.test('should fire onStateChange on reset', () => {
    const sm = new StateMachine('test');
    sm.addState('idle');
    sm.addState('walk');

    sm.setState('walk');

    let called = false;
    sm.onStateChange = () => { called = true; };
    sm.reset();
    assert(called, 'onStateChange should fire on reset');
  });

  TestRunner.test('should handle reset when no entry state', () => {
    const sm = new StateMachine('test');
    // No states, no entry state
    sm.reset(); // should not throw
    assertEqual(sm.currentState, null, 'Should remain null');
  });

  return TestRunner.summary();
}
