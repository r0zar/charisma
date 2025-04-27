'use client';

import React from 'react';
import { SpinProvider } from '@/contexts/SpinContext'; // Adjust path if using aliases

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SpinProvider>
            {children}
        </SpinProvider>
    );
} 