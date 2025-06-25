'use client';

import { useState, useEffect, useRef } from 'react';
import { request } from '@stacks/connect';
import { Wifi, WifiOff, Zap, Battery, Clock, AlertTriangle, Settings2, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { getTokenMetadataCached, type TokenCacheData } from '@repo/tokens';
import { useApp } from '@/lib/context/app-context';
import { EnergyTankVisualization } from './EnergyTankVisualization';
import { EnergyFlowVisualization, AnimatedCounter } from './EnergyParticles';
import { NFTBonusDisplay } from './NFTBonusDisplay';
import { useNFTBonuses } from '@/lib/nft-service';
import { formatEnergyValue, formatTimeDuration, getCapacityZoneStyles, type RealTimeEnergyData } from '@/lib/energy/real-time';
import { Pc, uintCV } from '@stacks/transactions';

interface StreamConnectionState {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    lastUpdate: number;
    reconnectAttempts: number;
}

interface EnergyState extends RealTimeEnergyData {
    // Real-time data from SSE stream
}

export function EnergyTracker() {
    const [energyState, setEnergyState] = useState<EnergyState | null>(null);
    const [connectionState, setConnectionState] = useState<StreamConnectionState>({
        isConnected: false,
        isConnecting: false,
        error: null,
        lastUpdate: 0,
        reconnectAttempts: 0
    });

    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData | null>(null);
    const [energyMetadata, setEnergyMetadata] = useState<TokenCacheData | null>(null);

    // Burn energy state
    const [isBurning, setIsBurning] = useState(false);
    const [burnSuccess, setBurnSuccess] = useState(false);

    // Energy tap animation state
    const [harvestAnimation, setHarvestAnimation] = useState({ show: false, amount: 0 });

    // Energy burn animation state
    const [burnAnimation, setBurnAnimation] = useState({ show: false, amount: 0 });

    // Current Stacks block tracking
    const [currentBlock, setCurrentBlock] = useState<number | null>(null);

    // Optimistic updates tracking using ref to avoid re-render dependency issues
    const optimisticUpdatesRef = useRef({
        balanceIncrease: 0,
        harvestableDecrease: 0,
        accumulatedDecrease: 0, // Track accumulated energy decreases separately
        pendingTaps: new Map<string, number>() // track pending taps by transaction ID
    });

    // Wallet connection
    const { walletState } = useApp();

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch current Stacks block height
    const fetchCurrentBlock = async () => {
        try {
            const response = await fetch('https://api.hiro.so/v2/info');
            const data = await response.json();
            setCurrentBlock(data.stacks_tip_height);
        } catch (error) {
            console.warn('Failed to fetch current block height:', error);
        }
    };

    // Update current block every 5 seconds
    useEffect(() => {
        fetchCurrentBlock(); // Initial fetch
        const interval = setInterval(fetchCurrentBlock, 5000);
        return () => clearInterval(interval);
    }, []);

    // Calculate derived values from energy state
    // For Energy Capacity section: show current spendable balance vs max capacity
    const currentBalancePercentage = energyState ?
        Math.min((energyState.currentEnergyBalance / energyState.maxCapacity) * 100, 100) : 0;

    // Determine capacity zone based on CURRENT BALANCE, not harvestable energy
    const currentBalanceZone: 'safe' | 'warning' | 'critical' | 'overflow' =
        currentBalancePercentage >= 100 ? 'overflow' :
            currentBalancePercentage >= 85 ? 'critical' :
                currentBalancePercentage >= 60 ? 'warning' : 'safe';

    const zoneStyles = getCapacityZoneStyles(currentBalanceZone);

    // Keep the original harvestable energy calculations for other parts of the UI
    const harvestablePercentage = energyState?.capacityPercentage || 0;
    const harvestableZone = energyState?.capacityStatus || 'safe';

    // Calculate base vs bonus capacity using real NFT data
    const baseCapacity = 100000000; // 100 energy as base (100 * 10^6)

    // Use real NFT bonus data from nft-service
    const { bonuses: nftBonuses } = useNFTBonuses(walletState.address);
    const actualCapacityBonus = nftBonuses?.capacityBonus || 0;
    const bonusCapacity = actualCapacityBonus;

    // Load token metadata
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                const [tokenMeta, energyMeta] = await Promise.all([
                    getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1'),
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

    // SSE Connection Management
    const connectToEnergyStream = () => {
        if (!walletState.connected || !walletState.address) {
            console.warn('Cannot connect to energy stream: wallet not connected');
            return;
        }

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        setConnectionState(prev => ({ ...prev, isConnecting: true, error: null }));
        console.log(`🌊 Connecting to energy stream for: ${walletState.address}`);

        const eventSource = new EventSource(`/api/v1/energy/stream/${walletState.address}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            console.log('✅ Energy stream connected');
            setConnectionState({
                isConnected: true,
                isConnecting: false,
                error: null,
                lastUpdate: Date.now(),
                reconnectAttempts: 0
            });
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'energy_update') {
                    // Apply optimistic updates to incoming SSE data (respecting capacity limits)
                    const optimisticBalance = data.currentEnergyBalance + optimisticUpdatesRef.current.balanceIncrease;
                    const cappedBalance = Math.min(optimisticBalance, data.maxCapacity);

                    const updatedData = {
                        ...data,
                        currentEnergyBalance: cappedBalance,
                        totalHarvestableEnergy: Math.max(0, data.totalHarvestableEnergy - optimisticUpdatesRef.current.harvestableDecrease),
                        accumulatedSinceLastHarvest: Math.max(0, data.accumulatedSinceLastHarvest - optimisticUpdatesRef.current.accumulatedDecrease)
                    };
                    setEnergyState(updatedData);
                    setConnectionState(prev => ({ ...prev, lastUpdate: Date.now() }));
                } else if (data.type === 'connected') {
                    console.log('🎯 Energy stream handshake completed');
                } else if (data.type === 'error') {
                    console.error('🔥 Energy stream error:', data.message);
                    setConnectionState(prev => ({ ...prev, error: data.message }));
                }
            } catch (error) {
                console.error('Failed to parse SSE data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('❌ Energy stream error:', error);
            setConnectionState(prev => ({
                ...prev,
                isConnected: false,
                isConnecting: false,
                error: 'Connection lost',
                reconnectAttempts: prev.reconnectAttempts + 1
            }));

            // Auto-reconnect with exponential backoff
            if (connectionState.reconnectAttempts < 5) {
                const delay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 10000);
                console.log(`🔄 Reconnecting in ${delay}ms (attempt ${connectionState.reconnectAttempts + 1})`);

                reconnectTimeoutRef.current = setTimeout(() => {
                    connectToEnergyStream();
                }, delay);
            }
        };
    };

    // Connect when wallet connects
    useEffect(() => {
        if (walletState.connected && walletState.address) {
            connectToEnergyStream();
        } else {
            // Disconnect when wallet disconnects
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            setConnectionState({
                isConnected: false,
                isConnecting: false,
                error: null,
                lastUpdate: 0,
                reconnectAttempts: 0
            });
            setEnergyState(null);
        }

        // Cleanup on unmount
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [walletState.connected, walletState.address]);

    // Manual reconnection function
    const handleReconnect = () => {
        setConnectionState(prev => ({ ...prev, reconnectAttempts: 0 }));
        connectToEnergyStream();
    };

    // Burn energy using hooter-farm-x10 contract
    const handleBurnEnergy = async () => {
        if (!walletState.connected || !walletState.address) {
            console.error('Wallet not connected');
            return;
        }

        const energyBalance = energyState?.currentEnergyBalance || 0;

        try {
            setIsBurning(true);
            const hooterTheOwlToken = await getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl');
            const hooterFarmX10Contract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm-x10';
            const response = await request('stx_callContract', {
                contract: hooterFarmX10Contract,
                functionName: 'claim',
                functionArgs: [uintCV(energyBalance)], // 1000 energy in micro-units
                postConditions: [
                    Pc.principal(walletState.address).willSendLte(energyBalance).ft(energyMetadata?.contractId as any, 'energy'),
                    Pc.principal(hooterFarmX10Contract).willSendLte(energyBalance).ft(hooterTheOwlToken?.contractId as any, 'hooter')
                ],
                network: 'mainnet'
            });

            console.log('Burn energy transaction response:', response);
            setBurnSuccess(true);

            // Optimistic update - immediately reduce energy balance
            const burnedAmount = energyBalance;
            console.log(`Optimistically reducing energy balance by ${burnedAmount} micro-units`);

            // Show burn animation
            setBurnAnimation({ show: true, amount: burnedAmount });

            // Generate unique burn ID for tracking
            const burnId = `burn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Update optimistic tracking
            optimisticUpdatesRef.current.balanceIncrease -= burnedAmount; // Negative increase = decrease
            optimisticUpdatesRef.current.pendingTaps.set(burnId, -burnedAmount); // Track as negative

            // Immediately update energy state (reduce current balance to 0 or minimal amount)
            setEnergyState(prev => prev ? {
                ...prev,
                currentEnergyBalance: 0 // Burn typically consumes all available energy
            } : null);

            // Hide burn animation after 2 seconds
            setTimeout(() => {
                setBurnAnimation({ show: false, amount: 0 });
            }, 2000);

            // Reset success state after 3 seconds
            setTimeout(() => {
                setBurnSuccess(false);
            }, 3000);

            // Clear optimistic update after 60 seconds (blockchain confirmation should happen by then)
            setTimeout(() => {
                if (optimisticUpdatesRef.current.pendingTaps.has(burnId)) {
                    const amount = optimisticUpdatesRef.current.pendingTaps.get(burnId)!;
                    optimisticUpdatesRef.current.balanceIncrease -= amount; // Remove the negative amount
                    optimisticUpdatesRef.current.pendingTaps.delete(burnId);
                    console.log(`Cleared optimistic burn update for ${burnId}`);
                }
            }, 60000);

        } catch (error) {
            console.error('Energy burn failed:', error);

            // Revert optimistic update on error
            if (energyState) {
                const revertAmount = energyState.currentEnergyBalance || 0;
                console.log(`Reverting optimistic burn update: ${revertAmount} micro-units`);

                // Restore the original energy balance
                setEnergyState(prev => prev ? {
                    ...prev,
                    currentEnergyBalance: energyBalance // Restore original balance
                } : null);

                // Also revert the optimistic tracking
                optimisticUpdatesRef.current.balanceIncrease += energyBalance;
            }
        } finally {
            setIsBurning(false);
        }
    };

    // Handle optimistic energy tap update with animation and per-engine tracking
    const handleEnergyHarvested = (tappedAmount: number, engineContractId?: string) => {
        console.log(`Energy tapped: ${tappedAmount} micro-units from engine: ${engineContractId || 'unknown'}`);

        if (!energyState) return;

        // Calculate how much energy can actually be added to balance (respecting capacity)
        const currentBalance = energyState.currentEnergyBalance;
        const maxCapacity = energyState.maxCapacity;
        const remainingCapacity = Math.max(0, maxCapacity - currentBalance);
        const actualHarvestedAmount = Math.min(tappedAmount, remainingCapacity);
        const wastedAmount = tappedAmount - actualHarvestedAmount;

        console.log(`Capacity check: current=${currentBalance}, max=${maxCapacity}, remaining=${remainingCapacity}`);
        console.log(`Harvest: requested=${tappedAmount}, actual=${actualHarvestedAmount}, wasted=${wastedAmount}`);

        // Generate unique tap ID for tracking
        const tapId = `tap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Show appropriate animation based on capacity
        if (actualHarvestedAmount > 0) {
            setHarvestAnimation({ show: true, amount: actualHarvestedAmount });
        }

        // Show waste warning if energy was wasted
        if (wastedAmount > 0) {
            console.warn(`⚠️ ${wastedAmount} micro-units wasted - wallet at capacity!`);
            // Could show a different animation here for wasted energy
        }

        // Hide animation after 2 seconds
        setTimeout(() => {
            setHarvestAnimation({ show: false, amount: 0 });
        }, 2000);

        // The accumulated energy should decrease by exactly the amount that goes into the balance
        // This ensures perfect 1:1 correspondence between balance increase and accumulated decrease
        const accumulatedEnergyReduction = actualHarvestedAmount;

        console.log(`Accumulated energy reduction: ${accumulatedEnergyReduction} micro-units`);

        // Update optimistic tracking in ref (only track what was actually harvested)
        if (actualHarvestedAmount > 0) {
            optimisticUpdatesRef.current.balanceIncrease += actualHarvestedAmount;
            optimisticUpdatesRef.current.harvestableDecrease += tappedAmount; // Full amount removed from harvestable
            optimisticUpdatesRef.current.accumulatedDecrease += accumulatedEnergyReduction; // Track accumulated decrease separately
            optimisticUpdatesRef.current.pendingTaps.set(tapId, actualHarvestedAmount);

            // Immediately update current energy state (respecting capacity)
            setEnergyState(prev => prev ? {
                ...prev,
                currentEnergyBalance: Math.min(prev.currentEnergyBalance + actualHarvestedAmount, maxCapacity),
                totalHarvestableEnergy: Math.max(0, prev.totalHarvestableEnergy - tappedAmount),
                // Reduce accumulated energy by exactly the amount that went into balance
                accumulatedSinceLastHarvest: Math.max(0, prev.accumulatedSinceLastHarvest - accumulatedEnergyReduction)
            } : null);
        } else {
            // If nothing was harvested due to capacity, don't reduce accumulated energy
            // (since no energy actually moved from accumulated to balance)
            optimisticUpdatesRef.current.harvestableDecrease += tappedAmount;
            setEnergyState(prev => prev ? {
                ...prev,
                totalHarvestableEnergy: Math.max(0, prev.totalHarvestableEnergy - tappedAmount),
                // Don't reduce accumulated energy if nothing was actually harvested
                accumulatedSinceLastHarvest: prev.accumulatedSinceLastHarvest
            } : null);
        }

        // Clear this specific tap after 60 seconds (blockchain confirmation should happen by then)
        setTimeout(() => {
            if (optimisticUpdatesRef.current.pendingTaps.has(tapId)) {
                const amount = optimisticUpdatesRef.current.pendingTaps.get(tapId)!;
                optimisticUpdatesRef.current.balanceIncrease -= amount;
                optimisticUpdatesRef.current.harvestableDecrease -= tappedAmount;
                optimisticUpdatesRef.current.accumulatedDecrease -= accumulatedEnergyReduction;
                optimisticUpdatesRef.current.pendingTaps.delete(tapId);
                console.log(`Cleared optimistic update for tap ${tapId}`);
            }
        }, 60000);
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
            isActive={connectionState.isConnected && (energyState?.energyRatePerSecond || 0) > 0}
            energyRate={energyState?.energyRatePerSecond || 0}
        >
            <div className="glass-card p-6 relative">

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Real-Time Energy Tracker</h3>
                            <p className="text-sm text-muted-foreground">Live energy accumulation status</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Current Stacks Block */}
                        <div className="text-xs text-muted-foreground">
                            Block: {currentBlock ? currentBlock.toLocaleString() : '...'}
                        </div>

                        <Badge
                            variant={connectionState.isConnected ? "default" : "destructive"}
                            className="flex items-center gap-1"
                        >
                            {connectionState.isConnected ? (
                                <><Wifi className="h-3 w-3" /> Live</>
                            ) : connectionState.isConnecting ? (
                                <><div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> Connecting</>
                            ) : (
                                <><WifiOff className="h-3 w-3" /> Offline</>
                            )}
                        </Badge>
                        {connectionState.error && (
                            <button
                                onClick={handleReconnect}
                                className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            >
                                Reconnect
                            </button>
                        )}
                    </div>
                </div>

                {/* Connection Status Panel */}
                {(!connectionState.isConnected || connectionState.error) && walletState.connected && (
                    <div className="token-card p-4 mb-6">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            Stream Status
                        </h4>
                        {connectionState.error && (
                            <Alert className="mb-3">
                                <AlertDescription>
                                    {connectionState.error}
                                    {connectionState.reconnectAttempts > 0 && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                            (Attempt {connectionState.reconnectAttempts}/5)
                                        </span>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="text-sm text-muted-foreground">
                            {connectionState.isConnecting ? (
                                'Connecting to real-time energy stream...'
                            ) : (
                                'Real-time energy data is currently unavailable.'
                            )}
                        </div>
                    </div>
                )}

                {/* Real-Time Energy Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-3 token-card relative">
                        <div className="text-xs text-muted-foreground mb-1">Current Balance</div>
                        <div className="font-semibold relative">
                            {energyState ? (
                                <AnimatedCounter
                                    value={energyState.currentEnergyBalance / Math.pow(10, energyMetadata?.decimals || 6)}
                                    decimals={2}
                                    suffix=" Energy"
                                    className={harvestAnimation.show ? "text-yellow-500" : ""}
                                />
                            ) : (
                                <span className="text-muted-foreground">--</span>
                            )}

                            {/* Tap Animation */}
                            {harvestAnimation.show && (
                                <div className="absolute inset-0 pointer-events-none">
                                    {/* Golden glow effect */}
                                    <div className="absolute inset-0 bg-yellow-400/20 rounded-lg animate-pulse" />

                                    {/* Floating tap amount */}
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                                        <div className={cn(
                                            "text-xs px-2 py-1 rounded-full font-bold shadow-lg",
                                            energyState && energyState.currentEnergyBalance >= energyState.maxCapacity
                                                ? "bg-orange-500 text-orange-900"
                                                : "bg-yellow-500 text-yellow-900"
                                        )}>
                                            +{(harvestAnimation.amount / Math.pow(10, energyMetadata?.decimals || 6)).toFixed(0)} Energy
                                            {energyState && energyState.currentEnergyBalance >= energyState.maxCapacity && (
                                                <div className="text-xs opacity-80 mt-0.5">At capacity!</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sparkle effects */}
                                    <div className="absolute top-1 right-1">
                                        <div className="h-2 w-2 bg-yellow-400 rounded-full animate-ping" />
                                    </div>
                                    <div className="absolute bottom-1 left-1">
                                        <div className="h-1 w-1 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                                    </div>
                                    <div className="absolute top-2 left-1/2">
                                        <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                                    </div>
                                </div>
                            )}

                            {/* Burn Animation */}
                            {burnAnimation.show && (
                                <div className="absolute inset-0 pointer-events-none">
                                    {/* Red flame effect */}
                                    <div className="absolute inset-0 bg-red-500/30 rounded-lg animate-pulse" />

                                    {/* Floating burn amount */}
                                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
                                        <div className="text-xs px-2 py-1 rounded-full font-bold shadow-lg bg-red-500 text-red-100">
                                            <Flame className="h-3 w-3 inline mr-1" />
                                            -{(burnAnimation.amount / Math.pow(10, energyMetadata?.decimals || 6)).toFixed(0)} Energy Burned
                                        </div>
                                    </div>

                                    {/* Fire effects */}
                                    <div className="absolute top-1 right-1">
                                        <div className="h-2 w-2 bg-red-500 rounded-full animate-ping" />
                                    </div>
                                    <div className="absolute bottom-1 left-1">
                                        <div className="h-1 w-1 bg-orange-500 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
                                    </div>
                                    <div className="absolute top-2 left-1/2">
                                        <div className="h-1.5 w-1.5 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-center p-3 token-card">
                        <div className="text-xs text-muted-foreground mb-1">Accumulated</div>
                        <div className="font-semibold">
                            {energyState ? (
                                <AnimatedCounter
                                    value={energyState.accumulatedSinceLastHarvest / Math.pow(10, energyMetadata?.decimals || 6)}
                                    decimals={2}
                                    suffix=" Energy"
                                    className="text-primary"
                                />
                            ) : (
                                <span className="text-muted-foreground">--</span>
                            )}
                        </div>
                    </div>

                    <div className="text-center p-3 token-card">
                        <div className="text-xs text-muted-foreground mb-1">Generation Rate</div>
                        <div className="font-semibold">
                            {energyState ? (
                                <AnimatedCounter
                                    value={energyState.energyRatePerSecond / Math.pow(10, energyMetadata?.decimals || 6)}
                                    decimals={6}
                                    suffix="/sec"
                                    className="text-green-400"
                                />
                            ) : (
                                <span className="text-muted-foreground">--</span>
                            )}
                        </div>
                    </div>

                    <div className="text-center p-3 token-card">
                        <div className="text-xs text-muted-foreground mb-1">Time Since Harvest</div>
                        <div className="font-semibold">
                            {energyState ? (
                                <span>{formatTimeDuration(energyState.timeSinceLastHarvest)}</span>
                            ) : (
                                <span className="text-muted-foreground">--</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Multi-Engine Energy Tank Visualization and NFT Bonuses */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                    <div className="xl:col-span-2">
                        <EnergyTankVisualization
                            currentEnergy={energyState?.totalHarvestableEnergy || 0}
                            currentBalance={energyState?.currentEnergyBalance || 0}
                            maxCapacity={energyState?.maxCapacity || baseCapacity + actualCapacityBonus}
                            baseCapacity={baseCapacity}
                            bonusCapacity={bonusCapacity}
                            totalEnergyRate={energyState?.energyRatePerSecond || 0}
                            isGenerating={connectionState.isConnected && (energyState?.energyRatePerSecond || 0) > 0}
                            capacityZone={harvestableZone}
                            onEnergyHarvested={handleEnergyHarvested}
                        />
                    </div>

                    <div className="xl:col-span-1 space-y-6">
                        <NFTBonusDisplay userAddress={walletState.address} />
                    </div>
                </div>

                {/* Energy Capacity and Smart Energy Management - Side by Side on XL */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                    {/* Energy Capacity Section - Left Column */}
                    <div className="token-card p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Battery className={cn("h-4 w-4", zoneStyles.textColor)} />
                                <span className="text-sm font-medium">Energy Capacity</span>
                                {energyState && (
                                    <span className="text-sm text-muted-foreground">
                                        <AnimatedCounter
                                            value={energyState.currentEnergyBalance / Math.pow(10, energyMetadata?.decimals || 6)}
                                            decimals={1}
                                        /> / <AnimatedCounter
                                            value={energyState.maxCapacity / Math.pow(10, energyMetadata?.decimals || 6)}
                                            decimals={0}
                                        />
                                    </span>
                                )}
                            </div>

                            <Badge
                                variant={currentBalanceZone === 'safe' ? 'outline' : currentBalanceZone === 'overflow' ? 'destructive' : 'secondary'}
                                className={cn(
                                    "text-xs",
                                    currentBalanceZone === 'overflow' && 'animate-pulse bg-red-500/20 text-red-700 border-red-500/50'
                                )}
                            >
                                {currentBalanceZone === 'overflow' ? '⚠️ FULL' :
                                    currentBalanceZone === 'critical' ? '🔴 Critical' :
                                        currentBalanceZone === 'warning' ? '🟡 Warning' :
                                            `${currentBalancePercentage.toFixed(0)}%`}
                            </Badge>
                        </div>

                        {/* Animated Progress Bar with Dynamic Zone Styling */}
                        <div className={cn("relative", currentBalanceZone !== 'safe' && zoneStyles.animation)}>
                            <Progress
                                value={currentBalancePercentage}
                                className="h-8 bg-muted/20"
                                indicatorClassName={cn(zoneStyles.progressColor)}
                            />

                            {/* Enhanced Glow Effect for Different Zones */}
                            {connectionState.isConnected && (energyState?.energyRatePerSecond || 0) > 0 && (
                                <div
                                    className="absolute inset-0 h-8 rounded-full pointer-events-none"
                                    style={{
                                        background: `radial-gradient(ellipse at center, ${zoneStyles.glowColor} 0%, transparent 70%)`,
                                        filter: 'blur(12px)',
                                        animation: currentBalanceZone !== 'safe' ? 'pulse 1.5s infinite' : 'none'
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
                                    currentBalanceZone === 'safe' ? "text-foreground/90" : "text-white font-bold"
                                )}>
                                    {energyState ? (
                                        <AnimatedCounter
                                            value={energyState.currentEnergyBalance / Math.pow(10, energyMetadata?.decimals || 6)}
                                            decimals={2}
                                            suffix=" Energy"
                                            duration={0.5}
                                        />
                                    ) : (
                                        <span>-- Energy</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Real-Time Status Information */}
                        <div className="grid grid-cols-1 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>
                                    Last Harvest: {energyState ?
                                        new Date(energyState.lastHarvestTimestamp).toLocaleTimeString() :
                                        '--'
                                    }
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-muted-foreground" />
                                <span>
                                    Rate: {energyState ?
                                        formatEnergyValue(energyState.energyRatePerSecond * 3600) + '/hour' :
                                        '--'
                                    }
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Battery className={cn(
                                    "h-4 w-4",
                                    currentBalanceZone === 'overflow' ? 'text-red-500' : 'text-muted-foreground'
                                )} />
                                <span className={cn(
                                    currentBalanceZone === 'overflow' && 'text-red-500 font-bold'
                                )}>
                                    {currentBalancePercentage >= 100 ? 'CAPACITY FULL' : (
                                        energyState ? `Full in: ${formatTimeDuration(energyState.timeToCapacity)}` : '--'
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Energy Waste Calculator */}
                        {currentBalanceZone === 'overflow' && energyState && energyState.energyWasteRate > 0 && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <div className="flex items-center gap-2 text-red-400 text-sm">
                                    <span className="font-semibold">⚠️ Energy Being Wasted:</span>
                                    <span className="font-mono">
                                        {formatEnergyValue(energyState.energyWasteRate * 60)}/minute
                                    </span>
                                    <span className="text-xs text-red-300">
                                        ({formatEnergyValue(energyState.energyWasteRate * 3600)}/hour)
                                    </span>
                                </div>
                                <div className="text-xs text-red-300 mt-1">
                                    Harvest now to resume earning! Every second at full capacity wastes potential rewards.
                                </div>
                            </div>
                        )}

                        {/* Real-Time Status Summary */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                            {!walletState.connected && (
                                <Alert className="flex-1 ml-4">
                                    <AlertDescription className="text-xs">
                                        Connect your wallet to view real-time energy tracking
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </div>

                    {/* Smart Energy Management - Right Column */}
                    {connectionState.isConnected && energyState && (energyState?.energyRatePerSecond || 0) > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Settings2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Smart Energy Management</span>
                            </div>

                            {(() => {
                                const BURN_AMOUNT = 1000000000; // 1000 energy in micro-units
                                const currentEnergyBalance = energyState.currentEnergyBalance || 0;
                                const accumulatedEnergy = energyState.accumulatedSinceLastHarvest || 0;
                                const maxSpendable = Math.floor(currentEnergyBalance);
                                const currentCapacityPercent = (currentEnergyBalance / energyState.maxCapacity) * 100;
                                const hasEnergyToSpend = currentEnergyBalance >= BURN_AMOUNT; // Must have at least 1000 energy to burn
                                const hasEnergyToHarvest = accumulatedEnergy >= BURN_AMOUNT; // Has accumulated energy ready to harvest

                                // Case 1: At capacity but need to harvest first
                                if (currentCapacityPercent >= 95 && hasEnergyToHarvest && !hasEnergyToSpend) {
                                    return (
                                        <div className="border-2 border-orange-500/50 bg-orange-500/10 rounded-lg p-4 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="font-semibold text-orange-700">Harvest Energy First!</div>
                                                    <div className="text-sm text-orange-600 mt-1">
                                                        You have {(accumulatedEnergy / 1000000).toFixed(1)} energy ready to harvest
                                                    </div>
                                                    <div className="text-xs text-orange-500/80 mt-1">
                                                        Tap the engine buttons above to collect your energy, then you can spend it
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // Case 2: Full energy and has spendable energy - prompt to spend
                                if (currentCapacityPercent >= 95 && hasEnergyToSpend) {
                                    return (
                                        <div className="border-2 border-red-500/50 bg-red-500/10 rounded-lg p-4 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="font-semibold text-red-700">Energy Full!</div>
                                                    <div className="text-sm text-red-600 mt-1">
                                                        Spend energy to avoid overflow waste
                                                    </div>
                                                    <div className="text-xs text-red-500/80 mt-1">
                                                        Can spend up to {(maxSpendable / 1000000).toFixed(1)} energy • Burns 1000 energy per transaction
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                className="w-full h-12 text-base font-bold"
                                                variant={burnSuccess ? "secondary" : "destructive"}
                                                onClick={handleBurnEnergy}
                                                disabled={isBurning || !walletState.connected}
                                            >
                                                {isBurning ? (
                                                    <>
                                                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border border-current border-t-transparent" />
                                                        Burning Energy...
                                                    </>
                                                ) : burnSuccess ? (
                                                    <>
                                                        <Flame className="h-4 w-4 mr-2" />
                                                        Energy Burned!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Flame className="h-5 w-5 mr-2" />
                                                        Burn Energy Now
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                }

                                // Case 3: Critical level but need to harvest first
                                if (currentCapacityPercent >= 85 && hasEnergyToHarvest && !hasEnergyToSpend) {
                                    return (
                                        <div className="border border-orange-400/50 bg-orange-400/5 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                <div className="font-medium text-orange-700">Harvest Available Energy</div>
                                            </div>
                                            <div className="text-sm text-orange-600">
                                                {(accumulatedEnergy / 1000000).toFixed(1)} energy ready to collect
                                            </div>
                                            <div className="text-xs text-orange-500/80 mt-1">
                                                Tap engines above to harvest, then spend to avoid waste
                                            </div>
                                        </div>
                                    );
                                }

                                // Case 4: Critical level and has spendable energy
                                if (currentCapacityPercent >= 85 && hasEnergyToSpend) {
                                    return (
                                        <div className="border border-red-400/50 bg-red-400/5 rounded-lg p-4 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <div className="font-medium text-red-600">Critical Level!</div>
                                                    <div className="text-sm text-red-500 mt-1">
                                                        Energy nearly full at {currentCapacityPercent.toFixed(1)}%
                                                    </div>
                                                    <div className="text-xs text-red-400/80 mt-1">
                                                        Spend energy soon to avoid waste
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                className="w-full h-10"
                                                variant={burnSuccess ? "secondary" : "outline"}
                                                onClick={handleBurnEnergy}
                                                disabled={isBurning || !walletState.connected}
                                            >
                                                {isBurning ? (
                                                    <>
                                                        <div className="h-3 w-3 mr-2 animate-spin rounded-full border border-current border-t-transparent" />
                                                        Burning...
                                                    </>
                                                ) : burnSuccess ? (
                                                    <>
                                                        <Flame className="h-3 w-3 mr-2" />
                                                        Burned!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Flame className="h-4 w-4 mr-2" />
                                                        Burn Energy
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                }

                                // Case 5: Warning level - only if user has energy to spend
                                if (currentCapacityPercent >= 60 && hasEnergyToSpend) {
                                    return (
                                        <div className="border border-yellow-500/40 bg-yellow-500/5 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                                <div className="font-medium text-yellow-700">Monitor Energy Levels</div>
                                            </div>
                                            <div className="text-sm text-yellow-600">
                                                {currentCapacityPercent.toFixed(1)}% capacity
                                            </div>
                                            <div className="text-xs text-yellow-500/80 mt-1">
                                                Consider spending energy soon
                                            </div>
                                        </div>
                                    );
                                }

                                // Case 6: Has energy to harvest but not critical
                                if (hasEnergyToHarvest && !hasEnergyToSpend) {
                                    return (
                                        <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-4 text-center">
                                            <div className="text-blue-600 font-medium mb-1">💰 Energy Ready to Harvest</div>
                                            <div className="text-sm text-blue-500">
                                                {(accumulatedEnergy / 1000000).toFixed(1)} energy available to collect
                                            </div>
                                            <div className="text-xs text-blue-400/80 mt-1">
                                                Tap the engine buttons above to collect your energy
                                            </div>
                                        </div>
                                    );
                                }

                                // Case 7: Safe operation or no energy to spend/harvest
                                return (
                                    <div className="border border-green-500/30 bg-green-500/5 rounded-lg p-4 text-center">
                                        <div className="text-green-600 font-medium mb-1">✅ Energy Levels Optimal</div>
                                        <div className="text-sm text-green-500">
                                            {hasEnergyToSpend ? 'Continue accumulating' : hasEnergyToHarvest ? 'Tap engines to collect energy' : 'Energy generating normally'}
                                        </div>
                                        <div className="text-xs text-green-400/80 mt-1">
                                            Current: {currentCapacityPercent.toFixed(1)}% capacity
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Contract Info */}
                            <div className="bg-muted/50 rounded-lg p-3 border border-muted/60">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-muted-foreground">Burn Contract</span>
                                    <code className="text-xs bg-background px-2 py-1 rounded border">hooter-farm-x10</code>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Burns 1000 energy → Generates HOOT tokens
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </EnergyFlowVisualization>
    );
}

// Export with both names for backwards compatibility
export { EnergyTracker as EnergySimulation };