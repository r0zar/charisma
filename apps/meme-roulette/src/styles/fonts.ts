import { Space_Grotesk, DM_Mono, Inter } from 'next/font/google';

// Primary Display Font - Space Grotesk for headings, CTAs, and important UI elements
export const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-display',
});

// Mono Font - DM Mono for prices, numeric values, and code-like elements
export const dmMono = DM_Mono({
    weight: ['400', '500'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-mono',
});

// Body Font - Inter for body text and general UI
export const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-body',
}); 