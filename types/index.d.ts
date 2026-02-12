/**
 * Type definitions for wfl-animator 1.0.0
 *
 * Custom animation system for WFL combining parameter-driven animation,
 * state machines, bone rigging, streaming, sessions, and permissions.
 */

// ─────────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────────

/** Valid parameter types for the animation parameter system. */
export type ParameterType = 'number' | 'boolean' | 'trigger';

/** Permission mode controlling how permission requests are handled. */
export type PermissionMode = 'ask' | 'allow' | 'deny';

/** Behavior result from a permission request. */
export type PermissionBehavior = 'allow' | 'deny';

/** 2D point with x and y coordinates. */
export interface Point2D {
  x: number;
  y: number;
}

/** 2x3 affine transformation matrix (column-major). */
export interface WorldTransform {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

// ─────────────────────────────────────────────────────────────────
// Event System
// ─────────────────────────────────────────────────────────────────

/** All event type string constants used by the event bus. */
export declare const EventTypes: {
  // Animation events
  readonly ANIMATION_START: 'animation.start';
  readonly ANIMATION_STOP: 'animation.stop';
  readonly ANIMATION_FRAME: 'animation.frame';
  readonly ANIMATION_COMPLETE: 'animation.complete';

  // Parameter events
  readonly PARAMETER_CHANGE: 'parameter.change';
  readonly PARAMETER_REGISTER: 'parameter.register';

  // State machine events
  readonly STATE_CHANGE: 'state.change';
  readonly STATE_ENTER: 'state.enter';
  readonly STATE_EXIT: 'state.exit';
  readonly TRANSITION_START: 'transition.start';
  readonly TRANSITION_COMPLETE: 'transition.complete';

  // Session events
  readonly SESSION_CREATE: 'session.create';
  readonly SESSION_LOAD: 'session.load';
  readonly SESSION_SAVE: 'session.save';
  readonly SESSION_DELETE: 'session.delete';
  readonly SESSION_LIST: 'session.list';

  // Stream events
  readonly STREAM_START: 'stream.start';
  readonly STREAM_UPDATE: 'stream.update';
  readonly STREAM_COMPLETE: 'stream.complete';
  readonly STREAM_ERROR: 'stream.error';

  // Permission events
  readonly PERMISSION_REQUEST: 'permission.request';
  readonly PERMISSION_RESPONSE: 'permission.response';

  // Audio events
  readonly AUDIO_PLAY: 'audio.play';
  readonly AUDIO_PAUSE: 'audio.pause';
  readonly AUDIO_STOP: 'audio.stop';
  readonly AUDIO_MARKER: 'audio.marker';
  readonly AUDIO_VISEME_CHANGE: 'audio.viseme.change';

  // Error events
  readonly ERROR: 'error';
  readonly WARNING: 'warning';
};

/** Union of all known event type string values. */
export type EventType = typeof EventTypes[keyof typeof EventTypes];

/** An event object emitted through the EventBus. */
export interface WFLEvent<T = unknown> {
  /** Event type identifier. */
  type: string;
  /** Event payload data. */
  payload?: T;
  /** Timestamp added automatically when emitted. */
  timestamp?: number;
}

/** Callback function for event bus subscriptions. */
export type EventCallback<T = unknown> = (event: WFLEvent<T>) => void;

/** Unsubscribe function returned by `on` and `once`. */
export type Unsubscribe = () => void;

/**
 * IPC-like event system for WFL Animator.
 * Supports typed events, wildcard listeners, and event history.
 */
export declare class EventBus {
  /** Map of event type to listener callbacks. */
  listeners: Map<string, Set<EventCallback>>;
  /** Circular buffer of emitted events. */
  history: WFLEvent[];
  /** Maximum number of events retained in history. */
  maxHistory: number;
  /** Optional error handler for listener exceptions. */
  onError: ((eventType: string, error: Error) => void) | null;

  constructor();

  /**
   * Subscribe to an event type.
   * @param type - Event type string, or `"*"` for a wildcard listener.
   * @param callback - Handler function invoked with the timestamped event.
   * @returns Unsubscribe function to remove the listener.
   */
  on(type: string, callback: EventCallback): Unsubscribe;

  /**
   * Subscribe to an event type for a single invocation.
   * The listener is automatically removed after the first matching event.
   * @param type - Event type string.
   * @param callback - Handler function.
   * @returns Unsubscribe function.
   */
  once(type: string, callback: EventCallback): Unsubscribe;

  /**
   * Emit an event to all matching listeners.
   * A `timestamp` property is added automatically.
   * @param event - Event object (must include `type`).
   */
  emit(event: WFLEvent): void;

  /**
   * Alias for {@link emit}. Broadcasts an event to all listeners.
   * @param event - Event object.
   */
  broadcast(event: WFLEvent): void;

  /**
   * Retrieve event history, optionally filtered by type.
   * @param type - If provided, only events of this type are returned.
   * @param limit - Maximum number of events (default 50).
   */
  getHistory(type?: string | null, limit?: number): WFLEvent[];

  /** Remove all listeners. */
  clear(): void;

  /** Clear the event history buffer. */
  clearHistory(): void;
}

/** Global singleton EventBus instance. */
export declare const globalEventBus: EventBus;

// ─────────────────────────────────────────────────────────────────
// Parameter System
// ─────────────────────────────────────────────────────────────────

/**
 * Callback invoked when a parameter value changes.
 * @param name - Parameter name.
 * @param value - New value.
 * @param oldValue - Previous value.
 */
export type ParameterChangeCallback = (name: string, value: any, oldValue: any) => void;

/**
 * A single named animation parameter with typed value and change listeners.
 */
export declare class Parameter {
  /** Parameter name. */
  readonly name: string;
  /** Parameter type: `'number'`, `'boolean'`, or `'trigger'`. */
  readonly type: ParameterType;
  /** The default/initial value. */
  readonly defaultValue: any;
  /** Current value. */
  value: any;
  /** Registered change listeners. */
  listeners: ParameterChangeCallback[];

  constructor(name: string, type: ParameterType, defaultValue?: any);

  /**
   * Set the parameter value. Notifies all listeners if the value is valid.
   * @param value - New value (must match the parameter type).
   * @throws TypeError if the value type does not match.
   */
  set(value: any): void;

  /** Get the current parameter value. */
  get(): any;

