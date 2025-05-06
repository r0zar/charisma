"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context/app-context';
import { request } from '@stacks/connect';
import { STACKS_MAINNET } from "@stacks/network";
import { toast } from "sonner";
import debounce from 'lodash/debounce';
import { getRemoveLiquidityQuote, getLpTokenBalance } from '@/app/actions';
import { uintCV, bufferCVFromString, principalCV, cvToValue, Pc, optionalCVOf } from '@stacks/transactions';
import { callReadOnlyFunction } from '@repo/polyglot';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpDown, Minus, AlertCircle, Loader2 } from 'lucide-react';

interface Token {
    contractId: string;
    identifier?: string;
    name: string;
    symbol: string;
    decimals: number;
    image: string;
}

interface Vault {
    contractId: string;
    name: string;
    identifier: string;
    symbol: string;
    decimals: number;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    tokenA: Token;
    tokenB: Token;
    reservesA: number;
    reservesB: number;
}

// Placeholder - Define TokenDisplay and BalanceInfo or import them
const TokenDisplay = ({ amount, symbol, imgSrc, label, price, decimals, isLoading }: any) => (
    <div className="flex items-center justify-between p-3 border rounded-md border-border bg-background/50">
        <div className="flex items-center space-x-3">
            <img src={imgSrc || '/placeholder.png'} alt={symbol || 'Token'} className="w-6 h-6 rounded-full" />
            <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-base font-medium">
                    {amount.toLocaleString(undefined, { maximumFractionDigits: decimals || 6 })} {symbol || '--'}
                </div>
            </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
            {isLoading ? '...' : (price ? `≈ $${(amount * price).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Price N/A')}
        </div>
    </div>
);
const BalanceInfo = ({ balance, symbol, decimals, isLoading }: any) => (
    <div className="flex justify-between text-xs text-muted-foreground">
        <span>
            Balance: {isLoading ? '...' : (balance / (10 ** (decimals || 6))).toLocaleString(undefined, { maximumFractionDigits: 6 })} {symbol || '--'}
        </span>
    </div>
);
// --- End Placeholders ---

interface RemoveLiquidityModalProps {
    vault: Vault & { reservesA: number; reservesB: number };
    prices: Record<string, number>;
    trigger?: React.ReactNode; // Optional custom trigger
}

const OP_REMOVE_LIQUIDITY = '03'; // Opcode for remove liquidity

export function RemoveLiquidityModal({ vault, prices, trigger }: RemoveLiquidityModalProps) {
    const { walletState } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [amountPercent, setAmountPercent] = useState(50); // Slider percentage (0-100) of LP balance
    const [quotedAmounts, setQuotedAmounts] = useState<{ dx: number; dy: number; dk: number } | null>(null);
    const [lpBalance, setLpBalance] = useState(0);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [isQuoting, setIsQuoting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Fetch quote using server action
    const fetchQuote = useCallback(async (targetLpAmountToBurn: number) => {
        if (targetLpAmountToBurn <= 0) {
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
            return;
        }
        setIsQuoting(true);
        try {
            // Use the server action
            const result = await getRemoveLiquidityQuote(vault.contractId, targetLpAmountToBurn);
            setQuotedAmounts(result.quote);
        } catch (error) {
            console.error("Error fetching remove quote:", error);
            toast.error("Failed to get liquidity removal quote.");
            setQuotedAmounts(null);
        } finally {
            setIsQuoting(false);
        }
    }, [vault.contractId]);

    const debouncedFetchQuote = useCallback(debounce(fetchQuote, 300), [fetchQuote]);

    // Initial data fetch when modal opens
    useEffect(() => {
        if (isOpen && walletState.connected && walletState.address) {
            const fetchBalance = async () => {
                setIsLoadingBalance(true);
                setLpBalance(0); // Reset while loading
                setQuotedAmounts(null); // Reset quote as it depends on balance
                try {
                    const result = await getLpTokenBalance(vault.contractId, walletState.address!);
                    if (result.success && typeof result.balance === 'number') {
                        setLpBalance(result.balance);
                    } else {
                        throw new Error(result.error || "Failed to fetch LP balance.");
                    }
                } catch (error) {
                    console.error("Error fetching LP balance via server action:", error);
                    toast.error("Failed to fetch your LP token balance.");
                    setLpBalance(0);
                } finally {
                    setIsLoadingBalance(false);
                }
            };
            fetchBalance();
        } else if (!walletState.connected) {
            setLpBalance(0);
            setQuotedAmounts(null);
        }
    }, [isOpen, walletState.connected, walletState.address, vault.contractId]);

    // Fetch quote when LP balance/percentage change
    useEffect(() => {
        if (isOpen && walletState.connected && lpBalance > 0) {
            const targetLpAmountToBurn = Math.floor((amountPercent / 100) * lpBalance);
            debouncedFetchQuote(targetLpAmountToBurn);
        }
        else if (isOpen && walletState.connected) {
            // If LP balance is 0 or not ready, clear quote
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
        }
    }, [isOpen, walletState.connected, amountPercent, lpBalance, debouncedFetchQuote]);

    const handleSliderChange = (value: number[]) => {
        const percent = value[0];
        setAmountPercent(percent);
        // Quote fetching is now handled by the useEffect above
    };

    const handleRemoveLiquidity = async () => {
        if (!quotedAmounts || quotedAmounts.dk <= 0 || !walletState.connected) return;
        // Re-check balance sufficiency just before submitting
        if (quotedAmounts.dk > lpBalance) {
            toast.error("Cannot remove more liquidity than you own.");
            return;
        }

        setIsProcessing(true);
        try {
            const [contractAddress, contractName] = vault.contractId.split('.');
            const tokenAReceived = quotedAmounts?.dx || 0;
            const tokenBReceived = quotedAmounts?.dy || 0;

            // Assemble post conditions
            const postConditions = [];

            // PC for LP token burn (from user)
            if (quotedAmounts.dk > 0) {
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(quotedAmounts.dk).ft(vault.contractId as `${string}.${string}`, vault.identifier!)
                );
            }

            // PC for Token A received (from pool)
            if (tokenAReceived > 0) {
                if (vault.tokenA.contractId === '.stx') {
                    postConditions.push(
                        Pc.principal(vault.contractId).willSendEq(tokenAReceived).ustx()
                    );
                } else {
                    postConditions.push(
                        Pc.principal(vault.contractId).willSendEq(tokenAReceived).ft(vault.tokenA.contractId as `${string}.${string}`, vault.tokenA.identifier!)
                    );
                }
            }

            // PC for Token B received (from pool)
            if (tokenBReceived > 0) {
                if (vault.tokenB.contractId === '.stx') {
                    postConditions.push(
                        Pc.principal(vault.contractId).willSendEq(tokenBReceived).ustx()
                    );
                } else {
                    postConditions.push(
                        Pc.principal(vault.contractId).willSendEq(tokenBReceived).ft(vault.tokenB.contractId as `${string}.${string}`, vault.tokenB.identifier!)
                    );
                }
            }

            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: 'execute',
                functionArgs: [
                    uintCV(quotedAmounts.dk), // amount is dk (LP tokens to burn)
                    optionalCVOf(bufferFromHex(OP_REMOVE_LIQUIDITY)) // Opcode as optional buffer
                ],
                network: "mainnet",
                postConditions: postConditions, // Use the assembled array
                appDetails: {
                    name: 'DEX Cache',
                    icon: typeof window !== 'undefined' ? window.location.origin + '/favicon.ico' : '/favicon.ico',
                },
            };

            const result = await request('stx_callContract', params);

            if (result && result.txid) {
                toast.success("Remove Liquidity transaction submitted!", { description: `TxID: ${result.txid}` });
                setIsOpen(false);
                // Optionally trigger balance refresh
                // setTimeout(fetchLpBalance, 5000);
            } else {
                const errorMessage = "Transaction failed or was rejected.";
                throw new Error(`Submission Failed: ${errorMessage}`);
            }
        } catch (error) {
            console.error("Remove Liquidity submission error:", error);
            const errorMessage = (error instanceof Error && error.message) || (typeof error === 'string' ? error : 'An unknown error occurred.');
            toast.error("Failed to initiate transaction.", { description: errorMessage });
        } finally {
            setIsProcessing(false);
        }
    };

    const lpAmountToBurn = quotedAmounts?.dk || 0;
    const tokenAReceived = quotedAmounts?.dx || 0;
    const tokenBReceived = quotedAmounts?.dy || 0;
    const hasSufficientLpBalance = lpBalance >= lpAmountToBurn;
    const canSubmit = hasSufficientLpBalance && lpAmountToBurn > 0 && !isProcessing && !isLoadingBalance && !isQuoting;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="flex-1 gap-2">
                        <ArrowUpDown className="w-4 h-4" /> Remove Liquidity
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Remove Liquidity from {vault.symbol || 'Pool'}</DialogTitle>
                </DialogHeader>
                {!walletState.connected ? (
                    <div className="text-center text-muted-foreground py-6">Please connect your wallet.</div>
                ) : (
                    <div className="space-y-4">
                        {/* Token A Received */}
                        <TokenDisplay
                            amount={tokenAReceived / (10 ** (vault.tokenA.decimals || 6))}
                            symbol={vault.tokenA.symbol}
                            imgSrc={vault.tokenA.image}
                            price={prices[vault.tokenA.contractId]}
                            label="You will receive"
                            decimals={vault.tokenA.decimals}
                            isLoading={isQuoting}
                        />

                        {/* Token B Received */}
                        <TokenDisplay
                            amount={tokenBReceived / (10 ** (vault.tokenB.decimals || 6))}
                            symbol={vault.tokenB.symbol}
                            imgSrc={vault.tokenB.image}
                            price={prices[vault.tokenB.contractId]}
                            label="You will receive"
                            decimals={vault.tokenB.decimals}
                            isLoading={isQuoting}
                        />

                        {/* LP Tokens to Burn */}
                        <div className="space-y-1 pt-2">
                            <TokenDisplay
                                amount={lpAmountToBurn / (10 ** (vault.decimals || 6))}
                                symbol={vault.symbol}
                                imgSrc={vault.image}
                                price={prices[vault.contractId]} // Price of LP token might not be available
                                label="You will burn (LP Tokens)"
                                decimals={vault.decimals}
                                isLoading={isQuoting} // LP amount also depends on quote
                            />
                            <BalanceInfo
                                balance={lpBalance}
                                symbol={vault.symbol}
                                decimals={vault.decimals}
                                isLoading={isLoadingBalance}
                            />
                        </div>

                        {/* Slider */}
                        <div className="space-y-2 pt-2">
                            <div className="text-sm font-medium">Amount ({amountPercent}%)</div>
                            <Slider
                                value={[amountPercent]}
                                onValueChange={handleSliderChange}
                                max={100}
                                step={1}
                                disabled={isLoadingBalance || lpBalance <= 0}
                            />
                        </div>

                        {/* Alert for insufficient LP balance */}
                        {!hasSufficientLpBalance && lpAmountToBurn > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>Amount exceeds your LP token balance.</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            className="w-full gap-2"
                            onClick={handleRemoveLiquidity}
                            disabled={!canSubmit}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                            {isProcessing ? 'Processing...' : (lpAmountToBurn > 0 ? 'Confirm Remove Liquidity' : 'Enter Amount')}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
} 