/**
 * Event Bus - IPC-like event system for WFL Animator
 * Inspired by Claude-Cowork's IPC handlers pattern
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
    this.history = [];
    this.maxHistory = 100;
  }

  /**
   * Subscribe to an event type
   * @param {string} type - Event type
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);

    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(callback);
        if (typeListeners.size === 0) {
          this.listeners.delete(type);
        }
      }
    };
  }

  /**
   * Subscribe to an event type (one-time)
   * @param {string} type - Event type
   * @param {Function} callback - Handler function
   */
  once(type, callback) {
    const unsubscribe = this.on(type, (event) => {
      unsubscribe();
      callback(event);
    });
    return unsubscribe;
  }

  /**
   * Emit an event
   * @param {Object} event - Event object with type and payload
   */
  emit(event) {
    if (!event.type) {
      throw new Error('Event must have a type');
    }

    // Add timestamp and store in history
    const timestampedEvent = {
      ...event,
      timestamp: Date.now()
    };

    this.history.push(timestampedEvent);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Notify listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(callback => {
        try {
          callback(timestampedEvent);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }

    // Also notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => {
        try {
          callback(timestampedEvent);
        } catch (error) {
          console.error(`Error in wildcard listener:`, error);
        }
      });
    }
  }

  /**
   * Broadcast to all listeners (alias for emit)
   */
  broadcast(event) {
    this.emit(event);
  }

  /**
   * Get event history
   * @param {string} [type] - Filter by event type
   * @param {number} [limit] - Max events to return
   */
  getHistory(type = null, limit = 50) {
    let events = this.history;
    if (type) {
      events = events.filter(e => e.type === type);
    }
    return events.slice(-limit);
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }
}

// Event types for WFL Animator
export const EventTypes = {
  // Animation events
  ANIMATION_START: 'animation.start',
  ANIMATION_STOP: 'animation.stop',
  ANIMATION_FRAME: 'animation.frame',
  ANIMATION_COMPLETE: 'animation.complete',

  // Parameter events
  PARAMETER_CHANGE: 'parameter.change',
  PARAMETER_REGISTER: 'parameter.register',

  // State machine events
  STATE_CHANGE: 'state.change',
  STATE_ENTER: 'state.enter',
  STATE_EXIT: 'state.exit',
  TRANSITION_START: 'transition.start',
  TRANSITION_COMPLETE: 'transition.complete',

  // Session events
  SESSION_CREATE: 'session.create',
  SESSION_LOAD: 'session.load',
  SESSION_SAVE: 'session.save',
  SESSION_DELETE: 'session.delete',
  SESSION_LIST: 'session.list',

  // Stream events (for partial updates)
  STREAM_START: 'stream.start',
  STREAM_UPDATE: 'stream.update',
  STREAM_COMPLETE: 'stream.complete',
  STREAM_ERROR: 'stream.error',

  // Permission events
  PERMISSION_REQUEST: 'permission.request',
  PERMISSION_RESPONSE: 'permission.response',

  // Error events
  ERROR: 'error',
  WARNING: 'warning'
};

// Singleton instance for global event bus
export const globalEventBus = new EventBus();
