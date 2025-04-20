import type { Config } from 'tailwindcss';

const theme: Config['theme'] = {
    extend: {
        colors: {
            primary: {
                DEFAULT: '#16a34a', // Green
                50: '#f0fdf4',
                100: '#dcfce7',
                200: '#bbf7d0',
                300: '#86efac',
                400: '#4ade80',
                500: '#22c55e',
                600: '#16a34a', // Primary
                700: '#15803d',
                800: '#166534',
                900: '#14532d',
                950: '#052e16'
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
                50: '#f9fafb',
                100: '#f3f4f6',
                200: '#e5e7eb',
                300: '#d1d5db',
                400: '#9ca3af',
                500: '#6b7280', // Muted
                600: '#4b5563',
                700: '#374151',
                800: '#1f2937',
                900: '#111827',
                950: '#030712'
            }
        },
        borderRadius: {
            lg: '0.5rem',
            md: '0.375rem',
            sm: '0.25rem'
        },
    }
};

export default theme; 