export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        TextDecoder: 'readonly',
        Uint8Array: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        indexedDB: 'readonly',
        AbortController: 'readonly',
        Image: 'readonly',
        Function: 'readonly',
        console: 'readonly',
      }
    },
    rules: {
      // Errors
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-shadow': 'warn',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unreachable': 'error',

      // Warnings
      'no-console': 'warn',
      'no-empty': 'warn',
      'no-unused-expressions': 'warn',

      // Style
      'semi': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'no-multiple-empty-lines': ['error', { max: 1 }],
    }
  },
  {
    ignores: ['node_modules/**', 'dist/**']
  }
];
