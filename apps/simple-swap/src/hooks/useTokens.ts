import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { listTokens, getRoutableTokens } from "../app/actions";
import { listPrices, KraxelPriceData } from '@repo/tokens';
import type { Token } from "../lib/swap-client";

export interface TokenRelationships {
    displayTokens: Token[];
    subnetDisplayTokens: Token[];
    tokenCounterparts: Map<string, { mainnet: Token | null; subnet: Token | null }>;
}

interface UseTokensOptions {
    initialTokens?: Token[];
    defaultFromSymbol?: string;
    defaultToSymbol?: string;
    skipAutoSelect?: boolean; // Added option to skip auto-selection
}

export function useTokens({
    initialTokens = [],
    defaultFromSymbol = "STX",
    defaultToSymbol = "CHA",
    skipAutoSelect = false
}: UseTokensOptions = {}) {
    // Tracking if we've already done auto-selection to prevent infinite loops
    const didInitialSelection = useRef(false);

    // State for all tokens and which ones are routable
    const [tokens, setTokens] = useState<Token[]>(initialTokens);
    const [routeableTokenIds, setRouteableTokenIds] = useState<Set<string>>(new Set());

    // Loading states
    const [isLoadingTokens, setIsLoadingTokens] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Selected tokens
    const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
    const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);

    // Price state
    const [tokenPrices, setTokenPrices] = useState<KraxelPriceData>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [priceError, setPriceError] = useState<string | null>(null);

    // Fetch token prices on mount
    useEffect(() => {
        async function fetchPrices() {
            setIsLoadingPrices(true);
            setPriceError(null);
            try {
                const prices = await listPrices();
                setTokenPrices(prices);
            } catch (err) {
                console.error("Failed to fetch token prices:", err);
                setPriceError("Could not load token prices.");
            } finally {
                setIsLoadingPrices(false);
            }
        }
        fetchPrices();
    }, []);

    // Load tokens
    useEffect(() => {
        async function fetchTokensClient() {
            setIsLoadingTokens(true);
            setError(null);

            try {
                // Step 1: Fetch all tokens with full metadata
                const allTokensResult = await listTokens();

                if (!allTokensResult.success || !allTokensResult.tokens) {
                    setError("Failed to load token list.");
                    return;
                }

                // Step 2: Fetch the IDs of routable tokens
                const routableIdsResult = await getRoutableTokens();

                if (!routableIdsResult.success || !routableIdsResult.tokens) {
                    setError("Failed to determine routable tokens.");
                    return;
                }

                const routableTokenIdsSet = new Set(routableIdsResult.tokens.map(t => t.contractId));

                // Step 3: Filter all tokens to get full metadata for only routable ones
                const routableTokensWithMeta = (allTokensResult.tokens || [])
                    .filter(t => routableTokenIdsSet.has(t.contractId));

                setTokens(routableTokensWithMeta);
                setRouteableTokenIds(routableTokenIdsSet);
            } catch (err) {
                setError("Failed to load tokens. Please try again later.");
            } finally {
                setIsLoadingTokens(false);
            }
        }

        if (initialTokens.length > 0) {
            setRouteableTokenIds(new Set(initialTokens.map((t) => t.contractId)));
            setIsLoadingTokens(false);
        } else {
            fetchTokensClient();
        }
    }, [initialTokens]);

    // Auto-select default tokens when list ready (with guards against infinite loops)
    useEffect(() => {
        // Skip if auto-selection is disabled or we've already done selection
        if (skipAutoSelect || didInitialSelection.current) return;

        // Skip if tokens aren't loaded yet
        if (tokens.length === 0 || isLoadingTokens) return;

        // Skip if both tokens are already selected (e.g. by parent component)
        if (selectedFromToken && selectedToToken) {
            didInitialSelection.current = true;
            return;
        }

        const routeableTokens = tokens.filter((t) => routeableTokenIds.has(t.contractId));
        if (routeableTokens.length === 0) return;

        // Try to find tokens matching default symbols
        const fromToken = !selectedFromToken
            ? (routeableTokens.find(t => t.symbol === defaultFromSymbol) || routeableTokens[0])
            : selectedFromToken;

        const toToken = !selectedToToken
            ? (routeableTokens.find(t => t.symbol === defaultToSymbol) ||
                routeableTokens.find(t => t.contractId !== fromToken.contractId) ||
                fromToken)
            : selectedToToken;

        // Update our ref to prevent future runs
        didInitialSelection.current = true;

        // Defer state updates to avoid potential race conditions
        if (!selectedFromToken) {
            setSelectedFromToken(fromToken);
        }

        if (!selectedToToken) {
            setSelectedToToken(toToken);
        }
    }, [
        tokens,
        routeableTokenIds,
        selectedFromToken,
        selectedToToken,
        defaultFromSymbol,
        defaultToSymbol,
        skipAutoSelect,
        isLoadingTokens
    ]);

    // Compute token relationships (mainnet/subnet pairs)
    const tokenRelationships: TokenRelationships = useMemo(() => {
        if (tokens.length === 0) {
            return {
                displayTokens: [],
                subnetDisplayTokens: [],
                tokenCounterparts: new Map<string, { mainnet: Token | null; subnet: Token | null }>()
            };
        }

        // Mainnet tokens: type !== 'SUBNET'
        const mainnetTokens = tokens.filter(t => t.type !== 'SUBNET');
        // Subnet tokens: type === 'SUBNET'
        const subnetTokens = tokens.filter(t => t.type === 'SUBNET');

        // Map base contractId to { mainnet, subnet }
        const tokenCounterparts = new Map<string, { mainnet: Token | null; subnet: Token | null }>();

        for (const mainnet of mainnetTokens) {
            tokenCounterparts.set(mainnet.contractId, { mainnet, subnet: null });
        }

        for (const subnet of subnetTokens) {
            if (!subnet.base) continue; // Skip if base is undefined
            const baseId = subnet.base;
            if (!tokenCounterparts.has(baseId)) {
                tokenCounterparts.set(baseId, { mainnet: null, subnet });
            } else {
                tokenCounterparts.get(baseId)!.subnet = subnet;
            }
        }

        // Sort token lists
        const sortedDisplayTokens = mainnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
        const sortedSubnetTokens = subnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

        return {
            displayTokens: sortedDisplayTokens,
            subnetDisplayTokens: sortedSubnetTokens,
            tokenCounterparts
        };
    }, [tokens]);

    // Custom setters with built-in safety mechanisms
    const setSelectedFromTokenSafe = useCallback((token: Token | null, forceSubnet: boolean = false) => {
        if (!token) {
            setSelectedFromToken(null);
            return;
        }

        // If forceSubnet is true and token is not a subnet token, try to get subnet counterpart
        if (forceSubnet && token.type !== 'SUBNET') {
            const subnetToken = tokenRelationships.tokenCounterparts.get(token.contractId)?.subnet;
            setSelectedFromToken(subnetToken || token); // Fall back to original if no subnet version
        } else {
            setSelectedFromToken(token);
        }
    }, [tokenRelationships.tokenCounterparts]);

    const setSelectedToTokenSafe = useCallback((token: Token | null, forceSubnet: boolean = false) => {
        if (!token) {
            setSelectedToToken(null);
            return;
        }

        // If forceSubnet is true and token is not a subnet token, try to get subnet counterpart
        if (forceSubnet && token.type !== 'SUBNET') {
            const subnetToken = tokenRelationships.tokenCounterparts.get(token.contractId)?.subnet;
            setSelectedToToken(subnetToken || token); // Fall back to original if no subnet version
        } else {
            setSelectedToToken(token);
        }
    }, [tokenRelationships.tokenCounterparts]);

    // Helper to check if token has both mainnet and subnet versions
    const hasBothVersions = useCallback((token: Token | null): boolean => {
        if (!token) return false;

        if (token.type === 'SUBNET') {
            // Subnet token: check if mainnet exists
            return !!(token.base && tokenRelationships.tokenCounterparts.get(token.base)?.mainnet);
        } else {
            // Mainnet token: check if subnet exists
            return !!tokenRelationships.tokenCounterparts.get(token.contractId)?.subnet;
        }
    }, [tokenRelationships.tokenCounterparts]);

    // Function to get the counterpart token (mainnet <-> subnet)
    const getCounterpartToken = useCallback((token: Token | null): Token | null => {
        if (!token) return null;

        if (token.type === 'SUBNET' && token.base) {
            // Get mainnet version of subnet token
            return tokenRelationships.tokenCounterparts.get(token.base)?.mainnet || null;
        } else {
            // Get subnet version of mainnet token
            return tokenRelationships.tokenCounterparts.get(token.contractId)?.subnet || null;
        }
    }, [tokenRelationships.tokenCounterparts]);

    // Switch the from and to tokens
    const switchTokens = useCallback(() => {
        setSelectedFromToken(selectedToToken);
        setSelectedToToken(selectedFromToken);
    }, [selectedFromToken, selectedToToken]);

    // Get token price in USD (helper function)
    const getTokenPrice = useCallback((token: Token | null): number | null => {
        if (!token || !tokenPrices) return null;

        const price = token.contractId === '.stx'
            ? tokenPrices['stx']
            : tokenPrices[token.contractId];

        return price !== undefined ? price : null;
    }, [tokenPrices]);

    return {
        // Token data
        allTokens: tokens,
        routeableTokenIds,
        selectedFromToken,
        selectedToToken,

        // Token relationships
        ...tokenRelationships,
        hasBothVersions,
        getCounterpartToken,

        // Actions
        setSelectedFromToken: setSelectedFromTokenSafe,
        setSelectedToToken: setSelectedToTokenSafe,
        switchTokens,

        // Price data
        tokenPrices,
        isLoadingPrices,
        priceError,
        getTokenPrice,

        // Status
        isLoadingTokens,
        error
    };
}