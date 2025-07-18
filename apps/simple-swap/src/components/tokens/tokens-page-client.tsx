"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { TokenSummary } from "@/types/token-types";
import { useComparisonToken } from "@/contexts/comparison-token-context";
import dynamic from 'next/dynamic';

// Components
import TokenTable from "./token-table";
import MarketHighlights from "./market-highlights";
import TokenFilters from "./token-filters";
import MarketInsights from "./market-insights";

// Dynamically import CompareTokenSelector to avoid SSR
const CompareTokenSelector = dynamic(
    () => import('./compare-token-selector'),
    {
        ssr: false,
        loading: () => <div className="h-[60px]" /> // Placeholder to prevent layout shift
    }
);

// New component for arbitrage alerts
const ArbitrageAlerts = dynamic(
    () => import('@/components/tokens/arbitrage-alerts'),
    { ssr: false }
);

// Constants
const DEFAULT_CATEGORY = "all";
const DEFAULT_SORT = "market_cap";
const STABLE_TOKENS = ["USDh", "USDC", "USDT", "USD"];
const STABLE_SYMBOLS = ["USDC", "USDT", "aUSD", "USD", "DAI", "FRAX"];
const DEFI_SYMBOLS = ["UNI", "SUSHI", "AAVE", "COMP", "CRV", "YFI", "1INCH"];

// Enhanced Types
interface EnhancedTokenSummary extends TokenSummary {
    reliability?: number;
    source?: 'oracle' | 'market' | 'virtual' | 'hybrid';
    arbitrageOpportunity?: {
        marketPrice: number;
        virtualValue: number;
        deviation: number;
        profitable: boolean;
    };
}

interface Props {
    tokens: (TokenSummary | EnhancedTokenSummary)[];
    priceHistories?: Record<string, any[]>;
    arbitrageOpportunities?: any[];
}

interface TokenStats {
    typeCount: Map<string, number>;
    subnetTokenCount: number;
    tokensWithoutImages: number;
    arbitrageCount: number;
}

// Helper functions
const isValidToken = (token: TokenSummary): boolean => {
    // Must have a valid contractId
    if (!token.contractId || typeof token.contractId !== 'string' || token.contractId.trim() === '') {
        console.warn('Token missing or invalid contractId:', token);
        return false;
    }

    // Filter out SUBNET tokens
    if (token.type === "SUBNET") return false;

    // For now, allow tokens without images to see if that's the issue
    // if (!token.image) return false;

    return true;
};

const filterTokensByCategory = (tokens: (TokenSummary | EnhancedTokenSummary)[], category: string): (TokenSummary | EnhancedTokenSummary)[] => {
    if (category === "all") return tokens;

    switch (category) {
        case "stablecoin":
            return tokens.filter(t =>
                STABLE_SYMBOLS.includes(t.symbol) ||
                t.name.toLowerCase().includes("usd") ||
                t.name.toLowerCase().includes("stable")
            );

        case "defi":
            return tokens.filter(t =>
                DEFI_SYMBOLS.includes(t.symbol) ||
                t.name.toLowerCase().includes("defi") ||
                t.name.toLowerCase().includes("swap")
            );

        case "governance":
            return tokens.filter(t =>
                t.name.toLowerCase().includes("governance") ||
                t.name.toLowerCase().includes("dao") ||
                t.symbol.includes("GOV")
            );

        case "arbitrage":
            // New category for tokens with arbitrage opportunities
            return tokens.filter(t =>
                'arbitrageOpportunity' in t &&
                t.arbitrageOpportunity?.profitable === true
            );

        default:
            return tokens;
    }
};

