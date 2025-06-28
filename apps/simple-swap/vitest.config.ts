import { defineConfig } from 'vitest/config';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';

// Load environment variables for tests
loadEnv({ path: join(__dirname, '.env.local'), override: true, debug: false });

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'dist/',
                '.next/',
                '**/*.config.*',
                '**/*.test.*',
                'tests/setup.ts',
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
        },
    },
}); 