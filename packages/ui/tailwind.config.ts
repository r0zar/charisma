import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// Base theme shared by the UI package
export const baseConfig: Config = {
    darkMode: ["class"],
    content: [],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#f7931a', // Bitcoin Orange
                    50: '#fff7ed',
                    100: '#ffedd5',
                    200: '#fed7aa',
                    300: '#fdba74',
                    400: '#fb923c',
                    500: '#f97316',
                    600: '#f7931a', // Primary
                    700: '#c2740d',
                    800: '#9a5b0c',
                    900: '#7c4709',
                    950: '#431f01'
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                secondary: {
                    DEFAULT: '#2563eb', // Blue
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb', // Secondary
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554'
                },
                destructive: {
                    DEFAULT: '#dc2626', // Red
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626', // Destructive
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                    950: '#450a0a'
                },
                muted: {
                    DEFAULT: '#6b7280AA', // Gray
                    50: '#f9fafbAA',
                    100: '#f3f4f6AA',
                    200: '#e5e7ebAA',
                    300: '#d1d5dbAA',
                    400: '#9ca3afAA',
                    500: '#6b7280AA', // Muted
                    600: '#4b5563AA',
                    700: '#374151AA',
                    800: '#1f2937AA',
                    900: '#111827AA',
                    950: '#030712AA'
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        }
    },
    variants: {
        extend: {
            backgroundColor: ['hover', 'group-hover', 'focus', 'active', 'disabled', 'data-[state=open]', 'data-[state=closed]', 'data-[state=active]', 'data-[disabled]'],
            opacity: ['hover', 'group-hover', 'focus', 'disabled'],
            brightness: ['hover', 'group-hover'],
            borderColor: ['hover', 'focus', 'active', 'disabled', 'data-[state=open]', 'data-[state=closed]', 'data-[state=active]', 'data-[invalid]'],
            textColor: ['hover', 'group-hover', 'focus', 'active', 'disabled', 'data-[state=open]', 'data-[state=closed]', 'data-[state=active]'],
            scale: ['hover', 'active', 'group-hover'],
            cursor: ['disabled'],
            pointerEvents: ['disabled'],
            ringColor: ['focus-visible'],
            ringOffsetColor: ['focus-visible'],
            ringOffsetWidth: ['focus-visible'],
            ringOpacity: ['focus-visible'],
            ringWidth: ['focus-visible'],
            transform: ['hover', 'focus'],
            translate: ['hover', 'focus'],
        }
    },
    plugins: [animate],
};

/**
 * Creates a Tailwind CSS configuration that extends the base UI package theme
 */
export function createTailwindPreset(config: Partial<Config>): Config {
    // Use Tailwind's presets mechanism for clean inheritance
    return {
        presets: [baseConfig],
        ...config,
    } as Config;
}

export default baseConfig; 