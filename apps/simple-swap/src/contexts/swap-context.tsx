"use client";

import React, { createContext, useContext } from 'react';
import { useSwap } from '../hooks/useSwap';
import { TokenCacheData } from '@repo/tokens';
import { useSearchParams } from 'next/navigation';

interface SwapContextType {
    // All the existing properties from useSwap
    selectedTokens: TokenCacheData[];
    routeableTokenIds: Set<string>;
    selectedFromToken: TokenCacheData | null;
    selectedToToken: TokenCacheData | null;
    displayAmount: string;
    microAmount: string;
    quote: any;
    error: string | null;
    swapSuccessInfo: any;
    fromTokenBalance: string;
    toTokenBalance: string;
    userAddress: string;
    tokenPrices: any;
    mode: 'swap' | 'order';
    setMode: (mode: 'swap' | 'order') => void;
    displayTokens: TokenCacheData[];
    subnetDisplayTokens: TokenCacheData[];
    tokenCounterparts: Map<string, { mainnet: TokenCacheData | null; subnet: TokenCacheData | null }>;
    hasBothVersions: (token: TokenCacheData | null) => boolean;
    isInitializing: boolean;
    isLoadingTokens: boolean;
    isLoadingRouteInfo: boolean;
    isLoadingQuote: boolean;
    isLoadingPrices: boolean;
    priceError: string | null;
    formatTokenAmount: (amount: number, decimals: number) => string;
    convertToMicroUnits: (input: string, decimals: number) => string;
    convertFromMicroUnits: (microUnits: string, decimals: number) => string;
    getTokenLogo: (token: TokenCacheData) => string;
    setDisplayAmount: (amount: string) => void;
    setSelectedToToken: (token: TokenCacheData) => void;
    setMicroAmount: (amount: string) => void;
    setUserAddress: (address: string) => void;
    fetchQuote: () => Promise<void>;
    handleSwap: () => Promise<void>;
    handleSwitchTokens: () => void;
    clearBalanceCache: () => void;
    createTriggeredSwap: (opts: any) => Promise<any>;
    setSelectedFromTokenSafe: (token: TokenCacheData) => void;
    fromTokenValueUsd: number | null;
    toTokenValueUsd: number | null;
    // New properties
    priceImpacts: Array<{
        impact: number | null;
        fromValueUsd: number | null;
        toValueUsd: number | null;
    }>;
    totalPriceImpact: {
        inputValueUsd: number;
        outputValueUsd: number;
        priceImpact: number | null;
    } | null;
    securityLevel: 'high' | 'medium' | 'low';
    formatUsd: (value: number | null) => string | null;
    getUsdPrice: (contractId: string) => number | undefined;
    urlParams: Record<string, string | undefined>;
    // UI Helper Logic
    displayedFromToken: TokenCacheData | null;
    displayedToToken: TokenCacheData | null;
    isSubnetShift: boolean;
    shiftDirection: 'to-subnet' | 'from-subnet' | null;
    toLabel: string;

    // Order mode state
    targetPrice: string;
    setTargetPrice: (price: string) => void;
    conditionToken: TokenCacheData | null;
    setConditionToken: (token: TokenCacheData | null) => void;
    baseToken: TokenCacheData | null;
    setBaseToken: (token: TokenCacheData | null) => void;
    conditionDir: 'lt' | 'gt';
    setConditionDir: (dir: 'lt' | 'gt') => void;
    useSubnetFrom: boolean;
    setUseSubnetFrom: (use: boolean) => void;
    useSubnetTo: boolean;
    setUseSubnetTo: (use: boolean) => void;
    baseSelectedFromToken: TokenCacheData | null;
    setBaseSelectedFromToken: (token: TokenCacheData | null) => void;
    baseSelectedToToken: TokenCacheData | null;
    setBaseSelectedToToken: (token: TokenCacheData | null) => void;

    // Order mode handlers
    handleBumpPrice: (percent: number) => void;
    handleSwitchTokensEnhanced: () => void;

    // DCA dialog state
    dcaDialogOpen: boolean;
    setDcaDialogOpen: (open: boolean) => void;

    // Transaction state
    swapping: boolean;
    setSwapping: (swapping: boolean) => void;
    isCreatingOrder: boolean;

    // Pro mode state
    isProMode: boolean;
    setIsProMode: (isProMode: boolean) => void;

    // Limit Order Handlers
    handleCreateLimitOrder: () => Promise<void>;
    createSingleOrder: (opts: { amountDisplay: string; validFrom: string; validTo: string }) => Promise<void>;

    // Share Handler
    handleShare: () => void;

    // New balance checking functionality
    allTokenBalances: Map<string, number>;
    isCheckingBalances: boolean;
    isLoadingSwapOptions: boolean;
    balanceCheckResult: {
        hasEnoughSubnet: boolean;
        hasEnoughMainnet: boolean;
        subnetBalance: number;
        mainnetBalance: number;
        requiredAmount: number;
        shortfall: number;
        canDeposit: boolean;
        swapOptions: Array<{
            fromToken: TokenCacheData;
            fromBalance: number;
            swapAmount: number;
            estimatedOutput: number;
            route?: any;
        }>;
    } | null;
    setBalanceCheckResult: (result: any) => void;
    checkBalanceForOrder: (token: TokenCacheData, amount: string) => Promise<any>;
    executeDeposit: (mainnetToken: TokenCacheData, subnetToken: TokenCacheData, amount: string) => Promise<boolean>;
    executeSwapForOrder: (swapOption: any) => Promise<boolean>;
    fetchAllUserBalances: () => Promise<Map<string, number>>;

    // LocalStorage preferences
    saveTokenPreferences: () => void;
    loadTokenPreferences: () => void;
    clearTokenPreferences: () => void;
}

const SwapContext = createContext<SwapContextType | undefined>(undefined);

interface SwapProviderProps {
    children: React.ReactNode;
    initialTokens?: TokenCacheData[];
    searchParams?: URLSearchParams;
}

export function SwapProvider({ children, initialTokens = [], searchParams }: SwapProviderProps) {
    const swapData = useSwap({ initialTokens, searchParams });

    return (
        <SwapContext.Provider value={{
            ...swapData,
            // All the new balance checking functionality is already included in swapData
        }}>
            {children}
        </SwapContext.Provider>
    );
}

export function useSwapContext() {
    const context = useContext(SwapContext);
    if (context === undefined) {
        throw new Error('useSwapContext must be used within a SwapProvider');
    }
    return context;
} 