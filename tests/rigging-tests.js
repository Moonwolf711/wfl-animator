/**
 * Tests for the bone rigging system (dragon-bones.js)
 *
 * Covers: Bone, Armature, ArmatureDisplay, DragonBonesRigging public API,
 * world-transform computation, animation playback, keyframe interpolation.
 */

import { TestRunner, assert, assertEqual } from './test-helpers.js';
import {
  Bone,
  Armature,
  ArmatureDisplay,
  DragonBonesRigging
} from '../src/rigging/dragon-bones.js';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

function assertApprox(actual, expected, message, eps = 1e-6) {
  if (!approx(actual, expected, eps)) {
    throw new Error(message || `Expected ~${expected}, got ${actual}`);
  }
}

/** Build a simple two-bone chain for reuse in tests. */
function makeTwoBoneChain() {
  const root = new Bone('root', { x: 100, y: 200, length: 60 });
  const child = new Bone('child', { x: 60, y: 0, length: 40 });
  root.addChild(child);
  return { root, child };
}

/** Build a minimal skeleton data object for loadArmature tests. */
function makeSkeletonData() {
  return {
    name: 'testSkeleton',
    bones: [
      { name: 'root', x: 100, y: 200, rotation: 0, length: 60 },
      { name: 'spine', parent: 'root', x: 0, y: -50, rotation: 0, length: 50 },
      { name: 'head', parent: 'spine', x: 0, y: -50, rotation: 0, length: 30 }
    ],
    animations: {
      idle: {
        duration: 1.0,
        tracks: [
          {
            boneName: 'spine',
            keyframes: [
              { time: 0, rotation: 0 },
              { time: 0.5, rotation: 0.1 },
              { time: 1.0, rotation: 0 }
            ]
          }
        ]
      },
      wave: {
        duration: 2.0,
        tracks: [
          {
            boneName: 'head',
            keyframes: [
              { time: 0, rotation: 0, position: { x: 0, y: -50 } },
              { time: 1.0, rotation: 0.3, position: { x: 5, y: -50 } },
              { time: 2.0, rotation: 0, position: { x: 0, y: -50 } }
            ]
          }
        ]
      },
      scaleAnim: {
        duration: 1.0,
        tracks: [
          {
            boneName: 'spine',
            keyframes: [
              { time: 0, scale: { x: 1, y: 1 } },
              { time: 1.0, scale: { x: 2, y: 0.5 } }
            ]
          }
        ]
      }
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// Test suite
// ═══════════════════════════════════════════════════════════════════

export async function runRiggingTests() {
  console.log('Rigging Test Suite');
  console.log('===================================================\n');

  // ─────────────────────────────────────────────────────────────────
  // Bone creation & properties
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Bone - Creation');

  TestRunner.test('should create a bone with default values', () => {
    const bone = new Bone('test');
    assertEqual(bone.name, 'test', 'Name should be "test"');
    assertEqual(bone.position.x, 0, 'Default x = 0');
    assertEqual(bone.position.y, 0, 'Default y = 0');
    assertEqual(bone.rotation, 0, 'Default rotation = 0');
    assertEqual(bone.scale.x, 1, 'Default scaleX = 1');
    assertEqual(bone.scale.y, 1, 'Default scaleY = 1');
    assertEqual(bone.length, 50, 'Default length = 50');
    assertEqual(bone.parent, null, 'No parent initially');
    assertEqual(bone.children.length, 0, 'No children initially');
  });

  TestRunner.test('should create a bone with custom values', () => {
    const bone = new Bone('arm', { x: 10, y: 20, rotation: 1.5, scaleX: 2, scaleY: 0.5, length: 80 });
    assertEqual(bone.position.x, 10, 'x = 10');
    assertEqual(bone.position.y, 20, 'y = 20');
    assertEqual(bone.rotation, 1.5, 'rotation = 1.5');
    assertEqual(bone.scale.x, 2, 'scaleX = 2');
    assertEqual(bone.scale.y, 0.5, 'scaleY = 0.5');
    assertEqual(bone.length, 80, 'length = 80');
  });

  // ─────────────────────────────────────────────────────────────────
  // Bone hierarchy
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Bone - Hierarchy');

  TestRunner.test('addChild should link parent and child', () => {
    const parent = new Bone('parent');
    const child = new Bone('child');
    parent.addChild(child);

    assertEqual(child.parent, parent, 'Child parent should be set');
    assertEqual(parent.children.length, 1, 'Parent should have 1 child');
    assertEqual(parent.children[0], child, 'First child should be the added bone');
  });

  TestRunner.test('addChild should support multiple children', () => {
    const parent = new Bone('parent');
    const c1 = new Bone('c1');
    const c2 = new Bone('c2');
    const c3 = new Bone('c3');
    parent.addChild(c1);
    parent.addChild(c2);
    parent.addChild(c3);

    assertEqual(parent.children.length, 3, 'Parent should have 3 children');
    assertEqual(c1.parent, parent, 'c1 parent correct');
    assertEqual(c2.parent, parent, 'c2 parent correct');
    assertEqual(c3.parent, parent, 'c3 parent correct');
  });

  TestRunner.test('removeChild should unlink correctly', () => {
    const parent = new Bone('parent');
    const child = new Bone('child');
    parent.addChild(child);
    parent.removeChild(child);

    assertEqual(parent.children.length, 0, 'Parent should have 0 children');
    assertEqual(child.parent, null, 'Child parent should be null');
  });

  TestRunner.test('removeChild on non-existent child is a no-op', () => {
    const parent = new Bone('parent');
    const stranger = new Bone('stranger');
    parent.removeChild(stranger);
    assertEqual(parent.children.length, 0, 'Still no children');
  });

  TestRunner.test('should build a deep hierarchy', () => {
    const root = new Bone('root');
    const a = new Bone('a');
    const b = new Bone('b');
    const c = new Bone('c');
    root.addChild(a);
    a.addChild(b);
    b.addChild(c);

    assertEqual(c.parent.parent.parent, root, 'Great-grandchild traces back to root');
  });

  // ─────────────────────────────────────────────────────────────────
  // World transform computation
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Bone - World Transform');

  TestRunner.test('root bone world transform matches local transform', () => {
    const bone = new Bone('root', { x: 100, y: 200, length: 60 });
    bone.computeWorldTransform();

    assertApprox(bone.worldTransform.tx, 100, 'World tx = 100');
    assertApprox(bone.worldTransform.ty, 200, 'World ty = 200');
    assertApprox(bone.worldTransform.a, 1, 'a = 1 (no rotation, no scale)');
    assertApprox(bone.worldTransform.d, 1, 'd = 1');
  });

  TestRunner.test('child inherits parent translation', () => {
    const { root, child } = makeTwoBoneChain();
    root.computeWorldTransform();

    // child local x=60, parent world tx=100 => child world tx = 160
    assertApprox(child.worldTransform.tx, 160, 'Child world tx = 100 + 60 = 160');
    assertApprox(child.worldTransform.ty, 200, 'Child world ty = 200 + 0 = 200');
  });

  TestRunner.test('parent rotation affects child position', () => {
    const root = new Bone('root', { x: 0, y: 0, length: 50 });
    const child = new Bone('child', { x: 50, y: 0, length: 30 });
    root.addChild(child);

    // Rotate root by 90 degrees (pi/2)
    root.rotation = Math.PI / 2;
    root.computeWorldTransform();

    // Child at local (50, 0) should be rotated to world (0, 50) (approximately)
    assertApprox(child.worldTransform.tx, 0, 'Rotated child tx ~ 0', 1e-5);
    assertApprox(child.worldTransform.ty, 50, 'Rotated child ty ~ 50', 1e-5);
  });

  TestRunner.test('parent scale affects child position', () => {
    const root = new Bone('root', { x: 0, y: 0, scaleX: 2, scaleY: 2, length: 50 });
    const child = new Bone('child', { x: 30, y: 0, length: 20 });
    root.addChild(child);
    root.computeWorldTransform();

    // Child local x=30 scaled by 2 => world tx = 60
    assertApprox(child.worldTransform.tx, 60, 'Scaled child tx = 30*2 = 60');
  });

  TestRunner.test('getWorldPosition returns correct values', () => {
    const { root, child } = makeTwoBoneChain();
    root.computeWorldTransform();

    const pos = child.getWorldPosition();
    assertApprox(pos.x, 160, 'getWorldPosition x = 160');
    assertApprox(pos.y, 200, 'getWorldPosition y = 200');
  });

  TestRunner.test('getWorldTip returns bone end point', () => {
    const bone = new Bone('root', { x: 0, y: 0, length: 100 });
    bone.computeWorldTransform();

    const tip = bone.getWorldTip();
    assertApprox(tip.x, 100, 'Tip x = length along local X');
    assertApprox(tip.y, 0, 'Tip y = 0 (no rotation)');
  });

  TestRunner.test('getWorldTip respects rotation', () => {
    const bone = new Bone('root', { x: 0, y: 0, length: 100 });
    bone.rotation = Math.PI / 2;
    bone.computeWorldTransform();

    const tip = bone.getWorldTip();
    assertApprox(tip.x, 0, 'Rotated tip x ~ 0', 1e-5);
    assertApprox(tip.y, 100, 'Rotated tip y ~ 100', 1e-5);
  });

  // ─────────────────────────────────────────────────────────────────
  // Armature
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Armature - Bone Management');

  TestRunner.test('should add and retrieve bones', () => {
    const armature = new Armature();
    const b1 = new Bone('b1');
    const b2 = new Bone('b2');
    armature.addBone(b1);
    armature.addBone(b2);

    assertEqual(armature.getBone('b1'), b1, 'Should retrieve b1');
    assertEqual(armature.getBone('b2'), b2, 'Should retrieve b2');
    assertEqual(armature.getBone('missing'), null, 'Missing bone returns null');
  });

  TestRunner.test('getAllBones returns all registered bones', () => {
    const armature = new Armature();
    armature.addBone(new Bone('a'));
    armature.addBone(new Bone('b'));
    armature.addBone(new Bone('c'));

    assertEqual(armature.getAllBones().length, 3, 'Should have 3 bones');
  });

  // ─────────────────────────────────────────────────────────────────
  // Animation playback
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Armature - Animation Playback');

  TestRunner.test('play should start animation', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('idle', {
      duration: 1.0,
      tracks: [{ boneName: 'spine', keyframes: [{ time: 0, rotation: 0 }, { time: 1, rotation: 1 }] }]
    });

    armature.play('idle');
    assertEqual(armature.isPlaying, true, 'Should be playing');
    assertEqual(armature.currentAnimationName, 'idle', 'Current animation name is idle');
  });

  TestRunner.test('play with unknown animation name is a no-op', () => {
    const armature = new Armature();
    armature.play('nonexistent');
    assertEqual(armature.isPlaying, false, 'Should not be playing');
  });

  TestRunner.test('stop should halt playback', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('idle', {
      duration: 1.0,
      tracks: [{ boneName: 'spine', keyframes: [{ time: 0, rotation: 0 }, { time: 1, rotation: 1 }] }]
    });

    armature.play('idle');
    armature.stop('idle');
    assertEqual(armature.isPlaying, false, 'Should not be playing after stop');
    assertEqual(armature.currentAnimationName, null, 'No current animation');
  });

  TestRunner.test('stop with wrong name should not stop current animation', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('idle', {
      duration: 1.0,
      tracks: [{ boneName: 'spine', keyframes: [{ time: 0, rotation: 0 }, { time: 1, rotation: 1 }] }]
    });

    armature.play('idle');
    armature.stop('walk'); // different name
    assertEqual(armature.isPlaying, true, 'Should still be playing');
  });

  // ─────────────────────────────────────────────────────────────────
  // Keyframe interpolation
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Armature - Keyframe Interpolation');

  TestRunner.test('should interpolate rotation at midpoint', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('test', {
      duration: 1.0,
      tracks: [{
        boneName: 'spine',
        keyframes: [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: 1.0 }
        ]
      }]
    });

    armature.play('test');
    armature.advanceTime(0.5); // halfway

    assertApprox(bone.rotation, 0.5, 'Rotation at t=0.5 should be ~0.5');
  });

  TestRunner.test('should interpolate rotation at 25%', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('test', {
      duration: 1.0,
      tracks: [{
        boneName: 'spine',
        keyframes: [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: 2.0 }
        ]
      }]
    });

    armature.play('test');
    armature.advanceTime(0.25);

    assertApprox(bone.rotation, 0.5, 'Rotation at t=0.25 should be ~0.5');
  });

  TestRunner.test('should interpolate position', () => {
    const armature = new Armature();
    const bone = new Bone('head');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('test', {
      duration: 1.0,
      tracks: [{
        boneName: 'head',
        keyframes: [
          { time: 0, position: { x: 0, y: 0 } },
          { time: 1.0, position: { x: 100, y: 50 } }
        ]
      }]
    });

    armature.play('test');
    armature.advanceTime(0.5);

    assertApprox(bone.position.x, 50, 'Position x at t=0.5 should be ~50');
    assertApprox(bone.position.y, 25, 'Position y at t=0.5 should be ~25');
  });

  TestRunner.test('should interpolate scale', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('test', {
      duration: 1.0,
      tracks: [{
        boneName: 'spine',
        keyframes: [
          { time: 0, scale: { x: 1, y: 1 } },
          { time: 1.0, scale: { x: 3, y: 0.5 } }
        ]
      }]
    });

    armature.play('test');
    armature.advanceTime(0.5);

    assertApprox(bone.scale.x, 2, 'Scale x at t=0.5 should be ~2');
    assertApprox(bone.scale.y, 0.75, 'Scale y at t=0.5 should be ~0.75');
  });

  TestRunner.test('should interpolate between multiple keyframes', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('test', {
      duration: 2.0,
      tracks: [{
        boneName: 'spine',
        keyframes: [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: 1.0 },
          { time: 2.0, rotation: 0 }
        ]
      }]
    });

    armature.play('test');

    // At t=0.5, should be between kf0 and kf1
    armature.advanceTime(0.5);
    assertApprox(bone.rotation, 0.5, 'At t=0.5, rotation ~ 0.5');

    // At t=1.5 (advance 1.0 more), between kf1 and kf2
    armature.advanceTime(1.0);
    assertApprox(bone.rotation, 0.5, 'At t=1.5, rotation ~ 0.5 (going back down)');
  });

  TestRunner.test('looping animation wraps time correctly', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('loop', {
      duration: 1.0,
      tracks: [{
        boneName: 'spine',
        keyframes: [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: 1.0 }
        ]
      }]
    });

    armature.play('loop', -1); // infinite loop
    armature.advanceTime(1.5); // wraps to 0.5

    assertEqual(armature.isPlaying, true, 'Should still be playing');
    assertApprox(bone.rotation, 0.5, 'After wrap, rotation at t=0.5 should be ~0.5');
  });

  TestRunner.test('play-once animation stops at end', () => {
    const armature = new Armature();
    const bone = new Bone('spine');
    armature.addBone(bone);
    armature.root = bone;

    armature.addAnimation('once', {
      duration: 1.0,
      tracks: [{
        boneName: 'spine',
        keyframes: [
          { time: 0, rotation: 0 },
          { time: 1.0, rotation: 1.0 }
        ]
      }]
    });

    armature.play('once', 1); // play once
    armature.advanceTime(1.5); // past end

    assertEqual(armature.isPlaying, false, 'Should have stopped');
    assertApprox(bone.rotation, 1.0, 'Rotation clamped to end value');
  });

  // ─────────────────────────────────────────────────────────────────
  // DragonBonesRigging public API
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('DragonBonesRigging - Public API');

  TestRunner.test('constructor sets factory truthy and armature null', () => {
    const rigging = new DragonBonesRigging();
    assert(rigging.factory, 'factory should be truthy');
    assertEqual(rigging.armature, null, 'armature should be null');
    assertEqual(rigging.armatureDisplay, null, 'armatureDisplay should be null');
  });

  TestRunner.test('loadArmature builds armature from skeleton data', () => {
    const rigging = new DragonBonesRigging();
    const data = makeSkeletonData();

    const display = rigging.loadArmature(data);

    assert(rigging.armature !== null, 'armature should be set');
    assert(rigging.armatureDisplay !== null, 'armatureDisplay should be set');
    assert(display === rigging.armatureDisplay, 'Should return display');

    // Check bones were created
    assert(rigging.getBone('root') !== null, 'root bone exists');
    assert(rigging.getBone('spine') !== null, 'spine bone exists');
    assert(rigging.getBone('head') !== null, 'head bone exists');
  });

  TestRunner.test('loadArmature builds correct parent-child hierarchy', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    const root = rigging.getBone('root');
    const spine = rigging.getBone('spine');
    const head = rigging.getBone('head');

    assertEqual(spine.parent, root, 'spine parent is root');
    assertEqual(head.parent, spine, 'head parent is spine');
    assert(root.children.includes(spine), 'root has spine as child');
    assert(spine.children.includes(head), 'spine has head as child');
  });

  TestRunner.test('loadArmature registers animations', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    assert(rigging.armature.animations.has('idle'), 'idle animation registered');
    assert(rigging.armature.animations.has('wave'), 'wave animation registered');
    assert(rigging.armature.animations.has('scaleAnim'), 'scaleAnim animation registered');
  });

  TestRunner.test('playAnimation starts animation playback', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.playAnimation('idle');
    assertEqual(rigging.armature.isPlaying, true, 'Should be playing');
    assertEqual(rigging.armature.currentAnimationName, 'idle', 'Current anim is idle');
  });

  TestRunner.test('playAnimation with unknown name is safe', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.playAnimation('nonexistent');
    assertEqual(rigging.armature.isPlaying, false, 'Should not be playing');
  });

  TestRunner.test('stopAnimation stops named animation', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.playAnimation('idle');
    rigging.stopAnimation('idle');
    assertEqual(rigging.armature.isPlaying, false, 'Should be stopped');
  });

  TestRunner.test('update advances animation and computes transforms', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.playAnimation('idle');
    rigging.update(0.5); // 0.5 seconds into idle animation

    const spine = rigging.getBone('spine');
    // idle animation: rotation goes from 0 at t=0 to 0.1 at t=0.5
    assertApprox(spine.rotation, 0.1, 'Spine rotation should be ~0.1 at t=0.5');
  });

  TestRunner.test('update with no armature is safe', () => {
    const rigging = new DragonBonesRigging();
    rigging.update(0.5); // should not throw
    assert(true, 'update without armature did not throw');
  });

  TestRunner.test('setBoneRotation converts degrees to radians', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.setBoneRotation('spine', 90);
    const spine = rigging.getBone('spine');
    assertApprox(spine.rotation, Math.PI / 2, 'Rotation should be pi/2 radians');
  });

  TestRunner.test('setBoneRotation on missing bone is safe', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());
    rigging.setBoneRotation('nonexistent', 45); // should not throw
    assert(true, 'setBoneRotation on missing bone did not throw');
  });

  TestRunner.test('setBoneRotation without armature is safe', () => {
    const rigging = new DragonBonesRigging();
    rigging.setBoneRotation('spine', 45); // should not throw
    assert(true, 'setBoneRotation without armature did not throw');
  });

  TestRunner.test('setBonePosition sets bone local position', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.setBonePosition('spine', 10, 20);
    const spine = rigging.getBone('spine');
    assertEqual(spine.position.x, 10, 'Position x = 10');
    assertEqual(spine.position.y, 20, 'Position y = 20');
  });

  TestRunner.test('setBoneScale sets bone local scale', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.setBoneScale('spine', 2, 0.5);
    const spine = rigging.getBone('spine');
    assertEqual(spine.scale.x, 2, 'Scale x = 2');
    assertEqual(spine.scale.y, 0.5, 'Scale y = 0.5');
  });

  TestRunner.test('getDisplay returns armatureDisplay', () => {
    const rigging = new DragonBonesRigging();
    assertEqual(rigging.getDisplay(), null, 'Null before loading');

    rigging.loadArmature(makeSkeletonData());
    assert(rigging.getDisplay() !== null, 'Non-null after loading');
    assertEqual(rigging.getDisplay(), rigging.armatureDisplay, 'Returns armatureDisplay');
  });

  TestRunner.test('setPosition updates display position', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.setPosition(50, 75);
    assertEqual(rigging.armatureDisplay.x, 50, 'Display x = 50');
    assertEqual(rigging.armatureDisplay.y, 75, 'Display y = 75');
  });

  TestRunner.test('setScale updates display scale', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.setScale(2, 3);
    assertEqual(rigging.armatureDisplay.scaleX, 2, 'Display scaleX = 2');
    assertEqual(rigging.armatureDisplay.scaleY, 3, 'Display scaleY = 3');
  });

  // ─────────────────────────────────────────────────────────────────
  // ArmatureDisplay
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('ArmatureDisplay');

  TestRunner.test('should have a draw method', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());
    const display = rigging.getDisplay();

    assert(typeof display.draw === 'function', 'display.draw should be a function');
  });

  TestRunner.test('draw method accepts a mock canvas context without errors', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());
    const display = rigging.getDisplay();

    // Minimal canvas context mock
    const mockCtx = {
      save() {},
      restore() {},
      translate() {},
      scale() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      stroke() {},
      fill() {},
      fillText() {},
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      font: ''
    };

    display.draw(mockCtx);
    assert(true, 'draw() completed without errors');
  });

  // ─────────────────────────────────────────────────────────────────
  // Integration: full animation cycle
  // ─────────────────────────────────────────────────────────────────
  TestRunner.category('Integration - Full Animation Cycle');

  TestRunner.test('load, play, advance, read world transform', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    // Play idle (spine oscillates rotation 0 -> 0.1 -> 0)
    rigging.playAnimation('idle');

    // Advance to t=0.5 (peak rotation)
    rigging.update(0.5);

    const spine = rigging.getBone('spine');
    assertApprox(spine.rotation, 0.1, 'Spine rotation at peak');

    // World transform should reflect the rotation
    const worldPos = spine.getWorldPosition();
    assert(typeof worldPos.x === 'number', 'World position x is a number');
    assert(typeof worldPos.y === 'number', 'World position y is a number');
  });

  TestRunner.test('multiple update calls accumulate time', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.playAnimation('idle');

    // Advance in small increments: 0.25 + 0.25 = 0.5
    rigging.update(0.25);
    rigging.update(0.25);

    const spine = rigging.getBone('spine');
    assertApprox(spine.rotation, 0.1, 'Accumulated time 0.5 gives peak rotation', 1e-5);
  });

  TestRunner.test('switching animations resets time', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    rigging.playAnimation('idle');
    rigging.update(0.5); // advance idle

    rigging.playAnimation('wave'); // switch
    assertEqual(rigging.armature.animationTime, 0, 'Time resets on new play');
    assertEqual(rigging.armature.currentAnimationName, 'wave', 'Now playing wave');
  });

  TestRunner.test('init method sets factory', () => {
    const rigging = new DragonBonesRigging();
    const customFactory = { custom: true };
    rigging.init(customFactory);
    assertEqual(rigging.factory, customFactory, 'Factory should be set to custom object');
  });

  TestRunner.test('armatureDisplay is truthy after loadArmature (render path check)', () => {
    const rigging = new DragonBonesRigging();
    rigging.loadArmature(makeSkeletonData());

    // This is the key check from animator.js render():
    // if (this.rigging.armatureDisplay) { ... }
    assert(!!rigging.armatureDisplay, 'armatureDisplay should be truthy');
  });

  return TestRunner.summary();
}
