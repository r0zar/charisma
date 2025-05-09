"use client";

import React from 'react';
import { Twitter } from 'lucide-react';

interface ToggleProps {
    mode: 'swap' | 'order';
    onChange: (m: 'swap' | 'order') => void;
}

function ModeToggle({ mode, onChange }: ToggleProps) {
    const orderDisabled = false;
    return (
        <div className="flex items-center border border-border/40 rounded-md overflow-hidden text-xs select-none">
            {(['swap', 'order'] as const).map((m) => {
                const isDisabled = orderDisabled && m === 'order';
                const isActive = mode === m;
                return (
                    <button
                        key={m}
                        className={`cursor-pointer relative px-2.5 py-1 transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-transparent'} ${isDisabled ? 'cursor-not-allowed text-muted-foreground/60 hover:bg-transparent' : 'hover:bg-muted'}`}
                        onClick={() => {
                            if (isDisabled) return;
                            onChange(m);
                        }}
                    >
                        {m === 'swap' ? 'Swap' : 'Order'}
                    </button>
                );
            })}
        </div>
    );
}

interface SwapHeaderProps {
    securityLevel: 'high' | 'medium' | 'low' | null;
    userAddress: string | null;
    mode: 'swap' | 'order';
    onModeChange: (m: 'swap' | 'order') => void;
    onShare: () => void;
}

export default function SwapHeader({
    securityLevel,
    mode,
    onModeChange,
    onShare
}: SwapHeaderProps) {
    return (
        <div className="border-b border-border/30 p-5 flex justify-between items-center bg-gradient-to-r from-card to-card/90">
            <div className="flex items-center flex-wrap gap-3">
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

            <div className="flex items-center gap-3 shrink-0">
                <ModeToggle mode={mode} onChange={onModeChange} />
                <button
                    onClick={onShare}
                    title="Share this swap"
                    className="cursor-pointer ml-2 p-2 hover:bg-muted rounded-full transition-colors"
                >
                    <Twitter className="h-4 w-4 text-primary" />
                </button>
            </div>
        </div>
    );
} 