"use client";

import React from 'react';

export default function LoadingState() {
    // Get loading state from context
    const isInitializing = false;
    const isLoadingTokens = false;

    return (
        <div className="glass-card p-8 flex flex-col items-center justify-center h-[400px]">
            <div className="relative flex items-center justify-center w-16 h-16 mb-6">
                <div className="absolute w-full h-full border-4 border-primary/20 rounded-full"></div>
                <div className="absolute w-full h-full border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
                <div className="absolute w-2/3 h-2/3 border-4 border-primary/30 rounded-full animate-[spin_1.2s_linear_infinite]"></div>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">Initializing Secure Swap</h3>
            <div className="flex flex-col gap-2 items-center">
                <p className="text-sm text-muted-foreground animate-pulse">
                    {isInitializing ? "Establishing secure connection..." :
                        isLoadingTokens ? "Loading verified token list..." :
                            "Building secure routing graph..."}
                </p>
                <div className="w-48 h-1 mt-3 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{
                        width: isInitializing ? '30%' : isLoadingTokens ? '60%' : '90%'
                    }}></div>
                </div>
            </div>
        </div>
    );
} 