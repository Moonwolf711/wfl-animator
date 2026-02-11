# WFL Animator Project Index

## Overview
Animation system with Claude-Cowork patterns: EventBus, Streaming, Permissions, Sessions.

**Repository:** [GitHub](https://github.com/Moonwolf711/wfl-animator)
**Last Updated:** 2026-01-13

---

## File Structure

### Core Modules
| File | Purpose | LOC |
|------|---------|-----|
| `src/animator.js` | Main WFLAnimator class | ~570 |
| `src/core/event-bus.js` | IPC-like pub/sub events | ~140 |
| `src/core/streaming.js` | Progressive loading + skeleton UI | ~200 |
| `src/core/permission.js` | Confirmation dialogs | ~250 |
| `src/core/session-store.js` | IndexedDB persistence | ~280 |
| `src/core/parameter.js` | Animation parameters | ~110 |
| `src/core/state-machine.js` | State transitions | ~135 |
| `src/core/file-format.js` | WFL file parsing | ~50 |

### Rigging
| File | Purpose |
|------|---------|
| `src/rigging/dragon-bones.js` | DragonBones integration |

### Tests
| File | Tests | Pass Rate |
|------|-------|-----------|
| `tests/cowork-patterns-tests.js` | 53 | 100% |

### Documentation
| File | Content |
|------|---------|
| `README.md` | Project overview |
| `QUICKSTART.md` | Getting started |
| `SETUP.md` | Installation |
| `GETTING_STARTED.md` | Tutorial |
| `INTEGRATION_GUIDE.md` | Integration patterns |
| `docs/ARCHITECTURE.md` | Architecture docs |

### Examples
| File | Content |
|------|---------|
| `examples/basic.html` | Basic usage example |
| `test-setup.html` | Test harness |
| `example-character.wfl.json` | Sample character data |

---

## Claude-Cowork Patterns

### 1. EventBus (IPC-like)
```javascript
import { EventBus, EventTypes, globalEventBus } from './core/event-bus.js';

// Subscribe
bus.on(EventTypes.PARAMETER_CHANGE, (e) => console.log(e));

// Emit
bus.emit({ type: EventTypes.ANIMATION_START, payload: {} });
```

### 2. Streaming State
```javascript
import { StreamingState } from './core/streaming.js';

streaming.startStream('load-anim');
streaming.pushUpdate('load-anim', { progress: 0.5 });
streaming.completeStream('load-anim');
```

### 3. Permission System
```javascript
import { PermissionManager, PermissionActions } from './core/permission.js';

const result = await permissions.requestPermission(
  PermissionActions.SESSION_DELETE,
  { sessionName: 'My Session' }
);
// Shows confirmation dialog, returns { behavior: 'allow' | 'deny' }
```

### 4. Session Store
```javascript
import { SessionStore } from './core/session-store.js';

await store.init();
const session = await store.createSession({ title: 'My Animation' });
await store.saveSnapshot(session.id, { parameters: {...} });
await store.resumeSession(session.id);
```

---

## Event Types Reference

| Category | Events |
|----------|--------|
| Animation | `animation.start`, `animation.stop`, `animation.frame`, `animation.complete` |
| Parameter | `parameter.change`, `parameter.register` |
| State | `state.change`, `state.enter`, `state.exit` |
| Session | `session.create`, `session.load`, `session.save`, `session.delete` |
| Stream | `stream.start`, `stream.update`, `stream.complete`, `stream.error` |
| Permission | `permission.request`, `permission.response` |

---

## API Quick Reference

### WFLAnimator
```javascript
const animator = new WFLAnimator();
await animator.init();

// Control
animator.setMouth(state);      // 0-6
animator.setHeadTurn(degrees); // -180 to 180
animator.setEye(state);        // 0-4
animator.setTalking(bool);

// Session
await animator.startSession('title');
await animator.saveSession();
await animator.resumeSession(id);
await animator.deleteSession(id); // Requires permission

// Protected ops
await animator.resetParameters();  // Requires permission
await animator.clearAll();         // Requires permission
```

---

## Tags
#wfl #animation #javascript #claude-cowork #eventbus #streaming #sessions
