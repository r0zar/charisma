"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Info,
    DollarSign,
    Scale,
    Target,
    Users,
    CheckCircle,
    Shield
} from 'lucide-react';
import { analyzeLpTokenPricing, formatLpPriceAnalysis, type LpTokenPriceAnalysis } from '@/lib/pricing/lp-token-calculator';
import { Vault } from '@/lib/pool-service';

interface LpTokenPriceAnalysisProps {
    vault: Vault;
    prices: Record<string, number>;
    analytics: {
        tvl: number;
        volume24h?: number;
        apy?: number;
        lpHolders?: number;
    };
    className?: string;
}

const PriceComparisonCard = ({
    title,
    value,
    icon,
    tooltip,
    trend
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    tooltip: string;
    trend?: 'up' | 'down' | 'neutral';
}) => (
    <div className="token-card">
        <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex items-center space-x-1">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-3 h-3 text-muted-foreground opacity-60 hover:opacity-100 transition-opacity" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="max-w-xs text-xs">{tooltip}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="text-lg font-bold tracking-tight numeric">{value}</div>
            </div>
            {trend && (
                <div className="flex items-center">
                    {trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-pump" />
                    ) : trend === 'down' ? (
                        <TrendingDown className="w-4 h-4 text-dump" />
                    ) : (
                        <Scale className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            )}
        </div>
    </div>
);

const AssetBreakdownItem = ({
    symbol,
    amount,
    value,
    price
}: {
    symbol: string;
    amount: number;
    value: number;
    price: number;
}) => (
    <div className="flex items-center justify-between py-2 px-3 bg-muted/10 rounded border border-border/20">
        <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {symbol.charAt(0)}
            </div>
            <span className="text-sm font-medium">{symbol}</span>
        </div>
        <div className="text-right">
            <div className="text-sm font-semibold">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
            <div className="text-xs text-muted-foreground">
                {amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} @ ${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </div>
        </div>
    </div>
);

export default function LpTokenPriceAnalysis({ vault, prices, analytics, className = "" }: LpTokenPriceAnalysisProps) {
    // Analyze LP token pricing
    const analysis = React.useMemo(() =>
        analyzeLpTokenPricing(vault, prices),
        [vault, prices]
    );

    const formatted = React.useMemo(() =>
        formatLpPriceAnalysis(analysis),
        [analysis]
    );

    // Don't render if we can't calculate intrinsic value
    if (!analysis.intrinsicValue) {
        return (
            <Card className={`p-6 border border-border/50 ${className}`}>
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">LP Token Pricing</h3>
                        <p className="text-sm text-muted-foreground">Price analysis for liquidity pool tokens</p>
                    </div>
                </div>

                <div className="flex items-center justify-center py-8 text-center">
                    <div className="space-y-2">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">
                            Unable to calculate LP token pricing.<br />
                            Missing price data for underlying assets.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    // Determine the trend for the difference
    const getDifferenceTrend = () => {
        if (!analysis.priceDifference) return 'neutral';
        return analysis.priceDifference > 0 ? 'up' : 'down';
    };

    const getArbitrageStatus = () => {
        if (!analysis.marketPrice) {
            return {
                text: "Not Tradable",
                color: "bg-muted/30 text-muted-foreground border-border"
            };
        }

        if (analysis.isArbitrageOpportunity) {
            return {
                text: "Arbitrage Opportunity",
                color: "bg-warning/10 text-warning border-warning/30"
            };
        }

        return {
            text: "Fairly Priced",
            color: "bg-success/10 text-success border-success/30"
        };
    };

    const arbitrageStatus = getArbitrageStatus();

    return (
        <div className={`glass-card p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                        <Target className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">LP Token Pricing</h3>
                        <p className="text-sm text-muted-foreground">Value derivation and arbitrage analysis</p>
                    </div>
                </div>

                <Badge className={`px-3 py-1.5 font-medium border transition-all ${arbitrageStatus.color}`}>
                    {arbitrageStatus.text}
                </Badge>
            </div>

            {/* COMPARISON LAYER - Top Level Analysis */}
            {analysis.marketPrice && (
                <div className="mb-8">
                    <div className="flex items-center justify-center gap-8 mb-6">
                        {/* Market Price */}
                        <div className="text-center">
                            <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-center gap-1">
                                Market Price
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer hover:bg-muted/10 rounded-full p-1 -m-1">
                                            <Info className="w-3 h-3 text-muted-foreground" />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>Market Price Determination</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <p className="text-sm text-muted-foreground">
                                                The market price represents the external trading price for this LP token, aggregated from multiple price oracle sources.
                                            </p>

                                            <div className="space-y-3">
                                                <div className="text-sm font-medium">Price Oracle System:</div>

                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-start gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">1</div>
                                                        <div>
                                                            <div className="font-medium">Multiple Price Sources</div>
                                                            <div className="text-muted-foreground">Data is fetched from Charisma, STXTools and Kraxel price APIs</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">2</div>
                                                        <div>
                                                            <div className="font-medium">Price Aggregation</div>
                                                            <div className="text-muted-foreground">The default strategy averages prices across all available sources that have data for this token</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">3</div>
                                                        <div>
                                                            <div className="font-medium">Fallback Protection</div>
                                                            <div className="text-muted-foreground">If the primary source fails, secondary sources provide backup data to ensure price availability</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">4</div>
                                                        <div>
                                                            <div className="font-medium">Quality Filtering</div>
                                                            <div className="text-muted-foreground">Only prices with sufficient confidence scores (&gt;0.1) are included in the final calculation</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border-t pt-3">
                                                <div className="text-xs text-muted-foreground">
                                                    <strong>Note:</strong> If this LP token is not tracked by external price oracles, no market price will be available and only the intrinsic value calculation applies.
                                                </div>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="text-2xl font-bold numeric text-foreground">{formatted.marketPrice}</div>
                            <div className="text-xs text-muted-foreground">External Market</div>
                        </div>

                        {/* VS Symbol */}
                        <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center mb-1">
                                <Scale className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="text-xs text-muted-foreground">vs</div>
                        </div>

                        {/* Intrinsic Value */}
                        <div className="text-center">
                            <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center justify-center gap-1">
                                Intrinsic Value
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button className="opacity-60 hover:opacity-100 transition-opacity cursor-pointer hover:bg-muted/10 rounded-full p-1 -m-1">
                                            <Info className="w-3 h-3 text-muted-foreground" />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Intrinsic Value Calculation</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <p className="text-sm text-muted-foreground">
                                                The intrinsic value represents what each LP token is worth based on the underlying assets in the pool.
                                            </p>

                                            {/* Asset Breakdown in Dialog */}
                                            {analysis.assetBreakdown && (
                                                <div className="space-y-3">
                                                    <div className="text-sm font-medium">Underlying Assets (per LP token):</div>

                                                    {/* Asset A */}
                                                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                                                {analysis.assetBreakdown.tokenA.symbol.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm">{analysis.assetBreakdown.tokenA.symbol}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {analysis.assetBreakdown.tokenA.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold numeric">${analysis.assetBreakdown.tokenA.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                                                            <div className="text-xs text-muted-foreground">@ ${analysis.assetBreakdown.tokenA.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                        </div>
                                                    </div>

                                                    {/* Asset B */}
                                                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                                                {analysis.assetBreakdown.tokenB.symbol.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm">{analysis.assetBreakdown.tokenB.symbol}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {analysis.assetBreakdown.tokenB.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold numeric">${analysis.assetBreakdown.tokenB.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                                                            <div className="text-xs text-muted-foreground">@ ${analysis.assetBreakdown.tokenB.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                        </div>
                                                    </div>

                                                    {/* Calculation */}
                                                    <div className="border-t pt-3">
                                                        <div className="text-center text-sm text-muted-foreground mb-2">Calculation:</div>
                                                        <div className="text-center">
                                                            <div className="inline-flex items-center space-x-2 text-sm">
                                                                <span>${analysis.assetBreakdown.tokenA.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                                <span>+</span>
                                                                <span>${analysis.assetBreakdown.tokenB.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                                <span>=</span>
                                                                <span className="font-bold text-primary">{formatted.intrinsicValue}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                            <div className="text-2xl font-bold numeric text-primary">{formatted.intrinsicValue}</div>
                            <div className="text-xs text-muted-foreground">Click info for breakdown</div>
                        </div>
                    </div>

                    {/* Price Difference & Suggestions */}
                    <div className="bg-muted/10 rounded-xl p-4 border border-border/30">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Price Difference */}
                            <div className="text-center">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Price Difference</div>
                                <div className={`text-lg font-bold numeric ${getDifferenceTrend() === 'up' ? 'text-pump' : getDifferenceTrend() === 'down' ? 'text-dump' : 'text-muted-foreground'}`}>
                                    {formatted.priceDifference}
                                </div>
                                <div className="text-xs text-muted-foreground">{formatted.absoluteDifference}</div>
                            </div>

                            {/* Liquidity Action */}
                            <div className="text-center">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Liquidity Strategy</div>
                                <div className={`text-lg font-bold ${analysis.marketPrice < analysis.intrinsicValue ? 'text-dump' : analysis.marketPrice > analysis.intrinsicValue ? 'text-pump' : 'text-muted-foreground'}`}>
                                    {analysis.marketPrice < analysis.intrinsicValue ? 'Remove Liquidity' :
                                        analysis.marketPrice > analysis.intrinsicValue ? 'Add Liquidity' : 'No Action'}
                                </div>
                                <div className="text-xs text-muted-foreground">Profit Strategy</div>
                            </div>

                            {/* Trading Action */}
                            <div className="text-center">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Trading Strategy</div>
                                <div className={`text-lg font-bold ${analysis.marketPrice > analysis.intrinsicValue ? 'text-dump' : analysis.marketPrice < analysis.intrinsicValue ? 'text-pump' : 'text-muted-foreground'}`}>
                                    {analysis.marketPrice > analysis.intrinsicValue ? 'Sell LP Token' :
                                        analysis.marketPrice < analysis.intrinsicValue ? 'Buy LP Token' : 'No Arbitrage'}
                                </div>
                                <div className="text-xs text-muted-foreground">Direct Action</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Explanatory Note */}
            <div className="mt-6 p-4 bg-muted/20 rounded-xl border border-border/30">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong>How it works:</strong> The intrinsic value flows upward from the underlying assets. Each LP token represents a proportional share of the pool's total assets.
                    {analysis.marketPrice ? (
                        " When market price differs from intrinsic value, arbitrage opportunities emerge."
                    ) : (
                        " This LP token is not currently tradable as a standalone token."
                    )}
                </p>
            </div>
        </div>
    );
}