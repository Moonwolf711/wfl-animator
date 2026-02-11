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
 */
export class WFLBinaryFormat {
  /**
   * Encode to binary
   */
  static encode(_file) {
    // TODO: Implement binary encoding
    // Use what we learned from Rive:
    // - LEB128 for integers
    // - Property keys
    // - Tagged unions for values
    throw new Error('Binary format not yet implemented');
  }

  /**
   * Decode from binary
   */
  static decode(_buffer) {
    // TODO: Implement binary decoding
    throw new Error('Binary format not yet implemented');
  }
}
