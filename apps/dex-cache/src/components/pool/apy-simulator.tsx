'use client';

import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Calculator, DollarSign, BarChart3, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface APYSimulatorProps {
    tvl: number;
    feeRate: number; // in basis points (e.g., 300 = 3%)
    tokenASymbol: string;
    tokenBSymbol: string;
    onAPYChange?: (apy: number) => void;
}

interface VolumeScenario {
    name: string;
    multiplier: number;
    description: string;
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

export default function APYSimulator({ tvl, feeRate, tokenASymbol, tokenBSymbol, onAPYChange }: APYSimulatorProps) {
    const [customVolumeMultiplier, setCustomVolumeMultiplier] = useState([1]);
    const [selectedScenario, setSelectedScenario] = useState<string>('moderate');

    // Base daily volume assumption (conservative estimate)
    const baseDailyVolume = Math.max(tvl * 0.01, 100); // 1% of TVL or $100 minimum

    const volumeScenarios: VolumeScenario[] = [
        { name: 'conservative', multiplier: 0.5, description: 'Low' },
        { name: 'moderate', multiplier: 1.0, description: 'Normal' },
        { name: 'optimistic', multiplier: 2.0, description: 'High' },
        { name: 'bullish', multiplier: 5.0, description: 'Very High' }
    ];

    const calculateAPY = (volumeMultiplier: number) => {
        const dailyVolume = baseDailyVolume * volumeMultiplier;
        const dailyFees = dailyVolume * (feeRate / 10000);
        const dailyYield = dailyFees / tvl;
        const apy = (Math.pow(1 + dailyYield, 365) - 1) * 100;

        return {
            dailyVolume,
            dailyFees,
            dailyYield: dailyYield * 100,
            apy: Math.min(apy, 1000)
        };
    };

    const currentMultiplier = selectedScenario === 'custom'
        ? customVolumeMultiplier[0]
        : volumeScenarios.find(s => s.name === selectedScenario)?.multiplier || 1;

    const results = useMemo(() => calculateAPY(currentMultiplier), [currentMultiplier, tvl, feeRate, baseDailyVolume]);

    // Notify parent component of APY changes
    React.useEffect(() => {
        if (onAPYChange) {
            onAPYChange(results.apy);
        }
    }, [results.apy, onAPYChange]);

    return (
        <Card className="overflow-hidden border border-border/50 bg-card h-fit">
            <div className="flex items-stretch">
                <div className="bg-muted/30 p-4 flex items-center justify-center border-r border-border/50">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <Calculator className="w-8 h-8 text-primary" />
                    </div>
                </div>

                <div className="flex-grow p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-semibold text-lg leading-tight">APY Simulator</h3>
                            <div className="text-sm text-muted-foreground flex items-center mt-0.5">
                                <span className="mr-2 text-xs">Pool: {formatNumber(tvl, 'currency')}</span>
                                <span className="mr-2 font-mono bg-muted/50 px-1.5 py-0.5 rounded text-xs">{(feeRate / 100).toFixed(2)}% fee</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                            <p className="text-xs">APY estimates based on trading volume scenarios</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                            <div className="font-bold text-lg text-primary">
                                {formatNumber(results.apy, 'percent')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Est. APY
                            </div>
                        </div>
                    </div>

                    {/* Volume Scenarios */}
                    <div className="mb-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Volume Scenarios</div>
                        <div className="grid grid-cols-4 gap-1">
                            {volumeScenarios.map((scenario) => (
                                <Button
                                    key={scenario.name}
                                    variant={selectedScenario === scenario.name ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setSelectedScenario(scenario.name)}
                                    className="h-auto p-2 text-xs flex flex-col"
                                >
                                    <div className="font-medium capitalize">{scenario.name}</div>
                                    <div className="text-xs opacity-70">{scenario.multiplier}x</div>
                                </Button>
                            ))}
                        </div>

                        {/* Custom Volume Slider */}
                        <Button
                            variant={selectedScenario === 'custom' ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedScenario('custom')}
                            className="w-full text-xs mt-1"
                        >
                            Custom ({selectedScenario === 'custom' ? `${customVolumeMultiplier[0].toFixed(1)}x` : 'Click to adjust'})
                        </Button>

                        {selectedScenario === 'custom' && (
                            <div className="space-y-1 mt-2">
                                <Slider
                                    value={customVolumeMultiplier}
                                    onValueChange={setCustomVolumeMultiplier}
                                    max={10}
                                    min={0.1}
                                    step={0.1}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>0.1x</span>
                                    <span>10x</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results */}
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                                <span>Daily Volume:</span>
                            </div>
                            <div className="font-medium">{formatNumber(results.dailyVolume, 'currency')}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                                <span>Daily Fees:</span>
                            </div>
                            <div className="font-medium text-green-600">{formatNumber(results.dailyFees, 'currency')}</div>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center text-muted-foreground">
                                <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                                <span>Annual Fees:</span>
                            </div>
                            <div className="font-medium">{formatNumber(results.dailyFees * 365, 'currency')}</div>
                        </div>
                    </div>

                    {/* Risk Notice */}
                    <div className="mt-3 p-2 bg-muted/20 rounded text-xs text-muted-foreground">
                        <strong>Base:</strong> {formatNumber(baseDailyVolume, 'currency')}/day ({((baseDailyVolume / tvl) * 100).toFixed(1)}% TVL).
                        Excludes impermanent loss.
                    </div>
                </div>
            </div>
        </Card>
    );
} 