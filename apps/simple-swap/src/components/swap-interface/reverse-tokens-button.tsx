"use client";

import React, { useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

export default function ReverseTokensButton() {
    const {
        mode,
        selectedFromToken,
        selectedToToken,
        hasBothVersions,
        handleSwitchTokens
    } = useSwapTokens();

    // Determine if reverse button should be disabled
    const isReverseDisabled = useMemo(() => {
        // Always allow in swap mode
        if (mode === 'swap') return false;

        // In order mode, only allow if both tokens have subnet counterparts available
        if (mode === 'order') {
            return !(hasBothVersions(selectedFromToken) && hasBothVersions(selectedToToken));
        }

        return false;
    }, [mode, selectedFromToken, selectedToToken, hasBothVersions]);

    return (
        <div className="relative h-10 my-2 flex justify-center">
            <button
                onClick={handleSwitchTokens}
                disabled={isReverseDisabled}
                title={isReverseDisabled ? "Token reversal requires both tokens to have subnet counterparts in order mode" : "Reverse token order"}
                className={`rounded-full p-2 transition-all duration-200 ${isReverseDisabled
                    ? 'bg-white/[0.02] border border-white/[0.05] cursor-not-allowed opacity-50'
                    : 'cursor-pointer bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-white/[0.08] hover:border-white/[0.15] active:scale-95'
                    }`}
            >
                <ArrowDown className={`w-5 h-5 ${isReverseDisabled ? 'text-white/30' : 'text-white/60 hover:text-white/90'}`} />
            </button>
        </div>
    );
} 