module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  env: {
    node: true,
    jest: true,
    es2020: true,
    browser: true
  },
  rules: {
    // Rules to enable one by one (currently disabled for migration)
    'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-case-declarations': 'error',
    'no-empty': 'error',
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-unreachable': 'error',
    'no-useless-escape': 'error',
    // TypeScript handles these
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-require-imports': 'off'
  },
  ignorePatterns: [
    'dist/**',
    'build/**',
    'node_modules/**',
    '*.js'
  ]
};