  /**
   * Register a change listener.
   * @param callback - Invoked with `(name, newValue, oldValue)`.
   * @returns Unsubscribe function to remove the listener.
   */
  onChange(callback: ParameterChangeCallback): Unsubscribe;

  /**
   * Validate that a value matches this parameter's type.
   * @param value - Value to validate.
   */
  validateType(value: any): boolean;
}

/** JSON representation of a single parameter for serialization. */
export interface ParameterJSON {
  type: ParameterType;
  value: any;
}

/** JSON representation of the full parameter set (keyed by name). */
export interface ParametersJSON {
  [name: string]: ParameterJSON;
}

/**
 * Registry of named parameters that drive animation behavior.
 * Parameters can be numbers, booleans, or triggers.
 */
export declare class ParameterSystem {
  /** Internal parameter map. */
  parameters: Map<string, Parameter>;

  constructor();

  /**
   * Register a new parameter.
   * @param name - Unique parameter name.
   * @param type - One of `'number'`, `'boolean'`, or `'trigger'`.
   * @param defaultValue - Initial value.
   * @returns The created Parameter instance.
   * @throws Error if the type is invalid.
   */
  register(name: string, type: ParameterType, defaultValue?: any): Parameter;

  /**
   * Get a parameter by name.
   * @param name - Parameter name.
   * @returns The Parameter, or `undefined` if not found.
   */
  get(name: string): Parameter | undefined;

  /**
   * Set a parameter's value by name.
   * @param name - Parameter name.
   * @param value - New value.
   * @returns `true` if the parameter was found and set, `false` otherwise.
   */
  set(name: string, value: any): boolean;

  /** Get an array of all registered parameters. */
  getAll(): Parameter[];

  /**
   * Get all parameters of a specific type.
   * @param type - Parameter type to filter by.
   */
  getByType(type: ParameterType): Parameter[];

  /**
   * Check whether a parameter with the given name exists.
   * @param name - Parameter name.
   */
  has(name: string): boolean;

  /** Reset all parameters to their default values. */
  reset(): void;

  /**
   * Set multiple parameter values at once.
   * @param obj - Object mapping parameter names to values.
   */
  setMultiple(obj: Record<string, any>): void;

  /** Serialize all parameters to a JSON-compatible object. */
  toJSON(): ParametersJSON;

  /**
   * Import parameters from a JSON object, registering new parameters.
   * @param data - Serialized parameters (from {@link toJSON}).
   */
  fromJSON(data: ParametersJSON): void;
}

// ─────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────

/** A condition function evaluated to determine whether a transition should fire. */
export type TransitionCondition = (parameters: ParameterSystem) => boolean;

/** A transition record stored on a State. */
export interface Transition {
  condition: TransitionCondition;
  targetState: State;
  conditionStr: string | null;
}

/** Callback for state enter/exit events. */
export type StateCallback = (stateName: string) => void;

/** Callback for the `onStateChange` hook. */
export type StateChangeCallback = (newState: string, oldState: string | undefined) => void;

/** Result of validating a state machine. */
export interface StateMachineValidation {
  valid: boolean;
  issues: string[];
}

/** JSON representation of a state machine for serialization. */
export interface StateMachineJSON {
  name: string;
  states: {
    [name: string]: {
      animations: string[];
      transitions: Array<{
        targetState: string;
        condition: string;
      }>;
    };
  };
  entryState: string | undefined;
  currentState: string | undefined;
}

/**
 * A single state within a state machine, holding animation names and outgoing transitions.
 */
export declare class State {
  /** State name. */
  name: string;
  /** Animation clip names to play in this state. */
  animations: string[];
  /** Outgoing transitions. */
  transitions: Transition[];

  constructor(name: string, animations?: string[]);

  /**
   * Add an outgoing transition from this state.
   * @param condition - Function evaluated each frame.
   * @param targetState - State to transition to if condition is true.
   * @param conditionStr - Human-readable condition string for serialization.
   */
  addTransition(condition: TransitionCondition, targetState: State, conditionStr?: string | null): void;
}

/**
 * Finite state machine that evaluates parameter-driven transitions
 * and drives animation playback.
 */
export declare class StateMachine {
  /** State machine name. */
  name: string;
  /** All states keyed by name. */
  states: Map<string, State>;
  /** Currently active state. */
  currentState: State | null;
  /** Entry (initial) state. */
  entryState: State | null;
  /** Optional callback fired on state change. */
  onStateChange: StateChangeCallback | null;
  /** Optional event bus for emitting transition events. */
  eventBus: EventBus | null;

  constructor(name: string);

  /**
   * Add a new state to the machine.
   * The first added state becomes the entry state by default.
   * @param name - Unique state name.
   * @param animations - Animation clip names for this state.
   * @returns The created State.
   */
  addState(name: string, animations?: string[]): State;

  /**
   * Add a transition between two existing states.
   * @param fromStateName - Source state name.
   * @param toStateName - Target state name.
   * @param condition - Condition function.
   * @param conditionStr - Serializable condition string.
   * @throws Error if either state is not found.
   */
  addTransition(fromStateName: string, toStateName: string, condition: TransitionCondition, conditionStr?: string | null): void;

  /**
   * Remove a state and all transitions referencing it.
   * @param name - State name.
   * @returns `true` if the state was found and removed.
   */
  removeState(name: string): boolean;

  /**
   * Remove transitions from one state to another.
   * @param fromStateName - Source state name.
   * @param toStateName - Target state name.
   * @returns `true` if any transitions were removed.
   */
  removeTransition(fromStateName: string, toStateName: string): boolean;

  /**
   * Get a state by name.
   * @param name - State name.
   */
  getState(name: string): State | undefined;

  /**
   * Get outgoing transitions from a state.
   * @param stateName - State name.
   */
  getTransitions(stateName: string): Transition[];

  /**
   * Validate the state machine for structural issues such as unreachable states.
   * @returns Validation result with a list of issues.
   */
  validate(): StateMachineValidation;

  /**
   * Register a callback invoked when entering any state.
   * @param callback - Receives the new state name.
   * @returns Unsubscribe function.
   */
  onStateEnter(callback: StateCallback): Unsubscribe;

  /**
   * Register a callback invoked when exiting any state.
   * @param callback - Receives the old state name.
   * @returns Unsubscribe function.
   */
  onStateExit(callback: StateCallback): Unsubscribe;

