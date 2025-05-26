"use client";

import React, { useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, Clock, Loader2, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { useWallet } from '../../contexts/wallet-context';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { tupleCV, stringAsciiCV, uintCV, principalCV, optionalCVOf, noneCV } from '@stacks/transactions';
import { TokenCacheData } from '@repo/tokens';

// Helper function to format token balance with dynamic precision
const formatTokenBalance = (balance: number, token: TokenCacheData): string => {
    const decimals = token.decimals || 6;

    if (balance === 0) return '0';
    if (balance < 0.001) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 10)
        });
    } else if (balance < 1) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 6)
        });
    } else {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 4)
        });
    }
};

export default function SingleOrderCreationDialog() {
    const {
        singleOrderCreationState,
        setSingleOrderCreationState,
        fetchOrders,
        setDisplayAmount,
        setTargetPrice,
        currentPrice
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        baseToken,
        getUsdPrice,
        formatUsd,
    } = useSwapContext();

    const { address } = useWallet();

    const { isOpen, phase, order, errors } = singleOrderCreationState;

    // Helper function to sign an order
    const signOrder = useCallback(async (amountMicro: string, targetPrice: string, conditionDir: 'lt' | 'gt') => {
        if (!selectedFromToken || !selectedToToken) throw new Error('No tokens selected');

        const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        const domain = tupleCV({
            name: stringAsciiCV('BLAZE_PROTOCOL'),
            version: stringAsciiCV('v1.0'),
            'chain-id': uintCV(1),
        });

        const message = tupleCV({
            contract: principalCV(selectedFromToken.contractId),
            intent: stringAsciiCV('TRANSFER_TOKENS'),
            opcode: noneCV(),
            amount: optionalCVOf(uintCV(BigInt(amountMicro))),
            target: optionalCVOf(principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9')),
            uuid: stringAsciiCV(uuid),
        });

        // @ts-ignore – upstream types don't include method yet
        const res = await request('stx_signStructuredMessage', { domain, message });
        if (!res?.signature) throw new Error('User cancelled the signature');

        return { signature: res.signature as string, uuid };
    }, [selectedFromToken, selectedToToken]);

    // Create order payload
    const createOrderPayload = useCallback((signature: string, uuid: string) => {
        if (!selectedFromToken || !selectedToToken || !address || !order) {
            throw new Error('Missing required data');
        }

        const amountMicro = Math.floor(parseFloat(order.amount) * (10 ** (selectedFromToken.decimals || 6))).toString();

        return {
            owner: address,
            inputToken: selectedFromToken.contractId,
            outputToken: selectedToToken.contractId,
            amountIn: amountMicro,
            targetPrice: order.targetPrice,
            direction: order.conditionDir,
            conditionToken: selectedToToken.contractId,
            baseAsset: baseToken?.contractId || 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt',
            recipient: address,
            signature,
            uuid,
        };
    }, [selectedFromToken, selectedToToken, address, baseToken, order]);

    // Process the order
    const processOrder = useCallback(async () => {
        if (!order) return;

        try {
            // Update order status to signing
            setSingleOrderCreationState(prev => ({
                ...prev,
                order: prev.order ? { ...prev.order, status: 'signing' } : null
            }));

            // Calculate amount in micro units
            const amountMicro = Math.floor(parseFloat(order.amount) * (10 ** (selectedFromToken?.decimals || 6))).toString();

            // Sign the order
            const { signature, uuid } = await signOrder(amountMicro, order.targetPrice, order.conditionDir);

            // Update order with signature
            setSingleOrderCreationState(prev => ({
                ...prev,
                order: prev.order ? { ...prev.order, signature, uuid } : null
            }));

            // Create order payload
            const orderPayload = createOrderPayload(signature, uuid);

            // Submit order to API
            const response = await fetch('/api/v1/orders/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Order creation failed' }));
                throw new Error(errorData.error || 'Order creation failed');
            }

            // Mark order as successful
            setSingleOrderCreationState(prev => ({
                ...prev,
                order: prev.order ? { ...prev.order, status: 'success' } : null
            }));

        } catch (error) {
            console.error('Order creation failed:', error);

            // Mark order as failed
            setSingleOrderCreationState(prev => ({
                ...prev,
                order: prev.order ? { ...prev.order, status: 'error', error: (error as Error).message } : null,
                errors: [...prev.errors, (error as Error).message]
            }));
        }
    }, [order, signOrder, createOrderPayload, setSingleOrderCreationState, selectedFromToken]);

    // Start the signing process
    const startSigning = useCallback(async () => {
        setSingleOrderCreationState(prev => ({
            ...prev,
            phase: 'signing'
        }));

        await processOrder();

        // Move to complete phase
        setSingleOrderCreationState(prev => ({
            ...prev,
            phase: 'complete'
        }));
    }, [processOrder, setSingleOrderCreationState]);

    // Close dialog and cleanup
    const closeDialog = useCallback(() => {
        setSingleOrderCreationState(prev => ({
            ...prev,
            isOpen: false
        }));

        // If successful, clear form and refresh orders
        if (order?.status === 'success') {
            setDisplayAmount('');
            setTargetPrice('');
            fetchOrders();
            toast.success('Limit order created successfully!');
        }

        // Reset state after a delay
        setTimeout(() => {
            setSingleOrderCreationState({
                isOpen: false,
                phase: 'preview',
                order: null,
                errors: []
            });
        }, 300);
    }, [order?.status, setSingleOrderCreationState, setDisplayAmount, setTargetPrice, fetchOrders]);

    // Check if order will execute immediately
    const willExecuteImmediately = () => {
        if (!currentPrice || !order?.targetPrice) return false;

        const target = parseFloat(order.targetPrice);
        if (isNaN(target)) return false;

        if (order.conditionDir === 'gt') {
            return currentPrice >= target;
        } else {
            return currentPrice <= target;
        }
    };

    // Calculate estimated output amount (simplified)
    const getEstimatedOutput = () => {
        if (!selectedFromToken || !selectedToToken || !order?.amount || !order?.targetPrice) return null;

        const inputAmount = parseFloat(order.amount);
        const price = parseFloat(order.targetPrice);

        if (isNaN(inputAmount) || isNaN(price)) return null;

        // Simple calculation - in reality this would be more complex
        return inputAmount * price;
    };

    const immediateExecution = willExecuteImmediately();
    const estimatedOutput = getEstimatedOutput();

    const getOrderIcon = (status: string) => {
        switch (status) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-500" />;
            case 'signing':
                return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
            default:
                return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    if (!selectedFromToken || !selectedToToken) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {phase === 'preview' && (
                            <>
                                <TrendingUp className="h-5 w-5" />
                                Create Limit Order
                            </>
                        )}
                        {phase === 'signing' && (
                            <>
                                <Clock className="h-5 w-5 animate-spin" />
                                Creating Order...
                            </>
                        )}
                        {phase === 'complete' && order?.status === 'success' && (
                            <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                Order Created Successfully
                            </>
                        )}
                        {phase === 'complete' && order?.status === 'error' && (
                            <>
                                <XCircle className="h-5 w-5 text-red-500" />
                                Order Creation Failed
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {phase === 'preview' && (
                        <>
                            {/* Immediate Execution Warning */}
                            {immediateExecution && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                                                Immediate Execution Warning
                                            </h4>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                Your target price condition is already met! This order will execute immediately upon creation.
                                                Current rate: 1 {selectedFromToken.symbol} = {currentPrice?.toFixed(6)} {selectedToToken.symbol}, Target: {order?.conditionDir === 'gt' ? '>' : '<'} {parseFloat(order?.targetPrice || '0').toFixed(6)} {selectedToToken.symbol}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Order Summary */}
                            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                <h3 className="font-medium text-foreground mb-3">Order Summary</h3>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">You're selling:</span>
                                        <div className="font-mono font-medium">
                                            {formatTokenBalance(parseFloat(order?.amount || '0'), selectedFromToken)} {selectedFromToken.symbol}
                                        </div>
                                        {(() => {
                                            const price = getUsdPrice(selectedFromToken.contractId);
                                            if (price && order?.amount) {
                                                const usdValue = price * parseFloat(order.amount);
                                                return (
                                                    <div className="text-xs text-muted-foreground">
                                                        ≈ {formatUsd(usdValue)}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">You'll receive:</span>
                                        <div className="font-mono font-medium">
                                            {estimatedOutput ? `~${formatTokenBalance(estimatedOutput, selectedToToken)}` : '~'} {selectedToToken.symbol}
                                        </div>
                                        {(() => {
                                            const price = getUsdPrice(selectedToToken.contractId);
                                            if (price && estimatedOutput) {
                                                const usdValue = price * estimatedOutput;
                                                return (
                                                    <div className="text-xs text-muted-foreground">
                                                        ≈ {formatUsd(usdValue)}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-border/50">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Target Rate:</span>
                                        <span className="font-mono font-medium">
                                            1 {selectedFromToken.symbol} {order?.conditionDir === 'gt' ? '>' : '<'} {parseFloat(order?.targetPrice || '0').toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 8
                                            })} {selectedToToken.symbol}
                                        </span>
                                    </div>
                                    {currentPrice && (
                                        <div className="flex items-center justify-between text-sm mt-1">
                                            <span className="text-muted-foreground">Current Rate:</span>
                                            <span className="font-mono">
                                                1 {selectedFromToken.symbol} = {currentPrice.toLocaleString(undefined, {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 8
                                                })} {selectedToToken.symbol}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Execution Conditions */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                                            When will this order execute?
                                        </h4>
                                        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                            <p>
                                                Your order will automatically execute when the <strong>price of 1 {selectedFromToken.symbol}</strong>
                                                {order?.conditionDir === 'gt' ? ' exceeds' : ' drops below'} {parseFloat(order?.targetPrice || '0').toFixed(6)} {selectedToToken.symbol}.
                                            </p>
                                            <p className="text-xs opacity-90 mt-1">
                                                This means when 1 {selectedFromToken.symbol} can be exchanged for {order?.conditionDir === 'gt' ? 'more than' : 'less than'} {parseFloat(order?.targetPrice || '0').toFixed(6)} {selectedToToken.symbol}.
                                            </p>
                                            {!immediateExecution && (
                                                <p className="mt-2">
                                                    <strong>You can cancel this order at any time</strong> before it executes by visiting your orders list.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={closeDialog}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={startSigning}
                                    className="flex-1"
                                >
                                    {immediateExecution ? 'Execute Order Now' : 'Create Limit Order'}
                                </Button>
                            </div>
                        </>
                    )}

                    {phase === 'signing' && (
                        <div className="space-y-4">
                            {/* Order Status */}
                            <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500 bg-blue-50 dark:bg-blue-950">
                                <div className="flex items-center space-x-3">
                                    <TrendingUp className="w-4 h-4 text-blue-500" />
                                    <div>
                                        <div className="font-medium">Limit Order</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {selectedFromToken.symbol} → {selectedToToken.symbol}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {getOrderIcon(order?.status || 'pending')}
                                    {order?.error && (
                                        <span className="text-xs text-red-500 max-w-32 truncate">
                                            {order.error}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-center py-4">
                                <Loader2 className="h-8 w-8 text-primary mx-auto mb-2 animate-spin" />
                                <p className="text-sm text-muted-foreground">
                                    {order?.status === 'signing' ? 'Please sign the transaction...' : 'Creating your order...'}
                                </p>
                            </div>
                        </div>
                    )}

                    {phase === 'complete' && (
                        <div className="text-center py-8">
                            {order?.status === 'success' ? (
                                <>
                                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">Order created successfully!</h3>
                                    <p className="text-muted-foreground">
                                        {immediateExecution
                                            ? 'Your order has been executed immediately.'
                                            : 'Your limit order is now active and will execute when conditions are met.'
                                        }
                                    </p>
                                </>
                            ) : (
                                <>
                                    <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium mb-2">Failed to create order</h3>
                                    <p className="text-muted-foreground mb-4">
                                        {order?.error || 'An unexpected error occurred. Please try again.'}
                                    </p>
                                </>
                            )}

                            {/* Errors */}
                            {errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-4">
                                    <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                                        Errors occurred:
                                    </div>
                                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                                        {errors.map((error, index) => (
                                            <li key={index}>• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-3 mt-6">
                                {order?.status === 'error' && (
                                    <Button
                                        onClick={() => setSingleOrderCreationState(prev => ({ ...prev, phase: 'preview' }))}
                                        variant="outline"
                                        className="flex-1"
                                    >
                                        Try Again
                                    </Button>
                                )}
                                <Button
                                    onClick={closeDialog}
                                    className="flex-1"
                                >
                                    {order?.status === 'success' ? 'Done' : 'Close'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
} 