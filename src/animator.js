/**
 * WFL Animator - Main animation controller
 * Combines parameter system, state machine, bone rigging,
 * with Claude-Cowork inspired patterns: streaming, permissions, sessions
 */

import { ParameterSystem } from './core/parameter.js';
import { StateMachine } from './core/state-machine.js';
import { WFLFile } from './core/file-format.js';
import { DragonBonesRigging } from './rigging/dragon-bones.js';
import { EventBus, EventTypes, globalEventBus } from './core/event-bus.js';
import { StreamingState, StreamingAnimationLoader } from './core/streaming.js';
import { PermissionManager, PermissionDialog, PermissionActions, globalPermissionManager } from './core/permission.js';
import { SessionStore, globalSessionStore } from './core/session-store.js';

export class WFLAnimator {
  constructor(options = {}) {
    // Core systems
    this.parameters = new ParameterSystem();
    this.stateMachine = null;
    this.rigging = new DragonBonesRigging();
    this.file = null;
    this.canvas = null;
    this.context = null;
    this.animationFrame = null;
    this.lastTime = 0;

    // Claude-Cowork inspired systems
    this.eventBus = options.eventBus || globalEventBus;
    this.streaming = new StreamingState(this.eventBus);
    this.streamingLoader = new StreamingAnimationLoader(this.eventBus);
    this.permissions = options.permissionManager || globalPermissionManager;
    this.sessionStore = options.sessionStore || globalSessionStore;
    this.permissionDialog = null;

    // Session management
    this.currentSession = null;
    this.isInitialized = false;

    // WFL-specific parameters
    this.setupDefaultParameters();
    this.setupEventListeners();
  }

  /**
   * Initialize the animator (async)
   */
  async init() {
    if (this.isInitialized) return this;

    // Initialize session store
    await this.sessionStore.init();

    // Setup permission dialog if DOM available
    if (typeof document !== 'undefined') {
      this.permissionDialog = new PermissionDialog(this.eventBus);
      this.injectStyles();
    }

    this.isInitialized = true;

    this.eventBus.emit({
      type: EventTypes.ANIMATION_START,
      payload: { animator: 'WFLAnimator', initialized: true }
    });

    return this;
  }