  /**
   * Evaluate transitions from the current state using parameter values.
   * Transitions to the first matching target state.
   * @param parameters - The parameter system to evaluate conditions against.
   */
  update(parameters: ParameterSystem): void;

  /**
   * Directly set the current state by name or State reference.
   * Fires enter/exit callbacks and the `onStateChange` hook.
   * @param stateOrName - State name string or State object.
   */
  setState(stateOrName: string | State): void;

  /** Get the animation names for the current state. */
  getCurrentAnimations(): string[];

  /** Reset to the entry state. */
  reset(): void;

  /** Serialize the state machine to a JSON-compatible object. */
  toJSON(): StateMachineJSON;
}

// ─────────────────────────────────────────────────────────────────
// File Format
// ─────────────────────────────────────────────────────────────────

/** JSON structure of a WFL animation file. */
export interface WFLFileJSON {
  version: number;
  metadata: Record<string, any>;
  parameters: ParametersJSON;
  stateMachine: StateMachineJSON | null;
  animations: Record<string, any>;
  bones: Record<string, any>;
  sprites?: SpriteData;
}

/**
 * JSON-based animation file format.
 * Holds parameters, state machine definition, animations, and bone data.
 */
export declare class WFLFile {
  version: number;
  metadata: Record<string, any>;
  parameters: ParametersJSON;
  stateMachine: StateMachineJSON | null;
  animations: Record<string, any>;
  bones: Record<string, any>;
  sprites?: SpriteData;

  constructor();

  /**
   * Create a WFLFile from a parsed JSON object.
   * @param json - Parsed JSON data.
   */
  static fromJSON(json: Partial<WFLFileJSON>): WFLFile;

  /** Serialize to a JSON-compatible object. */
  toJSON(): WFLFileJSON;

  /**
   * Fetch and parse a WFL file from a URL.
   * @param url - URL to fetch.
   * @throws Error on HTTP failure.
   */
  static load(url: string): Promise<WFLFile>;

  /**
   * Download the file as JSON via the browser.
   * @param filename - Download filename (default `'animation.wfl'`).
   */
  download(filename?: string): void;
}

/**
 * Binary WFL file format encoder/decoder.
 *
 * Layout: `[MAGIC 4B][VERSION 4B][LENGTH 4B][JSON PAYLOAD NB][CRC32 4B]`
 */
export declare class WFLBinaryFormat {
  /** Magic number identifying the format: `0x57464C42` ("WFLB"). */
  static readonly MAGIC: number;
  /** Current binary format version. */
  static readonly VERSION: number;
  /** Size of the binary header in bytes. */
  static readonly HEADER_SIZE: number;
  /** Size of the trailing CRC32 checksum in bytes. */
  static readonly CHECKSUM_SIZE: number;

  /**
   * Compute CRC32 (IEEE 802.3) over a byte array.
   * @param bytes - Input bytes.
   * @returns Unsigned 32-bit CRC.
   */
  static crc32(bytes: Uint8Array): number;

  /**
   * Encode a WFLFile or plain object into the binary format.
   * @param data - Object with `.toJSON()` method or a plain JSON-serializable object.
   * @returns Binary ArrayBuffer.
   */
  static encode(data: WFLFile | Record<string, any>): ArrayBuffer;

  /**
   * Decode a binary buffer back to a plain JSON object.
   * @param buffer - ArrayBuffer or Node.js Buffer.
   * @returns Decoded JSON object.
   * @throws Error on magic mismatch, unsupported version, or checksum failure.
   */
  static decode(buffer: ArrayBuffer | Uint8Array): Record<string, any>;
}

// ─────────────────────────────────────────────────────────────────
// Bone Rigging
// ─────────────────────────────────────────────────────────────────

/** Options for constructing a Bone. */
export interface BoneOptions {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  length?: number;
}

/**
 * A single bone in a 2D skeletal hierarchy.
 * Each bone holds a local transform that is composed with its parent's
 * world transform to produce a final world matrix each frame.
 */
export declare class Bone {
  /** Unique bone name. */
  name: string;
  /** Parent bone (null for root). */
  parent: Bone | null;
  /** Child bones. */
  children: Bone[];
  /** Local position relative to parent. */
  position: Point2D;
  /** Local rotation in radians. */
  rotation: number;
  /** Local scale. */
  scale: Point2D;
  /** Bone length in pixels. */
  length: number;
  /** Cached world transform (recomputed each frame). */
  worldTransform: WorldTransform;

  constructor(name: string, opts?: BoneOptions);

  /**
   * Add a child bone and set its parent reference.
   * @param bone - Child bone to add.
   * @returns This bone (for chaining).
   */
  addChild(bone: Bone): this;

  /**
   * Remove a child bone by reference.
   * @param bone - Child bone to remove.
   * @returns This bone (for chaining).
   */
  removeChild(bone: Bone): this;

  /**
   * Recursively compute the world transform for this bone and all children
   * by composing local transforms with the parent's world matrix.
   */
  computeWorldTransform(): void;

  /** Get the world-space origin (pivot) position of this bone. */
  getWorldPosition(): Point2D;

  /** Get the world-space tip position (origin + length along local X-axis). */
  getWorldTip(): Point2D;
}

/** A single keyframe within an animation track. */
export interface Keyframe {
  /** Time of this keyframe in seconds. */
  time: number;
  /** Bone rotation in radians. */
  rotation?: number;
  /** Bone position. */
  position?: Point2D;
  /** Bone scale. */
  scale?: Point2D;
}

/** A track targeting a specific bone within an animation clip. */
export interface AnimationTrack {
  /** Name of the bone this track affects. */
  boneName: string;
  /** Ordered keyframes. */
  keyframes: Keyframe[];
}

/** An animation clip with duration and per-bone tracks. */
export interface AnimationData {
  /** Duration of the animation in seconds. */
  duration: number;
  /** Per-bone animation tracks. */
  tracks: AnimationTrack[];
}

/** Skeleton data used to build an Armature from JSON. */
export interface SkeletonData {
  name?: string;
  bones?: Array<{
    name: string;
    parent?: string;
    x?: number;
    y?: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    length?: number;
  }>;
  animations?: Record<string, {
    duration?: number;
    tracks?: AnimationTrack[];
  }>;
}

/**
 * A bone tree with animation playback state.
 * Manages a hierarchy of bones, registered animation clips,
 * and per-frame interpolation.
 */
export declare class Armature {
  /** Root bone of the hierarchy. */
  root: Bone | null;
  /** Fast bone lookup by name. */
  boneMap: Map<string, Bone>;
  /** Registered animation clips. */
  animations: Map<string, AnimationData>;
  /** Currently playing animation data (or null). */
  currentAnimation: AnimationData | null;
  /** Name of the currently playing animation. */
  currentAnimationName: string | null;
  /** Current playback time in seconds. */
  animationTime: number;
  /** Play count: -1 = loop forever, 1 = once, N = N times. */
  animationPlayTimes: number;
  /** Number of completed loops. */
  animationLoopCount: number;
  /** Whether an animation is currently playing. */
  isPlaying: boolean;

