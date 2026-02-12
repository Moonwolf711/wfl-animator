/**
 * AudioSync - Audio synchronization for WFL Animator
 * Supports Web Audio API in browsers and falls back to a stub
 * implementation in Node.js for testability.
 */

import { EventTypes } from './core/event-bus.js';

/**
 * Detect whether the Web Audio API is available.
 * @returns {boolean}
 */
function hasWebAudio() {
  return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
}

export class AudioSync {
  /**
   * @param {Object} options
   * @param {import('./core/event-bus.js').EventBus} [options.eventBus]
   * @param {import('./core/parameter.js').ParameterSystem} [options.parameterSystem]
   */
  constructor(options = {}) {
    this._eventBus = options.eventBus || null;
    this._parameterSystem = options.parameterSystem || null;

    // Playback state
    this._isPlaying = false;
    this._currentTime = 0;
    this._duration = 0;
    this._volume = 1;
    this._playbackStartWall = 0; // wall-clock time when playback started

    // Web Audio API objects (browser only)
    this._audioContext = null;
    this._audioBuffer = null;
    this._sourceNode = null;
    this._gainNode = null;
    this._analyserNode = null;
    this._useWebAudio = hasWebAudio();

    // Viseme map: sorted array of { start, end, viseme }
    this._visemeMap = [];
    this._lastViseme = null;

    // Parameter bindings: Map<paramName, { source }>
    this._parameterBindings = new Map();

    // Markers: Map<name, time>
    this._markers = new Map();
    // Marker callbacks: Map<name, Set<callback>>
    this._markerCallbacks = new Map();
    // Track which markers have already fired for this play-through
    this._firedMarkers = new Set();

    // Disposed flag
    this._disposed = false;
  }

  // ─────────────────────────────────────────────────────────────────
  // Core audio control
  // ─────────────────────────────────────────────────────────────────

  /**
   * Load an audio file from a URL.
   * In Node.js (no Web Audio), this creates a stub duration.
   * @param {string} url
   * @returns {Promise<void>}
   */
  async loadAudio(url) {
    if (this._useWebAudio) {
      const ContextClass = typeof AudioContext !== 'undefined'
        ? AudioContext
        : webkitAudioContext;
      this._audioContext = new ContextClass();
      this._gainNode = this._audioContext.createGain();
      this._gainNode.connect(this._audioContext.destination);

      this._analyserNode = this._audioContext.createAnalyser();
      this._analyserNode.fftSize = 256;
      this._gainNode.connect(this._analyserNode);

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this._audioBuffer = await this._audioContext.decodeAudioData(arrayBuffer);
      this._duration = this._audioBuffer.duration;
    } else {
      // Stub for Node.js testing -- caller can set _duration manually
      this._duration = 0;
      this._audioBuffer = null;
    }

    this._currentTime = 0;
    this._isPlaying = false;
  }

  /**
   * Start or resume playback.
   */
  play() {
    if (this._isPlaying || this._disposed) return;

    this._isPlaying = true;
    this._playbackStartWall = Date.now() / 1000 - this._currentTime;

    if (this._useWebAudio && this._audioBuffer && this._audioContext) {
      this._sourceNode = this._audioContext.createBufferSource();
      this._sourceNode.buffer = this._audioBuffer;
      this._sourceNode.connect(this._gainNode);
      this._sourceNode.start(0, this._currentTime);

      this._sourceNode.onended = () => {
        if (this._isPlaying) {
          this.stop();
        }
      };
    }

    this._emitEvent(EventTypes.AUDIO_PLAY, { time: this._currentTime });
  }

  /**
   * Pause playback.
   */
  pause() {
    if (!this._isPlaying || this._disposed) return;

    // Snapshot current time before stopping
    if (this._useWebAudio && this._audioContext) {
      this._currentTime = this._audioContext.currentTime -
        (this._playbackStartWall - (Date.now() / 1000 - this._audioContext.currentTime));
      // Simplified: use wall clock delta
      this._currentTime = Date.now() / 1000 - this._playbackStartWall;
    }

    this._stopSourceNode();
    this._isPlaying = false;

    this._emitEvent(EventTypes.AUDIO_PAUSE, { time: this._currentTime });
  }

