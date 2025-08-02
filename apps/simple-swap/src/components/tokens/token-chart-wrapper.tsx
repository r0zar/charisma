'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Custom loading component with spinner and blur background
function ChartLoadingSpinner() {
    return (
        <div className="w-full h-[400px] relative rounded-2xl overflow-hidden border border-white/[0.05] bg-black/20">
            {/* Blur background */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" />
            
            {/* Centered spinner and text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                <div className="relative">
                    {/* Main spinner */}
                    <div className="h-8 w-8 border-3 border-white/20 border-t-white/80 rounded-full animate-spin" />
                    {/* Glow effect */}
                    <div className="absolute inset-0 h-8 w-8 border-3 border-transparent border-t-blue-400/40 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <span className="mt-4 text-sm text-white/70 font-medium">Loading chart...</span>
            </div>
        </div>
    );
}

const TokenChart = dynamic(() => import('./token-chart'), { 
    ssr: false,
    loading: () => <ChartLoadingSpinner />
});

interface Props {
    primary: string;
    compareId: string | null;
    primaryColor: string;
    compareColor: string;
    preloadedData?: Record<string, any>;
}

export default function TokenChartWrapper({ primary, compareId, primaryColor, compareColor, preloadedData }: Props) {
    return <TokenChart primary={primary} compareId={compareId} primaryColor={primaryColor} compareColor={compareColor} />;
} 