  constructor();

  /**
   * Register a bone in the lookup map.
   * @param bone - Bone to register.
   */
  addBone(bone: Bone): void;

  /**
   * Retrieve a bone by name.
   * @param name - Bone name.
   * @returns The bone, or `null` if not found.
   */
  getBone(name: string): Bone | null;

  /** Get an array of all registered bones. */
  getAllBones(): Bone[];

  /**
   * Register an animation clip.
   * @param name - Animation name.
   * @param data - Animation data with duration and tracks.
   */
  addAnimation(name: string, data: AnimationData): void;

  /**
   * Start playing an animation by name.
   * @param name - Animation clip name.
   * @param playTimes - -1 = loop forever, 1 = play once, N = play N times.
   */
  play(name: string, playTimes?: number): void;

  /**
   * Stop the named animation (or current if name matches or is omitted).
   * @param name - Animation name to stop.
   */
  stop(name?: string): void;

  /**
   * Advance animation playback by the given time delta and apply
   * interpolated values to bones.
   * @param dt - Elapsed time in seconds.
   */
  advanceTime(dt: number): void;

  /** Recompute all world transforms starting from the root bone. */
  updateWorldTransforms(): void;
}

/**
 * Canvas debug renderer for an Armature.
 * Draws bones, joints, and labels onto a Canvas 2D context.
 */
export declare class ArmatureDisplay {
  /** The armature being displayed. */
  armature: Armature;
  /** Display X offset. */
  x: number;
  /** Display Y offset. */
  y: number;
  /** Display horizontal scale. */
  scaleX: number;
  /** Display vertical scale. */
  scaleY: number;
  /** CSS color for bone lines. */
  boneColor: string;
  /** CSS color for joint circles. */
  jointColor: string;
  /** Radius of joint circles in pixels. */
  jointRadius: number;
  /** Line width for bone rendering. */
  boneWidth: number;
  /** CSS color for the root bone. */
  rootColor: string;

  constructor(armature: Armature);

  /**
   * Draw the full skeleton onto a Canvas 2D context.
   * @param ctx - Canvas rendering context.
   */
  draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * High-level rigging API.
 * Wraps Armature and ArmatureDisplay with convenience methods
 * for loading skeleton data, playing animations, and manipulating bones.
 */
export declare class DragonBonesRigging {
  /**
   * Factory sentinel. Set to `true` by default so that guards like
   * `if (this.rigging.factory)` pass without an external factory.
   */
  factory: any;
  /** The active armature (null until loaded). */
  armature: Armature | null;
  /** The display renderer (null until loaded). */
  armatureDisplay: ArmatureDisplay | null;

  constructor();

  /**
   * Optionally override the default factory sentinel.
   * @param factory - Custom factory object.
   */
  init(factory?: any): void;

  /**
   * Build an armature from skeleton JSON data.
   * @param skeletonData - Bone and animation definitions.
   * @param textureAtlasData - Reserved for future sprite atlas support.
   * @returns The created ArmatureDisplay.
   */
  loadArmature(skeletonData: SkeletonData, textureAtlasData?: any): ArmatureDisplay;

  /**
   * Play a named animation clip.
   * @param animationName - Name of the animation to play.
   * @param times - -1 = loop, 1 = once, N = N times (default -1).
   */
  playAnimation(animationName: string, times?: number): void;

  /**
   * Stop the named animation.
   * @param animationName - Animation to stop.
   */
  stopAnimation(animationName: string): void;

  /**
   * Advance animation and recompute world transforms.
   * Call once per frame.
   * @param deltaTime - Elapsed time in seconds.
   */
  update(deltaTime: number): void;

  /**
   * Set rotation of a named bone in degrees.
   * @param boneName - Target bone.
   * @param degrees - Rotation angle in degrees.
   */
  setBoneRotation(boneName: string, degrees: number): void;

  /**
   * Set position of a named bone.
   * @param boneName - Target bone.
   * @param x - X coordinate.
   * @param y - Y coordinate.
   */
  setBonePosition(boneName: string, x: number, y: number): void;

  /**
   * Set scale of a named bone.
   * @param boneName - Target bone.
   * @param scaleX - Horizontal scale.
   * @param scaleY - Vertical scale.
   */
  setBoneScale(boneName: string, scaleX: number, scaleY: number): void;

  /**
   * Retrieve a bone by name from the armature.
   * @param boneName - Bone name.
   * @returns The Bone, or `null` if not found.
   */
  getBone(boneName: string): Bone | null;

  /** Get the ArmatureDisplay for canvas rendering. */
  getDisplay(): ArmatureDisplay | null;

  /**
   * Set the display position offset.
   * @param x - X offset.
   * @param y - Y offset.
   */
  setPosition(x: number, y: number): void;

  /**
   * Set the display scale.
   * @param scaleX - Horizontal scale.
   * @param scaleY - Vertical scale.
   */
  setScale(scaleX: number, scaleY: number): void;
}

// ─────────────────────────────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────────────────────────────

/** Internal stream record. */
export interface StreamRecord {
  id: string;
  metadata: Record<string, any>;
  buffer: Array<{ delta: Record<string, any>; timestamp: number }>;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'active' | 'completed' | 'error';
  error?: Error | string;
}

/**
 * Manages real-time partial state updates via named streams.
 * Inspired by Claude-Cowork's partial message streaming pattern.
 */
export declare class StreamingState {
  /** Event bus for emitting stream events. */
  eventBus: EventBus;
  /** Currently active streams keyed by ID. */
  activeStreams: Map<string, StreamRecord>;
  /** Accumulated partial state from stream updates. */
  partialState: Record<string, any>;
  /** Whether any stream is currently active. */
  isStreaming: boolean;

  constructor(eventBus?: EventBus);

