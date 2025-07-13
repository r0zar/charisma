import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/services/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{js,ts,tsx}',
        'src/**/*.spec.{js,ts,tsx}',
        'src/**/types.ts',
        'src/**/index.ts', // Re-export files typically don't need coverage
        'src/app/**', // Next.js app directory (pages/routes)
        'src/components/**', // UI components (can be added later if needed)
        'src/contexts/**', // React contexts (can be added later if needed)
        'src/hooks/**', // React hooks (can be added later if needed)
        'src/data/**', // Static data files
        'src/schemas/**', // Type definitions and schemas
      ],
      // Coverage thresholds - start conservative and increase over time
      thresholds: {
        global: {
          branches: 40,
          functions: 50,
          lines: 60,
          statements: 60
        },
        // Specific thresholds for critical services
        'src/lib/services/bots/execution/scheduler.ts': {
          branches: 95,
          functions: 100,
          lines: 100,
          statements: 100
        },
        'src/lib/services/bots/execution/executor.ts': {
          branches: 5,
          functions: 0,
          lines: 5,
          statements: 5
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})