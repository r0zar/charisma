"use client";

import React from 'react';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

export default function LoadingState() {
    const { isInitializing, isLoadingTokens } = useSwapTokens();

    return (
        <div className="max-w-2xl mx-auto">
            {/* Premium Glass Loading Container */}
            <div className="bg-surface-sunken border border-line-soft rounded-2xl p-8 backdrop-blur-sm">
                <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8">
                    
                    {/* Premium Loading Animation */}
                    <div className="relative">
                        {/* Outer ring */}
                        <div className="w-20 h-20 border-2 border-line rounded-full"></div>
                        
                        {/* Animated ring 1 */}
                        <div className="absolute inset-0 w-20 h-20 border-2 border-accent rounded-full animate-spin border-t-transparent"></div>
                        
                        {/* Animated ring 2 - counter rotation */}
                        <div className="absolute inset-2 w-16 h-16 border-2 border-blaze/60 rounded-full animate-[spin_1.5s_linear_infinite_reverse] border-b-transparent"></div>
                        
                        {/* Inner glow */}
                        <div className="absolute inset-4 w-12 h-12 bg-gradient-to-br from-accent/20 to-accent/20 rounded-full animate-pulse"></div>
                        
                        {/* Center dot */}
                        <div className="absolute inset-[34px] w-3 h-3 bg-ink/80 rounded-full animate-pulse"></div>
                    </div>
                    
                    {/* Premium Text Content */}
                    <div className="text-center space-y-4">
                        <h3 className="text-xl font-semibold text-ink">
                            Initializing Secure Trading
                        </h3>
                        
                        <p className="text-sm text-ink-body animate-pulse max-w-sm">
                            {isInitializing ? "Establishing secure blockchain connection..." :
                                isLoadingTokens ? "Loading verified token registry..." :
                                    "Building optimal routing infrastructure..."}
                        </p>
                        
                        {/* Premium Progress Bar */}
                        <div className="w-64 h-2 bg-surface rounded-full overflow-hidden mt-6">
                            <div 
                                className="h-full bg-gradient-to-r from-accent to-accent rounded-full transition-all duration-1000 ease-out"
                                style={{
                                    width: isInitializing ? '25%' : isLoadingTokens ? '65%' : '90%',
                                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                                }}
                            ></div>
                        </div>
                        
                        {/* Security indicators */}
                        <div className="flex items-center justify-center space-x-4 mt-6 text-xs">
                            <div className="flex items-center space-x-2">
                                <div className="h-2 w-2 bg-success rounded-full animate-pulse"></div>
                                <span className="text-ink-muted">Secure Protocol</span>
                            </div>
                            <div className="h-3 w-px bg-surface-selected"></div>
                            <div className="flex items-center space-x-2">
                                <div className="h-2 w-2 bg-accent rounded-full animate-pulse"></div>
                                <span className="text-ink-muted">Verified Contracts</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 