"use client";

import React from 'react';
import { useSwapContext } from '../../contexts/swap-context';

export default function ErrorAlert() {
    const { error, priceError } = useSwapContext();

    if (!error && !priceError) {
        return null;
    }

    return (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-400 animate-[appear_0.3s_ease-out]">
            <div className="flex items-start space-x-3">
                <div className="h-6 w-6 flex-shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mt-0.5">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold mb-1">Transaction Error</h4>
                    {error && <p className="text-xs leading-relaxed">{error}</p>}
                    {priceError && <p className="text-xs leading-relaxed mt-1">{priceError}</p>}
                </div>
            </div>
        </div>
    );
} 