/**
 * Permission System - Confirmation for destructive operations
 * Inspired by Claude-Cowork's tool permission pattern
 */

import { EventTypes, globalEventBus } from './event-bus.js';

export class PermissionManager {
  constructor(eventBus = globalEventBus) {
    this.eventBus = eventBus;
    this.pendingRequests = new Map();
    this.autoApproveList = new Set();
    this.autoDenyList = new Set();
    this.permissionMode = 'ask'; // 'ask', 'allow', 'deny'
  }

  /**
   * Request permission for an action
   * @param {string} actionType - Type of action requiring permission
   * @param {Object} details - Action details
   * @returns {Promise<PermissionResult>}
   */
  async requestPermission(actionType, details = {}) {
    // Check permission mode
    if (this.permissionMode === 'allow') {
      return { behavior: 'allow', actionType, details };
    }
    if (this.permissionMode === 'deny') {
      return { behavior: 'deny', message: 'All permissions denied by mode' };
    }

    // Check auto-approve/deny lists
    if (this.autoApproveList.has(actionType)) {
      return { behavior: 'allow', actionType, details };
    }
    if (this.autoDenyList.has(actionType)) {
      return { behavior: 'deny', message: 'Action type auto-denied' };
    }

    // Create permission request
    const requestId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return new Promise((resolve) => {
      const request = {
        id: requestId,
        actionType,
        details,
        createdAt: Date.now(),
        resolve
      };

      this.pendingRequests.set(requestId, request);

      // Emit permission request event
      this.eventBus.emit({
        type: EventTypes.PERMISSION_REQUEST,
        payload: {
          requestId,
          actionType,
          details,
          message: this.getPermissionMessage(actionType, details)
        }
      });

      // Timeout after 30 seconds (auto-deny)
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.respondToPermission(requestId, {
            behavior: 'deny',
            message: 'Permission request timed out'
          });
        }
      }, 30000);
    });
  }

  /**
   * Respond to a permission request
   * @param {string} requestId - Request identifier
   * @param {PermissionResult} result - Permission result
   */
  respondToPermission(requestId, result) {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return;
    }

    this.pendingRequests.delete(requestId);

    this.eventBus.emit({
      type: EventTypes.PERMISSION_RESPONSE,
      payload: { requestId, result }
    });

    request.resolve(result);
  }

  /**
   * Get user-friendly permission message
   */
  getPermissionMessage(actionType, details) {
    const messages = {
      'session.delete': `Delete session "${details.sessionName || details.sessionId}"?`,
      'state.delete': `Delete animation state "${details.stateName}"?`,
      'state.reset': 'Reset all animation states to defaults?',
      'parameter.reset': 'Reset all parameters to defaults?',
      'file.overwrite': `Overwrite file "${details.filename}"?`,
      'animation.clear': 'Clear all animation data?',
      'transition.delete': `Delete transition from "${details.from}" to "${details.to}"?`
    };

    return messages[actionType] || `Allow action: ${actionType}?`;
  }

  /**
   * Set permission mode
   * @param {'ask' | 'allow' | 'deny'} mode
   */
  setMode(mode) {
    if (!['ask', 'allow', 'deny'].includes(mode)) {
      throw new Error(`Invalid permission mode: ${mode}`);
    }
    this.permissionMode = mode;
  }

  /**
   * Auto-approve specific action type
   */
  autoApprove(actionType) {
    this.autoDenyList.delete(actionType);
    this.autoApproveList.add(actionType);
  }

  /**
   * Auto-deny specific action type
   */
  autoDeny(actionType) {
    this.autoApproveList.delete(actionType);
    this.autoDenyList.add(actionType);
  }

  /**
   * Clear auto-approve/deny for action type
   */
  clearAutoResponse(actionType) {
    this.autoApproveList.delete(actionType);
    this.autoDenyList.delete(actionType);
  }

  /**
   * Get pending requests
   */
  getPendingRequests() {
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Cancel all pending requests
   */
  cancelAll() {
    this.pendingRequests.forEach((_request, requestId) => {
      this.respondToPermission(requestId, {
        behavior: 'deny',
        message: 'All permissions cancelled'
      });
    });
  }
}

