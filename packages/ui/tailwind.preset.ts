import type { Config } from 'tailwindcss';
import baseConfig from './tailwind.config';

/**
 * Creates a Tailwind CSS configuration that extends the base UI package theme
 */
function createTailwindPreset(config: Partial<Config>): Config {
    return {
        presets: [baseConfig],
        ...config
    } as Config;
}

export default createTailwindPreset; 