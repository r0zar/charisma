"use client";

import React from 'react';
import type { Token } from '../../lib/swap-client';
import TokenDropdown from '../TokenDropdown';
import { AlarmClockCheck } from 'lucide-react';

interface Props {
    displayTokens: Token[];
    selectedToken: Token | null;
    onSelectToken: (t: Token) => void;
    targetPrice: string;
    onTargetChange: (v: string) => void;
    direction: 'lt' | 'gt';
    onDirectionChange: (d: 'lt' | 'gt') => void;
    onBump: (percent: number) => void; // negative for decrease
}

export default function LimitConditionSection({
    displayTokens,
    selectedToken,
    onSelectToken,
    targetPrice,
    onTargetChange,
    direction,
    onDirectionChange,
    onBump,
}: Props) {
    const handleReset = () => {
        onTargetChange('');
    };

    return (
        <div>
            <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-1 backdrop-blur-sm border border-muted/40 shadow-sm">
                <label className="block text-sm text-foreground/80 font-medium mb-2">When</label>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-5">
                    {/* Token selector */}
                    <div className="w-full sm:w-32 shrink-0">
                        <TokenDropdown
                            tokens={displayTokens}
                            selected={selectedToken}
                            onSelect={onSelectToken}
                            label=""
                        />
                    </div>

                    {/* Direction toggle */}
                    <div className="flex items-center border border-border/40 rounded-md overflow-hidden text-xs select-none shrink-0 whitespace-nowrap">
                        {[
                            { key: 'lt', label: 'is less than' },
                            { key: 'gt', label: 'is greater than' },
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                className={`px-2.5 py-1 whitespace-nowrap transition-colors ${direction === key ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                                onClick={() => onDirectionChange(key as 'lt' | 'gt')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Price input with $ prefix and +/- buttons */}
                    <div className="flex items-center gap-1 flex-1 min-w-[8rem]">
                        <span className="text-muted-foreground text-xl mb-0.5 font-light">$</span>
                        <input
                            value={targetPrice}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (/^[0-9]*\.?[0-9]*$/.test(v) || v === '') {
                                    onTargetChange(v);
                                }
                            }}
                            placeholder="0.00"
                            className="w-18 bg-transparent border-none text-xl font-medium focus:outline-none placeholder:text-muted-foreground/50"
                        />

                        <div className="flex flex-row gap-0.5 shrink-0">
                            <button onClick={() => onBump(0.01)} className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded">+</button>
                            <button onClick={() => onBump(-0.01)} className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded">-</button>
                        </div>
                        {/* spacer to take up right side of flex */}
                        <div className="flex-1" ></div>
                    </div>
                </div>
            </div>
            {/* spacer between condition builder and from-section */}
            <div className="my-2 flex justify-center">
                <button
                    onClick={handleReset}
                    className="cursor-pointer rounded-full p-2 shadow bg-muted hover:bg-muted/70 transition-transform active:scale-95"
                    title="Reset target price"
                >
                    <AlarmClockCheck className="w-5 h-5 text-primary" />
                </button>
            </div>
        </div>
    );
} 