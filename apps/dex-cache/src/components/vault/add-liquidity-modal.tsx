"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context/app-context';
import { toast } from "sonner";
import debounce from 'lodash/debounce';
import { getAddLiquidityQuoteAndSupply } from '@/app/actions';
import { request } from '@stacks/connect';
import { STACKS_MAINNET } from "@stacks/network";
import { uintCV, bufferCVFromString, principalCV, cvToValue, optionalCVOf, Pc, bufferCV } from '@stacks/transactions';
import { callReadOnlyFunction } from '@repo/polyglot';
import { ClarityType } from '@stacks/transactions';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

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

// Helper to fetch STX balance manually (client-side)
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

// Helper to fetch total supply (client-side)
async function fetchTotalSupplyClient(vaultContractId: string): Promise<number> {
    try {
        const [addr, name] = vaultContractId.split('.');
        const supplyCV = await callReadOnlyFunction(addr, name, 'get-total-supply', []);
        return cvToValue(supplyCV)
    } catch (error) {
        console.error(`Failed fetching total supply for ${vaultContractId}:`, error);
        return 0;
    }
}

export function AddLiquidityModal({ vault, prices, trigger }: AddLiquidityModalProps) {
    const { walletState } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [amountPercent, setAmountPercent] = useState(50);
    const [quotedAmounts, setQuotedAmounts] = useState<{ dx: number; dy: number; dk: number } | null>(null);
    const [balances, setBalances] = useState<{ tokenA: number; tokenB: number; lp: number }>({ tokenA: 0, tokenB: 0, lp: 0 });
    const [totalSupply, setTotalSupply] = useState(0);
    const [maxLpTokens, setMaxLpTokens] = useState(0);
    const [isLoadingData, setIsLoadingData] = useState(false); // Combined loading state
    const [isQuoting, setIsQuoting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Client-side balance and total supply fetch function
    const fetchInitialData = useCallback(async () => {
        if (!walletState.connected || !walletState.address) return;
        setIsLoadingData(true);
        try {
            const fetchBalance = async (tokenContractId: string) => {
                if (tokenContractId === '.stx') {
                    return await fetchManualStxBalance(walletState.address);
                } else {
                    const [addr, name] = tokenContractId.split('.');
                    const balanceCV = await callReadOnlyFunction(addr, name, 'get-balance', [principalCV(walletState.address)]);
                    return cvToValue(balanceCV)
                }
            };

            // Fetch balances and total supply in parallel
            const [balA, balB, balLp, supply] = await Promise.all([
                fetchBalance(vault.tokenA.contractId),
                fetchBalance(vault.tokenB.contractId),
                fetchBalance(vault.contractId), // LP token balance
                fetchTotalSupplyClient(vault.contractId) // Fetch total supply client-side
            ]);

            setBalances({ tokenA: balA, tokenB: balB, lp: balLp });
            setTotalSupply(supply);

        } catch (error) {
            console.error("Error fetching initial data (balances/supply):", error);
            toast.error("Failed to fetch wallet balances or pool supply.");
            setBalances({ tokenA: 0, tokenB: 0, lp: 0 });
            setTotalSupply(0);
        } finally {
            setIsLoadingData(false);
        }
    }, [walletState.connected, walletState.address, vault]);

    // Calculate max potential LP tokens based on user balances and pool state
    useEffect(() => {
        // Ensure reserves are numbers
        const reserveA = Number(vault.reservesA || 0);
        const reserveB = Number(vault.reservesB || 0);

        console.log('[maxLpTokens Calc] Inputs:', {
            balanceA: balances.tokenA,
            balanceB: balances.tokenB,
            reserveA,
            reserveB,
            totalSupply
        });

        if (balances.tokenA === 0 || balances.tokenB === 0 || reserveA === 0 || reserveB === 0 || totalSupply === 0) {
            console.log('[maxLpTokens Calc] Setting maxLpTokens to 0 due to zero input.');
            setMaxLpTokens(0);
            return;
        }
        // Estimate max LP tokens based on the limiting token balance relative to pool reserves
        const maxFromA = (balances.tokenA / reserveA) * totalSupply;
        const maxFromB = (balances.tokenB / reserveB) * totalSupply;
        const calculatedMax = Math.min(maxFromA, maxFromB);
        console.log('calculatedMax', calculatedMax);

        console.log('[maxLpTokens Calc] Calculation:', { maxFromA, maxFromB, calculatedMax });
        setMaxLpTokens(calculatedMax);

    }, [balances, vault.reservesA, vault.reservesB, totalSupply]);

    // Fetch quote using server action
    const fetchQuote = useCallback(async (targetLpAmount: number) => {
        if (targetLpAmount <= 0 || maxLpTokens <= 0) { // Also check maxLpTokens
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
            return;
        }
        setIsQuoting(true);
        try {
            // Use the server action - supply is already fetched client-side
            const result = await getAddLiquidityQuoteAndSupply(vault.contractId, targetLpAmount);
            setQuotedAmounts(result.quote);
            // No need to set total supply here anymore
        } catch (error) {
            console.error("Error fetching quote:", error);
            toast.error("Failed to get liquidity quote.");
            setQuotedAmounts(null);
        } finally {
            setIsQuoting(false);
        }
    }, [vault.contractId, maxLpTokens]);

    const debouncedFetchQuote = useCallback(debounce(fetchQuote, 300), [fetchQuote]);

    // Initial data fetch when modal opens
    useEffect(() => {
        if (isOpen && walletState.connected) {
            fetchInitialData(); // Fetch balances and supply
        }
    }, [isOpen, walletState.connected, fetchInitialData]);

    // Fetch quote when amountPercent or maxLpTokens change
    useEffect(() => {
        if (isOpen && walletState.connected && maxLpTokens > 0) {
            const targetLpAmount = Math.floor((amountPercent / 100) * maxLpTokens);
            // Ensure targetLpAmount is positive before fetching
            if (targetLpAmount > 0) {
                debouncedFetchQuote(targetLpAmount);
            } else {
                setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
            }
        }
        else if (isOpen && walletState.connected) {
            // If maxLp is 0 or balances/supply aren't ready, clear quote
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
        }
    }, [isOpen, walletState.connected, amountPercent, maxLpTokens, debouncedFetchQuote]);

    const handleSliderChange = (value: number[]) => {
        const percent = value[0];
        setAmountPercent(percent);
        // Quote fetching is handled by the useEffect dependent on amountPercent and maxLpTokens
    };

    const handleAddLiquidity = async () => {
        if (!quotedAmounts || quotedAmounts.dk <= 0 || !walletState.connected) return;
        // Re-check balance sufficiency just before submitting
        const requiredTokenA = quotedAmounts?.dx || 0;
        const requiredTokenB = quotedAmounts?.dy || 0;
        if (balances.tokenA < requiredTokenA || balances.tokenB < requiredTokenB) {
            toast.error("Insufficient balance for the required deposit amounts.");
            return;
        }

        setIsProcessing(true);
        try {
            const [contractAddress, contractName] = vault.contractId.split('.');

            // Assemble post conditions correctly
            const postConditions = [];
            // Post condition for Token A
            if (requiredTokenA > 0 && vault.tokenA.contractId !== '.stx') {
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(requiredTokenA).ft(vault.tokenA.contractId as `${string}.${string}`, vault.tokenA.identifier!)
                );
            } else if (requiredTokenA > 0 && vault.tokenA.contractId === '.stx') {
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(requiredTokenA).ustx() // Use .ustx() for STX
                );
            }
            // Post condition for Token B
            if (requiredTokenB > 0 && vault.tokenB.contractId !== '.stx') {
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(requiredTokenB).ft(vault.tokenB.contractId as `${string}.${string}`, vault.tokenB.identifier!)
                );
            } else if (requiredTokenB > 0 && vault.tokenB.contractId === '.stx') {
                postConditions.push(
                    Pc.principal(walletState.address).willSendEq(requiredTokenB).ustx() // Use .ustx() for STX
                );
            }

            console.log([
                uintCV(quotedAmounts.dk), // amount is dk (LP tokens)
                optionalCVOf(bufferFromHex(OP_ADD_LIQUIDITY))
            ])

            const params = {
                contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
                functionName: 'execute',
                functionArgs: [
                    uintCV(quotedAmounts.dk), // amount is dk (LP tokens)
                    optionalCVOf(bufferFromHex(OP_ADD_LIQUIDITY))
                ],
                postConditions, // Use the assembled array
            };

            const result = await request('stx_callContract', params);

            if (result && result.txid) {
                toast.success("Add Liquidity transaction submitted!", { description: `TxID: ${result.txid}` });
                setIsOpen(false);
                // Optionally trigger a balance refresh after a delay
                // setTimeout(fetchInitialData, 5000); // Use fetchInitialData now
            } else {
                const errorMessage = "Transaction failed or was rejected.";
                throw new Error(`Submission Failed: ${errorMessage}`);
            }
        } catch (error) {
            console.error("Add Liquidity submission error:", error);
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
    // Update canSubmit to use combined loading state
    const canSubmit = hasSufficientBalance && currentLpAmount > 0 && !isProcessing && !isLoadingData && !isQuoting;

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
                            price={prices[vault.contractId]}
                            label="You will receive (LP Tokens)"
                            decimals={vault.decimals}
                            isLoading={isQuoting || isLoadingData} // Combine loading states
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
                                isLoading={isQuoting || isLoadingData} // Combine loading states
                            />
                            <BalanceInfo
                                balance={balances.tokenA}
                                symbol={vault.tokenA.symbol}
                                decimals={vault.tokenA.decimals}
                                required={requiredTokenA}
                                isLoading={isLoadingData} // Only balance loading
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
                                isLoading={isQuoting || isLoadingData} // Combine loading states
                            />
                            <BalanceInfo
                                balance={balances.tokenB}
                                symbol={vault.tokenB.symbol}
                                decimals={vault.tokenB.decimals}
                                required={requiredTokenB}
                                isLoading={isLoadingData} // Only balance loading
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
                                disabled={isLoadingData || maxLpTokens <= 0} // Use combined loading state
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