import { createTailwindPreset } from '@repo/ui/tailwind';

const config = createTailwindPreset({
    content: [
        // UI package components
        '../../packages/ui/**/*.{js,ts,jsx,tsx}',
        // App source files
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
});

export default config;