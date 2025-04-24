// Type declarations for Next.js components to work with React 19
import React from 'react';
import { LinkProps as NextLinkProps } from 'next/link';
import { ImageProps as NextImageProps } from 'next/image';

// Fix for Next.js Link component in React 19
declare module 'next/link' {
    // Make Link component compatible with React 19 JSX
    const Link: React.FC<NextLinkProps & { children?: React.ReactNode }>;
    export default Link;
}

// Fix for Next.js Image component in React 19
declare module 'next/image' {
    // Make Image component compatible with React 19 JSX
    const Image: React.FC<NextImageProps>;
    export default Image;
} 