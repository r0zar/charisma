"use client";

import React from 'react';

interface SwapHeaderProps {
    securityLevel: 'high' | 'medium' | 'low' | null;
    userAddress: string | null;
}

export default function SwapHeader({
    securityLevel,
    userAddress
}: SwapHeaderProps) {
    return (
        <div className="border-b border-border/30 p-5 flex justify-between items-center bg-gradient-to-r from-card to-card/90">
            <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-foreground">Secure Token Swap</h2>

                {/* Security level indicator */}
                {securityLevel && (
                    <div className="flex items-center bg-background/40 px-2 py-0.5 rounded-full">
                        <span className={`h-2 w-2 rounded-full mr-1.5 ${securityLevel === 'high' ? 'bg-green-500' :
                            securityLevel === 'medium' ? 'bg-blue-500' : 'bg-purple-500'
                            }`}></span>
                        <span className="text-xs">Routing optimizer</span>
                    </div>
                )}
            </div>

            <div className="flex items-center shrink-0">
                {userAddress && (
                    <div className="flex items-center text-xs text-muted-foreground px-2 py-1 bg-muted/40 rounded-md cursor-pointer hover:bg-muted/60 transition-colors max-w-[120px] sm:max-w-none"
                        title={userAddress}>
                        <svg className="h-3 w-3 mr-1 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                        {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
                    </div>
                )}
            </div>
        </div>
    );
} 