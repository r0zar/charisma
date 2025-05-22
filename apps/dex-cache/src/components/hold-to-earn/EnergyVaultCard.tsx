'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { request } from '@stacks/connect';
import { Coins, Zap, Check, Loader2, Clock, BarChart2, Wallet, AudioWaveform } from 'lucide-react';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useApp } from '@/lib/context/app-context';
import { getEnergyTokenMetadata } from '@/lib/server/energy';
import type { EnergyTokenDashboardData } from '@/lib/server/energy';
import { getFungibleTokenBalance } from '@/lib/pool-service';
import { BatteryLoader } from './battery-loader';

// Interface shared with the parent component
interface HoldToEarnVault {
    contractId: string;
    type?: string;
    name: string;
    description: string;
    image: string;
    base: string;
    engineContractId: `${string}.${string}`;
}

interface EnergyVaultCardProps {
    vault: HoldToEarnVault;
}

export function EnergyVaultCard({ vault }: EnergyVaultCardProps) {
    const { stxAddress } = useApp();
    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData | null>(null);
    const [energyData, setEnergyData] = useState<EnergyTokenDashboardData | null>(null);
    const [energyMetadata, setEnergyMetadata] = useState<TokenCacheData | null>(null);
    const [userTokenBalance, setUserTokenBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [harvestSuccess, setHarvestSuccess] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [maxCapacity, setMaxCapacity] = useState<number>(0);

    // Separate state for calculated values that change with time
    const [currentHarvestableEnergy, setCurrentHarvestableEnergy] = useState<number>(0);
    const [energyPerSecond, setEnergyPerSecond] = useState<number>(0);

    // Using ref to store the last update time to calculate energy in intervals
    const lastUpdateTimeRef = useRef<number>(Date.now());
    // Using ref to store the last known energy accumulation to build upon it
    const lastKnownEnergyRef = useRef<number>(0);

    // useEffect to fetch the base token metadata
    useEffect(() => {
        const fetchTokenMetadata = async () => {
            try {
                setIsLoading(true);
                const metadata = await getTokenMetadataCached(vault.base);
                setTokenMetadata(metadata);
            } catch (error) {
                console.error("Failed to fetch token metadata:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTokenMetadata();
    }, [vault.base]);

    // useEffect to fetch the energy token metadata
    useEffect(() => {
        const fetchEnergyMetadata = async () => {
            try {
                const metadata = await getEnergyTokenMetadata();
                setEnergyMetadata(metadata);
            } catch (error) {
                console.error("Failed to fetch energy token metadata:", error);
            }
        };

        fetchEnergyMetadata();
    }, []);

    // useEffect to fetch the user's energy data for this specific token
    useEffect(() => {
        const fetchUserEnergyData = async () => {
            if (!stxAddress) return;

            try {
                const response = await fetch(`/api/v1/energy/user-dashboard?address=${stxAddress}`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch energy data: ${response.statusText}`);
                }

                const energyApiResponse = await response.json();
                // Find the data for this specific token
                const thisTokenData = energyApiResponse.userEnergyDashboardData.find(
                    (token: EnergyTokenDashboardData) => token.contractId === vault.contractId
                );

                if (thisTokenData) {
                    setEnergyData(thisTokenData);
                    // Initialize our refs with the current data
                    lastUpdateTimeRef.current = Date.now();

                    // Calculate initial harvestable energy
                    const nowSeconds = Date.now() / 1000;
                    const lastHarvestSeconds = thisTokenData.lastRateCalculationTimestamp / 1000;

                    const secondsSinceLastHarvest = (lastHarvestSeconds > 0 && nowSeconds > lastHarvestSeconds)
                        ? nowSeconds - lastHarvestSeconds
                        : 0;

                    console.log('secondsSinceLastHarvest:', secondsSinceLastHarvest);

                    const initialAccumulated = secondsSinceLastHarvest * thisTokenData.estimatedEnergyRatePerSecond;
                    const cappedInitialAccumulated = Math.min(
                        Math.max(0, initialAccumulated),
                        energyApiResponse.maxCapacity
                    );

                    lastKnownEnergyRef.current = cappedInitialAccumulated;
                    setCurrentHarvestableEnergy(cappedInitialAccumulated);

                    // Store energy rate per second for interval calculations
                    setEnergyPerSecond(thisTokenData.estimatedEnergyRatePerSecond);
                }

                console.log('energyApiResponse for vault card:', energyApiResponse);
                setMaxCapacity(energyApiResponse.maxCapacity);

            } catch (error) {
                console.error('Error fetching user energy data:', error);
            }
        };

        fetchUserEnergyData();
    }, [stxAddress, vault.contractId]);

    // Update the harvestable energy display in real-time with an interval
    useEffect(() => {
        if (!energyData || maxCapacity <= 0 || energyPerSecond <= 0) return;

        // Function to update the current harvestable energy based on time passed
        const updateHarvestableEnergy = () => {
            const now = Date.now();
            const secondsElapsed = (now - lastUpdateTimeRef.current) / 1000;
            lastUpdateTimeRef.current = now;

            // Calculate new energy based on seconds elapsed
            const newEnergyGained = secondsElapsed * energyPerSecond;
            const newTotal = lastKnownEnergyRef.current + newEnergyGained;

            // Cap the energy at the maximum capacity
            const cappedNewTotal = Math.min(newTotal, maxCapacity);

            // Update our reference and state
            lastKnownEnergyRef.current = cappedNewTotal;
            setCurrentHarvestableEnergy(cappedNewTotal);
        };

        // Set up an interval to update the energy display every second
        const intervalId = setInterval(updateHarvestableEnergy, 1000);

        // Clean up the interval when the component unmounts
        return () => clearInterval(intervalId);
    }, [energyData, maxCapacity, energyPerSecond]);

    // Reset the energy accumulation after harvesting
    useEffect(() => {
        if (harvestSuccess) {
            lastKnownEnergyRef.current = 0;
            lastUpdateTimeRef.current = Date.now();
            setCurrentHarvestableEnergy(0);
        }
    }, [harvestSuccess]);

    // Fetch user token balance
    useEffect(() => {
        const fetchUserBalance = async () => {
            if (!stxAddress || !vault.base) return;

            try {
                const balance = await getFungibleTokenBalance(vault.base, stxAddress);
                setUserTokenBalance(balance);
            } catch (error) {
                console.error('Error fetching token balance:', error);
            }
        };

        fetchUserBalance();
    }, [stxAddress, vault.base]);

    // Format energy value with proper decimals
    const formatEnergyValue = (value: number): string => {
        if (!energyMetadata) return value.toLocaleString();

        // Apply decimals from the energy token metadata
        const decimals = energyMetadata.decimals || 0;
        const divisor = Math.pow(10, decimals);
        const adjustedValue = value / divisor;

        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: 2,
            minimumFractionDigits: 0
        });
    };

    // Format token balance with proper decimals
    const formatTokenBalance = (value: number | null): string => {
        if (value === null || !tokenMetadata) return '0';

        // Apply decimals from the token metadata
        const decimals = tokenMetadata.decimals || 0;
        const divisor = Math.pow(10, decimals);
        const adjustedValue = value / divisor;

        return adjustedValue.toLocaleString(undefined, {
            maximumFractionDigits: decimals
        });
    };

    // request contract call to tap for energy
    const handleTapForEnergy = async () => {
        try {
            setIsHarvesting(true);
            const response = await request('stx_callContract', {
                contract: vault.engineContractId,
                functionName: 'tap',
                functionArgs: [],
            });

            console.log(response);
            setHarvestSuccess(true);

            // update the energy data
            const energyApiResponse = await fetch(`/api/v1/energy/user-dashboard?address=${stxAddress}`);
            const energyApiResponseData = await energyApiResponse.json();
            const thisTokenData = energyApiResponseData.userEnergyDashboardData.find(
                (token: EnergyTokenDashboardData) => token.contractId === vault.contractId
            );

            if (thisTokenData) {
                // Update with the newest data from the API
                thisTokenData.lastRateCalculationTimestamp = Date.now();
                setEnergyData(thisTokenData);

                // Reset energy counters
                lastKnownEnergyRef.current = 0;
                lastUpdateTimeRef.current = Date.now();
                setCurrentHarvestableEnergy(0);
            }

            // Reset success state after 2 seconds
            setTimeout(() => {
                setHarvestSuccess(false);
            }, 2000);
        } catch (error) {
            console.error("Harvesting failed:", error);
        } finally {
            setIsHarvesting(false);
        }
    };

    return (
        <Card
            className={`col-span-2 relative h-full flex flex-col overflow-hidden transition-all duration-300
                border-primary/10 p-5 rounded-xl 
                ${isHovered ? 'border-primary/30 shadow-lg' : 'hover:shadow-md'}
                ${isLoading ? 'animate-pulse-medium' : 'animate-appear'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                transform: isHovered ? 'translateY(-2px)' : 'none',
                backfaceVisibility: 'hidden',
            }}
        >
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}

            {/* Top header with Energy indicator and stats if available */}
            <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <Zap className={`h-4 w-4 ${isHovered ? 'animate-pulse-glow' : ''}`} />
                    </div>
                    <span className="text-sm font-medium text-primary">Earn Energy</span>
                </div>

                {/* Energy stats display (only if user has data for this token) */}
                {energyData && stxAddress && (
                    <div className="flex items-center gap-3">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                        <Zap className="h-3.5 w-3.5 text-primary" />
                                        <span>{energyMetadata
                                            ? formatEnergyValue(energyData.currentAccumulatedEnergy)
                                            : energyData.currentAccumulatedEnergy.toLocaleString(undefined, { maximumFractionDigits: 1 })
                                        }</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p className="text-xs">Your accumulated energy</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                        <AudioWaveform className="h-3.5 w-3.5 text-primary" />
                                        <span>{energyMetadata
                                            ? formatEnergyValue(energyData.estimatedEnergyRatePerSecond)
                                            : (energyData.estimatedEnergyRatePerSecond).toLocaleString(undefined, { maximumFractionDigits: 6, minimumFractionDigits: 6 })
                                        }/sec</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    <p className="text-xs">Energy per second</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>

            {/* Primary focus: Token required for rewards */}
            {tokenMetadata && (
                <div className="flex gap-4 mb-5">
                    {/* Token image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md bg-muted flex-shrink-0 border border-primary/20">
                        <Image
                            width={150}
                            height={150}
                            src={tokenMetadata?.image || `https://placehold.co/150x150?text=${vault.base || 'Token'}`}
                            alt={tokenMetadata?.name || vault.base || 'Token'}
                            className={`w-full h-full object-cover ${isHovered ? 'scale-105' : ''} transition-transform duration-300`}
                        />
                    </div>

                    {/* Token information */}
                    <div className="flex flex-col justify-center">
                        <h3 className="text-lg font-semibold text-foreground mb-1 tracking-tight">
                            {tokenMetadata?.name || vault.base || 'Token'}
                        </h3>

                        <div className="flex items-center flex-wrap gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-xs px-2 py-0.5">
                                {tokenMetadata?.symbol || vault.base || 'TOK'}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                                Hold to earn
                            </span>

                            {/* Display community stats if we have them */}
                            {energyData && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <BarChart2 className="h-3 w-3" />
                                                <span>{energyData.contractUniqueUsers} users</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="text-xs">Active users for this token</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Token description */}
            <p className="text-sm text-muted-foreground mb-6 flex-grow">
                {vault.description || "Hold tokens to earn energy rewards over time."}
            </p>

            {/* Vault metadata and action button */}
            <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-auto">
                <div className="flex items-center gap-2">
                    <Image
                        width={40}
                        height={40}
                        src={vault.image || 'https://placehold.co/40x40?text=V'}
                        alt={vault.name}
                        className="w-6 h-6 rounded-full object-cover border border-primary/20"
                    />
                    <span className="text-xs text-muted-foreground truncate">
                        {vault.name}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* User token balance */}
                    {stxAddress && tokenMetadata && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-xs font-medium">
                                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>
                                            {formatTokenBalance(userTokenBalance)} {tokenMetadata.symbol}
                                        </span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-xs">Your token balance</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}

                    {/* Harvest button */}
                    <Button
                        variant={harvestSuccess ? "secondary" : "default"}
                        size="sm"
                        className={`transition-all duration-300 ${harvestSuccess ? 'bg-success text-white' : ''}`}
                        onClick={handleTapForEnergy}
                        disabled={isHarvesting || isLoading || currentHarvestableEnergy <= 0}
                    >
                        {isHarvesting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                <span>Harvesting</span>
                            </>
                        ) : harvestSuccess ? (
                            <>
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                <span>Harvested!</span>
                            </>
                        ) : (
                            <>
                                <Zap className={`h-3.5 w-3.5 mr-1.5 ${isHovered ? 'animate-pulse-fast' : ''}`} />
                                <span>Harvest Energy</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Subtle glow effect when hovered */}
            {isHovered && (
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent rounded-xl" />
            )}

            {/* Battery loader with logarithmic scaling */}
            {energyData && maxCapacity > 0 && (
                <TooltipProvider delayDuration={300}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="mt-auto pt-2">
                                <BatteryLoader
                                    value={currentHarvestableEnergy}
                                    maxCapacity={maxCapacity}
                                    animationDuration={1000}
                                    logBase={100} // Higher = more aggressive logarithmic curve
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-center">
                            <p className="text-xs">
                                Currently harvesting: {(currentHarvestableEnergy / Math.pow(10, 6)).toLocaleString(undefined, { maximumFractionDigits: 6 })} energy
                                <br />
                                Max capacity: {(maxCapacity / Math.pow(10, 6)).toLocaleString()} energy
                                <br />
                                Rate: {(energyPerSecond / Math.pow(10, 6)).toLocaleString(undefined, { maximumFractionDigits: 6 })} energy/second
                            </p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </Card>
    );
}