# DragonBones Integration Guide

## Option 1: Use DragonBones Runtime (Easiest)

### Step 1: Download DragonBones

Download from: https://github.com/DragonBones/DragonBonesJS

Or use CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/dragonbones.js@5.7.0/dist/dragonBones.js"></script>
```

### Step 2: Update basic.html

Add DragonBones script before your module:

```html
<script src="https://cdn.jsdelivr.net/npm/dragonbones.js@5.7.0/dist/dragonBones.js"></script>
<script type="module">
  import { WFLAnimator } from '../src/animator.js';
  
  const animator = new WFLAnimator();
  
  // Initialize DragonBones
  animator.rigging.init(dragonBones.Factory);
  
  // Load your character data
  // animator.rigging.loadArmature(skeletonData, textureData);
</script>
```

### Step 3: Load Character Data

```javascript
// Load skeleton JSON
const skeletonResponse = await fetch('assets/character_ske.json');
const skeletonData = await skeletonResponse.json();

// Load texture atlas
const textureResponse = await fetch('assets/character_tex.json');
const textureData = await textureResponse.json();

// Load texture image
const textureImage = new Image();
textureImage.src = 'assets/character_tex.png';

// Create texture atlas
const textureAtlas = new dragonBones.TextureAtlas(textureData, textureImage);

// Load armature
animator.rigging.loadArmature(skeletonData, textureAtlas);
```

## Option 2: Extract Bone Rigging Code (Advanced)

### Step 1: Clone DragonBones Source

```bash
git clone https://github.com/DragonBones/DragonBonesJS.git
cd DragonBonesJS
```

### Step 2: Extract Core Files

You need these files:
- `core/Bone.ts` - Bone transformations
- `core/Armature.ts` - Armature management
- `core/Animation.ts` - Animation playback
- `core/Slot.ts` - Rendering slots
- `factories/BaseFactory.ts` - Factory pattern

### Step 3: Adapt to Your System

Modify the extracted code to work with your parameter system:

```javascript
// In dragon-bones.js
import { Bone } from './extracted/Bone.js';
import { Armature } from './extracted/Armature.js';

export class DragonBonesRigging {
  // Use extracted classes
  constructor() {
    this.boneSystem = new Bone();
    this.armature = new Armature();
  }
}
```

## Option 3: Use DragonBones Editor Export

### Step 1: Export from DragonBones Editor

1. Open DragonBones Editor
2. Create/import your character
3. Export as JSON format
4. You'll get:
   - `character_ske.json` (skeleton)
   - `character_tex.json` (texture atlas)
   - `character_tex.png` (texture image)

### Step 2: Load in WFL Animator

```javascript
async function loadCharacter(animator) {
  // Load skeleton
  const skeData = await (await fetch('assets/character_ske.json')).json();
  
  // Load texture atlas
  const texData = await (await fetch('assets/character_tex.json')).json();
  const texImage = new Image();
  texImage.src = 'assets/character_tex.png';
  
  // Wait for image to load
  await new Promise(resolve => {
    texImage.onload = resolve;
  });
  
  // Create texture atlas
  const textureAtlas = new dragonBones.TextureAtlas(texData, texImage);
  
  // Load armature
  animator.rigging.loadArmature(skeData, textureAtlas);
  
  // Add to canvas
  const display = animator.rigging.armatureDisplay;
  // You'll need to integrate with your renderer
}
```

## Quick Integration Example

Create `examples/dragonbones-integration.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/dragonbones.js@5.7.0/dist/dragonBones.js"></script>
</head>
<body>
    <canvas id="canvas" width="800" height="600"></canvas>
    <script type="module">
        import { WFLAnimator } from '../src/animator.js';
        
        const canvas = document.getElementById('canvas');
        const animator = new WFLAnimator();
        
        // Initialize
        animator.initCanvas(canvas);
        animator.rigging.init(dragonBones.Factory);
        
        // Load character (when you have assets)
        // await loadCharacter(animator);
        
        // Control via parameters
        animator.setMouth(3);
        animator.setHeadTurn(15);
    </script>
</body>
</html>
```

## Next Steps

1. **Get DragonBones Assets**: Export from DragonBones Editor or use existing assets
2. **Test Integration**: Load a simple character and verify bone rigging works
3. **Map Parameters**: Connect your parameters to bone animations
4. **Optimize**: Add caching, compression, etc.

