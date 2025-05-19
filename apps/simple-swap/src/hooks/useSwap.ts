import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getQuote, getRoutableTokens, getStxBalance, getTokenBalance, listTokens } from "../app/actions";
import { createSwapClient, Token } from "../lib/swap-client";
import { useWallet } from "../contexts/wallet-context";
import { listPrices, KraxelPriceData } from '@repo/tokens';
import { signTriggeredSwap } from "@/lib/swap-client";

/**
 * Vault instance representing a liquidity pool
 */
interface Vault {
    type: string;
    contractId: string;
    contractAddress: string;
    contractName: string;
    name: string;
    symbol: string;
    decimals: number;
    identifier: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId: string;
    engineContractId: string;
    tokenA: Token;
    tokenB: Token;
    reservesA: number;
    reservesB: number;
}

/**
 * Route between tokens
 */
export interface Route {
    path: Token[];
    hops: Hop[];
    amountIn: number;
    amountOut: number;
}

/**
 * Hop in a route
 */
export interface Hop {
    vault: Vault;
    tokenIn: Token;
    tokenOut: Token;
    opcode: number;
    quote?: {
        amountIn: number;
        amountOut: number;
    };
}

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

export function useSwap({ initialTokens = [] }: UseSwapOptions = {}) {
    // Get wallet state from context
    const { address: walletAddress } = useWallet();

    // ---------------------- State ----------------------
    const [selectedTokens, setSelectedTokens] = useState<Token[]>(initialTokens);
    const [routeableTokenIds, setRouteableTokenIds] = useState<Set<string>>(new Set());
    const [isInitializing, setIsInitializing] = useState(true);
    const [isLoadingRouteInfo, setIsLoadingRouteInfo] = useState(false);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);
    const [mode, setMode] = useState<'swap' | 'order'>('swap');

    // User address state - now derived from wallet context
    const [userAddress, setUserAddress] = useState<string>("");

    const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
    const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);

    // Balance states
    const [fromTokenBalance, setFromTokenBalance] = useState<string>("0");
    const [toTokenBalance, setToTokenBalance] = useState<string>("0");

    const [displayAmount, setDisplayAmount] = useState<string>("");
    const [microAmount, setMicroAmount] = useState<string>("");

    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [swapSuccessInfo, setSwapSuccessInfo] = useState<{ txId: string } | null>(null);

    // Price state
    const [tokenPrices, setTokenPrices] = useState<KraxelPriceData>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [priceError, setPriceError] = useState<string | null>(null);

    // Balance cache ref (will persist between renders but won't cause re-renders)
    const balanceCacheRef = useRef<BalanceCache>({});

    // Initialize swap client
    const swapClient = createSwapClient({ stxAddress: walletAddress });

    // Update userAddress when wallet address changes
    useEffect(() => {
        if (walletAddress) {
            setUserAddress(walletAddress);
            // Clear balance cache when wallet changes
            clearBalanceCache();
        } else {
            setUserAddress("");
        }
    }, [walletAddress]);

    // ---------------------- Effects ----------------------
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

    // Token loading logic (server‑prefetched vs. client fetch)
    useEffect(() => {
        async function fetchTokensClient() {
            setIsLoadingTokens(true);
            setError(null);
            try {
                // Step 1: Fetch all tokens with full metadata
                const allTokensResult = await listTokens();

                if (!allTokensResult.success || !allTokensResult.tokens) {
                    setError("Failed to load token list.");
                    setIsLoadingTokens(false); // Ensure loading state is reset
                    setIsInitializing(false);
                    return;
                }

                // Step 2: Fetch the IDs of routable tokens
                const routableIdsResult = await getRoutableTokens();

                if (!routableIdsResult.success || !routableIdsResult.tokens) {
                    setError("Failed to determine routable tokens.");
                    setIsLoadingTokens(false); // Ensure loading state is reset
                    setIsInitializing(false);
                    return;
                }
                const routableTokenIdsSet = new Set(routableIdsResult.tokens.map(t => t.contractId));

                // Step 3: Filter all tokens to get full metadata for only routable ones
                // Ensure allTokensResult.tokens is not undefined before filtering
                const routableTokensWithMeta = (allTokensResult.tokens || []).filter(t => routableTokenIdsSet.has(t.contractId));

                setSelectedTokens(routableTokensWithMeta);
                setRouteableTokenIds(routableTokenIdsSet);

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
    }, []);

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
                balance = await getStxBalance(address);
            } else {
                balance = await getTokenBalance(contractId, address);
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
            if (!userAddress || userAddress.trim() === '') return;

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

    // ---------------------- Derived Values (USD) ----------------------
    const { fromTokenValueUsd, toTokenValueUsd } = useMemo(() => {
        let fromValue: number | null = null;
        let toValue: number | null = null;

        if (tokenPrices && selectedFromToken && displayAmount) {
            const price = tokenPrices[selectedFromToken.contractId];
            const amount = parseFloat(displayAmount);
            if (price !== undefined && !isNaN(amount)) {
                fromValue = amount * price;
            }
        }

        if (tokenPrices && selectedToToken && quote?.amountOut) {
            const price = tokenPrices[selectedToToken.contractId];
            const microAmountOut = Number(quote.amountOut);
            const decimals = selectedToToken.decimals;
            if (decimals >= 0 && !isNaN(microAmountOut)) {
                const humanReadableAmountOut = microAmountOut / Math.pow(10, decimals);

                if (price !== undefined && !isNaN(humanReadableAmountOut) && !isNaN(price)) {
                    toValue = humanReadableAmountOut * price;
                } else {
                    console.warn('[useSwap] Invalid price or calculated amount for toTokenValueUsd', { price, humanReadableAmountOut });
                }
            } else {
                console.warn('[useSwap] Invalid decimals or microAmountOut for toTokenValueUsd', { decimals, microAmountOut });
            }
        }

        return {
            fromTokenValueUsd: fromValue,
            toTokenValueUsd: toValue,
        };
    }, [tokenPrices, selectedFromToken, selectedToToken, displayAmount, quote]);

    // --------------------------------------------------------------
    // Token mapping helpers (mainnet vs. subnet versions)
    // --------------------------------------------------------------
    const { displayTokens, subnetDisplayTokens, tokenCounterparts } = useMemo(() => {
        if (!selectedTokens || selectedTokens.length === 0) {
            return {
                displayTokens: [],
                subnetDisplayTokens: [],
                tokenCounterparts: new Map<string, { mainnet: Token | null; subnet: Token | null }>()
            };
        }

        // Mainnet tokens: type !== 'SUBNET'
        const mainnetTokens = selectedTokens.filter(t => t.type !== 'SUBNET');
        // Subnet tokens: type === 'SUBNET'
        const subnetTokens = selectedTokens.filter(t => t.type === 'SUBNET');

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

        // displayTokens: only mainnet tokens
        // subnetDisplayTokens: only subnet tokens
        const sortedDisplayTokens = mainnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
        const sortedSubnetTokens = subnetTokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

        return {
            displayTokens: sortedDisplayTokens,
            subnetDisplayTokens: sortedSubnetTokens,
            tokenCounterparts
        };
    }, [selectedTokens]);

    const hasBothVersions = useCallback((token: Token | null): boolean => {
        if (!token) return false;
        if (token.type === 'SUBNET') {
            // Subnet token: check if mainnet exists
            return !!(token.base && tokenCounterparts.get(token.base)?.mainnet);
        } else {
            // Mainnet token: check if subnet exists
            return !!tokenCounterparts.get(token.contractId)?.subnet;
        }
    }, [tokenCounterparts]);

    // Safe setter that optionally forces subnet version if in order mode
    const setSelectedFromTokenSafe = (t: Token) => {
        if (t.type !== 'SUBNET' && mode === 'order') return
        setSelectedFromToken(t);
    }

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
            const res = await swapClient.executeSwap(quote.route as any);
            console.log("Swap result:", res);

            if ("error" in res) {
                setError(res.error || "Swap failed");
                return;
            }

            // Clear balance cache after successful swap
            clearBalanceCache();
            setSwapSuccessInfo({ txId: res.txId });
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

    /**
     * Create a triggered swap order (off-chain limit order)
     */
    async function createTriggeredSwap(opts: {
        conditionToken: Token;
        baseToken: Token | null;
        targetPrice: string;
        direction: 'lt' | 'gt';
        amountDisplay: string;
        validFrom?: string;
        validTo?: string;
    }) {
        if (!walletAddress) throw new Error('Connect wallet');
        const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        const micro = swapClient.convertToMicroUnits(opts.amountDisplay, selectedFromToken?.decimals || 6);

        const signature = await signTriggeredSwap({
            subnetTokenContractId: selectedFromToken?.contractId!,
            uuid,
            amountMicro: BigInt(micro),
            multihopContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9',
        });

        const payload: Record<string, unknown> = {
            owner: walletAddress,
            inputToken: selectedFromToken?.contractId,
            outputToken: selectedToToken?.contractId,
            amountIn: micro,
            targetPrice: opts.targetPrice,
            direction: opts.direction,
            conditionToken: opts.conditionToken.contractId,
            baseAsset: opts.baseToken ? opts.baseToken.contractId : 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt',
            recipient: walletAddress,
            signature,
            uuid,
        };

        if (opts.validFrom) payload.validFrom = opts.validFrom;
        if (opts.validTo) payload.validTo = opts.validTo;

        const res = await fetch('/api/v1/orders/new', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const j = await res.json().catch(() => ({ error: 'unknown' }));
            throw new Error(j.error || 'Order create failed');
        }

        return await res.json();
    }

    // ---------------------- Return API ----------------------
    return {
        // data
        selectedTokens,
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
        tokenPrices,

        // mode
        mode,
        setMode,

        // token display helpers (mainnet / subnet)
        displayTokens,
        subnetDisplayTokens,
        tokenCounterparts,
        hasBothVersions,

        // loading flags
        isInitializing,
        isLoadingTokens,
        isLoadingRouteInfo,
        isLoadingQuote,
        isLoadingPrices,
        priceError,

        // helpers from swapClient
        formatTokenAmount: swapClient.formatTokenAmount,
        convertToMicroUnits: swapClient.convertToMicroUnits,
        convertFromMicroUnits: swapClient.convertFromMicroUnits,
        getTokenLogo: swapClient.getTokenLogo,

        // setters & handlers
        setDisplayAmount,
        setSelectedToToken,
        setMicroAmount,
        setUserAddress,
        fetchQuote,
        handleSwap,
        handleSwitchTokens,
        clearBalanceCache,
        createTriggeredSwap,

        // safe setters
        setSelectedFromTokenSafe,

        // derived values
        fromTokenValueUsd,
        toTokenValueUsd,
    };
} 