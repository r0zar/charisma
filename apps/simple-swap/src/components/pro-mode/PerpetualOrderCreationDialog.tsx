"use client";

import React, { useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Info, AlertTriangle } from 'lucide-react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import { useWallet } from '../../contexts/wallet-context';
import { useMarginAccountAPI } from '../../hooks/useMarginAccountAPI';
import { useCreatePerpetualPosition } from '../../hooks/usePerps';
import { toast } from 'sonner';

export default function PerpetualOrderCreationDialog() {
    const {
        perpetualCreationState,
        setPerpetualCreationState,
        perpetualMarginRequired,
        perpetualLiquidationPrice,
        perpetualCurrentPnL,
        formatCompactPrice,
        tradingPairBase,
        refetchPerpetualPositions,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        formatUsd,
        getUsdPrice,
    } = useSwapContext();

    const { address } = useWallet();
    const { createPosition, isLoading: isCreatingPosition } = useCreatePerpetualPosition();
    const {
        account,
        canOpenPosition,
        updateMarginUsage,
        formatBalance
    } = useMarginAccountAPI();

    const { isOpen, phase, order, errors, previewMode } = perpetualCreationState;

    // Start the real position creation process
    const startCreation = useCallback(async () => {
        if (!order || !selectedFromToken || !selectedToToken || !address || !tradingPairBase) {
            toast.error('Missing required data for position creation');
            return;
        }

        // Check margin requirements BEFORE creating position
        const marginRequired = perpetualMarginRequired;
        if (!account || !canOpenPosition(marginRequired)) {
            const shortfall = account ? marginRequired - account.freeMargin : marginRequired;
            toast.error(`Insufficient margin. Need ${formatBalance(shortfall)} more to open this position.`);
            return;
        }

        setPerpetualCreationState(prev => ({
            ...prev,
            phase: 'signing'
        }));

        try {
            // Generate UUID and signature for the position
            const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();

            // Mock signature for preview mode (signature verification is disabled)
            const mockSignature = 'preview-mode-signature-' + '0'.repeat(100); // Mock signature

            // Create the trading pair string
            const tradingPair = `${selectedFromToken.symbol}/${selectedToToken.symbol}`;

            // Prepare position data for API - only send user inputs, let backend calculate risk parameters
            const positionData = {
                owner: address,
                tradingPair,
                direction: order.direction,
                positionSize: parseFloat(order.positionSize).toFixed(8),
                leverage: Number(order.leverage),
                triggerPrice: parseFloat(order.entryPrice).toFixed(8), // Entry price becomes trigger price
                stopLoss: order.stopLoss ? parseFloat(order.stopLoss).toFixed(8) : undefined,
                takeProfit: order.takeProfit ? parseFloat(order.takeProfit).toFixed(8) : undefined,
                signature: mockSignature,
                uuid,
                baseAsset: selectedToToken.contractId, // Quote token (USDT, etc.)
                baseToken: selectedFromToken.contractId, // Base token (STX, etc.)
            };

            console.log('Creating perpetual position (backend will calculate margin/liquidation):', positionData);

            // Call the API to create the position
            // Note: Backend will calculate marginRequired and liquidationPrice for security
            const createdPosition = await createPosition(positionData);

            // SUCCESS: Update margin usage in backend (position is now pending)
            const actualMarginRequired = parseFloat(createdPosition.marginRequired);
            await updateMarginUsage(actualMarginRequired);

            console.log(`💰 Margin deducted: ${formatBalance(actualMarginRequired)} (Position: ${uuid.substring(0, 8)})`);

            setPerpetualCreationState(prev => ({
                ...prev,
                order: prev.order ? { ...prev.order, status: 'success', uuid } : null,
                phase: 'complete'
            }));

            // Position created successfully - it will appear in the sidebar within 60 seconds via automatic polling
            console.log('✅ Position created successfully');

            toast.success(`Position created! ${formatBalance(actualMarginRequired)} margin allocated.`);

            // Refresh positions list to immediately show the new position
            await refetchPerpetualPositions();
        } catch (error) {
            console.error('Failed to create perpetual position:', error);
            toast.error('Failed to create position: ' + (error instanceof Error ? error.message : 'Unknown error'));

            setPerpetualCreationState(prev => ({
                ...prev,
                phase: 'preview' // Go back to preview on error
            }));
        }
    }, [order, selectedFromToken, selectedToToken, address, tradingPairBase, perpetualMarginRequired, perpetualLiquidationPrice, createPosition, setPerpetualCreationState, refetchPerpetualPositions, canOpenPosition, account?.freeMargin, formatBalance, updateMarginUsage]);

    // Close dialog and cleanup
    const closeDialog = useCallback(() => {
        setPerpetualCreationState(prev => ({
            ...prev,
            isOpen: false
        }));

        // Show success message - perpetual positions will appear automatically via API refresh
        if (order?.status === 'success') {
            toast.success('Perpetual position created successfully! (Preview Mode)');
        }

        // Reset state after a delay
        setTimeout(() => {
            setPerpetualCreationState({
                isOpen: false,
                phase: 'preview',
                order: null,
                errors: [],
                previewMode: true
            });
        }, 300);
    }, [order?.status, setPerpetualCreationState]);

    // Calculate potential liquidation risk
    const getLiquidationRisk = () => {
        if (!order || !perpetualLiquidationPrice || !order.entryPrice) return 'low';

        const entryPrice = parseFloat(order.entryPrice);
        const liquidationDistance = Math.abs(perpetualLiquidationPrice - entryPrice) / entryPrice;

        if (liquidationDistance < 0.05) return 'high'; // Less than 5%
        if (liquidationDistance < 0.15) return 'medium'; // Less than 15%
        return 'low';
    };

    const liquidationRisk = getLiquidationRisk();

    if (!selectedFromToken || !selectedToToken || !order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {phase === 'preview' && (
                            <>
                                {order.direction === 'long' ? (
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                ) : (
                                    <TrendingDown className="h-5 w-5 text-red-600" />
                                )}
                                Create {order.direction === 'long' ? 'Long' : 'Short'} Position
                                <Badge variant="secondary" className="ml-2">Preview</Badge>
                            </>
                        )}
                        {phase === 'signing' && (
                            <>
                                <Clock className="h-5 w-5 animate-spin" />
                                Creating Position...
                            </>
                        )}
                        {phase === 'complete' && order?.status === 'success' && (
                            <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                Position Created Successfully
                            </>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {phase === 'preview' && (
                        <>
                            {/* Preview Mode Banner */}
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                                <div className="flex items-center space-x-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                                        This is a preview - no real funds will be used or risked
                                    </span>
                                </div>
                            </div>

                            {/* Liquidation Risk Warning */}
                            {liquidationRisk === 'high' && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                                                High Liquidation Risk
                                            </h4>
                                            <p className="text-sm text-red-700 dark:text-red-300">
                                                Your position has a high risk of liquidation due to high leverage.
                                                Consider reducing leverage or increasing margin.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Position Summary */}
                            <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                                <h3 className="font-medium text-foreground mb-3">Position Summary</h3>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Direction:</span>
                                        <div className={`font-medium flex items-center gap-1 ${order.direction === 'long' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {order.direction === 'long' ? (
                                                <TrendingUp className="w-4 h-4" />
                                            ) : (
                                                <TrendingDown className="w-4 h-4" />
                                            )}
                                            {order.direction.toUpperCase()}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">Leverage:</span>
                                        <div className="font-medium">
                                            {order.leverage}x
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">Position Size:</span>
                                        <div className="font-medium">
                                            {formatUsd(parseFloat(order.positionSize))}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">Entry Price:</span>
                                        <div className="font-medium">
                                            {formatUsd(parseFloat(order.entryPrice))}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">Margin Required:</span>
                                        <div className="font-medium">
                                            {formatUsd(perpetualMarginRequired)}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-muted-foreground">Liquidation Price:</span>
                                        <div className={`font-medium ${liquidationRisk === 'high' ? 'text-red-600' : ''}`}>
                                            {formatUsd(perpetualLiquidationPrice)}
                                        </div>
                                    </div>
                                </div>

                                {/* Stop Loss & Take Profit */}
                                {(order.stopLoss || order.takeProfit) && (
                                    <div className="pt-3 border-t border-border/50">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            {order.stopLoss && (
                                                <div>
                                                    <span className="text-muted-foreground">Stop Loss:</span>
                                                    <div className="font-medium text-red-600">
                                                        {formatUsd(parseFloat(order.stopLoss))}
                                                    </div>
                                                </div>
                                            )}
                                            {order.takeProfit && (
                                                <div>
                                                    <span className="text-muted-foreground">Take Profit:</span>
                                                    <div className="font-medium text-green-600">
                                                        {formatUsd(parseFloat(order.takeProfit))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Trading Pair */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                                            Trading Pair: {selectedFromToken.symbol}/{selectedToToken.symbol}
                                        </h4>
                                        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                            <p>
                                                You're opening a <strong>{order.direction}</strong> position on {selectedFromToken.symbol}
                                                {order.direction === 'long'
                                                    ? ', expecting the price to go up'
                                                    : ', expecting the price to go down'
                                                }.
                                            </p>
                                            <p className="text-xs opacity-90">
                                                With {order.leverage}x leverage, a 1% price movement will result in a {order.leverage}% gain/loss.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Warning */}
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                                            Risk Disclosure
                                        </h4>
                                        <div className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                                            <p>• Leveraged trading carries significant risk of loss</p>
                                            <p>• You could lose more than your initial margin</p>
                                            <p>• Your position may be liquidated if the price moves against you</p>
                                            <p>• This is a preview mode - no real trading will occur</p>
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
                                    onClick={startCreation}
                                    className="flex-1"
                                >
                                    Create Position (Preview)
                                </Button>
                            </div>
                        </>
                    )}

                    {phase === 'signing' && (
                        <div className="text-center py-8">
                            <Clock className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                            <h3 className="text-lg font-medium mb-2">Creating Position...</h3>
                            <p className="text-muted-foreground">
                                Setting up your {order.direction} position in preview mode
                            </p>
                        </div>
                    )}

                    {phase === 'complete' && order?.status === 'success' && (
                        <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">Position Created!</h3>
                            <p className="text-muted-foreground mb-4">
                                Your {order.direction} position has been created in preview mode.
                            </p>
                            <Button onClick={closeDialog} className="w-full">
                                Continue Trading
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
} 