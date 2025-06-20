"use client";

import React, { useState } from 'react';
import TokenDropdown from '../TokenDropdown';
import { ChevronDown, Info } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

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
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-white/95">Order Conditions</h3>
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="h-5 w-5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center">
                                <Info className="w-3 h-3" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-semibold text-white/95 mb-4">
                                    How Limit Orders Work
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 text-sm text-white/80">
                                <div>
                                    <h4 className="font-medium text-white/95 mb-2">What are Limit Orders?</h4>
                                    <p>Limit orders allow you to set specific price conditions for automatic trade execution. Unlike instant swaps that execute immediately at current market prices, limit orders wait until your specified price target is reached.</p>
                                </div>
                                
                                <div>
                                    <h4 className="font-medium text-white/95 mb-2">How They Execute</h4>
                                    <p>When you create a limit order, Charisma's price oracle continuously monitors the market. Once your condition is met (e.g., "when WELSH ≥ 0.05 sUSDT"), the order is automatically broadcast to the Stacks blockchain for execution.</p>
                                </div>
                                
                                <div>
                                    <h4 className="font-medium text-white/95 mb-2">Why Use Limit Orders?</h4>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li><strong>Buy the Dip:</strong> Set orders to purchase tokens when prices drop to your target level</li>
                                        <li><strong>Take Profits:</strong> Automatically sell when your tokens reach desired profit levels</li>
                                        <li><strong>Sleep Easy:</strong> No need to constantly monitor markets - orders execute 24/7</li>
                                        <li><strong>Avoid FOMO:</strong> Stick to your strategy instead of making emotional trades</li>
                                        <li><strong>Dollar Cost Averaging:</strong> Set multiple orders at different price levels</li>
                                    </ul>
                                </div>
                                
                                <div>
                                    <h4 className="font-medium text-white/95 mb-2">Oracle & Security</h4>
                                    <p>Charisma uses decentralized price oracles to ensure accurate, tamper-resistant price data. All orders include automatic post-conditions that guarantee you receive the expected amount of tokens, protecting against malicious execution.</p>
                                </div>
                                
                                <div className="bg-blue-500/[0.08] border border-blue-500/[0.15] rounded-xl p-3 text-blue-400">
                                    <h4 className="font-medium mb-1">💡 Pro Tip</h4>
                                    <p className="text-xs">Combine multiple limit orders at different price levels to automate your entire trading strategy. This helps you catch both unexpected dips and profit-taking opportunities.</p>
                                </div>
                                
                                <div className="bg-yellow-500/[0.08] border border-yellow-500/[0.15] rounded-xl p-3 text-yellow-400">
                                    <h4 className="font-medium mb-1">⚠️ Important</h4>
                                    <p className="text-xs">Limit orders require tokens with subnet support for cross-chain execution. Orders are filled at the next available price once your condition is met, which may differ slightly from your exact target due to market movements.</p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                {selectedToken && (
                    <button
                        type="button"
                        onClick={() => setShowChart(!showChart)}
                        className="flex items-center space-x-2 text-xs text-white/60 hover:text-white/90 transition-all duration-200"
                        title={showChart ? 'Hide price chart' : 'Show price chart'}
                    >
                        <span>{showChart ? 'Hide Chart' : 'Show Chart'}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showChart ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

                {/* Unified Condition Control Bar */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 sm:p-4 backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-center gap-3 sm:gap-4">
                        
                        {/* Token Selection */}
                        <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                            <div className="min-w-0 flex-1 sm:min-w-[120px] sm:flex-none">
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
                        </div>

                        {/* Condition Direction - Seamless Toggle */}
                        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-center sm:justify-start">
                            <span className="text-sm text-white/70">is</span>
                            <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
                                {[
                                    { key: 'gt', label: '≥', tooltip: 'greater than or equal to' },
                                    { key: 'lt', label: '≤', tooltip: 'less than or equal to' },
                                ].map(({ key, label, tooltip }) => (
                                    <button
                                        key={key}
                                        title={tooltip}
                                        className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                                            conditionDir === key 
                                                ? 'bg-white/[0.1] text-white/95 shadow-sm' 
                                                : 'text-white/60 hover:text-white/80 hover:bg-white/[0.05]'
                                        }`}
                                        onClick={() => setConditionDir(key as 'lt' | 'gt')}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Price Input Section */}
                        <div className="flex-1 min-w-0 w-full sm:w-auto">
                            <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 sm:px-4 py-3 w-full">
                                <input
                                    value={targetPrice}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (/^[0-9]*\.?[0-9]*$/.test(v) || v === '') {
                                            setTargetPrice(v);
                                        }
                                    }}
                                    placeholder="0.00"
                                    className="bg-transparent border-none text-base sm:text-lg font-medium focus:outline-none placeholder:text-white/40 text-white/95 flex-1 min-w-0"
                                />
                                <div className="flex items-center space-x-1 ml-1 sm:ml-2 flex-shrink-0">
                                    <button 
                                        onClick={() => handleBumpPrice(-0.01)} 
                                        className="w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center text-xs font-medium"
                                    >
                                        −
                                    </button>
                                    <button 
                                        onClick={() => handleBumpPrice(0.01)} 
                                        className="w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center text-xs font-medium"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Base Token Selection */}
                        <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                            {(() => {
                                // Build options with synthetic USD first then tokens
                                const options: TokenCacheData[] = [...displayTokens];
                                
                                // Determine currently selected object
                                const selected = baseToken ?? options.find(o => o.contractId === SUSDT_ID) ?? null;

                                return (
                                    <div className="min-w-0 flex-1 sm:min-w-[100px] sm:flex-none">
                                        <TokenDropdown
                                            tokens={options}
                                            selected={selected}
                                            onSelect={(t) => {
                                                if (t.contractId === 'USD') setBaseToken(null);
                                                else setBaseToken(t.contractId === SUSDT_ID ? null : t);
                                            }}
                                        />
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Collapsible chart */}
                {showChart && selectedToken && (
                    <div className="mt-4">
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                    <div className="h-6 w-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path d="M3 3v18h18" />
                                            <path d="m19 9-5 5-4-4-3 3" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-white/90">Condition Chart</span>
                                </div>
                                <div className="text-xs text-white/60 flex-shrink-0">
                                    Target: {targetPrice ? `${targetPrice} ${baseToken?.symbol || 'sUSDT'}` : 'Not set'}
                                </div>
                            </div>
                            <ConditionTokenChartWrapper
                                token={selectedToken}
                                baseToken={baseToken}
                                targetPrice={targetPrice}
                                onTargetPriceChange={setTargetPrice}
                            />
                        </div>
                    </div>
                )}
        </div>
    );
} 