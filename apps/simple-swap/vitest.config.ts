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
            enabled: false,
        },
    },
}); 