/**
 * State Machine - Handles animation state transitions
 */

export class State {
  constructor(name, animations = []) {
    this.name = name;
    this.animations = animations; // Array of animation names
    this.transitions = [];
  }

  addTransition(condition, targetState) {
    this.transitions.push({ condition, targetState });
  }
}

export class Transition {
  constructor(fromState, toState, condition) {
    this.fromState = fromState;
    this.toState = toState;
    this.condition = condition; // Function that returns true when transition should occur
  }
}

export class StateMachine {
  constructor(name) {
    this.name = name;
    this.states = new Map();
    this.currentState = null;
    this.entryState = null;
    this.onStateChange = null;
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
  addTransition(fromStateName, toStateName, condition) {
    const fromState = this.states.get(fromStateName);
    const toState = this.states.get(toStateName);
    
    if (!fromState || !toState) {
      throw new Error(`State not found: ${fromStateName} or ${toStateName}`);
    }
    
    fromState.addTransition(condition, toState);
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
  setState(state) {
    if (typeof state === 'string') {
      state = this.states.get(state);
    }
    
    if (!state) return;
    
    const oldState = this.currentState;
    this.currentState = state;
    
    if (this.onStateChange) {
      this.onStateChange(state.name, oldState?.name);
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
          condition: t.condition.toString() // Note: Functions are serialized as strings
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

