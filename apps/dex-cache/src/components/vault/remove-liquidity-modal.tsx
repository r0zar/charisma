"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Vault } from '@repo/dexterity';
import { useApp } from '@/lib/context/app-context';
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV, uintCV, bufferCVFromString, ClarityType, cvToValue } from '@stacks/transactions';
import { request } from '@stacks/connect';
import { STACKS_MAINNET } from "@stacks/network";
import { toast } from "sonner";
import debounce from 'lodash/debounce';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowUpDown, Minus, AlertCircle, Loader2 } from 'lucide-react'; // Updated icons

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
const BalanceInfo = ({ balance, symbol, decimals, required, isLoading }: any) => (
    <div className="flex justify-between text-xs text-muted-foreground">
        <span>
            Balance: {isLoading ? '...' : (balance / (10 ** (decimals || 6))).toLocaleString(undefined, { maximumFractionDigits: 6 })} {symbol || '--'}
        </span>
        {/* Required not typically shown for removing liquidity based on LP balance */}
    </div>
);
// --- End Placeholders ---

interface RemoveLiquidityModalProps {
    vault: Vault & { reservesA: number; reservesB: number };
    prices: Record<string, number>;
    trigger?: React.ReactNode; // Optional custom trigger
}

const OP_REMOVE_LIQUIDITY = '03'; // Opcode for remove liquidity

// Helper to fetch STX balance manually (assuming it might be needed elsewhere, keep for now)
async function fetchManualStxBalance(address: string): Promise<number> {
    try {
        const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/stx`);
        if (!response.ok) {
            throw new Error(`STX Balance API Error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return Number(data.balance || 0);
    } catch (error) {
        console.error(`Failed fetching STX balance for ${address}:`, error);
        return 0;
    }
}

export function RemoveLiquidityModal({ vault, prices, trigger }: RemoveLiquidityModalProps) {
    const { walletState } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [amountPercent, setAmountPercent] = useState(50); // Slider percentage (0-100) of LP balance
    const [quotedAmounts, setQuotedAmounts] = useState<{ dx: number; dy: number; dk: number } | null>(null);
    const [lpBalance, setLpBalance] = useState(0);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [isQuoting, setIsQuoting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchLpBalance = useCallback(async () => {
        if (!walletState.connected || !walletState.address) return;
        setIsLoadingBalance(true);
        try {
            const [addr, name] = vault.contractId.split('.');
            // Use vault contractId and function name to get LP balance
            const balanceCV = await callReadOnlyFunction(addr, name, 'get-balance', [principalCV(walletState.address)]);
            setLpBalance(cvToValue(balanceCV)?.value ? Number(cvToValue(balanceCV).value) : 0);
        } catch (error) {
            console.error("Error fetching LP balance:", error);
            toast.error("Failed to fetch LP token balance.");
            setLpBalance(0);
        } finally {
            setIsLoadingBalance(false);
        }
    }, [walletState.connected, walletState.address, vault.contractId]);

    const fetchQuote = useCallback(async (lpAmountToBurn: number) => {
        if (lpAmountToBurn <= 0) {
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
            return;
        }
        setIsQuoting(true);
        try {
            const [addr, name] = vault.contractId.split('.');
            const quoteResultCV = await callReadOnlyFunction(
                addr, name, 'quote', [
                uintCV(lpAmountToBurn),
                bufferCVFromString(OP_REMOVE_LIQUIDITY)
            ]);
            const quoteResult = cvToValue(quoteResultCV)?.value;
            if (quoteResult && typeof quoteResult === 'object' && 'dx' in quoteResult && 'dy' in quoteResult && 'dk' in quoteResult) {
                setQuotedAmounts({
                    dx: Number(quoteResult.dx.value),
                    dy: Number(quoteResult.dy.value),
                    dk: Number(quoteResult.dk.value) // dk here is the amount to burn
                });
            } else {
                throw new Error("Invalid quote structure received");
            }
        } catch (error) {
            console.error("Error fetching remove quote:", error);
            toast.error("Failed to get liquidity removal quote.");
            setQuotedAmounts(null);
        } finally {
            setIsQuoting(false);
        }
    }, [vault.contractId]);

    const debouncedFetchQuote = useCallback(debounce(fetchQuote, 300), [fetchQuote]);

    // Fetch LP balance when modal opens and wallet is connected
    useEffect(() => {
        if (isOpen && walletState.connected) {
            fetchLpBalance();
        }
    }, [isOpen, walletState.connected, fetchLpBalance]);

    // Fetch initial quote based on slider position and LP balance
    useEffect(() => {
        if (lpBalance > 0) {
            const initialLpAmountToBurn = Math.floor((amountPercent / 100) * lpBalance);
            debouncedFetchQuote(initialLpAmountToBurn);
        } else {
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
        }
    }, [amountPercent, lpBalance, debouncedFetchQuote]);

    const handleSliderChange = (value: number[]) => {
        const percent = value[0];
        setAmountPercent(percent);
        const lpAmountToBurn = Math.floor((percent / 100) * lpBalance);
        debouncedFetchQuote(lpAmountToBurn);
    };

    const handleRemoveLiquidity = async () => {
        if (!quotedAmounts || quotedAmounts.dk <= 0 || !walletState.connected) return;
        if (quotedAmounts.dk > lpBalance) {
            toast.error("Cannot remove more liquidity than you own.");
            return;
        }

        setIsProcessing(true);
        try {
            const [contractAddress, contractName] = vault.contractId.split('.');
            const txOptions = {
                contractAddress,
                contractName,
                functionName: 'execute',
                functionArgs: [
                    uintCV(quotedAmounts.dk), // amount is dk (LP tokens to burn)
                    bufferCVFromString(OP_REMOVE_LIQUIDITY)
                ],
                network: STACKS_MAINNET,
                appDetails: {
                    name: 'DEX Cache',
                    icon: typeof window !== 'undefined' ? window.location.origin + '/favicon.ico' : '/favicon.ico',
                },
                onFinish: (data: { txId: string }) => {
                    toast.success("Remove Liquidity transaction submitted!", { description: `TxID: ${data.txId}` });
                    setIsOpen(false);
                    setTimeout(fetchLpBalance, 5000); // Refresh LP balance after 5s
                },
                onCancel: () => {
                    toast.info("Transaction cancelled by user.");
                },
            };

            await request('stx_callContract' as any, txOptions); // Use updated method name

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
                                isLoading={isQuoting}
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