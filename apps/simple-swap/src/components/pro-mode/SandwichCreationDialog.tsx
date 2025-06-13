import React, { useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CheckCircle, XCircle, Clock, Loader2, TrendingDown, TrendingUp, ArrowRight } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { useWallet } from '../../contexts/wallet-context';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { tupleCV, stringAsciiCV, uintCV, principalCV, optionalCVOf, noneCV } from '@stacks/transactions';
import TokenLogo from '../TokenLogo';

export default function SandwichCreationDialog() {
    const {
        sandwichCreationState,
        setSandwichCreationState,
        addNewOrder,
        setSandwichUsdAmount,
        setSandwichBuyPrice,
        setSandwichSellPrice,
        tradingPairBase,
        tradingPairQuote,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        baseToken
    } = useSwapContext();

    const { address } = useWallet();

    const { isOpen, phase, orders, currentOrderIndex, errors, successCount } = sandwichCreationState;

    // Helper function to sign an order
    const signOrder = useCallback(async (amountMicro: string, orderType: 'buy' | 'sell') => {
        if (!selectedFromToken || !selectedToToken) throw new Error('No tokens selected');

        // Use the correct input token for each order type
        const inputTokenContract = orderType === 'buy' ? selectedFromToken.contractId : selectedToToken.contractId;

        const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        const domain = tupleCV({
            name: stringAsciiCV('BLAZE_PROTOCOL'),
            version: stringAsciiCV('v1.0'),
            'chain-id': uintCV(1),
        });

        const message = tupleCV({
            contract: principalCV(inputTokenContract),
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
        if (!selectedFromToken || !selectedToToken || !address || !tradingPairBase || !tradingPairQuote) {
            throw new Error('Missing required data');
        }

        /* 
         * TOKEN MAPPING EXPLANATION FOR SANDWICH ORDERS:
         * 
         * Sandwich orders use trading pair configuration instead of direct from/to tokens
         * This allows for more sophisticated price monitoring across different trading pairs
         * 
         * Order Structure:
         * - conditionToken: tradingPairQuote - token price to watch
         * - baseAsset: tradingPairBase - denomination for price comparison
         * 
         * Chart Configuration (should match):
         * - Shows tradingPairQuote/tradingPairBase price relationship
         * - When chart shows sUSDh/CHA, orders watch sUSDh price in CHA terms
         * 
         * This is MORE FLEXIBLE than DCA/Single orders because:
         * - Can trade selectedFromToken/selectedToToken while monitoring different pair prices
         * - Enables complex arbitrage strategies
         */

        // Check if tokens are in reversed state (swap tokens don't match trading pair)
        const tokensReversed = (selectedFromToken.contractId !== tradingPairBase.contractId) ||
            (selectedToToken.contractId !== tradingPairQuote.contractId);

        // For sandwich orders:
        // A→B order (sell): triggers when price rises to or above the sell trigger (sell high)
        // B→A order (buy): triggers when price drops to or below the buy trigger (buy low)

        const isBuyOrder = order.type === 'buy';

        // A→B (sell high) uses ≥, B→A (buy low) uses ≤
        const direction: 'lt' | 'gt' = isBuyOrder ? 'gt' : 'lt';

        const payload = {
            owner: address,
            inputToken: isBuyOrder ? selectedFromToken.contractId : selectedToToken.contractId,
            outputToken: isBuyOrder ? selectedToToken.contractId : selectedFromToken.contractId,
            amountIn: order.amount,
            targetPrice: order.price,
            direction,
            conditionToken: tradingPairQuote.contractId, // Watch tradingPairQuote token price (maps to conditionToken)
            baseAsset: tradingPairBase.contractId, // Denominate in tradingPairBase token (maps to baseAsset)
            recipient: address,
            signature,
            uuid,
            orderType: 'sandwich', // Ensure sandwich orders are properly labeled
        };

        // Debug logging to verify token mapping
        console.log('🔍 Sandwich Order Payload Debug:', {
            orderType: 'Sandwich',
            orderSubType: order.type,
            swapAction: `${order.type === 'buy' ? 'A→B' : 'B→A'} (${order.type === 'buy' ? selectedFromToken.symbol + '→' + selectedToToken.symbol : selectedToToken.symbol + '→' + selectedFromToken.symbol})`,
            payload: {
                inputToken: `${order.type === 'buy' ? selectedFromToken.symbol : selectedToToken.symbol} (${order.type === 'buy' ? selectedFromToken.contractId : selectedToToken.contractId})`,
                outputToken: `${order.type === 'buy' ? selectedToToken.symbol : selectedFromToken.symbol} (${order.type === 'buy' ? selectedToToken.contractId : selectedFromToken.contractId})`,
                conditionToken: `${tradingPairQuote.symbol} (${tradingPairQuote.contractId})`,
                baseAsset: `${tradingPairBase.symbol} (${tradingPairBase.contractId})`,
                targetPrice: order.price,
                direction
            },
            interpretation: `Watch ${tradingPairQuote.symbol} price in ${tradingPairBase.symbol} terms`,
            chartShould: `Show ${tradingPairBase.symbol}/${tradingPairQuote.symbol} ratio (how much ${tradingPairBase.symbol} per 1 ${tradingPairQuote.symbol})`
        });

        return payload;
    }, [selectedFromToken, selectedToToken, address, tradingPairBase, tradingPairQuote, orders]);

    // Process individual order
    const processOrder = useCallback(async (orderIndex: number) => {
        const order = orders[orderIndex];
        if (!order) return;

        try {
            // Update order status to signing
            setSandwichCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, status: 'signing' } : o
                )
            }));

            // Sign the order
            const { signature, uuid } = await signOrder(order.amount, order.type);

            // Update order with signature
            setSandwichCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, signature, uuid } : o
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
                inputTokenMeta: order.type === 'buy' ? selectedFromToken : selectedToToken,
                outputTokenMeta: order.type === 'buy' ? selectedToToken : selectedFromToken,
                conditionTokenMeta: tradingPairQuote,
                baseAssetMeta: tradingPairBase,
            };

            // Add to main order list
            addNewOrder(displayOrder);

            // Mark order as successful
            setSandwichCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, status: 'success' } : o
                ),
                successCount: prev.successCount + 1
            }));

        } catch (error) {
            console.error(`Order ${orderIndex + 1} failed:`, error);

            // Mark order as failed
            setSandwichCreationState(prev => ({
                ...prev,
                orders: prev.orders.map((o, i) =>
                    i === orderIndex ? { ...o, status: 'error', error: (error as Error).message } : o
                ),
                errors: [...prev.errors, `${getSwapDirection(order.type)} swap: ${(error as Error).message}`]
            }));
        }
    }, [orders, signOrder, createOrderPayload, setSandwichCreationState, selectedFromToken, selectedToToken, tradingPairBase, tradingPairQuote, addNewOrder]);

    // Start the signing process
    const startSigning = useCallback(async () => {
        setSandwichCreationState(prev => ({
            ...prev,
            phase: 'signing',
            currentOrderIndex: 0
        }));

        // Process orders sequentially
        for (let i = 0; i < orders.length; i++) {
            setSandwichCreationState(prev => ({
                ...prev,
                currentOrderIndex: i
            }));

            await processOrder(i);
        }

        // Move to complete phase
        setSandwichCreationState(prev => ({
            ...prev,
            phase: 'complete'
        }));
    }, [orders.length, processOrder, setSandwichCreationState]);

    // Close dialog and cleanup
    const closeDialog = useCallback(() => {
        setSandwichCreationState(prev => ({
            ...prev,
            isOpen: false
        }));

        // If successful, clear form - individual orders are added via processOrder during creation
        if (successCount > 0) {
            setSandwichUsdAmount('');
            setSandwichBuyPrice('');
            setSandwichSellPrice('');

            if (successCount === orders.length) {
                toast.success('Sandwich strategy created successfully!');
            } else {
                toast.success(`${successCount} of ${orders.length} swaps created successfully`);
            }
        }

        // Reset state after a delay
        setTimeout(() => {
            setSandwichCreationState({
                isOpen: false,
                phase: 'preview',
                orders: [],
                currentOrderIndex: 0,
                usdAmount: '',
                buyPrice: '',
                sellPrice: '',
                spread: '',
                errors: [],
                successCount: 0
            });
        }, 300);
    }, [successCount, orders.length, setSandwichCreationState, setSandwichUsdAmount, setSandwichBuyPrice, setSandwichSellPrice]);

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

    const getOrderTypeIcon = (type: 'buy' | 'sell') => {
        return type === 'buy'
            ? <TrendingDown className="w-4 h-4 text-green-500" />
            : <TrendingUp className="w-4 h-4 text-red-500" />;
    };

    // Helper to get swap direction text
    const getSwapDirection = (type: 'buy' | 'sell') => {
        if (!selectedFromToken || !selectedToToken) return '';

        if (type === 'buy') {
            return `A→B (${selectedFromToken.symbol} → ${selectedToToken.symbol})`;
        } else {
            return `B→A (${selectedToToken.symbol} → ${selectedFromToken.symbol})`;
        }
    };

    // Component to show swap direction with token images
    const SwapDirectionDisplay = ({ type }: { type: 'buy' | 'sell' }) => {
        if (!selectedFromToken || !selectedToToken) return null;

        const fromToken = type === 'buy' ? selectedFromToken : selectedToToken;
        const toToken = type === 'buy' ? selectedToToken : selectedFromToken;

        return (
            <div className="flex items-center space-x-2">
                <TokenLogo
                    token={{ ...fromToken, image: fromToken.image ?? undefined }}
                    size="sm"
                />
                <ArrowRight className="w-3 h-3 text-gray-400" />
                <TokenLogo
                    token={{ ...toToken, image: toToken.image ?? undefined }}
                    size="sm"
                />
            </div>
        );
    };





    // Helper to get swap description with correct operators
    const getSwapDescription = (type: 'buy' | 'sell') => {
        if (!selectedFromToken || !selectedToToken || orders.length < 2) return '';

        const order = orders.find(o => o.type === type);
        if (!order) return '';

        const price = parseFloat(order.price);

        if (type === 'buy') {
            return `A→B swap (sell) when 1 ${tradingPairQuote?.symbol} ≥ ${price} ${tradingPairBase?.symbol}`;
        } else {
            return `B→A swap (buy) when 1 ${tradingPairQuote?.symbol} ≤ ${price} ${tradingPairBase?.symbol}`;
        }
    };



    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create Sandwich Strategy</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Strategy Explanation and Warnings */}
                    {phase === 'preview' && (
                        <div className="space-y-3">
                            {/* Strategy Explanation */}
                            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                <div className="text-sm text-blue-800 dark:text-blue-200">
                                    <strong>📈 Sandwich Strategy:</strong> Creates two conditional swaps that profit from price volatility.
                                    A→B triggers when price rises to sell level, B→A triggers when price drops to buy level (sell high, buy low).
                                </div>
                            </div>


                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                        {/* Token Pair Display */}
                        {selectedFromToken && selectedToToken && (
                            <div className="flex items-center justify-center space-x-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-center space-x-1">
                                    <TokenLogo
                                        token={{ ...selectedFromToken, image: selectedFromToken.image ?? undefined }}
                                        size="md"
                                    />
                                    <span className="text-sm font-medium text-gray-600">A</span>
                                </div>
                                <span className="text-lg font-medium text-gray-400">⇄</span>
                                <div className="flex items-center space-x-1">
                                    <TokenLogo
                                        token={{ ...selectedToToken, image: selectedToToken.image ?? undefined }}
                                        size="md"
                                    />
                                    <span className="text-sm font-medium text-gray-600">B</span>
                                </div>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {selectedFromToken.symbol}/{selectedToToken.symbol}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">USD Amount:</span>
                            <span className="font-medium">${sandwichCreationState.usdAmount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground font-medium">A→B Trigger (sell):</span>
                            <span className="font-mono">1 {tradingPairQuote?.symbol} ≥ {sandwichCreationState.sellPrice} {tradingPairBase?.symbol}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground font-medium">B→A Trigger (buy):</span>
                            <span className="font-mono">1 {tradingPairQuote?.symbol} ≤ {sandwichCreationState.buyPrice} {tradingPairBase?.symbol}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Spread:</span>
                            <span className="font-medium">{sandwichCreationState.spread}%</span>
                        </div>
                    </div>

                    {/* Progress */}
                    {phase !== 'preview' && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{successCount}/{orders.length} swaps</span>
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
                    <div className="space-y-3">
                        {orders.map((order, index) => (
                            <div
                                key={index}
                                className={`flex items-center justify-between p-3 rounded-lg border ${currentOrderIndex === index && phase === 'signing'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                    : 'border-gray-200 dark:border-gray-700'
                                    }`}
                            >
                                <div className="flex items-center space-x-3">
                                    {order.type === 'buy' ?
                                        <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                            <span className="text-xs text-white font-bold">A</span>
                                        </div> :
                                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                                            <span className="text-xs text-white font-bold">B</span>
                                        </div>
                                    }
                                    <div className="flex-1">
                                        <SwapDirectionDisplay type={order.type} />
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {getSwapDescription(order.type)}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-500">
                                            {order.type === 'buy' ? (
                                                <>Trigger: 1 {tradingPairQuote?.symbol} ≥ {order.price} {tradingPairBase?.symbol}</>
                                            ) : (
                                                <>Trigger: 1 {tradingPairQuote?.symbol} ≤ {order.price} {tradingPairBase?.symbol}</>
                                            )}
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
                                    Create Strategy
                                </Button>
                            </>
                        )}
                        {phase === 'signing' && (
                            <Button variant="outline" disabled>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating Strategy...
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