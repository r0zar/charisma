"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { AlarmClockCheck, ChevronDown } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

export default function LimitConditionSection() {
    const [showChart, setShowChart] = useState(true);
    const SUSDT_ID = 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt';

    // Get all needed state from context
    const {
        displayTokens,
        conditionToken,
        setConditionToken,
        baseToken,
        setBaseToken,
        targetPrice,
        setTargetPrice,
        conditionDir,
        setConditionDir,
        handleBumpPrice,
        displayedToToken,
    } = useSwapTokens();

    const selectedToken = conditionToken || displayedToToken;

    const handleReset = () => {
        setTargetPrice('');
    };

    return (
        <div>
            <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-1 backdrop-blur-sm border border-muted/40 shadow-sm">
                {/* Header row with toggle */}
                <div className="flex items-center gap-1 mb-2">
                    <label className="text-sm text-foreground/80 font-medium">When</label>
                    {selectedToken && (
                        <button
                            type="button"
                            onClick={() => setShowChart(!showChart)}
                            className="text-muted-foreground hover:text-foreground p-0.5 rounded-md"
                            title={showChart ? 'Hide price chart' : 'Show price chart'}
                        >
                            <ChevronDown className={`w-4 h-4 transition-transform ${showChart ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-5">
                    {/* Token selector */}
                    <div className="w-full sm:w-32 shrink-0">
                        <TokenDropdown
                            tokens={displayTokens}
                            selected={selectedToken}
                            onSelect={(t) => {
                                setConditionToken(t);
                            }}
                            label=""
                            suppressFlame={true}
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
                                className={`px-2.5 py-1 whitespace-nowrap transition-colors ${conditionDir === key ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                                onClick={() => setConditionDir(key as 'lt' | 'gt')}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Price input with base symbol suffix */}
                    <div className="flex items-center gap-1 grow-1">
                        <input
                            value={targetPrice}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (/^[0-9]*\.?[0-9]*$/.test(v) || v === '') {
                                    setTargetPrice(v);
                                }
                            }}
                            placeholder="0.00"
                            className="w-full sm:w-36 bg-transparent border-none text-xl font-medium focus:outline-none placeholder:text-muted-foreground/50"
                        />

                        <div className="flex flex-row gap-0.5 shrink-0">
                            <button onClick={() => handleBumpPrice(0.01)} className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded">+</button>
                            <button onClick={() => handleBumpPrice(-0.01)} className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded">-</button>
                        </div>
                    </div>

                    {/* Base asset selector (USD + tokens) */}
                    <div className="w-full sm:w-32 shrink-0">
                        {(() => {
                            // Build options with synthetic USD first then tokens
                            const options: TokenCacheData[] = [...displayTokens];

                            // Determine currently selected object
                            const selected = baseToken ?? options.find(o => o.contractId === SUSDT_ID) ?? null;

                            return (
                                <TokenDropdown
                                    tokens={options}
                                    selected={selected}
                                    onSelect={(t) => {
                                        if (t.contractId === 'USD') setBaseToken(null);
                                        else setBaseToken(t.contractId === SUSDT_ID ? null : t);
                                    }}
                                />
                            );
                        })()}
                    </div>
                    <div className="flex-1"></div>
                </div>

                {/* Collapsible chart */}
                {showChart && selectedToken && (
                    <div className="mt-4">
                        <ConditionTokenChartWrapper
                            token={selectedToken}
                            baseToken={baseToken}
                            targetPrice={targetPrice}
                            onTargetPriceChange={setTargetPrice}
                        />
                    </div>
                )}
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