  /**
   * Start a new stream.
   * @param streamId - Unique stream identifier.
   * @param metadata - Arbitrary metadata for the stream.
   * @returns The created stream record.
   */
  startStream(streamId: string, metadata?: Record<string, any>): StreamRecord;

  /**
   * Push a partial state delta to an active stream.
   * The delta is merged into `partialState` and emitted as a STREAM_UPDATE event.
   * @param streamId - Stream identifier.
   * @param delta - Partial state update.
   */
  pushUpdate(streamId: string, delta: Record<string, any>): void;

  /**
   * Mark a stream as completed.
   * @param streamId - Stream identifier.
   * @param finalState - Optional final state override.
   * @returns The final state.
   */
  completeStream(streamId: string, finalState?: Record<string, any> | null): Record<string, any>;

  /**
   * Mark a stream as errored.
   * @param streamId - Stream identifier.
   * @param error - Error details.
   */
  errorStream(streamId: string, error: Error | string): void;

  /** Get a shallow copy of the current partial state. */
  getPartialState(): Record<string, any>;

  /** Whether any stream is currently active. */
  isActive(): boolean;

  /**
   * Deep-merge two state objects (non-mutating).
   * @param target - Base state.
   * @param source - State to merge on top.
   */
  mergeState(target: Record<string, any>, source: Record<string, any>): Record<string, any>;
}

/** Options for the streaming animation loader. */
export interface StreamingLoadOptions {
  /** Whether to use streaming fetch (default `true`). */
  streaming?: boolean;
  /** DOM element or selector to attach the loading indicator to. */
  target?: HTMLElement | string | null;
  /** Loading target alias (used by WFLAnimator.load). */
  loadingTarget?: HTMLElement | string | null;
}

/** Internal loading indicator record. */
export interface LoadingIndicator {
  id: string;
  target: HTMLElement | string | null;
  element: HTMLElement | null;
  animationFrame: number | null;
}

/**
 * Progressive loader for animation data.
 * Shows skeleton loading indicators and streams download progress.
 */
export declare class StreamingAnimationLoader {
  /** Event bus for stream events. */
  eventBus: EventBus;
  /** Internal StreamingState instance. */
  streaming: StreamingState;
  /** Active loading indicators keyed by stream ID. */
  loadingIndicators: Map<string, LoadingIndicator>;

  constructor(eventBus?: EventBus);

  /**
   * Fetch animation data with streaming progress updates.
   * @param url - URL of the animation file.
   * @param options - Loading options.
   * @returns Parsed animation data.
   */
  loadWithStreaming(url: string, options?: StreamingLoadOptions): Promise<Record<string, any>>;

  /**
   * Show a skeleton loading indicator.
   * @param streamId - Stream identifier.
   * @param target - DOM element or selector.
   */
  showLoadingIndicator(streamId: string, target?: HTMLElement | string | null): LoadingIndicator;

  /**
   * Remove a loading indicator.
   * @param streamId - Stream identifier.
   */
  hideLoadingIndicator(streamId: string): void;

  /** Get the CSS for the skeleton loading indicator. */
  static getSkeletonCSS(): string;
}

// ─────────────────────────────────────────────────────────────────
// Session Store
// ─────────────────────────────────────────────────────────────────

/** A session object stored in IndexedDB or memory. */
export interface Session {
  id: string;
  title: string;
  status: string;
  parameters: ParametersJSON;
  stateMachine: StateMachineJSON | null;
  cwd: string | null;
  createdAt: number;
  updatedAt: number;
  snapshot?: SessionSnapshot;
}

/** A sanitized session object returned by public APIs (excludes internal fields). */
export interface SanitizedSession {
  id: string;
  title: string;
  status: string;
  cwd: string | null;
  createdAt: number;
  updatedAt: number;
  hasSnapshot: boolean;
}

/** Options for creating a new session. */
export interface CreateSessionOptions {
  title?: string;
  parameters?: ParametersJSON;
  stateMachine?: StateMachineJSON | null;
  cwd?: string | null;
}

/** A state snapshot persisted with a session. */
export interface SessionSnapshot {
  parameters: ParametersJSON;
  stateMachine: StateMachineJSON | null;
  timestamp: number;
}

/** A recorded message/event within a session. */
export interface SessionMessage {
  id: string;
  sessionId: string;
  data: any;
  createdAt: number;
}

/** Session history containing the session and its messages. */
export interface SessionHistory {
  session: SanitizedSession;
  messages: any[];
}

/** Exported session data for import/export. */
export interface SessionExport {
  version: string;
  exportedAt: string;
  session: SanitizedSession;
  messages: any[];
}

/**
 * IndexedDB-backed persistence for animation sessions.
 * Falls back to in-memory storage when IndexedDB is unavailable.
 */
export declare class SessionStore {
  /** Event bus for session lifecycle events. */
  eventBus: EventBus;
  /** IndexedDB database handle (null when unavailable). */
  db: IDBDatabase | null;
  /** In-memory session cache. */
  sessions: Map<string, Session>;
  /** In-memory message storage (fallback). */
  messages: Map<string, SessionMessage[]>;
  /** Whether the store has been initialized. */
  initialized: boolean;

  constructor(eventBus?: EventBus);

  /**
   * Initialize the database. Safe to call multiple times.
   * Opens IndexedDB and loads existing sessions into memory.
   */
  init(): Promise<void>;

  /**
   * Create a new session.
   * @param options - Session creation options.
   * @returns The created session.
   */
  createSession(options?: CreateSessionOptions): Promise<Session>;

  /**
   * Get a session by ID.
   * @param id - Session ID.
   */
  getSession(id: string): Session | undefined;

  /**
   * List all sessions, sorted by most recently updated.
   * @returns Sanitized session objects.
   */
  listSessions(): SanitizedSession[];

  /**
   * List recent working directories from sessions.
   * @param limit - Maximum number of directories (default 8).
   */
  listRecentCwds(limit?: number): string[];

  /**
   * Update fields on an existing session.
   * @param id - Session ID.
   * @param updates - Partial session data to merge.
   * @returns Updated session, or `null` if not found.
   */
  updateSession(id: string, updates: Partial<Session>): Promise<Session | null>;

  /**
   * Delete a session and its messages.
   * @param id - Session ID.
   * @returns `true` if the session was found and deleted.
   */
  deleteSession(id: string): Promise<boolean>;

