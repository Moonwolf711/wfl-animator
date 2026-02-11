#!/usr/bin/env node

/**
 * WFL Animator Build Script
 *
 * Produces two output files with no external dependencies:
 *   dist/wfl-animator.mjs      - Full ESM bundle (all modules inlined)
 *   dist/wfl-animator.min.mjs  - Minified version (comments/whitespace stripped)
 *
 * Usage: node scripts/build.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src');
const DIST = resolve(ROOT, 'dist');

// Source files in dependency order (leaves first, entry last)
const SOURCE_FILES = [
  'src/core/event-bus.js',
  'src/core/parameter.js',
  'src/core/state-machine.js',
  'src/core/file-format.js',
  'src/core/streaming.js',
  'src/core/permission.js',
  'src/core/session-store.js',
  'src/rigging/dragon-bones.js',
  'src/animator.js',
];

/**
 * Strip import and export statements from source code.
 * Keeps the rest of the module body intact so all classes/functions
 * end up in the same shared scope inside the IIFE.
 */
function stripImportsExports(code) {
  const lines = code.split('\n');
  const result = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip import lines (single-line)
    if (trimmed.startsWith('import ') && (trimmed.includes(' from ') || trimmed.includes("from'"))) {
      continue;
    }

    // Convert "export class Foo" -> "class Foo"
    // Convert "export function foo" -> "function foo"
    // Convert "export const foo" -> "const foo"
    // Convert "export let foo" -> "let foo"
    if (/^export\s+(class|function|const|let|var|async\s+function)\s/.test(trimmed)) {
      result.push(line.replace(/^(\s*)export\s+/, '$1'));
      continue;
    }

    // Skip "export { ... } from '...'" re-export lines
    if (/^export\s*\{/.test(trimmed) && trimmed.includes('from')) {
      continue;
    }

    // Skip "export { ... }" (without from)
    if (/^export\s*\{/.test(trimmed) && !trimmed.includes('from')) {
      continue;
    }

    // Skip "export default ..."
    if (trimmed.startsWith('export default ')) {
      result.push(line.replace(/^(\s*)export\s+default\s+/, '$1'));
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Basic minification: remove comments, collapse whitespace, trim blank lines.
 * This is intentionally simple -- no AST parsing, no variable renaming.
 */
function minify(code) {
  let out = code;

  // Remove multi-line comments (non-greedy)
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove single-line comments (but not URLs like https://)
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');

  // Collapse multiple blank lines into one
  out = out.replace(/\n{3,}/g, '\n\n');

  // Trim trailing whitespace on each line
  out = out.replace(/[ \t]+$/gm, '');

  // Remove leading/trailing whitespace from the whole file
  out = out.trim() + '\n';

  return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Building WFL Animator...');
console.log(`  Source: ${SRC}`);
console.log(`  Output: ${DIST}`);

mkdirSync(DIST, { recursive: true });

// 1. Read and concatenate all source modules (imports/exports stripped)
const moduleBlocks = SOURCE_FILES.map((relPath) => {
  const absPath = resolve(ROOT, relPath);
  const raw = readFileSync(absPath, 'utf-8');
  const stripped = stripImportsExports(raw);
  return `// --- ${relPath} ---\n${stripped}`;
});

const banner = [
  '/**',
  ' * WFL Animator v1.0.0',
  ' * Custom animation system for WFL',
  ' * Built: ' + new Date().toISOString(),
  ' */',
].join('\n');

const iifeBody = moduleBlocks.join('\n\n');

const fullBundle = `${banner}
(function (global) {
'use strict';

${iifeBody}

// ---- Public API ----
global.WFLAnimator = WFLAnimator;
global.ParameterSystem = ParameterSystem;
global.StateMachine = StateMachine;
global.WFLFile = WFLFile;
global.DragonBonesRigging = DragonBonesRigging;
global.EventBus = EventBus;
global.EventTypes = EventTypes;
global.globalEventBus = globalEventBus;
global.StreamingState = StreamingState;
global.StreamingAnimationLoader = StreamingAnimationLoader;
global.PermissionManager = PermissionManager;
global.PermissionDialog = PermissionDialog;
global.PermissionActions = PermissionActions;
global.globalPermissionManager = globalPermissionManager;
global.SessionStore = SessionStore;
global.globalSessionStore = globalSessionStore;

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
`;

// 2. Also produce an ESM re-export wrapper (for consumers that want ESM)
const esmBundle = `${banner}
// ESM bundle -- re-exports everything from the source entry point.
// Use this when your toolchain supports ES modules.
export { WFLAnimator } from '../src/animator.js';
export { EventBus, EventTypes, globalEventBus } from '../src/core/event-bus.js';
export { StreamingState, StreamingAnimationLoader } from '../src/core/streaming.js';
export { PermissionManager, PermissionDialog, PermissionActions, globalPermissionManager } from '../src/core/permission.js';
export { SessionStore, globalSessionStore } from '../src/core/session-store.js';
export { ParameterSystem } from '../src/core/parameter.js';
export { StateMachine } from '../src/core/state-machine.js';
export { WFLFile } from '../src/core/file-format.js';
export { DragonBonesRigging } from '../src/rigging/dragon-bones.js';
`;

// Write full IIFE bundle
const iifePath = resolve(DIST, 'wfl-animator.js');
writeFileSync(iifePath, fullBundle, 'utf-8');
console.log(`  -> ${iifePath}  (${(Buffer.byteLength(fullBundle) / 1024).toFixed(1)} KB)`);

// Write ESM re-export bundle
const esmPath = resolve(DIST, 'wfl-animator.mjs');
writeFileSync(esmPath, esmBundle, 'utf-8');
console.log(`  -> ${esmPath}  (${(Buffer.byteLength(esmBundle) / 1024).toFixed(1)} KB)`);

// Write minified IIFE bundle
const minified = minify(fullBundle);
const minPath = resolve(DIST, 'wfl-animator.min.js');
writeFileSync(minPath, minified, 'utf-8');
console.log(`  -> ${minPath}  (${(Buffer.byteLength(minified) / 1024).toFixed(1)} KB)`);

// Write minified ESM re-export (just strip comments)
const minEsm = minify(esmBundle);
const minEsmPath = resolve(DIST, 'wfl-animator.min.mjs');
writeFileSync(minEsmPath, minEsm, 'utf-8');
console.log(`  -> ${minEsmPath}  (${(Buffer.byteLength(minEsm) / 1024).toFixed(1)} KB)`);

console.log('\nBuild complete!');
