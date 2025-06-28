"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSwapTokens } from './swap-tokens-context';
import { useWallet } from './wallet-context';
import type { LimitOrder } from '../lib/orders/types';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { signedFetch } from 'blaze-sdk';
import { useBlaze } from 'blaze-sdk/realtime';
import { toast } from 'sonner';
import { formatUsd } from '@/lib/swap-utils';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { classifyOrderTypes, groupOrdersIntoStrategies, type ClassifiedOrder } from '@/lib/orders/classification';

// Use the ClassifiedOrder type from the shared utility
export type DisplayOrder = ClassifiedOrder;

export type OrderType = 'single' | 'dca' | 'sandwich' | 'perpetual';

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

// Perpetual order state interface
interface PerpetualOrderState {
    direction: 'long' | 'short';
    leverage: number; // 2x, 5x, 10x, 20x, etc.
    positionSize: string; // USD amount
    entryPrice: string;
    stopLoss: string;
    takeProfit: string;
    marginAmount: string; // Calculated based on leverage
    liquidationPrice: string; // Calculated
}

// Perpetual creation state interface
interface PerpetualCreationState {
    isOpen: boolean;
    phase: 'preview' | 'signing' | 'complete';
    order: (PerpetualOrderState & {
        status: 'pending' | 'signing' | 'success' | 'error';
        uuid?: string;
        error?: string;
    }) | null;
    errors: string[];
    previewMode: true; // Always true for now
}

// Perpetual chart interaction state
interface PerpetualChartState {
    selectionStep: 'entry' | 'stopOrProfit' | 'remaining' | 'complete';
    entryPrice: string;
    stopLossPrice: string;
    takeProfitPrice: string;
    hasStopLoss: boolean;
    hasTakeProfit: boolean;
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
    chartType: 'line' | 'candles';
    setChartType: (type: 'line' | 'candles') => void;
    candleInterval: string;
    setCandleInterval: (interval: string) => void;

    // Sidebar State
    leftSidebarCollapsed: boolean;
    setLeftSidebarCollapsed: (collapsed: boolean) => void;
    rightSidebarCollapsed: boolean;
    setRightSidebarCollapsed: (collapsed: boolean) => void;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;

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

    // Perpetual Creation State
    perpetualCreationState: PerpetualCreationState;
    setPerpetualCreationState: React.Dispatch<React.SetStateAction<PerpetualCreationState>>;

    // Perpetual Chart Interaction State
    perpetualChartState: PerpetualChartState;
    setPerpetualChartState: React.Dispatch<React.SetStateAction<PerpetualChartState>>;
    handlePerpetualChartClick: (price: number) => void;
    resetPerpetualChart: () => void;

    // Sandwich State
    sandwichBuyPrice: string;
    setSandwichBuyPrice: (price: string) => void;
    sandwichSellPrice: string;
    setSandwichSellPrice: (price: string) => void;
    sandwichSpread: string;
    setSandwichSpread: (spread: string) => void;
    sandwichUsdAmount: string;
    setSandwichUsdAmount: (amount: string) => void;

    // Perpetual State
    perpetualDirection: 'long' | 'short';
    setPerpetualDirection: (direction: 'long' | 'short') => void;
    perpetualLeverage: number;
    setPerpetualLeverage: (leverage: number) => void;
    perpetualPositionSize: string;
    setPerpetualPositionSize: (size: string) => void;
    perpetualEntryPrice: string;
    setPerpetualEntryPrice: (price: string) => void;
    perpetualStopLoss: string;
    setPerpetualStopLoss: (price: string) => void;
    perpetualTakeProfit: string;
    setPerpetualTakeProfit: (price: string) => void;
    autoTrackEntryPrice: boolean;
    setAutoTrackEntryPrice: (track: boolean) => void;

    // P2P Funding State
    fundingMode: 'platform' | 'p2p';
    setFundingMode: (mode: 'platform' | 'p2p') => void;
    fundingFeeRate: string;
    setFundingFeeRate: (rate: string) => void;
    fundingExpiry: string;
    setFundingExpiry: (expiry: string) => void;

    // Real-time calculated values for perpetual
    perpetualMarginRequired: number;
    setPerpetualMarginRequired: (margin: number) => void;
    perpetualLiquidationPrice: number;
    setPerpetualLiquidationPrice: (price: number) => void;
    perpetualCurrentPnL: { pnl: number; pnlPercentage: number };
    setPerpetualCurrentPnL: (pnl: { pnl: number; pnlPercentage: number }) => void;

