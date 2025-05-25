"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import TokenLogo from '../TokenLogo';
import { AlertTriangle, ArrowRight, Wallet, Zap, TrendingUp } from 'lucide-react';
import { useSwapContext } from '../../contexts/swap-context';
import { TokenCacheData } from '@repo/tokens';

interface BalanceCheckDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function BalanceCheckDialog({ open, onOpenChange }: BalanceCheckDialogProps) {
    const {
        balanceCheckResult,
        selectedFromToken,
        displayAmount,
        executeDeposit,
        executeSwapForOrder,
        setDisplayAmount,
        tokenCounterparts,
        formatUsd,
        getUsdPrice,
        isLoadingSwapOptions
    } = useSwapContext();

    const [isProcessing, setIsProcessing] = useState(false);
    const [processingType, setProcessingType] = useState<'deposit' | 'swap' | null>(null);

    if (!balanceCheckResult || !selectedFromToken) return null;

    const {
        hasEnoughSubnet,
        hasEnoughMainnet,
        subnetBalance,
        mainnetBalance,
        requiredAmount,
        shortfall,
        canDeposit,
        swapOptions
    } = balanceCheckResult;

    // Get token counterparts
    const counterparts = tokenCounterparts.get(
        selectedFromToken.type === 'SUBNET' ? selectedFromToken.base! : selectedFromToken.contractId
    );
    const subnetToken = selectedFromToken.type === 'SUBNET' ? selectedFromToken : counterparts?.subnet;
    const mainnetToken = selectedFromToken.type === 'SUBNET' ? counterparts?.mainnet : selectedFromToken;

    // Calculate display values
    const rawShortfall = Math.max(0, requiredAmount - subnetBalance); // Total amount needed in subnet
    const maxDepositAmount = Math.min(mainnetBalance, rawShortfall); // Amount that can be deposited
    const remainingShortfall = Math.max(0, rawShortfall - maxDepositAmount); // Amount still needed after deposit

