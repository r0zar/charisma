'use client';

import { useState, useEffect, useRef } from 'react';
import { Zap, Droplets, ArrowRight, Settings2, TrendingUp, AlertTriangle, Flame, Coins, HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchHoldToEarnVaults, fetchEngineRates } from '@/lib/server/energy';
import { getTokenMetadataCached } from '@repo/tokens';
import { request } from '@stacks/connect';
import { useApp } from '@/lib/context/app-context';

interface EnergyEngine {
    id: string;
    name: string;
    tokenSymbol: string;
    tokenName: string;
    contractId: string;
    engineContractId: string;
    contributionRate: number;
    isActive: boolean;
    color: string;
    image?: string;
    isHarvesting?: boolean;
    harvestSuccess?: boolean;
    // Per-engine accumulated energy tracking
    accumulatedEnergy?: number;
    lastHarvestTimestamp?: number;
    timeSinceLastHarvest?: number;
    lastTappedBlock?: number;
}

interface EnergyTankProps {
    currentEnergy: number; // Total harvestable energy (for tank visualization)
    currentBalance: number; // Actual spendable energy balance (for capacity warnings)
    maxCapacity: number;
    baseCapacity?: number; // Base capacity without NFT bonuses
    bonusCapacity?: number; // Additional capacity from Memobots
    totalEnergyRate: number;
    isGenerating: boolean;
    capacityZone: 'safe' | 'warning' | 'critical' | 'overflow';
    engineAccumulations?: Record<string, number>; // Per-engine accumulated energy from SSE
    onEnergyHarvested?: (amount: number, engineContractId?: string) => void;
}

