# Setup Instructions

## Quick Start

1. **Start Local Server** (required for ES modules):
```bash
cd /home/moon_wolf/wfl-animator
python3 -m http.server 8000
```

2. **Open in Browser**:
- Test Setup: http://localhost:8000/test-setup.html
- Basic Example: http://localhost:8000/examples/basic.html

## File Structure

```
wfl-animator/
├── src/
│   ├── core/
│   │   ├── parameter.js          # Parameter system
│   │   ├── state-machine.js      # State machine
│   │   └── file-format.js        # File I/O
│   ├── rigging/
│   │   └── dragon-bones.js       # Bone rigging wrapper
│   └── animator.js                # Main animator
├── examples/
│   └── basic.html                 # Basic example
├── test-setup.html               # Test page
└── docs/
    └── ARCHITECTURE.md           # Full documentation
```

## Testing

### Test Core Systems

Open `test-setup.html` and click "Run Tests" to verify:
- ✅ Parameter System
- ✅ State Machine
- ✅ Animator initialization

### Test Controls

Use the sliders to test parameter updates:
- Mouth: 0-6 (different mouth shapes)
- Head: -45 to 45 degrees
- Eye: 0-4 (different eye states)
- Tone: 0-3 (expression intensity)
- Talking: Toggle boolean

## Next Steps

1. **Add DragonBones**: See `INTEGRATION_GUIDE.md`
2. **Load Assets**: Export from DragonBones Editor
3. **Create Characters**: Build your WFL characters
4. **Customize**: Add your specific features

## Troubleshooting

### Module Import Errors
- Make sure you're using a local server (not file://)
- Check browser console for errors

### Canvas Not Rendering
- DragonBones integration needed for actual rendering
- Canvas is initialized but needs bone data

### Parameter Not Updating
- Check browser console for errors
- Verify parameter name matches

## Development

### Adding New Parameters

```javascript
// In animator.js setupDefaultParameters()
this.parameters.register('newParam', 'number', 0);

// Add listener
this.parameters.get('newParam').onChange((name, value) => {
  // Handle change
});
```

### Adding New States

```javascript
const sm = new StateMachine('MySM');
sm.addState('idle', ['idle_anim']);
sm.addState('active', ['active_anim']);
sm.addTransition('idle', 'active', (params) => params.isActive === true);
```

