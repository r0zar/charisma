"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useSwapContext } from './swap-context';
import { useWallet } from './wallet-context';
import type { LimitOrder } from '../lib/orders/types';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { signedFetch } from 'blaze-sdk';
import { toast } from 'sonner';
import { request } from '@stacks/connect';
import { tupleCV, stringAsciiCV, uintCV, principalCV, optionalCVOf, noneCV } from '@stacks/transactions';

// Enriched order type with token metadata
export interface DisplayOrder extends LimitOrder {
    inputTokenMeta: TokenCacheData;
    outputTokenMeta: TokenCacheData;
    conditionTokenMeta: TokenCacheData;
    baseAssetMeta?: TokenCacheData | null;
}

export type OrderType = 'single' | 'dca' | 'sandwich';

// DCA creation state interface
interface DCACreationState {
    isOpen: boolean;
    phase: 'preview' | 'signing' | 'complete';
    orders: Array<{
        uuid: string;
        amount: number;
        validFrom: string;
        validTo: string;
        status: 'pending' | 'signing' | 'success' | 'error';
        error?: string;
    }>;
    currentOrderIndex: number;
    totalOrders: number;
    amountPerOrder: number;
    intervalHours: number;
    startDate: string;
    errors: string[];
    successCount: number;
}

// Single order creation state interface
interface SingleOrderCreationState {
    isOpen: boolean;
    phase: 'preview' | 'signing' | 'complete';
    order: {
        amount: string;
        targetPrice: string;
        conditionDir: 'lt' | 'gt';
        status: 'pending' | 'signing' | 'success' | 'error';
        uuid?: string;
        signature?: string;
        error?: string;
    } | null;
    errors: string[];
}

// Sandwich creation state interface
interface SandwichCreationState {
    isOpen: boolean;
    phase: 'preview' | 'signing' | 'complete';
    orders: Array<{
        type: 'buy' | 'sell';
        price: string;
        amount: string;
        status: 'pending' | 'signing' | 'success' | 'error';
        uuid?: string;
        signature?: string;
        error?: string;
    }>;
    currentOrderIndex: number;
    usdAmount: string;
    buyPrice: string;
    sellPrice: string;
    spread: string;
    errors: string[];
    successCount: number;
}

// Token selection dialog state
interface TokenSelectionState {
    isOpen: boolean;
    selectionType: 'from' | 'to' | 'tradingPairBase' | 'tradingPairQuote' | null;
    title: string;
}

// Context interface
interface ProModeContextType {
    // UI State
    selectedOrderType: OrderType;
    setSelectedOrderType: (type: OrderType) => void;
    expandedOrderId: string | null;
    setExpandedOrderId: (id: string | null) => void;
    highlightedOrderId: string | null;
    setHighlightedOrderId: (id: string | null) => void;
    showAllOrders: boolean;
    setShowAllOrders: (show: boolean) => void;

    // Token Selection Dialog State
    tokenSelectionState: TokenSelectionState;
    openTokenSelection: (type: 'from' | 'to' | 'tradingPairBase' | 'tradingPairQuote', title: string) => void;
    closeTokenSelection: () => void;

    // Trading Pair State
    tradingPairBase: TokenCacheData | null;
    setTradingPairBase: (token: TokenCacheData | null) => void;
    tradingPairQuote: TokenCacheData | null;
    setTradingPairQuote: (token: TokenCacheData | null) => void;
    lockTradingPairToSwapTokens: boolean;
    setLockTradingPairToSwapTokens: (lock: boolean) => void;

    // Order Form State
    displayAmount: string;
    setDisplayAmount: (amount: string) => void;
    targetPrice: string;
    setTargetPrice: (price: string) => void;
    conditionDir: 'lt' | 'gt';
    setConditionDir: (dir: 'lt' | 'gt') => void;
    currentPrice: number | null;
    setCurrentPrice: (price: number | null) => void;

    // DCA State
    dcaAmount: string;
    setDcaAmount: (amount: string) => void;
    dcaFrequency: string;
    setDcaFrequency: (frequency: string) => void;
    dcaDuration: string;
    setDcaDuration: (duration: string) => void;
    dcaStartDate: string;
    setDcaStartDate: (date: string) => void;
    dcaCreationState: DCACreationState;
    setDcaCreationState: React.Dispatch<React.SetStateAction<DCACreationState>>;

