/**
 * DragonBones Integration - Wrapper for bone rigging
 * 
 * This integrates with DragonBones runtime for bone transformations.
 * You can extract the bone rigging code from DragonBones source.
 */

export class DragonBonesRigging {
  constructor() {
    this.factory = null;
    this.armature = null;
    this.armatureDisplay = null;
  }

  /**
   * Initialize DragonBones factory
   * Requires DragonBones library to be loaded
   */
  init(factory) {
    this.factory = factory;
  }

  /**
   * Load armature from data
   */
  loadArmature(skeletonData, textureAtlasData) {
    if (!this.factory) {
      throw new Error('DragonBones factory not initialized');
    }

    // Parse skeleton data
    this.factory.parseDragonBonesData(skeletonData);
    this.factory.parseTextureAtlasData(textureAtlasData);

    // Create armature
    this.armatureDisplay = this.factory.buildArmatureDisplay('armatureName');
    this.armature = this.armatureDisplay.armature;

    return this.armatureDisplay;
  }

  /**
   * Play animation
   */
  playAnimation(animationName, times = -1) {
    if (!this.armature) return;
    this.armature.animation.play(animationName, times);
  }

  /**
   * Stop animation
   */
  stopAnimation(animationName) {
    if (!this.armature) return;
    this.armature.animation.stop(animationName);
  }

  /**
   * Set bone rotation
   */
  setBoneRotation(boneName, rotation) {
    if (!this.armature) return;
    const bone = this.armature.getBone(boneName);
    if (bone) {
      bone.rotation = rotation;
    }
  }

  /**
   * Set bone position
   */
  setBonePosition(boneName, x, y) {
    if (!this.armature) return;
    const bone = this.armature.getBone(boneName);
    if (bone) {
      bone.x = x;
      bone.y = y;
    }
  }

  /**
   * Set bone scale
   */
  setBoneScale(boneName, scaleX, scaleY) {
    if (!this.armature) return;
    const bone = this.armature.getBone(boneName);
    if (bone) {
      bone.scaleX = scaleX;
      bone.scaleY = scaleY;
    }
  }

  /**
   * Get bone by name
   */
  getBone(boneName) {
    if (!this.armature) return null;
    return this.armature.getBone(boneName);
  }

  /**
   * Update (call each frame)
   */
  update(deltaTime) {
    if (!this.armature) return;
    // DragonBones handles its own update, but you can add custom logic here
    if (this.armatureDisplay && this.armatureDisplay.armature) {
      this.armatureDisplay.armature.advanceTime(deltaTime);
    }
  }

  /**
   * Get display object for rendering
   */
  getDisplay() {
    return this.armatureDisplay;
  }

  /**
   * Set position
   */
  setPosition(x, y) {
    if (this.armatureDisplay) {
      this.armatureDisplay.x = x;
      this.armatureDisplay.y = y;
    }
  }

  /**
   * Set scale
   */
  setScale(scaleX, scaleY) {
    if (this.armatureDisplay) {
      this.armatureDisplay.scaleX = scaleX;
      this.armatureDisplay.scaleY = scaleY;
    }
  }
}

