/**
 * WFL File Format - JSON-based animation file format
 *
 * Format:
 * {
 *   "version": 1,
 *   "metadata": { ... },
 *   "parameters": { ... },
 *   "stateMachine": { ... },
 *   "animations": { ... },
 *   "bones": { ... }
 * }
 */

export class WFLFile {
  constructor() {
    this.version = 1;
    this.metadata = {};
    this.parameters = {};
    this.stateMachine = null;
    this.animations = {};
    this.bones = {};
  }

  /**
   * Load from JSON
   */
  static fromJSON(json) {
    const file = new WFLFile();
    file.version = json.version || 1;
    file.metadata = json.metadata || {};
    file.parameters = json.parameters || {};
    file.stateMachine = json.stateMachine || null;
    file.animations = json.animations || {};
    file.bones = json.bones || {};
    return file;
  }

  /**
   * Export to JSON
   */
  toJSON() {
    return {
      version: this.version,
      metadata: this.metadata,
      parameters: this.parameters,
      stateMachine: this.stateMachine,
      animations: this.animations,
      bones: this.bones
    };
  }

  /**
   * Load from file
   */
  static async load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: HTTP ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return WFLFile.fromJSON(json);
  }

  /**
   * Save to file (download)
   */
  download(filename = 'animation.wfl') {
    const json = this.toJSON();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Binary format (optional, for compact files)
 *
 * Binary layout:
 *   Offset  Size  Description
 *   0       4     Magic number: 0x57464C42 ("WFLB")
 *   4       4     Version: uint32 big-endian (currently 1)
 *   8       4     Payload length: uint32 big-endian (byte length of JSON)
 *   12      N     JSON payload: UTF-8 encoded string
 *   12+N    4     Checksum: CRC32 of the JSON payload bytes
 *
 * Total size: 16 + N bytes
 */
export class WFLBinaryFormat {
  static MAGIC = 0x57464C42;   // "WFLB"
  static VERSION = 1;
  static HEADER_SIZE = 12;     // magic(4) + version(4) + length(4)
  static CHECKSUM_SIZE = 4;

  // ── CRC32 ──────────────────────────────────────────────────────────
  // Pre-computed CRC32 lookup table (IEEE 802.3 polynomial 0xEDB88320)
  static _crc32Table = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1);
      }
      table[i] = crc;
    }
    return table;
  })();

  /**
   * Compute CRC32 over a Uint8Array
   * @param {Uint8Array} bytes
   * @returns {number} unsigned 32-bit CRC
   */
  static crc32(bytes) {
    const table = WFLBinaryFormat._crc32Table;
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;   // unsigned
  }

  // ── Encode ─────────────────────────────────────────────────────────
  /**
   * Encode a WFLFile (or plain object) into a binary ArrayBuffer.
   *
   * @param {WFLFile|object} data  – anything with a .toJSON() or that is
   *                                  already a plain JSON-serialisable object
   * @returns {ArrayBuffer}
   */
  static encode(data) {
    // Normalise to a plain object
    const json = (typeof data.toJSON === 'function') ? data.toJSON() : data;
    const jsonString = JSON.stringify(json);

    // Encode JSON string to UTF-8 bytes
    const payloadBytes = WFLBinaryFormat._encodeUTF8(jsonString);
    const payloadLength = payloadBytes.length;

    // Compute checksum over the payload
    const checksum = WFLBinaryFormat.crc32(payloadBytes);

    // Allocate the full buffer
    const totalSize = WFLBinaryFormat.HEADER_SIZE + payloadLength + WFLBinaryFormat.CHECKSUM_SIZE;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Write header
    view.setUint32(0, WFLBinaryFormat.MAGIC, false);      // big-endian
    view.setUint32(4, WFLBinaryFormat.VERSION, false);
    view.setUint32(8, payloadLength, false);

    // Write payload
    bytes.set(payloadBytes, WFLBinaryFormat.HEADER_SIZE);

    // Write checksum
    view.setUint32(WFLBinaryFormat.HEADER_SIZE + payloadLength, checksum, false);

    return buffer;
  }

  // ── Decode ─────────────────────────────────────────────────────────
  /**
   * Decode a binary ArrayBuffer (or Node.js Buffer) back to an object.
   *
   * @param {ArrayBuffer|Buffer} buffer
   * @returns {object} the decoded JSON data
   * @throws {Error} on magic mismatch, unsupported version, or bad checksum
   */
  static decode(buffer) {
    // Accept Node.js Buffer transparently
    const ab = WFLBinaryFormat._toArrayBuffer(buffer);

    if (ab.byteLength < WFLBinaryFormat.HEADER_SIZE + WFLBinaryFormat.CHECKSUM_SIZE) {
      throw new Error('WFLBinary: buffer too small to contain a valid file');
    }

    const view = new DataView(ab);

    // ── Magic ────────────────────────────────────────────────────────
    const magic = view.getUint32(0, false);
    if (magic !== WFLBinaryFormat.MAGIC) {
      throw new Error(
        `WFLBinary: invalid magic number 0x${magic.toString(16).toUpperCase()}, ` +
        `expected 0x${WFLBinaryFormat.MAGIC.toString(16).toUpperCase()}`
      );
    }

    // ── Version ──────────────────────────────────────────────────────
    const version = view.getUint32(4, false);
    if (version > WFLBinaryFormat.VERSION) {
      throw new Error(
        `WFLBinary: unsupported version ${version}, ` +
        `maximum supported is ${WFLBinaryFormat.VERSION}`
      );
    }

    // ── Payload length ───────────────────────────────────────────────
    const payloadLength = view.getUint32(8, false);
    const expectedSize = WFLBinaryFormat.HEADER_SIZE + payloadLength + WFLBinaryFormat.CHECKSUM_SIZE;
    if (ab.byteLength < expectedSize) {
      throw new Error(
        `WFLBinary: buffer too small – expected at least ${expectedSize} bytes, ` +
        `got ${ab.byteLength}`
      );
    }

    // ── Payload ──────────────────────────────────────────────────────
    const payloadBytes = new Uint8Array(ab, WFLBinaryFormat.HEADER_SIZE, payloadLength);

    // ── Checksum ─────────────────────────────────────────────────────
    const storedChecksum = view.getUint32(WFLBinaryFormat.HEADER_SIZE + payloadLength, false);
    const computedChecksum = WFLBinaryFormat.crc32(payloadBytes);
    if (storedChecksum !== computedChecksum) {
      throw new Error(
        `WFLBinary: checksum mismatch – stored 0x${storedChecksum.toString(16).toUpperCase()}, ` +
        `computed 0x${computedChecksum.toString(16).toUpperCase()}`
      );
    }

    // ── Decode JSON ──────────────────────────────────────────────────
    const jsonString = WFLBinaryFormat._decodeUTF8(payloadBytes);
    return JSON.parse(jsonString);
  }

  // ── UTF-8 helpers (work in Node.js & browser) ──────────────────────

  /**
   * Encode a string to UTF-8 bytes.
   * Uses TextEncoder when available, falls back to Buffer (Node.js).
   * @param {string} str
   * @returns {Uint8Array}
   */
  static _encodeUTF8(str) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    // Node.js fallback (< v11 had no global TextEncoder)
    const buf = Buffer.from(str, 'utf-8');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  /**
   * Decode UTF-8 bytes to a string.
   * @param {Uint8Array} bytes
   * @returns {string}
   */
  static _decodeUTF8(bytes) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(bytes).toString('utf-8');
  }

  /**
   * Normalise a Node.js Buffer (or anything with .buffer) to an ArrayBuffer.
   * @param {ArrayBuffer|Buffer|Uint8Array} input
   * @returns {ArrayBuffer}
   */
  static _toArrayBuffer(input) {
    if (input instanceof ArrayBuffer) {
      return input;
    }
    // Node.js Buffer or TypedArray – copy the relevant slice
    if (input.buffer instanceof ArrayBuffer) {
      // If the underlying ArrayBuffer is exactly the right size, use it directly
      if (input.byteOffset === 0 && input.byteLength === input.buffer.byteLength) {
        return input.buffer;
      }
      // Otherwise slice to get a clean ArrayBuffer
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    throw new TypeError('WFLBinary: expected ArrayBuffer, Buffer, or TypedArray');
  }
}
