/**
 * ESLint flat config.
 *
 * Scoped deliberately narrowly: this catches the classes of mistake that are genuinely
 * dangerous in a no-framework codebase that builds HTML from template strings — undeclared
 * globals, unreachable code, accidental fallthrough — without imposing a style opinion that
 * would churn every file.
 */
export default [
  {
    files: ['src/**/*.js', 'tests/**/*.js'],

    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',

      globals: {
        // Browser
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        performance: 'readonly',
        IntersectionObserver: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        Element: 'readonly',
        globalThis: 'readonly',
      },
    },

    linterOptions: {
      reportUnusedDisableDirectives: true,
    },

    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-implicit-globals': 'error',
      'no-fallthrough': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-imports': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'warn',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
