'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Settings, Zap, Battery, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { getTokenMetadataCached, type TokenCacheData } from '@repo/tokens';
import { useApp } from '@/lib/context/app-context';
import { useBlaze } from 'blaze-sdk/realtime';
import { EnergyTankVisualization } from './EnergyTankVisualization';
import { EnergyFlowVisualization, AnimatedCounter, EnergyBurstEffect } from './EnergyParticles';
import { NFTBonusDisplay } from './NFTBonusDisplay';

interface SimulationState {
    isRunning: boolean;
    currentEnergy: number;
    maxCapacity: number;
    tokenBalance: number;
    energyRate: number; // Energy per second
    startTime: number;
    elapsedTime: number;
}

export function EnergySimulation() {
    const [simulation, setSimulation] = useState<SimulationState>({
        isRunning: false,
        currentEnergy: 0,
        maxCapacity: 100000000, // Will be updated with real capacity including NFT bonuses
        tokenBalance: 0, // Will be set from user's actual balance
        energyRate: 0,
        startTime: 0,
        elapsedTime: 0
    });

    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData | null>(null);
    const [energyMetadata, setEnergyMetadata] = useState<TokenCacheData | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showBurstEffect, setShowBurstEffect] = useState(false);

    // Form inputs for configuration
    const [configMaxCapacity, setConfigMaxCapacity] = useState<string>('100');
    const [configTokenBalance, setConfigTokenBalance] = useState<string>('0');
    
    // Wallet connection and balance
    const { walletState } = useApp();
    const { balances } = useBlaze(walletState.connected ? { userId: walletState.address } : undefined);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastUpdateRef = useRef<number>(Date.now());

    // Calculate progress percentage and capacity zones
    const progressPercentage = simulation.maxCapacity > 0
        ? Math.min((simulation.currentEnergy / simulation.maxCapacity) * 100, 100)
        : 0;

    // Define capacity urgency zones
    const getCapacityZone = (percentage: number) => {
        if (percentage >= 100) return 'overflow';
        if (percentage >= 85) return 'critical';
        if (percentage >= 60) return 'warning';
        return 'safe';
    };

    const capacityZone = getCapacityZone(progressPercentage);

    // Zone-specific styling and animations
    const getZoneStyles = (zone: string) => {
        switch (zone) {
            case 'overflow':
                return {
                    progressColor: 'bg-red-500',
                    glowColor: 'rgba(239, 68, 68, 0.4)',
                    borderColor: 'border-red-500/50',
                    animation: 'animate-pulse',
                    textColor: 'text-red-400'
                };
            case 'critical':
                return {
                    progressColor: 'bg-red-400',
                    glowColor: 'rgba(248, 113, 113, 0.3)',
                    borderColor: 'border-red-400/40',
                    animation: 'animate-pulse',
                    textColor: 'text-red-300'
                };
            case 'warning':
                return {
                    progressColor: 'bg-yellow-400',
                    glowColor: 'rgba(251, 191, 36, 0.3)',
                    borderColor: 'border-yellow-400/40',
                    animation: 'animate-bounce',
                    textColor: 'text-yellow-300'
                };
            default:
                return {
                    progressColor: 'bg-gradient-to-r from-primary to-primary/80',
                    glowColor: 'hsl(var(--primary) / 0.2)',
                    borderColor: 'border-primary/30',
                    animation: '',
                    textColor: 'text-primary'
                };
        }
    };

    const zoneStyles = getZoneStyles(capacityZone);

    // Calculate base vs bonus capacity using real NFT data
    const baseCapacity = 100000000; // 100 energy as base (100 * 10^6)
    
    // Calculate actual bonus capacity from Memobot NFTs
    let memobotBonusCapacity = 0;
    if (walletState.connected && balances && walletState.address) {
        // Check for Memobot NFTs in user's balance
        const memobotContracts = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.memobots',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.memobot'
        ];
        
        memobotContracts.forEach(contractId => {
            Object.keys(balances).forEach(balanceKey => {
                if (balanceKey.includes(contractId) && balanceKey.includes(walletState.address!)) {
                    const balance = balances[balanceKey];
                    if (balance && typeof balance.formattedBalance === 'number' && balance.formattedBalance > 0) {
                        memobotBonusCapacity += balance.formattedBalance * 50000000; // 50 energy per Memobot (50 * 10^6)
                    }
                }
            });
        });
    }
    
    const totalCapacity = baseCapacity + memobotBonusCapacity;
    const bonusCapacity = memobotBonusCapacity;

    const requiredTokenId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1';

    // Get user's actual token balance
    const userTokenBalance = walletState.connected && balances
        ? balances[`${walletState.address}:${requiredTokenId}`]?.formattedBalance || 0
        : 0;

    // Load token metadata
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [tokenMeta, energyMeta] = await Promise.all([
                    getTokenMetadataCached(requiredTokenId),
                    getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy')
                ]);
                setTokenMetadata(tokenMeta);
                setEnergyMetadata(energyMeta);
            } catch (error) {
                console.error('Failed to load token metadata:', error);
            }
        };
        loadMetadata();
    }, []);

    // Update simulation with user's actual token balance
    useEffect(() => {
        if (userTokenBalance > 0) {
            setSimulation(prev => ({ ...prev, tokenBalance: userTokenBalance }));
            setConfigTokenBalance(userTokenBalance.toString());
        }
    }, [userTokenBalance]);

    // Update simulation capacity when NFT bonuses change
    useEffect(() => {
        setSimulation(prev => ({ 
            ...prev, 
            maxCapacity: totalCapacity,
            // Reset energy if it exceeds new capacity
            currentEnergy: Math.min(prev.currentEnergy, totalCapacity)
        }));
        setConfigMaxCapacity((totalCapacity / Math.pow(10, energyMetadata?.decimals || 6)).toString());
    }, [totalCapacity, energyMetadata]);

    // Calculate real energy generation rate
    const calculateEnergyRate = useCallback((tokenBalance: number): number => {
        if (!tokenMetadata) return 0;

        // Convert to raw token units
        const decimals = tokenMetadata.decimals || 6;
        const rawTokenBalance = tokenBalance * Math.pow(10, decimals);

        // Real rate calculation based on actual energize vault mechanics
        // This should match the actual contract rate - using discovered rate from testing
        const baseRatePerToken = 0.0015; // Energy per raw token per second (from contract testing)

        return rawTokenBalance * baseRatePerToken;
    }, [tokenMetadata]);

    // Update energy rate when token balance changes
    useEffect(() => {
        const newRate = calculateEnergyRate(simulation.tokenBalance);
        setSimulation(prev => ({ ...prev, energyRate: newRate }));
    }, [simulation.tokenBalance, calculateEnergyRate]);

    // Update simulation state
    const updateSimulation = useCallback(() => {
        const now = Date.now();
        setSimulation(prev => {
            if (!prev.isRunning) return prev;

            const deltaTime = (now - lastUpdateRef.current) / 1000; // Time since last update
            const energyGained = deltaTime * prev.energyRate;
            const newEnergy = Math.min(prev.currentEnergy + energyGained, prev.maxCapacity);
            const totalElapsedTime = (now - prev.startTime) / 1000;

            return {
                ...prev,
                currentEnergy: newEnergy,
                elapsedTime: totalElapsedTime
            };
        });
        lastUpdateRef.current = now;
    }, []);

    // Start/stop simulation
    const toggleSimulation = () => {
        setSimulation(prev => {
            if (prev.isRunning) {
                // Stop simulation
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                return { ...prev, isRunning: false };
            } else {
                // Start simulation - trigger burst effect
                setShowBurstEffect(true);
                const now = Date.now();
                lastUpdateRef.current = now;
                const newState = {
                    ...prev,
                    isRunning: true,
                    startTime: now
                };
                return newState;
            }
        });
    };

    // Reset simulation
    const resetSimulation = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        setSimulation(prev => ({
            ...prev,
            isRunning: false,
            currentEnergy: 0,
            startTime: 0,
            elapsedTime: 0
        }));
    };

    // Apply configuration
    const applyConfiguration = () => {
        const newTokenBalance = parseFloat(configTokenBalance) || 1000;
        
        // Use real capacity calculation instead of user input
        const realMaxCapacity = totalCapacity;

        setSimulation(prev => ({
            ...prev,
            maxCapacity: realMaxCapacity,
            tokenBalance: newTokenBalance,
            currentEnergy: 0,
            startTime: 0,
            elapsedTime: 0,
            isRunning: false
        }));

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        setShowSettings(false);
    };

    // Start interval when simulation starts
    useEffect(() => {
        if (simulation.isRunning && simulation.energyRate > 0) {
            intervalRef.current = setInterval(updateSimulation, 100); // Update every 100ms for smooth animation
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [simulation.isRunning, simulation.energyRate, updateSimulation]);

    // Format energy values
    const formatEnergy = (rawValue: number): string => {
        if (!energyMetadata) return rawValue.toLocaleString();

        const decimals = energyMetadata.decimals || 6;
        const divisor = Math.pow(10, decimals);
        const adjustedValue = rawValue / divisor;

        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: 6,
            minimumFractionDigits: 0
        });
    };

    // Calculate time to full capacity
    const timeToFullCapacity = simulation.energyRate > 0
        ? (simulation.maxCapacity - simulation.currentEnergy) / simulation.energyRate
        : 0;

    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
        return `${Math.round(seconds / 86400)}d`;
    };

    if (!tokenMetadata || !energyMetadata) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm text-muted-foreground">Loading simulation...</span>
                </div>
            </div>
        );
    }

    return (
        <EnergyFlowVisualization
            isActive={simulation.isRunning}
            energyRate={simulation.energyRate}
        >
            <div className="glass-card p-6 relative">
                {/* Energy Burst Effect */}
                <EnergyBurstEffect 
                    trigger={showBurstEffect}
                    onComplete={() => setShowBurstEffect(false)}
                />

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Energy Generation Simulation</h3>
                            <p className="text-sm text-muted-foreground">Real-time energy accumulation visualization</p>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center gap-2"
                    >
                        <Settings className="h-4 w-4" />
                        Configure
                    </Button>
                </div>

            {/* Configuration Panel */}
            {showSettings && (
                <div className="token-card p-4 mb-6">
                    <h4 className="font-medium mb-4">Simulation Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="max-capacity">Max Energy Capacity (Auto-calculated)</Label>
                            <div className="mt-1 p-2 bg-muted/20 rounded-md border">
                                <div className="text-sm font-medium">
                                    {(totalCapacity / Math.pow(10, energyMetadata?.decimals || 6)).toFixed(0)} Energy
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Base: {(baseCapacity / Math.pow(10, energyMetadata?.decimals || 6)).toFixed(0)} + 
                                    Memobot Bonus: {(bonusCapacity / Math.pow(10, energyMetadata?.decimals || 6)).toFixed(0)}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Capacity automatically calculated from your Memobot NFT ownership
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="token-balance">Token Balance ({tokenMetadata.symbol})</Label>
                            <div className="relative">
                                <Input
                                    id="token-balance"
                                    type="number"
                                    value={configTokenBalance}
                                    onChange={(e) => setConfigTokenBalance(e.target.value)}
                                    placeholder="Enter token amount"
                                    className="mt-1"
                                    min="0"
                                    step="0.000001"
                                />
                                {walletState.connected && userTokenBalance > 0 && (
                                    <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs">
                                        Wallet Balance
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {walletState.connected 
                                    ? `Your wallet balance: ${userTokenBalance.toLocaleString()} ${tokenMetadata.symbol}`
                                    : `Amount of ${tokenMetadata.name} tokens held`
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        <Button onClick={applyConfiguration} className="button-primary">
                            Apply Configuration
                        </Button>
                        <Button variant="outline" onClick={() => setShowSettings(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Current Configuration Display with Animated Counters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 token-card">
                    <div className="text-xs text-muted-foreground mb-1">Token Balance</div>
                    <div className="font-semibold">
                        <AnimatedCounter 
                            value={simulation.tokenBalance} 
                            decimals={0}
                            suffix={` ${tokenMetadata.symbol}`}
                        />
                    </div>
                </div>

                <div className="text-center p-3 token-card">
                    <div className="text-xs text-muted-foreground mb-1">Max Capacity</div>
                    <div className="font-semibold">
                        <AnimatedCounter 
                            value={simulation.maxCapacity / Math.pow(10, energyMetadata?.decimals || 6)} 
                            decimals={2}
                            suffix=" Energy"
                        />
                    </div>
                </div>

                <div className="text-center p-3 token-card">
                    <div className="text-xs text-muted-foreground mb-1">Generation Rate</div>
                    <div className="font-semibold">
                        <AnimatedCounter 
                            value={simulation.energyRate / Math.pow(10, energyMetadata?.decimals || 6)} 
                            decimals={6}
                            suffix="/sec"
                            className={cn(
                                simulation.isRunning && "text-primary"
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* Multi-Engine Energy Tank Visualization and NFT Bonuses */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="xl:col-span-2">
                    <EnergyTankVisualization
                        currentEnergy={simulation.currentEnergy}
                        maxCapacity={simulation.maxCapacity}
                        baseCapacity={baseCapacity}
                        bonusCapacity={bonusCapacity}
                        totalEnergyRate={simulation.energyRate}
                        isGenerating={simulation.isRunning}
                        capacityZone={capacityZone}
                    />
                </div>
                
                <div className="xl:col-span-1">
                    <NFTBonusDisplay userAddress={walletState.address} />
                </div>
            </div>

            {/* Capacity Warning Alert */}
            {capacityZone !== 'safe' && (
                <Alert className={cn("border-2", zoneStyles.borderColor)}>
                    <AlertDescription className={cn("font-medium", zoneStyles.textColor)}>
                        {capacityZone === 'overflow' && (
                            <>⚠️ ENERGY CAPACITY FULL - Energy generation is being wasted! Spend energy to resume earning.</>
                        )}
                        {capacityZone === 'critical' && (
                            <>🔴 CRITICAL CAPACITY WARNING - You're at {progressPercentage.toFixed(1)}% capacity. Spend energy soon to avoid waste.</>
                        )}
                        {capacityZone === 'warning' && (
                            <>🟡 CAPACITY WARNING - You're at {progressPercentage.toFixed(1)}% capacity. Consider spending energy soon.</>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* Progress Bar Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Battery className={cn("h-5 w-5", zoneStyles.textColor)} />
                        <span className="font-medium">Energy Capacity</span>
                        <Badge 
                            variant={capacityZone === 'safe' ? 'outline' : 'destructive'}
                            className={cn(
                                capacityZone !== 'safe' && zoneStyles.animation,
                                capacityZone === 'warning' && 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50',
                                capacityZone === 'critical' && 'bg-red-500/20 text-red-700 border-red-500/50',
                                capacityZone === 'overflow' && 'bg-red-600/30 text-red-800 border-red-600/60'
                            )}
                        >
                            {progressPercentage.toFixed(1)}%
                        </Badge>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        <AnimatedCounter 
                            value={simulation.currentEnergy / Math.pow(10, energyMetadata?.decimals || 6)} 
                            decimals={2}
                        /> / <AnimatedCounter 
                            value={simulation.maxCapacity / Math.pow(10, energyMetadata?.decimals || 6)} 
                            decimals={0}
                        />
                    </div>
                </div>

                {/* Animated Progress Bar with Dynamic Zone Styling */}
                <div className={cn("relative", capacityZone !== 'safe' && zoneStyles.animation)}>
                    <Progress
                        value={progressPercentage}
                        className="h-8 bg-muted/20"
                        indicatorClassName={cn(zoneStyles.progressColor)}
                    />

                    {/* Enhanced Glow Effect for Different Zones */}
                    {simulation.isRunning && (
                        <div
                            className="absolute inset-0 h-8 rounded-full pointer-events-none"
                            style={{
                                background: `radial-gradient(ellipse at center, ${zoneStyles.glowColor} 0%, transparent 70%)`,
                                filter: 'blur(12px)',
                                animation: capacityZone !== 'safe' ? 'pulse 1.5s infinite' : 'none'
                            }}
                        />
                    )}

                    {/* Zone Markers */}
                    <div className="absolute inset-0 h-8 pointer-events-none">
                        {/* Warning zone marker at 60% */}
                        <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/60"
                            style={{ left: '60%' }}
                        />
                        {/* Critical zone marker at 85% */}
                        <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-red-400/60"
                            style={{ left: '85%' }}
                        />
                    </div>

                    {/* Energy Value Overlay with Zone-Aware Styling and Animation */}
                    <div className="absolute inset-0 flex items-center justify-center h-8">
                        <span className={cn(
                            "text-xs font-medium drop-shadow-sm",
                            capacityZone === 'safe' ? "text-foreground/90" : "text-white font-bold"
                        )}>
                            <AnimatedCounter 
                                value={simulation.currentEnergy / Math.pow(10, energyMetadata?.decimals || 6)} 
                                decimals={2}
                                suffix=" Energy"
                                duration={0.5}
                            />
                        </span>
                    </div>

                    {/* Overflow Effect */}
                    {capacityZone === 'overflow' && simulation.isRunning && (
                        <div className="absolute -top-2 -right-2 text-red-500 animate-bounce">
                            <span className="text-xs font-bold bg-red-500/20 px-2 py-1 rounded border border-red-500/50">
                                ⚠️ WASTING ENERGY
                            </span>
                        </div>
                    )}
                </div>

                {/* Status Information with Zone-Aware Styling */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Elapsed: {formatTime(simulation.elapsedTime)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span>Rate: {formatEnergy(simulation.energyRate * 3600)}/hour</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Battery className={cn(
                            "h-4 w-4",
                            capacityZone === 'overflow' ? 'text-red-500' : 'text-muted-foreground'
                        )} />
                        <span className={cn(
                            capacityZone === 'overflow' && 'text-red-500 font-bold'
                        )}>
                            {progressPercentage >= 100 ? 'CAPACITY FULL' : `Full in: ${formatTime(timeToFullCapacity)}`}
                        </span>
                    </div>
                </div>

                {/* Energy Waste Calculator */}
                {capacityZone === 'overflow' && simulation.isRunning && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                            <span className="font-semibold">⚠️ Energy Being Wasted:</span>
                            <span className="font-mono">
                                {formatEnergy(simulation.energyRate * 60)}/minute
                            </span>
                            <span className="text-xs text-red-300">
                                ({formatEnergy(simulation.energyRate * 3600)}/hour)
                            </span>
                        </div>
                        <div className="text-xs text-red-300 mt-1">
                            Spend energy now to resume earning! Every second at full capacity wastes potential rewards.
                        </div>
                    </div>
                )}

                {/* Control Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={toggleSimulation}
                                    className={simulation.isRunning ? "button-secondary" : "button-primary"}
                                    disabled={simulation.energyRate <= 0}
                                >
                                    {simulation.isRunning ? (
                                        <>
                                            <Pause className="h-4 w-4 mr-2" />
                                            Pause
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-4 w-4 mr-2" />
                                            Start
                                        </>
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {simulation.isRunning ? 'Pause the simulation' : 'Start energy generation simulation'}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={resetSimulation}
                                >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Reset
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                Reset simulation to zero energy
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {simulation.energyRate <= 0 && (
                        <Alert className="flex-1">
                            <AlertDescription className="text-xs">
                                Configure a token balance greater than 0 to start generating energy
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </div>
            </div>
        </EnergyFlowVisualization>
    );
}