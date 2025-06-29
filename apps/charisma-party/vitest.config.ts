import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    typecheck: {
      include: ['tests/**/*.test.ts', 'tests/global.d.ts']
    },
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.js',
      'tests/**/*.spec.ts',
      'tests/**/*.spec.js'
    ],
    exclude: [
      'node_modules/',
      'dist/',
      '.git/',
      '.vite/'
    ],
    testTimeout: 60000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.config.*',
        '**/*.test.*',
        'src/**/*.d.ts',
        'src/**/index.ts', // Usually just re-exports
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  }
});