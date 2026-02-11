/**
 * Parameter System - Controls animation via named parameters
 * Inspired by Rive's state machine inputs
 */

const VALID_TYPES = ['number', 'boolean', 'trigger'];

export class Parameter {
  constructor(name, type, defaultValue = null) {
    this.name = name;
    this.type = type; // 'number', 'boolean', 'trigger'
    this.value = defaultValue;
    this.listeners = [];
  }

  set(value) {
    if (!this.validateType(value)) {
      throw new TypeError(`Invalid value for ${this.type} parameter "${this.name}": ${typeof value}`);
    }

    const oldValue = this.value;
    this.value = value;

    // Notify listeners
    this.listeners.forEach(listener => {
      listener(this.name, value, oldValue);
    });
  }

  get() {
    return this.value;
  }

  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }

  validateType(value) {
    if (value === null) return true;
    switch (this.type) {
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'trigger': return typeof value === 'boolean';
      default: return true;
    }
  }
}

export class ParameterSystem {
  constructor() {
    this.parameters = new Map();
  }

  /**
   * Register a parameter
   */
  register(name, type, defaultValue = null) {
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid parameter type: ${type}. Must be one of: ${VALID_TYPES.join(', ')}`);
    }
    const param = new Parameter(name, type, defaultValue);
    this.parameters.set(name, param);
    return param;
  }

  /**
   * Get a parameter
   */
  get(name) {
    return this.parameters.get(name);
  }

  /**
   * Set a parameter value
   */
  set(name, value) {
    const param = this.parameters.get(name);
    if (param) {
      param.set(value);
      return true;
    }
    return false;
  }

  /**
   * Get all parameters
   */
  getAll() {
    return Array.from(this.parameters.values());
  }

  /**
   * Get parameters by type
   */
  getByType(type) {
    return Array.from(this.parameters.values()).filter(p => p.type === type);
  }

  /**
   * Export parameters to JSON
   */
  toJSON() {
    const params = {};
    this.parameters.forEach((param, name) => {
      params[name] = {
        type: param.type,
        value: param.value
      };
    });
    return params;
  }

  /**
   * Import parameters from JSON
   */
  fromJSON(data) {
    Object.entries(data).forEach(([name, config]) => {
      this.register(name, config.type, config.value);
    });
  }
}
