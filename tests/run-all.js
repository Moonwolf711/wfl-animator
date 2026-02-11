/**
 * Test runner - imports and runs all test suites
 * Exit code 1 if any tests fail (for CI)
 *
 * Usage: node --experimental-vm-modules tests/run-all.js
 */

import { TestRunner } from './test-helpers.js';
import { runParameterTests } from './parameter-tests.js';
import { runStateMachineTests } from './state-machine-tests.js';
import { runAnimatorTests } from './animator-tests.js';
import { runFileFormatTests } from './file-format-tests.js';
import { runRiggingTests } from './rigging-tests.js';

async function runAll() {
  console.log('WFL Animator - Full Test Suite');
  console.log('===================================================');
  console.log(`Running at: ${new Date().toISOString()}\n`);

  let totalPassed = 0;
  let totalFailed = 0;

  // ── Parameter Tests ──────────────────────────────────────────────
  TestRunner.reset();
  const paramResult = await runParameterTests();
  totalPassed += paramResult.passed;
  totalFailed += paramResult.failed;

  // ── State Machine Tests ──────────────────────────────────────────
  TestRunner.reset();
  const smResult = await runStateMachineTests();
  totalPassed += smResult.passed;
  totalFailed += smResult.failed;

  // ── Animator Tests ───────────────────────────────────────────────
  TestRunner.reset();
  const animResult = await runAnimatorTests();
  totalPassed += animResult.passed;
  totalFailed += animResult.failed;

  // ── File Format Tests ──────────────────────────────────────────────
  TestRunner.reset();
  const ffResult = await runFileFormatTests();
  totalPassed += ffResult.passed;
  totalFailed += ffResult.failed;

  // ── Rigging Tests ─────────────────────────────────────────────────
  TestRunner.reset();
  const rigResult = await runRiggingTests();
  totalPassed += rigResult.passed;
  totalFailed += rigResult.failed;

  // ── Grand Total ──────────────────────────────────────────────────
  const grandTotal = totalPassed + totalFailed;
  console.log('===================================================');
  console.log('GRAND TOTAL');
  console.log('===================================================');
  console.log(`  Parameter tests:     ${paramResult.passed}/${paramResult.total} passed`);
  console.log(`  State Machine tests: ${smResult.passed}/${smResult.total} passed`);
  console.log(`  Animator tests:      ${animResult.passed}/${animResult.total} passed`);
  console.log(`  File Format tests:   ${ffResult.passed}/${ffResult.total} passed`);
  console.log(`  Rigging tests:       ${rigResult.passed}/${rigResult.total} passed`);
  console.log('---------------------------------------------------');
  console.log(`  TOTAL:               ${totalPassed}/${grandTotal} passed (${Math.round(totalPassed / grandTotal * 100)}%)`);
  console.log('===================================================\n');

  if (totalFailed > 0) {
    console.log(`FAILED: ${totalFailed} test(s) did not pass.`);
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED.');
    process.exit(0);
  }
}

runAll().catch(error => {
  console.error('Test runner crashed:', error);
  process.exit(1);
});
