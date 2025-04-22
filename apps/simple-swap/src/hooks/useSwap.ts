import { useState, useEffect, useCallback, useRef } from "react";
import type { Route } from "@repo/dexterity";
import { Cryptonomicon } from "@repo/cryptonomicon";
import { getQuote, getRoutableTokens } from "../app/actions";
import { swapClient, Token } from "../lib/swap-client";

// Quote response mirrors server action structure
interface QuoteResponse {
    amountOut: number;
    expectedPrice: number;
    minimumReceived: number;
    route: Route;
}

interface UseSwapOptions {
    initialTokens?: Token[];
}

// Cache validity period in milliseconds (30 minutes)
const CACHE_EXPIRY = 30 * 60 * 1000;

// Balance cache interface
interface BalanceCache {
    [key: string]: {
        balance: string;
        timestamp: number;
    };
}

// Initialize Cryptonomicon
const crypto = new Cryptonomicon({
    network: "mainnet", // or "testnet" based on your app
    debug: false
});

// Mock address - In a real app, you would get this from user's wallet
const DEFAULT_ADDRESS = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS";

export function useSwap({ initialTokens = [] }: UseSwapOptions = {}) {
    // ---------------------- State ----------------------
    const [tokens, setTokens] = useState<Token[]>(initialTokens);
    const [routeableTokenIds, setRouteableTokenIds] = useState<Set<string>>(new Set());
    const [isInitializing, setIsInitializing] = useState(true);
    const [isLoadingRouteInfo, setIsLoadingRouteInfo] = useState(false);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);

    // User address state
    const [userAddress, setUserAddress] = useState<string>(DEFAULT_ADDRESS);

    const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
    const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);

    // Balance states
    const [fromTokenBalance, setFromTokenBalance] = useState<string>("0");
    const [toTokenBalance, setToTokenBalance] = useState<string>("0");

    const [displayAmount, setDisplayAmount] = useState<string>("1");
    const [microAmount, setMicroAmount] = useState<string>("1000000");

    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [swapSuccessInfo, setSwapSuccessInfo] = useState<{ txId: string } | null>(null);

    // Balance cache ref (will persist between renders but won't cause re-renders)
    const balanceCacheRef = useRef<BalanceCache>({});

    // ---------------------- Effects ----------------------
    // Token loading logic (server‑prefetched vs. client fetch)
    useEffect(() => {
        async function fetchTokensClient() {
            setIsLoadingTokens(true);
            setError(null);
            try {
                const result = await getRoutableTokens();
                if (result.success && result.tokens) {
                    const tokensWithMeta = result.tokens.map((t: any) => ({
                        ...t,
                        name: t.name ?? "",
                        symbol: t.symbol ?? "",
                        decimals: t.decimals ?? 6,
                        image: t.image ?? "",
                    }));
                    setTokens(tokensWithMeta);
                    setRouteableTokenIds(new Set(tokensWithMeta.map((t) => t.contractId)));
                } else {
                    setError("Failed to load tokens with routes");
                }
            } catch (err) {
                setError("Failed to load tokens. Please try again later.");
            } finally {
                setIsLoadingTokens(false);
                setIsInitializing(false);
            }
        }

        if (initialTokens.length > 0) {
            setRouteableTokenIds(new Set(initialTokens.map((t) => t.contractId)));
            setIsInitializing(false);
        } else {
            fetchTokensClient();
        }
    }, [initialTokens]);

    // Auto‑select default tokens when list ready
    useEffect(() => {
        if (tokens.length === 0 || routeableTokenIds.size === 0) return;
        if (selectedFromToken && selectedToToken) return; // already set

        const routeableTokens = tokens.filter((t) => routeableTokenIds.has(t.contractId));
        if (routeableTokens.length === 0) return;

        // Prefer STX as source
        const stxToken = routeableTokens.find(
            (t) => t.contractId === ".stx" || t.symbol.toLowerCase() === "stx"
        );
        const from = stxToken ?? routeableTokens[0];
        const btcToken = routeableTokens.find((t) => t.symbol.toLowerCase().includes("btc"));
        const to = btcToken ?? routeableTokens.find((t) => t.contractId !== from.contractId) ?? from;

        setSelectedFromToken(from);
        setSelectedToToken(to);
        setMicroAmount(swapClient.convertToMicroUnits(displayAmount, from.decimals));
    }, [tokens, routeableTokenIds]);

    // Function to check if a cached balance is still valid
    const isValidCache = useCallback((cacheKey: string) => {
        const cache = balanceCacheRef.current[cacheKey];
        if (!cache) return false;

        const now = Date.now();
        return now - cache.timestamp < CACHE_EXPIRY;
    }, []);

    // Function to get balance with caching
    const getTokenBalanceWithCache = useCallback(async (
        contractId: string,
        address: string,
        decimals: number
    ): Promise<string> => {
        const cacheKey = `${contractId}:${address}`;

        // Check cache first
        if (isValidCache(cacheKey)) {
            return balanceCacheRef.current[cacheKey].balance;
        }

        try {
            let balance = 0;

            // Handle STX differently than other tokens
            if (contractId === ".stx") {
                balance = await crypto.getStxBalance(address);
            } else {
                balance = await crypto.getTokenBalance(contractId, address);
            }

            // Format balance using decimals
            const formattedBalance = swapClient.formatTokenAmount(balance, decimals);

            // Cache the result
            balanceCacheRef.current[cacheKey] = {
                balance: formattedBalance,
                timestamp: Date.now()
            };

            return formattedBalance;
        } catch (err) {
            console.error(`Error fetching balance for ${contractId}:`, err);
            return "0";
        }
    }, [isValidCache]);

    // Function to clear balance cache
    const clearBalanceCache = useCallback(() => {
        balanceCacheRef.current = {};
    }, []);

    // Fetch selected token balances
    useEffect(() => {
        async function fetchBalances() {
            if (!userAddress) return;

            // Fetch "from" token balance
            if (selectedFromToken) {
                const balance = await getTokenBalanceWithCache(
                    selectedFromToken.contractId,
                    userAddress,
                    selectedFromToken.decimals
                );
                setFromTokenBalance(balance);
            }

            // Fetch "to" token balance
            if (selectedToToken) {
                const balance = await getTokenBalanceWithCache(
                    selectedToToken.contractId,
                    userAddress,
                    selectedToToken.decimals
                );
                setToTokenBalance(balance);
            }
        }

        fetchBalances();
    }, [selectedFromToken, selectedToToken, userAddress, getTokenBalanceWithCache]);

    // Fetch quote whenever relevant values change
    useEffect(() => {
        if (!selectedFromToken || !selectedToToken) return;
        if (!microAmount || Number(microAmount) <= 0) {
            setQuote(null);
            return;
        }
        fetchQuote();
    }, [selectedFromToken, selectedToToken, microAmount]);

    // ---------------------- Handlers ----------------------
    async function fetchQuote() {
        if (!selectedFromToken || !selectedToToken) return;
        const amountNum = Number(microAmount);
        if (isNaN(amountNum) || amountNum <= 0) return;

        setIsLoadingQuote(true);
        setError(null);
        try {
            const result = await getQuote(
                selectedFromToken.contractId,
                selectedToToken.contractId,
                microAmount
            );
            if (result.success && result.data) {
                setQuote(result.data as QuoteResponse);
            } else {
                throw new Error(result.error || "Failed to get quote");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to get quote");
            setQuote(null);
        } finally {
            setIsLoadingQuote(false);
        }
    }

    async function handleSwap() {
        if (!quote) return;
        setError(null);
        setSwapSuccessInfo(null);
        try {
            const res = await swapClient.executeSwap(quote.route);
            console.log("Swap result:", res);

            if ("error" in res) {
                setError(res.error || "Swap failed");
                return;
            }

            // Clear balance cache after successful swap
            clearBalanceCache();

            setSwapSuccessInfo({ txId: res.txId });
            console.log("Swap successful, txId:", res.txId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
    }

    function handleSwitchTokens() {
        if (!selectedFromToken || !selectedToToken) return;
        setSelectedFromToken(selectedToToken);
        setSelectedToToken(selectedFromToken);
        setMicroAmount(swapClient.convertToMicroUnits(displayAmount, selectedToToken.decimals));
    }

    // ---------------------- Return API ----------------------
    return {
        // data
        tokens,
        routeableTokenIds,
        selectedFromToken,
        selectedToToken,
        displayAmount,
        microAmount,
        quote,
        error,
        swapSuccessInfo,
        fromTokenBalance,
        toTokenBalance,
        userAddress,

        // loading flags
        isInitializing,
        isLoadingTokens,
        isLoadingRouteInfo,
        isLoadingQuote,

        // helpers from swapClient
        formatTokenAmount: swapClient.formatTokenAmount,
        convertToMicroUnits: swapClient.convertToMicroUnits,
        convertFromMicroUnits: swapClient.convertFromMicroUnits,
        getTokenLogo: swapClient.getTokenLogo,

        // setters & handlers
        setDisplayAmount,
        setSelectedFromToken,
        setSelectedToToken,
        setMicroAmount,
        setUserAddress,
        fetchQuote,
        handleSwap,
        handleSwitchTokens,
        clearBalanceCache,
    } as const;
} 