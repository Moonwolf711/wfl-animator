/**
 * Bone Rigging System - Real 2D bone implementation
 *
 * Replaces the external DragonBones dependency with a self-contained
 * bone hierarchy, world-transform computation, keyframe animation,
 * and canvas debug rendering.
 *
 * Public API is kept identical to the original DragonBones wrapper
 * so that animator.js requires no changes.
 */

// ─────────────────────────────────────────────────────────────────
// Bone
// ─────────────────────────────────────────────────────────────────

export class Bone {
  /**
   * @param {string} name   - Unique bone identifier
   * @param {object} opts   - Optional overrides
   *   position {x,y}, rotation (radians), scale {x,y}, length (px)
   */
  constructor(name, opts = {}) {
    this.name = name;
    this.parent = null;
    this.children = [];

    // Local transform (relative to parent)
    this.position = { x: opts.x ?? 0, y: opts.y ?? 0 };
    this.rotation = opts.rotation ?? 0;       // radians
    this.scale    = { x: opts.scaleX ?? 1, y: opts.scaleY ?? 1 };
    this.length   = opts.length ?? 50;

    // Cached world transform (recomputed each frame)
    this.worldTransform = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  }

  /** Add a child bone and set its parent reference. */
  addChild(bone) {
    bone.parent = this;
    this.children.push(bone);
    return this;
  }

