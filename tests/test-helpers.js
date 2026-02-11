/**
 * Shared test framework - reusable TestRunner, assert helpers
 * Matches the pattern from cowork-patterns-tests.js
 */

export const TestRunner = {
  passed: 0,
  failed: 0,
  errors: [],
  currentCategory: '',

  category(name) {
    this.currentCategory = name;
    console.log(`\n--- ${name} ---`);
  },

  test(name, fn) {
    try {
      fn();
      this.passed++;
      console.log(`  [PASS] ${name}`);
    } catch (error) {
      this.failed++;
      this.errors.push({ category: this.currentCategory, name, error: error.message });
      console.log(`  [FAIL] ${name}`);
      console.log(`    -> ${error.message}`);
    }
  },

  async testAsync(name, fn) {
    try {
      await fn();
      this.passed++;
      console.log(`  [PASS] ${name}`);
    } catch (error) {
      this.failed++;
      this.errors.push({ category: this.currentCategory, name, error: error.message });
      console.log(`  [FAIL] ${name}`);
      console.log(`    -> ${error.message}`);
    }
  },

  summary() {
    const total = this.passed + this.failed;
    console.log('\n===================================================');
    if (total === 0) {
      console.log('No tests were run.');
    } else {
      console.log(`Results: ${this.passed}/${total} passed (${Math.round(this.passed / total * 100)}%)`);
    }
    if (this.failed > 0) {
      console.log(`\nFailed tests:`);
      this.errors.forEach(e => console.log(`  - [${e.category}] ${e.name}: ${e.error}`));
    }
    console.log('===================================================\n');
    return { passed: this.passed, failed: this.failed, total };
  },

  /**
   * Reset counters (used between test suites in run-all)
   */
  reset() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.currentCategory = '';
  }
};

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
