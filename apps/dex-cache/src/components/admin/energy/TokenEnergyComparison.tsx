'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { BarChart3, TrendingUp, Zap, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTokenMetadataCached, type TokenCacheData } from '@repo/tokens';

interface TokenComparison {
    token: TokenCacheData;
    userAmount: number;
    energyPerSecond: number;
    energyPerDay: number;
    estimatedAPY: number;
    timeToMaxCapacity: number;
}

export function TokenEnergyComparison() {
    const [comparisons, setComparisons] = useState<TokenComparison[]>([]);
    const [newTokenAmount, setNewTokenAmount] = useState<string>('1000');
    const [isLoading, setIsLoading] = useState(true);

    // Energy-eligible tokens (in a real app, this would come from vault data)
    const eligibleTokens = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1', // Current required token
    ];

    useEffect(() => {
        loadTokenComparisons();
    }, []);

    const loadTokenComparisons = async () => {
        setIsLoading(true);
        try {
            const tokenMetadata = await Promise.all(
                eligibleTokens.map(contractId => getTokenMetadataCached(contractId))
            );

            const validTokens = tokenMetadata.filter(Boolean) as TokenCacheData[];
            const initialComparisons = validTokens.map(token => 
                calculateTokenEnergyMetrics(token, parseFloat(newTokenAmount) || 1000)
            );

            setComparisons(initialComparisons);
        } catch (error) {
            console.error('Failed to load token comparisons:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const calculateTokenEnergyMetrics = (token: TokenCacheData, amount: number): TokenComparison => {
        // Convert to raw token units
        const decimals = token.decimals || 6;
        const rawAmount = amount * Math.pow(10, decimals);

        // Mock energy calculation based on token characteristics
        // In real implementation, this would call the energize contract
        let baseRate = 0.001; // Base energy per token per second

        // Adjust rate based on token characteristics
        if (token.symbol === 'DEX') {
            baseRate = 0.0015; // Higher rate for the primary token
        }

        const energyPerSecond = rawAmount * baseRate;
        const energyPerDay = energyPerSecond * 86400;

        // Calculate estimated APY
        const energyPerYear = energyPerDay * 365;
        const estimatedAPY = (energyPerYear / rawAmount) * 100 * 0.01; // Mock APY calculation

        // Time to reach max capacity (100 energy)
        const maxCapacity = 100 * Math.pow(10, 6); // Assuming 6 decimals for energy
        const timeToMaxCapacity = energyPerSecond > 0 ? maxCapacity / energyPerSecond : 0;

        return {
            token,
            userAmount: amount,
            energyPerSecond,
            energyPerDay,
            estimatedAPY,
            timeToMaxCapacity
        };
    };

    const updateComparisons = () => {
        const amount = parseFloat(newTokenAmount) || 0;
        const updatedComparisons = comparisons.map(comp => 
            calculateTokenEnergyMetrics(comp.token, amount)
        );
        setComparisons(updatedComparisons);
    };

    const formatEnergy = (value: number): string => {
        const divisor = Math.pow(10, 6); // Assuming 6 decimals for energy
        const adjustedValue = value / divisor;
        
        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: 6,
            minimumFractionDigits: 0
        });
    };

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
        return `${Math.round(seconds / 86400)}d`;
    };

    if (isLoading) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">Loading token comparison...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Token Energy Comparison</h3>
                    <p className="text-sm text-muted-foreground">Compare energy generation across different token amounts</p>
                </div>
            </div>

            {/* Amount Input */}
            <div className="mb-6 flex items-end gap-4">
                <div className="flex-1">
                    <Label htmlFor="comparison-amount" className="text-sm font-medium">
                        Token Amount to Compare
                    </Label>
                    <Input
                        id="comparison-amount"
                        type="number"
                        value={newTokenAmount}
                        onChange={(e) => setNewTokenAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="mt-1"
                        min="0"
                        step="0.000001"
                    />
                </div>
                <Button onClick={updateComparisons} className="button-primary">
                    Update Comparison
                </Button>
            </div>

            {/* Comparison Grid */}
            <div className="space-y-4">
                {comparisons.map((comparison, index) => (
                    <div key={comparison.token.contractId} className="token-card p-4 relative">
                        {/* Primary Token Indicator */}
                        {comparison.token.symbol === 'DEX' && (
                            <div className="absolute top-2 right-2">
                                <Badge variant="default" className="text-xs">
                                    <Zap className="h-3 w-3 mr-1" />
                                    Required
                                </Badge>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                            {/* Token Info */}
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border border-primary/20">
                                    <Image
                                        width={48}
                                        height={48}
                                        src={comparison.token.image || `https://placehold.co/48x48?text=${comparison.token.symbol}`}
                                        alt={comparison.token.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <h4 className="font-semibold">{comparison.token.name}</h4>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            {comparison.token.symbol}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {comparison.userAmount.toLocaleString()} tokens
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Energy Metrics */}
                            <div className="text-center">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Energy/Day</div>
                                <div className="font-mono text-lg">{formatEnergy(comparison.energyPerDay)}</div>
                            </div>

                            <div className="text-center">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Estimated APY</div>
                                <div className="font-bold text-primary text-lg">
                                    {comparison.estimatedAPY.toFixed(2)}%
                                </div>
                            </div>

                            <div className="text-center">
                                <div className="text-sm font-medium text-muted-foreground mb-1">Max Capacity</div>
                                <div className="font-mono">{formatTime(comparison.timeToMaxCapacity)}</div>
                            </div>
                        </div>

                        {/* Detailed Metrics Bar */}
                        <div className="mt-4 pt-4 border-t border-border/30">
                            <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                                <div>
                                    <span className="font-medium">Energy/Second:</span>
                                    <span className="ml-1 font-mono">{formatEnergy(comparison.energyPerSecond)}</span>
                                </div>
                                <div>
                                    <span className="font-medium">Energy/Hour:</span>
                                    <span className="ml-1 font-mono">{formatEnergy(comparison.energyPerSecond * 3600)}</span>
                                </div>
                                <div>
                                    <span className="font-medium">Token Value:</span>
                                    <span className="ml-1 font-mono">{comparison.userAmount.toLocaleString()} {comparison.token.symbol}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Comparison Amounts */}
            <div className="mt-6 pt-4 border-t border-border/30">
                <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Quick comparisons:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['100', '1000', '5000', '10000', '50000', '100000'].map((amount) => (
                        <Button
                            key={amount}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setNewTokenAmount(amount);
                                const updatedComparisons = comparisons.map(comp => 
                                    calculateTokenEnergyMetrics(comp.token, parseFloat(amount))
                                );
                                setComparisons(updatedComparisons);
                            }}
                            className="text-xs"
                        >
                            {amount}
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}