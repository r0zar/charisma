/**
 * useRouterTrading - Complete trading operations hook
 * Handles router, quotes, swaps, orders, balance checking, and all trading functionality
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getQuote, getRoutableTokens } from '../app/actions';
import { buildSwapTransaction, loadVaults, Route, Router } from 'dexterity-sdk';
import { request } from '@stacks/connect';
import { TransactionResult } from '@stacks/connect/dist/types/methods';
import { TokenCacheData } from '@repo/tokens';
import { signTriggeredSwap } from 'blaze-sdk';
import { tupleCV, stringAsciiCV, uintCV, principalCV, noneCV, optionalCVOf, bufferCV, Pc } from '@stacks/transactions';
import { formatTokenAmount, convertToMicroUnits } from '../lib/swap-utils';
import { useSwapTokens } from '../contexts/swap-tokens-context';
import { useBlaze } from 'blaze-sdk/realtime';
import { useWallet } from '@/contexts/wallet-context';

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

interface SwapOption {
  fromToken: TokenCacheData;
  fromBalance: number;
  swapAmount: number;
  estimatedOutput: number;
  route?: any;
}

// interface UseRouterTradingProps {
//   tokenCounterparts: Map<string, { mainnet: TokenCacheData | null; subnet: TokenCacheData | null }>;
//   displayTokens: TokenCacheData[];
//   subnetDisplayTokens: TokenCacheData[];
// }

export function useRouterTrading() {

  const { address: walletAddress } = useWallet();

  // Get token state from context
  const {
    selectedFromToken,
    selectedToToken,
    conditionToken,
    baseToken,
    targetPrice,
    conditionDir,
    displayAmount,
    displayTokens,
    subnetDisplayTokens,
    useSubnetFrom,
    useSubnetTo,
    tokenCounterparts,
  } = useSwapTokens();

  // Get prices from BlazeProvider
  const { prices, balances } = useBlaze({ userId: walletAddress });

  // Determine the actual tokens to use for routing based on subnet toggles
  const actualFromToken = useMemo(() => {
    if (!selectedFromToken) return null;

    // If subnet toggle is on, try to get subnet version
    if (useSubnetFrom) {
      const baseId = selectedFromToken.type === 'SUBNET'
        ? selectedFromToken.base!
        : selectedFromToken.contractId;
      const counterparts = tokenCounterparts.get(baseId);
      return counterparts?.subnet || selectedFromToken;
    }

    // If subnet toggle is off, try to get mainnet version
    const baseId = selectedFromToken.type === 'SUBNET'
      ? selectedFromToken.base!
      : selectedFromToken.contractId;
    const counterparts = tokenCounterparts.get(baseId);
    return counterparts?.mainnet || selectedFromToken;
  }, [selectedFromToken, useSubnetFrom, tokenCounterparts]);

  const actualToToken = useMemo(() => {
    if (!selectedToToken) return null;

    // If subnet toggle is on, try to get subnet version
    if (useSubnetTo) {
      const baseId = selectedToToken.type === 'SUBNET'
        ? selectedToToken.base!
        : selectedToToken.contractId;
      const counterparts = tokenCounterparts.get(baseId);
      return counterparts?.subnet || selectedToToken;
    }

    // If subnet toggle is off, try to get mainnet version
    const baseId = selectedToToken.type === 'SUBNET'
      ? selectedToToken.base!
      : selectedToToken.contractId;
    const counterparts = tokenCounterparts.get(baseId);
    return counterparts?.mainnet || selectedToToken;
  }, [selectedToToken, useSubnetTo, tokenCounterparts]);

  // Derive microAmount from displayAmount
  const microAmount = displayAmount && actualFromToken ?
    convertToMicroUnits(displayAmount, actualFromToken.decimals || 6) : '';

  // Router initialization
  const router = useRef<Router>(new Router({
    maxHops: 4,
    defaultSlippage: 0.05,
    routerContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.multihop',
  }));

  // State
  const [routeableTokenIds, setRouteableTokenIds] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState<Route | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [swapSuccessInfo, setSwapSuccessInfo] = useState<TransactionResult | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderSuccessInfo, setOrderSuccessInfo] = useState<any>(null);
  const [balanceCheckResult, setBalanceCheckResult] = useState<BalanceCheckResult | null>(null);
  const [isLoadingSwapOptions, setIsLoadingSwapOptions] = useState(false);

  // Pro mode state
  const [isProMode, setIsProMode] = useState(false);

  // Initialize router with vaults
  useEffect(() => {
    loadVaults(router.current);
  }, []);

  // Load routeable tokens
  useEffect(() => {
    let isMounted = true;

    const loadRouteableTokens = async () => {
      try {
        const routableIdsResult = await getRoutableTokens();
        if (isMounted && routableIdsResult?.tokens) {
          setRouteableTokenIds(new Set(routableIdsResult.tokens.map(token => token.contractId)));
        }
      } catch (error) {
        console.error('Failed to load routeable tokens:', error);
      }
    };

    loadRouteableTokens();

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch quote when tokens or amount change
  const fetchQuote = useCallback(async () => {
    if (!actualFromToken || !actualToToken) return;
    const amountNum = Number(microAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsLoadingQuote(true);
    setError(null);
    try {
      const result = await getQuote(
        actualFromToken.contractId,
        actualToToken.contractId,
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
  }, [actualFromToken, actualToToken, microAmount]);

  // Auto-fetch quote when dependencies change
  useEffect(() => {
    if (!actualFromToken || !actualToToken) return;
    if (!microAmount || Number(microAmount) <= 0) {
      setQuote(null);
      return;
    }
    fetchQuote();
  }, [actualFromToken, actualToToken, microAmount, fetchQuote]);

  // Execute swap transaction
  const handleSwap = useCallback(async () => {
    if (!quote || !walletAddress) return;
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
      setSwapSuccessInfo(res);
    } catch (err) {
      console.error('Swap failed:', err);
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setSwapping(false);
    }
  }, [quote, walletAddress]);

  // Helper function to get quote for specific tokens and amount (used in balance checking)
  const getQuoteForTokens = useCallback(async (
    fromTokenId: string,
    toTokenId: string,
    amountMicro: string
  ) => {
    try {
      const result = await getQuote(fromTokenId, toTokenId, amountMicro);
      return result; // Return full result object with success/data structure
    } catch (err) {
      console.error('Failed to get quote for tokens:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get quote' };
    }
  }, []);

  // Helper function to build swap transaction for a given route
  const buildSwapTransactionForRoute = useCallback(async (
    route: Route,
    userAddress: string
  ) => {
    return await buildSwapTransaction(router.current, route, userAddress);
  }, []);

  // ===================== ORDER CREATION FUNCTIONALITY =====================

  /**
   * Create a triggered swap order (off-chain limit order)
   */
  const createTriggeredSwap = useCallback(async (opts: {
    conditionToken: TokenCacheData;
    baseToken: TokenCacheData | null;
    targetPrice: string;
    direction: 'lt' | 'gt';
    amountDisplay: string;
    validFrom?: string;
    validTo?: string;
  }) => {
    if (!walletAddress) throw new Error('Connect wallet');
    if (!actualFromToken || !actualToToken) throw new Error('Select tokens');

    const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
    const micro = convertToMicroUnits(opts.amountDisplay, actualFromToken.decimals || 6);

    const signature = await signTriggeredSwap({
      subnet: actualFromToken.contractId!,
      uuid,
      amount: BigInt(micro),
    });

    const payload: Record<string, unknown> = {
      owner: walletAddress,
      inputToken: actualFromToken.contractId,
      outputToken: actualToToken.contractId,
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
    setOrderSuccessInfo({ success: true });

    return await res.json();
  }, [walletAddress, actualFromToken, actualToToken]);

  // Callback for DcaDialog to create a single slice order
  const createSingleOrder = useCallback(async ({ amountDisplay, validFrom, validTo }: {
    amountDisplay: string;
    validFrom: string;
    validTo: string
  }) => {
    if (!conditionToken || !selectedToToken) throw new Error('Missing condition or target token');

    await createTriggeredSwap({
      conditionToken: conditionToken || selectedToToken,
      baseToken,
      targetPrice,
      direction: conditionDir,
      amountDisplay,
      validFrom,
      validTo,
    });
  }, [conditionToken, selectedToToken, baseToken, targetPrice, conditionDir, createTriggeredSwap]);

  // ===================== BALANCE CHECKING FUNCTIONALITY =====================

  // Fast balance check using enhanced balance feed
  const checkBalanceForOrder = useCallback(async (
    token: TokenCacheData,
    amount: string,
    userAddress: string
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

    // Step 1: Quick check using enhanced balance feed
    const counterparts = tokenCounterparts.get(token.type === 'SUBNET' ? token.base! : token.contractId);
    const subnetToken = token.type === 'SUBNET' ? token : counterparts?.subnet;
    const mainnetToken = token.type === 'SUBNET' ? counterparts?.mainnet : token;

    // Get balances from enhanced balance feed
    let subnetBalance = 0;
    let mainnetBalance = 0;

    if (subnetToken) {
      const subnetBalanceData = balances[`${userAddress}:${subnetToken.contractId}`];
      subnetBalance = subnetBalanceData?.formattedBalance ?? 0;
    }

    if (mainnetToken && mainnetToken.contractId !== subnetToken?.contractId) {
      const mainnetBalanceData = balances[`${userAddress}:${mainnetToken.contractId}`];
      mainnetBalance = mainnetBalanceData?.formattedBalance ?? 0;
    }

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
      swapOptions: []
    };

    // If we already have enough subnet balance, no need for swap options
    if (hasEnoughSubnet) {
      return initialResult;
    }

    // Step 2: Generate swap options in background
    setIsLoadingSwapOptions(true);
    try {
      const swapOptions = await generateSwapOptions(token, requiredAmount, subnetToken!);
      const finalResult = { ...initialResult, swapOptions };
      setIsLoadingSwapOptions(false);
      return finalResult;
    } catch (err) {
      console.error('Failed to generate swap options:', err);
      setIsLoadingSwapOptions(false);
      return initialResult;
    }
  }, [tokenCounterparts]);

  // Generate swap options for balance checking
  const generateSwapOptions = useCallback(async (
    targetToken: TokenCacheData,
    requiredAmount: number,
    subnetToken: TokenCacheData
  ): Promise<SwapOption[]> => {
    console.log(`🔄 Generating swap options for ${requiredAmount} ${targetToken.symbol}...`);

    const targetOutputMicro = convertToMicroUnits(requiredAmount.toString(), subnetToken.decimals || 6);
    const seenTokens = new Set<string>();
    const swapPromises: Promise<SwapOption | null>[] = [];

    // Get all user balances from enhanced balance feed
    const allBalances = balances;

    // For each token the user has a balance in, check if we can swap it for the target
    for (const [balanceKey, userBalance] of Object.entries(allBalances)) {
      // Extract contractId from the balance key format: "userId:contractId"
      const [, contractId] = balanceKey.split(':');
      if (!contractId) continue;

      const numericBalance = userBalance.formattedBalance ?? 0;
      if (numericBalance <= 0.001) continue; // Skip tiny balances

      const sourceToken = [...displayTokens, ...subnetDisplayTokens].find(t => t.contractId === contractId);
      if (!sourceToken || sourceToken.contractId === subnetToken.contractId) continue;

      const sourceBase = sourceToken.type === 'SUBNET' ? sourceToken.base : null;
      const tokenKey = sourceBase || sourceToken.contractId;
      if (seenTokens.has(tokenKey)) continue;
      seenTokens.add(tokenKey);

      swapPromises.push(
        (async (): Promise<SwapOption | null> => {
          try {
            // Use REVERSE quote: specify output amount, get required input amount
            const reverseQuoteResult = await getQuoteForTokens(subnetToken.contractId, sourceToken.contractId, targetOutputMicro);

            if (reverseQuoteResult.success && reverseQuoteResult.data) {
              // The quote gives us how much of the source token we need
              const requiredInputAmount = parseFloat(formatTokenAmount(
                Number(reverseQuoteResult.data.amountOut),
                sourceToken.decimals || 6
              ));

              // Check if user has enough of the source token
              if (numericBalance >= requiredInputAmount) {
                // Now get the forward quote with the exact required input amount for the actual swap route
                const requiredInputMicro = convertToMicroUnits(requiredInputAmount.toString(), sourceToken.decimals || 6);
                const forwardQuoteResult = await getQuoteForTokens(sourceToken.contractId, subnetToken.contractId, requiredInputMicro);

                if (forwardQuoteResult.success && forwardQuoteResult.data) {
                  const actualOutput = parseFloat(formatTokenAmount(
                    Number(forwardQuoteResult.data.amountOut),
                    subnetToken.decimals || 6
                  ));

                  return {
                    fromToken: sourceToken,
                    fromBalance: numericBalance,
                    swapAmount: requiredInputAmount, // Amount we suggest swapping
                    estimatedOutput: actualOutput,
                    route: forwardQuoteResult.data
                  };
                }
              }
            }
            return null;
          } catch (err) {
            console.error(`Failed to get swap option for ${sourceToken.symbol}:`, err);
            return null;
          }
        })()
      );
    }

    const results = await Promise.all(swapPromises);
    const swapOptions = results.filter((option): option is SwapOption => option !== null);

    // Sort by efficiency (output amount per input amount)
    swapOptions.sort((a, b) => {
      const aEfficiency = a.estimatedOutput / a.swapAmount;
      const bEfficiency = b.estimatedOutput / b.swapAmount;
      return bEfficiency - aEfficiency;
    });

    return swapOptions.slice(0, 3);
  }, [tokenCounterparts, displayTokens, subnetDisplayTokens, balances, getQuoteForTokens, convertToMicroUnits, formatTokenAmount]);

  // Enhanced order creation with fast balance checking
  const handleCreateLimitOrderWithBalanceCheck = useCallback(async () => {
    if (!selectedFromToken || !selectedToToken) return;
    if (!walletAddress) return;

    const balanceCheck = await checkBalanceForOrder(selectedFromToken, displayAmount, walletAddress);
    setBalanceCheckResult(balanceCheck);

    // If user has enough subnet balance, create the order directly
    if (balanceCheck.hasEnoughSubnet) {
      try {
        await createTriggeredSwap({
          conditionToken: conditionToken || selectedToToken,
          baseToken,
          targetPrice,
          direction: conditionDir,
          amountDisplay: displayAmount,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Order creation failed');
      }
    }
    // If not enough balance, the balance check dialog will show via balanceCheckResult
  }, [selectedFromToken, selectedToToken, displayAmount, targetPrice, conditionToken, baseToken, conditionDir, checkBalanceForOrder, createTriggeredSwap, walletAddress]);

  // ===================== DEPOSIT FUNCTIONALITY =====================

  // Helper to execute a mainnet -> subnet deposit
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
        return true;
      }
    } catch (err) {
      console.error('Deposit failed:', err);
    }
    return false;
  }, [walletAddress]);

  // Helper to execute a swap to get the required subnet token
  const executeSwapForOrder = useCallback(async (swapOption: SwapOption): Promise<boolean> => {
    if (!walletAddress || !selectedFromToken || !balanceCheckResult) return false;

    try {
      // Execute the swap using the provided route
      if (swapOption.route) {
        const txCfg = await buildSwapTransactionForRoute(swapOption.route, walletAddress);
        const res = await request('stx_callContract', txCfg);

        if (res && res.txid) {
          return true;
        }
      }
    } catch (err) {
      console.error('Swap for order failed:', err);
    }
    return false;
  }, [walletAddress, selectedFromToken, balanceCheckResult, buildSwapTransactionForRoute]);

  // ---------------------- Price Impact Calculations ----------------------
  const { priceImpacts, totalPriceImpact } = useMemo(() => {
    if (!quote || !prices) {
      return { priceImpacts: [], totalPriceImpact: null };
    }

    // Helper to get price, handling the ".stx" vs "stx" key difference
    const getPrice = (contractId: string): number | undefined => {
      return contractId === '.stx' ? prices['stx']?.price : prices[contractId]?.price;
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
    if (actualFromToken && actualToToken && microAmount) {
      const fromPrice = getPrice(actualFromToken.contractId);
      const toPrice = getPrice(actualToToken.contractId);

      if (fromPrice !== undefined && toPrice !== undefined) {
        const inputValueUsd = Number(microAmount) * fromPrice / (10 ** actualFromToken.decimals!);
        const outputValueUsd = Number(quote.amountOut) * toPrice / (10 ** actualToToken.decimals!);

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
  }, [quote, prices, actualFromToken, actualToToken, microAmount]);

  // ---------------------- Security Level ----------------------
  const securityLevel = useMemo((): 'high' | 'medium' | 'low' => {
    if (!quote) return 'high';
    const hops = quote.path.length - 1;
    if (hops === 1) return 'high';
    else if (hops === 2) return 'medium';
    else return 'low';
  }, [quote]);

  // ---------------------- UI Helper Logic ----------------------
  // Determine if this is a subnet shift operation
  const isSubnetShift = useMemo(() => {
    return quote?.hops.some((hop: any) => hop.vault.type === 'SUBLINK') || false;
  }, [quote]);

  // Get shift direction for label customization
  const shiftDirection = useMemo((): 'to-subnet' | 'from-subnet' | null => {
    if (!isSubnetShift || !actualToToken) return null;
    return actualToToken.contractId.includes('-subnet') ? 'to-subnet' : 'from-subnet';
  }, [isSubnetShift, actualToToken]);

  // Custom label based on operation type
  const toLabel = useMemo(() => {
    if (isSubnetShift) {
      return shiftDirection === 'to-subnet' ? 'You receive in subnet' : 'You receive in mainnet';
    }
    return 'You receive';
  }, [isSubnetShift, shiftDirection]);

  return {
    // Router instance (for advanced usage)
    router: router.current,

    // Routeable tokens
    routeableTokenIds,

    // Quote state
    quote,
    isLoadingQuote,
    error,
    setError,

    // Swap state
    swapping,
    setSwapping,
    swapSuccessInfo,
    setSwapSuccessInfo,
    clearSwapSuccessInfo: () => setSwapSuccessInfo(null),

    // Order state
    isCreatingOrder,
    setIsCreatingOrder,
    orderSuccessInfo,
    setOrderSuccessInfo,
    clearOrderSuccessInfo: () => setOrderSuccessInfo(null),

    // Balance checking state
    balanceCheckResult,
    setBalanceCheckResult,
    isLoadingSwapOptions,

    // Core actions
    fetchQuote,
    handleSwap,
    getQuoteForTokens,
    buildSwapTransactionForRoute,

    // Order actions
    createTriggeredSwap,
    createSingleOrder,
    handleCreateLimitOrder: handleCreateLimitOrderWithBalanceCheck,

    // Balance checking actions
    checkBalanceForOrder,
    executeDeposit,
    executeSwapForOrder,

    // Price impact calculations
    priceImpacts,
    totalPriceImpact,

    // Security level
    securityLevel,

    // UI Helper Logic
    isSubnetShift,
    shiftDirection,
    toLabel,

    // Pro mode
    isProMode,
    setIsProMode,
  };
}