    // Single Order Creation State
    singleOrderCreationState: SingleOrderCreationState;
    setSingleOrderCreationState: React.Dispatch<React.SetStateAction<SingleOrderCreationState>>;

    // Sandwich Creation State
    sandwichCreationState: SandwichCreationState;
    setSandwichCreationState: React.Dispatch<React.SetStateAction<SandwichCreationState>>;

    // Sandwich State
    sandwichBuyPrice: string;
    setSandwichBuyPrice: (price: string) => void;
    sandwichSellPrice: string;
    setSandwichSellPrice: (price: string) => void;
    sandwichSpread: string;
    setSandwichSpread: (spread: string) => void;
    sandwichUsdAmount: string;
    setSandwichUsdAmount: (amount: string) => void;

    // Orders Data
    displayOrders: DisplayOrder[];
    pairFilteredOrders: DisplayOrder[];
    swapFilteredOrders: DisplayOrder[];
    filteredOrders: DisplayOrder[];

    // Loading States
    isLoadingOrders: boolean;
    isCreatingOrder: boolean;
    isCreatingSandwichOrder: boolean;
    setIsCreatingSandwichOrder: (loading: boolean) => void;
    ordersError: string | null;

    // Computed Values
    shouldShowSplitSections: boolean;
    tradingPairMatchesSwapTokens: boolean;

    // Handlers
    handleSwitchTokensEnhanced: () => void;
    handleCreateLimitOrder: () => Promise<void>;
    handleCreateDcaOrder: () => Promise<void>;
    handleCreateSandwichOrder: () => Promise<void>;
    handleSubmitOrder: () => Promise<void>;
    handleOrderAction: (orderId: string, action: 'cancel' | 'execute') => Promise<void>;
    confirmCancelOrder: (orderId: string) => void;
    cancelOrderAction: (orderId: string) => void;
    executeOrderAction: (orderId: string) => void;
    toggleOrderExpansion: (orderId: string) => void;
    clearHighlightedOrder: () => void;
    fetchOrders: () => Promise<void>;

    // Individual Order Management
    updateOrderById: (orderId: string, updates: Partial<DisplayOrder>) => void;
    updateOrderStatus: (orderId: string, status: LimitOrder['status'], txid?: string) => void;
    addNewOrder: (order: DisplayOrder) => void;
    removeOrderById: (orderId: string) => void;

    // Order Action State
    cancelingOrders: Set<string>;
    executingOrders: Set<string>;
    confirmCancelOrderId: string | null;
    setConfirmCancelOrderId: (id: string | null) => void;

    // Utility Functions
    formatTokenAmount: (amount: string | number, decimals: number) => string;
    formatCompactNumber: (amount: string | number, decimals: number) => string;
    formatCompactPrice: (price: string | number) => string;
    formatRelativeTime: (dateString: string) => string;
    getTokenPrice: (token: any) => string | null;

    // Input Handlers
    handleAmountChange: (value: string) => void;
    handlePriceChange: (value: string) => void;
    handleDcaAmountChange: (value: string) => void;
    handleSandwichBuyPriceChange: (value: string) => void;
    handleSandwichSellPriceChange: (value: string) => void;
    handleSandwichSpreadChange: (value: string) => void;
    handleSandwichUsdAmountChange: (value: string) => void;

    // Loading States (additional)
    isSubmitting: boolean;
}

const ProModeContext = createContext<ProModeContextType | undefined>(undefined);

export function useProModeContext() {
    const context = useContext(ProModeContext);
    if (context === undefined) {
        throw new Error('useProModeContext must be used within a ProModeProvider');
    }
    return context;
}

interface ProModeProviderProps {
    children: React.ReactNode;
}