  /**
   * Get the full history (session + messages) for a session.
   * @param sessionId - Session ID.
   */
  getSessionHistory(sessionId: string): Promise<SessionHistory | null>;

  /**
   * Record a message/event in a session's history.
   * @param sessionId - Session ID.
   * @param message - Message data to record.
   */
  recordMessage(sessionId: string, message: any): Promise<SessionMessage>;

  /**
   * Save a state snapshot for a session.
   * @param sessionId - Session ID.
   * @param snapshot - Snapshot data.
   */
  saveSnapshot(sessionId: string, snapshot: SessionSnapshot): Promise<Session | null>;

  /**
   * Load a session's state snapshot.
   * @param sessionId - Session ID.
   * @returns The snapshot, or `null` if none exists.
   */
  loadSnapshot(sessionId: string): Promise<SessionSnapshot | null>;

  /**
   * Export a session with its full history to a JSON-compatible object.
   * @param sessionId - Session ID.
   */
  exportSession(sessionId: string): Promise<SessionExport | null>;

  /**
   * Import a session from an exported JSON object.
   * @param data - Previously exported session data.
   * @returns The newly created session.
   */
  importSession(data: SessionExport): Promise<Session>;

  /** Generate a unique ID. */
  generateId(): string;
}

/** Global singleton SessionStore instance. */
export declare const globalSessionStore: SessionStore;

// ─────────────────────────────────────────────────────────────────
// Permission System
// ─────────────────────────────────────────────────────────────────

/** The result of a permission request. */
export interface PermissionResult {
  behavior: PermissionBehavior;
  actionType?: string;
  details?: Record<string, any>;
  message?: string;
}

/** Internal pending permission request record. */
export interface PermissionRequest {
  id: string;
  actionType: string;
  details: Record<string, any>;
  createdAt: number;
  resolve: (result: PermissionResult) => void;
}

/** Well-known permission action type constants. */
export declare const PermissionActions: {
  readonly SESSION_DELETE: 'session.delete';
  readonly STATE_DELETE: 'state.delete';
  readonly STATE_RESET: 'state.reset';
  readonly PARAMETER_RESET: 'parameter.reset';
  readonly FILE_OVERWRITE: 'file.overwrite';
  readonly ANIMATION_CLEAR: 'animation.clear';
  readonly TRANSITION_DELETE: 'transition.delete';
};

/** Union of known permission action type strings. */
export type PermissionAction = typeof PermissionActions[keyof typeof PermissionActions];

/**
 * Manages confirmation flows for destructive or sensitive operations.
 * Supports auto-approve/deny lists and global permission modes.
 */
export declare class PermissionManager {
  /** Event bus for permission request/response events. */
  eventBus: EventBus;
  /** Pending permission requests keyed by request ID. */
  pendingRequests: Map<string, PermissionRequest>;
  /** Action types that are automatically approved. */
  autoApproveList: Set<string>;
  /** Action types that are automatically denied. */
  autoDenyList: Set<string>;
  /** Global permission mode. */
  permissionMode: PermissionMode;

  constructor(eventBus?: EventBus);

  /**
   * Request permission for a destructive action.
   * Resolves when the user (or auto-rule) responds.
   * Times out after 30 seconds with a deny result.
   * @param actionType - Action identifier (e.g. `PermissionActions.SESSION_DELETE`).
   * @param details - Context about the action.
   * @returns Permission result.
   */
  requestPermission(actionType: string, details?: Record<string, any>): Promise<PermissionResult>;

  /**
   * Respond to a pending permission request.
   * @param requestId - Request identifier.
   * @param result - Permission result.
   */
  respondToPermission(requestId: string, result: PermissionResult): void;

  /**
   * Get a human-readable permission message for an action.
   * @param actionType - Action identifier.
   * @param details - Action details.
   */
  getPermissionMessage(actionType: string, details: Record<string, any>): string;

  /**
   * Set the global permission mode.
   * @param mode - `'ask'` (prompt user), `'allow'` (auto-approve all), or `'deny'` (auto-deny all).
   * @throws Error if mode is invalid.
   */
  setMode(mode: PermissionMode): void;

  /**
   * Auto-approve a specific action type (removes it from the deny list).
   * @param actionType - Action to auto-approve.
   */
  autoApprove(actionType: string): void;

  /**
   * Auto-deny a specific action type (removes it from the approve list).
   * @param actionType - Action to auto-deny.
   */
  autoDeny(actionType: string): void;

  /**
   * Clear auto-approve/deny rules for an action type, reverting to `'ask'`.
   * @param actionType - Action type.
   */
  clearAutoResponse(actionType: string): void;

  /** Get all currently pending permission requests. */
  getPendingRequests(): PermissionRequest[];

  /** Cancel all pending permission requests (deny all). */
  cancelAll(): void;
}

/** Global singleton PermissionManager instance. */
export declare const globalPermissionManager: PermissionManager;

/**
 * DOM-based permission dialog UI.
 * Automatically listens for PERMISSION_REQUEST events and shows
 * a confirmation overlay with Allow/Cancel buttons.
 */
export declare class PermissionDialog {
  /** Event bus to listen on. */
  eventBus: EventBus;
  /** Current dialog container element (null when hidden). */
  container: HTMLElement | null;
  /** Unsubscribe function for the event listener. */
  unsubscribe: Unsubscribe | null;

  constructor(eventBus?: EventBus);

  /**
   * Show the permission dialog for a request.
   * @param request - Permission request payload.
   */
  showDialog(request: { requestId: string; actionType: string; message: string; details?: Record<string, any> }): void;

  /** Hide and remove the dialog from the DOM. */
  hideDialog(): void;

  /** Dispose of the dialog and remove all event listeners. */
  dispose(): void;

  /**
   * Escape HTML entities to prevent XSS.
   * @param text - Raw text.
   */
  escapeHtml(text: string): string;

