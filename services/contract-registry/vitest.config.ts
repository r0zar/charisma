import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Include both unit and integration tests
    include: [
      'src/__tests__/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**'
    ],

    // Use node environment for integration tests, happy-dom for unit tests
    // Tests can override this per file if needed
    environment: 'happy-dom',
    globals: true,

    // Optimized for both unit and integration tests
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
        minForks: 1,
        isolate: true // Better for integration tests
      }
    },

    // Longer timeouts for integration tests
    testTimeout: 60000, // 1 minute
    hookTimeout: 30000, // 30 seconds for setup/teardown

    // Setup files - will handle both unit and integration setup
    setupFiles: [
      './src/__tests__/setup.ts'
    ],

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: './coverage',
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'src/__tests__/**',
        'src/**/*.{test,spec}.ts'
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },

    // Environment variables for integration tests
    env: {
      NODE_ENV: 'test',
      HIRO_API_KEY: process.env.HIRO_API_KEY,
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
      BLOB_BASE_URL: process.env.BLOB_BASE_URL,
      KV_REST_API_URL: process.env.KV_REST_API_URL,
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
      KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN,
    },

    // Retry flaky tests (mainly integration)
    retry: 1,

    // Memory management
    maxConcurrency: 2,
    clearMocks: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './src/__tests__'),
      '@fixtures': path.resolve(__dirname, './src/__tests__/fixtures')
    }
  }
});