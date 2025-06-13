"use client";

import React from 'react';
import { Trash2, ChevronDown, ChevronRight, ArrowRight, Loader2, TrendingUp, TrendingDown, LogOut, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import TokenLogo from '../TokenLogo';
import { toast } from 'sonner';
import { usePerpetualPositions, usePositionPnL, useCancelPerpetualPosition } from '../../hooks/usePerps';
import { useWallet } from '../../contexts/wallet-context';
import { TokenCacheData } from '@repo/tokens';

interface OrdersSidebarProps {
    collapsed: boolean;
}

export default function OrdersSidebar({ collapsed }: OrdersSidebarProps) {
    const {
        pairFilteredOrders,
        swapFilteredOrders,
        shouldShowSplitSections,
        tradingPairBase,
        tradingPairQuote,
        expandedOrderId,
        setExpandedOrderId,
        showAllOrders,
        setShowAllOrders,
        isLoadingOrders,
        ordersError,
        handleOrderAction,
        confirmCancelOrder,
        cancelOrderAction,
        executeOrderAction,
        cancelingOrders,
        executingOrders,
        confirmCancelOrderId,
        setConfirmCancelOrderId,
        toggleOrderExpansion,
        formatTokenAmount,
        formatCompactNumber,
        formatCompactPrice,
        formatRelativeTime,
        selectedOrderType,
        displayOrders,
        currentPrice, // Add real-time price from chart simulation
        setPerpPositionsRefetchCallback,
        recentlyUpdatedOrders,
    } = useProModeContext();

    const {
        selectedFromToken,
        selectedToToken,
        formatUsd,
        getUsdPrice,
        displayTokens,
        subnetDisplayTokens,
    } = useSwapContext();

    const { address: walletAddress } = useWallet();

    // Check if we're in perpetual mode
    const isPerpetualMode = selectedOrderType === 'perpetual';

    // Use API-based perpetual positions instead of local state
    const { positions: apiPerpetualPositions, isLoading: isPerpPositionsLoading, error: perpPositionsError, refetch: refetchPositions } = usePerpetualPositions();
    const { cancelPosition: cancelApiPosition, cancelingPositions: cancelingApiPositions } = useCancelPerpetualPosition();

    // Register refetch function with context so other components can trigger refresh
    React.useEffect(() => {
        const wrappedRefetch = async () => {
            console.log('🔄 Manual refetch triggered for perpetual positions');
            await refetchPositions();
        };
        console.log('📝 Registering perpetual positions refetch callback');
        setPerpPositionsRefetchCallback(wrappedRefetch);
        return () => {
            console.log('🧹 Unregistering perpetual positions refetch callback');
            setPerpPositionsRefetchCallback(null);
        };
    }, [refetchPositions, setPerpPositionsRefetchCallback]);

    // Smart filtering state - defaults to show all orders (moved before useMemo to fix initialization order)
    const [orderTypeFilter, setOrderTypeFilter] = React.useState<'all' | 'regular' | 'perpetual'>('all');
    const [viewMode, setViewMode] = React.useState<'individual' | 'strategy'>('strategy');

    // Group related orders into strategies
    const groupOrdersIntoStrategies = React.useCallback((orders: any[]) => {
        const strategies: any[] = [];
        const usedOrderIds = new Set<string>();

        // Group sandwich orders (pairs created together)
        const sandwichOrders = orders.filter(o => o.orderType === 'sandwich' && !usedOrderIds.has(o.uuid));
        const sandwichGroups = new Map<string, any[]>();

        sandwichOrders.forEach(order => {
            // Group by creation time (within 1 minute) and token pair
            const creationTime = new Date(order.createdAt).getTime();
            const tokenPair = `${order.inputTokenMeta.contractId}-${order.outputTokenMeta.contractId}`;

            let groupKey = null;
            for (const [key, group] of sandwichGroups.entries()) {
                const [existingTime, existingPair] = key.split('|');
                if (Math.abs(creationTime - parseInt(existingTime)) < 60000 && // Within 1 minute
                    (tokenPair === existingPair || tokenPair === existingPair.split('-').reverse().join('-'))) {
                    groupKey = key;
                    break;
                }
            }

            if (!groupKey) {
                groupKey = `${creationTime}|${tokenPair}`;
                sandwichGroups.set(groupKey, []);
            }

            sandwichGroups.get(groupKey)!.push(order);
            usedOrderIds.add(order.uuid);
        });

        // Create sandwich strategy objects
        sandwichGroups.forEach((orders, key) => {
            if (orders.length >= 2) {
                // Find buy and sell orders
                const buyOrder = orders.find(o => o.direction === 'lt'); // Buy low (B→A)
                const sellOrder = orders.find(o => o.direction === 'gt'); // Sell high (A→B)

                strategies.push({
                    type: 'sandwich',
                    id: `sandwich-${key}`,
                    orders: orders,
                    buyOrder,
                    sellOrder,
                    createdAt: orders[0].createdAt,
                    status: orders.every(o => o.status === 'filled') ? 'completed' :
                        orders.some(o => o.status === 'filled') ? 'partial' : 'pending',
                    tokenA: orders[0].inputTokenMeta,
                    tokenB: orders[0].outputTokenMeta,
                    totalInvested: orders.reduce((sum, o) => sum + parseFloat(o.amountIn || '0') / (10 ** (o.inputTokenMeta.decimals || 6)), 0),
                    filledOrders: orders.filter(o => o.status === 'filled').length,
                    totalOrders: orders.length
                });
            }
        });

        // Group DCA orders (same token pair, similar amounts, created around same time)
        const dcaOrders = orders.filter(o => o.orderType === 'dca' && !usedOrderIds.has(o.uuid));
        const dcaGroups = new Map<string, any[]>();

        dcaOrders.forEach(order => {
            const creationTime = new Date(order.createdAt).getTime();
            const tokenPair = `${order.inputTokenMeta.contractId}-${order.outputTokenMeta.contractId}`;
            const amount = parseFloat(order.amountIn || '0');

            let groupKey = null;
            for (const [key, group] of dcaGroups.entries()) {
                const [existingTime, existingPair, existingAmount] = key.split('|');
                if (Math.abs(creationTime - parseInt(existingTime)) < 300000 && // Within 5 minutes
                    tokenPair === existingPair &&
                    Math.abs(amount - parseFloat(existingAmount)) < (amount * 0.1)) { // Within 10% amount difference
                    groupKey = key;
                    break;
                }
            }

            if (!groupKey) {
                groupKey = `${creationTime}|${tokenPair}|${amount}`;
                dcaGroups.set(groupKey, []);
            }

            dcaGroups.get(groupKey)!.push(order);
            usedOrderIds.add(order.uuid);
        });

        // Create DCA strategy objects
        dcaGroups.forEach((orders, key) => {
            if (orders.length >= 2) { // Only group if there are multiple orders
                strategies.push({
                    type: 'dca',
                    id: `dca-${key}`,
                    orders: orders.sort((a, b) => new Date(a.validFrom || a.createdAt).getTime() - new Date(b.validFrom || b.createdAt).getTime()),
                    createdAt: orders[0].createdAt,
                    status: orders.every(o => o.status === 'filled') ? 'completed' :
                        orders.some(o => o.status === 'filled') ? 'active' : 'pending',
                    tokenFrom: orders[0].inputTokenMeta,
                    tokenTo: orders[0].outputTokenMeta,
                    totalInvested: orders.filter(o => o.status === 'filled').reduce((sum, o) => sum + parseFloat(o.amountIn || '0') / (10 ** (o.inputTokenMeta.decimals || 6)), 0),
                    totalPlanned: orders.reduce((sum, o) => sum + parseFloat(o.amountIn || '0') / (10 ** (o.inputTokenMeta.decimals || 6)), 0),
                    filledOrders: orders.filter(o => o.status === 'filled').length,
                    totalOrders: orders.length,
                    nextExecution: orders.find(o => o.status === 'open')?.validFrom || null
                });
            } else {
                // Single DCA orders go back to individual list
                orders.forEach(order => usedOrderIds.delete(order.uuid));
            }
        });

        // Add remaining individual orders (single, perpetual, ungrouped DCA/sandwich)
        const individualOrders = orders.filter(o => !usedOrderIds.has(o.uuid));

        return { strategies, individualOrders };
    }, []);

    // Convert API positions to display format for compatibility
    const perpetualOrders = React.useMemo(() => {
        if (!isPerpetualMode && orderTypeFilter !== 'perpetual' && orderTypeFilter !== 'all') {
            return [];
        }

        // Always include perpetual orders regardless of current mode
        const converted = apiPerpetualPositions.map(position => {
            // Look up the actual token metadata by contract ID in both mainnet and subnet tokens
            const allTokens = [...displayTokens, ...subnetDisplayTokens];
            const baseTokenMeta = allTokens.find((t: TokenCacheData) => t.contractId === position.baseToken) ||
                { symbol: 'BASE', contractId: position.baseToken, decimals: 6 };
            const quoteTokenMeta = allTokens.find((t: TokenCacheData) => t.contractId === position.baseAsset) ||
                { symbol: 'QUOTE', contractId: position.baseAsset, decimals: 6 };

            // Debug: Log detailed token mapping for each position
            console.log(`🔍 Token mapping for position ${position.uuid.substring(0, 8)}:`, {
                tradingPair: position.tradingPair,
                direction: position.direction,
                rawData: {
                    baseToken: position.baseToken, // Base asset being traded (STX, etc.)
                    baseAsset: position.baseAsset, // Quote token (USDT, etc.)
                },
                searchedTokens: {
                    mainnetTokens: displayTokens.length,
                    subnetTokens: subnetDisplayTokens.length,
                    totalSearched: allTokens.length
                },
                foundTokens: {
                    baseTokenMeta: {
                        symbol: baseTokenMeta.symbol,
                        contractId: baseTokenMeta.contractId,
                        found: !!allTokens.find(t => t.contractId === position.baseToken)
                    },
                    quoteTokenMeta: {
                        symbol: quoteTokenMeta.symbol,
                        contractId: quoteTokenMeta.contractId,
                        found: !!allTokens.find(t => t.contractId === position.baseAsset)
                    }
                },
                willDisplay: {
                    inputTokenMeta: baseTokenMeta.symbol,
                    outputTokenMeta: quoteTokenMeta.symbol,
                }
            });

            return {
                uuid: position.uuid,
                owner: position.owner,
                inputToken: position.baseToken,
                outputToken: position.baseAsset,
                amountIn: Math.floor(parseFloat(position.positionSize) * 1_000_000).toString(), // Convert to micro units
                targetPrice: position.triggerPrice,
                direction: 'gt' as const,
                conditionToken: position.baseToken,
                baseAsset: position.baseAsset,
                status: position.status, // Use actual API status: 'pending', 'open', 'closed'
                createdAt: position.createdAt,
                recipient: position.owner,
                validFrom: null,
                validTo: null,
                txid: null,
                signature: position.signature,
                // Use the properly looked up token metadata
                inputTokenMeta: baseTokenMeta,
                outputTokenMeta: quoteTokenMeta,
                conditionTokenMeta: baseTokenMeta,
                baseAssetMeta: quoteTokenMeta,
                // Add perpetual-specific metadata
                orderType: 'perpetual',
                perpetualDirection: position.direction,
                perpetualLeverage: position.leverage.toString(),
                perpetualPositionSize: position.positionSize,
                perpetualStopLoss: position.stopLoss || '',
                perpetualTakeProfit: position.takeProfit || '',
                perpetualMarginRequired: position.marginRequired,
                perpetualLiquidationPrice: position.liquidationPrice,
            };
        });

        console.log('✅ Converted perpetual orders:', converted);

        // Debug: Show detailed status info for all positions
        console.log('🔍 Detailed perpetual position statuses:',
            apiPerpetualPositions.map(pos => ({
                uuid: pos.uuid.substring(0, 8),
                status: pos.status,
                triggerPrice: pos.triggerPrice,
                direction: pos.direction,
                leverage: pos.leverage,
                positionSize: pos.positionSize,
                createdAt: pos.createdAt,
                rawPosition: pos // Full raw data
            }))
        );

        return converted;
    }, [apiPerpetualPositions, displayTokens, subnetDisplayTokens]);

    // Get the appropriate orders list based on smart filtering
    const ordersToShow = React.useMemo(() => {
        console.log('🔍 Filtering orders:', {
            displayOrdersCount: displayOrders.length,
            perpetualOrdersCount: perpetualOrders.length,
            showAllOrders,
            orderTypeFilter
        });

        // Filter by status first, but be smart about perpetual filter
        const activeRegularOrders = showAllOrders ? displayOrders : displayOrders.filter(order => order.status === 'open');

        // For perpetual orders: if specifically filtering for perpetuals, show ALL statuses
        // Otherwise, follow the showAllOrders setting
        const activePerpOrders = (orderTypeFilter === 'perpetual' || showAllOrders)
            ? perpetualOrders
            : perpetualOrders.filter(order => order.status === 'open');

        // Debug status breakdown
        const perpStatusBreakdown = perpetualOrders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('📊 Filtered by status:', {
            showAllOrders,
            orderTypeFilter,
            activeRegularOrdersCount: activeRegularOrders.length,
            activePerpOrdersCount: activePerpOrders.length,
            totalPerpetualOrders: perpetualOrders.length,
            perpStatusBreakdown,
            recentPerpPositions: perpetualOrders.slice(0, 3).map(p => ({
                uuid: p.uuid.substring(0, 8),
                status: p.status,
                createdAt: p.createdAt
            }))
        });

        // Apply order type filter
        let filteredOrders: any[] = [];

        switch (orderTypeFilter) {
            case 'regular':
                filteredOrders = activeRegularOrders;
                break;
            case 'perpetual':
                filteredOrders = activePerpOrders; // Now includes ALL perpetual orders
                break;
            case 'all':
            default:
                filteredOrders = [...activeRegularOrders, ...activePerpOrders];
                break;
        }

        console.log('🎯 Final filtered orders:', {
            count: filteredOrders.length,
            orders: filteredOrders
        });

        // Sort by creation date (newest first)
        const sorted = filteredOrders.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Debug: Show which orders are perpetual vs regular
        const perpetualInList = sorted.filter(o => (o as any).orderType === 'perpetual');
        const regularInList = sorted.filter(o => (o as any).orderType !== 'perpetual');

        console.log('✅ Final sorted orders to display:', {
            total: sorted.length,
            perpetual: perpetualInList.length,
            regular: regularInList.length,
            perpetualOrders: perpetualInList.map(p => ({
                uuid: p.uuid.substring(0, 8),
                status: p.status,
                direction: (p as any).perpetualDirection,
                leverage: (p as any).perpetualLeverage,
                size: (p as any).perpetualPositionSize
            }))
        });

        return sorted;
    }, [displayOrders, perpetualOrders, showAllOrders, orderTypeFilter]);

    // Apply strategy grouping based on view mode
    const { strategies, individualOrders } = React.useMemo(() => {
        if (viewMode === 'individual') {
            return { strategies: [], individualOrders: ordersToShow };
        }
        return groupOrdersIntoStrategies(ordersToShow);
    }, [ordersToShow, viewMode, groupOrdersIntoStrategies]);

    // Hook to calculate total P&L for all open perpetual positions
    const useTotalPerpetualPnL = () => {
        const [totalPnL, setTotalPnL] = React.useState(0);
        const [isCalculating, setIsCalculating] = React.useState(false);

        React.useEffect(() => {
            const calculateTotal = async () => {
                if (!perpetualOrders.length) {
                    setTotalPnL(0);
                    return;
                }

                setIsCalculating(true);
                let total = 0;

                try {
                    // Fetch P&L for each open position
                    const pnlPromises = perpetualOrders
                        .filter(order => order.status === 'open') // Only open positions
                        .map(async (order) => {
                            try {
                                const response = await fetch(`/api/v1/perps/${order.uuid}/pnl`);
                                if (response.ok) {
                                    const data = await response.json();
                                    return data.pnl || 0;
                                }
                                return 0;
                            } catch {
                                return 0;
                            }
                        });

                    const pnlValues = await Promise.all(pnlPromises);
                    total = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
                } catch (error) {
                    console.error('Error calculating total P&L:', error);
                    total = 0;
                }

                setTotalPnL(total);
                setIsCalculating(false);
            };

            calculateTotal();

            // Update every 60 seconds to align with oracle updates
            const interval = setInterval(calculateTotal, 60000);
            return () => clearInterval(interval);
        }, [perpetualOrders]);

        return { totalPnL, isCalculating };
    };

    const { totalPnL, isCalculating } = useTotalPerpetualPnL();

    // Component to display API-based P&L for a specific position
    const PositionPnLDisplay = React.memo(function PositionPnLDisplay({ positionUuid, isCompact = true, fundingOnly = false, showTooltip = false, positionSize }: { positionUuid: string; isCompact?: boolean; fundingOnly?: boolean; showTooltip?: boolean; positionSize?: string }) {
        const { pnlData, isLoading, error } = usePositionPnL(positionUuid);

        // Error state
        if (error) {
            return (
                <div className="text-xs text-red-500">
                    Error
                </div>
            );
        }

        // No data state
        if (!pnlData && !isLoading) {
            return (
                <div className="text-xs text-yellow-600">
                    No data
                </div>
            );
        }

        // Loading state - show skeleton or previous data with loading indicator
        if (!pnlData && isLoading) {
            return (
                <div className="text-xs text-muted-foreground flex items-center">
                    <div className="animate-pulse">
                        {isCompact ? (
                            <div className="space-y-1">
                                <div className="h-2 w-12 bg-muted-foreground/20 rounded"></div>
                                <div className="h-2 w-8 bg-muted-foreground/20 rounded"></div>
                            </div>
                        ) : (
                            <div className="h-3 w-16 bg-muted-foreground/20 rounded"></div>
                        )}
                    </div>
                </div>
            );
        }

        // Guard clause - should not happen, but needed for TypeScript
        if (!pnlData) {
            return (
                <div className="text-xs text-muted-foreground">
                    --
                </div>
            );
        }

        const getStatusColor = () => {
            if (pnlData.status === 'pending') return 'text-yellow-600';
            if (pnlData.status === 'closed') return 'text-gray-400';
            return pnlData.pnl >= 0 ? 'text-green-600' : 'text-red-600';
        };

        // Handle funding-only display
        if (fundingOnly) {
            const fundingFees = pnlData.fundingFees || 0;
            return (
                <span className="font-mono font-medium text-xs text-red-500">
                    {fundingFees > 0.01 ? `-$${fundingFees.toFixed(2)}` : '$0.00'}
                </span>
            );
        }

        const pnlValue = pnlData.pnl || 0;
        const pnlPercentage = pnlData.pnlPercentage || 0;
        const fundingFees = pnlData.fundingFees || 0;
        const currentPrice = pnlData.currentPrice;

        // Create tooltip content with detailed breakdown
        const tooltipContent = (
            <div className="space-y-2 min-w-48">
                <div className="border-b border-border/30 pb-2 mb-2">
                    <div className="text-xs font-medium text-muted-foreground">Position Details</div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Position Size:</span>
                        <span className="text-xs font-mono font-medium text-foreground">
                            {formatUsd(parseFloat(positionSize || '0'))}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Unrealized P&L:</span>
                        <span className={`text-xs font-mono font-medium ${pnlValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pnlValue >= 0 ? '+' : ''}{formatUsd(pnlValue)}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Percentage:</span>
                        <span className={`text-xs font-mono font-medium ${pnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                        </span>
                    </div>

                    {fundingFees > 0.01 && (
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Funding Fees:</span>
                            <span className="text-xs font-mono font-medium text-red-400">
                                -${fundingFees.toFixed(2)}
                            </span>
                        </div>
                    )}

                    {currentPrice && (
                        <div className="flex justify-between items-center pt-1 border-t border-border/20">
                            <span className="text-xs text-muted-foreground">Current Price:</span>
                            <span className="text-xs font-mono font-medium text-foreground">
                                {formatUsd(currentPrice)}
                            </span>
                        </div>
                    )}
                </div>

                {pnlData.status === 'pending' && (
                    <div className="text-xs text-yellow-400 mt-2 pt-2 border-t border-border/20">
                        Awaiting trigger execution
                    </div>
                )}
            </div>
        );

        // Main content without tooltip wrapper
        const pnlContent = (
            <div className={`text-xs font-medium ${getStatusColor()} flex items-center space-x-1 ${showTooltip ? 'cursor-help' : ''}`}>
                <div className="flex items-center space-x-1">
                    <span className="font-mono">
                        {pnlValue >= 0 ? '+' : ''}{formatUsd(pnlValue)}
                    </span>
                    {showTooltip && <Info className="w-3 h-3 opacity-60" />}
                </div>
                {isLoading && (
                    <div className="w-1 h-1 bg-current rounded-full opacity-50 animate-pulse"></div>
                )}
            </div>
        );

        // Only wrap with tooltip if showTooltip is true
        if (showTooltip) {
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {pnlContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-background/95 backdrop-blur-sm z-[10000]">
                            {tooltipContent}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        return pnlContent;
    });

    const formatDynamicAmount = (amount: string | number, decimals: number) => {
        const rawAmount = Number(amount);
        if (isNaN(rawAmount) || rawAmount === 0) return '0';

        const num = rawAmount / (10 ** (decimals || 6));
        const absNum = Math.abs(num);

        if (absNum >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (absNum >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        } else if (absNum >= 1) {
            return num.toFixed(3);
        } else if (absNum >= 0.0001) {
            return num.toFixed(6);
        } else if (absNum > 0) {
            return num.toExponential(2);
        } else {
            return '0';
        }
    };

    const renderOrderItem = (order: any) => {
        const isPerpetual = (order as any).orderType === 'perpetual';
        const orderType = (order as any).orderType || 'single';

        const getStatusStyling = () => {
            if (isPerpetual) {
                // Perpetual positions use purple base with status indicators
                switch (order.status) {
                    case 'pending':
                        return 'border-yellow-500/40 bg-gradient-to-r from-yellow-950/10 to-purple-950/5';
                    case 'open':
                        return 'border-purple-400/60 bg-gradient-to-r from-purple-900/20 to-purple-950/10';
                    case 'closed':
                        return 'border-gray-500/40 bg-gradient-to-r from-gray-950/10 to-gray-900/5';
                    default:
                        return 'border-purple-500/40 bg-gradient-to-r from-purple-950/10 to-purple-900/5';
                }
            } else {
                // Enhanced styling for different order types
                const baseGradient = orderType === 'dca' ? 'from-cyan-950/10 to-blue-950/5' :
                    orderType === 'sandwich' ? 'from-orange-950/10 to-red-950/5' :
                        'from-blue-950/10 to-indigo-950/5'; // single

                switch (order.status) {
                    case 'open':
                        return `border-blue-500/40 bg-gradient-to-r ${baseGradient}`;
                    case 'filled':
                        return `border-green-500/40 bg-gradient-to-r from-green-950/10 to-emerald-950/5`;
                    case 'cancelled':
                        return `border-gray-500/40 bg-gradient-to-r from-gray-950/10 to-gray-900/5`;
                    default:
                        return `border-border/40 bg-gradient-to-r ${baseGradient}`;
                }
            }
        };

        const getOrderTypeIndicator = () => {
            switch (orderType) {
                case 'perpetual':
                    return { color: 'text-purple-400', label: 'PERP' };
                case 'dca':
                    return { color: 'text-cyan-400', label: 'DCA' };
                case 'sandwich':
                    return { color: 'text-orange-400', label: 'SAND' };
                default:
                    return { color: 'text-blue-400', label: 'LIMIT' };
            }
        };

        const typeInfo = getOrderTypeIndicator();

        // Check if this order was recently updated
        const isRecentlyUpdated = recentlyUpdatedOrders.has(order.uuid);

        return (
            <div
                key={order.uuid}
                className={`border rounded-lg p-3 hover:bg-muted/20 transition-colors cursor-pointer relative overflow-hidden ${getStatusStyling()} ${isPerpetual ? 'border-l-4 border-l-purple-500/60' : ''
                    } ${isRecentlyUpdated ? 'ring-2 ring-green-400/60 bg-green-950/20 border-green-400/40 animate-pulse' : ''}`}
                onClick={() => toggleOrderExpansion(order.uuid)}
            >
                {/* Recently Updated Indicator */}
                {isRecentlyUpdated && (
                    <>
                        <div className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full animate-ping" />
                        <div className="absolute top-1 right-1 w-3 h-3 bg-green-400 rounded-full" />
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-400 animate-pulse" />
                    </>
                )}
                {/* Compact view - enhanced unified structure */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 flex-1">
                        {/* Order type indicator */}
                        <div className={`flex items-center ${typeInfo.color}`}>
                            <span className={`font-medium text-[10px] px-1.5 py-0.5 rounded ${isPerpetual
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                : 'bg-current/10 text-current'
                                }`}>
                                {typeInfo.label}
                            </span>
                        </div>

                        {/* Direction for perpetual */}
                        {isPerpetual && (
                            <div className={`flex items-center ${order.perpetualDirection === 'long' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {order.perpetualDirection === 'long' ? (
                                    <TrendingUp className="w-3 h-3" />
                                ) : (
                                    <TrendingDown className="w-3 h-3" />
                                )}
                            </div>
                        )}

                        {/* Amount - enhanced display */}
                        {!isPerpetual && (
                            <span className="font-mono text-xs font-medium">
                                {formatDynamicAmount(order.amountIn || '0', order.inputTokenMeta.decimals || 6)}
                            </span>
                        )}

                        {/* Leverage indicator for perpetual */}
                        {isPerpetual && (
                            <span className="text-[10px] bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium border border-yellow-500/30">
                                {order.perpetualLeverage}x
                            </span>
                        )}

                        {/* P&L for perpetual positions */}
                        {isPerpetual && (
                            <PositionPnLDisplay
                                positionUuid={order.uuid}
                                isCompact={true}
                                showTooltip={true}
                                positionSize={order.perpetualPositionSize}
                            />
                        )}

                        {/* Token images - enhanced overlaid style */}
                        <div className="relative flex items-center">
                            {/* Base token (front, left) */}
                            <div className="relative">
                                <TokenLogo
                                    token={{ ...order.inputTokenMeta, image: order.inputTokenMeta.image ?? undefined }}
                                    size="sm"
                                />
                            </div>
                            {/* Quote token (behind, right) with better overlap */}
                            <div className="relative -ml-2 z-0 ring-1 ring-background rounded-full">
                                <TokenLogo
                                    token={{ ...order.outputTokenMeta, image: order.outputTokenMeta.image ?? undefined }}
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* Status indicator */}
                        {isPerpetual && order.status === 'pending' ? (
                            // Pending perpetual orders get a special tooltip explaining trigger logic
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-background/95 backdrop-blur-sm z-[10000] max-w-64">
                                        <div className="space-y-2">
                                            <div className="text-xs font-medium text-foreground">Trigger Logic</div>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                <div>
                                                    <span className="text-yellow-400 font-medium">Entry Price:</span> {formatUsd(parseFloat(order.targetPrice || '0'))}
                                                </div>
                                                <div>
                                                    <span className="text-purple-300 font-medium">Direction:</span> {order.perpetualDirection.toUpperCase()}
                                                </div>
                                                <div className="pt-1 border-t border-border/30">
                                                    {order.perpetualDirection === 'long' ? (
                                                        <span>Will trigger when price <span className="text-green-400 font-medium">≥</span> entry price</span>
                                                    ) : (
                                                        <span>Will trigger when price <span className="text-red-400 font-medium">≤</span> entry price</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground/70 pt-1">
                                                    Position opens automatically when condition is met
                                                </div>
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : (
                            // Regular status indicator for non-pending or non-perpetual orders
                            <div className={`w-2 h-2 rounded-full ${order.status === 'pending' ? 'bg-yellow-400 animate-pulse' :
                                order.status === 'open' ? 'bg-green-400' :
                                    order.status === 'filled' ? 'bg-emerald-400' : 'bg-gray-400'
                                }`} />
                        )}

                        {/* Timestamp */}
                        <span className="text-xs text-muted-foreground ml-auto">
                            {formatRelativeTime(order.createdAt)}
                        </span>
                    </div>

                    {/* Expand indicator */}
                    <div className="flex items-center ml-2">
                        {expandedOrderId === order.uuid ?
                            <ChevronDown className="w-4 h-4 text-muted-foreground" /> :
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                    </div>
                </div>

                {/* Expanded view - show all details */}
                {expandedOrderId === order.uuid && (
                    <div className="mt-3 pt-3 border-t border-border/20 text-xs">
                        {isPerpetual ? (
                            // Perpetual-specific expanded view - Compact grid layout
                            <>
                                {/* Primary Info - 3x2 Grid */}
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">SIZE</span>
                                        <div className="font-mono font-medium text-xs">
                                            {formatUsd(parseFloat(order.perpetualPositionSize || '0'))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">ENTRY</span>
                                        <div className="font-mono font-medium text-xs">
                                            {formatUsd(parseFloat(order.targetPrice || '0'))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">P&L</span>
                                        <PositionPnLDisplay
                                            positionUuid={order.uuid}
                                            isCompact={false}
                                            positionSize={order.perpetualPositionSize}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">LIQUIDATION</span>
                                        <div className="font-mono font-medium text-xs text-red-600">
                                            {formatUsd(parseFloat(order.perpetualLiquidationPrice || '0'))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">MARGIN</span>
                                        <div className="font-mono font-medium text-xs">
                                            {formatUsd(parseFloat(order.perpetualMarginRequired || '0'))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">FUNDING</span>
                                        <div className="font-mono font-medium text-xs text-red-500">
                                            <PositionPnLDisplay
                                                positionUuid={order.uuid}
                                                isCompact={false}
                                                fundingOnly={true}
                                                positionSize={order.perpetualPositionSize}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Funding Period Information */}
                                <div className="mt-3 pt-3 border-t border-border/30">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground text-[10px]">FUNDING PERIOD</span>
                                            <div className="text-xs text-purple-400">Every 8 hours</div>
                                        </div>

                                        {(() => {
                                            // Calculate next funding time (every 8 hours from midnight UTC)
                                            const now = new Date();
                                            const currentUTC = new Date(now.getTime());
                                            const hoursSinceMidnight = currentUTC.getUTCHours() + (currentUTC.getUTCMinutes() / 60);

                                            // Find next 8-hour mark (0, 8, 16, 24)
                                            const fundingHours = [0, 8, 16, 24];
                                            const nextFundingHour = fundingHours.find(h => h > hoursSinceMidnight) || 24;

                                            const nextFunding = new Date(currentUTC);
                                            if (nextFundingHour === 24) {
                                                nextFunding.setUTCDate(nextFunding.getUTCDate() + 1);
                                                nextFunding.setUTCHours(0, 0, 0, 0);
                                            } else {
                                                nextFunding.setUTCHours(nextFundingHour, 0, 0, 0);
                                            }

                                            const timeUntilFunding = nextFunding.getTime() - currentUTC.getTime();
                                            const hoursUntil = Math.floor(timeUntilFunding / (1000 * 60 * 60));
                                            const minutesUntil = Math.floor((timeUntilFunding % (1000 * 60 * 60)) / (1000 * 60));

                                            // Progress through current 8-hour period
                                            const periodStart = Math.floor(hoursSinceMidnight / 8) * 8;
                                            const progressPercent = ((hoursSinceMidnight - periodStart) / 8) * 100;

                                            return (
                                                <>
                                                    <div className="flex items-center justify-between text-[11px]">
                                                        <span>Next funding:</span>
                                                        <span className="font-mono text-yellow-400">
                                                            {hoursUntil}h {minutesUntil}m
                                                        </span>
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div className="w-full bg-border/30 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-purple-500 to-yellow-500 h-full transition-all duration-1000 ease-out"
                                                            style={{ width: `${progressPercent}%` }}
                                                        />
                                                    </div>

                                                    <div className="text-[9px] text-muted-foreground leading-tight">
                                                        Funding fees charged every 8hrs (00:00, 08:00, 16:00 UTC)<br />
                                                        Rate: 0.01% of position size per period
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* Risk Management - Only if set */}
                                {(order.perpetualStopLoss || order.perpetualTakeProfit) && (
                                    <div className="mt-2 pt-2 border-t border-border/30">
                                        <div className="grid grid-cols-2 gap-x-3 text-xs">
                                            {order.perpetualStopLoss && (
                                                <div>
                                                    <span className="text-red-600 text-[10px]">STOP</span>
                                                    <div className="font-mono text-xs text-red-600">
                                                        {formatUsd(parseFloat(order.perpetualStopLoss))}
                                                    </div>
                                                </div>
                                            )}
                                            {order.perpetualTakeProfit && (
                                                <div>
                                                    <span className="text-green-600 text-[10px]">PROFIT</span>
                                                    <div className="font-mono text-xs text-green-600">
                                                        {formatUsd(parseFloat(order.perpetualTakeProfit))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Enhanced regular order expanded view
                            <>
                                {/* Primary Order Info - Grid Layout */}
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">TYPE</span>
                                        <div className="flex items-center">
                                            <span className={`font-medium text-xs ${typeInfo.color}`}>
                                                {typeInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground text-[10px]">AMOUNT</span>
                                        <div className="font-mono font-medium text-xs">
                                            {formatCompactNumber(order.amountIn, order.inputTokenMeta.decimals)} {order.inputTokenMeta.symbol}
                                        </div>
                                    </div>

                                    {/* Conditional fields based on order type */}
                                    {orderType === 'single' && (
                                        <>
                                            <div className="col-span-2">
                                                <span className="text-muted-foreground text-[10px]">TRIGGER</span>
                                                <div className="font-mono font-medium text-xs flex items-center space-x-1">
                                                    <span>1 {order.conditionTokenMeta?.symbol || 'USD'}</span>
                                                    <span className="text-green-400">≥</span>
                                                    <span>{formatCompactPrice(order.targetPrice)}</span>
                                                    <span>{order.baseAssetMeta.symbol}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {orderType === 'dca' && (
                                        <>
                                            <div>
                                                <span className="text-muted-foreground text-[10px]">FREQUENCY</span>
                                                <div className="font-medium text-xs text-cyan-400">
                                                    {(order as any).dcaFrequency || 'Daily'}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-[10px]">REMAINING</span>
                                                <div className="font-mono font-medium text-xs">
                                                    {(order as any).dcaRemaining || 0} / {(order as any).dcaTotal || 0}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {orderType === 'sandwich' && (
                                        <>
                                            <div>
                                                <span className="text-muted-foreground text-[10px]">BUY TRIGGER</span>
                                                <div className="font-mono font-medium text-xs text-blue-400">
                                                    ≥ {formatCompactPrice(order.sandwichBuyPrice || '0')}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground text-[10px]">SELL TRIGGER</span>
                                                <div className="font-mono font-medium text-xs text-orange-400">
                                                    ≤ {formatCompactPrice(order.sandwichSellPrice || '0')}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Token Pair Display */}
                                <div className="mt-3 pt-3 border-t border-border/30">
                                    <div className="flex items-center justify-center space-x-3">
                                        <div className="flex items-center space-x-2">
                                            <TokenLogo
                                                token={{ ...order.inputTokenMeta, image: order.inputTokenMeta.image ?? undefined }}
                                                size="md"
                                            />
                                            <div>
                                                <div className="font-medium text-xs">{order.inputTokenMeta.symbol}</div>
                                                <div className="text-[10px] text-muted-foreground">Input</div>
                                            </div>
                                        </div>
                                        <div className="text-muted-foreground">→</div>
                                        <div className="flex items-center space-x-2">
                                            <TokenLogo
                                                token={{ ...order.outputTokenMeta, image: order.outputTokenMeta.image ?? undefined }}
                                                size="md"
                                            />
                                            <div>
                                                <div className="font-medium text-xs">{order.outputTokenMeta.symbol}</div>
                                                <div className="text-[10px] text-muted-foreground">Output</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Common fields for both types */}
                        <div className="mt-3 pt-2 border-t border-border/20 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <span className={`font-medium text-xs ${order.status === 'pending' ? 'text-yellow-400' :
                                    order.status === 'open' ? 'text-green-400' : 'text-gray-400'
                                    }`}>
                                    {order.status === 'pending' ? 'Pending' :
                                        order.status === 'open' ? 'Open' : 'Closed'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Order ID:</span>
                                <span className="font-mono text-xs break-all">{order.uuid}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Created:</span>
                                <span className="font-mono text-xs">
                                    {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString()}
                                </span>
                            </div>
                            {!isPerpetual && (
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Expires:</span>
                                    <span className="font-mono text-xs">
                                        {order.validTo ? new Date(order.validTo).toLocaleDateString() : 'Never'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Action buttons in expanded view */}
                        <div className="flex items-center justify-end space-x-2 pt-3 mt-2 border-t border-border/20">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isPerpetual ? cancelingApiPositions.has(order.uuid) : cancelingOrders.has(order.uuid)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    confirmCancelOrder(order.uuid);
                                }}
                                className={`h-8 px-3 text-xs disabled:opacity-50 ${isPerpetual
                                    ? 'text-orange-500 hover:text-orange-400'
                                    : 'text-destructive hover:text-destructive'
                                    }`}
                            >
                                {(isPerpetual ? cancelingApiPositions.has(order.uuid) : cancelingOrders.has(order.uuid)) ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        {isPerpetual ? 'Closing...' : 'Canceling...'}
                                    </>
                                ) : (
                                    <>
                                        {isPerpetual ? (
                                            <LogOut className="w-4 h-4 mr-1" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 mr-1" />
                                        )}
                                        {isPerpetual ? 'Close Position' : 'Cancel'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Cancel/Close confirmation dialog */}
                {confirmCancelOrderId && (() => {
                    const orderToCancel = ordersToShow.find(o => o.uuid === confirmCancelOrderId);
                    const isOrderPerpetual = orderToCancel && (orderToCancel as any).orderType === 'perpetual';

                    return (
                        <Dialog open onOpenChange={(open) => { if (!open) setConfirmCancelOrderId(null); }}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {isOrderPerpetual ? 'Close Position' : 'Cancel Order'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        {isOrderPerpetual
                                            ? 'Are you sure you want to close this position? This action cannot be undone.'
                                            : 'Are you sure you want to cancel this order? This action cannot be undone.'
                                        }
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="flex justify-end gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setConfirmCancelOrderId(null)}
                                        disabled={isOrderPerpetual ? cancelingApiPositions.has(confirmCancelOrderId) : cancelingOrders.has(confirmCancelOrderId)}
                                    >
                                        {isOrderPerpetual ? 'Keep Position' : 'Keep Order'}
                                    </Button>
                                    <Button
                                        variant={isOrderPerpetual ? "default" : "destructive"}
                                        onClick={async () => {
                                            if (isOrderPerpetual) {
                                                try {
                                                    await cancelApiPosition(confirmCancelOrderId);
                                                    toast.success('Position closed successfully!');
                                                    // Refresh the positions list to reflect the change
                                                    await refetchPositions();
                                                } catch (error) {
                                                    toast.error('Failed to close position: ' + (error instanceof Error ? error.message : 'Unknown error'));
                                                }
                                                setConfirmCancelOrderId(null);
                                            } else {
                                                cancelOrderAction(confirmCancelOrderId);
                                            }
                                        }}
                                        disabled={isOrderPerpetual ? cancelingApiPositions.has(confirmCancelOrderId) : cancelingOrders.has(confirmCancelOrderId)}
                                        className={isOrderPerpetual ? "bg-orange-500 hover:bg-orange-600" : ""}
                                    >
                                        {(isOrderPerpetual ? cancelingApiPositions.has(confirmCancelOrderId) : cancelingOrders.has(confirmCancelOrderId)) ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                {isOrderPerpetual ? 'Closing...' : 'Canceling...'}
                                            </>
                                        ) : (
                                            <>
                                                {isOrderPerpetual ? (
                                                    <LogOut className="w-4 h-4 mr-2" />
                                                ) : null}
                                                {isOrderPerpetual ? 'Close Position' : 'Cancel Order'}
                                            </>
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    );
                })()}
            </div>
        );
    };

    // Render DCA strategy
    const renderDCAStrategy = (strategy: any) => {
        const progressPercent = strategy.totalOrders > 0 ? (strategy.filledOrders / strategy.totalOrders) * 100 : 0;
        const avgPrice = strategy.filledOrders > 0 ?
            strategy.orders.filter((o: any) => o.status === 'filled')
                .reduce((sum: number, o: any) => sum + parseFloat(o.targetPrice || '0'), 0) / strategy.filledOrders : 0;

        return (
            <div
                key={strategy.id}
                className="border rounded-lg p-3 hover:bg-muted/20 transition-colors cursor-pointer bg-gradient-to-r from-cyan-950/10 to-blue-950/5 border-cyan-500/40"
                onClick={() => toggleOrderExpansion(strategy.id)}
            >
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 flex-1">
                        {/* DCA Badge */}
                        <div className="flex items-center text-cyan-400">
                            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium text-[10px] px-1.5 py-0.5 rounded">
                                DCA
                            </span>
                        </div>

                        {/* Progress */}
                        <span className="font-mono text-xs font-medium">
                            {strategy.filledOrders}/{strategy.totalOrders}
                        </span>

                        {/* Token Pair */}
                        <div className="relative flex items-center">
                            <TokenLogo token={{ ...strategy.tokenFrom, image: strategy.tokenFrom.image ?? undefined }} size="sm" />
                            <div className="relative -ml-2 z-0 ring-1 ring-background rounded-full">
                                <TokenLogo token={{ ...strategy.tokenTo, image: strategy.tokenTo.image ?? undefined }} size="sm" />
                            </div>
                        </div>

                        {/* Status */}
                        <span className={`text-xs font-medium ${strategy.status === 'completed' ? 'text-green-400' :
                            strategy.status === 'active' ? 'text-cyan-400' : 'text-yellow-400'
                            }`}>
                            {strategy.status.toUpperCase()}
                        </span>

                        {/* Timestamp */}
                        <span className="text-xs text-muted-foreground ml-auto">
                            {formatRelativeTime(strategy.createdAt)}
                        </span>
                    </div>

                    {/* Expand indicator */}
                    <div className="flex items-center ml-2">
                        {expandedOrderId === strategy.id ?
                            <ChevronDown className="w-4 h-4 text-muted-foreground" /> :
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                    </div>
                </div>

                {/* Expanded DCA Strategy View */}
                {expandedOrderId === strategy.id && (
                    <div className="mt-3 pt-3 border-t border-border/20 text-xs">
                        {/* Strategy Summary */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mb-3">
                            <div>
                                <span className="text-muted-foreground text-[10px]">TOTAL PLANNED</span>
                                <div className="font-mono font-medium text-xs">
                                    {strategy.totalPlanned.toFixed(6)} {strategy.tokenFrom.symbol}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-[10px]">INVESTED</span>
                                <div className="font-mono font-medium text-xs">
                                    {strategy.totalInvested.toFixed(6)} {strategy.tokenFrom.symbol}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-[10px]">PROGRESS</span>
                                <div className="font-medium text-xs">
                                    {strategy.filledOrders}/{strategy.totalOrders} ({progressPercent.toFixed(1)}%)
                                </div>
                            </div>
                            {avgPrice > 0 && (
                                <div>
                                    <span className="text-muted-foreground text-[10px]">AVG PRICE</span>
                                    <div className="font-mono font-medium text-xs">
                                        {avgPrice.toFixed(6)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                            <div className="w-full bg-border/30 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Individual Orders */}
                        <div className="space-y-2">
                            <span className="text-muted-foreground text-[10px]">INDIVIDUAL ORDERS</span>
                            {strategy.orders.slice(0, 5).map((order: any, index: number) => (
                                <div key={order.uuid} className="flex items-center justify-between p-2 rounded bg-background/50">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs">#{index + 1}</span>
                                        <span className={`w-2 h-2 rounded-full ${order.status === 'filled' ? 'bg-green-400' :
                                            order.status === 'open' ? 'bg-yellow-400' : 'bg-gray-400'
                                            }`} />
                                        <span className="text-xs font-mono">
                                            {(parseFloat(order.amountIn || '0') / (10 ** (order.inputTokenMeta.decimals || 6))).toFixed(6)}
                                        </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {order.validFrom ? new Date(order.validFrom).toLocaleDateString() : 'Pending'}
                                    </span>
                                </div>
                            ))}
                            {strategy.orders.length > 5 && (
                                <div className="text-center text-xs text-muted-foreground">
                                    ... and {strategy.orders.length - 5} more orders
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Render Sandwich strategy
    const renderSandwichStrategy = (strategy: any) => {
        const buyFilled = strategy.buyOrder?.status === 'filled';
        const sellFilled = strategy.sellOrder?.status === 'filled';

        return (
            <div
                key={strategy.id}
                className="border rounded-lg p-3 hover:bg-muted/20 transition-colors cursor-pointer bg-gradient-to-r from-orange-950/10 to-red-950/5 border-orange-500/40"
                onClick={() => toggleOrderExpansion(strategy.id)}
            >
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 flex-1">
                        {/* Sandwich Badge */}
                        <div className="flex items-center text-orange-400">
                            <span className="bg-orange-500/20 text-orange-300 border border-orange-500/40 font-medium text-[10px] px-1.5 py-0.5 rounded">
                                SAND
                            </span>
                        </div>

                        {/* Status Indicators */}
                        <div className="flex items-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${buyFilled ? 'bg-green-400' : 'bg-gray-400'}`} title="Buy Order" />
                            <div className={`w-2 h-2 rounded-full ${sellFilled ? 'bg-green-400' : 'bg-gray-400'}`} title="Sell Order" />
                        </div>

                        {/* Token Pair */}
                        <div className="relative flex items-center">
                            <TokenLogo token={{ ...strategy.tokenA, image: strategy.tokenA.image ?? undefined }} size="sm" />
                            <div className="relative -ml-2 z-0 ring-1 ring-background rounded-full">
                                <TokenLogo token={{ ...strategy.tokenB, image: strategy.tokenB.image ?? undefined }} size="sm" />
                            </div>
                        </div>

                        {/* Status */}
                        <span className={`text-xs font-medium ${strategy.status === 'completed' ? 'text-green-400' :
                            strategy.status === 'partial' ? 'text-orange-400' : 'text-yellow-400'
                            }`}>
                            {strategy.status === 'completed' ? 'BOTH FILLED' :
                                strategy.status === 'partial' ? 'ONE FILLED' : 'PENDING'}
                        </span>

                        {/* Timestamp */}
                        <span className="text-xs text-muted-foreground ml-auto">
                            {formatRelativeTime(strategy.createdAt)}
                        </span>
                    </div>

                    {/* Expand indicator */}
                    <div className="flex items-center ml-2">
                        {expandedOrderId === strategy.id ?
                            <ChevronDown className="w-4 h-4 text-muted-foreground" /> :
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        }
                    </div>
                </div>

                {/* Expanded Sandwich Strategy View */}
                {expandedOrderId === strategy.id && (
                    <div className="mt-3 pt-3 border-t border-border/20 text-xs">
                        {/* Strategy Summary */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs mb-3">
                            <div>
                                <span className="text-muted-foreground text-[10px]">TOTAL INVESTED</span>
                                <div className="font-mono font-medium text-xs">
                                    {strategy.totalInvested.toFixed(6)} {strategy.tokenA.symbol}
                                </div>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-[10px]">STATUS</span>
                                <div className="font-medium text-xs">
                                    {strategy.filledOrders}/{strategy.totalOrders} Orders Filled
                                </div>
                            </div>
                        </div>

                        {/* Individual Orders */}
                        <div className="space-y-2">
                            <span className="text-muted-foreground text-[10px]">STRATEGY LEGS</span>

                            {/* Buy Order */}
                            {strategy.buyOrder && (
                                <div className="flex items-center justify-between p-2 rounded bg-background/50">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
                                            <span className="text-[8px] text-white font-bold">B</span>
                                        </div>
                                        <span className="text-xs">Buy Low</span>
                                        <span className={`w-2 h-2 rounded-full ${buyFilled ? 'bg-green-400' : 'bg-gray-400'}`} />
                                    </div>
                                    <span className="text-xs font-mono">
                                        ≤ {parseFloat(strategy.buyOrder.targetPrice || '0').toFixed(6)}
                                    </span>
                                </div>
                            )}

                            {/* Sell Order */}
                            {strategy.sellOrder && (
                                <div className="flex items-center justify-between p-2 rounded bg-background/50">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-3 h-3 rounded-full bg-orange-500 flex items-center justify-center">
                                            <span className="text-[8px] text-white font-bold">S</span>
                                        </div>
                                        <span className="text-xs">Sell High</span>
                                        <span className={`w-2 h-2 rounded-full ${sellFilled ? 'bg-green-400' : 'bg-gray-400'}`} />
                                    </div>
                                    <span className="text-xs font-mono">
                                        ≥ {parseFloat(strategy.sellOrder.targetPrice || '0').toFixed(6)}
                                    </span>
                                </div>
                            )}

                            {/* P&L if both orders filled */}
                            {strategy.status === 'completed' && (
                                <div className="mt-2 pt-2 border-t border-border/30">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground text-[10px]">STRATEGY P&L</span>
                                        <span className="text-xs font-mono text-green-400">
                                            +{((parseFloat(strategy.sellOrder?.targetPrice || '0') - parseFloat(strategy.buyOrder?.targetPrice || '0')) * strategy.totalInvested).toFixed(4)} {strategy.tokenB.symbol}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (isLoadingOrders) {
        return (
            <div className="h-full w-96 border-l border-border/40 bg-card/50 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-muted-foreground text-sm">Loading orders...</p>
                </div>
            </div>
        );
    }

    if (ordersError) {
        return (
            <div className="h-full w-96 border-l border-border/40 bg-card/50 backdrop-blur-sm flex items-center justify-center">
                <div className="text-center">
                    <p className="text-destructive text-sm mb-2">Error loading orders</p>
                    <p className="text-muted-foreground text-xs">{ordersError}</p>
                </div>
            </div>
        );
    }

    // Don't render content when collapsed to improve performance
    if (collapsed) {
        return null;
    }

    return (
        <div className="h-full flex flex-col">
            {/* Unified Orders Header */}
            <div className="p-4 border-b border-border/40 bg-gradient-to-r from-blue-950/20 to-purple-950/20">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-foreground">
                            {viewMode === 'strategy' ? 'Strategies' : 'Orders'}
                        </h2>
                        <Badge variant="outline" className="text-xs">
                            {viewMode === 'strategy' ? strategies.length + individualOrders.length : ordersToShow.length}
                        </Badge>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllOrders(!showAllOrders)}
                        className="text-xs h-6 px-2"
                    >
                        {showAllOrders ? 'Open Only' : 'Show All'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewMode(viewMode === 'strategy' ? 'individual' : 'strategy')}
                        className="text-xs h-6 px-2"
                    >
                        {viewMode === 'strategy' ? 'Individual' : 'Strategy'}
                    </Button>
                </div>

                {/* Smart Filter Controls */}
                <div className="flex items-center gap-1">
                    <Button
                        variant={orderTypeFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setOrderTypeFilter('all')}
                        className="text-xs h-7 px-2"
                    >
                        All
                    </Button>
                    <Button
                        variant={orderTypeFilter === 'regular' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setOrderTypeFilter('regular')}
                        className="text-xs h-7 px-2"
                    >
                        Regular
                    </Button>
                    <Button
                        variant={orderTypeFilter === 'perpetual' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setOrderTypeFilter('perpetual')}
                        className="text-xs h-7 px-2"
                    >
                        Perpetual
                    </Button>
                    {/* <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            console.log('🔍 Manual debug - forcing perpetual positions refetch');
                            refetchPositions();
                        }}
                        className="text-xs h-7 px-2"
                    >
                        Debug
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                            console.log('🚀 Starting perpetual monitor...');
                            try {
                                const response = await fetch('/api/cron/perps-monitor', { method: 'POST' });
                                const data = await response.json();
                                console.log('Monitor response:', data);
                                toast.success('Perpetual monitor started!');
                                // Refresh positions after a few seconds
                                setTimeout(() => refetchPositions(), 3000);
                            } catch (error) {
                                console.error('Failed to start monitor:', error);
                                toast.error('Failed to start monitor');
                            }
                        }}
                        className="text-xs h-7 px-2"
                    >
                        Monitor
                    </Button> */}
                </div>

                {/* Filter Status */}
                <div className="mt-2 text-xs text-muted-foreground">
                    {viewMode === 'strategy' ? (
                        <span>Strategy view • {strategies.length} grouped, {individualOrders.length} individual</span>
                    ) : (
                        orderTypeFilter === 'all' ? (
                            <span>Showing all order types</span>
                        ) : (
                            <span>Filtered: {orderTypeFilter === 'regular' ? 'Single, DCA, Sandwich orders' : 'Perpetual positions'}</span>
                        )
                    )}
                </div>
            </div>

            {/* Summary Stats for Perpetual Positions */}
            {perpetualOrders.filter(order => order.status === 'pending' || order.status === 'open').length > 0 && (
                <div className="p-3 border-b border-border/20 bg-gradient-to-r from-purple-900/10 to-blue-900/10">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="text-center">
                            <div className="text-muted-foreground">Total P&L</div>
                            <div className={`font-mono font-medium ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center justify-center space-x-1 cursor-help">
                                                {isCalculating && (
                                                    <div className="w-2 h-2 bg-current rounded-full opacity-50 animate-pulse"></div>
                                                )}
                                                <span>
                                                    {totalPnL >= 0 ? '+' : ''}{formatUsd(totalPnL)}
                                                </span>
                                                <Info className="w-3 h-3 opacity-60" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="bg-background/95 backdrop-blur-sm">
                                            <div className="text-xs">
                                                Open positions • Updated every 60s
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground">Positions</div>
                            <div className="font-medium flex items-center justify-center space-x-1 text-xs">
                                <span className="text-green-400">{perpetualOrders.filter(o => o.status === 'open' && (o as any).perpetualDirection === 'long').length}L</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-red-400">{perpetualOrders.filter(o => o.status === 'open' && (o as any).perpetualDirection === 'short').length}S</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-yellow-400">{perpetualOrders.filter(o => o.status === 'pending').length}P</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-muted-foreground">Margin Used</div>
                            <div className="font-mono font-medium">
                                {formatUsd(perpetualOrders
                                    .filter(order => order.status === 'pending' || order.status === 'open')
                                    .reduce((sum, order) =>
                                        sum + parseFloat((order as any).perpetualMarginRequired || '0'), 0
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unified Orders List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {viewMode === 'strategy' ? (
                    // Strategy View Mode
                    <>
                        {strategies.length === 0 && individualOrders.length === 0 ? (
                            <div className="text-center py-8">
                                <h3 className="font-medium text-foreground mb-2">No Strategies</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    Create DCA or Sandwich strategies to see them grouped here
                                </p>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>• DCA: Multiple orders over time</p>
                                    <p>• Sandwich: Buy low, sell high pairs</p>
                                    <p>• Single orders show individually</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Render Strategies */}
                                {strategies.map((strategy) => (
                                    strategy.type === 'dca' ? renderDCAStrategy(strategy) :
                                        strategy.type === 'sandwich' ? renderSandwichStrategy(strategy) : null
                                ))}

                                {/* Render Individual Orders */}
                                {individualOrders.map(renderOrderItem)}

                                {/* Summary */}
                                {strategies.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-border/20 text-center">
                                        <div className="text-xs text-muted-foreground">
                                            {strategies.length} {strategies.length === 1 ? 'strategy' : 'strategies'} • {individualOrders.length} individual {individualOrders.length === 1 ? 'order' : 'orders'}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    // Individual View Mode
                    <>
                        {ordersToShow.length === 0 ? (
                            <div className="text-center py-8">
                                <h3 className="font-medium text-foreground mb-2">No Orders</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    Create your first order to start trading
                                </p>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>• Single: Traditional limit orders</p>
                                    <p>• DCA: Dollar-cost averaging strategies</p>
                                    <p>• Sandwich: Dual trigger strategies</p>
                                    <p>• Perpetual: Leveraged positions</p>
                                </div>
                            </div>
                        ) : (
                            ordersToShow.map(renderOrderItem)
                        )}
                    </>
                )}
            </div>
        </div>
    );
}