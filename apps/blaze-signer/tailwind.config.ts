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
            brightness: {
                '102': '1.02',
                '105': '1.05',
                '108': '1.08',
            }
        },
    },
    // Make sure we have proper opacity modifiers
    safelist: [
        { pattern: /bg-background\/\d+/ },
        { pattern: /bg-white\/\d+/ },
        { pattern: /brightness-\d+/ },
        { pattern: /opacity-\d+/ },
        { pattern: /group-hover:/ },
        'hover:bg-slate-50',
        'hover:bg-slate-100',
        'hover:bg-gray-50',
        'hover:bg-gray-100',
        'bg-opacity-5',
        'bg-opacity-10',
        'hover:bg-white'
    ],
    // Enable all variants for certain groups
    variants: {
        extend: {
            backgroundColor: ['hover', 'group-hover'],
            opacity: ['hover', 'group-hover'],
            brightness: ['hover'],
            borderColor: ['hover']
        }
    }
});

export default config; 