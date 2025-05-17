'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context/app-context';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { optionalCVOf, bufferCV, uintCV } from '@stacks/transactions';
import { callReadOnlyFunction } from '@repo/polyglot';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { principalCV } from '@stacks/transactions';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Zap, Clock, AlertCircle, Loader2, InfoIcon, RefreshCw } from 'lucide-react';

// Constants for operations
const OP_HARVEST_ENERGY = '07';

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

    // Get the appropriate contract ID to call
    const engineContractId = vault.engineContractId || vault.contractId;

    // Function to fetch user's last tap block and current block height
    const fetchEnergyData = async (refreshing = false) => {
        if (!walletState.connected || !walletState.address) {
            setLastTapBlock(null);
            setCurrentBlock(null);
            setPendingBlocks(0);
            setEstimatedEnergy(null);
            return;
        }

        if (refreshing) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const [contractAddress, contractName] = engineContractId.split('.');

            // Get the last time the user tapped for energy
            const lastTapResult = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'get-last-tap-block',
                [principalCV(walletState.address)]
            );

            let lastTap = 0;
            if (lastTapResult && typeof lastTapResult === 'object' && 'value' in lastTapResult) {
                lastTap = parseInt(lastTapResult.value.toString());
            }
            setLastTapBlock(lastTap);

            // Get the current block height (can also be done via API, but this works)
            const quoteResult = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'quote',
                [
                    uintCV(0), // amount doesn't matter for energy harvest
                    optionalCVOf(bufferFromHex(OP_HARVEST_ENERGY))
                ]
            );

            let blockHeight = 0;
            let pendingEnergyBlocks = 0;

            if (quoteResult && typeof quoteResult === 'object' && 'value' in quoteResult) {
                // For the energy quote, we expect dk to contain block difference
                const dkValue = quoteResult.value.dk?.value;
                if (dkValue !== undefined) {
                    pendingEnergyBlocks = parseInt(dkValue.toString());

                    // Calculate current block height from last tap and pending blocks
                    blockHeight = lastTap + pendingEnergyBlocks;
                }
            }

            setCurrentBlock(blockHeight);
            setPendingBlocks(pendingEnergyBlocks);

            // Estimate energy based on blocks (simplified formula - would need actual contract logic for accuracy)
            // This is just a placeholder calculation
            const estimatedEnergyAmount = Math.floor(pendingEnergyBlocks * 0.01 * (Math.log(pendingEnergyBlocks + 1) + 1));
            setEstimatedEnergy(estimatedEnergyAmount);

        } catch (error) {
            console.error("Error fetching energy data:", error);
            // Keep previous values and don't reset to allow retrying
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    // Fetch data on component mount or when wallet changes
    useEffect(() => {
        fetchEnergyData();
    }, [walletState.connected, walletState.address, engineContractId]);

    const pollEnergyUpdate = useCallback(async () => {
        if (!walletState.connected || lastTapBlock === null) {
            return; // Don't poll if not connected or no initial lastTapBlock
        }

        try {
            const [contractAddress, contractName] = engineContractId.split('.');
            const quoteResult = await callReadOnlyFunction(
                contractAddress,
                contractName,
                'quote',
                [
                    uintCV(0), // amount doesn't matter for energy harvest
                    optionalCVOf(bufferFromHex(OP_HARVEST_ENERGY))
                ]
            );

            if (quoteResult && typeof quoteResult === 'object' && 'value' in quoteResult) {
                const dkValue = quoteResult.value.dk?.value;
                if (dkValue !== undefined) {
                    const newPendingBlocks = parseInt(dkValue.toString());
                    // lastTapBlock comes from state, should be stable between full refreshes
                    const newCurrentBlock = lastTapBlock + newPendingBlocks;

                    setCurrentBlock(newCurrentBlock);
                    setPendingBlocks(newPendingBlocks);

                    const newEstimatedEnergy = Math.floor(newPendingBlocks * 0.01 * (Math.log(newPendingBlocks + 1) + 1));
                    setEstimatedEnergy(newEstimatedEnergy);
                }
                // If dkValue is undefined, or quoteResult is not as expected, states remain as they are (no update from this poll)
            }
        } catch (error) {
            console.warn("Polling energy update failed:", error);
            // Do not set error states for background polling to avoid UI disruption
        }
    }, [engineContractId, walletState.connected, lastTapBlock, setCurrentBlock, setPendingBlocks, setEstimatedEnergy]);

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
                setEstimatedEnergy(0);

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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/30 p-3 rounded-lg">
                                <div className="text-xs text-muted-foreground mb-1">Last Harvested</div>
                                <div className="text-lg font-bold">
                                    {isLoading ? (
                                        <div className="flex items-center">
                                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                            Loading...
                                        </div>
                                    ) : lastTapBlock ? (
                                        `Block #${lastTapBlock.toLocaleString()}`
                                    ) : (
                                        'Never'
                                    )}
                                </div>
                            </div>

                            <div className="bg-muted/30 p-3 rounded-lg">
                                <div className="text-xs text-muted-foreground mb-1">Current Block</div>
                                <div className="text-lg font-bold">
                                    {isLoading ? (
                                        <div className="flex items-center">
                                            <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                            Loading...
                                        </div>
                                    ) : currentBlock ? (
                                        `#${currentBlock.toLocaleString()}`
                                    ) : (
                                        '—'
                                    )}
                                </div>
                            </div>
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
                                            `~${estimatedEnergy.toLocaleString()} Energy`
                                        ) : (
                                            '—'
                                        )}
                                    </span>
                                </div>

                                <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                                    <div
                                        className={`bg-primary h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden`}
                                        style={{ width: `${Math.min(100, (pendingBlocks / 100) * 100)}%` }}
                                    >
                                        {/* Shine element for the sweep animation */}
                                        {pendingBlocks > 0 && (
                                            <div
                                                className="absolute top-0 left-0 h-full w-full"
                                                style={{
                                                    background: 'linear-gradient(to right, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%)',
                                                    // If you chose NOT to update tailwind.config.js for the animation,
                                                    // you would uncomment the line below and remove 'animate-shimmer-sweep' from className:
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