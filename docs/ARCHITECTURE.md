# WFL Animator Architecture

## Overview

A custom animation system designed specifically for WFL, combining the best parts of Rive's parameter system with DragonBones' bone rigging.

## Core Components

### 1. Parameter System (`src/core/parameter.js`)

Controls animations via named parameters:
- `mouthState` (number): 0-6 for different mouth shapes
- `headTurn` (number): -45 to 45 degrees
- `eyeState` (number): 0-4 for different eye states
- `roastTone` (number): 0-3 for expression intensity
- `isTalking` (boolean): Triggers talking animation loop

**Key Features:**
- Type-safe parameters (number, boolean, trigger)
- Change listeners for reactive updates
- JSON serialization

### 2. State Machine (`src/core/state-machine.js`)

Handles complex animation logic:
- States represent animation sets
- Transitions between states based on conditions
- Entry state for initialization

**Example:**
```javascript
const sm = new StateMachine('CockpitSM');
sm.addState('idle', ['idle_animation']);
sm.addState('talking', ['talk_loop']);
sm.addTransition('idle', 'talking', (params) => params.isTalking === true);
```

### 3. File Format (`src/core/file-format.js`)

JSON-based format (human-readable, debuggable):

```json
{
  "version": 1,
  "metadata": {
    "name": "Cockpit Character",
    "author": "WFL"
  },
  "parameters": {
    "mouthState": { "type": "number", "value": 0 },
    "headTurn": { "type": "number", "value": 0 },
    "isTalking": { "type": "boolean", "value": false }
  },
  "stateMachine": {
    "name": "CockpitSM",
    "states": { ... },
    "entryState": "idle"
  },
  "animations": {
    "mouth_closed": { ... },
    "mouth_a": { ... }
  },
  "bones": {
    "skeleton": { ... },
    "textures": { ... }
  }
}
```

### 4. DragonBones Integration (`src/rigging/dragon-bones.js`)

Wrapper around DragonBones runtime:
- Bone transformations
- Animation playback
- Mesh deformation

**Usage:**
```javascript
const rigging = new DragonBonesRigging();
rigging.init(dragonBonesFactory);
rigging.loadArmature(skeletonData, textureData);
rigging.playAnimation('mouth_a');
rigging.setBoneRotation('head', 15);
```

### 5. Main Animator (`src/animator.js`)

Orchestrates everything:
- Manages parameters
- Updates state machine
- Controls bone rigging
- Renders to canvas

## Data Flow

```
User Input
    ↓
Parameter.set(value)
    ↓
Parameter listeners fire
    ↓
State Machine evaluates transitions
    ↓
DragonBones plays animations / transforms bones
    ↓
Renderer draws frame
```

## Integration with DragonBones

### Option 1: Use DragonBones Runtime
```html
<script src="dragonBones.js"></script>
<script type="module">
  import { WFLAnimator } from './src/animator.js';
  const animator = new WFLAnimator();
  animator.rigging.init(dragonBones.Factory);
</script>
```

### Option 2: Extract Bone Rigging Code
Extract these from DragonBones source:
- Bone hierarchy management
- Transformation calculations
- Skinning algorithms
- Animation blending

## File Format Details

### JSON Format (Primary)
- Human-readable
- Easy to debug
- Can be edited manually
- Larger file size

### Binary Format (Future)
- Compact
- Fast loading
- Use LEB128 encoding (learned from Rive)
- Property keys for efficient parsing

## Next Steps

1. **Integrate DragonBones**: Add actual DragonBones runtime or extract bone code
2. **Create Editor**: Build a visual editor for creating WFL files
3. **Add More Features**: 
   - IK (Inverse Kinematics)
   - Blend shapes
   - Physics simulation
4. **Optimize**: 
   - Binary format
   - Compression
   - Caching

## Comparison to Rive

| Feature | Rive | WFL Animator |
|---------|------|--------------|
| Bone Rigging | Built-in | DragonBones |
| Parameters | ✅ | ✅ |
| State Machine | ✅ | ✅ |
| File Format | Binary | JSON (binary option) |
| Editor | Rive Editor | Custom (to build) |
| Control | Limited | Full |

## Advantages

1. **Full Control**: Your format, your features
2. **Web-First**: HTML/JS, works everywhere
3. **Open Source**: Can extract from DragonBones
4. **Tailored**: Built for your specific needs
5. **Learnable**: You understand every part

