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

  // ─────────────────────────────────────────────────────────────────
  // has()
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - has()');

  TestRunner.test('should return true for existing parameter', () => {
    const system = new ParameterSystem();
    system.register('speed', 'number', 5);
    assertEqual(system.has('speed'), true, 'Should return true for registered param');
  });

  TestRunner.test('should return false for non-existent parameter', () => {
    const system = new ParameterSystem();
    assertEqual(system.has('nonexistent'), false, 'Should return false for unknown param');
  });

  TestRunner.test('should return true after registering then checking', () => {
    const system = new ParameterSystem();
    assertEqual(system.has('x'), false, 'Should be false before register');
    system.register('x', 'number', 0);
    assertEqual(system.has('x'), true, 'Should be true after register');
  });

  // ─────────────────────────────────────────────────────────────────
  // reset()
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - reset()');

  TestRunner.test('should reset all parameters to default values', () => {
    const system = new ParameterSystem();
    system.register('speed', 'number', 5);
    system.register('active', 'boolean', false);

    system.set('speed', 100);
    system.set('active', true);
    assertEqual(system.get('speed').get(), 100, 'Speed should be 100 before reset');
    assertEqual(system.get('active').get(), true, 'Active should be true before reset');

    system.reset();
    assertEqual(system.get('speed').get(), 5, 'Speed should be reset to 5');
    assertEqual(system.get('active').get(), false, 'Active should be reset to false');
  });

  TestRunner.test('should reset to null default', () => {
    const system = new ParameterSystem();
    system.register('val', 'number');
    system.set('val', 42);
    system.reset();
    assertEqual(system.get('val').get(), null, 'Should reset to null default');
  });

  TestRunner.test('should fire onChange listeners on reset', () => {
    const system = new ParameterSystem();
    system.register('x', 'number', 0);
    system.set('x', 10);

    let called = false;
    system.get('x').onChange(() => { called = true; });
    system.reset();
    assertEqual(called, true, 'onChange should fire during reset');
  });

  // ─────────────────────────────────────────────────────────────────
  // setMultiple()
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - setMultiple()');

  TestRunner.test('should set multiple parameters at once', () => {
    const system = new ParameterSystem();
    system.register('a', 'number', 0);
    system.register('b', 'number', 0);
    system.register('c', 'boolean', false);

    system.setMultiple({ a: 10, b: 20, c: true });
    assertEqual(system.get('a').get(), 10, 'a should be 10');
    assertEqual(system.get('b').get(), 20, 'b should be 20');
    assertEqual(system.get('c').get(), true, 'c should be true');
  });

  TestRunner.test('should silently ignore non-existent parameters in setMultiple', () => {
    const system = new ParameterSystem();
    system.register('a', 'number', 0);

    // Should not throw even though 'b' does not exist
    system.setMultiple({ a: 5, b: 99 });
    assertEqual(system.get('a').get(), 5, 'a should be set');
  });

  TestRunner.test('should fire onChange for each parameter in setMultiple', () => {
    const system = new ParameterSystem();
    system.register('x', 'number', 0);
    system.register('y', 'number', 0);

    const changed = [];
    system.get('x').onChange((name) => changed.push(name));
    system.get('y').onChange((name) => changed.push(name));

    system.setMultiple({ x: 1, y: 2 });
    assert(changed.includes('x'), 'x onChange should fire');
    assert(changed.includes('y'), 'y onChange should fire');
  });

  // ─────────────────────────────────────────────────────────────────
  // Parameter.defaultValue
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Parameter - defaultValue tracking');

  TestRunner.test('should store defaultValue on Parameter instance', () => {
    const param = new Parameter('x', 'number', 42);
    assertEqual(param.defaultValue, 42, 'defaultValue should be stored');
    param.set(100);
    assertEqual(param.defaultValue, 42, 'defaultValue should not change after set');
  });

  return TestRunner.summary();
}
