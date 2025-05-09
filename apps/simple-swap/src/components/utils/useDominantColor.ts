'use client';

import { useEffect, useState } from 'react';
import ColorThief from 'colorthief';

function rgbToHex(r: number, g: number, b: number) {
    return '#' + [r, g, b].map(x => {
        const h = x.toString(16);
        return h.length === 1 ? '0' + h : h;
    }).join('');
}

export function useDominantColor(url?: string | null): string | null {
    const [color, setColor] = useState<string | null>(null);

    useEffect(() => {
        if (!url) return;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
            try {
                const thief = new ColorThief();
                const rgb = thief.getColor(img);
                setColor(rgbToHex(rgb[0], rgb[1], rgb[2]));
            } catch (e) {
                console.error('color thief fail', e);
            }
        };
    }, [url]);

    return color;
} 