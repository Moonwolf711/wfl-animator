# Quick Start Guide

## Setup

1. **Clone/Download** this repository

2. **Start a local server** (required for ES modules):
```bash
python3 -m http.server 8000
# or
npx serve
```

3. **Open** `http://localhost:8000/examples/basic.html`

## Basic Usage

```javascript
import { WFLAnimator } from './src/animator.js';

// Create animator
const animator = new WFLAnimator();

// Initialize canvas
const canvas = document.getElementById('canvas');
animator.initCanvas(canvas);

// Load animation file
await animator.load('assets/character.wfl');

// Control animations
animator.setMouth(3);        // Mouth shape 0-6
animator.setHeadTurn(15);    // Head rotation -45 to 45
animator.setEye(2);          // Eye state 0-4
animator.setTone(1);         // Roast tone 0-3
animator.setTalking(true);   // Start talking animation
```

## Creating a WFL File

```javascript
import { WFLFile } from './src/core/file-format.js';

const file = new WFLFile();
file.metadata = {
  name: "My Character",
  author: "You"
};

file.parameters = {
  mouthState: { type: "number", value: 0 },
  headTurn: { type: "number", value: 0 },
  isTalking: { type: "boolean", value: false }
};

// Save
file.download('my-character.wfl');
```

## Next Steps

1. **Integrate DragonBones**: Add the DragonBones runtime
2. **Create Assets**: Export characters from DragonBones
3. **Build Editor**: Create a visual editor for WFL files
4. **Add Features**: Extend with your specific needs

See `docs/ARCHITECTURE.md` for detailed information.