    const handleDeposit = async () => {
        if (!mainnetToken || !subnetToken) return;

        setIsProcessing(true);
        setProcessingType('deposit');

        try {
            // Deposit the calculated amount that can be deposited
            const success = await executeDeposit(mainnetToken, subnetToken, maxDepositAmount.toString());
            if (success) {
                onOpenChange(false);
            }
        } catch (err) {
            console.error('Deposit failed:', err);
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleSwap = async (swapOption: any) => {
        setIsProcessing(true);
        setProcessingType('swap');

        try {
            const success = await executeSwapForOrder(swapOption);
            if (success) {
                onOpenChange(false);
            }
        } catch (err) {
            console.error('Swap failed:', err);
        } finally {
            setIsProcessing(false);
            setProcessingType(null);
        }
    };

    const handleQuickSwap = (swapOption: any) => {
        // Use the pre-calculated swap amount
        setDisplayAmount(swapOption.swapAmount.toString());
        onOpenChange(false);
    };

    const formatBalance = (balance: number, decimals: number = 6) => {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 4)
        });
    };

    const getTokenPrice = (token: TokenCacheData) => {
        const price = getUsdPrice(token.contractId);
        return price ? formatUsd(price) : null;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Insufficient Balance for Order
                    </DialogTitle>
                    <DialogDescription>
                        You need {formatBalance(requiredAmount)} {selectedFromToken.symbol} to place this order,
                        but you only have {formatBalance(subnetBalance)} {selectedFromToken.symbol} in the subnet.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current Balance Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Current Balances</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <TokenLogo token={selectedFromToken} />
                                    <span className="text-sm">{selectedFromToken.symbol} (Subnet)</span>
                                </div>
                                <span className="font-medium">{formatBalance(subnetBalance)}</span>
                            </div>
                            {mainnetToken && (
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <TokenLogo token={mainnetToken} />
                                        <span className="text-sm">
                                            {mainnetToken.symbol.replace(/^x-/, '')} (Mainnet)
                                        </span>
                                    </div>
                                    <span className="font-medium">{formatBalance(mainnetBalance)}</span>
                                </div>
                            )}
                            <div className="pt-2 border-t">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Required for order:</span>
                                    <span className="font-medium text-red-600">{formatBalance(requiredAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Shortfall:</span>
                                    <span className="font-medium text-red-600">{formatBalance(remainingShortfall)}</span>
                                </div>
                                {canDeposit && maxDepositAmount > 0 && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Can deposit:</span>
                                        <span className="font-medium text-blue-600">{formatBalance(maxDepositAmount)}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Deposit Option */}
                    {canDeposit && mainnetToken && subnetToken && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-blue-500" />
                                    {maxDepositAmount >= rawShortfall ? 'Recommended: Deposit to Subnet' : 'Partial Deposit Available'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {maxDepositAmount >= rawShortfall ? (
                                        <p className="text-sm text-muted-foreground">
                                            You have enough {mainnetToken.symbol.replace(/^x-/, '')} on mainnet. Deposit {formatBalance(rawShortfall)} to the subnet to complete your order.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            You can deposit {formatBalance(maxDepositAmount)} {mainnetToken.symbol.replace(/^x-/, '')} from mainnet, but you'll still need {formatBalance(remainingShortfall)} more to complete your order.
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <TokenLogo token={mainnetToken} />
                                            <div>
                                                <div className="font-medium">
                                                    {formatBalance(maxDepositAmount)} {mainnetToken.symbol.replace(/^x-/, '')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">From mainnet</div>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex items-center gap-2">
                                            <TokenLogo token={subnetToken} />
                                            <div>
                                                <div className="font-medium">
                                                    {formatBalance(maxDepositAmount)} {subnetToken.symbol}
                                                </div>
                                                <div className="text-xs text-muted-foreground">To subnet</div>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleDeposit}
                                        disabled={isProcessing}
                                        className="w-full"
                                    >
                                        {isProcessing && processingType === 'deposit' ? (
                                            <>Processing Deposit...</>
                                        ) : (
                                            <>
                                                <Wallet className="h-4 w-4 mr-2" />
                                                Deposit {formatBalance(maxDepositAmount)} {mainnetToken.symbol.replace(/^x-/, '')}
                                                {maxDepositAmount < rawShortfall && ' (Partial)'}
                                            </>
                                        )}
                                    </Button>
                                    {maxDepositAmount < rawShortfall && (
                                        <p className="text-xs text-amber-600 text-center">
                                            After deposit, you'll still need {formatBalance(remainingShortfall)} more {selectedFromToken.symbol}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Swap Options */}
                    {swapOptions.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                    Alternative: Swap Other Tokens
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        Swap from tokens you already have to get the required {selectedFromToken.symbol}.
                                    </p>
                                    <div className="space-y-2">
                                        {swapOptions.map((option, index) => (
                                            <div key={index} className="p-3 border rounded-lg space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <TokenLogo token={option.fromToken} />
                                                        <span className="font-medium">
                                                            {option.fromToken.symbol.replace(/^x-/, '')}
                                                        </span>
                                                        <Badge variant="secondary" className="text-xs">
                                                            Swap Amount: {formatBalance(option.swapAmount)}
                                                        </Badge>
                                                    </div>
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    <div className="flex items-center gap-2">
                                                        <TokenLogo token={selectedFromToken} />
                                                        <span className="font-medium">
                                                            ~{formatBalance(option.estimatedOutput)} {selectedFromToken.symbol}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleQuickSwap(option)}
                                                        className="flex-1"
                                                    >
                                                        <Zap className="h-3 w-3 mr-1" />
                                                        Set up swap
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSwap(option)}
                                                        disabled={isProcessing}
                                                        className="flex-1"
                                                    >
                                                        {isProcessing && processingType === 'swap' ? (
                                                            'Processing...'
                                                        ) : (
                                                            'Swap now'
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading swap options */}
                    {!canDeposit && swapOptions.length === 0 && remainingShortfall > 0 && isLoadingSwapOptions && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                    Finding Swap Options...
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        Checking your other tokens for swap opportunities...
                                    </p>
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* No Options Available - only show after loading is complete */}
                    {!canDeposit && swapOptions.length === 0 && !isLoadingSwapOptions && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="text-center space-y-2">
                                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                                    <h3 className="font-medium">No Available Options</h3>
                                    <p className="text-sm text-muted-foreground">
                                        You don't have enough {selectedFromToken.symbol} or other tokens that can be swapped.
                                        Please acquire more tokens before placing this order.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 