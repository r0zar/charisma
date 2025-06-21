'use client';

import { useEffect, useState } from 'react';
import ColorThief from 'colorthief';

function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map(x => {
        const h = x.toString(16);
        return h.length === 1 ? '0' + h : h;
    }).join('');
}

// Cache to prevent recalculating same colors
const colorCache = new Map<string, string>();

export function useDominantColor(url?: string | null): string | null {
    const [color, setColor] = useState<string | null>(null);

    useEffect(() => {
        if (!url) {
            setColor(null);
            return;
        }

        // Check cache first
        if (colorCache.has(url)) {
            setColor(colorCache.get(url)!);
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const handleLoad = () => {
            try {
                const thief = new ColorThief();
                const rgb = thief.getColor(img);
                const hexColor = rgbToHex(rgb[0], rgb[1], rgb[2]);
                
                // Cache the result
                colorCache.set(url, hexColor);
                setColor(hexColor);
            } catch (e) {
                console.error('color thief fail', e);
                // Set fallback color and cache it
                const fallbackColor = '#3b82f6';
                colorCache.set(url, fallbackColor);
                setColor(fallbackColor);
            }
        };

        const handleError = () => {
            console.warn('Failed to load image for color extraction:', url);
            const fallbackColor = '#3b82f6';
            colorCache.set(url, fallbackColor);
            setColor(fallbackColor);
        };

        img.onload = handleLoad;
        img.onerror = handleError;
        img.src = url;

        // Cleanup function
        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [url]);

    return color;
} 