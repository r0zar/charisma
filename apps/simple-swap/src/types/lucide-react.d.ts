// Type declarations for Lucide React components to work with React 19
import React from 'react';
import { LucideProps } from 'lucide-react';

// Fix for Lucide icons in React 19
declare module 'lucide-react' {
    // Make all icon components compatible with React 19 JSX 
    export interface LucideIcon extends React.FC<LucideProps> { }

    // Define common icons we're using
    export const ArrowRight: LucideIcon;
    export const Coins: LucideIcon;
    export const Shield: LucideIcon;
    export const Layers: LucideIcon;
    export const Wallet: LucideIcon;
    export const Sparkles: LucideIcon;
    export const RefreshCw: LucideIcon;
    export const Search: LucideIcon;
    export const ArrowUpDown: LucideIcon;
    export const Plus: LucideIcon;
    export const X: LucideIcon;
    export const Check: LucideIcon;
} 