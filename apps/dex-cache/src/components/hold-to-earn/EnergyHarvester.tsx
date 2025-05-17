'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context/app-context';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { optionalCVOf, bufferCV, uintCV } from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { getEnergyData, getPendingEnergyBlocks } from '@/app/actions/energy';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Zap, Clock, AlertCircle, Loader2, InfoIcon, RefreshCw } from 'lucide-react';

// Constants for operations
const OP_HARVEST_ENERGY = '07';

const STACKS_BLOCKS_PER_DAY = 144; // Approx. 10 min per block (6 blocks/hr * 24 hr/day)
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_BLOCK = MINUTES_PER_DAY / STACKS_BLOCKS_PER_DAY;

interface EnergyHarvesterProps {
    vault: {
        contractId: string;
        name: string;
        symbol: string;
        description?: string;
        engineContractId?: string;
    };
}

export function EnergyHarvester({ vault }: EnergyHarvesterProps) {
    const { walletState } = useApp();
    const [lastTapBlock, setLastTapBlock] = useState<number | null>(null);
    const [currentBlock, setCurrentBlock] = useState<number | null>(null);
    const [pendingBlocks, setPendingBlocks] = useState<number>(0);
    const [estimatedEnergy, setEstimatedEnergy] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [estimatedDailyReward, setEstimatedDailyReward] = useState<number | null>(null);
    const [energyPerMinuteRate, setEnergyPerMinuteRate] = useState<number | null>(null);

    // Get the appropriate contract ID to call
    const engineContractId = vault.engineContractId || vault.contractId;

    // Function to fetch user's energy data using server action
    const fetchEnergyData = async (refreshing = false) => {
        if (!walletState.connected || !walletState.address) {
            setLastTapBlock(null);
            setCurrentBlock(null);
            setPendingBlocks(0);
            setEstimatedEnergy(null);
            setEstimatedDailyReward(null);
            setEnergyPerMinuteRate(null);
            return;
        }

        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            // Use server action instead of direct contract call
            const energyData = await getEnergyData(
                walletState.address,
                vault.contractId,
                engineContractId
            );



            setLastTapBlock(energyData.lastTapBlock);
            setPendingBlocks(energyData.pendingBlocks);

            if (energyData.estimatedEnergy === null && energyData.pendingBlocks > 0) {
                setEstimatedEnergy(0.01); // Placeholder for visibility if rate is unknown
            } else {
                setEstimatedEnergy(energyData.estimatedEnergy);
            }

            setEstimatedDailyReward(energyData.estimatedDailyReward);
            setEnergyPerMinuteRate(energyData.energyPerMinuteRate);

            // Calculate current block height from last tap and pending blocks
            if (energyData.lastTapBlock) {
                setCurrentBlock(energyData.lastTapBlock + energyData.pendingBlocks);
            }

        } catch (error) {
            console.error("Error fetching energy data:", error);
            // Reset states on error
            setEnergyPerMinuteRate(null);
            setEstimatedEnergy(pendingBlocks > 0 ? 0.01 : 0); // Fallback on error too
            setEstimatedDailyReward(null);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // Fetch data on component mount or when wallet changes
    useEffect(() => {
        fetchEnergyData();
    }, [walletState.connected, walletState.address, engineContractId, vault.contractId]);

    // Poll for energy updates using server action
    const pollEnergyUpdate = useCallback(async () => {
        if (!walletState.connected || !walletState.address || lastTapBlock === null) {
            return; // Don't poll if not connected or no initial lastTapBlock
        }

        try {
            // Use server action for polling
            const pendingData = await getPendingEnergyBlocks(
                walletState.address,
                lastTapBlock,
                vault.contractId,
                engineContractId
            );

            if (pendingData.pendingBlocks >= 0) {
                const newPendingBlocks = pendingData.pendingBlocks;
                const newCurrentBlock = lastTapBlock + newPendingBlocks;

                setPendingBlocks(newPendingBlocks);
                setCurrentBlock(newCurrentBlock);

                // Use the rate from the server if available, otherwise use the cached rate
                const effectiveRate = pendingData.ratePerMinute !== null
                    ? pendingData.ratePerMinute
                    : energyPerMinuteRate;

                if (effectiveRate !== null) {
                    const totalPendingMinutes = newPendingBlocks * MINUTES_PER_BLOCK;
                    const calculatedEstimatedEnergy = effectiveRate * totalPendingMinutes;
                    setEstimatedEnergy(Math.floor(calculatedEstimatedEnergy));
                } else {
                    // If rate is unknown, use placeholder for visibility
                    setEstimatedEnergy(newPendingBlocks > 0 ? 0.01 : 0);
                }
            }
        } catch (error) {
            console.warn("Polling energy update failed:", error);
            // Do not set error states for background polling to avoid UI disruption
        }
    }, [walletState, lastTapBlock, vault.contractId, engineContractId, energyPerMinuteRate]);

    // useEffect for polling pending energy blocks
    useEffect(() => {
        if (!walletState.connected || lastTapBlock === null) {
            return; // Conditions not met for polling
        }

        const intervalId = setInterval(() => {
            pollEnergyUpdate();
        }, 5000); // Poll every 5 seconds

        return () => {
            clearInterval(intervalId); // Clear interval on cleanup
        };
    }, [walletState.connected, lastTapBlock, pollEnergyUpdate]);

    // Function to harvest energy
    const handleHarvestEnergy = async () => {
        if (!walletState.connected || pendingBlocks <= 0) return;

        setIsHarvesting(true);
        try {
            const [contractAddress, contractName] = engineContractId.split('.');

            // Simplified: Just call the harvest function without complex post conditions
            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: 'execute',
                functionArgs: [
                    uintCV(0), // amount doesn't matter for energy harvest
                    optionalCVOf(bufferFromHex(OP_HARVEST_ENERGY))
                ],
            };

            const result = await request('stx_callContract', params);

            if (result && result.txid) {
                // Toast notification with success
                toast.success("Energy harvest transaction submitted!", {
                    description: `TxID: ${result.txid}`
                });

                // Optimistically update UI
                setLastTapBlock(currentBlock);
                setPendingBlocks(0);
                setEstimatedEnergy(0); // Reset to 0 after harvest
                setEstimatedDailyReward(null);
                setEnergyPerMinuteRate(null); // Reset rate after harvest

                // Wait briefly then refresh actual data
                setTimeout(() => fetchEnergyData(true), 3000);
            } else {
                throw new Error("Transaction failed or was rejected.");
            }
        } catch (error) {
            console.error("Energy harvest error:", error);
            const errorMessage = (error instanceof Error && error.message)
                || (typeof error === 'string' ? error : 'An unknown error occurred.');
            toast.error("Failed to initiate transaction.", { description: errorMessage });
        } finally {
            setIsHarvesting(false);
        }
    };

    return (
        <Card className="overflow-hidden border border-primary/20 shadow-md">
            <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 border-b border-primary/10">
                <CardTitle className="flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-primary" />
                    Energy Harvester
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                {!walletState.connected ? (
                    <div className="text-center py-4">
                        <div className="text-muted-foreground mb-4">Connect your wallet to harvest energy</div>
                        <Button onClick={() => useApp().connectWallet()}>
                            Connect Wallet
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center">
                                <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                                <span className="text-sm text-muted-foreground">Energy Accrual Status</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => fetchEnergyData(true)}
                                disabled={isRefreshing || isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                <span className="sr-only">Refresh</span>
                            </Button>
                        </div>

                        <div className="bg-primary/5 border border-primary/10 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-3">
                                <div className="text-sm font-medium">Pending Energy</div>
                                <Badge className="bg-primary/20 text-primary border-primary/30">
                                    {pendingBlocks.toLocaleString()} blocks
                                </Badge>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Estimated Reward:</span>
                                    <span className="font-medium">
                                        {isLoading ? (
                                            <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                                        ) : estimatedEnergy !== null ? (
                                            (estimatedEnergy < 1 && estimatedEnergy > 0) ?
                                                "< 1 Energy" :
                                                `${estimatedEnergy.toLocaleString()} Energy`
                                        ) : (
                                            '—'
                                        )}
                                    </span>
                                </div>

                                <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`bg-primary h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden`}
                                        style={{
                                            width: `${estimatedEnergy !== null && estimatedEnergy > 0 ? Math.max(2, Math.min(100, estimatedEnergy * 100 / (estimatedDailyReward || 100))) : 0}%`
                                        }}
                                    >
                                        {/* Shine element for the sweep animation */}
                                        {pendingBlocks > 0 && (
                                            <div
                                                className="absolute top-0 left-0 h-full w-full"
                                                style={{
                                                    background: 'linear-gradient(to right, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%)',
                                                    animation: 'shimmer-sweep 1.5s infinite linear',
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end text-xs text-muted-foreground">
                                    {pendingBlocks > 0 ? 'Ready to harvest' : 'Accruing energy...'}
                                </div>
                            </div>
                        </div>

                        {pendingBlocks > 0 ? (
                            <Button
                                className="w-full"
                                onClick={handleHarvestEnergy}
                                disabled={isHarvesting || pendingBlocks <= 0}
                            >
                                {isHarvesting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Harvesting...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="h-4 w-4 mr-2" />
                                        Harvest Energy
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button variant="outline" className="w-full" disabled>
                                <Clock className="h-4 w-4 mr-2" />
                                Waiting for Energy
                            </Button>
                        )}

                        <Alert variant="default" className="bg-muted/30 border-muted mt-4">
                            <InfoIcon className="h-4 w-4" />
                            <AlertTitle>How Energy Works</AlertTitle>
                            <AlertDescription className="text-xs text-muted-foreground">
                                Energy accrues based on how long you hold tokens in your wallet. The longer you hold, the more energy you can harvest. Energy can be used for various benefits in the ecosystem.
                            </AlertDescription>
                        </Alert>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default EnergyHarvester;