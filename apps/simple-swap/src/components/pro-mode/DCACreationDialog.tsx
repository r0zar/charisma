"use client";

import React, { useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, Clock, Loader2, Repeat, Calendar } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { useWallet } from '../../contexts/wallet-context';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { tupleCV, stringAsciiCV, uintCV, principalCV, optionalCVOf, noneCV } from '@stacks/transactions';
import TokenLogo from '../TokenLogo';

export default function DCACreationDialog() {
    const {
        dcaCreationState,
        setDcaCreationState,
        addNewOrder,
        setDcaAmount,
        setDcaFrequency,
        setDcaDuration,
        setDcaStartDate,
        targetPrice,
        conditionDir
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        baseToken
    } = useSwapContext();

    const { address } = useWallet();

    const { isOpen, phase, orders, currentOrderIndex, errors, successCount, intervalHours } = dcaCreationState;

    // Helper function to sign an order
    const signOrder = useCallback(async (amountMicro: string, validFrom: string, validTo: string) => {
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
    const createOrderPayload = useCallback((order: typeof orders[0], signature: string, uuid: string) => {
        if (!selectedFromToken || !selectedToToken || !address) {
            throw new Error('Missing required data');
        }

        /* 
         * TOKEN MAPPING EXPLANATION FOR DCA ORDERS:
         * 
         * User Action: Buying selectedToToken using selectedFromToken
         * Example: Buying CHA using sUSDh
         * 
         * User expects: "1 sUSDh >= 4.18 CHA" (when I can get at least 4.18 CHA for 1 sUSDh)
         * 
         * Order Structure:
         * - inputToken: selectedFromToken (sUSDh) - what user is spending
         * - outputToken: selectedToToken (CHA) - what user is buying
         * - conditionToken: selectedFromToken (sUSDh) - watch FROM token's buying power
         * - baseAsset: selectedToToken (CHA) - denominate in TO token terms
         * 
         * This creates the condition: "1 sUSDh >= X CHA" where X is the target price
         * The backend watches sUSDh's exchange rate in CHA terms
         */

        const amountMicro = Math.floor(order.amount * (10 ** (selectedFromToken.decimals || 6))).toString();

        const payload = {
            owner: address,
            inputToken: selectedFromToken.contractId,
            outputToken: selectedToToken.contractId,
            amountIn: amountMicro,
            targetPrice: targetPrice || '0', // DCA orders can have no target price (market orders)
            direction: conditionDir,
            // CORRECTED: Watch FROM token's buying power in TO token terms
            // This creates: "1 FROM_token >= X TO_tokens" condition
            conditionToken: selectedFromToken.contractId,  // Watch FROM token's exchange rate
            baseAsset: selectedToToken.contractId,         // Denominate in TO token terms
            recipient: address,
            signature,
            uuid,
            validFrom: order.validFrom,
            validTo: order.validTo,
        };

        // Debug logging to verify token mapping
        console.log('🔍 DCA Order Payload Debug:', {
            orderType: 'DCA',
            userAction: `Buying ${selectedToToken.symbol} with ${selectedFromToken.symbol}`,
            payload: {
                inputToken: `${selectedFromToken.symbol} (${selectedFromToken.contractId})`,
                outputToken: `${selectedToToken.symbol} (${selectedToToken.contractId})`,
                conditionToken: `${selectedFromToken.symbol} (${selectedFromToken.contractId})`,
                baseAsset: `${selectedToToken.symbol} (${selectedToToken.contractId})`,
                targetPrice: targetPrice || '0',
                direction: conditionDir
            },
            expectedCondition: conditionDir === 'gt'
                ? `1 ${selectedFromToken.symbol} >= ${targetPrice || 'X'} ${selectedToToken.symbol}`
                : `1 ${selectedToToken.symbol} >= ${targetPrice || 'X'} ${selectedFromToken.symbol}`,
            interpretation: `Watch ${selectedFromToken.symbol} buying power in ${selectedToToken.symbol} terms`,
            chartShould: `Show ${selectedToToken.symbol}/${selectedFromToken.symbol} ratio (how much ${selectedToToken.symbol} per 1 ${selectedFromToken.symbol})`
        });

        return payload;
    }, [selectedFromToken, selectedToToken, address, targetPrice, conditionDir]);

    // Process individual order
    const processOrder = useCallback(async (orderIndex: number) => {
        const order = orders[orderIndex];
        if (!order) return;

        try {
            // Update order status to signing
            setDcaCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, status: 'signing' } : o
                )
            }));

            // Calculate amount in micro units
            const amountMicro = Math.floor(order.amount * (10 ** (selectedFromToken?.decimals || 6))).toString();

            // Sign the order
            const { signature, uuid } = await signOrder(amountMicro, order.validFrom, order.validTo);

            // Update order with signature
            setDcaCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, uuid } : o
                )
            }));

            // Create order payload
            const orderPayload = createOrderPayload(order, signature, uuid);

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

            // Get the created order data from response
            const responseData = await response.json();
            const createdOrder = responseData.data || responseData;

            // Create DisplayOrder with token metadata for the sidebar
            const displayOrder = {
                ...createdOrder,
                inputTokenMeta: selectedFromToken,
                outputTokenMeta: selectedToToken,
                conditionTokenMeta: selectedFromToken,  // Token being watched for price changes (FROM token)
                baseAssetMeta: selectedToToken,         // Token used for price denomination (TO token)
            };

            // Add to main order list
            addNewOrder(displayOrder);

            // Mark order as successful
            setDcaCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, status: 'success' } : o
                ),
                successCount: prev.successCount + 1
            }));

        } catch (error) {
            console.error(`DCA Order ${orderIndex + 1} failed:`, error);

            // Mark order as failed
            setDcaCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, status: 'error', error: (error as Error).message } : o
                ),
                errors: [...prev.errors, `Order ${orderIndex + 1}: ${(error as Error).message}`]
            }));
        }
    }, [orders, signOrder, createOrderPayload, setDcaCreationState, selectedFromToken, selectedToToken, baseToken, addNewOrder]);

    // Start the signing process
    const startSigning = useCallback(async () => {
        setDcaCreationState(prev => ({
            ...prev,
            phase: 'signing',
            currentOrderIndex: 0
        }));

        // Process orders sequentially
        for (let i = 0; i < orders.length; i++) {
            setDcaCreationState(prev => ({
                ...prev,
                currentOrderIndex: i
            }));

            await processOrder(i);
        }

        // Move to complete phase
        setDcaCreationState(prev => ({
            ...prev,
            phase: 'complete'
        }));
    }, [orders.length, processOrder, setDcaCreationState]);

    // Close dialog and cleanup
    const closeDialog = useCallback(() => {
        setDcaCreationState(prev => ({
            ...prev,
            isOpen: false
        }));

        // If successful, clear form - individual orders are added via processOrder during creation
        if (successCount > 0) {
            setDcaAmount('');
            setDcaFrequency('daily');
            setDcaDuration('30');
            setDcaStartDate('');

            if (successCount === orders.length) {
                toast.success('DCA strategy created successfully!');
            } else {
                toast.success(`${successCount} of ${orders.length} orders created successfully`);
            }
        }

        // Reset state after a delay
        setTimeout(() => {
            setDcaCreationState({
                isOpen: false,
                phase: 'preview',
                orders: [],
                currentOrderIndex: 0,
                totalOrders: 0,
                amountPerOrder: 0,
                intervalHours: 24,
                startDate: '',
                errors: [],
                successCount: 0
            });
        }, 300);
    }, [successCount, orders.length, setDcaCreationState, setDcaAmount, setDcaFrequency, setDcaDuration, setDcaStartDate]);

    // Calculate progress
    const progress = orders.length > 0 ? (successCount / orders.length) * 100 : 0;

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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const getFrequencyLabel = () => {
        if (intervalHours === 1 / 60) return 'Every Minute';
        if (intervalHours === 5 / 60) return 'Every 5 Minutes';
        if (intervalHours === 15 / 60) return 'Every 15 Minutes';
        if (intervalHours === 30 / 60) return 'Every 30 Minutes';
        if (intervalHours === 1) return 'Hourly';
        if (intervalHours === 24) return 'Daily';
        if (intervalHours === 168) return 'Weekly';
        if (intervalHours === 720) return 'Monthly';
        // Handle fractional hours for minutes
        if (intervalHours < 1) {
            const minutes = Math.round(intervalHours * 60);
            return `Every ${minutes} Minutes`;
        }
        return `Every ${intervalHours}h`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create DCA Strategy</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Strategy Explanation */}
                    {phase === 'preview' && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Dollar-Cost Averaging:</strong> Splits your total amount into {orders.length} smaller orders
                                executed over time to reduce the impact of price volatility.
                            </div>
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                        {/* Token Pair Display */}
                        {selectedFromToken && selectedToToken && (
                            <div className="flex items-center justify-center space-x-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                                <TokenLogo
                                    token={{ ...selectedFromToken, image: selectedFromToken.image ?? undefined }}
                                    size="md"
                                />
                                <span className="text-lg font-medium text-gray-400">→</span>
                                <TokenLogo
                                    token={{ ...selectedToToken, image: selectedToToken.image ?? undefined }}
                                    size="md"
                                />
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {selectedFromToken.symbol}/{selectedToToken.symbol}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                            <span className="font-medium">{dcaCreationState.amountPerOrder * orders.length} {selectedFromToken?.symbol}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Number of Orders:</span>
                            <span className="font-medium">{orders.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Amount per Order:</span>
                            <span className="font-medium">{dcaCreationState.amountPerOrder.toFixed(6)} {selectedFromToken?.symbol}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Frequency:</span>
                            <span className="font-medium">{getFrequencyLabel()}</span>
                        </div>
                    </div>

                    {/* Progress */}
                    {phase !== 'preview' && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{successCount}/{orders.length} orders</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Orders List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {orders.slice(0, 5).map((order, index) => (
                            <div
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-lg border text-sm ${currentOrderIndex === index && phase === 'signing'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                    : 'border-gray-200 dark:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    <Repeat className="w-4 h-4 text-blue-500" />
                                    <div>
                                        <div className="font-medium">Order #{index + 1}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                            {formatDate(order.validFrom)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {order.amount.toFixed(6)} {selectedFromToken?.symbol}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {getOrderIcon(order.status)}
                                    {order.error && (
                                        <span className="text-xs text-red-500 max-w-32 truncate">
                                            {order.error}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {orders.length > 5 && (
                            <div className="text-center text-sm text-gray-500 py-2">
                                ... and {orders.length - 5} more orders
                            </div>
                        )}
                    </div>

                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
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

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                        {phase === 'preview' && (
                            <>
                                <Button variant="outline" onClick={closeDialog}>
                                    Cancel
                                </Button>
                                <Button onClick={startSigning}>
                                    Create DCA Strategy
                                </Button>
                            </>
                        )}
                        {phase === 'signing' && (
                            <Button variant="outline" disabled>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating Orders...
                            </Button>
                        )}
                        {phase === 'complete' && (
                            <Button onClick={closeDialog}>
                                {successCount === orders.length ? 'Done' : 'Close'}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 