"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context/app-context';
import { toast } from "sonner";
import debounce from 'lodash/debounce';
import { getAddLiquidityQuoteAndSupply, getAddLiquidityInitialData } from '@/app/actions';
import { request } from '@stacks/connect';
import { uintCV, optionalCVOf, Pc } from '@stacks/transactions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { bufferFromHex } from '@stacks/transactions/dist/cl';

// Import the centralized vault type definition and TokenCacheData
import { ClientDisplayVault } from './vault-detail-client';

// Placeholder - Define TokenDisplay and BalanceInfo or import them
const TokenDisplay = ({ amount, symbol, imgSrc, label, price, decimals, isLoading }: any) => (
    <div className="flex items-center justify-between p-3 border rounded-md border-border bg-background/50">
        <div className="flex items-center space-x-3">
            <img src={imgSrc || '/placeholder.png'} alt={symbol || 'Token'} className="w-6 h-6 rounded-full" />
            <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-base font-medium">
                    {amount.toLocaleString(undefined, { maximumFractionDigits: decimals ?? 6 })} {symbol || '--'}
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
            Balance: {isLoading ? '...' : (balance / (10 ** (decimals ?? 6))).toLocaleString(undefined, { maximumFractionDigits: 6 })} {symbol || '--'}
        </span>
        {required > 0 && (
            <span className={balance < required ? 'text-destructive' : ''}>
                Required: {(required / (10 ** (decimals ?? 6))).toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
        )}
    </div>
);
// --- End Placeholders ---

interface AddLiquidityModalProps {
    vault: ClientDisplayVault; // Use ClientDisplayVault
    prices: Record<string, number>;
    trigger?: React.ReactNode; // Optional custom trigger
}

const OP_ADD_LIQUIDITY = '02'; // Opcode for add liquidity

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

    // Use vault.tokenA.decimals (which is TokenCacheData.decimals, so number | undefined)
    // Provide default for calculations
    const tokenADecimals = vault.tokenA.decimals ?? 6;
    const tokenBDecimals = vault.tokenB.decimals ?? 6;
    const lpDecimals = vault.decimals; // This is from ClientDisplayVault root, should be number

    // Fetch quote using server action
    const fetchQuote = useCallback(async (targetLpAmount: number) => {
        if (targetLpAmount <= 0 || maxLpTokens <= 0) {
            setQuotedAmounts({ dx: 0, dy: 0, dk: 0 });
            return;
        }
        setIsQuoting(true);
        try {
            const result = await getAddLiquidityQuoteAndSupply(vault.contractId, targetLpAmount);
            setQuotedAmounts(result.quote || { dx: 0, dy: 0, dk: 0 });
        } catch (error) {
            console.error("Error fetching quote:", error);
            toast.error("Failed to get liquidity quote.");
            setQuotedAmounts(null);
        } finally {
            setIsQuoting(false);
        }
    }, [vault.contractId, maxLpTokens]);

    const debouncedFetchQuote = useCallback(debounce(fetchQuote, 300), [fetchQuote]);

    // Initial data fetch using server action when modal opens
    useEffect(() => {
        if (isOpen && walletState.connected && walletState.address) {
            const fetchData = async () => {
                setIsLoadingData(true);
                setBalances({ tokenA: 0, tokenB: 0, lp: 0 }); // Reset while loading
                setTotalSupply(0);
                setMaxLpTokens(0); // Reset max LP tokens
                setQuotedAmounts(null); // Reset quote
                try {
                    const result = await getAddLiquidityInitialData(
                        vault.contractId,
                        vault.tokenA.contractId,
                        vault.tokenB.contractId,
                        walletState.address!
                    );

                    if (result.success && result.data) {
                        setBalances({
                            tokenA: result.data.tokenABalance,
                            tokenB: result.data.tokenBBalance,
                            lp: result.data.lpBalance
                        });
                        setTotalSupply(result.data.totalSupply);
                        // Set maxLpTokens directly from server data
                        setMaxLpTokens(result.data.maxPotentialLpTokens || 0);
                        // We could also store result.data.reservesA and result.data.reservesB if needed elsewhere
                        // For now, vault.reservesA and vault.reservesB passed as props should suffice for display if up-to-date
                    } else {
                        throw new Error(result.error || "Failed to fetch initial data.");
                    }
                } catch (error) {
                    console.error("Error fetching initial data via server action:", error);
                    toast.error("Failed to fetch wallet balances or pool supply.");
                    setBalances({ tokenA: 0, tokenB: 0, lp: 0 });
                    setTotalSupply(0);
                    setMaxLpTokens(0);
                } finally {
                    setIsLoadingData(false);
                }
            };
            fetchData();
        } else if (!walletState.connected) {
            // Reset if wallet disconnects while modal is open
            setBalances({ tokenA: 0, tokenB: 0, lp: 0 });
            setTotalSupply(0);
            setMaxLpTokens(0);
            setQuotedAmounts(null);
        }
    }, [isOpen, walletState.connected, walletState.address, vault.contractId, vault.tokenA.contractId, vault.tokenB.contractId]); // Add dependencies

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
        if (!quotedAmounts || quotedAmounts.dk <= 0 || !walletState.connected || !walletState.address) return;
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
                // Optionally trigger a balance refresh after a delay - maybe call the fetchData again?
                // setTimeout(fetchData, 5000); // Consider if needed
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
                            amount={currentLpAmount / (10 ** lpDecimals)}
                            symbol={vault.symbol}
                            imgSrc={vault.image}
                            price={prices[vault.contractId]}
                            label="You will receive (LP Tokens)"
                            decimals={lpDecimals}
                            isLoading={isQuoting || isLoadingData} // Combine loading states
                        />

                        {/* Token A Deposit */}
                        <div className="space-y-1">
                            <TokenDisplay
                                amount={requiredTokenA / (10 ** tokenADecimals)}
                                symbol={vault.tokenA.symbol}
                                imgSrc={vault.tokenA.image}
                                price={prices[vault.tokenA.contractId]}
                                label="You will deposit"
                                decimals={tokenADecimals}
                                isLoading={isQuoting || isLoadingData} // Combine loading states
                            />
                            <BalanceInfo
                                balance={balances.tokenA}
                                symbol={vault.tokenA.symbol}
                                decimals={tokenADecimals}
                                required={requiredTokenA}
                                isLoading={isLoadingData} // Only balance loading
                            />
                        </div>

                        {/* Token B Deposit */}
                        <div className="space-y-1">
                            <TokenDisplay
                                amount={requiredTokenB / (10 ** tokenBDecimals)}
                                symbol={vault.tokenB.symbol}
                                imgSrc={vault.tokenB.image}
                                price={prices[vault.tokenB.contractId]}
                                label="You will deposit"
                                decimals={tokenBDecimals}
                                isLoading={isQuoting || isLoadingData} // Combine loading states
                            />
                            <BalanceInfo
                                balance={balances.tokenB}
                                symbol={vault.tokenB.symbol}
                                decimals={tokenBDecimals}
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
                        {!hasSufficientBalance && requiredTokenA > 0 && requiredTokenB > 0 && !isLoadingData && ( // Added !isLoadingData check
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