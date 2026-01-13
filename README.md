# WFL Custom Animation System

A custom animation system tailored for WFL, combining:
- **DragonBones bone rigging** (extracted from open source)
- **Parameter system** (inspired by Rive's state machine inputs)
- **State machine** for animation logic
- **HTML/JS** for web-first deployment

## 🚀 Quick Start

```bash
# Start local server
python3 -m http.server 8000

# Open in browser
# Test: http://localhost:8000/test-setup.html
# Example: http://localhost:8000/examples/basic.html
```

## 📁 Project Structure

```
wfl-animator/
├── src/
│   ├── core/
│   │   ├── parameter.js          # Parameter system
│   │   ├── state-machine.js      # State machine logic
│   │   └── file-format.js        # File I/O
│   ├── rigging/
│   │   └── dragon-bones.js       # Bone rigging integration
│   └── animator.js                # Main animator class
├── examples/
│   └── basic.html                 # Example usage
├── test-setup.html               # Test page with controls
├── example-character.wfl.json     # Example file format
└── docs/
    ├── ARCHITECTURE.md           # Detailed architecture
    ├── INTEGRATION_GUIDE.md      # DragonBones integration
    └── SETUP.md                  # Setup instructions
```

## ✨ Features

- ✅ Parameter-based animation control
- ✅ State machine for complex logic
- ✅ Bone rigging via DragonBones
- ✅ JSON file format (human-readable)
- ✅ Binary format option (compact, future)
- ✅ Web-first, works everywhere

## 🎮 Usage

```javascript
import { WFLAnimator } from './src/animator.js';

const animator = new WFLAnimator();
const canvas = document.getElementById('canvas');

// Initialize
animator.initCanvas(canvas);

// Load animation file
await animator.load('assets/character.wfl');

// Control animations via parameters
animator.setMouth(3);        // Mouth shape 0-6
animator.setHeadTurn(15);    // Head rotation -45 to 45
animator.setEye(2);          // Eye state 0-4
animator.setTone(1);         // Roast tone 0-3
animator.setTalking(true);   // Start talking animation
```

## 📚 Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture
- **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** - DragonBones integration
- **[SETUP.md](SETUP.md)** - Setup and testing

## 🔧 Parameters

Default WFL parameters:
- `mouthState` (number): 0-6 for different mouth shapes
- `headTurn` (number): -45 to 45 degrees
- `eyeState` (number): 0-4 for different eye states
- `roastTone` (number): 0-3 for expression intensity
- `isTalking` (boolean): Triggers talking animation loop

## 🎯 Next Steps

1. **Test**: Open `test-setup.html` to verify core systems
2. **Integrate DragonBones**: See `INTEGRATION_GUIDE.md`
3. **Create Assets**: Export characters from DragonBones Editor
4. **Customize**: Add your specific features

## 🆚 Comparison to Rive

| Feature | Rive | WFL Animator |
|---------|------|--------------|
| Bone Rigging | Built-in | DragonBones |
| Parameters | ✅ | ✅ |
| State Machine | ✅ | ✅ |
| File Format | Binary | JSON (binary option) |
| Editor | Rive Editor | Custom (to build) |
| Control | Limited | Full |

## 📝 License

MIT - Use freely for your WFL project

## 🙏 Credits

- Inspired by Rive's parameter system
- Uses DragonBones for bone rigging
- Built specifically for WFL needs
