/**
 * Tests for Parameter and ParameterSystem
 */

import { TestRunner, assert, assertEqual, assertDeepEqual } from './test-helpers.js';
import { Parameter, ParameterSystem } from '../src/core/parameter.js';

export async function runParameterTests() {
  console.log('Parameter System Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // PARAMETER REGISTRATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - Registration');

  TestRunner.test('should register a number parameter', () => {
    const system = new ParameterSystem();
    const param = system.register('speed', 'number', 5);
    assert(param instanceof Parameter, 'Should return Parameter instance');
    assertEqual(param.name, 'speed', 'Name should match');
    assertEqual(param.type, 'number', 'Type should be number');
    assertEqual(param.get(), 5, 'Default value should be 5');
  });

  TestRunner.test('should register a boolean parameter', () => {
    const system = new ParameterSystem();
    const param = system.register('active', 'boolean', true);
    assertEqual(param.type, 'boolean', 'Type should be boolean');
    assertEqual(param.get(), true, 'Default value should be true');
  });

  TestRunner.test('should register a trigger parameter', () => {
    const system = new ParameterSystem();
    const param = system.register('fire', 'trigger', false);
    assertEqual(param.type, 'trigger', 'Type should be trigger');
    assertEqual(param.get(), false, 'Default value should be false');
  });

  TestRunner.test('should reject invalid parameter type', () => {
    const system = new ParameterSystem();
    let threw = false;
    try {
      system.register('bad', 'string', '');
    } catch (e) {
      threw = true;
      assert(e.message.includes('Invalid parameter type'), 'Error should mention invalid type');
    }
    assert(threw, 'Should throw for invalid type');
  });

  TestRunner.test('should register with null default value', () => {
    const system = new ParameterSystem();
    const param = system.register('val', 'number');
    assertEqual(param.get(), null, 'Default should be null');
  });

  // ─────────────────────────────────────────────────────────────────
  // GET / SET VALUES
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - Get/Set');

  TestRunner.test('should get and set number value', () => {
    const system = new ParameterSystem();
    system.register('x', 'number', 0);
    const result = system.set('x', 42);
    assertEqual(result, true, 'set() should return true');
    assertEqual(system.get('x').get(), 42, 'Value should be 42');
  });

  TestRunner.test('should get and set boolean value', () => {
    const system = new ParameterSystem();
    system.register('flag', 'boolean', false);
    system.set('flag', true);
    assertEqual(system.get('flag').get(), true, 'Value should be true');
  });

  TestRunner.test('should return false when setting non-existent param', () => {
    const system = new ParameterSystem();
    const result = system.set('nonexistent', 10);
    assertEqual(result, false, 'set() should return false for unknown param');
  });

  TestRunner.test('should return undefined for non-existent param get', () => {
    const system = new ParameterSystem();
    assertEqual(system.get('nonexistent'), undefined, 'get() should return undefined');
  });

  TestRunner.test('should allow setting null value', () => {
    const system = new ParameterSystem();
    system.register('val', 'number', 10);
    system.set('val', null);
    assertEqual(system.get('val').get(), null, 'Should accept null');
  });

  // ─────────────────────────────────────────────────────────────────
  // TYPE VALIDATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - Type Validation');

  TestRunner.test('should reject string value for number param', () => {
    const param = new Parameter('x', 'number', 0);
    let threw = false;
    try {
      param.set('hello');
    } catch (e) {
      threw = true;
      assert(e instanceof TypeError, 'Should throw TypeError');
    }
    assert(threw, 'Should throw for invalid type');
  });

  TestRunner.test('should reject number value for boolean param', () => {
    const param = new Parameter('flag', 'boolean', false);
    let threw = false;
    try {
      param.set(123);
    } catch (e) {
      threw = true;
      assert(e instanceof TypeError, 'Should throw TypeError');
    }
    assert(threw, 'Should throw for invalid type');
  });

  TestRunner.test('should accept boolean for trigger param', () => {
    const param = new Parameter('fire', 'trigger', false);
    param.set(true);
    assertEqual(param.get(), true, 'Trigger should accept boolean true');
  });

  TestRunner.test('should reject string value for trigger param', () => {
    const param = new Parameter('fire', 'trigger', false);
    let threw = false;
    try {
      param.set('yes');
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw for string on trigger');
  });

  // ─────────────────────────────────────────────────────────────────
  // onChange LISTENERS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - onChange Listeners');

  TestRunner.test('should fire onChange when value changes', () => {
    const param = new Parameter('x', 'number', 0);
    let callCount = 0;
    let receivedName = null;
    let receivedValue = null;
    let receivedOld = null;

    param.onChange((name, value, oldValue) => {
      callCount++;
      receivedName = name;
      receivedValue = value;
      receivedOld = oldValue;
    });

    param.set(10);
    assertEqual(callCount, 1, 'Listener should fire once');
    assertEqual(receivedName, 'x', 'Should receive param name');
    assertEqual(receivedValue, 10, 'Should receive new value');
    assertEqual(receivedOld, 0, 'Should receive old value');
  });

  TestRunner.test('should fire multiple listeners', () => {
    const param = new Parameter('x', 'number', 0);
    let count1 = 0;
    let count2 = 0;

    param.onChange(() => count1++);
    param.onChange(() => count2++);

    param.set(5);
    assertEqual(count1, 1, 'First listener should fire');
    assertEqual(count2, 1, 'Second listener should fire');
  });

  TestRunner.test('should unsubscribe listener', () => {
    const param = new Parameter('x', 'number', 0);
    let count = 0;

    const unsub = param.onChange(() => count++);
    param.set(1);
    assertEqual(count, 1, 'Should fire before unsub');

    unsub();
    param.set(2);
    assertEqual(count, 1, 'Should not fire after unsub');
  });

  // ─────────────────────────────────────────────────────────────────
  // getAll() AND getByType()
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - getAll / getByType');

  TestRunner.test('should return all parameters', () => {
    const system = new ParameterSystem();
    system.register('a', 'number', 1);
    system.register('b', 'boolean', false);
    system.register('c', 'trigger', false);

    const all = system.getAll();
    assertEqual(all.length, 3, 'Should have 3 params');
  });

  TestRunner.test('should filter by type', () => {
    const system = new ParameterSystem();
    system.register('a', 'number', 1);
    system.register('b', 'number', 2);
    system.register('c', 'boolean', false);

    const numbers = system.getByType('number');
    assertEqual(numbers.length, 2, 'Should have 2 number params');
    const booleans = system.getByType('boolean');
    assertEqual(booleans.length, 1, 'Should have 1 boolean param');
  });

  // ─────────────────────────────────────────────────────────────────
  // toJSON / fromJSON ROUNDTRIP
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - toJSON/fromJSON');

  TestRunner.test('should export to JSON', () => {
    const system = new ParameterSystem();
    system.register('speed', 'number', 5);
    system.register('active', 'boolean', true);

    const json = system.toJSON();
    assertEqual(json.speed.type, 'number', 'Should have speed type');
    assertEqual(json.speed.value, 5, 'Should have speed value');
    assertEqual(json.active.type, 'boolean', 'Should have active type');
    assertEqual(json.active.value, true, 'Should have active value');
  });

  TestRunner.test('should import from JSON', () => {
    const system = new ParameterSystem();
    system.fromJSON({
      speed: { type: 'number', value: 10 },
      active: { type: 'boolean', value: false }
    });

    assertEqual(system.get('speed').get(), 10, 'Speed should be 10');
    assertEqual(system.get('active').get(), false, 'Active should be false');
  });

  TestRunner.test('should roundtrip toJSON -> fromJSON', () => {
    const system1 = new ParameterSystem();
    system1.register('a', 'number', 42);
    system1.register('b', 'boolean', true);
    system1.register('c', 'trigger', false);

    const json = system1.toJSON();

    const system2 = new ParameterSystem();
    system2.fromJSON(json);

    assertEqual(system2.get('a').get(), 42, 'a should roundtrip');
    assertEqual(system2.get('b').get(), true, 'b should roundtrip');
    assertEqual(system2.get('c').get(), false, 'c should roundtrip');
    assertEqual(system2.get('a').type, 'number', 'a type should roundtrip');
    assertEqual(system2.get('b').type, 'boolean', 'b type should roundtrip');
    assertEqual(system2.get('c').type, 'trigger', 'c type should roundtrip');
  });

  return TestRunner.summary();
}
