/**
 * Streaming State Manager - Real-time animation state updates
 * Inspired by Claude-Cowork's partial message streaming pattern
 */

import { EventTypes, globalEventBus } from './event-bus.js';

export class StreamingState {
  constructor(eventBus = globalEventBus) {
    this.eventBus = eventBus;
    this.activeStreams = new Map();
    this.partialState = {};
    this.isStreaming = false;
  }

  /**
   * Start a new stream
   * @param {string} streamId - Unique stream identifier
   * @param {Object} metadata - Stream metadata
   */
  startStream(streamId, metadata = {}) {
    const stream = {
      id: streamId,
      metadata,
      buffer: [],
      startTime: Date.now(),
      status: 'active'
    };

    this.activeStreams.set(streamId, stream);
    this.isStreaming = true;

    this.eventBus.emit({
      type: EventTypes.STREAM_START,
      payload: { streamId, metadata }
    });

    return stream;
  }

  /**
   * Push update to stream (partial state update)
   * @param {string} streamId - Stream identifier
   * @param {Object} delta - Partial state delta
   */
  pushUpdate(streamId, delta) {
    const stream = this.activeStreams.get(streamId);
    if (!stream || stream.status !== 'active') {
      console.warn(`Stream ${streamId} not found or inactive`);
      return;
    }

    // Buffer the delta
    stream.buffer.push({
      delta,
      timestamp: Date.now()
    });

    // Merge into partial state
    this.partialState = this.mergeState(this.partialState, delta);

    this.eventBus.emit({
      type: EventTypes.STREAM_UPDATE,
      payload: {
        streamId,
        delta,
        partialState: { ...this.partialState }
      }
    });
  }

  /**
   * Complete a stream
   * @param {string} streamId - Stream identifier
   * @param {Object} [finalState] - Optional final state
   */
  completeStream(streamId, finalState = null) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.status = 'completed';
    stream.endTime = Date.now();
    stream.duration = stream.endTime - stream.startTime;

    const result = finalState || this.partialState;

    this.eventBus.emit({
      type: EventTypes.STREAM_COMPLETE,
      payload: {
        streamId,
        finalState: result,
        duration: stream.duration,
        updateCount: stream.buffer.length
      }
    });

    // Cleanup
    this.activeStreams.delete(streamId);
    this.partialState = {};
    this.isStreaming = this.activeStreams.size > 0;

    return result;
  }

  /**
   * Error in stream
   * @param {string} streamId - Stream identifier
   * @param {Error|string} error - Error details
   */
  errorStream(streamId, error) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.status = 'error';
    stream.error = error;

    this.eventBus.emit({
      type: EventTypes.STREAM_ERROR,
      payload: {
        streamId,
        error: error instanceof Error ? error.message : error
      }
    });

    this.activeStreams.delete(streamId);
    this.isStreaming = this.activeStreams.size > 0;
  }

  /**
   * Get current partial state
   */
  getPartialState() {
    return { ...this.partialState };
  }

  /**
   * Check if currently streaming
   */
  isActive() {
    return this.isStreaming;
  }

  /**
   * Deep merge state objects
   */
  mergeState(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeState(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

/**
 * Streaming Animation Controller
 * Handles progressive loading of animation data
 */
export class StreamingAnimationLoader {
  constructor(eventBus = globalEventBus) {
    this.eventBus = eventBus;
    this.streaming = new StreamingState(eventBus);
    this.loadingIndicators = new Map();
  }

  /**
   * Load animation data with streaming updates
   * @param {string} url - Animation file URL
   * @param {Object} options - Loading options
   */
  async loadWithStreaming(url, options = {}) {
    const streamId = `load-${Date.now()}`;
    this.streaming.startStream(streamId, { url, ...options });

    // Show loading indicator
    this.showLoadingIndicator(streamId, options.target);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback for non-streaming
        const data = await response.json();
        this.streaming.pushUpdate(streamId, data);
        return this.streaming.completeStream(streamId, data);
      }

      // Stream the response
      const chunks = [];
      let received = 0;
      const contentLength = parseInt(response.headers.get('content-length') || '0');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        // Push progress update
        this.streaming.pushUpdate(streamId, {
          progress: contentLength > 0 ? received / contentLength : null,
          bytesReceived: received
        });
      }

      // Combine chunks and parse
      const allChunks = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      const text = new TextDecoder().decode(allChunks);
      const data = JSON.parse(text);

      return this.streaming.completeStream(streamId, data);

    } catch (error) {
      this.streaming.errorStream(streamId, error);
      throw error;
    } finally {
      this.hideLoadingIndicator(streamId);
    }
  }

  /**
   * Show loading indicator (skeleton animation)
   */
  showLoadingIndicator(streamId, target = null) {
    const indicator = {
      id: streamId,
      target,
      element: null,
      animationFrame: null
    };

    // Create skeleton loader if DOM is available
    if (typeof document !== 'undefined' && target) {
      const element = document.createElement('div');
      element.className = 'wfl-streaming-loader';
      element.innerHTML = `
        <div class="wfl-skeleton">
          <div class="wfl-skeleton-line wfl-skeleton-line--short"></div>
          <div class="wfl-skeleton-line"></div>
          <div class="wfl-skeleton-line"></div>
          <div class="wfl-skeleton-line wfl-skeleton-line--medium"></div>
        </div>
      `;
      indicator.element = element;

      const targetEl = typeof target === 'string'
        ? document.querySelector(target)
        : target;
      if (targetEl) {
        targetEl.appendChild(element);
      }
    }

    this.loadingIndicators.set(streamId, indicator);
    return indicator;
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator(streamId) {
    const indicator = this.loadingIndicators.get(streamId);
    if (indicator) {
      if (indicator.element && indicator.element.parentNode) {
        indicator.element.parentNode.removeChild(indicator.element);
      }
      if (indicator.animationFrame) {
        cancelAnimationFrame(indicator.animationFrame);
      }
      this.loadingIndicators.delete(streamId);
    }
  }

  /**
   * Get CSS for skeleton loader
   */
  static getSkeletonCSS() {
    return `
      .wfl-streaming-loader {
        padding: 1rem;
      }
      .wfl-skeleton {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .wfl-skeleton-line {
        height: 0.75rem;
        background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
        background-size: 200% 100%;
        animation: wfl-shimmer 1.5s infinite;
        border-radius: 0.25rem;
      }
      .wfl-skeleton-line--short {
        width: 30%;
      }
      .wfl-skeleton-line--medium {
        width: 60%;
      }
      @keyframes wfl-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
  }
}

// Singleton instance
export const globalStreamingState = new StreamingState();