  /** Get the CSS styles for the permission dialog. */
  static getDialogCSS(): string;
}

// ─────────────────────────────────────────────────────────────────
// Audio Synchronization
// ─────────────────────────────────────────────────────────────────

/** A viseme entry mapping a time range to a viseme name. */
export interface VisemeEntry {
  /** Start time in seconds. */
  start: number;
  /** End time in seconds. */
  end: number;
  /** Viseme identifier (e.g. 'AA', 'EE', 'OH'). */
  viseme: string;
}

/** A named time marker within an audio track. */
export interface AudioMarker {
  /** Marker name. */
  name: string;
  /** Time position in seconds. */
  time: number;
}

/** Options for binding a parameter to an audio property. */
export interface AudioParameterBindingOptions {
  /** Audio property to bind to: 'amplitude', 'time', or 'progress'. Default 'amplitude'. */
  source?: 'amplitude' | 'time' | 'progress';
  /** Minimum output value. Default 0. */
  min?: number;
  /** Maximum output value. Default 1. */
  max?: number;
}

/** Options for constructing an AudioSync instance. */
export interface AudioSyncOptions {
  /** Event bus for emitting audio events. */
  eventBus?: EventBus;
  /** Parameter system for parameter bindings. */
  parameterSystem?: ParameterSystem;
}

/**
 * Audio synchronization for WFL Animator.
 * Supports Web Audio API in browsers and falls back to a stub
 * implementation in Node.js for testability.
 */
export declare class AudioSync {
  constructor(options?: AudioSyncOptions);

  // ── Core audio control ─────────────────────────────────────────

  /**
   * Load an audio file from a URL.
   * @param url - URL of the audio file.
   */
  loadAudio(url: string): Promise<void>;

  /** Start or resume playback. */
  play(): void;

  /** Pause playback. */
  pause(): void;

  /** Stop playback and reset to the beginning. */
  stop(): void;

  /**
   * Seek to a specific time in seconds.
   * @param time - Target time in seconds.
   */
  seek(time: number): void;

  // ── Properties ─────────────────────────────────────────────────

  /** Current playback position in seconds. */
  readonly currentTime: number;

  /** Total duration of the loaded audio in seconds. */
  readonly duration: number;

  /** Whether audio is currently playing. */
  readonly isPlaying: boolean;

  /** Volume level from 0 (silent) to 1 (full). */
  volume: number;

  // ── Lip sync / Viseme support ──────────────────────────────────

  /**
   * Set the viseme map (time ranges to viseme names).
   * @param map - Array of viseme entries sorted by start time.
   */
  setVisemeMap(map: VisemeEntry[]): void;

  /**
   * Get the current viseme based on playback position.
   * @returns Current viseme name, or `null` if none matches.
   */
  getCurrentViseme(): string | null;

  // ── Parameter binding ──────────────────────────────────────────

  /**
   * Bind a parameter to an audio property.
   * @param paramName - Name of the parameter in the parameter system.
   * @param options - Binding options (source, min, max).
   */
  bindToParameter(paramName: string, options?: AudioParameterBindingOptions): void;

  /**
   * Remove a parameter binding.
   * @param paramName - Name of the parameter to unbind.
   */
  unbindParameter(paramName: string): void;

  // ── Marker / cue system ────────────────────────────────────────

  /**
   * Add a named time marker.
   * @param name - Marker name.
   * @param time - Time position in seconds.
   */
  addMarker(name: string, time: number): void;

  /**
   * Remove a named marker.
   * @param name - Marker name to remove.
   */
  removeMarker(name: string): void;

  /**
   * Get all markers.
   * @returns Array of marker objects.
   */
  getMarkers(): AudioMarker[];

  /**
   * Register a callback for when playback reaches a marker.
   * @param name - Marker name.
   * @param callback - Invoked with marker info when reached.
   * @returns Unsubscribe function.
   */
  onMarker(name: string, callback: (marker: AudioMarker) => void): Unsubscribe;

  // ── Update loop ────────────────────────────────────────────────

  /**
   * Called each frame from the animation loop.
   * Checks markers, updates bound parameters, emits events.
   * @param deltaTime - Time since last frame in seconds.
   */
  update(deltaTime: number): void;

  // ── Cleanup ────────────────────────────────────────────────────

  /** Dispose of all resources. */
  dispose(): void;
}

// ─────────────────────────────────────────────────────────────────
// Main WFLAnimator Class
// ─────────────────────────────────────────────────────────────────

/** Sprite position offsets for compositing layers. */
export interface SpritePositions {
  mouth?: Point2D;
  eyes?: Point2D;
}

/** Sprite data loaded from a WFL file for sprite-based rendering. */
export interface SpriteData {
  /** URL of the base character sprite. */
  base?: string;
  /** Array of mouth sprite URLs indexed by mouthState. */
  mouths?: string[];
  /** Array of eye sprite URLs indexed by eyeState. */
  eyes?: string[];
  /** Position offsets for mouth and eye sprite layers. */
  positions?: SpritePositions;
}

/** Options for constructing a WFLAnimator instance. */
export interface WFLAnimatorOptions {
  /** Custom event bus (defaults to globalEventBus). */
  eventBus?: EventBus;
  /** Custom permission manager (defaults to globalPermissionManager). */
  permissionManager?: PermissionManager;
  /** Custom session store (defaults to globalSessionStore). */
  sessionStore?: SessionStore;
}

/** Options for the {@link WFLAnimator.load} method. */
export interface WFLAnimatorLoadOptions {
  /** Whether to use streaming fetch (default `true`). */
  streaming?: boolean;
  /** DOM element or selector to show loading indicator on. */
  loadingTarget?: HTMLElement | string | null;
}

/**
 * Main animation controller for WFL.
 *
 * Combines the parameter system, state machine, bone rigging,
 * streaming loader, permission management, and session persistence
 * into a single high-level API.
 *
 * @example
 * ```ts
 * const animator = new WFLAnimator();
 * await animator.init();
 * await animator.load('/assets/character.wfl');
 * animator.initCanvas(document.querySelector('canvas')!);
 * animator.setMouth(2);
 * animator.setTalking(true);
 * ```
 */
export declare class WFLAnimator {
  // ── Core systems ────────────────────────────────────────────────
  /** Parameter system controlling animation values. */
  parameters: ParameterSystem;
  /** State machine for animation state transitions (null until loaded). */
  stateMachine: StateMachine | null;
  /** Bone rigging system. */
  rigging: DragonBonesRigging;
  /** Loaded WFL file data (null until loaded). */
  file: WFLFile | null;
  /** Canvas element (null until initialized). */
  canvas: HTMLCanvasElement | null;
  /** Canvas 2D rendering context (null until initialized). */
  context: CanvasRenderingContext2D | null;
  /** Active requestAnimationFrame ID. */
  animationFrame: number | null;
  /** Timestamp of the last animation frame. */
  lastTime: number;

