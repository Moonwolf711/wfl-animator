/**
 * WFL Animator - Main animation controller
 * Combines parameter system, state machine, bone rigging,
 * with Claude-Cowork inspired patterns: streaming, permissions, sessions
 */

import { ParameterSystem } from './core/parameter.js';
import { StateMachine } from './core/state-machine.js';
import { WFLFile } from './core/file-format.js';
import { DragonBonesRigging } from './rigging/dragon-bones.js';
import { EventTypes, globalEventBus } from './core/event-bus.js';
import { StreamingState, StreamingAnimationLoader } from './core/streaming.js';
import { PermissionDialog, PermissionActions, globalPermissionManager } from './core/permission.js';
import { globalSessionStore } from './core/session-store.js';

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
    this._paused = false;
    this._speed = 1.0;

    // Sprite-based rendering (fallback when DragonBones not available)
    this.sprites = new Map();       // name -> HTMLImageElement
    this.characterSprite = null;    // Current character base sprite
    this.mouthSprites = [];         // Mouth shape sprites (indexed by mouthState)
    this.eyeSprites = [];           // Eye sprites (indexed by eyeState)

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
    const mouthParam = this.parameters.get('mouthState');
    if (mouthParam) {
      mouthParam.onChange((name, value) => {
        const mouthAnimations = ['mouth_closed', 'mouth_a', 'mouth_e', 'mouth_i', 'mouth_o', 'mouth_u', 'mouth_f'];
        if (value >= 0 && value < mouthAnimations.length) {
          this.rigging.playAnimation(mouthAnimations[value]);
        }
        this.emitParameterChange(name, value);
      });
    }

    // Head turn -> rotate head bone
    const headParam = this.parameters.get('headTurn');
    if (headParam) {
      headParam.onChange((name, value) => {
        this.rigging.setBoneRotation('head', value);
        this.emitParameterChange(name, value);
      });
    }

    // Eye state -> play eye animation
    const eyeParam = this.parameters.get('eyeState');
    if (eyeParam) {
      eyeParam.onChange((name, value) => {
        const eyeAnimations = ['eyes_open', 'eyes_closed', 'eyes_half', 'eyes_squint', 'eyes_wide'];
        if (value >= 0 && value < eyeAnimations.length) {
          this.rigging.playAnimation(eyeAnimations[value]);
        }
        this.emitParameterChange(name, value);
      });
    }

    // Talking -> play talking animation loop
    const talkingParam = this.parameters.get('isTalking');
    if (talkingParam) {
      talkingParam.onChange((name, value) => {
        if (value) {
          this.rigging.playAnimation('talking', -1); // Loop
        } else {
          this.rigging.stopAnimation('talking');
        }
        this.emitParameterChange(name, value);
      });
    }
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

    // Listen for session events
    this.eventBus.on(EventTypes.SESSION_LOAD, async (event) => {
      const { snapshot } = event.payload;
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

    try {
      if (useStreaming) {
        this.file = await this.streamingLoader.loadWithStreaming(url, { target });
      } else {
        this.file = await WFLFile.load(url);
      }
    } catch (error) {
      this.eventBus.emit({
        type: EventTypes.ERROR,
        payload: { message: `Failed to load animation: ${error.message}`, error }
      });
      throw error;
    }

    // Load parameters from file
    if (this.file.parameters) {
      this.parameters.fromJSON(this.file.parameters);
      // Re-attach listeners for any new parameters loaded from file
      this.setupParameterListeners();
    }

    // Setup state machine from file
    if (this.file.stateMachine) {
      this.setupStateMachine(this.file.stateMachine);
    }

    // Load bone rigging data if DragonBones factory is available
    if (this.file.bones && this.rigging.factory) {
      this.rigging.loadArmature(this.file.bones.skeleton, this.file.bones.textureAtlas);
    }

    // Load sprite-based character data (fallback rendering)
    if (this.file.sprites) {
      await this.loadSprites(this.file.sprites);
    }

    return this.file;
  }

  /**
   * Setup state machine from file data
   */
  setupStateMachine(data) {
    this.stateMachine = new StateMachine(data.name);
    this.stateMachine.eventBus = this.eventBus;

    // Add states
    Object.entries(data.states).forEach(([name, stateData]) => {
      this.stateMachine.addState(name, stateData.animations);
    });

    // Add transitions
    Object.entries(data.states).forEach(([name, stateData]) => {
      stateData.transitions.forEach(transition => {
        const conditionStr = transition.condition;
        const condition = this.createConditionFunction(conditionStr);
        this.stateMachine.addTransition(name, transition.targetState, condition, conditionStr);
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
   * Create condition function from condition string
   * Supports: parameter comparisons (e.g. "isTalking === true", "mouthState > 3")
   * Supports: logical operators (&& ||)
   */
  createConditionFunction(conditionStr) {
    if (!conditionStr || typeof conditionStr !== 'string' || conditionStr === '[function]') {
      return () => false;
    }

    // Parse the condition into a safe evaluator
    // Supported operators: ===, !==, ==, !=, >, <, >=, <=, &&, ||, !
    return (parameters) => {
      try {
        // Replace parameter names with their actual values
        let expr = conditionStr;

        // Get all registered parameter names, sorted longest-first to avoid partial matches
        const paramNames = parameters.getAll()
          .map(p => p.name)
          .sort((a, b) => b.length - a.length);

        for (const name of paramNames) {
          const param = parameters.get(name);
          if (!param) continue;
          const value = param.get();
          const replacement = typeof value === 'string' ? `"${value}"` : String(value);
          // Use word boundary matching to avoid partial replacements
          expr = expr.replace(new RegExp(`\\b${name}\\b`, 'g'), replacement);
        }

        // Validate: only allow safe characters (numbers, booleans, operators, whitespace, parens)
        const safePattern = /^[\d\s.+\-*/<>=!&|()true false"null]+$/;
        if (!safePattern.test(expr)) {
          return false;
        }

        // Evaluate the safe expression
        return Boolean(new Function(`return (${expr});`)());
      } catch (_e) {
        return false;
      }
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
      // Guard first frame where lastTime is 0
      if (this.lastTime === 0) {
        this.lastTime = currentTime;
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }

      const rawDelta = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Skip updates when paused
      if (this._paused) {
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = rawDelta * this._speed;

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
      // DragonBones canvas rendering
      const display = this.rigging.getDisplay();
      if (display && display.draw) {
        display.draw(this.context);
      }
    } else if (this.characterSprite || this.mouthSprites.length > 0) {
      // Sprite-based rendering
      this.renderSprites();
    } else {
      this.drawPlaceholder();
    }

    // Draw state machine info overlay (debug)
    if (this.stateMachine?.currentState) {
      this.drawStateOverlay();
    }

    // Draw streaming indicator if active
    if (this.streaming.isActive()) {
      this.drawStreamingIndicator();
    }
  }

  /**
   * Draw current state machine state as debug overlay
   */
  drawStateOverlay() {
    const ctx = this.context;
    const state = this.stateMachine.currentState.name;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(this.canvas.width - 160, 10, 150, 24);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`State: ${state}`, this.canvas.width - 18, 27);
    ctx.restore();
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
    ctx.fillText(`Loading ${progress}`, 20, 30);
  }

  // ─────────────────────────────────────────────────────────────────
  // Sprite Loading & Rendering
  // ─────────────────────────────────────────────────────────────────

  /**
   * Load sprite images from file data
   * @param {Object} spriteData - { base, mouths[], eyes[], positions }
   */
  async loadSprites(spriteData) {
    const loadImage = (src) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
      });
    };

    try {
      // Load base character sprite
      if (spriteData.base) {
        this.characterSprite = await loadImage(spriteData.base);
        this.sprites.set('base', this.characterSprite);
      }

      // Load mouth sprites (indexed by mouthState parameter)
      if (spriteData.mouths && Array.isArray(spriteData.mouths)) {
        this.mouthSprites = [];
        for (const src of spriteData.mouths) {
          this.mouthSprites.push(await loadImage(src));
        }
      }

      // Load eye sprites (indexed by eyeState parameter)
      if (spriteData.eyes && Array.isArray(spriteData.eyes)) {
        this.eyeSprites = [];
        for (const src of spriteData.eyes) {
          this.eyeSprites.push(await loadImage(src));
        }
      }

      // Store position offsets for compositing
      this.spritePositions = spriteData.positions || {
        mouth: { x: 0, y: 0 },
        eyes: { x: 0, y: 0 }
      };
    } catch (error) {
      this.eventBus.emit({
        type: EventTypes.ERROR,
        payload: { message: `Failed to load sprites: ${error.message}`, error }
      });
    }
  }

  /**
   * Load a single sprite by name for custom rendering
   */
  async loadSprite(name, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sprites.set(name, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
      img.src = src;
    });
  }

  /**
   * Render sprites to canvas (composites base + mouth + eyes)
   */
  renderSprites() {
    const ctx = this.context;

    // Calculate scale for base character (reused for overlays)
    let scale = 1;
    let baseX = 0;
    let baseY = 0;

    if (this.characterSprite) {
      scale = Math.min(
        this.canvas.width / this.characterSprite.width,
        this.canvas.height / this.characterSprite.height
      );
      const w = this.characterSprite.width * scale;
      const h = this.characterSprite.height * scale;
      baseX = (this.canvas.width - w) / 2;
      baseY = (this.canvas.height - h) / 2;

      // Apply head turn rotation
      const headTurn = this.parameters.get('headTurn')?.get() || 0;
      if (headTurn !== 0) {
        ctx.save();
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.rotate((headTurn * Math.PI) / 180);
        ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        ctx.drawImage(this.characterSprite, baseX, baseY, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(this.characterSprite, baseX, baseY, w, h);
      }
    }

    // Overlay mouth sprite (scaled and offset relative to base character)
    const mouthState = this.parameters.get('mouthState')?.get() || 0;
    if (this.mouthSprites[mouthState]) {
      const pos = this.spritePositions?.mouth || { x: 0, y: 0 };
      const sprite = this.mouthSprites[mouthState];
      ctx.drawImage(sprite, baseX + pos.x * scale, baseY + pos.y * scale,
        sprite.width * scale, sprite.height * scale);
    }

    // Overlay eye sprite (scaled and offset relative to base character)
    const eyeState = this.parameters.get('eyeState')?.get() || 0;
    if (this.eyeSprites[eyeState]) {
      const pos = this.spritePositions?.eyes || { x: 0, y: 0 };
      const sprite = this.eyeSprites[eyeState];
      ctx.drawImage(sprite, baseX + pos.x * scale, baseY + pos.y * scale,
        sprite.width * scale, sprite.height * scale);
    }
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
  // Convenience API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Pause the animation loop (requestAnimationFrame still runs but skips updates)
   */
  pause() {
    this._paused = true;
  }

  /**
   * Resume animation updates
   */
  resume() {
    this._paused = false;
  }

  /**
   * Whether the animation is currently paused
   */
  get isPaused() {
    return this._paused;
  }

  /**
   * Set a time multiplier for animation speed (default 1.0)
   */
  setSpeed(multiplier) {
    this._speed = multiplier;
  }

  /**
   * Get the current value of a parameter (shorthand)
   * @param {string} name - Parameter name
   * @returns {*} Current value, or undefined if parameter not found
   */
  getParameter(name) {
    const param = this.parameters.get(name);
    return param ? param.get() : undefined;
  }

  /**
   * Get the current state machine state name
   * @returns {string|null} Current state name, or null if no state machine
   */
  getCurrentState() {
    return this.stateMachine?.currentState?.name || null;
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
      this.animationFrame = null;
    }

    if (this.permissionDialog) {
      this.permissionDialog.dispose();
      this.permissionDialog = null;
    }

    this.eventBus.emit({
      type: EventTypes.ANIMATION_STOP,
      payload: { animator: 'WFLAnimator' }
    });

    // Clear event listeners
    this.eventBus.clear();

    // Release references
    this.canvas = null;
    this.context = null;
    this.file = null;
    this.stateMachine = null;
    this.sprites.clear();
    this.characterSprite = null;
    this.mouthSprites = [];
    this.eyeSprites = [];
  }
}

// Re-export modules for direct access
export { EventBus, EventTypes, globalEventBus } from './core/event-bus.js';
export { StreamingState, StreamingAnimationLoader } from './core/streaming.js';
export { PermissionManager, PermissionDialog, PermissionActions, globalPermissionManager } from './core/permission.js';
export { SessionStore, globalSessionStore } from './core/session-store.js';
