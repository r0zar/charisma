"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Vault } from '@repo/dexterity';
import { useApp } from '@/lib/context/app-context';
import { callReadOnlyFunction } from '@repo/polyglot';
import { principalCV, uintCV, bufferCVFromString, ClarityType, cvToValue } from '@stacks/transactions';
import { request } from '@stacks/connect';
import { STACKS_MAINNET } from "@stacks/network";
import { toast } from "sonner"; // Using sonner for toasts
import debounce from 'lodash/debounce';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Plus, AlertCircle, Loader2 } from 'lucide-react';

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
        {required > 0 && (
            <span className={balance < required ? 'text-destructive' : ''}>
                Required: {(required / (10 ** (decimals || 6))).toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
        )}
    </div>
);
// --- End Placeholders ---

interface AddLiquidityModalProps {
    vault: Vault & { reservesA: number; reservesB: number };
    prices: Record<string, number>;
    trigger?: React.ReactNode; // Optional custom trigger
}

const OP_ADD_LIQUIDITY = '02'; // Opcode for add liquidity

// Helper to fetch STX balance manually
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

export function AddLiquidityModal({ vault, prices, trigger }: AddLiquidityModalProps) {
    const { walletState } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [amountPercent, setAmountPercent] = useState(50);
    const [quotedAmounts, setQuotedAmounts] = useState<{ dx: number; dy: number; dk: number } | null>(null);
    const [balances, setBalances] = useState<{ tokenA: number; tokenB: number; lp: number }>({ tokenA: 0, tokenB: 0, lp: 0 });
    const [totalSupply, setTotalSupply] = useState(0); // State for total LP supply
    const [maxLpTokens, setMaxLpTokens] = useState(0);
    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isQuoting, setIsQuoting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchBalancesAndSupply = useCallback(async () => {
        if (!walletState.connected || !walletState.address) return;
        setIsLoadingBalances(true);
        try {
            const fetchBalance = async (tokenContractId: string, tokenDecimals: number) => {
                if (tokenContractId === '.stx') {
                    return await fetchManualStxBalance(walletState.address);
                } else {
                    const [addr, name] = tokenContractId.split('.');
                    const balanceCV = await callReadOnlyFunction(addr, name, 'get-balance', [principalCV(walletState.address)]);
                    return cvToValue(balanceCV)?.value ? Number(cvToValue(balanceCV).value) : 0;
                }
            };

            const fetchTotalSupply = async () => {
                const [addr, name] = vault.contractId.split('.');
                const supplyCV = await callReadOnlyFunction(addr, name, 'get-total-supply', []);
                return cvToValue(supplyCV)?.value ? Number(cvToValue(supplyCV).value) : 0;
            };

            const [balA, balB, balLp, supply] = await Promise.all([
                fetchBalance(vault.tokenA.contractId, vault.tokenA.decimals || 6),
                fetchBalance(vault.tokenB.contractId, vault.tokenB.decimals || 6),
                fetchBalance(vault.contractId, vault.decimals || 6),
                fetchTotalSupply()
            ]);
            setBalances({ tokenA: balA, tokenB: balB, lp: balLp });
            setTotalSupply(supply);

        } catch (error) {
            console.error("Error fetching balances/supply:", error);
            toast.error("Failed to fetch wallet balances or pool supply.");
            setBalances({ tokenA: 0, tokenB: 0, lp: 0 });
            setTotalSupply(0);
        } finally {
            setIsLoadingBalances(false);
        }
    }, [walletState.connected, walletState.address, vault]);

    // Calculate max potential LP tokens based on current reserves, total supply and user balances
    useEffect(() => {
        if (balances.tokenA === 0 || balances.tokenB === 0 || vault.reservesA === 0 || vault.reservesB === 0 || totalSupply === 0) {
            setMaxLpTokens(0);
            return;
        }
        // Estimate max LP tokens based on the limiting token balance relative to pool reserves
        const maxFromA = (balances.tokenA / vault.reservesA) * totalSupply;
        const maxFromB = (balances.tokenB / vault.reservesB) * totalSupply;
        setMaxLpTokens(Math.floor(Math.min(maxFromA, maxFromB)));

    }, [balances, vault.reservesA, vault.reservesB, totalSupply]);

    const fetchQuote = useCallback(async (lpAmount: number) => {
        if (lpAmount <= 0) {
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
            return;
        }
        setIsQuoting(true);
        try {
            const [addr, name] = vault.contractId.split('.');
            const quoteResultCV = await callReadOnlyFunction(
                addr, name, 'quote', [
                uintCV(lpAmount),
                bufferCVFromString(OP_ADD_LIQUIDITY)
            ]);
            const quoteResult = cvToValue(quoteResultCV)?.value;
            if (quoteResult && typeof quoteResult === 'object' && 'dx' in quoteResult && 'dy' in quoteResult && 'dk' in quoteResult) {
                setQuotedAmounts({
                    dx: Number(quoteResult.dx.value),
                    dy: Number(quoteResult.dy.value),
                    dk: Number(quoteResult.dk.value)
                });
            } else {
                throw new Error("Invalid quote structure received");
            }
        } catch (error) {
            console.error("Error fetching quote:", error);
            toast.error("Failed to get liquidity quote.");
            setQuotedAmounts(null);
        } finally {
            setIsQuoting(false);
        }
    }, [vault.contractId]);

    const debouncedFetchQuote = useCallback(debounce(fetchQuote, 300), [fetchQuote]);

    // Fetch balances and supply when modal opens and wallet is connected
    useEffect(() => {
        if (isOpen && walletState.connected) {
            fetchBalancesAndSupply();
        }
    }, [isOpen, walletState.connected, fetchBalancesAndSupply]);

    // Fetch initial quote based on slider position and max LP
    useEffect(() => {
        if (maxLpTokens > 0) {
            const initialLpAmount = Math.floor((amountPercent / 100) * maxLpTokens);
            debouncedFetchQuote(initialLpAmount);
        } else {
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
        }
    }, [amountPercent, maxLpTokens, debouncedFetchQuote]);

    const handleSliderChange = (value: number[]) => {
        const percent = value[0];
        setAmountPercent(percent);
        const lpAmount = Math.floor((percent / 100) * maxLpTokens);
        debouncedFetchQuote(lpAmount);
    };

    const handleAddLiquidity = async () => {
        if (!quotedAmounts || quotedAmounts.dk <= 0 || !walletState.connected) return;

        setIsProcessing(true);
        try {
            const [contractAddress, contractName] = vault.contractId.split('.');
            const txOptions = {
                contract: `${contractAddress}.${contractName}` as any,
                functionName: 'execute',
                arguments: [
                    uintCV(quotedAmounts.dk), // amount is dk (LP tokens)
                    bufferCVFromString(OP_ADD_LIQUIDITY)
                ],
            };

            // Use request instead of openContractCall
            await request('stx_callContract', txOptions); // Cast method name to any

        } catch (error) {
            console.error("Add Liquidity submission error:", error);
            // Check if it's a known error structure from @stacks/connect or a generic error
            const errorMessage = (error instanceof Error && error.message) || (typeof error === 'string' ? error : 'An unknown error occurred.');
            toast.error("Failed to initiate transaction.", { description: errorMessage });
        } finally {
            setIsProcessing(false);
        }
    };

    const currentLpAmount = quotedAmounts?.dk || 0;
    const requiredTokenA = quotedAmounts?.dx || 0;
    const requiredTokenB = quotedAmounts?.dy || 0;
    const hasSufficientBalance = balances.tokenA >= requiredTokenA && balances.tokenB >= requiredTokenB;
    const canSubmit = hasSufficientBalance && currentLpAmount > 0 && !isProcessing && !isLoadingBalances && !isQuoting;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="flex-1 gap-2">
                        <Wallet className="w-4 h-4" /> Add Liquidity
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Liquidity to {vault.symbol || 'Pool'}</DialogTitle>
                </DialogHeader>
                {!walletState.connected ? (
                    <div className="text-center text-muted-foreground py-6">Please connect your wallet.</div>
                ) : (
                    <div className="space-y-4">
                        {/* LP Tokens to Receive */}
                        <TokenDisplay
                            amount={currentLpAmount / (10 ** (vault.decimals || 6))}
                            symbol={vault.symbol}
                            imgSrc={vault.image}
                            price={prices[vault.contractId]} // Price of LP token might not be available
                            label="You will receive (LP Tokens)"
                            decimals={vault.decimals}
                            isLoading={isQuoting}
                        />

                        {/* Token A Deposit */}
                        <div className="space-y-1">
                            <TokenDisplay
                                amount={requiredTokenA / (10 ** (vault.tokenA.decimals || 6))}
                                symbol={vault.tokenA.symbol}
                                imgSrc={vault.tokenA.image}
                                price={prices[vault.tokenA.contractId]}
                                label="You will deposit"
                                decimals={vault.tokenA.decimals}
                                isLoading={isQuoting}
                            />
                            <BalanceInfo
                                balance={balances.tokenA}
                                symbol={vault.tokenA.symbol}
                                decimals={vault.tokenA.decimals}
                                required={requiredTokenA}
                                isLoading={isLoadingBalances}
                            />
                        </div>

                        {/* Token B Deposit */}
                        <div className="space-y-1">
                            <TokenDisplay
                                amount={requiredTokenB / (10 ** (vault.tokenB.decimals || 6))}
                                symbol={vault.tokenB.symbol}
                                imgSrc={vault.tokenB.image}
                                price={prices[vault.tokenB.contractId]}
                                label="You will deposit"
                                decimals={vault.tokenB.decimals}
                                isLoading={isQuoting}
                            />
                            <BalanceInfo
                                balance={balances.tokenB}
                                symbol={vault.tokenB.symbol}
                                decimals={vault.tokenB.decimals}
                                required={requiredTokenB}
                                isLoading={isLoadingBalances}
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
                                disabled={isLoadingBalances || maxLpTokens <= 0}
                            />
                        </div>

                        {/* Alert for insufficient balance */}
                        {!hasSufficientBalance && requiredTokenA > 0 && requiredTokenB > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>Insufficient balance for one or both tokens.</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            className="w-full gap-2"
                            onClick={handleAddLiquidity}
                            disabled={!canSubmit}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {isProcessing ? 'Processing...' : (currentLpAmount > 0 ? 'Confirm Add Liquidity' : 'Enter Amount')}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
} 