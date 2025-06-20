"use client";

import React from "react";
import Image from 'next/image';
import type { TokenSummary } from "@/app/token-actions";
import CompareTokenDropdown from "./compare-token-dropdown";

interface CompareTokenSelectorProps {
    tokens: TokenSummary[];
    primary: TokenSummary;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    isLoading?: boolean;
}

export default function CompareTokenSelector({ tokens, primary, selectedId, onSelect, isLoading = false }: CompareTokenSelectorProps) {
    const selected = tokens.find((t) => t.contractId === selectedId) || null;

    // helper token symbols
    const helperSymbols = ['aUSD', 'STX', 'sBTC', 'CHA', 'WELSH'];
    const helpers = helperSymbols
        .map((sym) => tokens.find((t) => t.symbol === sym))
        .filter(Boolean) as TokenSummary[];

    function fmtDelta(delta: number | null) {
        if (delta === null) return "-";
        const sign = delta > 0 ? "+" : "";
        return `${sign}${delta.toFixed(2)}%`;
    }

    function getColour(delta: number | null) {
        if (delta === null) return "text-muted-foreground";
        if (delta > 0) return "text-green-600";
        if (delta < 0) return "text-red-600";
        return "";
    }

    function diff(a: number | null, b: number | null) {
        if (a === null || b === null) return null;
        return a - b;
    }

    const compare = selected ?? helpers[0] ?? null;

    return (
        <div className="mb-4 self-end w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 flex-wrap">
                <label className="text-sm text-muted-foreground" htmlFor="compare-selector">
                    Compare with:
                </label>
                <div className="w-full sm:min-w-[160px] sm:w-auto">
                    {isLoading ? (
                        <div className="h-10 bg-muted/20 rounded-lg animate-pulse flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">Loading...</span>
                        </div>
                    ) : (
                        <CompareTokenDropdown
                            tokens={tokens}
                            selected={selected}
                            onSelect={(t) => onSelect(t.contractId)}
                        />
                    )}
                </div>
                {/* helper buttons */}
                <div className="grid grid-cols-5 gap-1 sm:flex sm:gap-2 flex-wrap">
                    {isLoading ? (
                        // Show skeleton buttons while loading
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="w-10 h-10 bg-muted/20 rounded-lg animate-pulse" />
                        ))
                    ) : (
                        helpers.map((h) => (
                            <button
                                key={h.contractId}
                                onClick={() => onSelect(h.contractId)}
                                className={`cursor-pointer p-2 rounded-lg border border-none bg-muted/20 hover:bg-muted/30 flex items-center justify-center transition-colors ${selectedId === h.contractId ? 'bg-muted/30' : ''}`}
                                title={h.symbol}
                            >
                                {h.image ? (
                                    <Image src={h.image} alt={h.symbol} width={20} height={20} className="rounded-full" />
                                ) : (
                                    <span className="text-xs font-semibold text-primary/80">{h.symbol.charAt(0)}</span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>
            {/* removed stats grid inside selector as per request */}
        </div>
    );
} 