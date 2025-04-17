"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Theme, ThemeProviderProps, ThemeProviderState } from './types';

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = 'ui-theme',
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(storageKey);
                return (stored as Theme) || defaultTheme;
            } catch (e) {
                console.warn('Failed to get theme from localStorage:', e);
            }
        }
        return defaultTheme;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
            root.setAttribute('data-theme', systemTheme);
        } else {
            root.classList.add(theme);
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, theme);
        } catch (e) {
            console.warn('Failed to save theme to localStorage:', e);
        }
    }, [theme, storageKey]);

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            setTheme(theme);
        },
    };

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}; 