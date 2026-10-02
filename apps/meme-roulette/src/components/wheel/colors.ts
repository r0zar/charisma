'use client';

import { useEffect, useState } from 'react';

export interface RealmColors {
    accent: string;
    gold: string;
    ink: string;
    inkMuted: string;
    surface: string;
    chrome: string;
    line: string;
    /** one colour per slice, cycled */
    slices: string[];
}

const read = (style: CSSStyleDeclaration, name: string) => style.getPropertyValue(name).trim();

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** blend two #rrggbb colours: t = 0 gives a, 1 gives b */
export const mix = (a: string, b: string, t: number) => {
    const [x, y] = [hexToRgb(a), hexToRgb(b)];
    return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

/** dark or light text for a slice colour */
export function labelOn(hex: string): string {
    const [r, g, b] = hexToRgb(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#141414' : '#ffffff';
}

function readColors(): RealmColors {
    const s = getComputedStyle(document.documentElement);
    // hues alternate so neighbouring slices never share a family (the two reds sit four apart)
    const base = [...new Set(['--accent', '--blaze', '--gold', '--success', '--danger', '--warning'].map(n => read(s, n).slice(0, 7)).filter(Boolean))];
    const chrome = read(s, '--chrome') || '#000000';
    const ink = read(s, '--ink') || '#ffffff';
    // the day realm's tokens are tuned for text on white; big fills read better a step lighter
    const day = labelOn(read(s, '--bg').slice(0, 7) || '#000000') === '#141414';
    const first = day ? base.map(c => mix(c, '#ffffff', 0.18)) : base;
    // a second, lighter lap of the palette for wheels with more slices than hues
    const slices = [...first, ...base.map(c => mix(c, '#ffffff', day ? 0.5 : 0.38))];
    return {
        accent: read(s, '--accent'),
        gold: read(s, '--gold'),
        ink,
        inkMuted: read(s, '--ink-muted'),
        surface: read(s, '--surface-raised') || read(s, '--surface'),
        chrome,
        line: read(s, '--line-strong') || read(s, '--line'),
        slices,
    };
}

/** The realm's colours, re-read whenever the theme changes (the toggle or the system setting). */
export function useRealmColors(): RealmColors | null {
    const [colors, setColors] = useState<RealmColors | null>(null);
    useEffect(() => {
        const update = () => setColors(readColors());
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
        const media = matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', update);
        return () => { observer.disconnect(); media.removeEventListener('change', update); };
    }, []);
    return colors;
}