  /**
   * Stop playback and reset to the beginning.
   */
  stop() {
    this._stopSourceNode();
    this._isPlaying = false;
    this._currentTime = 0;
    this._firedMarkers.clear();

    this._emitEvent(EventTypes.AUDIO_STOP, { time: 0 });
  }

  /**
   * Seek to a specific time in seconds.
   * @param {number} time
   */
  seek(time) {
    const wasPlaying = this._isPlaying;

    if (wasPlaying) {
      this._stopSourceNode();
    }

    this._currentTime = Math.max(0, Math.min(time, this._duration));
    this._firedMarkers.clear();

    // Re-mark markers before current time as fired so they don't re-trigger
    for (const [name, markerTime] of this._markers) {
      if (markerTime <= this._currentTime) {
        this._firedMarkers.add(name);
      }
    }

    if (wasPlaying) {
      this._isPlaying = false;
      this.play();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Properties
  // ─────────────────────────────────────────────────────────────────

  /** Current playback position in seconds. */
  get currentTime() {
    if (this._isPlaying) {
      return Date.now() / 1000 - this._playbackStartWall;
    }
    return this._currentTime;
  }

  /** Total duration of the loaded audio. */
  get duration() {
    return this._duration;
  }

  /** Whether audio is currently playing. */
  get isPlaying() {
    return this._isPlaying;
  }

  /** Volume level 0-1. */
  get volume() {
    return this._volume;
  }

  /** Set volume level 0-1. */
  set volume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._gainNode) {
      this._gainNode.gain.value = this._volume;
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Lip sync / Viseme support
  // ─────────────────────────────────────────────────────────────────

  /**
   * Set the viseme map (time ranges to viseme names).
   * @param {Array<{start: number, end: number, viseme: string}>} map
   */
  setVisemeMap(map) {
    this._visemeMap = [...map].sort((a, b) => a.start - b.start);
    this._lastViseme = null;
  }

  /**
   * Returns the current viseme based on playback position.
   * @returns {string|null}
   */
  getCurrentViseme() {
    const time = this.currentTime;
    for (const entry of this._visemeMap) {
      if (time >= entry.start && time < entry.end) {
        return entry.viseme;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Parameter binding
  // ─────────────────────────────────────────────────────────────────

  /**
   * Bind a parameter to an audio property.
   * @param {string} paramName - Name of the parameter in the parameter system
   * @param {Object} [options]
   * @param {string} [options.source='amplitude'] - What to bind: 'amplitude', 'time', 'progress'
   * @param {number} [options.min=0] - Output minimum
   * @param {number} [options.max=1] - Output maximum
   */
  bindToParameter(paramName, options = {}) {
    const binding = {
      source: options.source || 'amplitude',
      min: options.min !== undefined ? options.min : 0,
      max: options.max !== undefined ? options.max : 1
    };
    this._parameterBindings.set(paramName, binding);
  }

  /**
   * Remove a parameter binding.
   * @param {string} paramName
   */
  unbindParameter(paramName) {
    this._parameterBindings.delete(paramName);
  }

  // ─────────────────────────────────────────────────────────────────
  // Marker / cue system
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add a named time marker.
   * @param {string} name
   * @param {number} time - Time in seconds
   */
  addMarker(name, time) {
    this._markers.set(name, time);
  }

  /**
   * Remove a named marker.
   * @param {string} name
   */
  removeMarker(name) {
    this._markers.delete(name);
    this._markerCallbacks.delete(name);
    this._firedMarkers.delete(name);
  }

  /**
   * Get all markers.
   * @returns {Array<{name: string, time: number}>}
   */
  getMarkers() {
    const result = [];
    for (const [name, time] of this._markers) {
      result.push({ name, time });
    }
    return result;
  }

  /**
   * Register a callback for when playback reaches a marker.
   * @param {string} name
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onMarker(name, callback) {
    if (!this._markerCallbacks.has(name)) {
      this._markerCallbacks.set(name, new Set());
    }
    this._markerCallbacks.get(name).add(callback);

    return () => {
      const callbacks = this._markerCallbacks.get(name);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this._markerCallbacks.delete(name);
        }
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Update loop
  // ─────────────────────────────────────────────────────────────────

  /**
   * Called each frame from the animation loop.
   * Checks markers, updates bound parameters, emits events.
   * @param {number} _deltaTime - Time since last frame in seconds (unused, we track wall clock)
   */
  update(_deltaTime) {
    if (this._disposed) return;

    const time = this.currentTime;

    // Update internal time snapshot (for non-Web Audio environments)
    if (this._isPlaying) {
      this._currentTime = time;
    }

    // Check markers
    this._checkMarkers(time);

    // Check viseme changes
    this._checkVisemeChange(time);

    // Update bound parameters
    this._updateParameterBindings(time);

    // Auto-stop when we've gone past duration (stub/non-WebAudio mode)
    if (this._isPlaying && this._duration > 0 && time >= this._duration) {
      this.stop();
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────

  /**
   * Dispose of all resources.
   */
  dispose() {
    this._disposed = true;

    if (this._isPlaying) {
      this._stopSourceNode();
      this._isPlaying = false;
    }

    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }

    this._audioBuffer = null;
    this._sourceNode = null;
    this._gainNode = null;
    this._analyserNode = null;
    this._visemeMap = [];
    this._lastViseme = null;
    this._parameterBindings.clear();
    this._markers.clear();
    this._markerCallbacks.clear();
    this._firedMarkers.clear();
    this._eventBus = null;
    this._parameterSystem = null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Stop the current Web Audio source node (if any).
   * @private
   */
  _stopSourceNode() {
    if (this._sourceNode) {
      try {
        this._sourceNode.stop();
      } catch (_e) {
        // Ignore errors from already-stopped nodes
      }
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
  }

  /**
   * Emit an event through the event bus.
   * @private
   * @param {string} type
   * @param {Object} payload
   */
  _emitEvent(type, payload) {
    if (this._eventBus) {
      this._eventBus.emit({ type, payload });
    }
  }

  /**
   * Check whether any markers have been reached and fire callbacks.
   * @private
   * @param {number} time
   */
  _checkMarkers(time) {
    for (const [name, markerTime] of this._markers) {
      if (markerTime <= time && !this._firedMarkers.has(name)) {
        this._firedMarkers.add(name);

        // Fire registered callbacks
        const callbacks = this._markerCallbacks.get(name);
        if (callbacks) {
          callbacks.forEach(cb => cb({ name, time: markerTime }));
        }

        // Emit event
        this._emitEvent(EventTypes.AUDIO_MARKER, { name, time: markerTime });
      }
    }
  }

  /**
   * Check whether the current viseme has changed and emit if so.
   * @private
   * @param {number} time
   */
  _checkVisemeChange(time) {
    let currentViseme = null;
    for (const entry of this._visemeMap) {
      if (time >= entry.start && time < entry.end) {
        currentViseme = entry.viseme;
        break;
      }
    }

    if (currentViseme !== this._lastViseme) {
      const previous = this._lastViseme;
      this._lastViseme = currentViseme;
      this._emitEvent(EventTypes.AUDIO_VISEME_CHANGE, {
        viseme: currentViseme,
        previous,
        time
      });
    }
  }

  /**
   * Update all bound parameters based on current audio state.
   * @private
   * @param {number} time
   */
  _updateParameterBindings(time) {
    if (!this._parameterSystem) return;

    for (const [paramName, binding] of this._parameterBindings) {
      let rawValue = 0;

      switch (binding.source) {
        case 'amplitude':
          rawValue = this._getAmplitude();
          break;
        case 'time':
          rawValue = time;
          break;
        case 'progress':
          rawValue = this._duration > 0 ? time / this._duration : 0;
          break;
        default:
          rawValue = 0;
      }

      // Map raw value (0-1 range) to [min, max]
      const mapped = binding.min + rawValue * (binding.max - binding.min);
      this._parameterSystem.set(paramName, mapped);
    }
  }

  /**
   * Get the current audio amplitude (0-1).
   * Uses Web Audio analyser node when available.
   * Falls back to a simple volume-based value.
   * @private
   * @returns {number}
   */
  _getAmplitude() {
    if (this._analyserNode && this._isPlaying) {
      const data = new Uint8Array(this._analyserNode.frequencyBinCount);
      this._analyserNode.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const val = (data[i] - 128) / 128;
        sum += val * val;
      }
      return Math.sqrt(sum / data.length);
    }

    // Fallback: return volume if playing, 0 otherwise
    return this._isPlaying ? this._volume : 0;
  }
}
