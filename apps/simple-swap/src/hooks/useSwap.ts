import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getQuote, getRoutableTokens, getStxBalance, getTokenBalance, listTokens as fetchAllTokensServerAction } from "../app/actions";
import { useWallet } from "../contexts/wallet-context";
import { listPrices, KraxelPriceData, SIP10, TokenCacheData } from '@repo/tokens';
import { buildSwapTransaction, loadVaults, Route, Router } from "dexterity-sdk";
import { tupleCV, stringAsciiCV, uintCV, principalCV, noneCV, optionalCVOf, bufferCV, Pc } from '@stacks/transactions';
import { request } from "@stacks/connect";
import { TransactionResult } from "@stacks/connect/dist/types/methods";

interface UseSwapOptions {
    initialTokens?: TokenCacheData[];
    searchParams?: URLSearchParams;
}

// Cache validity period in milliseconds (30 minutes)
const CACHE_EXPIRY = 30 * 60 * 1000;
const USD_PRECISION = 6;

// LocalStorage keys for token preferences
const STORAGE_KEYS = {
    FROM_TOKEN: 'charisma_swap_from_token',
    TO_TOKEN: 'charisma_swap_to_token',
    CONDITION_TOKEN: 'charisma_swap_condition_token',
    BASE_TOKEN: 'charisma_swap_base_token',
    MODE: 'charisma_swap_mode',
    USE_SUBNET_FROM: 'charisma_swap_use_subnet_from',
    USE_SUBNET_TO: 'charisma_swap_use_subnet_to',
} as const;

// Helper functions for localStorage
const saveToStorage = (key: string, value: any) => {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch (err) {
        console.warn('Failed to save to localStorage:', err);
    }
};

const loadFromStorage = (key: string) => {
    try {
        if (typeof window !== 'undefined') {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        }
    } catch (err) {
        console.warn('Failed to load from localStorage:', err);
    }
    return null;
};

// Balance cache interface
interface BalanceCache {
    [key: string]: {
        balance: string;
        timestamp: number;
    };
}

interface PriceImpact {
    impact: number | null;
    fromValueUsd: number | null;
    toValueUsd: number | null;
}

interface TotalPriceImpact {
    inputValueUsd: number;
    outputValueUsd: number;
    priceImpact: number | null;
}

interface BalanceCheckResult {
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
}

interface SwapOption {
    fromToken: TokenCacheData;
    fromBalance: number; // User's total balance of this token
    swapAmount: number; // Amount we suggest swapping (just what's needed)
    estimatedOutput: number;
    route?: any;
}

