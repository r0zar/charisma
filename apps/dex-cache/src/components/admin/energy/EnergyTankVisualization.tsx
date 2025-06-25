'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap, Droplets, ArrowRight, Settings2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface EnergyEngine {
    id: string;
    name: string;
    tokenPair: string;
    contributionRate: number;
    isActive: boolean;
    color: string;
}

interface EnergyTankProps {
    currentEnergy: number;
    maxCapacity: number;
    baseCapacity?: number; // Base capacity without NFT bonuses
    bonusCapacity?: number; // Additional capacity from Memobots
    totalEnergyRate: number;
    isGenerating: boolean;
    capacityZone: 'safe' | 'warning' | 'critical' | 'overflow';
}

export function EnergyTankVisualization({
    currentEnergy,
    maxCapacity,
    baseCapacity = maxCapacity,
    bonusCapacity = 0,
    totalEnergyRate,
    isGenerating,
    capacityZone
}: EnergyTankProps) {
    // Mock energy engines data - in real implementation, this would come from props or context
    const [engines] = useState<EnergyEngine[]>([
        {
            id: 'cha-stx',
            name: 'CHA-STX Engine',
            tokenPair: 'CHA/STX',
            contributionRate: totalEnergyRate * 0.4,
            isActive: totalEnergyRate > 0,
            color: 'from-orange-400 to-orange-600'
        },
        {
            id: 'welsh-stx',
            name: 'WELSH-STX Engine', 
            tokenPair: 'WELSH/STX',
            contributionRate: totalEnergyRate * 0.3,
            isActive: totalEnergyRate > 0,
            color: 'from-green-400 to-green-600'
        },
        {
            id: 'roo-stx',
            name: 'ROO-STX Engine',
            tokenPair: 'ROO/STX',
            contributionRate: totalEnergyRate * 0.2,
            isActive: totalEnergyRate > 0,
            color: 'from-purple-400 to-purple-600'
        },
        {
            id: 'leo-stx',
            name: 'LEO-STX Engine',
            tokenPair: 'LEO/STX',
            contributionRate: totalEnergyRate * 0.1,
            isActive: totalEnergyRate > 0,
            color: 'from-blue-400 to-blue-600'
        }
    ]);

    const progressPercentage = maxCapacity > 0 ? Math.min((currentEnergy / maxCapacity) * 100, 100) : 0;
    const baseProgressPercentage = baseCapacity > 0 ? Math.min((currentEnergy / baseCapacity) * 100, 100) : 0;
    const baseFillPercentage = maxCapacity > 0 ? (baseCapacity / maxCapacity) * 100 : 100;

    // Get zone-specific styling
    const getTankStyles = (zone: string) => {
        switch (zone) {
            case 'overflow':
                return {
                    tankBorder: 'border-red-500/70 shadow-red-500/20',
                    fluidColor: 'from-red-400 via-red-500 to-red-600',
                    glowColor: 'rgba(239, 68, 68, 0.3)',
                    animation: 'animate-pulse'
                };
            case 'critical':
                return {
                    tankBorder: 'border-red-400/60 shadow-red-400/15',
                    fluidColor: 'from-red-300 via-red-400 to-red-500',
                    glowColor: 'rgba(248, 113, 113, 0.25)',
                    animation: 'animate-pulse'
                };
            case 'warning':
                return {
                    tankBorder: 'border-yellow-400/60 shadow-yellow-400/15',
                    fluidColor: 'from-yellow-300 via-yellow-400 to-yellow-500',
                    glowColor: 'rgba(251, 191, 36, 0.25)',
                    animation: 'animate-bounce'
                };
            default:
                return {
                    tankBorder: 'border-primary/40 shadow-primary/10',
                    fluidColor: 'from-primary via-primary/90 to-primary/80',
                    glowColor: 'hsl(var(--primary) / 0.15)',
                    animation: ''
                };
        }
    };

    const tankStyles = getTankStyles(capacityZone);

    const formatEnergy = (value: number): string => {
        const divisor = Math.pow(10, 6);
        const adjustedValue = value / divisor;
        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        });
    };

    return (
        <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Droplets className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Energy Collective System</h3>
                    <p className="text-sm text-muted-foreground">Multiple engines feeding central energy tank</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Energy Engines Grid */}
                <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Active Energy Engines</span>
                        <Badge variant="outline">{engines.filter(e => e.isActive).length} of {engines.length}</Badge>
                    </div>

                    {engines.map((engine) => (
                        <div
                            key={engine.id}
                            className={cn(
                                "token-card p-4 transition-all duration-300",
                                engine.isActive ? "border-primary/30" : "border-muted/30 opacity-60"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Engine Status Indicator */}
                                    <div className={cn(
                                        "h-3 w-3 rounded-full",
                                        engine.isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"
                                    )} />
                                    
                                    <div>
                                        <div className="font-medium text-sm">{engine.name}</div>
                                        <div className="text-xs text-muted-foreground">{engine.tokenPair}</div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Contribution Rate */}
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Rate</div>
                                        <div className="text-sm font-mono">
                                            {formatEnergy(engine.contributionRate)}/s
                                        </div>
                                    </div>

                                    {/* Flow Animation */}
                                    {engine.isActive && isGenerating && (
                                        <div className="flex items-center">
                                            <div className={cn(
                                                "h-2 w-8 rounded-full bg-gradient-to-r opacity-70",
                                                engine.color,
                                                "animate-pulse"
                                            )} />
                                            <ArrowRight className="h-4 w-4 text-primary animate-pulse ml-1" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Engine Mini Progress Bar */}
                            {engine.isActive && (
                                <div className="mt-3">
                                    <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                                        <div 
                                            className={cn(
                                                "h-full bg-gradient-to-r transition-all duration-1000",
                                                engine.color,
                                                isGenerating && "animate-pulse"
                                            )}
                                            style={{ 
                                                width: `${Math.min((engine.contributionRate / totalEnergyRate) * 100, 100)}%` 
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Central Energy Tank */}
                <div className="flex flex-col items-center">
                    <div className="text-center mb-4">
                        <div className="text-sm font-medium">Central Energy Tank</div>
                        <div className="text-xs text-muted-foreground">
                            {formatEnergy(currentEnergy)} / {formatEnergy(maxCapacity)}
                        </div>
                        {bonusCapacity > 0 && (
                            <div className="text-xs text-blue-400 mt-1">
                                Base: {formatEnergy(baseCapacity)} + Bonus: {formatEnergy(bonusCapacity)}
                            </div>
                        )}
                    </div>

                    {/* Tank Visualization */}
                    <div className={cn(
                        "relative w-24 h-48 border-2 rounded-b-lg rounded-t-md bg-gradient-to-b from-muted/10 to-muted/20 shadow-lg",
                        tankStyles.tankBorder,
                        tankStyles.animation
                    )}>
                        {/* Tank Glow Effect */}
                        {isGenerating && (
                            <div
                                className="absolute inset-0 rounded-b-lg rounded-t-md pointer-events-none"
                                style={{
                                    boxShadow: `0 0 20px ${tankStyles.glowColor}`,
                                    filter: 'blur(1px)'
                                }}
                            />
                        )}

                        {/* Base Capacity Section */}
                        <div 
                            className="absolute bottom-0 left-0 right-0 bg-muted/20 border-t border-muted/30 rounded-b-lg"
                            style={{ height: `${baseFillPercentage}%` }}
                        >
                            {/* Base Energy Fluid */}
                            <div 
                                className={cn(
                                    "absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t transition-all duration-1000",
                                    tankStyles.fluidColor,
                                    isGenerating && "animate-pulse"
                                )}
                                style={{ height: `${Math.min(progressPercentage, baseFillPercentage)}%` }}
                            >
                                {/* Fluid Surface Animation */}
                                {isGenerating && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-white/30 animate-pulse" />
                                )}
                            </div>
                        </div>

                        {/* Bonus Capacity Section (from Memobots) */}
                        {bonusCapacity > 0 && (
                            <div 
                                className="absolute left-0 right-0 bg-blue-500/10 border-t border-blue-500/30"
                                style={{ 
                                    bottom: `${baseFillPercentage}%`,
                                    height: `${100 - baseFillPercentage}%`
                                }}
                            >
                                {/* Bonus Energy Fluid */}
                                {progressPercentage > baseFillPercentage && (
                                    <div 
                                        className={cn(
                                            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-400 via-blue-500 to-blue-600 transition-all duration-1000",
                                            isGenerating && "animate-pulse"
                                        )}
                                        style={{ 
                                            height: `${((progressPercentage - baseFillPercentage) / (100 - baseFillPercentage)) * 100}%` 
                                        }}
                                    >
                                        {/* Bonus fluid surface */}
                                        {isGenerating && (
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-200/50 animate-pulse" />
                                        )}
                                    </div>
                                )}
                                
                                {/* Bonus capacity label */}
                                <div className="absolute top-1 right-1">
                                    <div className="text-xs px-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/40">
                                        BONUS
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Capacity Zone Markers */}
                        <div className="absolute inset-0 pointer-events-none">
                            {/* Warning line at 60% */}
                            <div 
                                className="absolute left-0 right-0 h-0.5 bg-yellow-400/60"
                                style={{ bottom: '60%' }}
                            />
                            {/* Critical line at 85% */}
                            <div 
                                className="absolute left-0 right-0 h-0.5 bg-red-400/60"
                                style={{ bottom: '85%' }}
                            />
                        </div>

                        {/* Overflow Effect */}
                        {capacityZone === 'overflow' && isGenerating && (
                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                <div className="text-red-500 animate-bounce text-xs">⚠️</div>
                            </div>
                        )}

                        {/* Tank Capacity Percentage */}
                        <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
                            <div className={cn(
                                "text-xs font-mono px-1 py-0.5 rounded bg-background/80 border",
                                capacityZone !== 'safe' && "text-red-500 border-red-500/50"
                            )}>
                                {progressPercentage.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    {/* Tank Stats */}
                    <div className="mt-4 text-center space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            <span>Total Rate: {formatEnergy(totalEnergyRate)}/s</span>
                        </div>
                        <div className="text-xs">
                            <span className={cn(
                                capacityZone === 'safe' ? 'text-green-500' : 
                                capacityZone === 'warning' ? 'text-yellow-500' :
                                'text-red-500'
                            )}>
                                {capacityZone === 'overflow' ? 'OVERFLOW' : 
                                 capacityZone === 'critical' ? 'CRITICAL' :
                                 capacityZone === 'warning' ? 'WARNING' : 'OPTIMAL'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Collective Stats Summary */}
            <div className="mt-6 pt-4 border-t border-border/30">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-xs text-muted-foreground">Active Engines</div>
                        <div className="font-semibold">{engines.filter(e => e.isActive).length}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Combined Rate</div>
                        <div className="font-semibold">{formatEnergy(totalEnergyRate * 3600)}/hr</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Efficiency</div>
                        <div className="font-semibold text-green-500">
                            {capacityZone === 'overflow' ? '0%' : '100%'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Status</div>
                        <div className={cn(
                            "font-semibold text-xs",
                            isGenerating ? 'text-green-500' : 'text-gray-500'
                        )}>
                            {isGenerating ? 'GENERATING' : 'IDLE'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}