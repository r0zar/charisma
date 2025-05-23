import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getQuote, getRoutableTokens, getStxBalance, getTokenBalance, listTokens as fetchAllTokensServerAction } from "../app/actions";
import { useWallet } from "../contexts/wallet-context";
import { listPrices, KraxelPriceData, SIP10, TokenCacheData } from '@repo/tokens';
import { buildSwapTransaction, loadVaults, Route, Router } from "dexterity-sdk";
import { tupleCV, stringAsciiCV, uintCV, principalCV, noneCV, optionalCVOf } from '@stacks/transactions';
import { request } from "@stacks/connect";
import { TransactionResult } from "@stacks/connect/dist/types/methods";

interface UseSwapOptions {
    initialTokens?: TokenCacheData[];
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
    const [selectedTokens, setSelectedTokens] = useState<TokenCacheData[]>(initialTokens);
    const [routeableTokenIds, setRouteableTokenIds] = useState<Set<string>>(new Set());
    const [isInitializing, setIsInitializing] = useState(true);
    const [isLoadingRouteInfo, setIsLoadingRouteInfo] = useState(false);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);
    const [mode, setMode] = useState<'swap' | 'order'>('swap');

    // User address state - now derived from wallet context
    const [userAddress, setUserAddress] = useState<string>("");

    const [selectedFromToken, setSelectedFromToken] = useState<TokenCacheData | null>(null);
    const [selectedToToken, setSelectedToToken] = useState<TokenCacheData | null>(null);

    // Balance states
    const [fromTokenBalance, setFromTokenBalance] = useState<string>("0");
    const [toTokenBalance, setToTokenBalance] = useState<string>("0");

    const [displayAmount, setDisplayAmount] = useState<string>("");
    const [microAmount, setMicroAmount] = useState<string>("");

    const [quote, setQuote] = useState<Route | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = useState(false);
    const [swapSuccessInfo, setSwapSuccessInfo] = useState<TransactionResult | null>(null);

    // Price state
    const [tokenPrices, setTokenPrices] = useState<KraxelPriceData>({});
    const [isLoadingPrices, setIsLoadingPrices] = useState(false);
    const [priceError, setPriceError] = useState<string | null>(null);

    // Balance cache ref (will persist between renders but won't cause re-renders)
    const balanceCacheRef = useRef<BalanceCache>({});

    const router = useRef<Router>(new Router({
        maxHops: 4,
        defaultSlippage: 0.05,
        routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
    }));

    useEffect(() => {
        loadVaults(router.current);
    }, []);

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
        async function fetchRawPrices() {
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
        fetchRawPrices();
    }, []);

    // Token loading logic (server‑prefetched vs. client fetch)
    useEffect(() => {
        async function fetchTokensClient() {
            setIsLoadingTokens(true);
            setError(null);
            try {
                // Step 1: Fetch all tokens with full metadata
                const allTokensResult = await fetchAllTokensServerAction();

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
            const formattedBalance = formatTokenAmount(balance, decimals);

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
                    selectedFromToken.decimals!
                );
                setFromTokenBalance(balance);
            }

            // Fetch "to" token balance
            if (selectedToToken) {
                const balance = await getTokenBalanceWithCache(
                    selectedToToken.contractId,
                    userAddress,
                    selectedToToken.decimals!
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
            if (decimals! >= 0 && !isNaN(microAmountOut)) {
                const humanReadableAmountOut = microAmountOut / Math.pow(10, decimals!);

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
                tokenCounterparts: new Map<string, { mainnet: TokenCacheData | null; subnet: TokenCacheData | null }>()
            };
        }

        // Mainnet tokens: type !== 'SUBNET'
        const mainnetTokens = selectedTokens.filter(t => t.type !== 'SUBNET');
        // Subnet tokens: type === 'SUBNET'
        const subnetTokens = selectedTokens.filter(t => t.type === 'SUBNET');

        // Map base contractId to { mainnet, subnet }
        const tokenCounterparts = new Map<string, { mainnet: TokenCacheData | null; subnet: TokenCacheData | null }>();
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

    const hasBothVersions = useCallback((token: TokenCacheData | null): boolean => {
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
    const setSelectedFromTokenSafe = (t: TokenCacheData) => {
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
            if (result && result.data) {
                setQuote(result.data);
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

            const txCfg = await buildSwapTransaction(router.current, quote, walletAddress);
            const res = await request('stx_callContract', txCfg);
            console.log("Swap result:", res);

            if ("error" in res) {
                console.error("Swap failed:", res.error);
                setError("Swap failed");
                return;
            }

            // Clear balance cache after successful swap
            clearBalanceCache();
            setSwapSuccessInfo(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        }
    }

    function handleSwitchTokens() {
        if (!selectedFromToken || !selectedToToken) return;
        setSelectedFromToken(selectedToToken);
        setSelectedToToken(selectedFromToken);
        setMicroAmount(convertToMicroUnits(displayAmount, selectedToToken.decimals!));
    }

    /**
     * Create a triggered swap order (off-chain limit order)
     */
    async function createTriggeredSwap(opts: {
        conditionToken: TokenCacheData;
        baseToken: TokenCacheData | null;
        targetPrice: string;
        direction: 'lt' | 'gt';
        amountDisplay: string;
        validFrom?: string;
        validTo?: string;
    }) {

        if (!walletAddress) throw new Error('Connect wallet');
        const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        const micro = convertToMicroUnits(opts.amountDisplay, selectedFromToken?.decimals || 6);

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
        formatTokenAmount,
        convertToMicroUnits,
        convertFromMicroUnits,
        getTokenLogo,

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


async function signTriggeredSwap({
    subnetTokenContractId,
    uuid,
    amountMicro,
    multihopContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9',
    intent = 'TRANSFER_TOKENS',
    domainName = 'BLAZE_PROTOCOL',
    version = 'v1.0',
}: {
    subnetTokenContractId: string;
    uuid: string;
    amountMicro: bigint; // already in micro units
    multihopContractId?: string;
    intent?: string;
    domainName?: string;
    version?: string;
}): Promise<string> {
    const domain = tupleCV({
        name: stringAsciiCV(domainName),
        version: stringAsciiCV(version),
        'chain-id': uintCV(1),
    });

    const message = tupleCV({
        contract: principalCV(subnetTokenContractId),
        intent: stringAsciiCV(intent),
        opcode: noneCV(),
        amount: optionalCVOf(uintCV(amountMicro)),
        target: optionalCVOf(principalCV(multihopContractId)),
        uuid: stringAsciiCV(uuid),
    });

    // @ts-ignore – upstream types don't include method yet
    const res = await request('stx_signStructuredMessage', { domain, message });
    if (!res?.signature) throw new Error('User cancelled the signature');
    return res.signature as string; // raw 65-byte hex
}

/**
 * Utility functions for working with token amounts
 */
function formatTokenAmount(amount: number, decimals: number): string {
    return (amount / Math.pow(10, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Convert user input to micro units based on token decimals
 */
function convertToMicroUnits(input: string, decimals: number): string {
    if (!input || input === '') return '0';
    try {
        const floatValue = parseFloat(input);
        if (isNaN(floatValue)) return '0';
        return Math.floor(floatValue * Math.pow(10, decimals)).toString();
    } catch {
        return '0';
    }
}

/**
 * Convert micro units to human readable format for input
 */
function convertFromMicroUnits(microUnits: string, decimals: number): string {
    if (!microUnits || microUnits === '0') return '';
    return (parseFloat(microUnits) / Math.pow(10, decimals)).toLocaleString(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals
    });
}

/**
 * Get token logo URL
 */
function getTokenLogo(token: TokenCacheData): string {
    if (token.image) {
        return token.image;
    }

    const symbol = token.symbol?.toLowerCase() || '';

    if (symbol === "stx") {
        return "https://assets.coingecko.com/coins/images/2069/standard/Stacks_logo_full.png";
    } else if (symbol.includes("btc") || symbol.includes("xbtc")) {
        return "https://assets.coingecko.com/coins/images/1/standard/bitcoin.png";
    } else if (symbol.includes("usda")) {
        return "https://assets.coingecko.com/coins/images/17333/standard/usda.png";
    }

    // Default logo - first 2 characters of symbol
    return `https://placehold.co/32x32?text=${(token.symbol || "??").slice(0, 2)}`;
}
