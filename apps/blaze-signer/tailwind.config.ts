import type { Config } from 'tailwindcss';
import createTailwindPreset from '@repo/ui/tailwind/preset';

const config = createTailwindPreset({
    content: [
        // App source files
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        // UI package components
        '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            // App-specific customizations can go here
        },
    },
});

export default config; 