export function useSwap({ initialTokens = [], searchParams }: UseSwapOptions = {}) {
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

    // Order mode state
    const [targetPrice, setTargetPrice] = useState('');
    const [conditionToken, setConditionToken] = useState<TokenCacheData | null>(null);
    const [baseToken, setBaseToken] = useState<TokenCacheData | null>(null); // null = USD
    const [conditionDir, setConditionDir] = useState<'lt' | 'gt'>('gt');

    // Subnet toggle state
    const [useSubnetFrom, setUseSubnetFrom] = useState(false);
    const [useSubnetTo, setUseSubnetTo] = useState(false);

    // Base token selections for UI consistency
    const [baseSelectedFromToken, setBaseSelectedFromToken] = useState<TokenCacheData | null>(null);
    const [baseSelectedToToken, setBaseSelectedToToken] = useState<TokenCacheData | null>(null);

    // Initialization tracking
    const [initDone, setInitDone] = useState(false);

    // DCA dialog state
    const [dcaDialogOpen, setDcaDialogOpen] = useState(false);

    // Transaction state
    const [swapping, setSwapping] = useState(false);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);

    // Pro mode state
    const [isProMode, setIsProMode] = useState(false);

    // Balance cache ref (will persist between renders but won't cause re-renders)
    const balanceCacheRef = useRef<BalanceCache>({});

    // Ref to track previous mode
    const prevModeRef = useRef<string>(mode);

    const router = useRef<Router>(new Router({
        maxHops: 4,
        defaultSlippage: 0.05,
        routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
    }));

    // New state for balance checking
    const [allTokenBalances, setAllTokenBalances] = useState<Map<string, number>>(new Map());
    const [isCheckingBalances, setIsCheckingBalances] = useState(false);
    const [isLoadingSwapOptions, setIsLoadingSwapOptions] = useState(false);
    const [balanceCheckResult, setBalanceCheckResult] = useState<BalanceCheckResult | null>(null);

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

    // ---------------------- URL Parameter Handling ----------------------
    const urlParams = useMemo(() => {
        if (!searchParams) return {};
        return {
            fromSymbol: searchParams.get('fromSymbol') ?? undefined,
            toSymbol: searchParams.get('toSymbol') ?? undefined,
            amount: searchParams.get('amount') ?? undefined,
            mode: searchParams.get('mode') as 'swap' | 'order' | undefined,
            targetPrice: searchParams.get('targetPrice') ?? undefined,
            direction: searchParams.get('direction') as 'lt' | 'gt' | undefined,
            conditionToken: searchParams.get('conditionToken') ?? undefined,
            baseAsset: searchParams.get('baseAsset') ?? undefined,
            fromSubnet: searchParams.get('fromSubnet') ?? undefined,
            toSubnet: searchParams.get('toSubnet') ?? undefined,
        };
    }, [searchParams]);

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

    // ---------------------- URL Parameter Initialization ----------------------
    // Initialize component state from deep-link once tokens & lists are ready
    useEffect(() => {
        if (initDone || !selectedTokens.length) return;

        const { mode: m, targetPrice: tp, direction: dir, fromSymbol, toSymbol, amount } = urlParams;

        if (m === 'order') setMode('order');
        if (tp) setTargetPrice(tp);
        if (dir === 'lt' || dir === 'gt') setConditionDir(dir);

        if (fromSymbol) {
            const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === fromSymbol.toLowerCase());
            if (t) setBaseSelectedFromToken(t);
        }

        if (toSymbol) {
            const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === toSymbol.toLowerCase());
            if (t) setBaseSelectedToToken(t);
        }

        if (amount && !isNaN(Number(amount))) {
            setDisplayAmount(amount);
        }

        // Apply subnet toggle preferences from deep link
        const fromSubnetFlag = urlParams.fromSubnet === '1' || urlParams.fromSubnet === 'true';
        const toSubnetFlag = urlParams.toSubnet === '1' || urlParams.toSubnet === 'true';

        if (fromSubnetFlag) setUseSubnetFrom(true);
        if (toSubnetFlag) setUseSubnetTo(true);

        if (urlParams.conditionToken) {
            const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === urlParams.conditionToken!.toLowerCase());
            if (t) setConditionToken(t);
        }

        if (urlParams.baseAsset) {
            const t = selectedTokens.find(tok => tok.symbol.toLowerCase() === urlParams.baseAsset!.toLowerCase());
            if (t) setBaseToken(t);
        }

        setInitDone(true);
    }, [selectedTokens, urlParams]);

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
        if (t.type !== 'SUBNET' && mode === 'order') {
            // If user tries to select a non-subnet token in order mode,
            // check if the token has a subnet version
            if (!hasBothVersions(t)) {
                // Token doesn't have subnet support, switch to swap mode
                setMode('swap');
                setSelectedFromToken(t);
                return;
            }
            // Token has subnet support, don't set it (keep existing behavior)
            return;
        }
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
        setSwapping(true);
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
            console.error('Swap failed:', err);
            setError(err instanceof Error ? err.message : "An unexpected error occurred");
        } finally {
            setSwapping(false);
        }
    }

    function handleSwitchTokens() {
        if (!selectedFromToken || !selectedToToken) return;

        // Store the current tokens before switching
        const currentFromToken = selectedFromToken;
        const currentToToken = selectedToToken;

        // Switch the tokens
        setSelectedFromToken(currentToToken);
        setSelectedToToken(currentFromToken);

        // Reverse the amounts - use current output amount as new input amount
        if (quote && quote.amountOut) {
            // Use the current output amount as the new display amount
            const newDisplayAmount = formatTokenAmount(Number(quote.amountOut), currentToToken.decimals || 0);
            setDisplayAmount(newDisplayAmount);

            // Update microAmount for the new "from" token (which is the current "to" token)
            setMicroAmount(convertToMicroUnits(newDisplayAmount, currentToToken.decimals || 0));
        } else {
            // If no quote, just recalculate microAmount with current display amount for new token
            setMicroAmount(convertToMicroUnits(displayAmount, currentToToken.decimals || 0));
        }
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

    // ---------------------- Limit Order Handlers ----------------------
    async function handleCreateLimitOrder() {
        if (!selectedFromToken || !selectedToToken) return;
        if (!displayAmount || Number(displayAmount) <= 0) return;
        if (!targetPrice) return;

        try {
            await createTriggeredSwap({
                conditionToken: conditionToken || selectedToToken,
                baseToken,
                targetPrice,
                direction: conditionDir,
                amountDisplay: displayAmount,
            });
        } catch (err) {
            console.error('Error creating triggered swap:', err);
        }
    }

    // Callback for DcaDialog to create a single slice order
    async function createSingleOrder({ amountDisplay, validFrom, validTo }: { amountDisplay: string; validFrom: string; validTo: string }) {
        await createTriggeredSwap({
            conditionToken: conditionToken || selectedToToken!,
            baseToken,
            targetPrice,
            direction: conditionDir,
            amountDisplay,
            validFrom,
            validTo,
        });
    }

    // ---------------------- Order Mode Handlers ----------------------
    const handleBumpPrice = useCallback((percent: number) => {
        const current = parseFloat(targetPrice || '0');
        if (isNaN(current) || current === 0) return;
        const updated = current * (1 + percent);
        setTargetPrice(updated.toPrecision(9));
    }, [targetPrice]);

    // Enhanced token switch handler that also swaps subnet toggles
    const handleSwitchTokensEnhanced = useCallback(() => {
        if (!selectedFromToken || !selectedToToken) return;

        // Token reversal with amount reversal is handled in the base handleSwitchTokens
        handleSwitchTokens();

        // Also swap the base token selections for UI consistency
        setBaseSelectedFromToken(baseSelectedToToken);
        setBaseSelectedToToken(baseSelectedFromToken);

        // Swap subnet toggles
        const prevFrom = useSubnetFrom;
        setUseSubnetFrom(useSubnetTo);
        setUseSubnetTo(prevFrom);
    }, [selectedFromToken, selectedToToken, handleSwitchTokens, baseSelectedFromToken, baseSelectedToToken, useSubnetFrom, useSubnetTo]);

    // ---------------------- Price Impact Calculations ----------------------
    const { priceImpacts, totalPriceImpact } = useMemo(() => {
        if (!quote || !tokenPrices) {
            return { priceImpacts: [], totalPriceImpact: null };
        }

        // Helper to get price, handling the ".stx" vs "stx" key difference
        const getPrice = (contractId: string): number | undefined => {
            return contractId === '.stx' ? tokenPrices['stx'] : tokenPrices[contractId];
        };

        // Calculate price impact for each hop
        const hopImpacts: PriceImpact[] = quote.hops.map((hop, index) => {
            const fromToken = quote.path[index];
            const toToken = quote.path[index + 1];

            const fromPrice = getPrice(fromToken.contractId);
            const toPrice = getPrice(toToken.contractId);

            if (fromPrice === undefined || toPrice === undefined) {
                return { impact: null, fromValueUsd: null, toValueUsd: null };
            }

            // Calculate USD values
            const fromValueUsd = Number(hop.quote?.amountIn || 0) * fromPrice / (10 ** (fromToken.decimals || 6));
            const toValueUsd = Number(hop.quote?.amountOut || 0) * toPrice / (10 ** (toToken.decimals || 6));

            if (isNaN(fromValueUsd) || isNaN(toValueUsd) || fromValueUsd === 0) {
                return { impact: null, fromValueUsd: isNaN(fromValueUsd) ? null : fromValueUsd, toValueUsd: isNaN(toValueUsd) ? null : toValueUsd };
            }

            const impact = ((toValueUsd / fromValueUsd) - 1) * 100;

            return {
                impact: isNaN(impact) ? null : impact,
                fromValueUsd,
                toValueUsd
            };
        });

        // Calculate total price impact
        let totalImpact: TotalPriceImpact | null = null;
        if (selectedFromToken && selectedToToken && microAmount) {
            const fromPrice = getPrice(selectedFromToken.contractId);
            const toPrice = getPrice(selectedToToken.contractId);

            if (fromPrice !== undefined && toPrice !== undefined) {
                const inputValueUsd = Number(microAmount) * fromPrice / (10 ** selectedFromToken.decimals!);
                const outputValueUsd = Number(quote.amountOut) * toPrice / (10 ** selectedToToken.decimals!);

                if (!isNaN(inputValueUsd) && !isNaN(outputValueUsd) && inputValueUsd !== 0) {
                    const priceImpact = ((outputValueUsd / inputValueUsd) - 1) * 100;
                    totalImpact = {
                        inputValueUsd,
                        outputValueUsd,
                        priceImpact: isNaN(priceImpact) ? null : priceImpact
                    };
                }
            }
        }

        return { priceImpacts: hopImpacts, totalPriceImpact: totalImpact };
    }, [quote, tokenPrices, selectedFromToken, selectedToToken, microAmount]);

    // ---------------------- Security Level ----------------------
    const securityLevel = useMemo((): 'high' | 'medium' | 'low' => {
        if (!quote) return 'high';
        const hops = quote.path.length - 1;
        if (hops === 1) return 'high';
        else if (hops === 2) return 'medium';
        else return 'low';
    }, [quote]);

    // ---------------------- Helper Functions ----------------------
    const formatUsd = useCallback((value: number | null) => {
        if (value === null || isNaN(value)) return null;
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }, []);

    // Enhanced getUsdPrice with historical fallback
    const [historicalPrices, setHistoricalPrices] = useState<Map<string, number>>(new Map());

    const getUsdPrice = useCallback((contractId: string): number | undefined => {
        if (!tokenPrices) return undefined;

        // Handle STX special case
        if (contractId === '.stx') return tokenPrices['stx'];

        // Try to get direct price first
        let price = tokenPrices[contractId];
        if (price !== undefined) return price;

        // If no direct price, check if this is a subnet token and try base token price
        const token = selectedTokens.find(t => t.contractId === contractId);
        if (token && token.type === 'SUBNET' && token.base) {
            price = tokenPrices[token.base];
            if (price !== undefined) return price;
        }

        // If still no current price, try historical price from cache
        const historicalPrice = historicalPrices.get(contractId);
        if (historicalPrice !== undefined) return historicalPrice;

        // If it's a subnet token and no historical price, try base token historical price
        if (token && token.type === 'SUBNET' && token.base) {
            const baseHistoricalPrice = historicalPrices.get(token.base);
            if (baseHistoricalPrice !== undefined) return baseHistoricalPrice;
        }

        return undefined;
    }, [tokenPrices, selectedTokens, historicalPrices]);

    // Function to fetch and cache historical prices for tokens without current prices
    const fetchHistoricalPrices = useCallback(async (contractIds: string[]) => {
        const newHistoricalPrices = new Map(historicalPrices);
        let hasUpdates = false;

        for (const contractId of contractIds) {
            // Skip if we already have a cached historical price
            if (historicalPrices.has(contractId)) continue;

            try {
                const response = await fetch(`/api/price-latest?contractId=${encodeURIComponent(contractId)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.price !== undefined) {
                        newHistoricalPrices.set(contractId, data.price);
                        hasUpdates = true;
                    }
                }
            } catch (error) {
                console.warn(`Failed to fetch historical price for ${contractId}:`, error);
            }
        }

        if (hasUpdates) {
            setHistoricalPrices(newHistoricalPrices);
        }
    }, [historicalPrices]);

    // Effect to fetch historical prices for tokens without current prices
    useEffect(() => {
        if (!selectedTokens.length || !tokenPrices) return;

        // Find tokens that don't have current prices and don't have cached historical prices
        const tokensWithoutPrices = selectedTokens
            .filter(token => {
                // Check if we have a current price
                const hasCurrentPrice = tokenPrices[token.contractId] !== undefined ||
                    (token.contractId === '.stx' && tokenPrices['stx'] !== undefined) ||
                    (token.type === 'SUBNET' && token.base && tokenPrices[token.base] !== undefined);

                // Check if we have a cached historical price
                const hasHistoricalPrice = historicalPrices.has(token.contractId) ||
                    (token.type === 'SUBNET' && token.base && historicalPrices.has(token.base));

                return !hasCurrentPrice && !hasHistoricalPrice;
            })
            .map(token => token.contractId);

        if (tokensWithoutPrices.length > 0) {
            fetchHistoricalPrices(tokensWithoutPrices);
        }
    }, [selectedTokens, tokenPrices, historicalPrices, fetchHistoricalPrices]);

    // ---------------------- UI Helper Logic ----------------------
    // Determine which tokens are currently displayed in dropdowns (could be base or subnet)
    const displayedFromToken = useMemo(() => {
        if (!selectedFromToken || !displayTokens.length) return null;

        return displayTokens.find(dt => {
            const baseId = dt.type === 'SUBNET' ? dt.base! : dt.contractId;
            const selectedBaseId = selectedFromToken.type === 'SUBNET'
                ? selectedFromToken.base!
                : selectedFromToken.contractId;
            return baseId === selectedBaseId;
        }) || null;
    }, [selectedFromToken, displayTokens]);

    const displayedToToken = useMemo(() => {
        if (!selectedToToken || !displayTokens.length) return null;

        return displayTokens.find(dt => {
            const baseId = dt.type === 'SUBNET' ? dt.base! : dt.contractId;
            const selectedBaseId = selectedToToken.type === 'SUBNET'
                ? selectedToToken.base!
                : selectedToToken.contractId;
            return baseId === selectedBaseId;
        }) || null;
    }, [selectedToToken, displayTokens]);

    // Determine if this is a subnet shift operation
    const isSubnetShift = useMemo(() => {
        return quote?.hops.some((hop: any) => hop.vault.type === 'SUBLINK') || false;
    }, [quote]);

    // Get shift direction for label customization
    const shiftDirection = useMemo((): 'to-subnet' | 'from-subnet' | null => {
        if (!isSubnetShift || !selectedToToken) return null;
        return selectedToToken.contractId.includes('-subnet') ? 'to-subnet' : 'from-subnet';
    }, [isSubnetShift, selectedToToken]);

    // Custom label based on operation type
    const toLabel = useMemo(() => {
        if (isSubnetShift) {
            return shiftDirection === 'to-subnet' ? 'You receive in subnet' : 'You receive in mainnet';
        }
        return 'You receive';
    }, [isSubnetShift, shiftDirection]);

    // Effect to handle mode changes, specifically defaulting for 'order' mode
    useEffect(() => {
        // Update prevModeRef *after* checking the condition
        const prevMode = prevModeRef.current;
        prevModeRef.current = mode;
        // Only default condition token when switching *into* order mode and not deep-linked tokens
        if (mode === 'order' && prevMode !== 'order' && !conditionToken && !urlParams.fromSymbol && !urlParams.toSymbol) {
            // Locate the base (main-net) sBTC token in the available list
            const sbtcBase = displayTokens.find((t) => t.contractId.includes('.sbtc-token'));
            const charismaBase = displayTokens.find((t) => t.contractId.includes('.charisma-token'));

            if (!sbtcBase) {
                return;
            }

            // 1. Select sBTC as the base FROM token - REQUIRED for subnet toggle effect
            setBaseSelectedFromToken(charismaBase!);
            setSelectedFromTokenSafe(charismaBase!);
            setBaseToken(charismaBase!)

            // 2. Enable subnet mode for FROM token
            setUseSubnetFrom(true);

            // 3. Set the condition token to sBTC
            const counterparts = tokenCounterparts.get(sbtcBase.contractId);
            const sbtcToSet = counterparts?.subnet ?? sbtcBase;
            setConditionToken(sbtcToSet);
        }
        // No else needed - we don't want to interfere if the mode is not 'order' or if a token is already selected

    }, [mode, conditionToken, displayTokens, tokenCounterparts, setSelectedFromTokenSafe, urlParams.fromSymbol, urlParams.toSymbol]);

    // ---------------------- Target Price Management ----------------------
    // Default target price when token changes
    useEffect(() => {
        if (mode !== 'order') return;
        if (urlParams.targetPrice) return; // don't override deep-linked preset
        if (!conditionToken) return;
        const price = getUsdPrice(conditionToken.contractId);
        if (price !== undefined && targetPrice === '') {
            setTargetPrice(price.toFixed(6));
        }
    }, [conditionToken, mode, getUsdPrice, targetPrice, urlParams.targetPrice]);

    // Update target price when condition/base token or prices change
    useEffect(() => {
        if (mode !== 'order') return;
        if (urlParams.targetPrice) return; // don't override deep-linked preset
        if (!conditionToken) return;
        if (!tokenPrices || Object.keys(tokenPrices).length === 0) return;

        const getPrice = (t: TokenCacheData | null): number | undefined => {
            if (!t) return undefined;
            if (t.contractId === '.stx') return tokenPrices['stx'];
            return tokenPrices[t.contractId];
        };

        const condPrice = getPrice(conditionToken);
        const basePrice = baseToken ? getPrice(baseToken) : tokenPrices['SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt'];

        if (condPrice !== undefined && basePrice && basePrice !== 0) {
            const ratio = condPrice / basePrice;
            setTargetPrice(ratio.toFixed(6));
        }
    }, [conditionToken, baseToken, tokenPrices, mode, urlParams.targetPrice]);

    // ---------------------- Share Handler ----------------------
    const handleShare = useCallback(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams();
        if (selectedFromToken) params.set('fromSymbol', selectedFromToken.symbol);
        if (selectedToToken) params.set('toSymbol', selectedToToken.symbol);
        if (displayAmount) params.set('amount', displayAmount);
        if (useSubnetFrom) params.set('fromSubnet', '1');
        if (useSubnetTo) params.set('toSubnet', '1');
        if (mode === 'order') {
            params.set('mode', 'order');
            if (targetPrice) params.set('targetPrice', targetPrice);
            params.set('direction', conditionDir);
            // Include extra order params for deep-linking
            const condSymbol = (conditionToken || selectedToToken)?.symbol;
            if (condSymbol) params.set('conditionToken', condSymbol);
            if (baseToken) params.set('baseAsset', baseToken.symbol);
        }
        const shareUrl = `${window.location.origin}/swap?${params.toString()}`;
        const toTag = selectedToToken ? `$${selectedToToken.symbol}` : '';

        let text: string;

        if (mode === 'order') {
            // Limit/triggered order tweet copy remains unchanged for now
            text = `Planning an order on Charisma: ${displayAmount || ''} ${selectedFromToken?.symbol} → ${toTag} when price ${conditionDir === 'lt' ? '≤' : '≥'} ${targetPrice}. `;
        } else {
            // Swap mode
            if (shiftDirection === 'to-subnet') {
                text = `Subnet deposit: ${displayAmount || ''} ${selectedFromToken?.symbol} → ${toTag} (subnet) via Charisma`;
            } else if (shiftDirection === 'from-subnet') {
                text = `Subnet swap: ${displayAmount || ''} ${selectedFromToken?.symbol} (subnet) → ${toTag} via Charisma`;
            } else {
                text = `Swap ${displayAmount || ''} ${selectedFromToken?.symbol} for ${toTag} on Charisma`;
            }
        }

        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(tweetUrl, '_blank');
    }, [selectedFromToken, selectedToToken, displayAmount, useSubnetFrom, useSubnetTo, mode, targetPrice, conditionDir, conditionToken, baseToken, shiftDirection]);

    // Enhanced balance fetching for all user tokens
    const fetchAllUserBalances = useCallback(async (): Promise<Map<string, number>> => {
        if (!userAddress) return new Map();

        // Combine all available tokens (both mainnet and subnet) for balance fetching
        const allAvailableTokens = [...displayTokens, ...subnetDisplayTokens];
        if (!allAvailableTokens.length) return new Map();

        setIsCheckingBalances(true);
        const balanceMap = new Map<string, number>();

        try {
            // Fetch balances for all tokens in parallel
            const balancePromises = allAvailableTokens.map(async (token) => {
                try {
                    // Get raw balance directly instead of formatted string
                    let rawBalance = 0;
                    if (token.contractId === ".stx") {
                        rawBalance = await getStxBalance(userAddress);
                    } else {
                        rawBalance = await getTokenBalance(token.contractId, userAddress);
                    }

                    // Convert to human-readable format
                    const numericBalance = rawBalance / Math.pow(10, token.decimals || 6);
                    return { contractId: token.contractId, balance: numericBalance };
                } catch (err) {
                    console.error(`Failed to fetch balance for ${token.contractId}:`, err);
                    return { contractId: token.contractId, balance: 0 };
                }
            });

            const results = await Promise.all(balancePromises);
            results.forEach(({ contractId, balance }) => {
                balanceMap.set(contractId, balance);
            });

            setAllTokenBalances(balanceMap);
        } catch (err) {
            console.error('Failed to fetch all user balances:', err);
        } finally {
            setIsCheckingBalances(false);
        }

        return balanceMap;
    }, [userAddress, displayTokens, subnetDisplayTokens]);

    // Fast balance check that shows dialog immediately, then loads swap options progressively
    const checkBalanceForOrderFast = useCallback(async (
        token: TokenCacheData,
        amount: string
    ): Promise<BalanceCheckResult> => {
        const requiredAmount = parseFloat(amount);
        if (!token || !userAddress || isNaN(requiredAmount) || requiredAmount <= 0) {
            return {
                hasEnoughSubnet: false,
                hasEnoughMainnet: false,
                subnetBalance: 0,
                mainnetBalance: 0,
                requiredAmount,
                shortfall: requiredAmount,
                canDeposit: false,
                swapOptions: []
            };
        }

        // Step 1: Quick check of just the required tokens (subnet + mainnet versions)
        const counterparts = tokenCounterparts.get(token.type === 'SUBNET' ? token.base! : token.contractId);
        const subnetToken = token.type === 'SUBNET' ? token : counterparts?.subnet;
        const mainnetToken = token.type === 'SUBNET' ? counterparts?.mainnet : token;

        // Fast balance fetch for just the required tokens
        const balancePromises = [];
        if (subnetToken) {
            balancePromises.push(
                (async () => {
                    let rawBalance = 0;
                    if (subnetToken.contractId === ".stx") {
                        rawBalance = await getStxBalance(userAddress);
                    } else {
                        rawBalance = await getTokenBalance(subnetToken.contractId, userAddress);
                    }
                    const numericBalance = rawBalance / Math.pow(10, subnetToken.decimals || 6);
                    return { token: subnetToken, balance: numericBalance };
                })()
            );
        }
        if (mainnetToken && mainnetToken.contractId !== subnetToken?.contractId) {
            balancePromises.push(
                (async () => {
                    let rawBalance = 0;
                    if (mainnetToken.contractId === ".stx") {
                        rawBalance = await getStxBalance(userAddress);
                    } else {
                        rawBalance = await getTokenBalance(mainnetToken.contractId, userAddress);
                    }
                    const numericBalance = rawBalance / Math.pow(10, mainnetToken.decimals || 6);
                    return { token: mainnetToken, balance: numericBalance };
                })()
            );
        }

        const requiredBalances = await Promise.all(balancePromises);
        const subnetBalance = requiredBalances.find(b => b.token.contractId === subnetToken?.contractId)?.balance || 0;
        const mainnetBalance = requiredBalances.find(b => b.token.contractId === mainnetToken?.contractId)?.balance || 0;

        const hasEnoughSubnet = subnetBalance >= requiredAmount;
        const hasEnoughMainnet = mainnetBalance >= requiredAmount;

        // Calculate shortfall - how much more we need after accounting for available mainnet deposit
        const maxDepositAmount = Math.min(mainnetBalance, requiredAmount - subnetBalance);
        const shortfall = Math.max(0, requiredAmount - subnetBalance - maxDepositAmount);

        // Can deposit if we have any mainnet tokens and there's a subnet shortfall
        const canDeposit = (requiredAmount - subnetBalance) > 0 && mainnetBalance > 0 && !!mainnetToken && !!subnetToken;

        // Return initial result immediately (without swap options)
        const initialResult: BalanceCheckResult = {
            hasEnoughSubnet,
            hasEnoughMainnet,
            subnetBalance,
            mainnetBalance,
            requiredAmount,
            shortfall,
            canDeposit,
            swapOptions: [] // Will be populated later
        };

        // If user has enough balance, return immediately
        if (hasEnoughSubnet) {
            return initialResult;
        }

        // Step 2: Asynchronously load swap options in the background
        // This allows the dialog to show immediately while swap options load
        setTimeout(async () => {
            try {
                setIsLoadingSwapOptions(true);
                const swapOptions = await findSwapOptions(token, requiredAmount, subnetBalance, mainnetBalance, shortfall);

                // Update the result with swap options
                const updatedResult: BalanceCheckResult = {
                    ...initialResult,
                    swapOptions
                };

                // Update the state to trigger dialog re-render with swap options
                setBalanceCheckResult(updatedResult);
            } catch (err) {
                console.error('Failed to load swap options:', err);
            } finally {
                setIsLoadingSwapOptions(false);
            }
        }, 0);

        return initialResult;
    }, [userAddress, tokenCounterparts]);

    // Separate function to find swap options (can be called asynchronously)
    const findSwapOptions = useCallback(async (
        token: TokenCacheData,
        requiredAmount: number,
        subnetBalance: number,
        mainnetBalance: number,
        shortfall: number
    ): Promise<SwapOption[]> => {
        const counterparts = tokenCounterparts.get(token.type === 'SUBNET' ? token.base! : token.contractId);
        const subnetToken = token.type === 'SUBNET' ? token : counterparts?.subnet;

        if (!subnetToken) return [];

        // Get balances for tokens with non-zero balances only
        const allBalances = await fetchAllUserBalances();
        const nonZeroBalances = Array.from(allBalances.entries()).filter(([_, balance]) => balance > 0);

        // Early exit if no tokens with balance
        if (nonZeroBalances.length === 0) return [];

        const swapOptions: SwapOption[] = [];
        const seenTokens = new Set<string>();

        // Calculate target amount needed (the exact shortfall + 20% buffer for slippage)
        const targetOutputAmount = shortfall > 0 ? shortfall * 1.2 : (requiredAmount - subnetBalance) * 1.2;

        if (targetOutputAmount <= 0) return [];

        // Convert target output to micro units for reverse quote
        const targetOutputMicro = convertToMicroUnits(targetOutputAmount.toString(), subnetToken.decimals || 6);

        // Limit to top 10 tokens by balance to avoid too many API calls
        const topBalances = nonZeroBalances
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        // Process tokens in parallel but limit concurrency
        const quotePromises = topBalances.map(async ([contractId, userBalance]) => {
            if (contractId === token.contractId) return null;

            // Look for the token in all available tokens (both mainnet and subnet)
            const allAvailableTokens = [...displayTokens, ...subnetDisplayTokens];
            const sourceToken = allAvailableTokens.find(t => t.contractId === contractId);
            if (!sourceToken) return null;

            // Skip if it's the same token (mainnet vs subnet)
            const sourceBase = sourceToken.type === 'SUBNET' ? sourceToken.base : sourceToken.contractId;
            const targetBase = subnetToken.type === 'SUBNET' ? subnetToken.base : subnetToken.contractId;
            if (sourceBase === targetBase) return null;

            // Skip if we've already seen this base token
            const tokenKey = sourceBase || sourceToken.contractId;
            if (seenTokens.has(tokenKey)) return null;
            seenTokens.add(tokenKey);

            try {
                // Use REVERSE quote: specify output amount, get required input amount
                const reverseQuoteResult = await getQuote(subnetToken.contractId, sourceToken.contractId, targetOutputMicro);

                if (reverseQuoteResult.success && reverseQuoteResult.data) {
                    // The quote gives us how much of the source token we need
                    const requiredInputAmount = parseFloat(formatTokenAmount(
                        Number(reverseQuoteResult.data.amountOut),
                        sourceToken.decimals || 6
                    ));

                    // Check if user has enough of the source token
                    if (userBalance >= requiredInputAmount) {
                        // Now get the forward quote with the exact required input amount for the actual swap route
                        const requiredInputMicro = convertToMicroUnits(requiredInputAmount.toString(), sourceToken.decimals || 6);
                        const forwardQuoteResult = await getQuote(sourceToken.contractId, subnetToken.contractId, requiredInputMicro);

                        if (forwardQuoteResult.success && forwardQuoteResult.data) {
                            const actualOutput = parseFloat(formatTokenAmount(
                                Number(forwardQuoteResult.data.amountOut),
                                subnetToken.decimals || 6
                            ));

                            return {
                                fromToken: sourceToken,
                                fromBalance: userBalance,
                                swapAmount: requiredInputAmount, // Exact amount needed
                                estimatedOutput: actualOutput, // What we'll actually get
                                route: forwardQuoteResult.data // Use forward route for execution
                            };
                        }
                    }
                }
            } catch (err) {
                console.warn(`Failed to get reverse quote for ${subnetToken.symbol} -> ${sourceToken.symbol}:`, err);
            }
            return null;
        });

        // Wait for all quotes with a timeout
        const results = await Promise.allSettled(quotePromises);

        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                swapOptions.push(result.value);
            }
        });

        // Sort by efficiency (best output per swap amount ratio) and return top 3
        swapOptions.sort((a, b) => {
            const aEfficiency = a.estimatedOutput / a.swapAmount;
            const bEfficiency = b.estimatedOutput / b.swapAmount;
            return bEfficiency - aEfficiency;
        });

        return swapOptions.slice(0, 3);
    }, [tokenCounterparts, displayTokens, subnetDisplayTokens, fetchAllUserBalances, getQuote, convertToMicroUnits, formatTokenAmount]);

    // Enhanced order creation with fast balance checking
    const handleCreateLimitOrderWithBalanceCheck = useCallback(async () => {
        if (!selectedFromToken || !selectedToToken) return;
        if (!displayAmount || Number(displayAmount) <= 0) return;
        if (!targetPrice) return;

        // Show dialog immediately with basic balance info
        const balanceCheck = await checkBalanceForOrderFast(selectedFromToken, displayAmount);
        setBalanceCheckResult(balanceCheck);

        if (balanceCheck.hasEnoughSubnet) {
            // User has enough subnet tokens, proceed with order creation
            try {
                setIsCreatingOrder(true);
                await createTriggeredSwap({
                    conditionToken: conditionToken || selectedToToken,
                    baseToken,
                    targetPrice,
                    direction: conditionDir,
                    amountDisplay: displayAmount,
                });
                setBalanceCheckResult(null); // Clear the result on success
            } catch (err) {
                console.error('Error creating triggered swap:', err);
            } finally {
                setIsCreatingOrder(false);
            }
        }
        // If insufficient balance, the dialog is already showing and swap options will load progressively
    }, [selectedFromToken, selectedToToken, displayAmount, targetPrice, conditionToken, baseToken, conditionDir, checkBalanceForOrderFast, createTriggeredSwap]);

    // Helper to execute a deposit transaction
    const executeDeposit = useCallback(async (
        mainnetToken: TokenCacheData,
        subnetToken: TokenCacheData,
        amount: string
    ): Promise<boolean> => {
        if (!walletAddress) return false;

        try {
            const microAmount = convertToMicroUnits(amount, mainnetToken.decimals || 6);

            const params = {
                contract: subnetToken.contractId as `${string}.${string}`,
                functionName: 'deposit',
                functionArgs: [
                    uintCV(Number(microAmount)),
                    noneCV()
                ],
                postConditions: [
                    Pc.principal(walletAddress).willSendEq(Number(microAmount)).ft(mainnetToken.contractId as any, mainnetToken.identifier)
                ]
            };

            const result = await request('stx_callContract', params);
            if (result && result.txid) {
                // Clear balance cache to refresh balances
                clearBalanceCache();
                return true;
            }
        } catch (err) {
            console.error('Deposit failed:', err);
        }
        return false;
    }, [walletAddress, convertToMicroUnits, clearBalanceCache]);

    // Helper to execute a swap to get the required subnet token
    const executeSwapForOrder = useCallback(async (swapOption: SwapOption): Promise<boolean> => {
        if (!walletAddress || !selectedFromToken || !balanceCheckResult) return false;

        try {
            // Use the pre-calculated swap amount
            const swapAmountMicro = convertToMicroUnits(swapOption.swapAmount.toString(), swapOption.fromToken.decimals || 6);

            // Execute the swap using the provided route
            if (swapOption.route) {
                const txCfg = await buildSwapTransaction(router.current, swapOption.route, walletAddress);
                const res = await request('stx_callContract', txCfg);

                if (res && res.txid) {
                    clearBalanceCache();
                    return true;
                }
            }
        } catch (err) {
            console.error('Swap for order failed:', err);
        }
        return false;
    }, [walletAddress, selectedFromToken, balanceCheckResult, clearBalanceCache, convertToMicroUnits]);

    // ---------------------- LocalStorage Token Preferences ----------------------
    // Save token preferences to localStorage
    const saveTokenPreferences = useCallback(() => {
        if (selectedFromToken) {
            saveToStorage(STORAGE_KEYS.FROM_TOKEN, {
                contractId: selectedFromToken.contractId,
                symbol: selectedFromToken.symbol,
                type: selectedFromToken.type
            });
        }
        if (selectedToToken) {
            saveToStorage(STORAGE_KEYS.TO_TOKEN, {
                contractId: selectedToToken.contractId,
                symbol: selectedToToken.symbol,
                type: selectedToToken.type
            });
        }
        if (conditionToken) {
            saveToStorage(STORAGE_KEYS.CONDITION_TOKEN, {
                contractId: conditionToken.contractId,
                symbol: conditionToken.symbol,
                type: conditionToken.type
            });
        }
        if (baseToken) {
            saveToStorage(STORAGE_KEYS.BASE_TOKEN, {
                contractId: baseToken.contractId,
                symbol: baseToken.symbol,
                type: baseToken.type
            });
        }
        saveToStorage(STORAGE_KEYS.MODE, mode);
        saveToStorage(STORAGE_KEYS.USE_SUBNET_FROM, useSubnetFrom);
        saveToStorage(STORAGE_KEYS.USE_SUBNET_TO, useSubnetTo);
    }, [selectedFromToken, selectedToToken, conditionToken, baseToken, mode, useSubnetFrom, useSubnetTo]);

    // Load basic preferences (mode and subnet toggles) immediately on mount
    useEffect(() => {
        // Only apply saved preferences if no URL parameters are present
        const hasUrlParams = !!(urlParams.fromSymbol || urlParams.toSymbol || urlParams.mode ||
            urlParams.fromSubnet || urlParams.toSubnet);

        console.debug('localStorage loading check:', {
            hasUrlParams,
            urlParams,
            searchParams: searchParams?.toString()
        });

        if (hasUrlParams) {
            console.debug('Skipping localStorage load due to URL params:', urlParams);
            return;
        }

        const savedMode = loadFromStorage(STORAGE_KEYS.MODE);
        const savedUseSubnetFrom = loadFromStorage(STORAGE_KEYS.USE_SUBNET_FROM);
        const savedUseSubnetTo = loadFromStorage(STORAGE_KEYS.USE_SUBNET_TO);

        console.debug('Loading localStorage preferences:', {
            savedMode,
            savedUseSubnetFrom,
            savedUseSubnetTo,
            currentMode: mode,
            currentUseSubnetFrom: useSubnetFrom,
            currentUseSubnetTo: useSubnetTo
        });

        // Load mode immediately
        if (savedMode && (savedMode === 'swap' || savedMode === 'order') && savedMode !== mode) {
            console.debug('Setting mode from localStorage:', savedMode);
            setMode(savedMode);
        }

        // Load subnet toggles immediately
        if (typeof savedUseSubnetFrom === 'boolean' && savedUseSubnetFrom !== useSubnetFrom) {
            console.debug('Setting useSubnetFrom from localStorage:', savedUseSubnetFrom);
            setUseSubnetFrom(savedUseSubnetFrom);
        }

        if (typeof savedUseSubnetTo === 'boolean' && savedUseSubnetTo !== useSubnetTo) {
            console.debug('Setting useSubnetTo from localStorage:', savedUseSubnetTo);
            setUseSubnetTo(savedUseSubnetTo);
        }
    }, []); // Run only once on mount, don't depend on urlParams

    // Load token preferences from localStorage
    const loadTokenPreferences = useCallback(() => {
        if (!selectedTokens.length) return;

        const savedFromToken = loadFromStorage(STORAGE_KEYS.FROM_TOKEN);
        const savedToToken = loadFromStorage(STORAGE_KEYS.TO_TOKEN);
        const savedConditionToken = loadFromStorage(STORAGE_KEYS.CONDITION_TOKEN);
        const savedBaseToken = loadFromStorage(STORAGE_KEYS.BASE_TOKEN);

        // Only apply saved preferences if no URL parameters are present
        const hasUrlParams = urlParams.fromSymbol || urlParams.toSymbol || urlParams.mode;
        if (hasUrlParams) return;

        // Find tokens in current token list that match saved preferences
        if (savedFromToken && !selectedFromToken) {
            const token = selectedTokens.find(t => t.contractId === savedFromToken.contractId);
            if (token) {
                setSelectedFromToken(token);
                setBaseSelectedFromToken(token);
            }
        }

        if (savedToToken && !selectedToToken) {
            const token = selectedTokens.find(t => t.contractId === savedToToken.contractId);
            if (token) {
                setSelectedToToken(token);
                setBaseSelectedToToken(token);
            }
        }

        if (savedConditionToken && !conditionToken) {
            const token = selectedTokens.find(t => t.contractId === savedConditionToken.contractId);
            if (token) {
                setConditionToken(token);
            }
        }

        if (savedBaseToken && !baseToken) {
            const token = selectedTokens.find(t => t.contractId === savedBaseToken.contractId);
            if (token) {
                setBaseToken(token);
            }
        }
    }, [selectedTokens, selectedFromToken, selectedToToken, conditionToken, baseToken, urlParams]);

    // Save preferences whenever tokens change
    useEffect(() => {
        if (initDone && selectedTokens.length > 0) {
            saveTokenPreferences();
        }
    }, [selectedFromToken, selectedToToken, conditionToken, baseToken, mode, useSubnetFrom, useSubnetTo, initDone, selectedTokens.length, saveTokenPreferences]);

    // Load preferences after tokens are loaded and URL params are processed
    useEffect(() => {
        if (initDone && selectedTokens.length > 0) {
            loadTokenPreferences();
        }
    }, [initDone, selectedTokens.length, loadTokenPreferences]);

    // Clear token preferences from localStorage
    const clearTokenPreferences = useCallback(() => {
        try {
            if (typeof window !== 'undefined') {
                Object.values(STORAGE_KEYS).forEach(key => {
                    localStorage.removeItem(key);
                });
            }
        } catch (err) {
            console.warn('Failed to clear localStorage preferences:', err);
        }
    }, []);

    // Fetch all balances when tokens are loaded and user is connected
    useEffect(() => {
        if (!userAddress || !displayTokens.length || !subnetDisplayTokens.length) return;

        // Automatically fetch all balances when tokens are loaded
        fetchAllUserBalances();
    }, [userAddress, displayTokens.length, subnetDisplayTokens.length, fetchAllUserBalances]);

    // Proactive balance checking when amount changes
    useEffect(() => {
        if (!selectedFromToken || !displayAmount || mode !== 'order') return;

        const amount = parseFloat(displayAmount);
        if (isNaN(amount) || amount <= 0) return;

        // Debounce the balance check to avoid too many calls
        const timeoutId = setTimeout(async () => {
            try {
                // Quick check of just the subnet balance to see if we might need the dialog
                const counterparts = tokenCounterparts.get(
                    selectedFromToken.type === 'SUBNET' ? selectedFromToken.base! : selectedFromToken.contractId
                );
                const subnetToken = selectedFromToken.type === 'SUBNET' ? selectedFromToken : counterparts?.subnet;

                if (subnetToken && userAddress) {
                    const balance = await getTokenBalanceWithCache(
                        subnetToken.contractId,
                        userAddress,
                        subnetToken.decimals!
                    );
                    const numericBalance = parseFloat(balance);

                    // If balance is insufficient, pre-load some data but don't show dialog yet
                    if (numericBalance < amount) {
                        // Pre-fetch all balances in background to speed up dialog when it's needed
                        fetchAllUserBalances();
                    }
                }
            } catch (err) {
                // Ignore errors in proactive checking
                console.debug('Proactive balance check failed:', err);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [selectedFromToken, displayAmount, mode, userAddress, tokenCounterparts, getTokenBalanceWithCache, fetchAllUserBalances]);

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

        // price impact calculations
        priceImpacts,
        totalPriceImpact,

        // security level
        securityLevel,

        // helper functions
        formatUsd,
        getUsdPrice,
        fetchHistoricalPrices,

        // URL parameters
        urlParams,

        // UI Helper Logic
        displayedFromToken,
        displayedToToken,
        isSubnetShift,
        shiftDirection,
        toLabel,

        // Order mode state
        targetPrice,
        setTargetPrice,
        conditionToken,
        setConditionToken,
        baseToken,
        setBaseToken,
        conditionDir,
        setConditionDir,
        useSubnetFrom,
        setUseSubnetFrom,
        useSubnetTo,
        setUseSubnetTo,
        baseSelectedFromToken,
        setBaseSelectedFromToken,
        baseSelectedToToken,
        setBaseSelectedToToken,

        // order mode handlers
        handleBumpPrice,
        handleSwitchTokensEnhanced,

        // DCA dialog state
        dcaDialogOpen,
        setDcaDialogOpen,

        // Transaction state
        swapping,
        setSwapping,
        isCreatingOrder,

        // Pro mode state
        isProMode,
        setIsProMode,

        // Limit Order Handlers
        handleCreateLimitOrder: handleCreateLimitOrderWithBalanceCheck,
        createSingleOrder,

        // Share Handler
        handleShare,

        // New balance checking functionality
        allTokenBalances,
        isCheckingBalances,
        isLoadingSwapOptions,
        balanceCheckResult,
        setBalanceCheckResult,
        checkBalanceForOrder: checkBalanceForOrderFast,
        executeDeposit,
        executeSwapForOrder,
        fetchAllUserBalances,

        // LocalStorage preferences
        saveTokenPreferences,
        loadTokenPreferences,
        clearTokenPreferences,
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
    const balance = amount / Math.pow(10, decimals);

    if (balance === 0) return '0';
    if (balance < 0.001) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 10)
        });
    } else if (balance < 1) {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 6)
        });
    } else {
        return balance.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: Math.min(decimals, 4)
        });
    }
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