    // Orders Data
    displayOrders: DisplayOrder[];
    pairFilteredOrders: DisplayOrder[];
    swapFilteredOrders: DisplayOrder[];
    filteredOrders: DisplayOrder[];
    recentlyUpdatedOrders: Set<string>;

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
    handleCreatePerpetualOrder: () => Promise<void>;
    handleSubmitOrder: () => Promise<void>;
    handleOrderAction: (orderId: string, action: 'cancel' | 'execute') => Promise<void>;
    confirmCancelOrder: (orderId: string) => void;
    cancelOrderAction: (orderId: string) => void;
    executeOrderAction: (orderId: string) => void;
    toggleOrderExpansion: (orderId: string) => void;
    clearHighlightedOrder: () => void;
    fetchOrders: () => Promise<void>;
    refetchPerpetualPositions: () => Promise<void>;
    setPerpPositionsRefetchCallback: (callback: (() => Promise<void>) | null) => void;

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

    // Real-time Blaze Data Functions
    getRealTimePrice: (contractId: string) => number | null;
    getRealTimeBalance: (contractId: string) => string | null;
    isPricesConnected: boolean;

    // Perpetual Calculation Utilities (FOR UI PREVIEW ONLY - backend recalculates for security)
    calculateMarginRequired: (positionSize: string | number, leverage: number) => number;
    calculateLiquidationPrice: (entryPrice: string | number, leverage: number, direction: 'long' | 'short') => number;
    calculatePnL: (entryPrice: string | number, currentPrice: string | number, positionSize: string | number, direction: 'long' | 'short') => { pnl: number; pnlPercentage: number };
    validatePerpetualOrder: (order: Partial<PerpetualOrderState>) => string[];

