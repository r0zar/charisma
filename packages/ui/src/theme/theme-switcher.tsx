"use client"

import React from 'react';
import { Sun, Moon, Computer } from 'lucide-react';
import { useTheme } from './theme-provider';
import type { Theme } from './types';

const icons = {
    light: Sun,
    dark: Moon,
    system: Computer
} as const;

interface ThemeSwitcherProps {
    className?: string;
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        const themeOrder: Theme[] = ['light', 'dark', 'system'];
        const currentIndex = themeOrder.indexOf(theme);
        const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
        setTheme(nextTheme);
    };

    const Icon = icons[theme];

    return (
        <button
            onClick={toggleTheme}
            className={className}
            style={{
                position: 'fixed',
                top: '1rem',
                right: '1rem',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--foreground)',
                fontSize: '0.875rem',
                zIndex: 50,
            }}
            title={`Current theme: ${theme}`}
        >
            <Icon size={16} />
            <span style={{ textTransform: 'capitalize' }}>{theme}</span>
        </button>
    );
} 