  // ── Sprite rendering ────────────────────────────────────────────
  /** Named sprite images. */
  sprites: Map<string, HTMLImageElement>;
  /** Current base character sprite. */
  characterSprite: HTMLImageElement | null;
  /** Mouth shape sprites indexed by mouthState. */
  mouthSprites: HTMLImageElement[];
  /** Eye sprites indexed by eyeState. */
  eyeSprites: HTMLImageElement[];
  /** Position offsets for sprite compositing. */
  spritePositions: SpritePositions;

  // ── Audio synchronization ───────────────────────────────────────
  /** Audio synchronization system. */
  audioSync: AudioSync;

  // ── Subsystems ──────────────────────────────────────────────────
  /** Event bus instance. */
  eventBus: EventBus;
  /** Streaming state manager. */
  streaming: StreamingState;
  /** Streaming animation loader. */
  streamingLoader: StreamingAnimationLoader;
  /** Permission manager. */
  permissions: PermissionManager;
  /** Session store. */
  sessionStore: SessionStore;
  /** Permission dialog UI (null until DOM init). */
  permissionDialog: PermissionDialog | null;

  // ── Session state ───────────────────────────────────────────────
  /** Currently active session (null if none). */
  currentSession: Session | null;
  /** Whether the animator has been initialized. */
  isInitialized: boolean;

  /** Whether the animation loop is paused. */
  readonly isPaused: boolean;

  constructor(options?: WFLAnimatorOptions);

  /**
   * Initialize the animator. Sets up IndexedDB, permission dialog,
   * and injects CSS styles. Safe to call multiple times.
   * @returns This animator instance for chaining.
   */
  init(): Promise<this>;

  /**
   * Load a WFL animation file from a URL.
   * Supports streaming progress and sprite/bone data.
   * @param url - URL of the `.wfl` file.
   * @param options - Loading options.
   * @returns The loaded WFLFile.
   */
  load(url: string, options?: WFLAnimatorLoadOptions): Promise<WFLFile>;

  /**
   * Attach to a canvas element and start the animation loop.
   * @param canvas - Target canvas element.
   */
  initCanvas(canvas: HTMLCanvasElement): void;

  /** Start the requestAnimationFrame render loop. */
  startAnimationLoop(): void;

  /** Render the current frame to the canvas. */
  render(): void;

  // ── Sprite methods ──────────────────────────────────────────────

  /**
   * Load sprite images from structured sprite data.
   * @param spriteData - Base, mouth, and eye sprite URLs with positions.
   */
  loadSprites(spriteData: SpriteData): Promise<void>;

  /**
   * Load a single named sprite image.
   * @param name - Sprite name for later retrieval.
   * @param src - Image URL.
   * @returns The loaded HTMLImageElement.
   */
  loadSprite(name: string, src: string): Promise<HTMLImageElement>;

  /** Render sprite layers (base + mouth + eyes) to the canvas. */
  renderSprites(): void;

  // ── Session management ──────────────────────────────────────────

  /**
   * Start a new animation session.
   * @param title - Optional session title.
   * @returns The created session.
   */
  startSession(title?: string | null): Promise<Session>;

  /**
   * Resume a previously saved session.
   * @param sessionId - Session ID to resume.
   * @returns The restored session.
   */
  resumeSession(sessionId: string): Promise<Session | undefined>;

  /**
   * Save the current animation state to the active session.
   * Creates a new session if none is active.
   * @returns The saved session.
   */
  saveSession(): Promise<Session>;

  /**
   * Create a state snapshot of the current parameters and state machine.
   * @returns Snapshot object.
   */
  createSnapshot(): SessionSnapshot;

  /**
   * Restore animator state from a snapshot.
   * @param snapshot - Previously created snapshot.
   */
  restoreFromSnapshot(snapshot: SessionSnapshot): Promise<void>;

  /**
   * List all saved sessions, sorted by most recently updated.
   * @returns Sanitized session list.
   */
  listSessions(): SanitizedSession[];

  /**
   * Delete a session (requires user permission).
   * @param sessionId - Session ID to delete.
   * @returns `true` if the session was deleted, `false` if denied.
   */
  deleteSession(sessionId: string): Promise<boolean>;

  // ── Playback control ────────────────────────────────────────────

  /** Pause the animation loop (frames still run but skip updates). */
  pause(): void;

  /** Resume animation updates after a pause. */
  resume(): void;

  /**
   * Set the animation speed multiplier.
   * @param multiplier - Speed factor (1.0 = normal, 0.5 = half speed, 2.0 = double).
   */
  setSpeed(multiplier: number): void;

  /**
   * Get the current value of a parameter by name.
   * @param name - Parameter name.
   * @returns Current value, or `undefined` if the parameter does not exist.
   */
  getParameter(name: string): any;

  /**
   * Get the name of the current state machine state.
   * @returns State name, or `null` if no state machine is loaded.
   */
  getCurrentState(): string | null;

  // ── WFL-specific controls ───────────────────────────────────────

  /**
   * Set the mouth shape state.
   * @param state - Mouth state index (0 = closed, 1-6 = various shapes).
   */
  setMouth(state: number): void;

  /**
   * Set head turn angle.
   * @param degrees - Rotation in degrees.
   */
  setHeadTurn(degrees: number): void;

  /**
   * Set the eye state.
   * @param state - Eye state index (0 = open, 1 = closed, etc.).
   */
  setEye(state: number): void;

  /**
   * Set the roast tone parameter.
   * @param tone - Tone value.
   */
  setTone(tone: number): void;

  /**
   * Set whether the character is talking.
   * When `true`, starts a looping talk animation; when `false`, stops it.
   * @param talking - Talking state.
   */
  setTalking(talking: boolean): void;

  // ── Permission-guarded operations ───────────────────────────────

  /**
   * Reset all parameters to their defaults (requires permission).
   * @returns `true` if reset was performed, `false` if denied.
   */
  resetParameters(): Promise<boolean>;

  /**
   * Reset the state machine to its entry state (requires permission).
   * @returns `true` if reset was performed, `false` if denied.
   */
  resetStateMachine(): Promise<boolean>;

  /**
   * Clear all animation data including state machine, parameters, and file (requires permission).
   * @returns `true` if cleared, `false` if denied.
   */
  clearAll(): Promise<boolean>;

  // ── Cleanup ─────────────────────────────────────────────────────

  /**
   * Dispose of all resources: cancel animation frame, remove event listeners,
   * dispose permission dialog, and release object references.
   */
  dispose(): void;
}
