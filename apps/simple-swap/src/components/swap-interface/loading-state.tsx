"use client";

import React from 'react';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { LiquidOrbit } from '@/components/ui/liquid-orbit';

export default function LoadingState() {
    const { isInitializing, isLoadingTokens } = useSwapTokens();
    const step = isInitializing ? 'Connecting' : isLoadingTokens ? 'Loading tokens' : 'Finding the best routes';

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-surface-sunken border border-line-soft rounded-2xl p-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <LiquidOrbit caption={step} />
                </div>
            </div>
        </div>
    );
}