  /**
   * Inject CSS styles for streaming and permission dialogs
   */
  injectStyles() {
    if (document.getElementById('wfl-animator-styles')) return;

    const style = document.createElement('style');
    style.id = 'wfl-animator-styles';
    style.textContent = `
      ${StreamingAnimationLoader.getSkeletonCSS()}
      ${PermissionDialog.getDialogCSS()}
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup default WFL parameters
   */
  setupDefaultParameters() {
    // Number parameters
    this.parameters.register('mouthState', 'number', 0);
    this.parameters.register('headTurn', 'number', 0);
    this.parameters.register('eyeState', 'number', 0);
    this.parameters.register('roastTone', 'number', 0);

    // Boolean parameters
    this.parameters.register('isTalking', 'boolean', false);

    // Setup parameter listeners to update animations
    this.setupParameterListeners();
  }

  /**
   * Setup listeners for parameter changes
   */
  setupParameterListeners() {
    // Mouth state -> play mouth animation
    this.parameters.get('mouthState').onChange((name, value) => {
      const mouthAnimations = ['mouth_closed', 'mouth_a', 'mouth_e', 'mouth_i', 'mouth_o', 'mouth_u', 'mouth_f'];
      if (value >= 0 && value < mouthAnimations.length) {
        this.rigging.playAnimation(mouthAnimations[value]);
      }
      this.emitParameterChange(name, value);
    });

    // Head turn -> rotate head bone
    this.parameters.get('headTurn').onChange((name, value) => {
      this.rigging.setBoneRotation('head', value);
      this.emitParameterChange(name, value);
    });

    // Eye state -> play eye animation
    this.parameters.get('eyeState').onChange((name, value) => {
      const eyeAnimations = ['eyes_open', 'eyes_closed', 'eyes_half', 'eyes_squint', 'eyes_wide'];
      if (value >= 0 && value < eyeAnimations.length) {
        this.rigging.playAnimation(eyeAnimations[value]);
      }
      this.emitParameterChange(name, value);
    });

    // Talking -> play talking animation loop
    this.parameters.get('isTalking').onChange((name, value) => {
      if (value) {
        this.rigging.playAnimation('talking', -1); // Loop
      } else {
        this.rigging.stopAnimation('talking');
      }
      this.emitParameterChange(name, value);
    });
  }

  /**
   * Setup event bus listeners
   */
  setupEventListeners() {
    // Listen for permission responses
    this.eventBus.on(EventTypes.PERMISSION_RESPONSE, (event) => {
      const { requestId, result } = event.payload;
      this.permissions.respondToPermission(requestId, result);
    });

    // Listen for streaming updates
    this.eventBus.on(EventTypes.STREAM_UPDATE, (event) => {
      // Could update UI loading indicator here
    });

    // Listen for session events
    this.eventBus.on(EventTypes.SESSION_LOAD, async (event) => {
      const { sessionId, snapshot } = event.payload;
      if (snapshot) {
        await this.restoreFromSnapshot(snapshot);
      }
    });
  }

  /**
   * Emit parameter change event
   */
  emitParameterChange(name, value) {
    this.eventBus.emit({
      type: EventTypes.PARAMETER_CHANGE,
      payload: { name, value }
    });

    // Record to session if active
    if (this.currentSession) {
      this.sessionStore.recordMessage(this.currentSession.id, {
        type: 'parameter_change',
        name,
        value,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Load WFL file with streaming support
   */
  async load(url, options = {}) {
    const useStreaming = options.streaming !== false;
    const target = options.loadingTarget || this.canvas;

    if (useStreaming) {
      this.file = await this.streamingLoader.loadWithStreaming(url, { target });
    } else {
      this.file = await WFLFile.load(url);
    }

    // Load parameters from file
    if (this.file.parameters) {
      this.parameters.fromJSON(this.file.parameters);
    }

    // Setup state machine from file
    if (this.file.stateMachine) {
      this.setupStateMachine(this.file.stateMachine);
    }

    // Load bone rigging data
    if (this.file.bones) {
      // TODO: Load DragonBones data
    }

    return this.file;
  }

  /**
   * Setup state machine from file data
   */
  setupStateMachine(data) {
    this.stateMachine = new StateMachine(data.name);

    // Add states
    Object.entries(data.states).forEach(([name, stateData]) => {
      this.stateMachine.addState(name, stateData.animations);
    });

    // Add transitions
    Object.entries(data.states).forEach(([name, stateData]) => {
      stateData.transitions.forEach(transition => {
        const condition = this.createConditionFunction(transition.condition);
        this.stateMachine.addTransition(name, transition.targetState, condition);
      });
    });

    // Set entry state
    if (data.entryState) {
      this.stateMachine.setState(data.entryState);
    }

    // Setup state change callback
    this.stateMachine.onStateChange = (newState, oldState) => {
      const animations = this.stateMachine.getCurrentAnimations();
      animations.forEach(anim => {
        this.rigging.playAnimation(anim);
      });

      this.eventBus.emit({
        type: EventTypes.STATE_CHANGE,
        payload: { newState, oldState, animations }
      });
    };
  }

  /**
   * Create condition function from string
   */
  createConditionFunction(conditionStr) {
    return (parameters) => {
      // TODO: Implement proper condition parsing
      return false;
    };
  }

  /**
   * Initialize canvas
   */
  initCanvas(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.startAnimationLoop();
  }

  /**
   * Start animation loop
   */
  startAnimationLoop() {
    const animate = (currentTime) => {
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Update state machine
      if (this.stateMachine) {
        this.stateMachine.update(this.parameters);
      }

      // Update rigging
      this.rigging.update(deltaTime);

      // Emit frame event
      this.eventBus.emit({
        type: EventTypes.ANIMATION_FRAME,
        payload: { deltaTime, time: currentTime }
      });

      // Render
      this.render();

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Render frame
   */
  render() {
    if (!this.context || !this.canvas) return;

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.rigging.armatureDisplay) {
      // DragonBones rendering
    } else {
      this.drawPlaceholder();
    }

    // Draw streaming indicator if active
    if (this.streaming.isActive()) {
      this.drawStreamingIndicator();
    }
  }

  /**
   * Draw placeholder when no character loaded
   */
  drawPlaceholder() {
    const ctx = this.context;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    ctx.fillStyle = '#666';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Load DragonBones character to see animation', centerX, centerY);

    ctx.font = '16px Arial';
    ctx.fillText(`Mouth: ${this.parameters.get('mouthState')?.get() || 0}`, centerX, centerY + 40);
    ctx.fillText(`Head: ${this.parameters.get('headTurn')?.get() || 0}°`, centerX, centerY + 60);
    ctx.fillText(`Eye: ${this.parameters.get('eyeState')?.get() || 0}`, centerX, centerY + 80);
    ctx.fillText(`Talking: ${this.parameters.get('isTalking')?.get() || false}`, centerX, centerY + 100);
  }

  /**
   * Draw streaming indicator on canvas
   */
  drawStreamingIndicator() {
    const ctx = this.context;
    const state = this.streaming.getPartialState();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 150, 30);
    ctx.fillStyle = '#4CAF50';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';

    const progress = state.progress ? `${Math.round(state.progress * 100)}%` : 'Loading...';
    ctx.fillText(`⏳ ${progress}`, 20, 30);
  }

  // ─────────────────────────────────────────────────────────────────
  // Session Management (Claude-Cowork pattern)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Start a new session
   */
  async startSession(title = null) {
    const session = await this.sessionStore.createSession({
      title: title || `Animation ${new Date().toLocaleTimeString()}`,
      parameters: this.parameters.toJSON()
    });

    this.currentSession = session;
    return session;
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId) {
    const snapshot = await this.sessionStore.loadSnapshot(sessionId);
    if (snapshot) {
      await this.restoreFromSnapshot(snapshot);
    }
    this.currentSession = this.sessionStore.getSession(sessionId);
    return this.currentSession;
  }

  /**
   * Save current state to session
   */
  async saveSession() {
    if (!this.currentSession) {
      this.currentSession = await this.startSession();
    }

    const snapshot = this.createSnapshot();
    await this.sessionStore.saveSnapshot(this.currentSession.id, snapshot);
    return this.currentSession;
  }

  /**
   * Create state snapshot
   */
  createSnapshot() {
    return {
      parameters: this.parameters.toJSON(),
      stateMachine: this.stateMachine?.toJSON() || null,
      timestamp: Date.now()
    };
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshot) {
    if (snapshot.parameters) {
      this.parameters.fromJSON(snapshot.parameters);
    }
    if (snapshot.stateMachine) {
      this.setupStateMachine(snapshot.stateMachine);
    }
  }

  /**
   * List all sessions
   */
  listSessions() {
    return this.sessionStore.listSessions();
  }

  /**
   * Delete a session (with permission)
   */
  async deleteSession(sessionId) {
    const session = this.sessionStore.getSession(sessionId);
    const result = await this.permissions.requestPermission(
      PermissionActions.SESSION_DELETE,
      { sessionId, sessionName: session?.title }
    );

    if (result.behavior === 'allow') {
      await this.sessionStore.deleteSession(sessionId);
      if (this.currentSession?.id === sessionId) {
        this.currentSession = null;
      }
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────
  // WFL-specific control methods
  // ─────────────────────────────────────────────────────────────────

  setMouth(state) {
    this.parameters.set('mouthState', state);
  }

  setHeadTurn(degrees) {
    this.parameters.set('headTurn', degrees);
  }

  setEye(state) {
    this.parameters.set('eyeState', state);
  }

  setTone(tone) {
    this.parameters.set('roastTone', tone);
  }

  setTalking(talking) {
    this.parameters.set('isTalking', talking);
  }

  // ─────────────────────────────────────────────────────────────────
  // Operations requiring permission
  // ─────────────────────────────────────────────────────────────────

  /**
   * Reset all parameters (requires permission)
   */
  async resetParameters() {
    const result = await this.permissions.requestPermission(
      PermissionActions.PARAMETER_RESET,
      { parameterCount: this.parameters.getAll().length }
    );

    if (result.behavior === 'allow') {
      this.setupDefaultParameters();
      return true;
    }
    return false;
  }

  /**
   * Reset state machine (requires permission)
   */
  async resetStateMachine() {
    const result = await this.permissions.requestPermission(
      PermissionActions.STATE_RESET,
      { stateMachineName: this.stateMachine?.name }
    );

    if (result.behavior === 'allow') {
      if (this.stateMachine) {
        this.stateMachine.reset();
      }
      return true;
    }
    return false;
  }

  /**
   * Clear all animation data (requires permission)
   */
  async clearAll() {
    const result = await this.permissions.requestPermission(
      PermissionActions.ANIMATION_CLEAR,
      {}
    );

    if (result.behavior === 'allow') {
      this.stateMachine = null;
      this.setupDefaultParameters();
      this.file = null;
      return true;
    }
    return false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.eventBus.emit({
      type: EventTypes.ANIMATION_STOP,
      payload: { animator: 'WFLAnimator' }
    });

    // Clear event listeners
    this.eventBus.clear();
  }
}

// Export all modules for direct access
export {
  EventBus,
  EventTypes,
  StreamingState,
  StreamingAnimationLoader,
  PermissionManager,
  PermissionDialog,
  PermissionActions,
  SessionStore,
  globalEventBus,
  globalPermissionManager,
  globalSessionStore
};
