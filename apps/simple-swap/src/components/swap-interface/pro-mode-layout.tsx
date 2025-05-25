"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { X, TrendingUp, ArrowUpDown, Eye, Edit, Trash2, Zap, Calendar, Repeat, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import TokenDropdown from '../TokenDropdown';
import TokenLogo from '../TokenLogo';
import { useSwapContext } from '../../contexts/swap-context';
import ProModeChart from './ProModeChart';
import { useWallet } from '../../contexts/wallet-context';
import type { LimitOrder } from '../../lib/orders/types';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { signedFetch } from 'blaze-sdk';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { tupleCV, stringAsciiCV, uintCV, principalCV, optionalCVOf, noneCV } from '@stacks/transactions';

// Enriched order type with token metadata
interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}

type OrderType = 'single' | 'dca' | 'sandwich';

export default function ProModeLayout() {
    const {
        selectedFromToken,
        selectedToToken,
        displayAmount,
        setDisplayAmount,
        targetPrice,
        setTargetPrice,
        conditionToken,
        setConditionToken,
        baseToken,
        setBaseToken,
        conditionDir,
        setConditionDir,
        displayTokens,
        setIsProMode,
        handleCreateLimitOrder: originalHandleCreateLimitOrder,
        isCreatingOrder,
        handleSwitchTokensEnhanced,
        fromTokenBalance,
        toTokenBalance,
        formatUsd,
        getUsdPrice,
        setSelectedFromTokenSafe,
        setSelectedToToken,
        subnetDisplayTokens,
    } = useSwapContext();

    const { address, connected } = useWallet();
    const [displayOrders, setDisplayOrders] = useState<DisplayOrder[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [ordersError, setOrdersError] = useState<string | null>(null);
    const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('single');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [showAllOrders, setShowAllOrders] = useState(false);
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

    // Trading pair state for pro mode
    const [tradingPairBase, setTradingPairBase] = useState<TokenCacheData | null>(null);
    const [tradingPairQuote, setTradingPairQuote] = useState<TokenCacheData | null>(null);

    // Token selector modal state
    const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
    const [showToTokenSelector, setShowToTokenSelector] = useState(false);

    // DCA-specific state
    const [dcaFrequency, setDcaFrequency] = useState('daily');
    const [dcaAmount, setDcaAmount] = useState('');
    const [dcaDuration, setDcaDuration] = useState('30');
    const [dcaStartDate, setDcaStartDate] = useState('');

    // Sandwich-specific state
    const [sandwichBuyPrice, setSandwichBuyPrice] = useState('');
    const [sandwichSellPrice, setSandwichSellPrice] = useState('');
    const [sandwichSpread, setSandwichSpread] = useState('5'); // Default 5% spread
    const [sandwichUsdAmount, setSandwichUsdAmount] = useState(''); // USD amount for sandwich orders

    // Loading states
    const [isCreatingSandwichOrder, setIsCreatingSandwichOrder] = useState(false);

    // Fetch real user orders
    const fetchOrders = useCallback(async () => {
        if (!connected || !address) {
            setDisplayOrders([]);
            return;
        }

        setIsLoadingOrders(true);
        setOrdersError(null);

        try {
            const res = await fetch(`/api/v1/orders?owner=${address}`);
            const j = await res.json();

            if (res.ok) {
                const rawOrders = j.data as LimitOrder[];
                console.log(`Fetched ${rawOrders.length} raw orders:`, rawOrders.map(o => ({ uuid: o.uuid.slice(0, 8), status: o.status, inputToken: o.inputToken, outputToken: o.outputToken })));
                if (rawOrders.length === 0) {
                    setDisplayOrders([]);
                    return;
                }

                // Enrich orders with token metadata
                const enrichedOrders: DisplayOrder[] = [];
                const tokenMetaCache = new Map<string, TokenCacheData>();

                for (const order of rawOrders) {
                    // Get input token metadata
                    let inputMeta = tokenMetaCache.get(order.inputToken);
                    if (!inputMeta) {
                        inputMeta = await getTokenMetadataCached(order.inputToken);
                        tokenMetaCache.set(order.inputToken, inputMeta);
                    }

                    // Get output token metadata
                    let outputMeta = tokenMetaCache.get(order.outputToken);
                    if (!outputMeta) {
                        outputMeta = await getTokenMetadataCached(order.outputToken);
                        tokenMetaCache.set(order.outputToken, outputMeta);
                    }

                    // Get condition token metadata
                    let conditionMeta = tokenMetaCache.get(order.conditionToken);
                    if (!conditionMeta) {
                        conditionMeta = await getTokenMetadataCached(order.conditionToken);
                        tokenMetaCache.set(order.conditionToken, conditionMeta);
                    }

                    // Get base asset metadata if it exists and isn't USD
                    let baseMeta: TokenCacheData | null = null;
                    if (order.baseAsset && order.baseAsset !== 'USD') {
                        baseMeta = tokenMetaCache.get(order.baseAsset) || null;
                        if (!baseMeta) {
                            baseMeta = await getTokenMetadataCached(order.baseAsset);
                            tokenMetaCache.set(order.baseAsset, baseMeta);
                        }
                    }

                    enrichedOrders.push({
                        ...order,
                        inputTokenMeta: inputMeta,
                        outputTokenMeta: outputMeta,
                        conditionTokenMeta: conditionMeta,
                        baseAssetMeta: baseMeta,
                    });
                }

                // Sort by creation date (newest first)
                setDisplayOrders(enrichedOrders.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ));
                console.log(`Set ${enrichedOrders.length} enriched orders in state:`, enrichedOrders.map(o => ({ uuid: o.uuid.slice(0, 8), status: o.status, inputSymbol: o.inputTokenMeta.symbol, outputSymbol: o.outputTokenMeta.symbol })));
            } else {
                throw new Error(j.error || "Failed to load orders");
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            setOrdersError((error as Error).message);
            setDisplayOrders([]);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [connected, address]);

    // Fetch orders when component mounts or wallet changes
    useEffect(() => {
        fetchOrders();
    }, [address, connected]);

    const handleOrderAction = async (orderId: string, action: 'view' | 'edit' | 'cancel') => {
        const order = displayOrders.find(o => o.uuid === orderId);
        if (!order) return;

        switch (action) {
            case 'view':
                // Highlight order on chart - toggle if already highlighted
                if (highlightedOrderId === order.uuid) {
                    setHighlightedOrderId(null); // Clear highlight if clicking same order
                    setExpandedOrderId(null); // Also clear expansion
                } else {
                    setHighlightedOrderId(order.uuid); // Highlight this order
                    setExpandedOrderId(order.uuid); // Also expand it
                }
                console.log('Viewing order:', order.uuid, highlightedOrderId === order.uuid ? 'cleared' : 'highlighted');
                break;
            case 'edit':
                // Clear any highlighting and expansion when editing
                setHighlightedOrderId(null);
                setExpandedOrderId(null);
                // Pre-fill form with order data for editing
                setDisplayAmount((Number(order.amountIn) / (10 ** order.inputTokenMeta.decimals!)).toString());
                setTargetPrice(order.targetPrice);
                setConditionDir(order.direction);
                // Set tokens to match the order
                setSelectedFromTokenSafe(order.inputTokenMeta);
                setSelectedToToken(order.outputTokenMeta);
                setConditionToken(order.conditionTokenMeta);
                if (order.baseAssetMeta) {
                    setBaseToken(order.baseAssetMeta);
                }
                break;
            case 'cancel':
                try {
                    const res = await signedFetch(`/api/v1/orders/${orderId}/cancel`, {
                        method: "PATCH",
                        message: orderId
                    });
                    if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        throw new Error(j.error || "Cancel failed");
                    }
                    toast.success("Order cancelled successfully.");
                    await fetchOrders(); // Refresh orders
                } catch (err) {
                    toast.error((err as Error).message || "Failed to cancel order.");
                }
                break;
        }
    };

    const formatTokenAmount = (amount: string | number, decimals: number) => {
        const num = Number(amount);
        if (isNaN(num)) return '0.00';
        return (num / (10 ** decimals)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        });
    };

    const formatCompactNumber = (amount: string | number, decimals: number) => {
        const num = Number(amount) / (10 ** decimals);
        if (isNaN(num)) return '0';

        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else if (num >= 1) {
            return num.toFixed(2);
        } else if (num >= 0.01) {
            return num.toFixed(3);
        } else {
            return num.toFixed(6);
        }
    };

    const formatCompactPrice = (price: string | number) => {
        const num = Number(price);
        if (isNaN(num)) return '0';

        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else if (num >= 1) {
            return num.toFixed(2);
        } else if (num >= 0.01) {
            return num.toFixed(3);
        } else {
            return num.toFixed(6);
        }
    };

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffSec / 60);
        const diffHour = Math.round(diffMin / 60);
        const diffDay = Math.round(diffHour / 24);

        if (diffSec < 60) {
            return 'just now';
        } else if (diffMin < 60) {
            return `${diffMin}m`;
        } else if (diffHour < 24) {
            return `${diffHour}h`;
        } else if (diffDay < 30) {
            return `${diffDay}d`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const chartToken = conditionToken || selectedToToken;

    // Handle Escape key to exit Pro mode
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsProMode(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [setIsProMode]);

    // Auto-set trading pair when entering pro mode
    useEffect(() => {
        // Set trading pair based on current condition token and base token
        if (conditionToken && !tradingPairBase) {
            setTradingPairBase(conditionToken);
        }
        if (baseToken && !tradingPairQuote) {
            setTradingPairQuote(baseToken);
        }
        // If no base token is set, try to use the selected "to" token as quote
        else if (selectedToToken && !tradingPairQuote) {
            setTradingPairQuote(selectedToToken);
        }
    }, [conditionToken, baseToken, selectedToToken]);

    const handleAmountChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setDisplayAmount(value);
        }
    };

    const handlePriceChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setTargetPrice(value);
        }
    };

    const handleDcaAmountChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setDcaAmount(value);
        }
    };

    const getTokenPrice = (token: any) => {
        if (!token) return null;
        const price = getUsdPrice(token.contractId);
        return price ? formatUsd(price) : null;
    };

    const handleCreateDcaOrder = () => {
        // TODO: Implement DCA order creation
        toast.info("DCA order creation coming soon!");
    };

    const handleSandwichBuyPriceChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichBuyPrice(value);
        }
    };

    const handleSandwichSellPriceChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichSellPrice(value);
        }
    };

    const handleSandwichSpreadChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichSpread(value);
        }
    };

    const handleSandwichUsdAmountChange = (value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichUsdAmount(value);
        }
    };

    // Helper function to create a single order
    const createSingleOrder = async (orderData: {
        inputToken: string;
        outputToken: string;
        amountIn: number;
        targetPrice: string;
        direction: 'lt' | 'gt';
        conditionToken: string;
        baseAsset: string;
    }) => {
        if (!address) throw new Error('Connect wallet');

        console.log('Creating order with data:', orderData);

        const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        try {
            // Create signature for the order
            const domain = tupleCV({
                name: stringAsciiCV('BLAZE_PROTOCOL'),
                version: stringAsciiCV('v1.0'),
                'chain-id': uintCV(1),
            });

            const message = tupleCV({
                contract: principalCV(orderData.inputToken),
                intent: stringAsciiCV('TRANSFER_TOKENS'),
                opcode: noneCV(),
                amount: optionalCVOf(uintCV(BigInt(orderData.amountIn))),
                target: optionalCVOf(principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9')),
                uuid: stringAsciiCV(uuid),
            });

            console.log('Requesting signature for order...');
            // @ts-ignore – upstream types don't include method yet
            const res = await request('stx_signStructuredMessage', { domain, message });
            if (!res?.signature) throw new Error('User cancelled the signature');

            console.log('Signature obtained, creating order payload...');
            const payload = {
                owner: address,
                inputToken: orderData.inputToken,
                outputToken: orderData.outputToken,
                amountIn: orderData.amountIn.toString(),
                targetPrice: orderData.targetPrice,
                direction: orderData.direction,
                conditionToken: orderData.conditionToken,
                baseAsset: orderData.baseAsset,
                recipient: address,
                signature: res.signature,
                uuid,
            };

            console.log('Sending order to API:', payload);
            const response = await fetch('/api/v1/orders/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            console.log('API response status:', response.status, response.statusText);

            if (!response.ok) {
                const j = await response.json().catch(() => ({ error: 'unknown' }));
                console.error('API error response:', j);
                throw new Error(j.error || `Order create failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Order created successfully:', result);
            return result;

        } catch (error) {
            console.error('Order creation error:', error);
            // Re-throw with more context
            if (error instanceof Error) {
                if (error.message.includes('Failed to fetch')) {
                    throw new Error('Network error: Unable to connect to the API. Please check your internet connection and try again.');
                } else if (error.message.includes('cancelled')) {
                    throw new Error('User cancelled the signature');
                } else {
                    throw error;
                }
            }
            throw new Error('Unknown error occurred during order creation');
        }
    };

    const handleCreateSandwichOrder = async () => {
        if (!selectedFromToken || !selectedToToken || !sandwichUsdAmount || !sandwichBuyPrice || !sandwichSellPrice) {
            toast.error("Please fill in all required fields for sandwich order");
            return;
        }

        setIsCreatingSandwichOrder(true);
        try {
            const usdAmount = parseFloat(sandwichUsdAmount);
            const buyPrice = parseFloat(sandwichBuyPrice);
            const sellPrice = parseFloat(sandwichSellPrice);

            if (isNaN(usdAmount) || isNaN(buyPrice) || isNaN(sellPrice)) {
                toast.error("Invalid price or amount values");
                setIsCreatingSandwichOrder(false);
                return;
            }

            // Calculate token amounts based on USD value and prices
            // For buy order: We want to spend USD amount worth of base token (CHA) to buy target token (LEO)
            // Amount of CHA to spend = USD amount / CHA price
            const chaPrice = getUsdPrice(selectedFromToken.contractId) || 1; // Get CHA price in USD
            const buyAmountInCha = usdAmount / chaPrice; // Amount of CHA to spend

            // For sell order: We want to sell USD amount worth of target token (LEO)
            // Amount of LEO to sell = USD amount / LEO price  
            const leoPrice = getUsdPrice(selectedToToken.contractId) || buyPrice; // Use LEO price or fallback to buy price
            const sellAmountInLeo = usdAmount / leoPrice; // Amount of LEO to sell

            console.log('Sandwich order calculations:', {
                usdAmount,
                chaPrice,
                leoPrice,
                buyAmountInCha,
                sellAmountInLeo,
                buyAmountInUnits: Math.floor(buyAmountInCha * (10 ** selectedFromToken.decimals!)),
                sellAmountInUnits: Math.floor(sellAmountInLeo * (10 ** selectedToToken.decimals!))
            });

            // Create buy low order (buy selectedToToken when price <= sandwichBuyPrice)
            const buyOrderData = {
                inputToken: selectedFromToken.contractId, // Paying with base token (e.g., CHA)
                outputToken: selectedToToken.contractId, // Buying target token (e.g., LEO)
                amountIn: Math.floor(buyAmountInCha * (10 ** selectedFromToken.decimals!)), // Amount of CHA to spend
                targetPrice: sandwichBuyPrice,
                direction: 'lt' as const, // Buy when price is less than or equal to buy price
                conditionToken: selectedToToken.contractId,
                baseAsset: selectedFromToken.contractId,
            };

            // Create sell high order (sell selectedToToken when price >= sandwichSellPrice)
            const sellOrderData = {
                inputToken: selectedToToken.contractId, // Selling target token (e.g., LEO)
                outputToken: selectedFromToken.contractId, // Receiving base token (e.g., CHA)
                amountIn: Math.floor(sellAmountInLeo * (10 ** selectedToToken.decimals!)), // Amount of LEO to sell
                targetPrice: sandwichSellPrice,
                direction: 'gt' as const, // Sell when price is greater than or equal to sell price
                conditionToken: selectedToToken.contractId,
                baseAsset: selectedFromToken.contractId,
            };

            // Create both orders simultaneously
            toast.info("Creating sandwich orders...");

            // Create buy order first
            console.log('Creating buy order:', buyOrderData);
            const buyResponse = await createSingleOrder(buyOrderData);
            console.log('Buy order created successfully');

            // Create sell order second
            console.log('Creating sell order:', sellOrderData);
            const sellResponse = await createSingleOrder(sellOrderData);
            console.log('Sell order created successfully');

            // Both orders created successfully
            const buyOrderId = buyResponse?.data?.uuid || buyResponse?.uuid || 'unknown';
            const sellOrderId = sellResponse?.data?.uuid || sellResponse?.uuid || 'unknown';
            toast.success(`Sandwich orders created successfully! Buy order: ${buyOrderId}, Sell order: ${sellOrderId}`);

            // Clear form
            setSandwichUsdAmount('');
            setSandwichBuyPrice('');
            setSandwichSellPrice('');

            // Refresh orders list with a small delay to ensure API has processed the orders
            console.log('Refreshing orders list...');
            setTimeout(async () => {
                await fetchOrders();
                console.log('Orders list refreshed');
            }, 1000); // 1 second delay

        } catch (error) {
            console.error('Sandwich order creation failed:', error);
            const errorMessage = (error as Error).message;
            if (errorMessage.includes('cancelled')) {
                toast.error("Order creation cancelled by user");
            } else {
                toast.error(`Failed to create sandwich order: ${errorMessage}`);
            }
        } finally {
            setIsCreatingSandwichOrder(false);
        }
    };

    const calculateSandwichPrices = () => {
        if (!selectedToToken || !sandwichSpread) return;

        const currentPrice = getUsdPrice(selectedToToken.contractId);
        if (!currentPrice) {
            toast.error("Unable to get current price for auto-calculation");
            return;
        }

        const spreadPercent = parseFloat(sandwichSpread) / 100;
        const buyPrice = currentPrice * (1 - spreadPercent);
        const sellPrice = currentPrice * (1 + spreadPercent);

        setSandwichBuyPrice(buyPrice.toFixed(8));
        setSandwichSellPrice(sellPrice.toFixed(8));

        toast.success(`Auto-calculated prices: Buy at ${buyPrice.toFixed(6)}, Sell at ${sellPrice.toFixed(6)}`);
    };

    const toggleOrderExpansion = (orderId: string) => {
        if (expandedOrderId === orderId) {
            // Collapsing - clear both expansion and highlight
            setExpandedOrderId(null);
            setHighlightedOrderId(null);
        } else {
            // Expanding - set both expansion and highlight
            setExpandedOrderId(orderId);
            setHighlightedOrderId(orderId);
        }
    };

    // Custom token selector component
    const TokenSelector = ({
        isOpen,
        onClose,
        onSelect,
        selectedToken,
        title,
        tokens = displayTokens
    }: {
        isOpen: boolean;
        onClose: () => void;
        onSelect: (token: TokenCacheData) => void;
        selectedToken: TokenCacheData | null;
        title: string;
        tokens?: TokenCacheData[];
    }) => {
        const [searchQuery, setSearchQuery] = useState('');

        const filteredTokens = tokens.filter(token =>
            token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            token.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black/50 z-[100] flex items-end justify-center pb-8">
                <div className="bg-card border border-border rounded-t-lg w-full max-w-4xl max-h-[70vh] flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-border">
                        <input
                            type="text"
                            placeholder="Search tokens..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                        />
                    </div>

                    {/* Token Grid */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-4 gap-3">
                            {filteredTokens.map((token) => (
                                <button
                                    key={token.contractId}
                                    onClick={() => {
                                        onSelect(token);
                                        onClose();
                                    }}
                                    className={`p-3 rounded-lg border transition-all hover:bg-background/80 text-left ${selectedToken?.contractId === token.contractId
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border'
                                        }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <TokenLogo token={token} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">{token.symbol}</div>
                                            <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                                            {getTokenPrice(token) && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {getTokenPrice(token)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {filteredTokens.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No tokens found matching "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Filter orders based on showAllOrders state
    const filteredOrders = showAllOrders
        ? displayOrders
        : displayOrders.filter(order => order.status === 'open');

    // Function to check if an order belongs to the current trading pair
    const orderBelongsToTradingPair = (order: DisplayOrder): boolean => {
        if (!tradingPairBase || !tradingPairQuote) return true; // Show all if no pair selected

        // Get all the tokens involved in the order
        const orderCondition = order.conditionTokenMeta.contractId;
        const orderBase = order.baseAssetMeta?.contractId || 'USD';
        const orderInput = order.inputTokenMeta.contractId;
        const orderOutput = order.outputTokenMeta.contractId;

        const pairBase = tradingPairBase.contractId;
        const pairQuote = tradingPairQuote.contractId;

        // Check multiple ways an order can belong to this trading pair:

        // 1. Traditional condition/base matching (both directions)
        const conditionBaseMatch = (orderCondition === pairBase && orderBase === pairQuote) ||
            (orderCondition === pairQuote && orderBase === pairBase);

        // 2. Input/Output token matching (both directions)
        const inputOutputMatch = (orderInput === pairBase && orderOutput === pairQuote) ||
            (orderInput === pairQuote && orderOutput === pairBase);

        // 3. Mixed matching - condition token matches one side, input/output matches the other
        const mixedMatch = (orderCondition === pairBase && (orderInput === pairQuote || orderOutput === pairQuote)) ||
            (orderCondition === pairQuote && (orderInput === pairBase || orderOutput === pairBase)) ||
            (orderInput === pairBase && (orderCondition === pairQuote || orderBase === pairQuote)) ||
            (orderInput === pairQuote && (orderCondition === pairBase || orderBase === pairBase));

        const belongs = conditionBaseMatch || inputOutputMatch || mixedMatch;

        // Debug logging for sandwich orders
        if (order.inputTokenMeta.symbol && order.outputTokenMeta.symbol) {
            console.log(`Order ${order.uuid.slice(0, 8)} (${order.inputTokenMeta.symbol}→${order.outputTokenMeta.symbol}) belongs to pair ${tradingPairBase?.symbol}/${tradingPairQuote?.symbol}:`, belongs, {
                conditionBaseMatch,
                inputOutputMatch,
                mixedMatch,
                orderTokens: { condition: order.conditionTokenMeta.symbol, base: order.baseAssetMeta?.symbol || 'USD', input: order.inputTokenMeta.symbol, output: order.outputTokenMeta.symbol },
                pairTokens: { base: tradingPairBase?.symbol, quote: tradingPairQuote?.symbol }
            });
        }

        return belongs;
    };

    // Filter orders by trading pair and status
    const pairFilteredOrders = filteredOrders.filter(orderBelongsToTradingPair);

    // Debug: Log final filtered orders
    console.log(`Final filtered orders for display: ${pairFilteredOrders.length}/${filteredOrders.length} (${showAllOrders ? 'all' : 'open only'})`,
        pairFilteredOrders.map(o => ({ uuid: o.uuid.slice(0, 8), status: o.status, tokens: `${o.inputTokenMeta.symbol}→${o.outputTokenMeta.symbol}` })));

    const renderOrderControls = () => {
        return (
            <div className="flex gap-6">
                {/* Left Side - Information Panel */}
                <div className="w-80 flex-shrink-0">
                    <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                            <div className={`p-2 rounded-lg ${selectedOrderType === 'single' ? 'bg-green-100 text-green-700' : selectedOrderType === 'dca' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {selectedOrderType === 'single' ? <Zap className="w-4 h-4" /> : selectedOrderType === 'dca' ? <Repeat className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </div>
                            <h4 className="font-semibold text-foreground">
                                {selectedOrderType === 'single' ? 'Limit Order' : selectedOrderType === 'dca' ? 'DCA Strategy' : 'Sandwich Order'}
                            </h4>
                        </div>

                        {selectedOrderType === 'single' ? (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-foreground mb-1">How it works:</h5>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        A limit order executes automatically when your target price condition is met.
                                        Set a price threshold and your swap will trigger when the market reaches that level.
                                    </p>
                                </div>
                            </div>
                        ) : selectedOrderType === 'dca' ? (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-foreground mb-1">How it works:</h5>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        Dollar-Cost Averaging spreads your purchase over time with regular, smaller buys.
                                        This reduces the impact of price volatility and averages out your entry price.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 text-sm">
                                <div>
                                    <h5 className="font-medium text-foreground mb-1">How it works:</h5>
                                    <p className="text-muted-foreground text-xs leading-relaxed">
                                        A sandwich order creates two orders simultaneously: a "buy low" order that triggers when the price drops to your target, and a "sell high" order that triggers when the price rises to your target. This strategy helps capture profits from price volatility.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side - Order Controls */}
                <div className="flex-1">
                    {selectedOrderType === 'single' ? (
                        <>
                            <div className="grid grid-cols-3 gap-6 max-w-4xl">
                                {/* Amount */}
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground font-medium">Amount</label>
                                    <input
                                        type="text"
                                        value={displayAmount}
                                        onChange={(e) => handleAmountChange(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        {selectedFromToken && getTokenPrice(selectedFromToken)}
                                    </div>
                                </div>

                                {/* From Token */}
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground font-medium">From</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowFromTokenSelector(true)}
                                        className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between hover:bg-background/80 transition-colors"
                                    >
                                        {selectedFromToken ? (
                                            <div className="flex items-center space-x-3">
                                                <TokenLogo token={selectedFromToken} size="md" />
                                                <span className="font-medium">{selectedFromToken.symbol}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Select token</span>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <div className="text-xs text-muted-foreground">
                                        Balance: {fromTokenBalance}
                                    </div>
                                </div>

                                {/* To Token */}
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground font-medium">To</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowToTokenSelector(true)}
                                        className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between hover:bg-background/80 transition-colors"
                                    >
                                        {selectedToToken ? (
                                            <div className="flex items-center space-x-3">
                                                <TokenLogo token={selectedToToken} size="md" />
                                                <span className="font-medium">{selectedToToken.symbol}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Select token</span>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <div className="text-xs text-muted-foreground">
                                        Balance: {toTokenBalance}
                                    </div>
                                </div>
                            </div>

                            {/* Action Row */}
                            <div className="flex items-center justify-between mt-6 max-w-4xl">
                                <div className="flex items-center space-x-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSwitchTokensEnhanced}
                                        className="h-10 px-4"
                                        title="Switch tokens"
                                    >
                                        <ArrowUpDown className="w-4 h-4 mr-2" />
                                        Switch
                                    </Button>
                                </div>

                                <Button
                                    onClick={handleCreateLimitOrder}
                                    disabled={isCreatingOrder || !selectedFromToken || !selectedToToken || !displayAmount || !targetPrice}
                                    className="h-12 px-8 text-sm bg-green-600 hover:bg-green-700 text-white font-medium"
                                >
                                    {isCreatingOrder ? 'Creating Order...' : 'Place Limit Order'}
                                </Button>
                            </div>
                        </>
                    ) : selectedOrderType === 'dca' ? (
                        <>
                            {/* Token Selection Row */}
                            <div className="grid grid-cols-3 gap-6 max-w-4xl">
                                {/* Amount */}
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground font-medium">Amount</label>
                                    <input
                                        type="text"
                                        value={dcaAmount}
                                        onChange={(e) => handleDcaAmountChange(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        Per execution
                                    </div>
                                </div>

                                {/* From Token */}
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground font-medium">From</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowFromTokenSelector(true)}
                                        className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between hover:bg-background/80 transition-colors"
                                    >
                                        {selectedFromToken ? (
                                            <div className="flex items-center space-x-3">
                                                <TokenLogo token={selectedFromToken} size="md" />
                                                <span className="font-medium">{selectedFromToken.symbol}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Select token</span>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <div className="text-xs text-muted-foreground">
                                        Balance: {fromTokenBalance}
                                    </div>
                                </div>

                                {/* To Token */}
                                <div className="space-y-2">
                                    <label className="text-sm text-muted-foreground font-medium">To</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowToTokenSelector(true)}
                                        className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between hover:bg-background/80 transition-colors"
                                    >
                                        {selectedToToken ? (
                                            <div className="flex items-center space-x-3">
                                                <TokenLogo token={selectedToToken} size="md" />
                                                <span className="font-medium">{selectedToToken.symbol}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Select token</span>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <div className="text-xs text-muted-foreground">
                                        Balance: {toTokenBalance}
                                    </div>
                                </div>
                            </div>

                            {/* DCA Settings Row - More Compact */}
                            <div className="grid grid-cols-4 gap-4 max-w-4xl mt-4">
                                {/* Frequency */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">Frequency</label>
                                    <select
                                        value={dcaFrequency}
                                        onChange={(e) => setDcaFrequency(e.target.value)}
                                        className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="hourly">Hourly</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>

                                {/* Duration */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">Duration (days)</label>
                                    <input
                                        type="text"
                                        value={dcaDuration}
                                        onChange={(e) => setDcaDuration(e.target.value)}
                                        placeholder="30"
                                        className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                {/* Start Date */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">Start Date</label>
                                    <input
                                        type="date"
                                        value={dcaStartDate}
                                        onChange={(e) => setDcaStartDate(e.target.value)}
                                        className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-1">
                                    <label className="text-xs text-muted-foreground font-medium">Actions</label>
                                    <div className="flex space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSwitchTokensEnhanced}
                                            className="h-10 px-3 flex-1"
                                            title="Switch tokens"
                                        >
                                            <ArrowUpDown className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            onClick={handleCreateDcaOrder}
                                            disabled={!selectedFromToken || !selectedToToken || !dcaAmount || !dcaStartDate}
                                            className="h-10 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium flex-[2]"
                                        >
                                            Create DCA
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex gap-6">
                            {/* Center - Order Controls */}
                            <div className="flex-1">
                                {/* USD Amount and Trading Pair Row */}
                                <div className="grid grid-cols-3 gap-6 max-w-4xl">
                                    {/* USD Amount */}
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground font-medium">USD Amount</label>
                                        <input
                                            type="text"
                                            value={sandwichUsdAmount}
                                            onChange={(e) => handleSandwichUsdAmountChange(e.target.value)}
                                            placeholder="100.00"
                                            className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                        <div className="text-xs text-muted-foreground">
                                            Total value for both orders
                                        </div>
                                    </div>

                                    {/* Base Token (Quote Currency) */}
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground font-medium">Base Token</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowFromTokenSelector(true)}
                                            className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between hover:bg-background/80 transition-colors"
                                        >
                                            {selectedFromToken ? (
                                                <div className="flex items-center space-x-3">
                                                    <TokenLogo token={selectedFromToken} size="md" />
                                                    <span className="font-medium">{selectedFromToken.symbol}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">Select base token</span>
                                            )}
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                        <div className="text-xs text-muted-foreground">
                                            Balance: {fromTokenBalance}
                                        </div>
                                    </div>

                                    {/* Target Token */}
                                    <div className="space-y-2">
                                        <label className="text-sm text-muted-foreground font-medium">Target Token</label>
                                        <button
                                            type="button"
                                            onClick={() => setShowToTokenSelector(true)}
                                            className="w-full h-12 px-4 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary flex items-center justify-between hover:bg-background/80 transition-colors"
                                        >
                                            {selectedToToken ? (
                                                <div className="flex items-center space-x-3">
                                                    <TokenLogo token={selectedToToken} size="md" />
                                                    <span className="font-medium">{selectedToToken.symbol}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">Select target token</span>
                                            )}
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                        <div className="text-xs text-muted-foreground">
                                            Balance: {toTokenBalance}
                                        </div>
                                    </div>
                                </div>

                                {/* Sandwich Settings Row */}
                                <div className="grid grid-cols-5 gap-4 max-w-4xl mt-4">
                                    {/* Buy Low Price */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Buy Low Price</label>
                                        <input
                                            type="text"
                                            value={sandwichBuyPrice}
                                            onChange={(e) => handleSandwichBuyPriceChange(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    {/* Sell High Price */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Sell High Price</label>
                                        <input
                                            type="text"
                                            value={sandwichSellPrice}
                                            onChange={(e) => handleSandwichSellPriceChange(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    {/* Spread Percentage */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Spread %</label>
                                        <input
                                            type="text"
                                            value={sandwichSpread}
                                            onChange={(e) => handleSandwichSpreadChange(e.target.value)}
                                            placeholder="5"
                                            className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    {/* Auto Calculate */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Auto Calc</label>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={calculateSandwichPrices}
                                            disabled={!selectedToToken || !sandwichSpread}
                                            className="w-full h-10 text-xs"
                                            title="Auto-calculate buy/sell prices based on current market price and spread"
                                        >
                                            Auto
                                        </Button>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Actions</label>
                                        <Button
                                            onClick={handleCreateSandwichOrder}
                                            disabled={isCreatingSandwichOrder || !selectedFromToken || !selectedToToken || !sandwichUsdAmount || !sandwichBuyPrice || !sandwichSellPrice}
                                            className="w-full h-10 text-sm bg-yellow-600 hover:bg-yellow-700 text-white font-medium"
                                        >
                                            {isCreatingSandwichOrder ? 'Creating...' : 'Create'}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side - Calculated Token Amounts */}
                            <div className="w-80 flex-shrink-0">
                                {sandwichUsdAmount && sandwichBuyPrice && sandwichSellPrice && selectedFromToken && selectedToToken ? (
                                    <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-700">
                                                <Eye className="w-4 h-4" />
                                            </div>
                                            <h4 className="font-semibold text-foreground">Calculated Amounts</h4>
                                        </div>

                                        <div className="space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-green-600 font-medium">Buy Order:</span>
                                                <span className="font-mono text-foreground">
                                                    {(() => {
                                                        const usdAmount = parseFloat(sandwichUsdAmount);
                                                        const buyPrice = parseFloat(sandwichBuyPrice);
                                                        if (!isNaN(usdAmount) && !isNaN(buyPrice) && buyPrice > 0) {
                                                            const tokenAmount = usdAmount / buyPrice;
                                                            return `${tokenAmount.toFixed(6)} ${selectedToToken.symbol}`;
                                                        }
                                                        return '0.000000';
                                                    })()}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-red-600 font-medium">Sell Order:</span>
                                                <span className="font-mono text-foreground">
                                                    {(() => {
                                                        const usdAmount = parseFloat(sandwichUsdAmount);
                                                        const sellPrice = parseFloat(sandwichSellPrice);
                                                        if (!isNaN(usdAmount) && !isNaN(sellPrice) && sellPrice > 0) {
                                                            const tokenAmount = usdAmount / sellPrice;
                                                            return `${tokenAmount.toFixed(6)} ${selectedToToken.symbol}`;
                                                        }
                                                        return '0.000000';
                                                    })()}
                                                </span>
                                            </div>

                                            {/* Profit Estimate */}
                                            <div className="border-t border-border/30 pt-3 mt-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-blue-600 font-medium">Estimated Profit:</span>
                                                    <span className="font-mono text-foreground">
                                                        {(() => {
                                                            const usdAmount = parseFloat(sandwichUsdAmount);
                                                            const buyPrice = parseFloat(sandwichBuyPrice);
                                                            const sellPrice = parseFloat(sandwichSellPrice);

                                                            if (!isNaN(usdAmount) && !isNaN(buyPrice) && !isNaN(sellPrice) && buyPrice > 0 && sellPrice > 0) {
                                                                // Calculate tokens bought and sold
                                                                const tokensBought = usdAmount / buyPrice;
                                                                const tokensValue = tokensBought * sellPrice;
                                                                const profit = tokensValue - usdAmount;
                                                                const profitPercentage = (profit / usdAmount) * 100;

                                                                const profitColor = profit >= 0 ? 'text-green-600' : 'text-red-600';
                                                                const sign = profit >= 0 ? '+' : '';

                                                                return (
                                                                    <span className={profitColor}>
                                                                        {sign}${profit.toFixed(2)} ({sign}{profitPercentage.toFixed(2)}%)
                                                                    </span>
                                                                );
                                                            }
                                                            return '$0.00 (0.00%)';
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-background/60 border border-border/60 rounded-lg p-4">
                                        <div className="flex items-center space-x-2 mb-3">
                                            <div className="p-2 rounded-lg bg-muted">
                                                <Eye className="w-4 h-4" />
                                            </div>
                                            <h4 className="font-semibold text-foreground">Calculated Amounts</h4>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Enter USD amount and prices to see calculated token amounts
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Custom order creation handler that refreshes the orders list
    const handleCreateLimitOrder = async () => {
        try {
            await originalHandleCreateLimitOrder();
            // Refresh orders list after successful creation
            await fetchOrders();
        } catch (error) {
            // Error handling is already done in the original function
            console.error('Order creation failed:', error);
        }
    };

    // Function to clear highlighted order
    const clearHighlightedOrder = () => {
        setHighlightedOrderId(null);
        setExpandedOrderId(null);
    };

    return (
        <div className="fixed inset-0 bg-background z-50 flex">
            {/* Token Selector Modals */}
            <TokenSelector
                isOpen={showFromTokenSelector}
                onClose={() => setShowFromTokenSelector(false)}
                onSelect={(token) => {
                    setSelectedFromTokenSafe(token);
                    setConditionToken(token);
                    // Auto-set trading pair if not already set
                    if (!tradingPairBase) {
                        setTradingPairBase(token);
                    }
                }}
                selectedToken={selectedFromToken}
                title="Select From Token"
                tokens={subnetDisplayTokens}
            />

            <TokenSelector
                isOpen={showToTokenSelector}
                onClose={() => setShowToTokenSelector(false)}
                onSelect={(token) => {
                    setSelectedToToken(token);
                    // Auto-set trading pair if not already set
                    if (!tradingPairQuote) {
                        setTradingPairQuote(token);
                    }
                    // Set as base token for price calculations
                    setBaseToken(token);
                }}
                selectedToken={selectedToToken}
                title="Select To Token"
                tokens={subnetDisplayTokens}
            />

            {/* Left Sidebar - Order Type Selection (Full Height) */}
            <div className="w-80 border-r border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
                <div className="p-4 border-b border-border/40">
                    <h2 className="text-lg font-semibold text-foreground">Order Types</h2>
                    <p className="text-xs text-muted-foreground mt-1">Choose your trading strategy</p>
                </div>

                <div className="p-4 space-y-3">
                    {/* Single Order Option */}
                    <Card
                        className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'single' ? 'ring-2 ring-primary bg-primary/5' : ''
                            }`}
                        onClick={() => setSelectedOrderType('single')}
                    >
                        <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg ${selectedOrderType === 'single' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                }`}>
                                <Zap className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-sm">Single Order</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Execute one-time limit orders when price conditions are met
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                    <Badge variant="outline" className="text-xs">Limit Orders</Badge>
                                    <Badge variant="outline" className="text-xs">Price Triggers</Badge>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* DCA Order Option */}
                    <Card
                        className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'dca' ? 'ring-2 ring-primary bg-primary/5' : ''
                            }`}
                        onClick={() => setSelectedOrderType('dca')}
                    >
                        <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg ${selectedOrderType === 'dca' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                }`}>
                                <Repeat className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-sm">DCA Orders</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Dollar-cost average with recurring purchases over time
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                    <Badge variant="outline" className="text-xs">Recurring</Badge>
                                    <Badge variant="outline" className="text-xs">Scheduled</Badge>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Sandwich Order Option */}
                    <Card
                        className={`p-4 cursor-pointer transition-all hover:bg-background/80 ${selectedOrderType === 'sandwich' ? 'ring-2 ring-primary bg-primary/5' : ''
                            }`}
                        onClick={() => setSelectedOrderType('sandwich')}
                    >
                        <div className="flex items-start space-x-3">
                            <div className={`p-2 rounded-lg ${selectedOrderType === 'sandwich' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                }`}>
                                <Eye className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-medium text-sm">Sandwich Orders</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Buy and sell the same asset twice within a short period
                                </p>
                                <div className="flex items-center space-x-2 mt-2">
                                    <Badge variant="outline" className="text-xs">Arbitrage</Badge>
                                    <Badge variant="outline" className="text-xs">Hedging</Badge>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Order Type Info */}
                <div className="mt-auto p-4 border-t border-border/40">
                    <div className="text-xs text-muted-foreground">
                        {selectedOrderType === 'single' ? (
                            <>
                                <div className="font-medium mb-1">Single Order Features:</div>
                                <ul className="space-y-1">
                                    <li>• Price-triggered execution</li>
                                    <li>• One-time purchase</li>
                                    <li>• Immediate or conditional</li>
                                </ul>
                            </>
                        ) : selectedOrderType === 'dca' ? (
                            <>
                                <div className="font-medium mb-1">DCA Order Features:</div>
                                <ul className="space-y-1">
                                    <li>• Recurring purchases</li>
                                    <li>• Time-based execution</li>
                                    <li>• Risk averaging</li>
                                </ul>
                            </>
                        ) : (
                            <>
                                <div className="font-medium mb-1">Sandwich Order Features:</div>
                                <ul className="space-y-1">
                                    <li>• Buy and sell the same asset twice</li>
                                    <li>• Used for arbitrage or hedging</li>
                                    <li>• Short duration between trades</li>
                                </ul>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Chart Area */}
                <div className="flex-1 flex flex-col">
                    {/* Chart Header */}
                    <div className="p-4 border-b border-border/40 flex items-center justify-between bg-card/30">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-2xl font-bold text-foreground">Pro Trading</h1>

                            {/* Conditional Logic Section - Matching Normal Orders View */}
                            {tradingPairBase && tradingPairQuote && (
                                <div className="flex items-center space-x-4">
                                    {/* When Label */}
                                    <div className="text-sm text-muted-foreground font-medium">When</div>

                                    {/* Condition Token */}
                                    <div className="w-32">
                                        <TokenDropdown
                                            tokens={displayTokens}
                                            selected={tradingPairBase}
                                            onSelect={setTradingPairBase}
                                            label=""
                                        />
                                    </div>

                                    {/* Direction Toggle */}
                                    <div className="flex items-center border border-border/40 rounded-md overflow-hidden text-xs select-none shrink-0 whitespace-nowrap">
                                        {[
                                            { key: 'gt', label: 'is greater than' },
                                            { key: 'lt', label: 'is less than' },
                                        ].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                className={`px-2.5 py-1 whitespace-nowrap transition-colors ${conditionDir === key ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted'}`}
                                                onClick={() => setConditionDir(key as 'lt' | 'gt')}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Price Input with +/- buttons */}
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            value={targetPrice}
                                            onChange={(e) => handlePriceChange(e.target.value)}
                                            placeholder="0.00"
                                            className="w-36 bg-transparent border-none text-lg font-medium focus:outline-none placeholder:text-muted-foreground/50"
                                        />
                                        <div className="flex flex-row gap-0.5 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const currentPrice = parseFloat(targetPrice) || 0;
                                                    setTargetPrice((currentPrice + 0.01).toString());
                                                }}
                                                className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded"
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const currentPrice = parseFloat(targetPrice) || 0;
                                                    const newPrice = Math.max(0, currentPrice - 0.01);
                                                    setTargetPrice(newPrice.toString());
                                                }}
                                                className="cursor-pointer hover:bg-muted-foreground/10 text-xs px-1.5 py-0.5 bg-muted-foreground/5 rounded"
                                            >
                                                -
                                            </button>
                                        </div>
                                    </div>

                                    {/* Base Token (Quote) */}
                                    <div className="w-32">
                                        <TokenDropdown
                                            tokens={displayTokens}
                                            selected={tradingPairQuote}
                                            onSelect={setTradingPairQuote}
                                            label=""
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Show All Orders Button - appears when an order is highlighted */}
                            {highlightedOrderId && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearHighlightedOrder}
                                    className="text-xs h-8 px-3"
                                >
                                    Show All Orders
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsProMode(false)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Exit Pro mode (Esc)"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Chart Content */}
                    <div className="flex-1 p-4 flex flex-col min-h-0">
                        {tradingPairBase && tradingPairQuote ? (
                            <ProModeChart
                                token={tradingPairQuote}
                                baseToken={tradingPairBase}
                                targetPrice={targetPrice}
                                onTargetPriceChange={setTargetPrice}
                                userOrders={pairFilteredOrders}
                                highlightedOrderId={highlightedOrderId}
                                conditionDir={conditionDir}
                                isSandwichMode={selectedOrderType === 'sandwich'}
                                sandwichBuyPrice={sandwichBuyPrice}
                                sandwichSellPrice={sandwichSellPrice}
                                onSandwichBuyPriceChange={setSandwichBuyPrice}
                                onSandwichSellPriceChange={setSandwichSellPrice}
                                sandwichSpread={sandwichSpread}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-xl font-medium text-foreground mb-2">Select Trading Pair</h3>
                                    <p className="text-muted-foreground">
                                        Choose tokens below to start trading
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Order Placement Section - Between Sidebars */}
                <div className="border-t border-border/40 bg-card/50 backdrop-blur-sm p-4 flex-shrink-0">
                    {renderOrderControls()}
                </div>
            </div>

            {/* Right Sidebar - Orders (Full Height) */}
            <div className="w-96 border-l border-border/40 bg-card/50 backdrop-blur-sm flex flex-col">
                <div className="p-4 border-b border-border/40">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-foreground">
                            {tradingPairBase && tradingPairQuote ?
                                `${tradingPairBase.symbol}/${tradingPairQuote.symbol} Orders` :
                                (showAllOrders ? 'All Orders' : 'Open Orders')
                            } ({pairFilteredOrders.length})
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAllOrders(!showAllOrders)}
                            className="text-xs h-7 px-2"
                        >
                            {showAllOrders ? 'Show Open Only' : 'Show All'}
                        </Button>
                    </div>
                    {!showAllOrders && displayOrders.length > pairFilteredOrders.length && (
                        <p className="text-xs text-muted-foreground">
                            {displayOrders.length - pairFilteredOrders.length} orders hidden (completed/cancelled{tradingPairBase && tradingPairQuote ? '/other pairs' : ''})
                        </p>
                    )}
                    {tradingPairBase && tradingPairQuote && pairFilteredOrders.length === 0 && displayOrders.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            No orders for this trading pair. Select different tokens or create a new order.
                        </p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoadingOrders ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-sm text-muted-foreground">Loading orders...</div>
                        </div>
                    ) : ordersError ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-center">
                                <div className="text-sm text-red-500 mb-2">{ordersError}</div>
                                <Button variant="outline" size="sm" onClick={fetchOrders}>
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : pairFilteredOrders.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="text-center">
                                <div className="text-sm text-muted-foreground mb-2">No active orders</div>
                                <div className="text-xs text-muted-foreground">Place your first order below</div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pairFilteredOrders.map((order) => {
                                const isExpanded = expandedOrderId === order.uuid;
                                const isHighlighted = highlightedOrderId === order.uuid;

                                return (
                                    <Card key={order.uuid} className={`transition-all duration-200 hover:bg-background/80 ${isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                                        {/* Compact Row */}
                                        <div
                                            className="p-3 cursor-pointer flex items-center justify-between"
                                            onClick={() => toggleOrderExpansion(order.uuid)}
                                        >
                                            <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                                                {/* Amount */}
                                                <div className="text-xs font-medium shrink-0">
                                                    {formatCompactNumber(order.amountIn, order.inputTokenMeta.decimals!)}
                                                </div>

                                                {/* Price Ratio: Show as symbol/symbol based on price convention */}
                                                <div className="text-xs font-mono text-muted-foreground shrink-0">
                                                    {(() => {
                                                        const orderPrice = parseFloat(order.targetPrice);
                                                        const isSmallPrice = orderPrice < 1;

                                                        // Determine which ratio the price represents
                                                        const baseSymbol = isSmallPrice ? order.outputTokenMeta.symbol : order.inputTokenMeta.symbol;
                                                        const quoteSymbol = isSmallPrice ? order.inputTokenMeta.symbol : order.outputTokenMeta.symbol;

                                                        return `${baseSymbol}/${quoteSymbol} @${formatCompactPrice(order.targetPrice)}`;
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-1.5 shrink-0">
                                                <div className="text-xs text-muted-foreground">
                                                    {formatRelativeTime(order.createdAt)}
                                                </div>
                                                {isExpanded ? (
                                                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="px-3 pb-3 border-t border-border/30 pt-3 space-y-3">
                                                {/* Swap Path */}
                                                <div className="flex items-center space-x-2 mb-3">
                                                    <span className="text-muted-foreground text-sm">Swap:</span>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-sm font-medium">
                                                            {formatTokenAmount(order.amountIn, order.inputTokenMeta.decimals!)}
                                                        </span>
                                                        <div className="flex items-center space-x-1">
                                                            <TokenLogo token={order.inputTokenMeta} size="sm" />
                                                            <span className="text-sm font-medium">{order.inputTokenMeta.symbol}</span>
                                                        </div>
                                                        <span className="text-muted-foreground font-medium">→</span>
                                                        <div className="flex items-center space-x-1">
                                                            <TokenLogo token={order.outputTokenMeta} size="sm" />
                                                            <span className="text-sm font-medium">{order.outputTokenMeta.symbol}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">Target:</span>
                                                        <div className="font-mono">{order.direction === 'gt' ? '≥' : '≤'} {formatCompactPrice(order.targetPrice)}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Status:</span>
                                                        <div>
                                                            <Badge variant={order.status === 'open' ? 'default' : order.status === 'filled' ? 'secondary' : 'outline'} className="text-xs">
                                                                {order.status === 'open' ? 'Active' : order.status === 'filled' ? 'Filled' : 'Cancelled'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Created:</span>
                                                        <div className="text-xs">{new Date(order.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">Direction:</span>
                                                        <div className="text-xs">{order.direction === 'gt' ? 'Buy when ≥' : 'Sell when ≤'}</div>
                                                    </div>
                                                </div>

                                                {/* Action Buttons - Only Cancel */}
                                                {order.status === 'open' && (
                                                    <div className="flex justify-end pt-2 border-t border-border/30">
                                                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleOrderAction(order.uuid, 'cancel'); }} title="Cancel order">
                                                            <Trash2 className="w-3 h-3 mr-1" />
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 