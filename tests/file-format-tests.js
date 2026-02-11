/**
 * Tests for WFLBinaryFormat and WFLFile binary round-trips
 */

import { TestRunner, assert, assertEqual, assertDeepEqual } from './test-helpers.js';
import { WFLFile, WFLBinaryFormat } from '../src/core/file-format.js';

export async function runFileFormatTests() {
  console.log('File Format (Binary) Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // ENCODE / DECODE ROUNDTRIP
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - Encode/Decode Roundtrip');

  TestRunner.test('should roundtrip a simple object', () => {
    const original = { hello: 'world', num: 42 };
    const buffer = WFLBinaryFormat.encode(original);
    const decoded = WFLBinaryFormat.decode(buffer);
    assertDeepEqual(decoded, original, 'Decoded should match original');
  });

  TestRunner.test('should roundtrip an empty object', () => {
    const original = {};
    const buffer = WFLBinaryFormat.encode(original);
    const decoded = WFLBinaryFormat.decode(buffer);
    assertDeepEqual(decoded, original, 'Decoded empty object should match');
  });

  TestRunner.test('should roundtrip nested data', () => {
    const original = {
      a: { b: { c: [1, 2, 3] } },
      d: true,
      e: null,
      f: 'hello'
    };
    const buffer = WFLBinaryFormat.encode(original);
    const decoded = WFLBinaryFormat.decode(buffer);
    assertDeepEqual(decoded, original, 'Nested data should roundtrip');
  });

  TestRunner.test('should roundtrip unicode strings', () => {
    const original = { emoji: '\u{1F600}\u{1F680}', cjk: '\u4F60\u597D', accent: '\u00E9\u00E0\u00FC' };
    const buffer = WFLBinaryFormat.encode(original);
    const decoded = WFLBinaryFormat.decode(buffer);
    assertDeepEqual(decoded, original, 'Unicode should roundtrip correctly');
  });

  TestRunner.test('should produce an ArrayBuffer', () => {
    const buffer = WFLBinaryFormat.encode({ test: true });
    assert(buffer instanceof ArrayBuffer, 'encode() should return an ArrayBuffer');
  });

  TestRunner.test('should have correct total size', () => {
    const data = { x: 1 };
    const json = JSON.stringify(data);
    const payloadBytes = new TextEncoder().encode(json);
    const buffer = WFLBinaryFormat.encode(data);
    const expectedSize = 12 + payloadBytes.length + 4; // header + payload + checksum
    assertEqual(buffer.byteLength, expectedSize, 'Buffer size should equal header(12) + payload + checksum(4)');
  });

  // ─────────────────────────────────────────────────────────────────
  // MAGIC NUMBER VALIDATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - Magic Number Validation');

  TestRunner.test('should write correct magic number', () => {
    const buffer = WFLBinaryFormat.encode({ a: 1 });
    const view = new DataView(buffer);
    assertEqual(view.getUint32(0, false), 0x57464C42, 'Magic should be 0x57464C42');
  });

  TestRunner.test('should reject buffer with wrong magic number', () => {
    const buffer = WFLBinaryFormat.encode({ a: 1 });
    const view = new DataView(buffer);
    view.setUint32(0, 0xDEADBEEF, false); // corrupt magic

    let threw = false;
    let errorMsg = '';
    try {
      WFLBinaryFormat.decode(buffer);
    } catch (e) {
      threw = true;
      errorMsg = e.message;
    }
    assert(threw, 'Should throw for wrong magic number');
    assert(errorMsg.includes('invalid magic number'), 'Error should mention invalid magic number');
  });

  TestRunner.test('should reject completely empty buffer', () => {
    let threw = false;
    try {
      WFLBinaryFormat.decode(new ArrayBuffer(0));
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw for empty buffer');
  });

  TestRunner.test('should reject buffer too small for header', () => {
    let threw = false;
    try {
      WFLBinaryFormat.decode(new ArrayBuffer(8));
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw for undersized buffer');
  });

  // ─────────────────────────────────────────────────────────────────
  // VERSION CHECKING
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - Version Checking');

  TestRunner.test('should write version 1', () => {
    const buffer = WFLBinaryFormat.encode({ a: 1 });
    const view = new DataView(buffer);
    assertEqual(view.getUint32(4, false), 1, 'Version should be 1');
  });

  TestRunner.test('should accept version 1', () => {
    const buffer = WFLBinaryFormat.encode({ ok: true });
    // version is already 1, just decode
    const decoded = WFLBinaryFormat.decode(buffer);
    assertEqual(decoded.ok, true, 'Version 1 should decode fine');
  });

  TestRunner.test('should reject future version (e.g. 999)', () => {
    const buffer = WFLBinaryFormat.encode({ a: 1 });
    const view = new DataView(buffer);
    view.setUint32(4, 999, false); // set unsupported version

    let threw = false;
    let errorMsg = '';
    try {
      WFLBinaryFormat.decode(buffer);
    } catch (e) {
      threw = true;
      errorMsg = e.message;
    }
    assert(threw, 'Should throw for unsupported version');
    assert(errorMsg.includes('unsupported version'), 'Error should mention unsupported version');
  });

  // ─────────────────────────────────────────────────────────────────
  // CHECKSUM VALIDATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - Checksum Validation');

  TestRunner.test('should detect single byte corruption in payload', () => {
    const buffer = WFLBinaryFormat.encode({ important: 'data' });
    const bytes = new Uint8Array(buffer);
    // Corrupt one byte in the payload region (offset 12 is start of payload)
    bytes[14] = bytes[14] ^ 0xFF;

    let threw = false;
    let errorMsg = '';
    try {
      WFLBinaryFormat.decode(buffer);
    } catch (e) {
      threw = true;
      errorMsg = e.message;
    }
    assert(threw, 'Should throw for corrupted payload');
    assert(errorMsg.includes('checksum mismatch'), 'Error should mention checksum mismatch');
  });

  TestRunner.test('should detect corrupted checksum bytes', () => {
    const buffer = WFLBinaryFormat.encode({ data: 'test' });
    const view = new DataView(buffer);
    const checksumOffset = buffer.byteLength - 4;
    const originalChecksum = view.getUint32(checksumOffset, false);
    view.setUint32(checksumOffset, originalChecksum ^ 0x12345678, false);

    let threw = false;
    try {
      WFLBinaryFormat.decode(buffer);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw for corrupted checksum');
  });

  TestRunner.test('should detect truncated payload', () => {
    const buffer = WFLBinaryFormat.encode({ big: 'data_here_long_string_to_ensure_length' });
    // Declare a longer payload than actually present by shrinking the buffer
    const truncated = buffer.slice(0, buffer.byteLength - 10);

    let threw = false;
    try {
      WFLBinaryFormat.decode(truncated);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw for truncated payload');
  });

  TestRunner.test('should produce consistent checksums for same data', () => {
    const data = { consistency: 'check', n: 123 };
    const buffer1 = WFLBinaryFormat.encode(data);
    const buffer2 = WFLBinaryFormat.encode(data);

    const view1 = new DataView(buffer1);
    const view2 = new DataView(buffer2);
    const chk1 = view1.getUint32(buffer1.byteLength - 4, false);
    const chk2 = view2.getUint32(buffer2.byteLength - 4, false);
    assertEqual(chk1, chk2, 'Same data should produce same checksum');
  });

  // ─────────────────────────────────────────────────────────────────
  // CRC32 UNIT TESTS
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - CRC32');

  TestRunner.test('should compute CRC32 of empty buffer as 0x00000000', () => {
    const crc = WFLBinaryFormat.crc32(new Uint8Array(0));
    assertEqual(crc, 0x00000000, 'CRC32 of empty input should be 0');
  });

  TestRunner.test('should compute known CRC32 for "123456789"', () => {
    // The CRC32 of the ASCII string "123456789" is 0xCBF43926
    const input = new TextEncoder().encode('123456789');
    const crc = WFLBinaryFormat.crc32(input);
    assertEqual(crc, 0xCBF43926, 'CRC32 of "123456789" should be 0xCBF43926');
  });

  // ─────────────────────────────────────────────────────────────────
  // WFLFile INTEGRATION
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - WFLFile Integration');

  TestRunner.test('should roundtrip a full WFLFile', () => {
    const file = new WFLFile();
    file.version = 1;
    file.metadata = { name: 'Hero', author: 'Tester', createdAt: '2026-02-11' };
    file.parameters = {
      speed: { type: 'number', value: 5 },
      isRunning: { type: 'boolean', value: false }
    };
    file.stateMachine = {
      initial: 'idle',
      states: {
        idle: { transitions: [{ target: 'run', condition: 'speed > 0' }] },
        run: { transitions: [{ target: 'idle', condition: 'speed == 0' }] }
      }
    };
    file.animations = {
      idle: { duration: 1.0, loop: true, keyframes: [] },
      run: { duration: 0.5, loop: true, keyframes: [] }
    };
    file.bones = {
      root: { parent: null, children: ['torso'] },
      torso: { parent: 'root', children: [] }
    };

    const buffer = WFLBinaryFormat.encode(file);
    const decoded = WFLBinaryFormat.decode(buffer);

    assertEqual(decoded.version, 1, 'Version should be 1');
    assertEqual(decoded.metadata.name, 'Hero', 'Metadata name should match');
    assertEqual(decoded.metadata.author, 'Tester', 'Metadata author should match');
    assertEqual(decoded.parameters.speed.value, 5, 'Parameter speed should match');
    assertEqual(decoded.stateMachine.initial, 'idle', 'State machine initial should match');
    assertDeepEqual(decoded.animations.idle, file.animations.idle, 'Idle animation should match');
    assertDeepEqual(decoded.bones, file.bones, 'Bones should match');
  });

  TestRunner.test('should roundtrip WFLFile via fromJSON', () => {
    const file = new WFLFile();
    file.metadata = { name: 'Test' };
    file.animations = { walk: { duration: 2.0 } };

    const buffer = WFLBinaryFormat.encode(file);
    const decoded = WFLBinaryFormat.decode(buffer);
    const restored = WFLFile.fromJSON(decoded);

    assertEqual(restored.version, 1, 'Restored version should be 1');
    assertEqual(restored.metadata.name, 'Test', 'Restored metadata name should match');
    assertEqual(restored.animations.walk.duration, 2.0, 'Restored animation duration should match');
  });

  TestRunner.test('should handle WFLFile with empty fields', () => {
    const file = new WFLFile();
    // All defaults - empty metadata, params, animations, bones, null stateMachine

    const buffer = WFLBinaryFormat.encode(file);
    const decoded = WFLBinaryFormat.decode(buffer);

    assertDeepEqual(decoded.metadata, {}, 'Empty metadata should roundtrip');
    assertDeepEqual(decoded.parameters, {}, 'Empty parameters should roundtrip');
    assertEqual(decoded.stateMachine, null, 'Null stateMachine should roundtrip');
    assertDeepEqual(decoded.animations, {}, 'Empty animations should roundtrip');
    assertDeepEqual(decoded.bones, {}, 'Empty bones should roundtrip');
  });

  // ─────────────────────────────────────────────────────────────────
  // NODE.JS BUFFER COMPATIBILITY
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Binary Format - Node.js Buffer Compatibility');

  TestRunner.test('should decode from Node.js Buffer', () => {
    const original = { from: 'buffer-test' };
    const arrayBuffer = WFLBinaryFormat.encode(original);
    const nodeBuffer = Buffer.from(arrayBuffer);

    const decoded = WFLBinaryFormat.decode(nodeBuffer);
    assertDeepEqual(decoded, original, 'Should decode Node.js Buffer correctly');
  });

  TestRunner.test('should decode from Uint8Array', () => {
    const original = { from: 'uint8-test' };
    const arrayBuffer = WFLBinaryFormat.encode(original);
    const uint8 = new Uint8Array(arrayBuffer);

    const decoded = WFLBinaryFormat.decode(uint8);
    assertDeepEqual(decoded, original, 'Should decode Uint8Array correctly');
  });

  return TestRunner.summary();
}