export function EnergyTankVisualization({
    currentEnergy,
    currentBalance,
    maxCapacity,
    baseCapacity = maxCapacity,
    bonusCapacity = 0,
    totalEnergyRate,
    isGenerating,
    capacityZone,
    engineAccumulations = {},
    onEnergyHarvested
}: EnergyTankProps) {
    const [engines, setEngines] = useState<EnergyEngine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [harvestingEngines, setHarvestingEngines] = useState<Set<string>>(new Set());
    const [successEngines, setSuccessEngines] = useState<Set<string>>(new Set());
    const [engineHarvestTimestamps, setEngineHarvestTimestamps] = useState<Record<string, number>>({});
    const [engineLastBlocks, setEngineLastBlocks] = useState<Record<string, number>>({});
    const [currentBlock, setCurrentBlock] = useState<number | null>(null);
    const { walletState } = useApp();

    // Fetch current Stacks block height
    const fetchCurrentBlock = async () => {
        try {
            const response = await fetch('https://api.hiro.so/v2/info');
            const data = await response.json();
            setCurrentBlock(data.stacks_tip_height);
            return data.stacks_tip_height;
        } catch (error) {
            console.warn('Failed to fetch current block height:', error);
            return null;
        }
    };

    // Update current block every 5 seconds
    useEffect(() => {
        fetchCurrentBlock();
        const interval = setInterval(fetchCurrentBlock, 5000);
        return () => clearInterval(interval);
    }, []);

    // Load persisted engine last blocks from localStorage
    useEffect(() => {
        const savedBlocks = localStorage.getItem('engine-last-blocks');
        if (savedBlocks) {
            try {
                const parsed = JSON.parse(savedBlocks);
                setEngineLastBlocks(parsed);
                console.log('Loaded saved engine blocks:', parsed);
            } catch (error) {
                console.warn('Failed to parse saved engine blocks:', error);
            }
        }
    }, []);

    // Save engine last blocks to localStorage whenever it changes
    useEffect(() => {
        if (Object.keys(engineLastBlocks).length > 0) {
            localStorage.setItem('engine-last-blocks', JSON.stringify(engineLastBlocks));
            console.log('Saved engine blocks to localStorage:', engineLastBlocks);
        }
    }, [engineLastBlocks]);

    // Update engines with SSE-provided accumulated energy data or fallback calculation
    useEffect(() => {
        const hasEngineAccumulations = Object.keys(engineAccumulations).length > 0;
        
        if (hasEngineAccumulations) {
            // Use SSE-provided per-engine accumulated data
            setEngines(prevEngines =>
                prevEngines.map(engine => ({
                    ...engine,
                    accumulatedEnergy: engineAccumulations[engine.engineContractId] || 0,
                    lastTappedBlock: engineLastBlocks[engine.engineContractId]
                }))
            );
        } else {
            // Fallback: restore local calculation until backend provides per-engine data
            const now = Date.now();
            setEngines(prevEngines =>
                prevEngines.map(engine => {
                    if (!engine.isActive || engine.contributionRate <= 0) {
                        return { ...engine, accumulatedEnergy: 0, lastTappedBlock: engineLastBlocks[engine.engineContractId] };
                    }

                    // Simple time-based accumulation (fallback calculation)
                    const lastHarvest = engineHarvestTimestamps[engine.engineContractId] || now;
                    const timeSinceLastHarvest = Math.max(0, (now - lastHarvest) / 1000); // seconds
                    const accumulatedEnergy = timeSinceLastHarvest * engine.contributionRate;

                    return {
                        ...engine,
                        accumulatedEnergy: Math.round(accumulatedEnergy),
                        lastTappedBlock: engineLastBlocks[engine.engineContractId]
                    };
                })
            );
        }
    }, [engineAccumulations, engineLastBlocks, engineHarvestTimestamps, isGenerating]);
    
    // Fallback real-time update when SSE doesn't provide per-engine data
    useEffect(() => {
        const hasEngineAccumulations = Object.keys(engineAccumulations).length > 0;
        if (hasEngineAccumulations || !isGenerating || engines.length === 0) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setEngines(prevEngines =>
                prevEngines.map(engine => {
                    if (!engine.isActive || engine.contributionRate <= 0) {
                        return { ...engine, accumulatedEnergy: 0 };
                    }

                    const lastHarvest = engineHarvestTimestamps[engine.engineContractId] || now;
                    const timeSinceLastHarvest = Math.max(0, (now - lastHarvest) / 1000);
                    const accumulatedEnergy = timeSinceLastHarvest * engine.contributionRate;

                    return {
                        ...engine,
                        accumulatedEnergy: Math.round(accumulatedEnergy)
                    };
                })
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [engineAccumulations, isGenerating, engines.length, engineHarvestTimestamps]);

    // Load real energy engines from the vault system
    useEffect(() => {
        loadRealEnergyEngines();
    }, [totalEnergyRate]);

    const loadRealEnergyEngines = async () => {
        try {
            setIsLoading(true);
            const [energyVaults, engineRates] = await Promise.all([
                fetchHoldToEarnVaults(),
                fetchEngineRates()
            ]);

            if (!energyVaults || energyVaults.length === 0) {
                console.warn('No energy vaults found');
                setEngines([]);
                return;
            }

            // Create engines from real vault data with individual rates
            const realEngines: EnergyEngine[] = [];
            const colors = [
                'from-orange-400 to-orange-600',
                'from-green-400 to-green-600',
                'from-purple-400 to-purple-600',
                'from-blue-400 to-blue-600',
                'from-red-400 to-red-600',
                'from-yellow-400 to-yellow-600'
            ];

            for (let i = 0; i < energyVaults.length; i++) {
                const vault = energyVaults[i];

                // Get token metadata for better display
                let tokenData;
                try {
                    tokenData = await getTokenMetadataCached(vault.base);
                } catch (error) {
                    console.warn(`Could not load token metadata for ${vault.base}`);
                    tokenData = {
                        name: vault.name.replace(' Energize', ''),
                        symbol: vault.name.split(' ')[0].toUpperCase(),
                        contractId: vault.base
                    };
                }

                // Create better display names for engines with robust fallbacks
                const getEngineName = (vault: any, tokenData: any) => {
                    console.log(`🔍 Naming debug for vault "${vault.name}":`, {
                        tokenSymbol: tokenData.symbol,
                        tokenName: tokenData.name,
                        vaultName: vault.name
                    });

                    // Create clean token symbol mapping
                    const getCleanSymbol = (symbol: string, name: string) => {
                        const symbolMap: Record<string, string> = {
                            'charismatic-flow-v2': 'FLOW',
                            'perseverantia-omnia-vincit-v2': 'POV',
                            'dexterity-pool-v1': 'DEX',
                            'DEX': 'DEX'
                        };

                        return symbolMap[symbol] || symbolMap[name] || symbol;
                    };

                    // Create clean engine names with robust fallbacks
                    const cleanSymbol = getCleanSymbol(tokenData.symbol, tokenData.name);
                    const engineNameMap: Record<string, string> = {
                        'FLOW': 'Charismatic Flow',
                        'POV': 'Perseverantia',
                        'DEX': 'Dexterity'
                    };

                    // Use mapped name, fallback to token name, then vault name as last resort
                    let engineName = engineNameMap[cleanSymbol] || tokenData.name || vault.name.replace(' Energize', '').replace('Energize', '');

                    // Ensure we never return just "Engine"
                    if (!engineName || engineName.trim() === '') {
                        engineName = 'Unknown';
                    }

                    const finalName = `${engineName} Engine`;
                    console.log(`🎯 Final engine name: "${finalName}"`);
                    return finalName;
                };

                // Get real engine rate from analytics data
                const contributionRate = engineRates[vault.engineContractId] || 0;

                // Create clean token symbol for display
                const cleanSymbol = (() => {
                    const symbolMap: Record<string, string> = {
                        'charismatic-flow-v2': 'FLOW',
                        'perseverantia-omnia-vincit-v2': 'POV',
                        'dexterity-pool-v1': 'DEX',
                        'DEX': 'DEX'
                    };
                    return symbolMap[tokenData.symbol] || symbolMap[tokenData.name] || tokenData.symbol;
                })();

                realEngines.push({
                    id: vault.engineContractId.split('.')[1], // Use contract name as ID
                    name: getEngineName(vault, tokenData),
                    tokenSymbol: cleanSymbol,
                    tokenName: tokenData.name,
                    contractId: vault.contractId,
                    engineContractId: vault.engineContractId,
                    contributionRate,
                    isActive: contributionRate > 0 && isGenerating,
                    color: colors[i % colors.length],
                    image: vault.image
                });
            }

            setEngines(realEngines);

            // Initialize harvest timestamps for new engines (if not already set)
            const now = Date.now();
            setEngineHarvestTimestamps(prev => {
                const newTimestamps = { ...prev };
                for (const engine of realEngines) {
                    if (!newTimestamps[engine.engineContractId]) {
                        newTimestamps[engine.engineContractId] = now;
                    }
                }
                return newTimestamps;
            });
        } catch (error) {
            console.error('Error loading real energy engines:', error);
            // Fallback to empty array
            setEngines([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Harvest energy from specific engine
    const handleHarvestEngine = async (engineContractId: string) => {
        console.log(`🎯 handleHarvestEngine called for: ${engineContractId}`);

        if (!walletState.connected || !walletState.address) {
            console.error('Wallet not connected');
            return;
        }

        try {
            setHarvestingEngines(prev => new Set(Array.from(prev).concat(engineContractId)));

            // Record the current block BEFORE the transaction attempt
            const blockHeight = await fetchCurrentBlock();
            console.log(`🧱 Current block height: ${blockHeight}`);

            if (blockHeight) {
                console.log(`📝 Recording block ${blockHeight} for engine ${engineContractId}`);
                setEngineLastBlocks(prev => {
                    const newState = {
                        ...prev,
                        [engineContractId]: blockHeight
                    };
                    console.log('🔄 Updated engineLastBlocks state:', newState);
                    return newState;
                });
            }

            const response = await request('stx_callContract', {
                contract: engineContractId as any,
                functionName: 'tap',
                functionArgs: [],
                network: 'mainnet'
            });

            console.log('Harvest transaction response:', response);

            // Mark as successful
            setSuccessEngines(prev => new Set(Array.from(prev).concat(engineContractId)));

            // Reset this engine's harvest timestamp (optimistic update)
            const harvestTime = Date.now();
            setEngineHarvestTimestamps(prev => ({
                ...prev,
                [engineContractId]: harvestTime
            }));

            // Optimistic update - estimate harvested energy (1000 energy typical harvest)
            const harvestedAmount = 1000000000; // 1000 energy in micro-units
            if (onEnergyHarvested) {
                onEnergyHarvested(harvestedAmount, engineContractId);
            }

            // Reset success state after 3 seconds
            setTimeout(() => {
                setSuccessEngines(prev => {
                    const newSet = new Set(Array.from(prev));
                    newSet.delete(engineContractId);
                    return newSet;
                });
            }, 3000);

        } catch (error) {
            console.error('Engine harvest failed:', error);
        } finally {
            setHarvestingEngines(prev => {
                const newSet = new Set(Array.from(prev));
                newSet.delete(engineContractId);
                return newSet;
            });
        }
    };

    // Calculate the maximum rate for relative bar sizing
    const maxEngineRate = Math.max(...engines.map(e => e.contributionRate), 1); // Min 1 to avoid division by 0

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
                    animation: ''
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

        if (adjustedValue < 10) {
            // Show up to 2 decimal places for values less than 10
            return adjustedValue.toLocaleString(undefined, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 0
            });
        } else {
            // Show whole numbers for values >= 10
            return Math.round(adjustedValue).toLocaleString();
        }
    };

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Energy Collective System</h3>
                        <p className="text-sm text-muted-foreground">Multiple engines feeding central energy tank</p>
                    </div>
                </div>
                
                {/* Current Stacks Block */}
                <div className="text-right">
                    <div className="text-xs text-muted-foreground">Current Block</div>
                    <div className="text-sm font-mono font-semibold">
                        {currentBlock ? `#${currentBlock.toLocaleString()}` : 'Loading...'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 grow">
                {/* Energy Engines Grid */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Hold-to-Earn Energy Engines</span>
                        {isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
                        ) : (
                            <Badge variant="outline">{engines.filter(e => e.isActive).length} of {engines.length}</Badge>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="token-card p-4">
                            <div className="flex items-center gap-3">
                                <div className="h-3 w-3 bg-muted rounded-full animate-pulse" />
                                <div>
                                    <div className="h-4 w-24 bg-muted rounded animate-pulse mb-1" />
                                    <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ) : engines.length === 0 ? (
                        <div className="token-card p-4 text-center">
                            <div className="text-sm text-muted-foreground">No energy engines found</div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
                            {engines.map((engine) => {
                            const isHarvesting = harvestingEngines.has(engine.engineContractId);
                            const isSuccess = successEngines.has(engine.engineContractId);
                            const canHarvest = walletState.connected && engine.isActive && !isHarvesting;

                            // Check if user is at capacity - use currentBalance (spendable balance) not currentEnergy (harvestable)
                            const currentBalancePercentage = maxCapacity > 0 ? (currentBalance / maxCapacity) * 100 : 0;
                            const isAtCapacity = currentBalancePercentage >= 95; // 95% threshold for warnings
                            const willWasteEnergy = isAtCapacity && canHarvest;

                            return (
                                <div
                                    key={engine.id}
                                    className={cn(
                                        "token-card p-4 transition-all duration-300 relative group",
                                        engine.isActive ? "border-primary/30" : "border-muted/30 opacity-60",
                                        canHarvest && "cursor-pointer hover:border-primary/60 hover:shadow-lg hover:bg-primary/5 hover:scale-[1.02] hover:-translate-y-1",
                                        isHarvesting && "bg-yellow-500/10 border-yellow-500/50",
                                        isSuccess && "bg-green-500/10 border-green-500/50",
                                        !walletState.connected && "opacity-50"
                                    )}
                                    onClick={() => canHarvest && handleHarvestEngine(engine.engineContractId)}
                                    title={canHarvest ?
                                        willWasteEnergy ?
                                            `⚠️ Wallet at capacity! Tap to harvest energy from ${engine.name} (energy may be wasted)` :
                                            `Tap to harvest energy from ${engine.name}` :
                                        !walletState.connected ? 'Connect wallet to harvest' :
                                            !engine.isActive ? 'Engine inactive' :
                                                isHarvesting ? 'Tapping in progress...' :
                                                    'Cannot harvest right now'}
                                >
                                    {/* Hover glow effect */}
                                    {canHarvest && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                    )}

                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-3">
                                            {/* Vault Image with status indicator */}
                                            <div className="relative">
                                                <div className="h-8 w-8 rounded-full overflow-hidden bg-muted/20 flex items-center justify-center">
                                                    {engine.image ? (
                                                        <img
                                                            src={engine.image}
                                                            alt={engine.name}
                                                            className="h-full w-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                const parent = e.currentTarget.parentElement;
                                                                if (parent) {
                                                                    parent.innerHTML = `<div class="h-3 w-3 rounded-full ${engine.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}"></div>`;
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className={cn(
                                                            "h-3 w-3 rounded-full transition-all duration-300",
                                                            engine.isActive ? "bg-green-500 animate-pulse" : "bg-gray-400",
                                                            canHarvest && "group-hover:bg-primary"
                                                        )} />
                                                    )}
                                                </div>

                                                {/* Status indicator overlay */}
                                                {isHarvesting && (
                                                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                                        <div className="h-2 w-2 bg-white rounded-full animate-ping" />
                                                    </div>
                                                )}
                                                {isSuccess && (
                                                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                                                        <Zap className="h-2 w-2 text-white" />
                                                    </div>
                                                )}
                                            </div>

                                            <div>
                                                <div className="font-medium text-sm flex items-center gap-2">
                                                    {engine.name}
                                                    {isHarvesting && (
                                                        <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                                                    )}
                                                    {isSuccess && (
                                                        <Zap className="h-3 w-3 text-green-500 animate-pulse" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Hold {engine.tokenSymbol} tokens
                                                    {canHarvest && (
                                                        <span className={cn(
                                                            "opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-1",
                                                            willWasteEnergy ? "text-orange-500" : "text-primary"
                                                        )}>
                                                            • {willWasteEnergy ? 'Click to tap (may waste energy)' : 'Click to tap'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Last Tapped Block */}
                                            <div className="text-right">
                                                <div className="text-xs text-muted-foreground">Last Tap</div>
                                                <div className="text-sm font-mono text-muted-foreground">
                                                    {engine.lastTappedBlock ? `#${engine.lastTappedBlock.toLocaleString()}` : 'Never'}
                                                </div>
                                            </div>

                                            {/* Per-Engine Accumulated Energy */}
                                            <div className="text-right">
                                                <div className="text-xs text-muted-foreground">Accumulated</div>
                                                <div className={cn(
                                                    "text-sm font-mono font-semibold transition-colors duration-300",
                                                    engine.accumulatedEnergy && engine.accumulatedEnergy > 0 ? "text-green-400" : "text-muted-foreground"
                                                )}>
                                                    {engine.accumulatedEnergy ? formatEnergy(engine.accumulatedEnergy) : '0'}
                                                </div>
                                            </div>

                                            {/* Contribution Rate */}
                                            <div className="text-right">
                                                <div className="text-xs text-muted-foreground">Rate</div>
                                                <div className="text-sm font-mono font-semibold">
                                                    {formatEnergy(engine.contributionRate)}/s
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Engine Rate Progress Bar */}
                                    {engine.isActive && (
                                        <div className="mt-3 relative z-10">
                                            <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                                                <div
                                                    className={cn(
                                                        "h-full bg-gradient-to-r transition-all duration-1000",
                                                        engine.color,
                                                        isGenerating && "animate-pulse",
                                                    )}
                                                    style={{
                                                        width: `${Math.min((engine.contributionRate / maxEngineRate) * 100, 100)}%`,
                                                        boxShadow: canHarvest ? `0 0 10px ${engine.color.includes('orange') ? '#f97316' : engine.color.includes('green') ? '#10b981' : '#8b5cf6'}` : 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        </div>
                    )}
                </div>

            </div>

            {/* Collective Stats Summary - Moved to bottom */}
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