export function ProModeProvider({ children }: ProModeProviderProps) {
    // Get dependencies from other contexts
    const {
        selectedFromToken,
        selectedToToken,
        displayAmount: swapDisplayAmount,
        setDisplayAmount: setSwapDisplayAmount,
        targetPrice: swapTargetPrice,
        setTargetPrice: setSwapTargetPrice,
        conditionToken,
        setConditionToken,
        baseToken,
        setBaseToken,
        conditionDir: swapConditionDir,
        setConditionDir: setSwapConditionDir,
        displayTokens,
        setIsProMode,
        handleCreateLimitOrder: originalHandleCreateLimitOrder,
        isCreatingOrder,
        handleSwitchTokensEnhanced: originalHandleSwitchTokensEnhanced,
        fromTokenBalance,
        toTokenBalance,
        formatUsd,
        getUsdPrice,
        fetchHistoricalPrices,
        setSelectedFromTokenSafe,
        setSelectedToToken,
        subnetDisplayTokens,
    } = useSwapContext();

    const { address, connected } = useWallet();

    // UI State
    const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('single');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [showAllOrders, setShowAllOrders] = useState(false);
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

    // Trading pair state for pro mode
    // Note: tradingPairBase maps to API's conditionToken (token being watched)
    // tradingPairQuote maps to API's baseAsset (token used for price denomination)
    // Display format: "1 tradingPairBase = X tradingPairQuote"
    const [tradingPairBase, setTradingPairBase] = useState<TokenCacheData | null>(null);
    const [tradingPairQuote, setTradingPairQuote] = useState<TokenCacheData | null>(null);
    const [lockTradingPairToSwapTokens, setLockTradingPairToSwapTokens] = useState(true);

    // Token selection dialog state
    const [tokenSelectionState, setTokenSelectionState] = useState<TokenSelectionState>({
        isOpen: false,
        selectionType: null,
        title: ''
    });

    // Local state that shadows swap context state for pro mode
    const [displayAmount, setDisplayAmount] = useState('');
    const [targetPrice, setTargetPrice] = useState('');
    const [conditionDir, setConditionDir] = useState<'lt' | 'gt'>('gt');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

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

    // Orders state
    const [displayOrders, setDisplayOrders] = useState<DisplayOrder[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [ordersError, setOrdersError] = useState<string | null>(null);

    // DCA creation state for enhanced UX
    const [dcaCreationState, setDcaCreationState] = useState<DCACreationState>({
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

    // Single order creation state for enhanced UX
    const [singleOrderCreationState, setSingleOrderCreationState] = useState<SingleOrderCreationState>({
        isOpen: false,
        phase: 'preview',
        order: null,
        errors: []
    });

    // Sandwich creation state for enhanced UX
    const [sandwichCreationState, setSandwichCreationState] = useState<SandwichCreationState>({
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

    // Sync with swap context when entering pro mode
    useEffect(() => {
        setDisplayAmount(swapDisplayAmount);
        setTargetPrice(swapTargetPrice);
        setConditionDir(swapConditionDir);
    }, [swapDisplayAmount, swapTargetPrice, swapConditionDir]);

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
    }, [conditionToken, baseToken, selectedToToken, tradingPairBase, tradingPairQuote]);

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
    }, [address, connected, fetchOrders]);

    // Filter orders based on showAllOrders state
    const filteredOrders = showAllOrders
        ? displayOrders
        : displayOrders.filter(order => order.status === 'open');

    // Function to check if an order belongs to the current trading pair
    const orderBelongsToTradingPair = useCallback((order: DisplayOrder): boolean => {
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

        return belongs;
    }, [tradingPairBase, tradingPairQuote]);

    // Function to check if an order belongs to the selected swap tokens (from/to)
    const orderBelongsToSwapTokens = useCallback((order: DisplayOrder): boolean => {
        if (!selectedFromToken || !selectedToToken) return false; // Only show if both tokens selected

        const orderInput = order.inputTokenMeta.contractId;
        const orderOutput = order.outputTokenMeta.contractId;
        const swapFrom = selectedFromToken.contractId;
        const swapTo = selectedToToken.contractId;

        // Check if order matches swap tokens (both directions)
        const directMatch = (orderInput === swapFrom && orderOutput === swapTo);
        const reverseMatch = (orderInput === swapTo && orderOutput === swapFrom);

        return directMatch || reverseMatch;
    }, [selectedFromToken, selectedToToken]);

    // Filter orders by trading pair and status
    const pairFilteredOrders = useMemo(() =>
        filteredOrders.filter(orderBelongsToTradingPair),
        [filteredOrders, orderBelongsToTradingPair]
    );

    // Filter orders by swap tokens
    const swapFilteredOrders = useMemo(() =>
        filteredOrders.filter(orderBelongsToSwapTokens),
        [filteredOrders, orderBelongsToSwapTokens]
    );

    // Check if trading pair tokens are the same as swap tokens
    const tradingPairMatchesSwapTokens = useMemo(() => {
        if (!tradingPairBase || !tradingPairQuote || !selectedFromToken || !selectedToToken) return false;

        const pairTokens = new Set([tradingPairBase.contractId, tradingPairQuote.contractId]);
        const swapTokens = new Set([selectedFromToken.contractId, selectedToToken.contractId]);

        // Check if both sets contain the same tokens
        return pairTokens.size === swapTokens.size &&
            [...pairTokens].every(token => swapTokens.has(token));
    }, [tradingPairBase?.contractId, tradingPairQuote?.contractId, selectedFromToken?.contractId, selectedToToken?.contractId]);

    // Determine if we should show split sections or single section
    const shouldShowSplitSections = !tradingPairMatchesSwapTokens && !!selectedFromToken && !!selectedToToken;

    // Utility Functions
    const formatTokenAmount = useCallback((amount: string | number, decimals: number) => {
        const num = Number(amount);
        if (isNaN(num)) return '0.00';
        return (num / (10 ** decimals)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        });
    }, []);

    const formatCompactNumber = useCallback((amount: string | number, decimals: number) => {
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
    }, []);

    const formatCompactPrice = useCallback((price: string | number) => {
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
    }, []);

    const formatRelativeTime = useCallback((dateString: string) => {
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
    }, []);

    const getTokenPrice = useCallback((token: any) => {
        if (!token) return null;
        const price = getUsdPrice(token.contractId);
        return price ? formatUsd(price) : null;
    }, [getUsdPrice, formatUsd]);

    // Input Handlers
    const handleAmountChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setDisplayAmount(value);
        }
    }, []);

    const handlePriceChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setTargetPrice(value);
        }
    }, []);

    const handleDcaAmountChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setDcaAmount(value);
        }
    }, []);

    const handleSandwichBuyPriceChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichBuyPrice(value);
        }
    }, []);

    const handleSandwichSellPriceChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichSellPrice(value);
        }
    }, []);

    const handleSandwichSpreadChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichSpread(value);
        }
    }, []);

    const handleSandwichUsdAmountChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setSandwichUsdAmount(value);
        }
    }, []);

    // Order Action State
    const [cancelingOrders, setCancelingOrders] = useState<Set<string>>(new Set());
    const [executingOrders, setExecutingOrders] = useState<Set<string>>(new Set());
    const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);

    // Individual Order Management Functions
    const updateOrderById = useCallback((orderId: string, updates: Partial<DisplayOrder>) => {
        setDisplayOrders(prevOrders =>
            prevOrders.map(order =>
                order.uuid === orderId ? { ...order, ...updates } : order
            )
        );
    }, []);

    const updateOrderStatus = useCallback((orderId: string, status: LimitOrder['status'], txid?: string) => {
        setDisplayOrders(prevOrders =>
            prevOrders.map(order =>
                order.uuid === orderId ? { ...order, status, txid } : order
            )
        );
    }, []);

    const addNewOrder = useCallback((order: DisplayOrder) => {
        setDisplayOrders(prevOrders => [...prevOrders, order]);
    }, []);

    const removeOrderById = useCallback((orderId: string) => {
        setDisplayOrders(prevOrders => prevOrders.filter(order => order.uuid !== orderId));
    }, []);

    // Action Handlers
    const handleOrderAction = useCallback(async (orderId: string, action: 'cancel' | 'execute') => {
        const order = displayOrders.find(o => o.uuid === orderId);
        if (!order) return;

        switch (action) {
            case 'cancel':
                // Set loading state
                setCancelingOrders(prev => new Set(prev).add(orderId));

                // Optimistic update - mark as cancelled immediately
                const originalStatus = order.status;
                updateOrderStatus(orderId, 'cancelled');

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
                } catch (err) {
                    // Revert optimistic update on error
                    updateOrderStatus(orderId, originalStatus);
                    toast.error((err as Error).message || "Failed to cancel order.");
                } finally {
                    // Clear loading state
                    setCancelingOrders(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(orderId);
                        return newSet;
                    });
                    // Close confirmation dialog
                    setConfirmCancelOrderId(null);
                }
                break;

            case 'execute':
                // Set loading state
                setExecutingOrders(prev => new Set(prev).add(orderId));

                // Optimistic update - mark as filled immediately
                const originalStatusForExecute = order.status;
                updateOrderStatus(orderId, 'filled');

                toast.info("Submitting order for execution...", { duration: 5000 });

                try {
                    const res = await signedFetch(`/api/v1/orders/${orderId}/execute`, {
                        method: 'POST',
                        message: orderId
                    });
                    const j = await res.json();
                    if (!res.ok) throw new Error(j.error || 'Execution failed');

                    // Update with transaction ID if successful
                    updateOrderStatus(orderId, 'filled', j.txid);
                    toast.success(`Execution submitted: ${j.txid.substring(0, 10)}...`);
                } catch (err) {
                    // Revert optimistic update on error
                    updateOrderStatus(orderId, originalStatusForExecute);
                    toast.error((err as Error).message || "Failed to execute order.");
                } finally {
                    // Clear loading state
                    setExecutingOrders(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(orderId);
                        return newSet;
                    });
                }
                break;
        }
    }, [displayOrders, updateOrderStatus, setCancelingOrders, setExecutingOrders, setConfirmCancelOrderId]);

    const confirmCancelOrder = useCallback((orderId: string) => {
        setConfirmCancelOrderId(orderId);
    }, []);

    const cancelOrderAction = useCallback((orderId: string) => {
        setConfirmCancelOrderId(null);
        handleOrderAction(orderId, 'cancel');
    }, [handleOrderAction]);

    const executeOrderAction = useCallback((orderId: string) => {
        handleOrderAction(orderId, 'execute');
    }, [handleOrderAction]);

    const toggleOrderExpansion = useCallback((orderId: string) => {
        if (expandedOrderId === orderId) {
            // Collapsing - clear both expansion and highlight
            setExpandedOrderId(null);
            setHighlightedOrderId(null);
        } else {
            // Expanding - set both expansion and highlight
            setExpandedOrderId(orderId);
            setHighlightedOrderId(orderId);
        }
    }, [expandedOrderId]);

    const clearHighlightedOrder = useCallback(() => {
        setHighlightedOrderId(null);
        setExpandedOrderId(null);
    }, []);

    // Token selection handlers
    const openTokenSelection = useCallback((type: 'from' | 'to' | 'tradingPairBase' | 'tradingPairQuote', title: string) => {
        setTokenSelectionState({
            isOpen: true,
            selectionType: type,
            title
        });
    }, []);

    const closeTokenSelection = useCallback(() => {
        setTokenSelectionState(prev => ({
            ...prev,
            isOpen: false
        }));
    }, []);

    // Enhanced handlers that sync with swap context
    const handleSwitchTokensEnhanced = useCallback(() => {
        originalHandleSwitchTokensEnhanced();
        // The swap context will update, and our useEffect will sync the local state
    }, [originalHandleSwitchTokensEnhanced]);

    const handleCreateLimitOrder = useCallback(async () => {
        if (!selectedFromToken || !selectedToToken) {
            toast.error('Please select both tokens');
            return;
        }
        if (!displayAmount || Number(displayAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }
        if (!targetPrice || Number(targetPrice) <= 0) {
            toast.error('Please enter a valid target price');
            return;
        }

        // Initialize the single order creation dialog
        setSingleOrderCreationState({
            isOpen: true,
            phase: 'preview',
            order: {
                amount: displayAmount,
                targetPrice: targetPrice,
                conditionDir: conditionDir,
                status: 'pending'
            },
            errors: []
        });
    }, [displayAmount, targetPrice, conditionDir, selectedFromToken, selectedToToken, setSingleOrderCreationState]);

    // Placeholder implementations for complex handlers
    const handleCreateDcaOrder = useCallback(async () => {
        if (!selectedFromToken || !selectedToToken) {
            toast.error('Please select both tokens');
            return;
        }
        if (!dcaAmount || Number(dcaAmount) <= 0) {
            toast.error('Please enter a valid total amount');
            return;
        }
        if (!dcaDuration || Number(dcaDuration) <= 0) {
            toast.error('Please enter a valid number of occurrences');
            return;
        }

        // Calculate DCA parameters
        const getIntervalHours = () => {
            switch (dcaFrequency) {
                case 'hourly': return 1;
                case 'daily': return 24;
                case 'weekly': return 168;
                case 'monthly': return 720; // 30 days * 24 hours
                default: return 24;
            }
        };

        const intervalHours = getIntervalHours();
        const numberOfOrders = parseInt(dcaDuration); // dcaDuration now represents number of occurrences
        const amountPerOrder = parseFloat(dcaAmount) / numberOfOrders;

        // Create order objects for the DCA strategy
        const orders = [];
        const nowMs = dcaStartDate ? new Date(dcaStartDate).getTime() : Date.now();
        const intervalMs = intervalHours * 60 * 60 * 1000;

        for (let i = 0; i < numberOfOrders; i++) {
            const validFrom = new Date(nowMs + i * intervalMs).toISOString();
            const validTo = new Date(nowMs + (i + 1) * intervalMs).toISOString();

            orders.push({
                uuid: globalThis.crypto?.randomUUID() ?? `${Date.now()}-${i}`,
                amount: amountPerOrder,
                validFrom,
                validTo,
                status: 'pending' as const
            });
        }

        // Initialize the DCA creation dialog
        setDcaCreationState({
            isOpen: true,
            phase: 'preview',
            orders,
            currentOrderIndex: 0,
            totalOrders: numberOfOrders,
            amountPerOrder,
            intervalHours,
            startDate: dcaStartDate || new Date().toISOString(),
            errors: [],
            successCount: 0
        });
    }, [
        selectedFromToken,
        selectedToToken,
        dcaAmount,
        dcaDuration,
        dcaFrequency,
        dcaStartDate,
        setDcaCreationState
    ]);

    const handleCreateSandwichOrder = useCallback(async () => {
        if (!selectedFromToken || !selectedToToken) {
            toast.error('Please select both tokens');
            return;
        }
        if (!sandwichUsdAmount || Number(sandwichUsdAmount) <= 0) {
            toast.error('Please enter a valid USD amount');
            return;
        }
        if (!sandwichBuyPrice || !sandwichSellPrice) {
            toast.error('Please set both buy and sell prices');
            return;
        }

        const buyPrice = parseFloat(sandwichBuyPrice);
        const sellPrice = parseFloat(sandwichSellPrice);
        const usdAmount = parseFloat(sandwichUsdAmount);

        if (isNaN(buyPrice) || isNaN(sellPrice) || isNaN(usdAmount)) {
            toast.error('Invalid price or amount values');
            return;
        }

        if (sellPrice <= buyPrice) {
            toast.error('Sell price must be higher than buy price');
            return;
        }

        // Get token prices with fallback to base token for subnet tokens
        const getTokenPriceWithFallback = (token: TokenCacheData): number => {
            // First try to get the direct price
            let price = getUsdPrice(token.contractId);

            // If no price and it's a subnet token, try the base token price
            if (!price && token.type === 'SUBNET' && token.base) {
                price = getUsdPrice(token.base);
            }

            // If still no price, trigger historical price fetch and throw an error
            if (!price) {
                // Trigger historical price fetch for this token
                fetchHistoricalPrices([token.contractId]);
                throw new Error(`Price data not available for ${token.symbol}. Please wait a moment and try again.`);
            }

            return price;
        };

        let tokenAPrice: number;
        let tokenBPrice: number;

        try {
            tokenAPrice = getTokenPriceWithFallback(selectedFromToken);
            tokenBPrice = getTokenPriceWithFallback(selectedToToken);
        } catch (error) {
            toast.error((error as Error).message);
            return;
        }

        const tokenAAmountToSpend = usdAmount / tokenAPrice;
        const buyAmountMicro = Math.floor(tokenAAmountToSpend * (10 ** (selectedFromToken.decimals || 6))).toString();

        const tokenBAmountToSell = usdAmount / tokenBPrice;
        const sellAmountMicro = Math.floor(tokenBAmountToSell * (10 ** (selectedToToken.decimals || 6))).toString();

        // Initialize the sandwich creation dialog
        setSandwichCreationState({
            isOpen: true,
            phase: 'preview',
            orders: [
                {
                    type: 'buy',
                    price: sandwichSellPrice, // A→B (sell) uses high price
                    amount: buyAmountMicro,
                    status: 'pending'
                },
                {
                    type: 'sell',
                    price: sandwichBuyPrice, // B→A (buy) uses low price
                    amount: sellAmountMicro,
                    status: 'pending'
                }
            ],
            currentOrderIndex: 0,
            usdAmount: sandwichUsdAmount,
            buyPrice: sandwichBuyPrice,
            sellPrice: sandwichSellPrice,
            spread: sandwichSpread,
            errors: [],
            successCount: 0
        });
    }, [
        selectedFromToken,
        selectedToToken,
        sandwichUsdAmount,
        sandwichBuyPrice,
        sandwichSellPrice,
        sandwichSpread,
        setSandwichCreationState
    ]);

    const handleSubmitOrder = useCallback(async () => {
        // TODO: Implement submit order logic
        console.log('Submit order logic not yet implemented in context');
    }, []);

    const contextValue: ProModeContextType = {
        // UI State
        selectedOrderType,
        setSelectedOrderType,
        expandedOrderId,
        setExpandedOrderId,
        highlightedOrderId,
        setHighlightedOrderId,
        showAllOrders,
        setShowAllOrders,

        // Token Selection Dialog State
        tokenSelectionState,
        openTokenSelection,
        closeTokenSelection,

        // Trading Pair State
        tradingPairBase,
        setTradingPairBase,
        tradingPairQuote,
        setTradingPairQuote,
        lockTradingPairToSwapTokens,
        setLockTradingPairToSwapTokens,

        // Order Form State
        displayAmount,
        setDisplayAmount,
        targetPrice,
        setTargetPrice,
        conditionDir,
        setConditionDir,
        currentPrice,
        setCurrentPrice,

        // DCA State
        dcaAmount,
        setDcaAmount,
        dcaFrequency,
        setDcaFrequency,
        dcaDuration,
        setDcaDuration,
        dcaStartDate,
        setDcaStartDate,
        dcaCreationState,
        setDcaCreationState,

        // Single Order Creation State
        singleOrderCreationState,
        setSingleOrderCreationState,

        // Sandwich Creation State
        sandwichCreationState,
        setSandwichCreationState,

        // Sandwich State
        sandwichBuyPrice,
        setSandwichBuyPrice,
        sandwichSellPrice,
        setSandwichSellPrice,
        sandwichSpread,
        setSandwichSpread,
        sandwichUsdAmount,
        setSandwichUsdAmount,

        // Orders Data
        displayOrders,
        pairFilteredOrders,
        swapFilteredOrders,
        filteredOrders,

        // Loading States
        isLoadingOrders,
        isCreatingOrder,
        isCreatingSandwichOrder,
        setIsCreatingSandwichOrder,
        ordersError,

        // Computed Values
        shouldShowSplitSections,
        tradingPairMatchesSwapTokens,

        // Handlers
        handleSwitchTokensEnhanced,
        handleCreateLimitOrder,
        handleCreateDcaOrder,
        handleCreateSandwichOrder,
        handleSubmitOrder,
        handleOrderAction,
        confirmCancelOrder,
        cancelOrderAction,
        executeOrderAction,
        toggleOrderExpansion,
        clearHighlightedOrder,
        fetchOrders,

        // Individual Order Management
        updateOrderById,
        updateOrderStatus,
        addNewOrder,
        removeOrderById,

        // Order Action State
        cancelingOrders,
        executingOrders,
        confirmCancelOrderId,
        setConfirmCancelOrderId,

        // Utility Functions
        formatTokenAmount,
        formatCompactNumber,
        formatCompactPrice,
        formatRelativeTime,
        getTokenPrice,

        // Input Handlers
        handleAmountChange,
        handlePriceChange,
        handleDcaAmountChange,
        handleSandwichBuyPriceChange,
        handleSandwichSellPriceChange,
        handleSandwichSpreadChange,
        handleSandwichUsdAmountChange,

        // Loading States (additional)
        isSubmitting: isCreatingOrder || isCreatingSandwichOrder,
    };

    return (
        <ProModeContext.Provider value={contextValue}>
            {children}
        </ProModeContext.Provider>
    );
} 