export default function TokensPageClient({ tokens, priceHistories = {}, arbitrageOpportunities = [] }: Props) {
    // Context
    const { compareId, setCompareId, isInitialized } = useComparisonToken();

    // State
    const [categoryFilter, setCategoryFilter] = useState<string>(DEFAULT_CATEGORY);
    const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT);
    const [isFiltersInitialized, setIsFiltersInitialized] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [showArbitrageAlerts, setShowArbitrageAlerts] = useState(true);

    // Routing
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Memoized values
    const tokenStats = useMemo<TokenStats>(() => {
        const typeCount = new Map<string, number>();
        let subnetTokenCount = 0;
        let tokensWithoutImages = 0;
        let arbitrageCount = 0;

        tokens.forEach(token => {
            const type = token.type || 'UNKNOWN';
            typeCount.set(type, (typeCount.get(type) || 0) + 1);

            if (token.type === "SUBNET") subnetTokenCount++;
            if (!token.image) tokensWithoutImages++;
            if ('arbitrageOpportunity' in token && token.arbitrageOpportunity?.profitable) {
                arbitrageCount++;
            }
        });

        return { typeCount, subnetTokenCount, tokensWithoutImages, arbitrageCount };
    }, [tokens]);

    const validTokens = useMemo(() => {
        console.log('[TokensPageClient] Total tokens received:', tokens.length);
        const valid = tokens.filter(isValidToken);
        console.log('[TokensPageClient] Valid tokens after filtering:', valid.length);
        console.log('[TokensPageClient] Sample invalid tokens:', tokens.filter(t => !isValidToken(t)).slice(0, 3));
        return valid;
    }, [tokens]);

    const filteredTokens = useMemo(() =>
        filterTokensByCategory(validTokens, categoryFilter),
        [validTokens, categoryFilter]
    );

    const compareToken = useMemo(() =>
        validTokens.find(t => t.contractId === compareId) ?? null,
        [validTokens, compareId]
    );

    // Track client-side mounting
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Initialize filters from URL
    useEffect(() => {
        const urlCategory = searchParams?.get("category");
        const urlSort = searchParams?.get("sort");
        if (urlCategory) setCategoryFilter(urlCategory);
        if (urlSort) setSortBy(urlSort);
        setIsFiltersInitialized(true);
    }, [searchParams]);

    // Set default comparison token
    useEffect(() => {
        if (!isInitialized || compareId || !validTokens.length) return;

        const stableToken = validTokens.find(t => STABLE_TOKENS.includes(t.symbol));
        setCompareId(stableToken?.contractId || validTokens[0].contractId);
    }, [compareId, validTokens, isInitialized, setCompareId]);

    // Persist filters to URL
    useEffect(() => {
        const params = new URLSearchParams(searchParams?.toString() || '');

        // Handle category filter
        if (categoryFilter !== DEFAULT_CATEGORY) {
            params.set("category", categoryFilter);
        } else {
            params.delete("category");
        }

        // Handle sort filter
        if (sortBy !== DEFAULT_SORT) {
            params.set("sort", sortBy);
        } else {
            params.delete("sort");
        }

        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [categoryFilter, sortBy, pathname, router, searchParams]);

    // Check if we have enhanced data
    const hasEnhancedData = validTokens.some(t => 'source' in t);
    const hasArbitrageData = tokenStats.arbitrageCount > 0;

    return (
        <div className="space-y-16">
            {/* Arbitrage Alerts (if any profitable opportunities) */}
            {isMounted && hasArbitrageData && showArbitrageAlerts && arbitrageOpportunities.length > 0 && (
                <ArbitrageAlerts
                    opportunities={arbitrageOpportunities}
                    onClose={() => setShowArbitrageAlerts(false)}
                />
            )}

            {/* Header Section */}
            <header className="space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
                    {/* Title and Description */}
                    <div className="space-y-6">
                        <div>
                            <h1 className="text-3xl font-medium text-white/95 tracking-wide mb-3">
                                Token Explorer
                            </h1>
                            <p className="text-white/60 max-w-2xl text-base leading-relaxed">
                                Discover live cryptocurrency prices with advanced market intelligence and pattern analysis.
                                {hasEnhancedData && " Powered by three-engine price discovery."}
                            </p>
                        </div>

                        {/* Stats Bar */}
                        <div className="flex items-center gap-6 text-sm text-white/40">
                            {isMounted && isInitialized && isFiltersInitialized ? (
                                <>
                                    <span>{filteredTokens.length} tokens</span>
                                    {compareToken && (
                                        <span>Baseline: {compareToken.symbol}</span>
                                    )}
                                    {hasArbitrageData && (
                                        <span className="text-amber-400">
                                            {tokenStats.arbitrageCount} arbitrage opportunities
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span>Loading tokens...</span>
                            )}
                            <LiveDataIndicator enhanced={hasEnhancedData} />
                        </div>
                    </div>

                    {/* Compare Token Selector */}
                    <div className="mb-4 self-end w-full sm:w-auto">
                        {isInitialized && compareToken && (
                            <CompareTokenSelector
                                tokens={validTokens}
                                primary={compareToken}
                                selectedId={compareId}
                                onSelect={setCompareId}
                            />
                        )}
                    </div>
                </div>
            </header>

            {/* Market Highlights - now with enhanced data */}
            <MarketHighlights
                tokenSummaries={validTokens}
                priceHistories={priceHistories}
            />

            {/* Market Insights - now with arbitrage analysis */}
            <MarketInsights
                tokenSummaries={validTokens}
                arbitrageOpportunities={arbitrageOpportunities}
            />

            {/* Filters Section */}
            <div className="pt-8 border-t border-white/[0.05]">
                <TokenFilters
                    categoryFilter={categoryFilter}
                    setCategoryFilter={setCategoryFilter}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    hasArbitrageCategory={hasArbitrageData}
                />
            </div>

            {/* Token Table - now with enhanced features */}
            <TokenTable
                tokens={filteredTokens}
                compareId={compareId}
                priceHistories={priceHistories}
                hasEnhancedData={hasEnhancedData}
            />
        </div>
    );
}

// Enhanced Sub-components
interface LiveDataIndicatorProps {
    enhanced?: boolean;
}

function LiveDataIndicator({ enhanced = false }: LiveDataIndicatorProps) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative">
                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <div className="absolute inset-0 h-1.5 w-1.5 bg-emerald-400/40 rounded-full animate-ping" />
                <div className="absolute inset-[-1px] h-2.5 w-2.5 bg-emerald-400/20 rounded-full blur-sm animate-pulse" />
            </div>
            <span className="animate-pulse">
                {enhanced ? "Enhanced live data" : "Live data"}
            </span>
        </div>
    );
}