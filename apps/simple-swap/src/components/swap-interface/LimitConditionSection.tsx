"use client";

import React, { useState, useCallback } from 'react';
import TokenDropdown from '../TokenDropdown';
import { ChevronDown, Info, DollarSign } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@repo/tokens';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useOrderConditions } from '@/contexts/order-conditions-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

export default function LimitConditionSection() {
    const [showChart, setShowChart] = useState(true);

    // Format price using significant digits based on token unit basis
    const formatPrice = (price: string): string => {
        const num = parseFloat(price);
        if (isNaN(num)) return price;
        if (num === 0) return '0';

        // Use 4-5 significant digits, but ensure we show meaningful precision
        const magnitude = Math.floor(Math.log10(Math.abs(num)));

        if (num >= 1) {
            // For values >= 1, show 2-4 decimal places max
            return num.toFixed(Math.min(4, Math.max(2, 4 - magnitude)));
        } else {
            // For values < 1, ensure we show at least 4 significant digits
            const significantDigits = 4;
            const decimalPlaces = significantDigits - magnitude - 1;
            return num.toFixed(Math.min(8, Math.max(2, decimalPlaces)));
        }
    };

    // Get token data from swap context
    const { displayTokens, displayedToToken, selectedFromToken, selectedToToken } = useSwapTokens();

    // Get trigger state from order conditions context
    const {
        hasPriceTrigger,
        priceTriggerToken,
        priceTargetPrice,
        priceDirection,

        hasRatioTrigger,
        ratioTriggerToken,
        ratioBaseToken,
        ratioTargetPrice,
        ratioDirection,

        hasTimeTrigger,
        timeStartTime,
        timeEndTime,

        manualDescription,
        isManualOrder,

        setHasPriceTrigger,
        setPriceTriggerToken,
        setPriceTargetPrice,
        setPriceDirection,

        setHasRatioTrigger,
        setRatioTriggerToken,
        setRatioBaseToken,
        setRatioTargetPrice,
        setRatioDirection,

        setHasTimeTrigger,
        setTimeStartTime,
        setTimeEndTime,

        setManualDescription,
        handleBumpPrice,
        resetTriggers,
        getPriceTriggerDisplay,
        getRatioTriggerDisplay,
        getTimeTriggerDisplay,
    } = useOrderConditions();

    // Determine the primary token for chart display - prefer price trigger token, then ratio, then default
    const selectedToken = priceTriggerToken || ratioTriggerToken || displayedToToken;

    // Stable callback for chart price changes to prevent chart reinitialization
    const handleTargetPriceChange = useCallback((price: string) => {
        if (hasPriceTrigger) setPriceTargetPrice(price);
        if (hasRatioTrigger) setRatioTargetPrice(price);
    }, [hasPriceTrigger, hasRatioTrigger, setPriceTargetPrice, setRatioTargetPrice]);

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-white/95">Swap Triggers</h3>
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="h-5 w-5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white/90 transition-all duration-200 flex items-center justify-center">
                                <Info className="w-3 h-3" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-background border border-border backdrop-blur-xl">
                            <DialogHeader className="space-y-3">
                                <DialogTitle className="text-xl font-semibold text-white/95">
                                    How Triggered Swaps Work
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-6 text-sm text-white/80">
                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
                                    <h4 className="font-semibold text-white/95">What are Triggered Swaps?</h4>
                                    <p className="text-white/70 leading-relaxed">
                                        Triggered swaps allow you to automate your trading strategy with intelligent execution conditions. Unlike instant swaps that execute immediately, triggered swaps wait patiently until your specified conditions are met, then execute automatically.
                                    </p>
                                </div>

                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-4">
                                    <h4 className="font-semibold text-white/95">Available Trigger Types</h4>
                                    <div className="space-y-3">
                                        <div className="bg-blue-500/[0.05] border border-blue-500/[0.1] rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                <span className="font-medium text-blue-400">Price Trigger</span>
                                            </div>
                                            <p className="text-xs text-white/70 mb-2">Execute when a token reaches your target price</p>
                                            <div className="space-y-1 text-xs text-white/60">
                                                <div>• <span className="text-white/80">vs USD:</span> "when WELSH ≥ $0.05"</div>
                                                <div>• <span className="text-white/80">vs Token:</span> "when WELSH ≥ 0.05 sUSDT"</div>
                                            </div>
                                        </div>

                                        <div className="bg-green-500/[0.05] border border-green-500/[0.1] rounded-lg p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                                <span className="font-medium text-green-400">Time Trigger</span>
                                            </div>
                                            <p className="text-xs text-white/70">Execute orders at specific times or within time windows</p>
                                        </div>

                                    </div>
                                </div>

                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
                                    <h4 className="font-semibold text-white/95">How Execution Works</h4>
                                    <p className="text-white/70 leading-relaxed">
                                        Charisma's decentralized price oracles continuously monitor market conditions. When your trigger conditions are met, orders are automatically submitted to the Stacks blockchain with built-in security guarantees.
                                    </p>
                                </div>

                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
                                    <h4 className="font-semibold text-white/95">Strategic Benefits</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                                <span className="font-medium text-white/90">Buy the Dip</span>
                                            </div>
                                            <p className="text-xs text-white/70 pl-3.5">Automatically purchase when prices drop to your target</p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                                                <span className="font-medium text-white/90">Take Profits</span>
                                            </div>
                                            <p className="text-xs text-white/70 pl-3.5">Sell automatically when reaching profit targets</p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div>
                                                <span className="font-medium text-white/90">24/7 Monitoring</span>
                                            </div>
                                            <p className="text-xs text-white/70 pl-3.5">Swaps execute around the clock without supervision</p>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                                <span className="font-medium text-white/90">Disciplined Trading</span>
                                            </div>
                                            <p className="text-xs text-white/70 pl-3.5">Stick to strategy, avoid emotional decisions</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-500/[0.08] border border-blue-500/[0.15] rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">💡</span>
                                        <h4 className="font-medium text-blue-400">Pro Strategy</h4>
                                    </div>
                                    <p className="text-xs text-blue-300 leading-relaxed">
                                        Layer multiple triggered swaps at different price levels to create a comprehensive trading ladder. This approach helps you systematically capture both market dips and profit opportunities while maintaining disciplined risk management.
                                    </p>
                                </div>

                                <div className="bg-amber-500/[0.08] border border-amber-500/[0.15] rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-lg">⚠️</span>
                                        <h4 className="font-medium text-amber-400">Important Notes</h4>
                                    </div>
                                    <div className="space-y-2 text-xs text-amber-300">
                                        <p>• Execution occurs at next available market price after trigger activation</p>
                                        <p>• All orders include automatic slippage protection and post-conditions</p>
                                        <p>• Price oracles provide tamper-resistant, decentralized market data</p>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                {selectedToken && !isManualOrder && (priceTriggerToken || ratioTriggerToken) && (
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

            {/* Trigger Toggles */}
            <div className="mb-4 space-y-3">
                <p className="text-xs text-white/60">Enable one or more triggers. Orders with no triggers are executed manually via API.</p>

                {/* Price and Time Trigger Toggles - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Unified Price Trigger Toggle */}
                    <div className={`bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 cursor-pointer transition-all duration-200 hover:bg-white/[0.03] ${(hasPriceTrigger || hasRatioTrigger) ? 'ring-1 ring-blue-500/20' : ''
                        }`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const currentPriceEnabled = hasPriceTrigger || hasRatioTrigger;

                            if (currentPriceEnabled) {
                                // Disabling price triggers - clear all price-related fields
                                setHasPriceTrigger(false);
                                setHasRatioTrigger(false);
                                setPriceTriggerToken(null);
                                setPriceTargetPrice('');
                                setRatioTriggerToken(null);
                                setRatioBaseToken(null);
                                setRatioTargetPrice('');
                            } else {
                                // Enabling price trigger - just enable it, don't affect other triggers
                                setHasPriceTrigger(true);
                            }
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                                <div className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${(hasPriceTrigger || hasRatioTrigger)
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'border-white/[0.15]'
                                    }`}>
                                    {(hasPriceTrigger || hasRatioTrigger) && (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-white/90">Price Trigger</span>
                                    <p className="text-xs text-white/60">Execute when price target is reached</p>
                                </div>
                            </div>
                        </div>

                        {/* Trigger Summary Display */}
                        {hasPriceTrigger && getPriceTriggerDisplay() && (
                            <div className="text-xs text-blue-400 bg-blue-500/[0.08] border border-blue-500/[0.15] rounded px-2 py-1 mb-2">
                                {getPriceTriggerDisplay()}
                            </div>
                        )}
                        {hasRatioTrigger && getRatioTriggerDisplay() && (
                            <div className="text-xs text-blue-400 bg-blue-500/[0.08] border border-blue-500/[0.15] rounded px-2 py-1 mb-2">
                                {getRatioTriggerDisplay()}
                            </div>
                        )}

                    </div>

                    {/* Time Trigger Toggle */}
                    <div className={`bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 cursor-pointer transition-all duration-200 hover:bg-white/[0.03] ${hasTimeTrigger ? 'ring-1 ring-green-500/20' : ''
                        }`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const currentTimeTrigger = hasTimeTrigger;
                            const newState = !currentTimeTrigger;

                            if (newState) {
                                // Enabling Time trigger - just enable it, don't affect other triggers
                                setHasTimeTrigger(true);
                            } else {
                                // Disabling Time trigger - only clear time-related fields
                                setHasTimeTrigger(false);
                                setTimeStartTime('');
                                setTimeEndTime('');
                            }
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                                <div className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${hasTimeTrigger
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-white/[0.15]'
                                    }`}>
                                    {hasTimeTrigger && (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-white/90">Time Trigger</span>
                                    <p className="text-xs text-white/60">Execute orders at specific times or time ranges</p>
                                </div>
                            </div>
                        </div>
                        {hasTimeTrigger && getTimeTriggerDisplay() && (
                            <div className="text-xs text-green-400 bg-green-500/[0.08] border border-green-500/[0.15] rounded px-2 py-1">
                                {getTimeTriggerDisplay()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Manual Order Status */}
                {isManualOrder && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                        <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 rounded border border-orange-500 bg-orange-500 text-white flex items-center justify-center">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-orange-400">Manual Execution Order</span>
                                <p className="text-xs text-white/60">This order will be executed via API when you choose</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Unified Trigger Control Bar */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3 sm:p-4 backdrop-blur-sm">

                {/* Manual Order Description - Only show when no triggers are enabled */}
                {isManualOrder && (
                    <div className="mb-4">
                        <label className="text-xs text-white/60 mb-1 block">Description (Optional)</label>
                        <textarea
                            value={manualDescription}
                            onChange={(e) => setManualDescription(e.target.value)}
                            placeholder="Describe when you want to execute this order..."
                            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/[0.15] resize-none"
                            rows={2}
                            maxLength={500}
                        />
                        <div className="text-xs text-white/40 mt-1">
                            Manual orders are executed via API calls and require authentication
                        </div>
                    </div>
                )}

                {/* Unified Price Trigger Configuration */}
                {(hasPriceTrigger || hasRatioTrigger) && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-3">
                            <h5 className="text-sm font-medium text-blue-400">
                                Price Trigger Configuration
                            </h5>
                            {/* Mode Switcher - moved here from below */}
                            <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
                                <button
                                    className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${hasPriceTrigger
                                        ? 'bg-white/[0.1] text-white/95 shadow-sm'
                                        : 'text-white/60 hover:text-white/80'
                                        }`}
                                    onClick={() => {
                                        setHasPriceTrigger(true);
                                        setHasRatioTrigger(false);

                                        // Auto-populate with swap token if available and not already set
                                        if (!priceTriggerToken && selectedToToken) {
                                            setPriceTriggerToken(selectedToToken);
                                        }
                                    }}
                                >
                                    vs USD
                                </button>
                                <button
                                    className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${hasRatioTrigger
                                        ? 'bg-white/[0.1] text-white/95 shadow-sm'
                                        : 'text-white/60 hover:text-white/80'
                                        }`}
                                    onClick={() => {
                                        setHasPriceTrigger(false);
                                        setHasRatioTrigger(true);

                                        // Auto-populate with swap tokens if available and not already set
                                        if (!ratioTriggerToken && selectedToToken) {
                                            setRatioTriggerToken(selectedToToken);
                                        }
                                        if (!ratioBaseToken && selectedFromToken) {
                                            setRatioBaseToken(selectedFromToken);
                                        }
                                    }}
                                >
                                    vs Token
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-center gap-3 sm:gap-4">

                            {/* Token Selection */}
                            <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                                <div className="min-w-0 flex-1 sm:min-w-[120px] sm:flex-none">
                                    <TokenDropdown
                                        tokens={displayTokens}
                                        selected={hasPriceTrigger ? priceTriggerToken : ratioTriggerToken}
                                        onSelect={(t) => {
                                            if (hasPriceTrigger) {
                                                setPriceTriggerToken(t);
                                            } else {
                                                setRatioTriggerToken(t);
                                            }
                                        }}
                                        label=""
                                        suppressFlame={true}
                                    />
                                </div>
                            </div>

                            {/* Condition Direction */}
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
                                            className={`px-2 sm:px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${(hasPriceTrigger ? priceDirection : ratioDirection) === key
                                                ? 'bg-white/[0.1] text-white/95 shadow-sm'
                                                : 'text-white/60 hover:text-white/80 hover:bg-white/[0.05]'
                                                }`}
                                            onClick={() => {
                                                if (hasPriceTrigger) {
                                                    setPriceDirection(key as 'lt' | 'gt');
                                                } else {
                                                    setRatioDirection(key as 'lt' | 'gt');
                                                }
                                            }}
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
                                        value={hasPriceTrigger ? priceTargetPrice : ratioTargetPrice}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (/^[0-9]*\.?[0-9]*$/.test(v) || v === '') {
                                                if (hasPriceTrigger) {
                                                    setPriceTargetPrice(v);
                                                } else {
                                                    setRatioTargetPrice(v);
                                                }
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const v = e.target.value;
                                            if (v && !isNaN(parseFloat(v))) {
                                                const formatted = formatPrice(v);
                                                if (hasPriceTrigger) {
                                                    setPriceTargetPrice(formatted);
                                                } else {
                                                    setRatioTargetPrice(formatted);
                                                }
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

                            {/* Base Token Selection - Only show in ratio mode */}
                            {hasRatioTrigger && (
                                <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                                    {(() => {
                                        const options: TokenCacheData[] = [...displayTokens];
                                        const selected = ratioBaseToken ?? options.find(o => o.contractId.includes('token-susdt')) ?? null;

                                        return (
                                            <div className="min-w-0 flex-1 sm:min-w-[100px] sm:flex-none">
                                                <TokenDropdown
                                                    tokens={options}
                                                    selected={selected}
                                                    onSelect={(t) => {
                                                        setRatioBaseToken(t);
                                                    }}
                                                />
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Unit indicator - styled like token selector button */}
                            {hasPriceTrigger && (
                                <div className="flex items-center space-x-3 min-w-0 w-full sm:w-auto">
                                    <div className="min-w-0 flex-1 sm:min-w-[100px] sm:flex-none">
                                        <div className="group relative w-full flex items-center justify-between p-3 bg-transparent border-none cursor-default rounded-xl">
                                            <div className="flex items-center space-x-3 flex-1">
                                                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                                    <DollarSign className="w-4 h-4 text-green-400" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-semibold text-white/95 text-sm">Dollars</div>
                                                    <div className="text-xs text-white/60">USD</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Time Trigger Configuration */}
                {hasTimeTrigger && (
                    <div className="mb-4">
                        <h5 className="text-sm font-medium text-green-400 mb-3">Time Trigger Configuration</h5>

                        {/* Time inputs - side by side on larger screens */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Start Time */}
                            <div>
                                <label className="text-xs text-white/60 mb-2 block">Start Time (Optional)</label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="datetime-local"
                                        value={timeStartTime ? new Date(timeStartTime).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setTimeStartTime(new Date(e.target.value).toISOString());
                                            } else {
                                                setTimeStartTime('');
                                            }
                                        }}
                                        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/[0.15]"
                                    />
                                    <button
                                        onClick={() => setTimeStartTime('')}
                                        className="px-3 py-2 text-xs text-white/60 hover:text-white/90 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-lg transition-all duration-200"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <p className="text-xs text-white/50 mt-1">
                                    Leave empty to execute immediately.
                                </p>
                            </div>

                            {/* End Time */}
                            <div>
                                <label className="text-xs text-white/60 mb-2 block">End Time (Optional)</label>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="datetime-local"
                                        value={timeEndTime ? new Date(timeEndTime).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setTimeEndTime(new Date(e.target.value).toISOString());
                                            } else {
                                                setTimeEndTime('');
                                            }
                                        }}
                                        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white/90 focus:outline-none focus:border-white/[0.15]"
                                    />
                                    <button
                                        onClick={() => setTimeEndTime('')}
                                        className="px-3 py-2 text-xs text-white/60 hover:text-white/90 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-lg transition-all duration-200"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <p className="text-xs text-white/50 mt-1">
                                    Leave empty to run until manually stopped.
                                </p>
                            </div>
                        </div>

                        {/* Shared help text */}
                        <div className="mt-3 pt-3 border-t border-white/[0.06]">
                            <p className="text-xs text-white/50">
                                Use Split Swap to divide large orders into smaller parts over time with custom intervals.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Collapsible chart - only show for triggers with price targets and selected tokens */}
            {showChart && selectedToken && !isManualOrder && (priceTriggerToken || ratioTriggerToken) && (
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
                                <span className="text-sm font-medium text-white/90">Trigger Chart</span>
                            </div>
                            <div className="text-xs text-white/60 flex-shrink-0">
                                {hasPriceTrigger && priceTargetPrice && (
                                    <span>Price: {formatPrice(priceTargetPrice)} USD</span>
                                )}
                                {hasRatioTrigger && ratioTargetPrice && (
                                    <span>{hasPriceTrigger ? ' | ' : ''}Ratio: {formatPrice(ratioTargetPrice)} {ratioBaseToken?.symbol || 'sUSDT'}</span>
                                )}
                                {(hasPriceTrigger && !priceTargetPrice) && (
                                    <span>Click chart to set target price</span>
                                )}
                                {(hasRatioTrigger && !ratioTargetPrice) && (
                                    <span>Click chart to set target price</span>
                                )}
                                {!hasPriceTrigger && !hasRatioTrigger && (
                                    <span>No triggers set</span>
                                )}
                            </div>
                        </div>
                        <ConditionTokenChartWrapper
                            token={selectedToken}
                            baseToken={ratioBaseToken}
                            targetPrice={priceTargetPrice || ratioTargetPrice}
                            direction={hasPriceTrigger ? priceDirection : ratioDirection}
                            onTargetPriceChange={handleTargetPriceChange}
                        />
                    </div>
                </div>
            )}
        </div>
    );
} 