  /** Remove a child bone by reference. */
  removeChild(bone) {
    const idx = this.children.indexOf(bone);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      bone.parent = null;
    }
    return this;
  }

  // ── World transform ────────────────────────────────────────────

  /**
   * Compute this bone's 2x3 world matrix by composing its local
   * transform onto the parent's world matrix.
   *
   * Matrix layout (column-major 2x3):
   *   | a  c  tx |
   *   | b  d  ty |
   */
  computeWorldTransform() {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    // Local 2x3 matrix = T * R * S
    const la = cos * this.scale.x;
    const lb = sin * this.scale.x;
    const lc = -sin * this.scale.y;
    const ld = cos * this.scale.y;
    const ltx = this.position.x;
    const lty = this.position.y;

    if (this.parent) {
      const p = this.parent.worldTransform;
      // Multiply parent * local
      this.worldTransform.a  = p.a * la + p.c * lb;
      this.worldTransform.b  = p.b * la + p.d * lb;
      this.worldTransform.c  = p.a * lc + p.c * ld;
      this.worldTransform.d  = p.b * lc + p.d * ld;
      this.worldTransform.tx = p.a * ltx + p.c * lty + p.tx;
      this.worldTransform.ty = p.b * ltx + p.d * lty + p.ty;
    } else {
      this.worldTransform.a  = la;
      this.worldTransform.b  = lb;
      this.worldTransform.c  = lc;
      this.worldTransform.d  = ld;
      this.worldTransform.tx = ltx;
      this.worldTransform.ty = lty;
    }

    // Recurse into children
    for (const child of this.children) {
      child.computeWorldTransform();
    }
  }

  /** World-space origin of this bone. */
  getWorldPosition() {
    return { x: this.worldTransform.tx, y: this.worldTransform.ty };
  }

  /**
   * World-space tip of this bone (origin + length along local X-axis).
   */
  getWorldTip() {
    const wt = this.worldTransform;
    return {
      x: wt.tx + wt.a * this.length,
      y: wt.ty + wt.b * this.length
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Armature  (bone tree + animation state)
// ─────────────────────────────────────────────────────────────────

export class Armature {
  constructor() {
    /** @type {Bone|null} */
    this.root = null;

    /** Map of bone name -> Bone for O(1) lookup */
    this.boneMap = new Map();

    /** Registered animations: name -> AnimationData */
    this.animations = new Map();

    /** Current playback state */
    this.currentAnimation = null;   // animation data object
    this.currentAnimationName = null;
    this.animationTime = 0;
    this.animationPlayTimes = -1;   // -1 = infinite loop, 0 = once, N = N times
    this.animationLoopCount = 0;
    this.isPlaying = false;
  }

  // ── Bone management ────────────────────────────────────────────

  /** Register a bone in the lookup map. */
  addBone(bone) {
    this.boneMap.set(bone.name, bone);
  }

  /** Retrieve a bone by name. */
  getBone(name) {
    return this.boneMap.get(name) || null;
  }

  /** Iterate all bones in the map. */
  getAllBones() {
    return Array.from(this.boneMap.values());
  }

  // ── Animation registration ─────────────────────────────────────

  /**
   * Register an animation clip.
   *
   * @param {string} name
   * @param {object} data - { duration, tracks: [{ boneName, keyframes: [{time, rotation?, position?, scale?}] }] }
   */
  addAnimation(name, data) {
    this.animations.set(name, data);
  }

  // ── Playback control ───────────────────────────────────────────

  /**
   * Start playing an animation by name.
   * @param {string} name
   * @param {number} playTimes  -1 = loop forever, 0/1 = play once, N = play N times
   */
  play(name, playTimes = -1) {
    const anim = this.animations.get(name);
    if (!anim) return;

    this.currentAnimation = anim;
    this.currentAnimationName = name;
    this.animationTime = 0;
    this.animationPlayTimes = playTimes;
    this.animationLoopCount = 0;
    this.isPlaying = true;
  }

  /** Stop the named animation (or any if name matches / is omitted). */
  stop(name) {
    if (!name || this.currentAnimationName === name) {
      this.isPlaying = false;
      this.currentAnimation = null;
      this.currentAnimationName = null;
      this.animationTime = 0;
      this.animationLoopCount = 0;
    }
  }

  // ── Per-frame advance ──────────────────────────────────────────

  /**
   * Advance animation time and apply interpolated values to bones.
   * @param {number} dt  - elapsed seconds
   */
  advanceTime(dt) {
    if (!this.isPlaying || !this.currentAnimation) return;

    const anim = this.currentAnimation;
    this.animationTime += dt;

    // Handle looping / completion
    if (anim.duration > 0 && this.animationTime >= anim.duration) {
      this.animationLoopCount++;

      const effectivePlayTimes = this.animationPlayTimes <= 0
        ? this.animationPlayTimes   // -1 = infinite
        : this.animationPlayTimes;

      if (effectivePlayTimes > 0 && this.animationLoopCount >= effectivePlayTimes) {
        // Clamp to end and stop
        this.animationTime = anim.duration;
        this.applyAnimation(anim, this.animationTime);
        this.isPlaying = false;
        return;
      }

      // Wrap time for looping
      this.animationTime = this.animationTime % anim.duration;
    }

    this.applyAnimation(anim, this.animationTime);
  }

  /**
   * Sample all tracks at a given time and apply values to bones.
   */
  applyAnimation(anim, time) {
    if (!anim.tracks) return;

    for (const track of anim.tracks) {
      const bone = this.getBone(track.boneName);
      if (!bone || !track.keyframes || track.keyframes.length === 0) continue;

      const kf = track.keyframes;

      // Find surrounding keyframes
      let prev = kf[0];
      let next = kf[kf.length - 1];

      for (let i = 0; i < kf.length - 1; i++) {
        if (time >= kf[i].time && time <= kf[i + 1].time) {
          prev = kf[i];
          next = kf[i + 1];
          break;
        }
        if (time < kf[i].time) {
          // Before the first keyframe; use first keyframe values
          prev = kf[i];
          next = kf[i];
          break;
        }
      }

      // Compute interpolation factor
      const span = next.time - prev.time;
      const t = span > 0 ? (time - prev.time) / span : 0;

      // Apply interpolated rotation (radians)
      if (prev.rotation !== undefined && next.rotation !== undefined) {
        bone.rotation = lerp(prev.rotation, next.rotation, t);
      }

      // Apply interpolated position
      if (prev.position && next.position) {
        bone.position.x = lerp(prev.position.x, next.position.x, t);
        bone.position.y = lerp(prev.position.y, next.position.y, t);
      }

      // Apply interpolated scale
      if (prev.scale && next.scale) {
        bone.scale.x = lerp(prev.scale.x, next.scale.x, t);
        bone.scale.y = lerp(prev.scale.y, next.scale.y, t);
      }
    }
  }

  /**
   * Recompute all world transforms starting from root.
   */
  updateWorldTransforms() {
    if (this.root) {
      this.root.computeWorldTransform();
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// ArmatureDisplay  (canvas debug renderer)
// ─────────────────────────────────────────────────────────────────

export class ArmatureDisplay {
  constructor(armature) {
    this.armature = armature;
    this.x = 0;
    this.y = 0;
    this.scaleX = 1;
    this.scaleY = 1;

    // Appearance
    this.boneColor = '#00ccff';
    this.jointColor = '#ff6600';
    this.jointRadius = 4;
    this.boneWidth = 2;
    this.rootColor = '#ff0000';
  }

  /**
   * Draw the full skeleton onto a Canvas 2D context.
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scaleX, this.scaleY);

    this._drawBone(ctx, this.armature.root);

    ctx.restore();
  }

  /** Recursively draw a bone and its children. */
  _drawBone(ctx, bone) {
    if (!bone) return;

    const wt = bone.worldTransform;
    const origin = { x: wt.tx, y: wt.ty };
    const tip = bone.getWorldTip();

    // Draw bone line
    ctx.strokeStyle = bone.parent ? this.boneColor : this.rootColor;
    ctx.lineWidth = this.boneWidth;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Draw joint circle at origin
    ctx.fillStyle = this.jointColor;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, this.jointRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw bone name label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.fillText(bone.name, origin.x + 6, origin.y - 6);

    // Recurse children
    for (const child of bone.children) {
      this._drawBone(ctx, child);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────

/** Linear interpolation. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Build a bone tree from skeleton JSON data.
 *
 * Expected format (matches common skeleton editors):
 * {
 *   name: "armatureName",
 *   bones: [
 *     { name: "root", x: 0, y: 0, rotation: 0, length: 50 },
 *     { name: "spine", parent: "root", x: 0, y: -50, rotation: 0, length: 60 },
 *     ...
 *   ],
 *   animations: {
 *     "idle": {
 *       duration: 1.0,
 *       tracks: [
 *         { boneName: "spine", keyframes: [{time:0, rotation:0}, {time:0.5, rotation:0.1}, {time:1.0, rotation:0}] }
 *       ]
 *     }
 *   }
 * }
 */
function buildArmatureFromData(data) {
  const armature = new Armature();
  const boneDataList = data.bones || [];

  // First pass: create all bones
  for (const bd of boneDataList) {
    const bone = new Bone(bd.name, {
      x: bd.x ?? 0,
      y: bd.y ?? 0,
      rotation: bd.rotation ?? 0,
      scaleX: bd.scaleX ?? 1,
      scaleY: bd.scaleY ?? 1,
      length: bd.length ?? 50
    });
    armature.addBone(bone);
  }

  // Second pass: link parent-child relationships
  for (const bd of boneDataList) {
    const bone = armature.getBone(bd.name);
    if (bd.parent) {
      const parent = armature.getBone(bd.parent);
      if (parent) {
        parent.addChild(bone);
      }
    }
  }

  // Determine root (bone with no parent)
  for (const bone of armature.boneMap.values()) {
    if (!bone.parent) {
      armature.root = bone;
      break;
    }
  }

  // Register animations
  if (data.animations) {
    for (const [animName, animData] of Object.entries(data.animations)) {
      armature.addAnimation(animName, {
        duration: animData.duration ?? 1,
        tracks: animData.tracks || []
      });
    }
  }

  // Compute initial world transforms
  armature.updateWorldTransforms();

  return armature;
}

// ─────────────────────────────────────────────────────────────────
// DragonBonesRigging  (public API, drop-in replacement)
// ─────────────────────────────────────────────────────────────────

export class DragonBonesRigging {
  constructor() {
    /**
     * `factory` is set to a truthy sentinel so that animator.js's guard
     * `if (this.file.bones && this.rigging.factory)` passes by default.
     * The real implementation no longer needs an external factory.
     */
    this.factory = true;

    /** @type {Armature|null} */
    this.armature = null;

    /** @type {ArmatureDisplay|null} */
    this.armatureDisplay = null;
  }

  // ── Factory-style init (kept for backward compat) ──────────────

  /**
   * Optional: override the default factory sentinel with a custom
   * object.  Not required for the built-in bone system.
   */
  init(factory) {
    this.factory = factory || true;
  }

  // ── Loading ────────────────────────────────────────────────────

  /**
   * Build an armature from skeleton JSON.
   *
   * @param {object} skeletonData      - Bone & animation definitions
   * @param {object} [textureAtlasData] - Reserved for future sprite atlas support (ignored for now)
   * @returns {ArmatureDisplay}
   */
  loadArmature(skeletonData, _textureAtlasData) {
    this.armature = buildArmatureFromData(skeletonData);
    this.armatureDisplay = new ArmatureDisplay(this.armature);
    return this.armatureDisplay;
  }

  // ── Animation ──────────────────────────────────────────────────

  /**
   * Play a named animation clip.
   * @param {string} animationName
   * @param {number} [times=-1]  -1 = loop, 1 = once, N = N times
   */
  playAnimation(animationName, times = -1) {
    if (!this.armature) return;
    this.armature.play(animationName, times);
  }

  /**
   * Stop the named animation (or current if name matches).
   */
  stopAnimation(animationName) {
    if (!this.armature) return;
    this.armature.stop(animationName);
  }

  // ── Per-frame update ───────────────────────────────────────────

  /**
   * Advance animation and recompute world transforms.
   * @param {number} deltaTime  seconds
   */
  update(deltaTime) {
    if (!this.armature) return;
    this.armature.advanceTime(deltaTime);
    this.armature.updateWorldTransforms();
  }

  // ── Bone manipulation ──────────────────────────────────────────

  /**
   * Set rotation of a named bone.
   * @param {string} boneName
   * @param {number} degrees
   */
  setBoneRotation(boneName, degrees) {
    if (!this.armature) return;
    const bone = this.armature.getBone(boneName);
    if (bone) {
      bone.rotation = (degrees * Math.PI) / 180;
    }
  }

  /**
   * Set position of a named bone.
   */
  setBonePosition(boneName, x, y) {
    if (!this.armature) return;
    const bone = this.armature.getBone(boneName);
    if (bone) {
      bone.position.x = x;
      bone.position.y = y;
    }
  }

  /**
   * Set scale of a named bone.
   */
  setBoneScale(boneName, scaleX, scaleY) {
    if (!this.armature) return;
    const bone = this.armature.getBone(boneName);
    if (bone) {
      bone.scale.x = scaleX;
      bone.scale.y = scaleY;
    }
  }

  /**
   * Retrieve a bone by name.
   */
  getBone(boneName) {
    if (!this.armature) return null;
    return this.armature.getBone(boneName);
  }

  // ── Display ────────────────────────────────────────────────────

  /**
   * Get the display object for canvas rendering.
   * @returns {ArmatureDisplay|null}
   */
  getDisplay() {
    return this.armatureDisplay;
  }

  /**
   * Set the display position.
   */
  setPosition(x, y) {
    if (this.armatureDisplay) {
      this.armatureDisplay.x = x;
      this.armatureDisplay.y = y;
    }
  }

  /**
   * Set the display scale.
   */
  setScale(scaleX, scaleY) {
    if (this.armatureDisplay) {
      this.armatureDisplay.scaleX = scaleX;
      this.armatureDisplay.scaleY = scaleY;
    }
  }
}
