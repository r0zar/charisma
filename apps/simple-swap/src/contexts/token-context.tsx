"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from "react";
import { listTokens, getRoutableTokens } from "../app/actions";
import { listPrices, KraxelPriceData } from '@repo/tokens';
import type { Token } from "../lib/swap-client";

// Define the context shape
interface TokenContextValue {
    allTokens: Token[];
    subnetTokens: Token[];
    mainnetTokens: Token[];
    displayTokens: Token[];
    routeableTokenIds: Set<string>;
    selectedFromToken: Token | null;
    selectedToToken: Token | null;
    tokenCounterparts: Map<string, { mainnet: Token | null; subnet: Token | null }>;
    hasBothVersions: (token: Token | null) => boolean;
    getCounterpartToken: (token: Token | null) => Token | null;
    setSelectedFromToken: (token: Token | null) => void;
    setSelectedToToken: (token: Token | null) => void;
    switchTokens: () => void;
    tokenPrices: KraxelPriceData;
    getTokenPrice: (token: Token | null) => number | null;
    isLoading: boolean;
    error: string | null;
}

// Create the context
const TokenContext = createContext<TokenContextValue | null>(null);

// Provider component with critical loop prevention
export function TokenProvider({
    children,
    defaultFromSymbol = "STX",
    defaultToSymbol = "CHA"
}: {
    children: ReactNode;
    defaultFromSymbol?: string;
    defaultToSymbol?: string;
}) {
    // Guard refs to prevent multiple API calls
    const didFetchTokens = useRef(false);
    const didFetchPrices = useRef(false);
    const didSelectTokens = useRef(false);

    // Core state
    const [tokens, setTokens] = useState<Token[]>([]);
    const [routeableTokenIds, setRouteableTokenIds] = useState<Set<string>>(new Set());
    const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
    const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);
    const [tokenPrices, setTokenPrices] = useState<KraxelPriceData>({});

    // Loading states
    const [isLoadingTokens, setIsLoadingTokens] = useState(true);
    const [isLoadingPrices, setIsLoadingPrices] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filtered token lists - Computed once tokens change
    const mainnetTokens = useMemo(() =>
        tokens.filter(token => token.type !== 'SUBNET'),
        [tokens]
    );

    const displayTokens = useMemo(() =>
        mainnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol)),
        [mainnetTokens]
    );

    const subnetTokens = useMemo(() =>
        tokens.filter(token => token.type === 'SUBNET')
            .sort((a, b) => a.symbol.localeCompare(b.symbol)),
        [tokens]
    );

    // Token relationships map
    const tokenCounterparts = useMemo(() => {
        const counterparts = new Map<string, { mainnet: Token | null; subnet: Token | null }>();

        // Add mainnet tokens
        for (const mainnet of mainnetTokens) {
            counterparts.set(mainnet.contractId, { mainnet, subnet: null });
        }

        // Add subnet tokens
        for (const subnet of subnetTokens) {
            if (!subnet.base) continue;
            const baseId = subnet.base;

            if (!counterparts.has(baseId)) {
                counterparts.set(baseId, { mainnet: null, subnet });
            } else {
                const pair = counterparts.get(baseId);
                if (pair) pair.subnet = subnet;
            }
        }

        return counterparts;
    }, [mainnetTokens, subnetTokens]);

    // Helper functions
    const hasBothVersions = useCallback((token: Token | null): boolean => {
        if (!token) return false;

        if (token.type === 'SUBNET') {
            return !!(token.base && tokenCounterparts.get(token.base)?.mainnet);
        } else {
            return !!tokenCounterparts.get(token.contractId)?.subnet;
        }
    }, [tokenCounterparts]);

    const getCounterpartToken = useCallback((token: Token | null): Token | null => {
        if (!token) return null;

        if (token.type === 'SUBNET' && token.base) {
            return tokenCounterparts.get(token.base)?.mainnet || null;
        } else {
            return tokenCounterparts.get(token.contractId)?.subnet || null;
        }
    }, [tokenCounterparts]);

    const switchTokens = useCallback(() => {
        console.log("[TokenContext] Switching tokens");
        const tempFrom = selectedFromToken;

        setTimeout(() => {
            setSelectedFromToken(selectedToToken);
            setSelectedToToken(tempFrom);
        }, 0);
    }, [selectedFromToken, selectedToToken]);

    const getTokenPrice = useCallback((token: Token | null): number | null => {
        if (!token || !tokenPrices) return null;

        const price = token.contractId === '.stx'
            ? tokenPrices['stx']
            : tokenPrices[token.contractId];

        return price !== undefined ? price : null;
    }, [tokenPrices]);

    // FETCH PRICES - once only and with guard
    useEffect(() => {
        // Skip if already fetched or fetching
        if (didFetchPrices.current) return;

        // Set flag immediately to prevent double execution
        didFetchPrices.current = true;

        async function fetchPrices() {
            try {
                console.log("[TokenContext] Fetching prices - should happen only once");
                const prices = await listPrices();
                setTokenPrices(prices);
            } catch (err) {
                console.error("[TokenContext] Price fetch error:", err);
                setError("Could not load token prices.");
            } finally {
                setIsLoadingPrices(false);
            }
        }

        fetchPrices();
    }, []); // Empty deps array - run once only

    // FETCH TOKENS - once only and with guard
    useEffect(() => {
        // Skip if already fetched or fetching
        if (didFetchTokens.current) return;

        // Set flag immediately to prevent double execution
        didFetchTokens.current = true;

        async function fetchTokens() {
            try {
                console.log("[TokenContext] Fetching tokens - should happen only once");

                const allTokensResult = await listTokens();

                if (!allTokensResult.success || !allTokensResult.tokens) {
                    setError("Failed to load token list.");
                    return;
                }

                const routableIdsResult = await getRoutableTokens();

                if (!routableIdsResult.success || !routableIdsResult.tokens) {
                    setError("Failed to determine routable tokens.");
                    return;
                }

                const routableTokenIdsSet = new Set(
                    routableIdsResult.tokens.map(t => t.contractId)
                );

                const routableTokensWithMeta = (allTokensResult.tokens || [])
                    .filter(t => routableTokenIdsSet.has(t.contractId));

                setTokens(routableTokensWithMeta);
                setRouteableTokenIds(routableTokenIdsSet);
            } catch (err) {
                console.error("[TokenContext] Token fetch error:", err);
                setError("Failed to load tokens.");
            } finally {
                setIsLoadingTokens(false);
            }
        }

        fetchTokens();
    }, []); // Empty deps array - run once only

    // SELECT DEFAULT TOKENS - once only after tokens loaded
    useEffect(() => {
        // Only run once tokens are loaded
        if (tokens.length === 0 || isLoadingTokens) return;

        // Skip if already selected or selecting
        if (didSelectTokens.current) return;

        // Skip if both tokens are already selected (e.g. from props)
        if (selectedFromToken && selectedToToken) {
            didSelectTokens.current = true;
            return;
        }

        // Set flag to prevent re-runs
        didSelectTokens.current = true;

        console.log("[TokenContext] Selecting default tokens - should happen only once");

        // Find default tokens
        const routeableTokens = tokens.filter(t => routeableTokenIds.has(t.contractId));
        if (routeableTokens.length === 0) return;

        const fromToken = routeableTokens.find(t => t.symbol === defaultFromSymbol) || routeableTokens[0];

        const toToken = routeableTokens.find(t => t.symbol === defaultToSymbol) ||
            routeableTokens.find(t => t.contractId !== fromToken.contractId) ||
            fromToken;

        // Set tokens
        setTimeout(() => {
            setSelectedFromToken(fromToken);
            setSelectedToToken(toToken);
        }, 0);
    }, [tokens.length, isLoadingTokens, selectedFromToken, selectedToToken, defaultFromSymbol, defaultToSymbol, routeableTokenIds, tokens]);

    // Combined loading state
    const isLoading = isLoadingTokens || isLoadingPrices;

    // Create the context value object
    const contextValue: TokenContextValue = {
        allTokens: tokens,
        subnetTokens,
        mainnetTokens,
        displayTokens,
        routeableTokenIds,
        selectedFromToken,
        selectedToToken,
        tokenCounterparts,
        hasBothVersions,
        getCounterpartToken,
        setSelectedFromToken,
        setSelectedToToken,
        switchTokens,
        tokenPrices,
        getTokenPrice,
        isLoading,
        error
    };

    return (
        <TokenContext.Provider value={contextValue}>
            {children}
        </TokenContext.Provider>
    );
}

// Hook to use the token context
export function useTokenContext() {
    const context = useContext(TokenContext);

    if (!context) {
        throw new Error("useTokenContext must be used within a TokenProvider");
    }

    return context;
}

// Legacy hook for backward compatibility
export function useTokens(options = {}) {
    console.warn("useTokens is deprecated. Use useTokenContext instead.");
    return useTokenContext();
}