"use client";

import React, { useState, useEffect } from 'react';
import TokenDropdown from '../TokenDropdown';
import { ChevronDown, Info, DollarSign } from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { getTriggerChartProps } from '@/lib/trigger-chart-props';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useOrderConditions } from '@/contexts/order-conditions-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

export default function LimitConditionSection() {
    const [showChart, setShowChart] = useState(true);
    const [shouldBounce, setShouldBounce] = useState(false);
    const [wizardStep, setWizardStep] = useState(0);

    // Check if user has clicked the info button before
    useEffect(() => {
        const hasClickedInfo = localStorage.getItem('limit-condition-info-clicked');
        setShouldBounce(!hasClickedInfo);
    }, []);

    // Handle info button click
    const handleInfoClick = () => {
        localStorage.setItem('limit-condition-info-clicked', 'true');
        setShouldBounce(false);
        setWizardStep(0); // Reset to first step when opening
    };

    // Wizard steps configuration
    const wizardSteps = [
        {
            title: "What are Triggered Swaps?",
            content: "overview"
        },
        {
            title: "Available Trigger Types",
            content: "triggers"
        },
        {
            title: "How Execution Works",
            content: "execution"
        },
        {
            title: "Strategic Benefits & Tips",
            content: "benefits"
        }
    ];

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

    // Chart inputs come from the active trigger mode only
    const chart = getTriggerChartProps({
        hasPriceTrigger, hasRatioTrigger,
        priceTriggerToken, priceTargetPrice, priceDirection,
        ratioTriggerToken, ratioBaseToken, ratioTargetPrice, ratioDirection,
        displayedToToken,
    });
    const selectedToken = chart.token;

    const handleTargetPriceChange = (price: string) => {
        if (hasRatioTrigger) setRatioTargetPrice(price);
        else setPriceTargetPrice(price);
    };

    // Render wizard step content
    const renderWizardContent = () => {
        switch (wizardSteps[wizardStep].content) {
            case "overview":
                return (
                    <div className="space-y-4">
                        <div className="bg-surface-sunken border border-line-soft rounded-xl p-4 space-y-3">
                            <p className="text-ink-body leading-relaxed">
                                Triggered swaps allow you to automate your trading strategy with intelligent execution conditions. Unlike instant swaps that execute immediately, triggered swaps wait patiently until your specified conditions are met, then execute automatically.
                            </p>
                        </div>
                    </div>
                );
            
            case "triggers":
                return (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <div className="bg-accent/[0.05] border border-accent/[0.1] rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                                    <span className="font-medium text-accent-text">Price Trigger</span>
                                </div>
                                <p className="text-xs text-ink-body mb-2">Execute when a token reaches your target price</p>
                                <div className="space-y-1 text-xs text-ink-muted">
                                    <div>• <span className="text-ink-body">vs USD:</span> "when WELSH ≥ $0.05"</div>
                                    <div>• <span className="text-ink-body">vs Token:</span> "when WELSH ≥ 0.05 sUSDT"</div>
                                </div>
                            </div>

                            <div className="bg-success/[0.05] border border-success/[0.1] rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-success"></div>
                                    <span className="font-medium text-success">Time Trigger</span>
                                </div>
                                <p className="text-xs text-ink-body mb-2">Execute orders at specific times or within time windows</p>
                                <div className="space-y-1 text-xs text-ink-muted">
                                    <div>• <span className="text-ink-body">DCA Strategy:</span> "execute every hour/day for dollar-cost averaging"</div>
                                    <div>• <span className="text-ink-body">Pool Splitting:</span> "execute every 2-5 minutes across multiple pools"</div>
                                    <div>• <span className="text-ink-body">Scheduled:</span> "execute at 9:00 AM daily for optimal timing"</div>
                                </div>
                            </div>

                            <div className="bg-accent/[0.05] border border-accent/[0.1] rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-accent"></div>
                                    <span className="font-medium text-accent-text">Manual Execution</span>
                                </div>
                                <p className="text-xs text-ink-body mb-2">Orders with no triggers - executed manually or via API</p>
                                <div className="space-y-1 text-xs text-ink-muted">
                                    <div>• <span className="text-ink-body">API Control:</span> "execute via API calls with authentication"</div>
                                    <div>• <span className="text-ink-body">Custom Oracles:</span> "developers create unique automation triggers"</div>
                                    <div>• <span className="text-ink-body">Manual Trading:</span> "execute orders on-demand when ready"</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            
            case "execution":
                return (
                    <div className="space-y-4">
                        <div className="bg-surface-sunken border border-line-soft rounded-xl p-4 space-y-3">
                            <p className="text-ink-body leading-relaxed">
                                Triggered swaps operate on Charisma's Blaze subnets, which require subnet tokens as the input currency. To use triggered swaps, simply swap your regular Stacks tokens into subnet tokens using our standard swap feature first.
                            </p>
                            <p className="text-ink-body leading-relaxed">
                                Once you have subnet tokens, Charisma's decentralized price oracles continuously monitor market conditions. When your trigger conditions are met, orders are automatically executed on the subnet with built-in security guarantees and then bridged back to the main Stacks chain.
                            </p>
                        </div>
                        
                        <div className="bg-warning/[0.08] border border-warning/[0.15] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">⚠️</span>
                                <h4 className="font-medium text-warning">Important Notes</h4>
                            </div>
                            <div className="space-y-2 text-xs text-warning">
                                <p>• Execution occurs at next available market price after trigger activation</p>
                                <p>• All orders include automatic slippage protection and post-conditions</p>
                                <p>• Price oracles provide tamper-resistant, decentralized market data</p>
                            </div>
                        </div>
                    </div>
                );
            
            case "benefits":
                return (
                    <div className="space-y-4">
                        <div className="bg-surface-sunken border border-line-soft rounded-xl p-4 space-y-3">
                            <h4 className="font-semibold text-ink">Strategic Benefits</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                                        <span className="font-medium text-ink">Buy the Dip</span>
                                    </div>
                                    <p className="text-xs text-ink-body pl-3.5">Automatically purchase when prices drop to your target</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                                        <span className="font-medium text-ink">Take Profits</span>
                                    </div>
                                    <p className="text-xs text-ink-body pl-3.5">Sell automatically when reaching profit targets</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blaze"></div>
                                        <span className="font-medium text-ink">24/7 Monitoring</span>
                                    </div>
                                    <p className="text-xs text-ink-body pl-3.5">Swaps execute around the clock without supervision</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="w-1.5 h-1.5 rounded-full bg-warning"></div>
                                        <span className="font-medium text-ink">Disciplined Trading</span>
                                    </div>
                                    <p className="text-xs text-ink-body pl-3.5">Stick to strategy, avoid emotional decisions</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-accent/[0.08] border border-accent/[0.15] rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">💡</span>
                                <h4 className="font-medium text-accent-text">Pro Strategy</h4>
                            </div>
                            <p className="text-xs text-accent-text leading-relaxed">
                                Layer multiple triggered swaps at different price levels to create a comprehensive trading ladder. This approach helps you systematically capture both market dips and profit opportunities while maintaining disciplined risk management.
                            </p>
                        </div>
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-ink">Swap Triggers</h3>
                    <Dialog>
                        <DialogTrigger asChild>
                            <button
                                onClick={handleInfoClick}
                                className={`cursor-pointer h-5 w-5 rounded-full bg-surface hover:bg-surface-selected text-ink-muted hover:text-ink transition-all duration-200 flex items-center justify-center ${shouldBounce ? 'animate-bounce' : ''}`}
                            >
                                <Info className="w-3 h-3" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-background border border-border backdrop-blur-xl">
                            <DialogHeader className="space-y-3">
                                <DialogTitle className="text-xl font-semibold text-ink">
                                    {wizardSteps[wizardStep].title}
                                </DialogTitle>
                                
                                {/* Step Indicator */}
                                <div className="flex items-center justify-center space-x-2">
                                    {wizardSteps.map((_, index) => (
                                        <div
                                            key={index}
                                            className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                                index === wizardStep
                                                    ? 'bg-accent w-6'
                                                    : index < wizardStep
                                                    ? 'bg-accent/60'
                                                    : 'bg-surface-selected'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </DialogHeader>

                            <div className="text-sm text-ink-body min-h-[300px]">
                                {renderWizardContent()}
                            </div>

                            {/* Navigation Controls */}
                            <div className="flex items-center justify-between pt-4 border-t border-line-soft">
                                <button
                                    onClick={() => setWizardStep(Math.max(0, wizardStep - 1))}
                                    disabled={wizardStep === 0}
                                    className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                
                                <span className="text-xs text-ink-muted">
                                    {wizardStep + 1} of {wizardSteps.length}
                                </span>
                                
                                <button
                                    onClick={() => setWizardStep(Math.min(wizardSteps.length - 1, wizardStep + 1))}
                                    disabled={wizardStep === wizardSteps.length - 1}
                                    className="px-4 py-2 text-sm font-medium bg-accent/20 text-accent-text hover:bg-accent/30 hover:text-accent-text disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200"
                                >
                                    {wizardStep === wizardSteps.length - 1 ? 'Done' : 'Next'}
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                {selectedToken && !isManualOrder && (priceTriggerToken || ratioTriggerToken) && (
                    <button
                        type="button"
                        onClick={() => setShowChart(!showChart)}
                        className="flex items-center space-x-2 text-xs text-ink-muted hover:text-ink transition-all duration-200"
                        title={showChart ? 'Hide price chart' : 'Show price chart'}
                    >
                        <span>{showChart ? 'Hide Chart' : 'Show Chart'}</span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showChart ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* Trigger Toggles */}
            <div className="mb-3 space-y-2">
                <p className="text-xs text-ink-muted">Enable one or more triggers. Orders with no triggers are executed manually via API.</p>

                {/* Price and Time Trigger Toggles - Side by Side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Unified Price Trigger Toggle */}
                    <div className={`bg-surface-sunken border border-line-soft rounded-lg p-2.5 cursor-pointer transition-all duration-200 hover:bg-surface ${(hasPriceTrigger || hasRatioTrigger) ? 'ring-1 ring-accent/20' : ''
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
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center space-x-2.5">
                                <div className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${(hasPriceTrigger || hasRatioTrigger)
                                    ? 'bg-accent border-accent text-on-accent'
                                    : 'border-line-strong'
                                    }`}>
                                    {(hasPriceTrigger || hasRatioTrigger) && (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-ink">Price Trigger</span>
                                    <p className="text-xs text-ink-muted">Execute when price target is reached</p>
                                </div>
                            </div>
                        </div>

                        {/* Trigger Summary Display */}
                        {hasPriceTrigger && getPriceTriggerDisplay() && (
                            <div className="text-xs text-accent-text bg-accent/[0.08] border border-accent/[0.15] rounded px-2 py-1">
                                {getPriceTriggerDisplay()}
                            </div>
                        )}
                        {hasRatioTrigger && getRatioTriggerDisplay() && (
                            <div className="text-xs text-accent-text bg-accent/[0.08] border border-accent/[0.15] rounded px-2 py-1">
                                {getRatioTriggerDisplay()}
                            </div>
                        )}

                    </div>

                    {/* Time Trigger Toggle */}
                    <div className={`bg-surface-sunken border border-line-soft rounded-lg p-2.5 cursor-pointer transition-all duration-200 hover:bg-surface ${hasTimeTrigger ? 'ring-1 ring-success/20' : ''
                        }`}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const currentTimeTrigger = hasTimeTrigger;
                            const newState = !currentTimeTrigger;

                            if (newState) {
                                // Enabling Time trigger - just enable it, don't affect other triggers
                                setHasTimeTrigger(true);

                                // Default start time to current time if not already set
                                if (!timeStartTime) {
                                    const now = new Date();
                                    setTimeStartTime(now.toISOString());
                                }
                            } else {
                                // Disabling Time trigger - only clear time-related fields
                                setHasTimeTrigger(false);
                                setTimeStartTime('');
                                setTimeEndTime('');
                            }
                        }}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center space-x-2.5">
                                <div className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${hasTimeTrigger
                                    ? 'bg-success-fill border-success text-on-fill'
                                    : 'border-line-strong'
                                    }`}>
                                    {hasTimeTrigger && (
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-ink">Time Trigger</span>
                                    <p className="text-xs text-ink-muted">Execute orders at specific times or time ranges</p>
                                </div>
                            </div>
                        </div>
                        {hasTimeTrigger && getTimeTriggerDisplay() && (
                            <div className="text-xs text-success bg-success/[0.08] border border-success/[0.15] rounded px-2 py-1">
                                {getTimeTriggerDisplay()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Manual Order Status */}
                {isManualOrder && (
                    <div className="bg-surface-sunken border border-line-soft rounded-xl p-3">
                        <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 rounded border border-accent bg-accent text-on-accent flex items-center justify-center">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-accent-text">Manual Execution Order</span>
                                <p className="text-xs text-ink-muted">This order will be executed via API when you choose</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Unified Trigger Control Bar */}
            <div className="bg-surface-sunken border border-line-soft rounded-xl p-3 backdrop-blur-sm">

                {/* Manual Order Description - Only show when no triggers are enabled */}
                {isManualOrder && (
                    <div className="mb-3">
                        <label className="text-xs text-ink-muted mb-1 block">Description (Optional)</label>
                        <textarea
                            value={manualDescription}
                            onChange={(e) => setManualDescription(e.target.value)}
                            placeholder="Describe when you want to execute this order..."
                            className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong resize-none"
                            rows={2}
                            maxLength={500}
                        />
                        <div className="text-xs text-ink-muted mt-1">
                            Manual orders are executed via API calls and require authentication
                        </div>
                    </div>
                )}

                {/* Unified Price Trigger Configuration */}
                {(hasPriceTrigger || hasRatioTrigger) && (
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-medium text-accent-text">
                                Price Trigger Configuration
                            </h5>
                            {/* Mode Switcher - moved here from below */}
                            <div className="flex items-center bg-surface border border-line rounded-lg p-0.5">
                                <button
                                    className={`px-2 py-1 text-xs font-medium rounded transition-all duration-200 ${hasPriceTrigger
                                        ? 'bg-surface-hover text-ink shadow-sm'
                                        : 'text-ink-muted hover:text-ink-body'
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
                                        ? 'bg-surface-hover text-ink shadow-sm'
                                        : 'text-ink-muted hover:text-ink-body'
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
                        <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap lg:items-center gap-2 sm:gap-3">

                            {/* Token Selection */}
                            <div className="flex items-center space-x-2 min-w-0 w-full sm:w-auto">
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
                            <div className="flex items-center space-x-2 w-full sm:w-auto justify-center sm:justify-start">
                                <span className="text-sm text-ink-body">is</span>
                                <div className="flex items-center bg-surface border border-line rounded-lg p-1">
                                    {[
                                        { key: 'gt', label: '≥', tooltip: 'greater than or equal to' },
                                        { key: 'lt', label: '≤', tooltip: 'less than or equal to' },
                                    ].map(({ key, label, tooltip }) => (
                                        <button
                                            key={key}
                                            title={tooltip}
                                            className={`px-2 py-1.5 text-sm font-medium rounded transition-all duration-200 ${(hasPriceTrigger ? priceDirection : ratioDirection) === key
                                                ? 'bg-surface-hover text-ink shadow-sm'
                                                : 'text-ink-muted hover:text-ink-body hover:bg-surface-hover'
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
                                <div className="flex items-center bg-surface border border-line rounded-lg px-3 py-2.5 w-full">
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
                                        className="bg-transparent border-none text-base font-medium focus:outline-none placeholder:text-ink-muted text-ink flex-1 min-w-0"
                                    />
                                    {/* +/- buttons - only show on large screens */}
                                    <div className="hidden lg:flex items-center space-x-1 ml-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleBumpPrice(-0.01)}
                                            className="w-6 h-6 rounded-md bg-surface hover:bg-surface-selected text-ink-muted hover:text-ink transition-all duration-200 flex items-center justify-center text-xs font-medium"
                                        >
                                            −
                                        </button>
                                        <button
                                            onClick={() => handleBumpPrice(0.01)}
                                            className="w-6 h-6 rounded-md bg-surface hover:bg-surface-selected text-ink-muted hover:text-ink transition-all duration-200 flex items-center justify-center text-xs font-medium"
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
                                                <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                                                    <DollarSign className="w-4 h-4 text-success" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-semibold text-ink text-sm">Dollars</div>
                                                    <div className="text-xs text-ink-muted">USD</div>
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
                        <h5 className="text-sm font-medium text-success mb-3">Time Trigger Configuration</h5>

                        {/* Time inputs - side by side on larger screens */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Start Time */}
                            <div>
                                <label className="text-xs text-ink-muted mb-2 block">Start Time (Optional)</label>
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
                                        className="flex-1 bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong"
                                    />
                                    <button
                                        onClick={() => setTimeStartTime('')}
                                        className="p-2 text-ink-muted hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition-all duration-200"
                                        title="Clear start time"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-xs text-ink-muted mt-1">
                                    Leave empty to execute immediately.
                                </p>
                            </div>

                            {/* End Time */}
                            <div>
                                <label className="text-xs text-ink-muted mb-2 block">End Time (Optional)</label>
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
                                        className="flex-1 bg-surface border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-line-strong"
                                    />
                                    <button
                                        onClick={() => setTimeEndTime('')}
                                        className="p-2 text-ink-muted hover:text-ink bg-surface hover:bg-surface-hover border border-line rounded-lg transition-all duration-200"
                                        title="Clear end time"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-xs text-ink-muted mt-1">
                                    Leave empty to run until manually stopped.
                                </p>
                            </div>
                        </div>

                        {/* Shared help text */}
                        <div className="mt-3 pt-3 border-t border-line-soft">
                            <p className="text-xs text-ink-muted">
                                Use Split Swap to divide large orders into smaller parts over time with custom intervals.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Collapsible chart - only show for triggers with price targets and selected tokens */}
            {showChart && selectedToken && !isManualOrder && (priceTriggerToken || ratioTriggerToken) && (
                <div className="mt-4">
                    <div className="bg-surface-sunken border border-line-soft rounded-xl p-3 sm:p-4 backdrop-blur-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <div className="h-6 w-6 rounded-lg bg-blaze/20 text-blaze flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path d="M3 3v18h18" />
                                        <path d="m19 9-5 5-4-4-3 3" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium text-ink">Trigger Chart</span>
                            </div>
                            <div className="text-xs text-ink-muted flex-shrink-0">
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
                            token={chart.token}
                            baseToken={chart.baseToken}
                            targetPrice={chart.targetPrice}
                            direction={chart.direction}
                            onTargetPriceChange={handleTargetPriceChange}
                        />
                    </div>
                </div>
            )}
        </div>
    );
} 