// Action types requiring permission
export const PermissionActions = {
  SESSION_DELETE: 'session.delete',
  STATE_DELETE: 'state.delete',
  STATE_RESET: 'state.reset',
  PARAMETER_RESET: 'parameter.reset',
  FILE_OVERWRITE: 'file.overwrite',
  ANIMATION_CLEAR: 'animation.clear',
  TRANSITION_DELETE: 'transition.delete'
};

/**
 * Permission UI Component (creates DOM dialog)
 */
export class PermissionDialog {
  constructor(eventBus = globalEventBus) {
    this.eventBus = eventBus;
    this.container = null;
    this.abortController = null;
    this.unsubscribe = this.setupListener();
  }

  /**
   * Setup event listener for permission requests
   */
  setupListener() {
    return this.eventBus.on(EventTypes.PERMISSION_REQUEST, (event) => {
      this.showDialog(event.payload);
    });
  }

  /**
   * Show permission dialog
   */
  showDialog(request) {
    if (typeof document === 'undefined') return;

    // Remove existing dialog
    this.hideDialog();

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.container = document.createElement('div');
    this.container.className = 'wfl-permission-overlay';
    this.container.innerHTML = `
      <div class="wfl-permission-dialog">
        <div class="wfl-permission-header">
          <span class="wfl-permission-icon">&#9888;</span>
          <span class="wfl-permission-title">Confirm Action</span>
        </div>
        <div class="wfl-permission-message">${this.escapeHtml(request.message)}</div>
        <div class="wfl-permission-details">
          <code>${this.escapeHtml(request.actionType)}</code>
        </div>
        <div class="wfl-permission-actions">
          <button class="wfl-btn wfl-btn--deny" data-action="deny">Cancel</button>
          <button class="wfl-btn wfl-btn--allow" data-action="allow">Confirm</button>
        </div>
      </div>
    `;

    // Add event listeners with AbortController for cleanup
    this.container.querySelector('[data-action="allow"]').addEventListener('click', () => {
      this.eventBus.emit({
        type: EventTypes.PERMISSION_RESPONSE,
        payload: {
          requestId: request.requestId,
          result: { behavior: 'allow' }
        }
      });
      this.hideDialog();
    }, { signal });

    this.container.querySelector('[data-action="deny"]').addEventListener('click', () => {
      this.eventBus.emit({
        type: EventTypes.PERMISSION_RESPONSE,
        payload: {
          requestId: request.requestId,
          result: { behavior: 'deny', message: 'User cancelled' }
        }
      });
      this.hideDialog();
    }, { signal });

    // Close on overlay click
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.eventBus.emit({
          type: EventTypes.PERMISSION_RESPONSE,
          payload: {
            requestId: request.requestId,
            result: { behavior: 'deny', message: 'User dismissed' }
          }
        });
        this.hideDialog();
      }
    }, { signal });

    document.body.appendChild(this.container);
  }

  /**
   * Hide permission dialog
   */
  hideDialog() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  /**
   * Dispose of dialog and event listeners
   */
  dispose() {
    this.hideDialog();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get CSS for permission dialog
   */
  static getDialogCSS() {
    return `
      .wfl-permission-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      }
      .wfl-permission-dialog {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      }
      .wfl-permission-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .wfl-permission-icon {
        font-size: 1.5rem;
      }
      .wfl-permission-title {
        font-size: 1.125rem;
        font-weight: 600;
      }
      .wfl-permission-message {
        color: #444;
        margin-bottom: 0.75rem;
      }
      .wfl-permission-details {
        background: #f5f5f5;
        padding: 0.5rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
      }
      .wfl-permission-details code {
        font-size: 0.875rem;
        color: #666;
      }
      .wfl-permission-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
      .wfl-btn {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }
      .wfl-btn--deny {
        background: #f0f0f0;
        color: #666;
      }
      .wfl-btn--deny:hover {
        background: #e0e0e0;
      }
      .wfl-btn--allow {
        background: #e74c3c;
        color: white;
      }
      .wfl-btn--allow:hover {
        background: #c0392b;
      }
    `;
  }
}

// Singleton instance
export const globalPermissionManager = new PermissionManager();
