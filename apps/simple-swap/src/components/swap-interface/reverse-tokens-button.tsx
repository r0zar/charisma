"use client";

import React, { useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { useSwapContext } from '../../contexts/swap-context';

export default function ReverseTokensButton() {
    const {
        mode,
        selectedFromToken,
        selectedToToken,
        hasBothVersions,
        handleSwitchTokens
    } = useSwapContext();

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
                className={`rounded-full p-2 shadow transition-all duration-200 ${isReverseDisabled
                    ? 'bg-muted/50 cursor-not-allowed opacity-50'
                    : 'cursor-pointer bg-muted hover:bg-muted/70 active:scale-95'
                    }`}
            >
                <ArrowDown className={`w-5 h-5 ${isReverseDisabled ? 'text-muted-foreground/50' : 'text-primary'}`} />
            </button>
        </div>
    );
} 