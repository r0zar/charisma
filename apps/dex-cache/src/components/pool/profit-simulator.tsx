'use client';

import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, DollarSign, Calendar, Wallet } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddLiquidityModal } from './add-liquidity-modal';
import { ClientDisplayVault } from './vault-detail-client';

interface ProfitSimulatorProps {
    apy: number; // Annual percentage yield from APY simulator
    vault: ClientDisplayVault;
    prices: Record<string, number>;
}

const formatNumber = (num: number, type: 'currency' | 'percent' | 'decimal' = 'decimal') => {
    if (type === 'currency') {
        if (num < 1000) return `$${num.toFixed(2)}`;
        if (num < 1000000) return `$${(num / 1000).toFixed(1)}K`;
        return `$${(num / 1000000).toFixed(1)}M`;
    }
    if (type === 'percent') {
        return `${num.toFixed(2)}%`;
    }
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function ProfitSimulator({ apy, vault, prices }: ProfitSimulatorProps) {
    const [investmentAmount, setInvestmentAmount] = useState<string>('1000');

    const results = useMemo(() => {
        const amount = parseFloat(investmentAmount) || 0;
        const dailyRate = apy / 365 / 100; // Convert APY to daily rate
        const monthlyReturn = amount * (Math.pow(1 + dailyRate, 30) - 1); // 30-day compound return
        const monthlyPercentage = (monthlyReturn / amount) * 100;

        return {
            investmentAmount: amount,
            monthlyReturn,
            monthlyPercentage,
            finalAmount: amount + monthlyReturn
        };
    }, [investmentAmount, apy]);

    const handleInvestmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9.]/g, ''); // Only allow numbers and decimal
        setInvestmentAmount(value);
    };

    return (
        <Card className="overflow-hidden border border-border/50 bg-card h-fit">
            <div className="flex items-stretch">
                <div className="bg-muted/30 p-4 flex items-center justify-center border-r border-border/50">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <Calendar className="w-8 h-8 text-primary" />
                    </div>
                </div>

                <div className="flex-grow p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-semibold text-lg leading-tight">30-Day Profit</h3>
                            <div className="text-sm text-muted-foreground flex items-center mt-0.5">
                                <span className="mr-2 text-xs">Based on {apy.toFixed(2)}% APY</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <TrendingUp className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                            <p className="text-xs">30-day profit projection using compound returns</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-bold text-lg text-green-600">
                                +{formatNumber(results.monthlyReturn, 'currency')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                30-day profit
                            </div>
                        </div>
                    </div>

                    {/* Investment Amount Input */}
                    <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Investment Amount</div>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="text"
                                value={investmentAmount}
                                onChange={handleInvestmentChange}
                                placeholder="1000"
                                className="pl-8 text-sm"
                            />
                        </div>
                    </div>

                    {/* Results */}
                    <div className="space-y-2 text-xs mb-3">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                                <span>Initial Investment:</span>
                            </div>
                            <div className="font-medium">{formatNumber(results.investmentAmount, 'currency')}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                                <span>30-Day Return:</span>
                            </div>
                            <div className="font-medium text-green-600">
                                +{formatNumber(results.monthlyReturn, 'currency')} ({results.monthlyPercentage.toFixed(2)}%)
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <Wallet className="w-3.5 h-3.5 mr-1.5" />
                                <span>Total After 30 Days:</span>
                            </div>
                            <div className="font-medium text-primary">{formatNumber(results.finalAmount, 'currency')}</div>
                        </div>
                    </div>

                    {/* Invest Button with Modal */}
                    <AddLiquidityModal
                        vault={vault}
                        prices={prices}
                        trigger={
                            <Button
                                disabled={results.investmentAmount <= 0}
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                                size="sm"
                            >
                                <Wallet className="w-4 h-4 mr-2" />
                                Invest {formatNumber(results.investmentAmount, 'currency')}
                            </Button>
                        }
                    />

                    {/* Risk Notice */}
                    <div className="mt-3 p-2 bg-muted/20 rounded text-xs text-muted-foreground">
                        <strong>Projection only.</strong> Actual returns depend on trading volume and market conditions.
                        Past performance doesn't guarantee future results.
                    </div>
                </div>
            </div>
        </Card>
    );
} 