    // Input Handlers
    handleAmountChange: (value: string) => void;
    handlePriceChange: (value: string) => void;
    handleDcaAmountChange: (value: string) => void;
    handleSandwichBuyPriceChange: (value: string) => void;
    handleSandwichSellPriceChange: (value: string) => void;
    handleSandwichSpreadChange: (value: string) => void;
    handleSandwichUsdAmountChange: (value: string) => void;
    handlePerpetualPositionSizeChange: (value: string) => void;
    handlePerpetualEntryPriceChange: (value: string) => void;
    handlePerpetualStopLossChange: (value: string) => void;
    handlePerpetualTakeProfitChange: (value: string) => void;

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
        conditionToken,
        baseToken,
        conditionDir: swapConditionDir,
        handleSwitchTokensEnhanced
    } = useSwapTokens();

    const {
        isCreatingOrder,
    } = useRouterTrading();

    const { address, connected } = useWallet();

    // Real-time price and balance data from Blaze
    const {
        prices: blazePrices,
        balances: blazeBalances,
        isConnected: isPricesConnected,
        getPrice,
        getBalance
    } = useBlaze(address ? { userId: address } : undefined);

    // UI State
    const [selectedOrderType, setSelectedOrderType] = useState<OrderType>('single');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [showAllOrders, setShowAllOrders] = useState(false);
    const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
    const [chartType, setChartType] = useState<'line' | 'candles'>('line');
    const [candleInterval, setCandleInterval] = useState<string>('4h');

    // Sidebar State - Start collapsed on mobile
    const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 1024; // Collapse on screens smaller than lg (1024px)
        }
        return false;
    });
    const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 1280; // Collapse on screens smaller than xl (1280px)
        }
        return false;
    });

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

    // Ref for current price to avoid context re-renders
    const currentPriceRef = useRef<number | null>(null);

    // Debounced current price updates to reduce context re-renders
    const updateCurrentPriceDebounced = useCallback((newPrice: number) => {
        // Only update state if price changed significantly (>0.01%)
        if (!currentPrice || Math.abs((newPrice - currentPrice) / currentPrice) > 0.0001) {
            setCurrentPrice(newPrice);
        }
        // Always update ref for immediate access
        currentPriceRef.current = newPrice;
    }, [currentPrice]);

    // Update current price from real-time Blaze data based on trading pair
    useEffect(() => {
        if (!tradingPairBase || !isPricesConnected) {
            return;
        }

        // Debounce price updates to avoid excessive re-renders
        const timeoutId = setTimeout(() => {
            const price = getPrice(tradingPairBase.contractId);
            if (price && price > 0) {
                updateCurrentPriceDebounced(price);
                console.log(`🔥 Real-time price update for ${tradingPairBase.symbol}: $${price.toFixed(6)}`);
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [tradingPairBase, blazePrices, isPricesConnected, getPrice, updateCurrentPriceDebounced]);

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
    const [recentlyUpdatedOrders, setRecentlyUpdatedOrders] = useState<Set<string>>(new Set());

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

    // Perpetual creation state for enhanced UX
    const [perpetualCreationState, setPerpetualCreationState] = useState<PerpetualCreationState>({
        isOpen: false,
        phase: 'preview',
        order: null,
        errors: [],
        previewMode: true
    });

    // Perpetual state for enhanced UX
    const [perpetualDirection, setPerpetualDirection] = useState<'long' | 'short'>('long');
    const [perpetualLeverage, setPerpetualLeverage] = useState(2);
    const [perpetualPositionSize, setPerpetualPositionSize] = useState('');
    const [perpetualEntryPrice, setPerpetualEntryPrice] = useState('');
    const [perpetualStopLoss, setPerpetualStopLoss] = useState('');
    const [perpetualTakeProfit, setPerpetualTakeProfit] = useState('');
    const [autoTrackEntryPrice, setAutoTrackEntryPrice] = useState(true);

    // P2P Funding state
    const [fundingMode, setFundingMode] = useState<'platform' | 'p2p'>('platform');
    const [fundingFeeRate, setFundingFeeRate] = useState('3.5');
    const [fundingExpiry, setFundingExpiry] = useState('24h');

    // Real-time calculated values for perpetual
    const [perpetualMarginRequired, setPerpetualMarginRequired] = useState(0);
    const [perpetualLiquidationPrice, setPerpetualLiquidationPrice] = useState(0);
    const [perpetualCurrentPnL, setPerpetualCurrentPnL] = useState({ pnl: 0, pnlPercentage: 0 });

    // Perpetual positions refetch callback
    const [perpPositionsRefetchCallback, setPerpPositionsRefetchCallback] = useState<(() => Promise<void>) | null>(null);

    // Perpetual Chart Interaction State
    const [perpetualChartState, setPerpetualChartState] = useState<PerpetualChartState>({
        selectionStep: 'entry',
        entryPrice: '',
        stopLossPrice: '',
        takeProfitPrice: '',
        hasStopLoss: false,
        hasTakeProfit: false
    });

    // Sync with swap context when entering pro mode (removed automatic target price setting)
    useEffect(() => {
        setDisplayAmount(swapDisplayAmount);
        // Removed: setTargetPrice(swapTargetPrice); - Users now set target price via chart interaction
        setConditionDir(swapConditionDir);
    }, [swapDisplayAmount, swapConditionDir]);

    // Auto-set trading pair when entering pro mode
    useEffect(() => {
        // For sandwich mode: always use from/to tokens for trading pair
        if (selectedOrderType === 'sandwich' && selectedFromToken && selectedToToken) {
            // Set trading pair to match the selected from/to tokens
            setTradingPairBase(selectedToToken);    // Use 'to' token as base (what we're monitoring)
            setTradingPairQuote(selectedFromToken); // Use 'from' token as quote (denomination)
            console.log('🥪 Sandwich mode: Set trading pair to', selectedToToken.symbol, '/', selectedFromToken.symbol);
            return;
        }

        // For other order types: use condition token and base token logic
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
    }, [selectedOrderType, conditionToken, baseToken, selectedFromToken, selectedToToken, tradingPairBase, tradingPairQuote]);

    // Handle responsive sidebar behavior
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;

            // Auto-collapse left sidebar on tablets and smaller
            if (width < 1024 && !leftSidebarCollapsed) {
                setLeftSidebarCollapsed(true);
            }

            // Auto-collapse right sidebar on smaller screens
            if (width < 1280 && !rightSidebarCollapsed) {
                setRightSidebarCollapsed(true);
            }

            // Auto-expand on large screens if user hasn't manually collapsed
            if (width >= 1280) {
                // Only auto-expand if user hasn't manually collapsed recently
                // This prevents annoying auto-expand behavior
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [leftSidebarCollapsed, rightSidebarCollapsed]);

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
                const enrichedOrdersForClassification: (LimitOrder & { inputTokenMeta: TokenCacheData; outputTokenMeta: TokenCacheData })[] = [];
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
                    let conditionMeta = tokenMetaCache.get(order.conditionToken || '');
                    if (!conditionMeta && order.conditionToken) {
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

                    enrichedOrdersForClassification.push({
                        ...order,
                        inputTokenMeta: inputMeta,
                        outputTokenMeta: outputMeta
                    });
                }

                // Classify orders using the shared utility
                const { classifiedOrders } = classifyOrderTypes(enrichedOrdersForClassification);
                
                // Add condition token and base asset metadata to classified orders
                const enrichedOrders: DisplayOrder[] = classifiedOrders.map(order => ({
                    ...order,
                    conditionTokenMeta: tokenMetaCache.get(order.conditionToken || '')!,
                    baseAssetMeta: order.baseAsset && order.baseAsset !== 'USD' ? tokenMetaCache.get(order.baseAsset) || null : null
                }));

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

    // Order status polling for real-time updates
    useEffect(() => {
        if (!connected || !address) return;

        // Function to check for order status changes and notify user
        const checkOrderStatusUpdates = async () => {
            try {
                const res = await fetch(`/api/v1/orders?owner=${address}`);
                const j = await res.json();

                if (res.ok) {
                    const newRawOrders = j.data as LimitOrder[];

                    // Compare with current orders to detect status changes
                    const statusChanges: Array<{ order: LimitOrder, oldStatus: string, newStatus: string }> = [];

                    newRawOrders.forEach(newOrder => {
                        const currentOrder = displayOrders.find(o => o.uuid === newOrder.uuid);
                        if (currentOrder && currentOrder.status !== newOrder.status) {
                            statusChanges.push({
                                order: newOrder,
                                oldStatus: currentOrder.status,
                                newStatus: newOrder.status
                            });
                        }
                    });

                    // Show notifications for status changes
                    statusChanges.forEach(change => {
                        const orderDisplay = displayOrders.find(o => o.uuid === change.order.uuid);
                        if (!orderDisplay) return;

                        const fromSymbol = orderDisplay.inputTokenMeta?.symbol || 'Token';
                        const toSymbol = orderDisplay.outputTokenMeta?.symbol || 'Token';

                        if (change.newStatus === 'filled') {
                            toast.success(`Order Filled: ${fromSymbol} → ${toSymbol}`, {
                                description: (
                                    <span className="text-green-800 font-medium">
                                        Your limit order has been executed successfully
                                    </span>
                                ),
                                duration: 8000,
                                className: "border-green-200 bg-green-50 text-green-900",
                            });
                        } else if (change.newStatus === 'cancelled') {
                            toast.info(`Order Cancelled: ${fromSymbol} → ${toSymbol}`, {
                                description: `Your order has been cancelled.`,
                                duration: 5000,
                            });
                        }
                    });

                    // Update orders if there are changes
                    if (statusChanges.length > 0) {
                        console.log(`📊 Order status updates detected:`, statusChanges.map(c => ({
                            orderId: c.order.uuid.slice(0, 8),
                            change: `${c.oldStatus} → ${c.newStatus}`
                        })));

                        // Mark orders as recently updated for visual effects
                        const updatedOrderIds = statusChanges.map(c => c.order.uuid);
                        setRecentlyUpdatedOrders(new Set(updatedOrderIds));

                        // Clear the recently updated status after 10 seconds
                        setTimeout(() => {
                            setRecentlyUpdatedOrders(prev => {
                                const newSet = new Set(prev);
                                updatedOrderIds.forEach(id => newSet.delete(id));
                                return newSet;
                            });
                        }, 10000);

                        // Refresh the full order list to get updated data with metadata
                        await fetchOrders();
                    }
                }
            } catch (error) {
                // Silently handle polling errors to avoid spamming user
                console.warn('Order status polling error:', error);
            }
        };

        // Initial check
        checkOrderStatusUpdates();

        // Poll every 30 seconds for order status updates  
        const pollInterval = setInterval(checkOrderStatusUpdates, 30000);

        return () => clearInterval(pollInterval);
    }, [connected, address, displayOrders, fetchOrders]);

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
        const price = getPrice(token.contractId);
        return price ? formatUsd(price) : null;
    }, [getPrice, formatUsd]);

    // Perpetual Calculation Utilities
    const calculateMarginRequired = useCallback((positionSize: string | number, leverage: number): number => {
        // NOTE: This is for UI preview only. Backend recalculates for security.
        const size = Number(positionSize);
        if (isNaN(size) || size <= 0 || leverage <= 0) return 0;
        return size / leverage;
    }, []);

    const calculateLiquidationPrice = useCallback((
        entryPrice: string | number,
        leverage: number,
        direction: 'long' | 'short'
    ): number => {
        // NOTE: This is for UI preview only. Backend recalculates for security.
        const entry = Number(entryPrice);
        if (isNaN(entry) || entry <= 0 || leverage <= 0) return 0;

        // Simplified liquidation calculation
        // For long: liquidationPrice = entryPrice * (1 - 1/leverage * 0.9) // 90% of max loss
        // For short: liquidationPrice = entryPrice * (1 + 1/leverage * 0.9)
        const maxLossRatio = (1 / leverage) * 0.9; // 90% of theoretical max to account for fees

        if (direction === 'long') {
            return entry * (1 - maxLossRatio);
        } else {
            return entry * (1 + maxLossRatio);
        }
    }, []);

    const calculatePnL = useCallback((
        entryPrice: string | number,
        currentPrice: string | number,
        positionSize: string | number,
        direction: 'long' | 'short'
    ): { pnl: number; pnlPercentage: number } => {
        const entry = Number(entryPrice);
        const current = Number(currentPrice);
        const size = Number(positionSize);

        if (isNaN(entry) || isNaN(current) || isNaN(size) || entry <= 0 || current <= 0 || size <= 0) {
            return { pnl: 0, pnlPercentage: 0 };
        }

        let pnl: number;
        if (direction === 'long') {
            // Long: profit when price goes up
            pnl = ((current - entry) / entry) * size;
        } else {
            // Short: profit when price goes down  
            pnl = ((entry - current) / entry) * size;
        }

        const pnlPercentage = (pnl / size) * 100;

        return { pnl, pnlPercentage };
    }, []);

    // Get real-time price for any token from Blaze feed
    const getRealTimePrice = useCallback((contractId: string): number | null => {
        if (!isPricesConnected) return null;
        return getPrice(contractId) || null;
    }, [isPricesConnected, getPrice]);

    // Get real-time balance for any token from Blaze feed
    const getRealTimeBalance = useCallback((contractId: string): string | null => {
        if (!address || !isPricesConnected) return null;
        const balance = getBalance(address, contractId);
        return balance ? balance.balance : null;
    }, [address, isPricesConnected, getBalance]);

    const validatePerpetualOrder = useCallback((order: Partial<PerpetualOrderState>): string[] => {
        const errors: string[] = [];

        if (!order.direction) {
            errors.push('Direction is required');
        }

        if (!order.leverage || order.leverage < 1 || order.leverage > 100) {
            errors.push('Leverage must be between 1x and 100x');
        }

        if (!order.positionSize || Number(order.positionSize) <= 0) {
            errors.push('Position size must be greater than 0');
        }

        if (!order.entryPrice || Number(order.entryPrice) <= 0) {
            errors.push('Entry price must be greater than 0');
        }

        // Validate stop loss if provided
        if (order.stopLoss && Number(order.stopLoss) > 0) {
            const entryPrice = Number(order.entryPrice);
            const stopLoss = Number(order.stopLoss);

            if (order.direction === 'long' && stopLoss >= entryPrice) {
                errors.push('For long positions, stop loss must be below entry price');
            } else if (order.direction === 'short' && stopLoss <= entryPrice) {
                errors.push('For short positions, stop loss must be above entry price');
            }
        }

        // Validate take profit if provided
        if (order.takeProfit && Number(order.takeProfit) > 0) {
            const entryPrice = Number(order.entryPrice);
            const takeProfit = Number(order.takeProfit);

            if (order.direction === 'long' && takeProfit <= entryPrice) {
                errors.push('For long positions, take profit must be above entry price');
            } else if (order.direction === 'short' && takeProfit >= entryPrice) {
                errors.push('For short positions, take profit must be below entry price');
            }
        }

        return errors;
    }, []);

    // Auto-track entry price with current market price
    useEffect(() => {
        if (autoTrackEntryPrice && currentPrice && currentPrice > 0) {
            const formattedPrice = currentPrice.toPrecision(9);
            setPerpetualEntryPrice(formattedPrice);
            console.log(`📍 Auto-tracking entry price: ${formattedPrice}`);
        }
    }, [autoTrackEntryPrice, currentPrice, setPerpetualEntryPrice]);

    // Real-time perpetual calculations
    useEffect(() => {
        if (perpetualPositionSize && perpetualEntryPrice && perpetualLeverage > 0) {
            // Calculate margin required
            const margin = calculateMarginRequired(perpetualPositionSize, perpetualLeverage);
            setPerpetualMarginRequired(margin);

            // Calculate liquidation price
            const liquidation = calculateLiquidationPrice(perpetualEntryPrice, perpetualLeverage, perpetualDirection);
            setPerpetualLiquidationPrice(liquidation);

            // Calculate P&L if we have a current price (including from random noise simulation)
            if (currentPrice && currentPrice > 0) {
                const pnlResult = calculatePnL(perpetualEntryPrice, currentPrice, perpetualPositionSize, perpetualDirection);
                setPerpetualCurrentPnL(pnlResult);
                console.log(`🎯 Perpetual P&L updated in PREVIEW: ${pnlResult.pnl >= 0 ? '+' : ''}$${pnlResult.pnl.toFixed(2)} (${pnlResult.pnlPercentage >= 0 ? '+' : ''}${pnlResult.pnlPercentage.toFixed(2)}%) | Entry: $${Number(perpetualEntryPrice).toFixed(4)} | Current: $${currentPrice.toFixed(4)}`);
            } else {
                setPerpetualCurrentPnL({ pnl: 0, pnlPercentage: 0 });
                console.log(`🎯 Perpetual P&L reset - no current price available`);
            }
        } else {
            // Reset calculations if inputs are invalid
            setPerpetualMarginRequired(0);
            setPerpetualLiquidationPrice(0);
            setPerpetualCurrentPnL({ pnl: 0, pnlPercentage: 0 });
        }
    }, [
        perpetualPositionSize,
        perpetualEntryPrice,
        perpetualLeverage,
        perpetualDirection,
        currentPrice,
        selectedFromToken,
        calculateMarginRequired,
        calculateLiquidationPrice,
        calculatePnL
    ]);

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

    const handlePerpetualPositionSizeChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setPerpetualPositionSize(value);
        }
    }, []);

    const handlePerpetualEntryPriceChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setPerpetualEntryPrice(value);
            // Turn off auto-tracking when user manually changes the price
            if (autoTrackEntryPrice) {
                setAutoTrackEntryPrice(false);
                console.log('📍 Auto-tracking disabled - user manually set entry price');
            }
        }
    }, [autoTrackEntryPrice, setAutoTrackEntryPrice]);

    const handlePerpetualStopLossChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setPerpetualStopLoss(value);
        }
    }, []);

    const handlePerpetualTakeProfitChange = useCallback((value: string) => {
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            setPerpetualTakeProfit(value);
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

                // Optimistic update - mark as broadcasted immediately
                const originalStatusForExecute = order.status;
                updateOrderStatus(orderId, 'broadcasted');

                toast.info("Submitting order for execution...", { duration: 5000 });

                try {
                    const res = await signedFetch(`/api/v1/orders/${orderId}/execute`, {
                        method: 'POST',
                        message: orderId
                    });
                    const j = await res.json();
                    if (!res.ok) throw new Error(j.error || 'Execution failed');

                    // Update with transaction ID if successful
                    updateOrderStatus(orderId, 'broadcasted', j.txid);
                    toast.success(
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                                <div>
                                    <div className="font-semibold text-foreground text-sm">Order Executed Successfully</div>
                                    <div className="text-muted-foreground text-xs mt-0.5">
                                        Your order has been executed and the transaction was submitted to the blockchain.
                                    </div>
                                </div>
                                <a
                                    href={`https://explorer.hiro.so/txid/${j.txid}?chain=mainnet`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/30 px-3 py-1.5 text-xs rounded-xl font-medium transition-all duration-200 w-fit"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View on Hiro Explorer
                                </a>
                            </div>
                        </div>,
                        { duration: 10000 }
                    );
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

    // Sidebar toggle handlers
    const toggleLeftSidebar = useCallback(() => {
        setLeftSidebarCollapsed(prev => !prev);
    }, []);

    const toggleRightSidebar = useCallback(() => {
        setRightSidebarCollapsed(prev => !prev);
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
                case '1minute': return 1 / 60; // 1 minute = 0.0167 hours
                case '5minutes': return 5 / 60; // 5 minutes = 0.0833 hours
                case '15minutes': return 15 / 60; // 15 minutes = 0.25 hours
                case '30minutes': return 30 / 60; // 30 minutes = 0.5 hours
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
            let price = getPrice(token.contractId);

            // If no price and it's a subnet token, try the base token price
            if (!price && token.type === 'SUBNET' && token.base) {
                price = getPrice(token.base);
            }

            // If still no price, throw an error
            if (!price) {
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

    const handleCreatePerpetualOrder = useCallback(async () => {
        if (!selectedFromToken || !selectedToToken) {
            toast.error('Please select both tokens');
            return;
        }
        if (!perpetualPositionSize || Number(perpetualPositionSize) <= 0) {
            toast.error('Please enter a valid position size');
            return;
        }
        if (!perpetualEntryPrice || Number(perpetualEntryPrice) <= 0) {
            toast.error('Please enter a valid entry price');
            return;
        }

        // Create a draft order with current values
        const draftOrder: PerpetualOrderState = {
            direction: perpetualDirection,
            leverage: perpetualLeverage,
            positionSize: perpetualPositionSize,
            entryPrice: perpetualEntryPrice,
            stopLoss: perpetualStopLoss,
            takeProfit: perpetualTakeProfit,
            marginAmount: '', // Will be calculated
            liquidationPrice: '', // Will be calculated
        };

        // Validate the order
        const validationErrors = validatePerpetualOrder(draftOrder);
        if (validationErrors.length > 0) {
            toast.error(validationErrors[0]); // Show first error
            return;
        }

        // Calculate derived values
        const marginRequired = calculateMarginRequired(perpetualPositionSize, perpetualLeverage);
        const liquidationPrice = calculateLiquidationPrice(perpetualEntryPrice, perpetualLeverage, perpetualDirection);

        // Update order with calculations
        const calculatedOrder = {
            ...draftOrder,
            marginAmount: marginRequired.toString(),
            liquidationPrice: liquidationPrice.toString(),
        };

        if (fundingMode === 'p2p') {
            // P2P Mode: Create funding request
            if (!address) {
                toast.error('Please connect your wallet for P2P funding');
                return;
            }

            // Validate P2P specific fields
            if (!fundingFeeRate || parseFloat(fundingFeeRate) <= 0) {
                toast.error('Please enter a valid funding fee rate');
                return;
            }

            try {
                // Calculate expiry timestamp
                const now = Date.now();
                let expiryMs: number;
                switch (fundingExpiry) {
                    case '1h': expiryMs = 60 * 60 * 1000; break;
                    case '6h': expiryMs = 6 * 60 * 60 * 1000; break;
                    case '24h': expiryMs = 24 * 60 * 60 * 1000; break;
                    case '7d': expiryMs = 7 * 24 * 60 * 60 * 1000; break;
                    default: expiryMs = 24 * 60 * 60 * 1000; // Default 24h
                }
                const expiresAt = now + expiryMs;

                // Generate proper UUIDs
                const perpUuid = crypto.randomUUID();

                // Preview mode: Use mock signature (verification disabled on API)
                const mockTraderMarginIntent = `preview-margin-intent-${perpUuid}`;

                // Calculate max collateral needed (position size - trader margin)
                const positionSizeNum = parseFloat(perpetualPositionSize);
                const maxCollateralNeeded = Math.max(0, positionSizeNum - marginRequired);

                const fundingRequestData = {
                    perpUuid: perpUuid,
                    traderId: address,
                    traderMarginIntent: mockTraderMarginIntent,

                    // Position details
                    direction: perpetualDirection,
                    leverage: perpetualLeverage,
                    positionSize: perpetualPositionSize.replace(/[^0-9.]/g, ''), // Remove any non-numeric chars
                    entryPrice: perpetualEntryPrice.replace(/[^0-9.]/g, ''), // Clean numeric string
                    liquidationPrice: liquidationPrice.toFixed(6), // Ensure proper decimal format

                    // Economic terms
                    traderMargin: marginRequired.toFixed(6),
                    maxCollateralNeeded: maxCollateralNeeded.toFixed(6),
                    fundingFeeRate: fundingFeeRate.includes('%') ? fundingFeeRate : `${fundingFeeRate}%`,

                    // Token contracts
                    baseToken: selectedFromToken.contractId,
                    quoteToken: selectedToToken.contractId,
                    marginToken: selectedToToken.contractId, // Usually quote token

                    // Timing
                    expiresAt: expiresAt,
                };

                console.log('Creating P2P funding request:', fundingRequestData);

                // Create funding request via API
                const response = await fetch('/api/v1/perps/funding-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fundingRequestData),
                });

                const result = await response.json();

                if (result.success) {
                    toast.success('P2P funding request created! Redirecting to marketplace...');

                    // Redirect to shop to show the funding request
                    setTimeout(() => {
                        window.location.href = '/shop';
                    }, 1500);
                } else {
                    throw new Error(result.error || 'Failed to create funding request');
                }

            } catch (error) {
                console.error('Error creating P2P funding request:', error);
                toast.error(`Failed to create funding request: ${(error as Error).message}`);
            }
        } else {
            // Platform Mode: Use existing dialog
            setPerpetualCreationState({
                isOpen: true,
                phase: 'preview',
                order: {
                    ...calculatedOrder,
                    status: 'pending'
                },
                errors: validationErrors,
                previewMode: true
            });
        }
    }, [
        selectedFromToken,
        selectedToToken,
        perpetualPositionSize,
        perpetualEntryPrice,
        perpetualDirection,
        perpetualLeverage,
        perpetualStopLoss,
        perpetualTakeProfit,
        fundingMode,
        fundingFeeRate,
        fundingExpiry,
        address,
        validatePerpetualOrder,
        calculateMarginRequired,
        calculateLiquidationPrice,
        setPerpetualCreationState
    ]);

    const handleSubmitOrder = useCallback(async () => {
        // TODO: Implement submit order logic
        console.log('Submit order logic not yet implemented in context');
    }, []);

    // Perpetual Chart Interaction Handlers
    const handlePerpetualChartClick = useCallback((price: number) => {
        const priceStr = price.toPrecision(9);

        setPerpetualChartState(prevState => {
            switch (prevState.selectionStep) {
                case 'entry':
                    // First click: Set entry price
                    handlePerpetualEntryPriceChange(priceStr);
                    return {
                        ...prevState,
                        selectionStep: 'stopOrProfit',
                        entryPrice: priceStr
                    };

                case 'stopOrProfit':
                    // Second click: Determine if it's stop loss or take profit based on direction and price
                    const entryPrice = parseFloat(prevState.entryPrice);
                    const isProfitDirection = (perpetualDirection === 'long' && price > entryPrice) ||
                        (perpetualDirection === 'short' && price < entryPrice);

                    if (isProfitDirection) {
                        // This is a take profit level
                        handlePerpetualTakeProfitChange(priceStr);
                        return {
                            ...prevState,
                            selectionStep: prevState.hasStopLoss ? 'complete' : 'remaining',
                            takeProfitPrice: priceStr,
                            hasTakeProfit: true
                        };
                    } else {
                        // This is a stop loss level
                        handlePerpetualStopLossChange(priceStr);
                        return {
                            ...prevState,
                            selectionStep: prevState.hasTakeProfit ? 'complete' : 'remaining',
                            stopLossPrice: priceStr,
                            hasStopLoss: true
                        };
                    }

                case 'remaining':
                    // Third click: Set the remaining level (stop loss or take profit)
                    const entryPriceRemaining = parseFloat(prevState.entryPrice);
                    const isProfitDirectionRemaining = (perpetualDirection === 'long' && price > entryPriceRemaining) ||
                        (perpetualDirection === 'short' && price < entryPriceRemaining);

                    if (isProfitDirectionRemaining && !prevState.hasTakeProfit) {
                        // Set take profit
                        handlePerpetualTakeProfitChange(priceStr);
                        return {
                            ...prevState,
                            selectionStep: 'complete',
                            takeProfitPrice: priceStr,
                            hasTakeProfit: true
                        };
                    } else if (!isProfitDirectionRemaining && !prevState.hasStopLoss) {
                        // Set stop loss
                        handlePerpetualStopLossChange(priceStr);
                        return {
                            ...prevState,
                            selectionStep: 'complete',
                            stopLossPrice: priceStr,
                            hasStopLoss: true
                        };
                    }
                    return prevState;

                case 'complete':
                    // Reset and start over
                    handlePerpetualEntryPriceChange(priceStr);
                    return {
                        selectionStep: 'stopOrProfit',
                        entryPrice: priceStr,
                        stopLossPrice: '',
                        takeProfitPrice: '',
                        hasStopLoss: false,
                        hasTakeProfit: false
                    };

                default:
                    return prevState;
            }
        });
    }, [perpetualDirection, handlePerpetualEntryPriceChange, handlePerpetualStopLossChange, handlePerpetualTakeProfitChange]);

    const resetPerpetualChart = useCallback(() => {
        setPerpetualChartState({
            selectionStep: 'entry',
            entryPrice: '',
            stopLossPrice: '',
            takeProfitPrice: '',
            hasStopLoss: false,
            hasTakeProfit: false
        });
        // Also clear the form values
        handlePerpetualEntryPriceChange('');
        handlePerpetualStopLossChange('');
        handlePerpetualTakeProfitChange('');
    }, [handlePerpetualEntryPriceChange, handlePerpetualStopLossChange, handlePerpetualTakeProfitChange]);

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
        chartType,
        setChartType,
        candleInterval,
        setCandleInterval,

        // Sidebar State
        leftSidebarCollapsed,
        setLeftSidebarCollapsed,
        rightSidebarCollapsed,
        setRightSidebarCollapsed,
        toggleLeftSidebar,
        toggleRightSidebar,

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

        // Perpetual Creation State
        perpetualCreationState,
        setPerpetualCreationState,

        // Perpetual Chart Interaction State
        perpetualChartState,
        setPerpetualChartState,
        handlePerpetualChartClick,
        resetPerpetualChart,

        // Sandwich State
        sandwichBuyPrice,
        setSandwichBuyPrice,
        sandwichSellPrice,
        setSandwichSellPrice,
        sandwichSpread,
        setSandwichSpread,
        sandwichUsdAmount,
        setSandwichUsdAmount,

        // Perpetual State
        perpetualDirection,
        setPerpetualDirection,
        perpetualLeverage,
        setPerpetualLeverage,
        perpetualPositionSize,
        setPerpetualPositionSize,
        perpetualEntryPrice,
        setPerpetualEntryPrice,
        perpetualStopLoss,
        setPerpetualStopLoss,
        perpetualTakeProfit,
        setPerpetualTakeProfit,
        autoTrackEntryPrice,
        setAutoTrackEntryPrice,

        // P2P Funding State
        fundingMode,
        setFundingMode,
        fundingFeeRate,
        setFundingFeeRate,
        fundingExpiry,
        setFundingExpiry,

        // Real-time calculated values for perpetual
        perpetualMarginRequired,
        setPerpetualMarginRequired,
        perpetualLiquidationPrice,
        setPerpetualLiquidationPrice,
        perpetualCurrentPnL,
        setPerpetualCurrentPnL,

        // Orders Data
        displayOrders,
        pairFilteredOrders,
        swapFilteredOrders,
        filteredOrders,
        recentlyUpdatedOrders,

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
        handleCreatePerpetualOrder,
        handleSubmitOrder,
        handleOrderAction,
        confirmCancelOrder,
        cancelOrderAction,
        executeOrderAction,
        toggleOrderExpansion,
        clearHighlightedOrder,
        fetchOrders,
        refetchPerpetualPositions: useCallback(async () => {
            if (perpPositionsRefetchCallback && typeof perpPositionsRefetchCallback === 'function') {
                try {
                    await perpPositionsRefetchCallback();
                } catch (error) {
                    console.warn('Failed to refresh perpetual positions:', error);
                }
            } else {
                console.log('refetchPerpetualPositions called but no callback registered');
            }
        }, [perpPositionsRefetchCallback]),
        setPerpPositionsRefetchCallback,

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

        // Real-time Blaze Data Functions
        getRealTimePrice,
        getRealTimeBalance,
        isPricesConnected,

        // Perpetual Calculation Utilities
        calculateMarginRequired,
        calculateLiquidationPrice,
        calculatePnL,
        validatePerpetualOrder,

        // Input Handlers
        handleAmountChange,
        handlePriceChange,
        handleDcaAmountChange,
        handleSandwichBuyPriceChange,
        handleSandwichSellPriceChange,
        handleSandwichSpreadChange,
        handleSandwichUsdAmountChange,
        handlePerpetualPositionSizeChange,
        handlePerpetualEntryPriceChange,
        handlePerpetualStopLossChange,
        handlePerpetualTakeProfitChange,

        // Loading States (additional)
        isSubmitting: isCreatingOrder || isCreatingSandwichOrder,
    };

    return (
        <ProModeContext.Provider value={contextValue}>
            {children}
        </ProModeContext.Provider>
    );
} 