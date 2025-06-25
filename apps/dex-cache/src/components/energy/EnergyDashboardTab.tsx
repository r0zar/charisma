'use client';

import { useState, useEffect, useRef } from 'react';
import { request } from '@stacks/connect';
import { Wifi, WifiOff, Zap, Battery, Clock, AlertTriangle, Settings2, Flame, TrendingUp, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { getTokenMetadataCached, listPrices, type TokenCacheData, type KraxelPriceData } from '@repo/tokens';
import { useApp } from '@/lib/context/app-context';
import { getAccountBalances } from '@repo/polyglot';
import { EnergyTankVisualization } from '@/components/admin/energy/EnergyTankVisualization';
import { EnergyFlowVisualization, AnimatedCounter } from '@/components/admin/energy/EnergyParticles';
import { NFTBonusDisplay } from '@/components/admin/energy/NFTBonusDisplay';
import { useNFTBonuses } from '@/lib/nft-service';
import { formatEnergyValue, formatTimeDuration, getCapacityZoneStyles, type RealTimeEnergyData } from '@/lib/energy/real-time';
import { ENERGY_TOKENS } from '@/lib/energy/price-service';
import {
    calculateEnergyAPY,
    formatAPY,
    formatDailyProfit,
    getAPYColorClass,
    getConfidenceIndicator,
    type APYCalculationResult,
    type TokenHolding
} from '@/lib/energy/apy-calculator';

// Helper function to format energy values - show decimals for values < 10
const formatEnergy = (rawValue: number): string => {
    const divisor = Math.pow(10, 6); // 6 decimals for energy
    const adjustedValue = rawValue / divisor;

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

export function EnergyDashboardTab() {
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

    // Energy token prices and APY calculations
    const [energyPrices, setEnergyPrices] = useState<Record<string, number> | null>(null);
    const [apyData, setApyData] = useState<APYCalculationResult | null>(null);


    // Optimistic updates tracking using ref to avoid re-render dependency issues
    const optimisticUpdatesRef = useRef({
        balanceIncrease: 0,
        harvestableDecrease: 0,
        engineAccumulatedDecrease: {} as Record<string, number>, // Track per-engine accumulated decreases
        pendingTaps: new Map<string, number>() // track pending taps by transaction ID
    });

    // Wallet connection
    const { walletState } = useApp();

    // Token balances for APY calculation
    const [balances, setBalances] = useState<Record<string, number> | null>(null);

    // Fetch token balances for APY calculation
    useEffect(() => {
        if (!walletState.address) {
            setBalances(null);
            return;
        }

        const fetchBalances = async () => {
            try {
                const accountData = await getAccountBalances(walletState.address);

                if (accountData?.fungible_tokens) {
                    const tokenBalances: Record<string, number> = {};

                    // Extract fungible token balances
                    for (const [tokenId, data] of Object.entries(accountData.fungible_tokens)) {
                        if (typeof data === 'object' && data && 'balance' in data) {
                            tokenBalances[tokenId] = Number(data.balance);
                        }
                    }

                    setBalances(tokenBalances);
                } else {
                    setBalances({});
                }
            } catch (error) {
                setBalances({});
            }
        };

        fetchBalances();
    }, [walletState.address]);

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

    // Fetch energy token prices
    const fetchPrices = async () => {
        try {
            console.log('[Price Debug] Fetching energy token prices...');
            const result = await listPrices();
            setEnergyPrices(result);
        } catch (error) {
            console.error('Failed to fetch energy token prices:', error);
        }
    };

    // Initial price fetch and periodic updates
    useEffect(() => {
        console.log('[Price Debug] Starting price fetch effect...');

        // Test if the import is working
        console.log('[Price Debug] fetchEnergyTokenPricesSmart function:', typeof fetchEnergyTokenPricesSmart);

        // Try immediate execution with more error handling
        (async () => {
            try {
                console.log('[Price Debug] About to call fetchPrices...');
                await fetchPrices();
                console.log('[Price Debug] fetchPrices completed');
            } catch (error) {
                console.error('[Price Debug] fetchPrices error:', error);
            }
        })();

        const interval = setInterval(() => {
            console.log('[Price Debug] Interval price fetch...');
            fetchPrices();
        }, 5 * 60 * 1000); // Every 5 minutes
        return () => clearInterval(interval);
    }, []);

    // Calculate derived values from energy state
    // For Energy Capacity section: show current spendable balance vs max capacity
    const currentBalancePercentage = energyState && energyState.maxCapacity > 0 ?
        Math.min(((energyState.currentEnergyBalance || 0) / energyState.maxCapacity) * 100, 100) : 0;

    // Determine capacity zone based on CURRENT BALANCE, not harvestable energy
    const currentBalanceZone: 'safe' | 'warning' | 'critical' | 'overflow' =
        currentBalancePercentage >= 100 ? 'overflow' :
            currentBalancePercentage >= 85 ? 'critical' :
                currentBalancePercentage >= 60 ? 'warning' : 'safe';

    // For tank visualization: show total harvestable energy vs max capacity
    const harvestablePercentage = energyState && energyState.maxCapacity > 0 ?
        Math.min(((energyState.totalHarvestableEnergy || 0) / energyState.maxCapacity) * 100, 100) : 0;

    // Determine capacity zone for tank visualization based on HARVESTABLE energy
    const harvestableZone: 'safe' | 'warning' | 'critical' | 'overflow' =
        harvestablePercentage >= 100 ? 'overflow' :
            harvestablePercentage >= 85 ? 'critical' :
                harvestablePercentage >= 60 ? 'warning' : 'safe';

    // NFT Bonuses
    const { bonuses: nftBonuses, isLoading: nftLoading } = useNFTBonuses(walletState.address);

    // Calculate bonus values with defaults
    const baseCapacity = 100000000; // 100 energy in micro-units
    const actualCapacityBonus = nftBonuses?.capacityBonus || 0;
    const bonusCapacity = actualCapacityBonus;

    // Convert balances to TokenHolding format for APY calculation
    const getTokenHoldings = async (): Promise<TokenHolding[]> => {
        if (!balances || typeof balances !== 'object') {
            return [];
        }

        const holdings: TokenHolding[] = [];

        // Map contract IDs to symbols and extract balances - fetch metadata in parallel
        const tokenMappings = await Promise.all([
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1'),
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl'),
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'),
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy'),
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow'),
            getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit'),
            // Add other energy-generating tokens as needed
        ]);

        for (const token of tokenMappings) {
            if (!token?.contractId) {
                continue;
            }

            // Try multiple possible identifier formats based on known patterns
            const contractName = token.contractId.split('.')[1];
            const possibleIdentifiers = [
                // Known specific mappings for Charisma tokens
                contractName === 'hooter-the-owl' ? 'hooter' : null,
                contractName === 'dexterity-pool-v1' ? 'DEX' : null,
                contractName === 'dexterity-token' ? 'DEX' : null,
                contractName === 'charisma-token' ? 'charisma' : null,
                contractName === 'energy' ? 'energy' : null,
                contractName === 'charismatic-flow' ? 'SXC' : null,
                contractName === 'perseverantia-omnia-vincit' ? 'POV' : null,
                // Fallback to standard patterns
                token.identifier,
                token.symbol?.toLowerCase(),
                token.symbol,
                token.name?.toLowerCase(),
                contractName
            ].filter(Boolean);


            let foundBalance = 0;
            let foundKey = '';

            // Try each possible balance key format
            for (const identifier of possibleIdentifiers) {
                const balanceKey = `${token.contractId}::${identifier}`;
                const balance = balances[balanceKey];



                if (balance && typeof balance === 'number' && balance > 0) {
                    foundBalance = balance;
                    foundKey = balanceKey;
                    break;
                }
            }



            if (foundBalance > 0) {
                // Convert from micro-units to human-readable units
                const humanReadableAmount = foundBalance / Math.pow(10, 6);

                // Ensure we have a proper symbol - map from contract name if symbol is missing
                let symbol = token.symbol as string;
                if (!symbol || symbol.trim() === '') {
                    const contractName = token.contractId.split('.')[1];
                    switch (contractName) {
                        case 'hooter-the-owl':
                            symbol = 'HOOT';
                            break;
                        case 'dexterity-pool-v1':
                        case 'dexterity-token':
                            symbol = 'DEX';
                            break;
                        case 'charisma-token':
                            symbol = 'CHARISMA';
                            break;
                        case 'energy':
                            symbol = 'ENERGY';
                            break;
                        case 'charismatic-flow':
                            symbol = 'SXC';
                            break;
                        case 'perseverantia-omnia-vincit':
                            symbol = 'POV';
                            break;
                        default:
                            symbol = contractName.toUpperCase();
                    }
                }

                holdings.push({
                    symbol: symbol,
                    amount: humanReadableAmount,
                    contractId: token.contractId
                });
            }
        }
        return holdings;
    };

    useEffect(() => {
        getTokenHoldings().then(console.log);
    }, []);

    // Calculate APY when energy state, prices, or balances change
    useEffect(() => {
        if (energyState && energyPrices) {
            const calculateAPY = async () => {
                try {
                    console.log('[APY Debug] Calculating APY with energy state and prices available');

                    const tokenHoldings = await getTokenHoldings();

                    const result = calculateEnergyAPY({
                        energyData: energyState,
                        prices: energyPrices,
                        tokenHoldings,
                        nftBonuses: {
                            generationMultiplier: (nftBonuses?.energyGenerationBonus || 0) / 100, // Convert percentage to decimal
                            capacityBonus: actualCapacityBonus
                        }
                    });

                    setApyData(result);
                } catch (error) {
                    console.error('Failed to calculate APY:', error);
                    setApyData(null);
                }
            };

            calculateAPY();
        } else {
            console.log('[APY Debug] Missing data for APY calculation:', {
                hasEnergyState: !!energyState,
                hasPrices: !!energyPrices,
                energyStateKeys: energyState ? Object.keys(energyState) : [],
                pricesKeys: energyPrices ? Object.keys(energyPrices) : []
            });
            setApyData(null);
        }
    }, [energyState, energyPrices, nftBonuses, actualCapacityBonus, balances]);

    // Apply optimistic updates to energy state for display
    const getDisplayEnergyState = () => {
        if (!energyState) return null;

        const optimistic = optimisticUpdatesRef.current;

        // Ensure all values are numbers and not NaN
        const safeCurrentBalance = isNaN(energyState.currentEnergyBalance) ? 0 : (energyState.currentEnergyBalance || 0);
        const safeTotalHarvestable = isNaN(energyState.totalHarvestableEnergy) ? 0 : (energyState.totalHarvestableEnergy || 0);

        // Calculate total accumulated as sum of individual engine accumulations
        const engineAccumulations = energyState.engineAccumulations || {};
        const hasEngineAccumulations = Object.keys(engineAccumulations).length > 0;

        let safeAccumulated: number;

        if (hasEngineAccumulations) {
            // New per-engine system: sum up individual engine accumulations
            const baseAccumulated = Object.values(engineAccumulations).reduce((sum, acc) => {
                return sum + (isNaN(acc) ? 0 : acc);
            }, 0);

            // Apply optimistic per-engine decreases
            const optimisticEngineDecreases = optimistic.engineAccumulatedDecrease;
            const totalOptimisticDecrease = Object.entries(optimisticEngineDecreases).reduce((sum, [engineId, decrease]) => {
                return sum + (engineAccumulations[engineId] ? Math.min(decrease, engineAccumulations[engineId]) : 0);
            }, 0);

            safeAccumulated = Math.max(0, baseAccumulated - totalOptimisticDecrease);
        } else {
            // Fallback to old global accumulated system (for backward compatibility)
            const fallbackAccumulated = isNaN(energyState.accumulatedSinceLastHarvest) ? 0 : (energyState.accumulatedSinceLastHarvest || 0);
            // Note: For fallback, we still need to handle optimistic decreases, but we can't do it per-engine
            // So we'll sum up all per-engine decreases and apply them to the global value
            const totalOptimisticDecrease = Object.values(optimistic.engineAccumulatedDecrease).reduce((sum, decrease) => sum + decrease, 0);
            safeAccumulated = Math.max(0, fallbackAccumulated - totalOptimisticDecrease);
        }
        const safeEnergyRate = isNaN(energyState.energyRatePerSecond) ? 0 : (energyState.energyRatePerSecond || 0);
        const safeMaxCapacity = isNaN(energyState.maxCapacity) ? (baseCapacity + actualCapacityBonus) : (energyState.maxCapacity || (baseCapacity + actualCapacityBonus));

        // Calculate optimistic values with capacity constraints
        const optimisticCurrentBalance = Math.min(
            safeCurrentBalance + optimistic.balanceIncrease,
            safeMaxCapacity // Hard cap: current balance cannot exceed max capacity
        );
        const optimisticTotalHarvestable = Math.min(
            Math.max(0, safeTotalHarvestable - optimistic.harvestableDecrease),
            safeMaxCapacity // Hard cap: total harvestable cannot exceed max capacity
        );
        const optimisticAccumulated = safeAccumulated; // Already calculated with optimistic decreases above

        return {
            ...energyState,
            currentEnergyBalance: optimisticCurrentBalance,
            totalHarvestableEnergy: optimisticTotalHarvestable,
            accumulatedSinceLastHarvest: optimisticAccumulated,
            energyRatePerSecond: safeEnergyRate,
            maxCapacity: safeMaxCapacity,
        };
    };

    const displayEnergyState = getDisplayEnergyState();

    // SSE Connection management
    useEffect(() => {
        if (!walletState.address) {
            return;
        }

        let isMounted = true;
        let retryCount = 0;
        const maxRetries = 5;
        const baseDelay = 1000;

        const connectSSE = () => {
            if (!isMounted) return;

            try {
                // Close any existing connection
                if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                }

                setConnectionState(prev => ({ ...prev, isConnecting: true, error: null }));

                const eventSource = new EventSource(`/api/v1/energy/stream/${walletState.address}`);
                eventSourceRef.current = eventSource;

                eventSource.onopen = () => {
                    if (!isMounted) return;
                    console.log('✅ SSE connection established');
                    setConnectionState({
                        isConnected: true,
                        isConnecting: false,
                        error: null,
                        lastUpdate: Date.now(),
                        reconnectAttempts: retryCount
                    });
                    retryCount = 0; // Reset retry count on successful connection
                };

                eventSource.onmessage = (event) => {
                    if (!isMounted) return;
                    try {
                        const data: RealTimeEnergyData = JSON.parse(event.data);
                        setEnergyState(data);
                        setConnectionState(prev => ({ ...prev, lastUpdate: Date.now() }));
                    } catch (error) {
                        console.error('Error parsing SSE data:', error);
                    }
                };

                eventSource.onerror = (error) => {
                    if (!isMounted) return;
                    console.error('❌ SSE connection error:', error);
                    eventSource.close();

                    setConnectionState(prev => ({
                        ...prev,
                        isConnected: false,
                        isConnecting: false,
                        error: retryCount >= maxRetries ? 'Connection failed after multiple attempts' : 'Connection lost, retrying...',
                        reconnectAttempts: retryCount + 1
                    }));

                    // Exponential backoff retry
                    if (retryCount < maxRetries) {
                        const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
                        console.log(`🔄 Retrying SSE connection in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

                        reconnectTimeoutRef.current = setTimeout(() => {
                            if (isMounted) {
                                retryCount++;
                                connectSSE();
                            }
                        }, delay);
                    }
                };

            } catch (error) {
                console.error('Failed to establish SSE connection:', error);
                setConnectionState(prev => ({
                    ...prev,
                    isConnected: false,
                    isConnecting: false,
                    error: 'Failed to connect to energy stream'
                }));
            }
        };

        connectSSE();

        return () => {
            isMounted = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [walletState.address]);

    // Burn energy using hooter-farm-x10 contract
    const handleBurnEnergy = async () => {
        if (!walletState.connected || !walletState.address) {
            console.error('Wallet not connected');
            return;
        }

        const energyBalance = Math.min(displayEnergyState?.currentEnergyBalance || 0, 1000000000);

        if (energyBalance <= 0) {
            console.error('No energy to burn');
            return;
        }

        try {
            setIsBurning(true);

            // Load required token metadata
            const [hooterTheOwlToken, energyTokenMetadata] = await Promise.all([
                getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl'),
                getTokenMetadataCached('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy')
            ]);

            const hooterFarmX10Contract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm-x10';
            const hooterFarmContract = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm';

            console.log(walletState.address, energyTokenMetadata, energyBalance, hooterTheOwlToken);

            const response = await request('stx_callContract', {
                contract: hooterFarmX10Contract,
                functionName: 'claim',
                functionArgs: [uintCV(energyBalance)],
                postConditionMode: 'deny',
                postConditions: [
                    Pc.principal(walletState.address).willSendLte(energyBalance).ft(energyTokenMetadata?.contractId as any, 'energy'),
                    Pc.principal(hooterFarmContract).willSendLte(energyBalance).ft(hooterTheOwlToken?.contractId as any, 'hooter')
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

            // Update optimistic tracking - burn reduces balance
            optimisticUpdatesRef.current.balanceIncrease -= burnedAmount; // Negative increase = decrease
            optimisticUpdatesRef.current.pendingTaps.set(burnId, -burnedAmount); // Track as negative

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
            optimisticUpdatesRef.current.balanceIncrease += energyBalance;

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
        console.log(`Harvest amounts: tapped=${tappedAmount}, actual=${actualHarvestedAmount}, wasted=${wastedAmount}`);

        // Update optimistic tracking
        const balanceIncrease = actualHarvestedAmount;
        const harvestableDecrease = tappedAmount; // Total tapped energy reduces harvestable
        const accumulatedEnergyReduction = tappedAmount; // FULL tapped amount reduces accumulated energy (regardless of capacity)

        optimisticUpdatesRef.current.balanceIncrease += balanceIncrease;
        optimisticUpdatesRef.current.harvestableDecrease += harvestableDecrease;

        // Track per-engine accumulated decrease
        if (engineContractId) {
            if (!optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId]) {
                optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId] = 0;
            }
            optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId] += accumulatedEnergyReduction;
        }

        console.log(`Optimistic updates: balance +${balanceIncrease}, harvestable -${harvestableDecrease}, engine ${engineContractId} accumulated -${accumulatedEnergyReduction}`);

        // Show harvest animation
        setHarvestAnimation({ show: true, amount: actualHarvestedAmount });
        setTimeout(() => setHarvestAnimation({ show: false, amount: 0 }), 2000);

        // Clear optimistic update after a reasonable time (to handle cases where SSE doesn't update immediately)
        setTimeout(() => {
            optimisticUpdatesRef.current.balanceIncrease = Math.max(0, optimisticUpdatesRef.current.balanceIncrease - balanceIncrease);
            optimisticUpdatesRef.current.harvestableDecrease = Math.max(0, optimisticUpdatesRef.current.harvestableDecrease - harvestableDecrease);

            // Clear per-engine accumulated decrease
            if (engineContractId && optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId]) {
                optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId] = Math.max(0,
                    optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId] - accumulatedEnergyReduction);

                // Remove entry if it's now zero
                if (optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId] === 0) {
                    delete optimisticUpdatesRef.current.engineAccumulatedDecrease[engineContractId];
                }
            }

            console.log('Cleared optimistic harvest update for engine:', engineContractId);
        }, 30000); // Clear after 30 seconds
    };

    // Connection status component
    const ConnectionStatus = () => (
        <div className="flex items-center gap-2">
            {connectionState.isConnected ? (
                <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">Live</span>
                </>
            ) : connectionState.isConnecting ? (
                <>
                    <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
                    <span className="text-xs text-muted-foreground">Connecting...</span>
                </>
            ) : (
                <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-red-500">Offline</span>
                    {connectionState.reconnectAttempts > 0 && (
                        <span className="text-xs text-muted-foreground">({connectionState.reconnectAttempts} attempts)</span>
                    )}
                </>
            )}
        </div>
    );

    // Not logged in state
    if (!walletState.connected || !walletState.address) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Battery className="h-16 w-16 text-muted-foreground" />
                <h3 className="text-xl font-semibold">Connect Your Wallet</h3>
                <p className="text-muted-foreground text-center max-w-md">
                    Connect your wallet to access the real-time energy dashboard and start managing your energy generation.
                </p>
            </div>
        );
    }

    // Loading state while connecting or waiting for initial data
    if (connectionState.isConnecting || (!displayEnergyState && !connectionState.error)) {
        return (
            <div className="space-y-6">
                {/* Loading Header */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <div className="h-5 w-5 animate-spin rounded-full border border-current border-t-transparent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Loading Energy Dashboard</h3>
                            <p className="text-sm text-muted-foreground">
                                {connectionState.isConnecting ? 'Connecting to energy stream...' : 'Loading energy data...'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Loading Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="glass-card p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                            </div>
                            <div className="h-8 w-20 bg-muted rounded animate-pulse mb-1" />
                            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                        </div>
                    ))}
                </div>

                {/* Loading Energy Collective System */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-muted/20 animate-pulse" />
                        <div>
                            <div className="h-5 w-48 bg-muted rounded animate-pulse mb-2" />
                            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="token-card p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                                            <div>
                                                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-1" />
                                                <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="h-3 w-12 bg-muted rounded animate-pulse mb-1" />
                                            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="mt-3 h-1 bg-muted rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Loading Energy Management */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-lg bg-muted/20 animate-pulse" />
                        <div>
                            <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
                            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="token-card p-4">
                                <div className="h-6 w-24 bg-muted rounded animate-pulse mb-3" />
                                <div className="h-8 w-20 bg-muted rounded animate-pulse mb-2" />
                                <div className="h-3 w-16 bg-muted rounded animate-pulse mb-4" />
                                <div className="h-3 w-full bg-muted rounded animate-pulse mb-2" />
                                <div className="h-8 w-full bg-muted rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Connection Error Alert (only when there's an error) */}
            {connectionState.error && (
                <Alert className="border-red-500/20 bg-red-500/5">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <AlertDescription className="text-sm">
                        {connectionState.error}
                    </AlertDescription>
                </Alert>
            )}

            {/* Real-time Energy Statistics */}
            {displayEnergyState && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Battery className="h-4 w-4" />
                            Current Balance
                        </div>
                        <div className="text-2xl font-bold">
                            {formatEnergy(displayEnergyState.currentEnergyBalance || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            energy in wallet
                        </div>
                    </div>

                    <div className="glass-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Zap className="h-4 w-4" />
                            Generation Rate
                        </div>
                        <div className="text-2xl font-bold text-primary">
                            {formatEnergy(displayEnergyState.energyRatePerSecond || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            energy per second
                        </div>
                    </div>

                    <div className="glass-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Coins className="h-4 w-4" />
                            Daily Profit
                        </div>
                        <div className="text-2xl font-bold text-green-400">
                            {!energyPrices ? 'Loading...' :
                                !displayEnergyState ? 'No Data' :
                                    apyData ? formatDailyProfit(apyData.dailyProfit) : '$0.00'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {!energyPrices ? 'fetching prices...' :
                                energyPrices?.isStale ? 'stale prices' :
                                    !displayEnergyState?.energyRatePerSecond ? 'no generation' :
                                        'current estimate'}
                        </div>
                    </div>

                    <div className="glass-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <TrendingUp className="h-4 w-4" />
                            APY
                        </div>
                        <div className={cn(
                            "text-2xl font-bold",
                            apyData ? getAPYColorClass(apyData.apy) : 'text-gray-500'
                        )}>
                            {!energyPrices ? 'Loading...' :
                                !displayEnergyState ? 'No Data' :
                                    apyData ? formatAPY(apyData.apy) : '0.0%'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>annual yield</span>
                            {apyData && (
                                <span className={getConfidenceIndicator(apyData.confidence).color}>
                                    {getConfidenceIndicator(apyData.confidence).icon}
                                </span>
                            )}
                            {apyData?.warnings && apyData.warnings.length > 0 && (
                                <span title={apyData.warnings.join(', ')} className="text-yellow-500 cursor-help">
                                    ⚠
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Energy Collective System */}
            {displayEnergyState && (
                <EnergyTankVisualization
                    currentEnergy={displayEnergyState.currentEnergyBalance || 0}
                    currentBalance={displayEnergyState.currentEnergyBalance || 0}
                    maxCapacity={displayEnergyState.maxCapacity || baseCapacity + actualCapacityBonus}
                    baseCapacity={baseCapacity}
                    bonusCapacity={bonusCapacity}
                    totalEnergyRate={displayEnergyState.energyRatePerSecond || 0}
                    isGenerating={connectionState.isConnected && (displayEnergyState.energyRatePerSecond || 0) > 0}
                    capacityZone={currentBalanceZone}
                    engineAccumulations={displayEnergyState.engineAccumulations || {}}
                    onEnergyHarvested={handleEnergyHarvested}
                />
            )}

            {/* Energy Management Section */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Battery className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Energy Management</h3>
                        <p className="text-sm text-muted-foreground">Monitor capacity, generation, and burn energy for rewards</p>
                    </div>
                </div>

                {displayEnergyState && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* Current Balance vs Capacity Card */}
                        <div className="token-card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-sm font-medium">Current Balance</div>
                                    <div className="text-2xl font-bold">
                                        {formatEnergy(displayEnergyState.currentEnergyBalance || 0)}
                                        <span className="text-sm font-normal text-muted-foreground">
                                            / {formatEnergy(displayEnergyState.maxCapacity || (baseCapacity + actualCapacityBonus))}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={cn(
                                        "text-3xl font-bold",
                                        currentBalanceZone === 'safe' ? 'text-green-500' :
                                            currentBalanceZone === 'warning' ? 'text-blue-500' :
                                                currentBalanceZone === 'critical' ? 'text-orange-500' :
                                                    'text-orange-600'
                                    )}>
                                        {(currentBalancePercentage || 0).toFixed(0)}%
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {currentBalanceZone === 'overflow' ? 'FULL TANK' :
                                            currentBalanceZone === 'critical' ? 'NEARLY FULL' :
                                                currentBalanceZone === 'warning' ? 'GETTING FULL' : 'ROOM TO GROW'}
                                    </div>
                                </div>
                            </div>

                            {/* Capacity Bar - Shows current balance vs max capacity */}
                            <div className="relative mb-3">
                                <div className="h-3 bg-muted/30 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-all duration-1000 rounded-full",
                                            currentBalanceZone === 'overflow' ? 'bg-orange-500' :
                                                currentBalanceZone === 'critical' ? 'bg-orange-400' :
                                                    currentBalanceZone === 'warning' ? 'bg-blue-400' :
                                                        'bg-gradient-to-r from-primary to-primary/80',
                                            connectionState.isConnected && "animate-pulse"
                                        )}
                                        style={{ width: `${Math.min(currentBalancePercentage || 0, 100)}%` }}
                                    />
                                </div>
                                {/* Capacity zone markers */}
                                <div className="absolute top-0 h-3 pointer-events-none" style={{ left: '60%' }}>
                                    <div className="w-0.5 h-full bg-blue-400/60" />
                                </div>
                                <div className="absolute top-0 h-3 pointer-events-none" style={{ left: '85%' }}>
                                    <div className="w-0.5 h-full bg-orange-400/60" />
                                </div>
                            </div>

                            {/* Energy Breakdown */}
                            <div className="pt-3 border-t border-border/30 space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Current Balance:</span>
                                    <span className="font-mono">{formatEnergy(displayEnergyState.currentEnergyBalance || 0)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-green-400">+ Untapped:</span>
                                    <span className="font-mono text-green-400">{formatEnergy(displayEnergyState.accumulatedSinceLastHarvest || 0)}</span>
                                </div>
                                <div className="flex items-center justify-between font-medium pt-1 border-t border-border/20">
                                    <span>Total Available:</span>
                                    <span className="font-mono">{formatEnergy(displayEnergyState.totalHarvestableEnergy || 0)}</span>
                                </div>
                                {(() => {
                                    const totalAccumulated = displayEnergyState.accumulatedSinceLastHarvest || 0;
                                    const maxCapacity = displayEnergyState.maxCapacity || (baseCapacity + actualCapacityBonus);
                                    const currentBalance = displayEnergyState.currentEnergyBalance || 0;
                                    const remainingCapacity = Math.max(0, maxCapacity - currentBalance);
                                    const overflowEnergy = Math.max(0, totalAccumulated - remainingCapacity);

                                    return overflowEnergy > 0 ? (
                                        <div className="flex items-center justify-between text-red-400 font-medium">
                                            <span>- Unclaimable:</span>
                                            <span className="font-mono">{formatEnergy(overflowEnergy)}</span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Capacity Breakdown */}
                            {bonusCapacity > 0 && (
                                <div className="pt-3 border-t border-border/30">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Base Capacity</span>
                                        <span className="font-mono">{formatEnergy(baseCapacity)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-blue-400">Bonus Capacity</span>
                                        <span className="font-mono text-blue-400">+{formatEnergy(bonusCapacity)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Generation Rate Card */}
                        <div className="token-card p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-sm font-medium">Generation Rate</div>
                                    <div className="text-xl font-bold text-primary">
                                        {formatEnergy(displayEnergyState.energyRatePerSecond || 0)}<span className="text-sm font-normal">/s</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">Per Hour</div>
                                    <div className="text-lg font-semibold">
                                        {formatEnergy((displayEnergyState.energyRatePerSecond || 0) * 3600)}
                                    </div>
                                </div>
                            </div>

                            {/* Status Indicator */}
                            <div className="pt-3 border-t border-border/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-2 h-2 rounded-full",
                                            connectionState.isConnected && (displayEnergyState.energyRatePerSecond || 0) > 0 ? "bg-green-500 animate-pulse" : "bg-gray-400"
                                        )} />
                                        <span className="text-sm">
                                            {connectionState.isConnected && (displayEnergyState.energyRatePerSecond || 0) > 0 ? 'Generating Energy' : 'Generation Paused'}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium">
                                        {currentBalanceZone === 'overflow' ? (
                                            <span className="text-orange-500">Ready to Harvest</span>
                                        ) : (
                                            <span className="text-green-500">Collecting Energy</span>
                                        )}
                                    </div>
                                </div>

                                {/* How It Works Information */}
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                    <div className="font-medium mb-1">How Energy Generation Works:</div>
                                    <div className="space-y-1">
                                        <div>• Hold tokens in supported pools to generate energy automatically</div>
                                        <div>• Each token type contributes different rates based on your holdings</div>
                                        <div>• Energy accumulates continuously and can be harvested anytime</div>
                                        <div>• Burn energy for governance, rewards, and exclusive features</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Burn Energy Card */}
                        <div className="token-card p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="text-sm font-medium mb-1">Available to Burn</div>
                                    <div className="text-2xl font-bold text-orange-500">
                                        {formatEnergy(displayEnergyState.currentEnergyBalance || 0)}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        energy in wallet
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Flame className="h-8 w-8 text-orange-500 opacity-50" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Button
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                                    disabled={!displayEnergyState.currentEnergyBalance || displayEnergyState.currentEnergyBalance <= 0 || isBurning}
                                    onClick={handleBurnEnergy}
                                >
                                    {isBurning ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent mr-2" />
                                            Burning Energy...
                                        </>
                                    ) : (
                                        <>
                                            <Flame className="h-4 w-4 mr-2" />
                                            Burn for Rewards
                                        </>
                                    )}
                                </Button>

                                {(displayEnergyState.currentEnergyBalance || 0) <= 0 && (
                                    <div className="text-xs text-muted-foreground text-center">
                                        You need energy to burn for rewards
                                    </div>
                                )}

                                <div className="text-xs text-muted-foreground">
                                    <span className="font-medium">Benefits:</span> Exclusive rewards, governance, premium features
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>


            {/* Harvest Animation */}
            {harvestAnimation.show && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce text-lg font-bold">
                        +{formatEnergy(harvestAnimation.amount)} Energy!
                    </div>
                </div>
            )}

            {/* Burn Animation */}
            {burnAnimation.show && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                    <div className="bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce text-lg font-bold flex items-center gap-2">
                        <Flame className="h-5 w-5" />
                        Burned {formatEnergy(burnAnimation.amount)} Energy!
                    </div>
                </div>
            )}
        </div>
    );
}