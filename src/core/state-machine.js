/**
 * State Machine - Handles animation state transitions
 */

export class State {
  constructor(name, animations = []) {
    this.name = name;
    this.animations = animations; // Array of animation names
    this.transitions = [];
  }

  addTransition(condition, targetState, conditionStr = null) {
    this.transitions.push({ condition, targetState, conditionStr });
  }
}

export class StateMachine {
  constructor(name) {
    this.name = name;
    this.states = new Map();
    this.currentState = null;
    this.entryState = null;
    this.onStateChange = null;
    this._stateEnterCallbacks = [];
    this._stateExitCallbacks = [];
    this.eventBus = null;
  }

  /**
   * Add a state
   */
  addState(name, animations = []) {
    const state = new State(name, animations);
    this.states.set(name, state);

    // Set as entry state if it's the first one
    if (!this.entryState) {
      this.entryState = state;
      this.currentState = state;
    }

    return state;
  }

  /**
   * Add a transition between states
   */
  addTransition(fromStateName, toStateName, condition, conditionStr = null) {
    const fromState = this.states.get(fromStateName);
    const toState = this.states.get(toStateName);

    if (!fromState || !toState) {
      throw new Error(`State not found: ${fromStateName} or ${toStateName}`);
    }

    fromState.addTransition(condition, toState, conditionStr);
  }

  /**
   * Remove a state and all transitions referencing it
   */
  removeState(name) {
    const state = this.states.get(name);
    if (!state) return false;

    // Remove transitions from other states that target this state
    this.states.forEach((s) => {
      s.transitions = s.transitions.filter(t => t.targetState !== state);
    });

    // If this was the entry state, clear it
    if (this.entryState === state) {
      this.entryState = null;
    }

    // If this was the current state, clear it
    if (this.currentState === state) {
      this.currentState = null;
    }

    this.states.delete(name);
    return true;
  }

  /**
   * Remove a specific transition between two states
   */
  removeTransition(fromStateName, toStateName) {
    const fromState = this.states.get(fromStateName);
    const toState = this.states.get(toStateName);
    if (!fromState || !toState) return false;

    const before = fromState.transitions.length;
    fromState.transitions = fromState.transitions.filter(t => t.targetState !== toState);
    return fromState.transitions.length < before;
  }

  /**
   * Get a state by name (or undefined)
   */
  getState(name) {
    return this.states.get(name);
  }

  /**
   * Get transitions from a state
   */
  getTransitions(stateName) {
    const state = this.states.get(stateName);
    if (!state) return [];
    return state.transitions;
  }

  /**
   * Validate the state machine for unreachable states
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validate() {
    const issues = [];

    if (this.states.size === 0) {
      issues.push('State machine has no states');
      return { valid: issues.length === 0, issues };
    }

    if (!this.entryState) {
      issues.push('No entry state defined');
    }

    // Find reachable states via BFS from entry state
    const reachable = new Set();
    if (this.entryState) {
      const queue = [this.entryState.name];
      while (queue.length > 0) {
        const current = queue.shift();
        if (reachable.has(current)) continue;
        reachable.add(current);
        const state = this.states.get(current);
        if (state) {
          for (const t of state.transitions) {
            if (!reachable.has(t.targetState.name)) {
              queue.push(t.targetState.name);
            }
          }
        }
      }
    }

    // Check for unreachable states
    this.states.forEach((_state, name) => {
      if (!reachable.has(name)) {
        issues.push(`State "${name}" is unreachable from entry state`);
      }
    });

    return { valid: issues.length === 0, issues };
  }

  /**
   * Register a callback to fire when entering a state
   */
  onStateEnter(callback) {
    this._stateEnterCallbacks.push(callback);
    return () => {
      const idx = this._stateEnterCallbacks.indexOf(callback);
      if (idx > -1) this._stateEnterCallbacks.splice(idx, 1);
    };
  }

  /**
   * Register a callback to fire when exiting a state
   */
  onStateExit(callback) {
    this._stateExitCallbacks.push(callback);
    return () => {
      const idx = this._stateExitCallbacks.indexOf(callback);
      if (idx > -1) this._stateExitCallbacks.splice(idx, 1);
    };
  }

  /**
   * Evaluate transitions and update state
   */
  update(parameters) {
    if (!this.currentState) return;

    // Check all transitions from current state
    for (const transition of this.currentState.transitions) {
      if (transition.condition(parameters)) {
        this.setState(transition.targetState);
        break;
      }
    }
  }

  /**
   * Set the current state
   */
  setState(stateOrName) {
    const state = typeof stateOrName === 'string'
      ? this.states.get(stateOrName)
      : stateOrName;

    if (!state) return;

    const oldState = this.currentState;

    // Emit TRANSITION_START event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'transition.start',
        payload: { fromState: oldState?.name, toState: state.name }
      });
    }

    // Fire exit callbacks for old state
    if (oldState) {
      this._stateExitCallbacks.forEach(cb => cb(oldState.name));
      if (this.eventBus) {
        this.eventBus.emit({
          type: 'state.exit',
          payload: { state: oldState.name }
        });
      }
    }

    this.currentState = state;

    // Fire enter callbacks for new state
    this._stateEnterCallbacks.forEach(cb => cb(state.name));
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'state.enter',
        payload: { state: state.name }
      });
    }

    if (this.onStateChange) {
      this.onStateChange(state.name, oldState?.name);
    }

    // Emit TRANSITION_COMPLETE event
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'transition.complete',
        payload: { fromState: oldState?.name, toState: state.name }
      });
    }
  }

  /**
   * Get current state animations
   */
  getCurrentAnimations() {
    return this.currentState?.animations || [];
  }

  /**
   * Reset to entry state
   */
  reset() {
    if (this.entryState) {
      this.setState(this.entryState);
    }
  }

  /**
   * Export to JSON
   */
  toJSON() {
    const states = {};
    this.states.forEach((state, name) => {
      states[name] = {
        animations: state.animations,
        transitions: state.transitions.map(t => ({
          targetState: t.targetState.name,
          condition: t.conditionStr || '[function]'
        }))
      };
    });

    return {
      name: this.name,
      states,
      entryState: this.entryState?.name,
      currentState: this.currentState?.name
    };
  }
}
