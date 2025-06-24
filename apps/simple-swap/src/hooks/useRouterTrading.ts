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
import { uintCV, noneCV, Pc } from '@stacks/transactions';
import { formatTokenAmount, convertToMicroUnits } from '../lib/swap-utils';
import { useSwapTokens } from '../contexts/swap-tokens-context';
import { useOrderConditions } from '../contexts/order-conditions-context';
import { useBlaze } from 'blaze-sdk/realtime';
import { useWallet } from '@/contexts/wallet-context';
import { buildPostConditions } from 'blaze-sdk';
import { buildSwapPostConditions } from 'dexterity-sdk';

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

export function useRouterTrading() {

  const { address: walletAddress } = useWallet();

  // Get token state from context
  const {
    selectedFromToken,
    selectedToToken,
    displayAmount,
    displayTokens,
    subnetDisplayTokens,
    useSubnetFrom,
    useSubnetTo,
    mode,
  } = useSwapTokens();

  // Get trigger state from order conditions context
  const {
    hasPriceTrigger,
    priceTriggerToken,
    priceTargetPrice,
    priceDirection,

    hasRatioTrigger,
    ratioTriggerToken,
    ratioBaseToken,
    ratioTargetPrice,
    ratioDirection,

    hasTimeTrigger,
    timeStartTime,
    timeEndTime,

    manualDescription,
    isManualOrder,
    validateTriggers,
  } = useOrderConditions();

  // Get prices from BlazeProvider
  const { prices, balances } = useBlaze({ userId: walletAddress });

  // Router config for post conditions
  const routerConfig = useMemo(() => ({
    routerAddress: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    routerName: process.env.NEXT_PUBLIC_ROUTER_NAME || 'multihop'
  }), []);

  // Helper function to get the contract ID to use for a token based on subnet toggle
  const getContractIdForToken = useCallback((token: TokenCacheData | null, useSubnet: boolean): string | null => {
    if (!token) return null;

    // If we want subnet and token is mainnet, find subnet version
    if (useSubnet && token.type !== 'SUBNET') {
      const subnetVersion = subnetDisplayTokens.find(t => t.base === token.contractId);
      return subnetVersion?.contractId || token.contractId;
    }

    // Always use the mainnet version for consistency (token should already be mainnet)
    return token.contractId;
  }, [subnetDisplayTokens]);

  // Derive microAmount from displayAmount (use selected token for decimals)
  const microAmount = displayAmount && selectedFromToken ?
    convertToMicroUnits(displayAmount, selectedFromToken.decimals || 6) : '';

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
    if (!selectedFromToken || !selectedToToken) return;
    const amountNum = Number(microAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const fromContractId = getContractIdForToken(selectedFromToken, useSubnetFrom);
    const toContractId = getContractIdForToken(selectedToToken, useSubnetTo);

    if (!fromContractId || !toContractId) return;

    setIsLoadingQuote(true);
    setError(null);
    try {
      const result = await getQuote(
        fromContractId,
        toContractId,
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
  }, [selectedFromToken, selectedToToken, microAmount, useSubnetFrom, useSubnetTo, getContractIdForToken]);

  // Auto-fetch quote when dependencies change
  useEffect(() => {
    if (!selectedFromToken || !selectedToToken) return;
    if (!microAmount || Number(microAmount) <= 0) {
      setQuote(null);
      return;
    }
    fetchQuote();
  }, [selectedFromToken, selectedToToken, microAmount, useSubnetFrom, useSubnetTo, fetchQuote]);

  // Generate post conditions data when quote is available
  const postConditionsData = useMemo(() => {
    if (!quote || !quote.hops || !walletAddress) return null;

    try {
      const inputToken = quote.path[0];
      const outputToken = quote.path[quote.path.length - 1];
      const inputAmount = BigInt(quote.amountIn);
      const outputAmount = BigInt(quote.amountOut);
      const minOutputWithSlippage = (outputAmount * BigInt(99)) / BigInt(100); // 1% slippage protection

      if (mode === 'swap') {
        // For swap mode: simple dexterity multihop router
        // Users care about: input amount, guaranteed output, wallet protection
        const operations = [
          {
            type: 'input',
            description: 'You will send exactly',
            principal: walletAddress,
            token: inputToken,
            amount: inputAmount,
            condition: 'eq',
            category: 'send'
          },
          {
            type: 'output',
            description: 'You will receive at least',
            principal: walletAddress,
            token: outputToken,
            amount: minOutputWithSlippage,
            condition: 'gte',
            category: 'receive'
          },
          {
            type: 'protection',
            description: 'No other tokens can leave your address',
            principal: walletAddress,
            token: null,
            amount: BigInt(0),
            condition: 'protection',
            category: 'security'
          }
        ];

        return { operations, mode: 'swap', contractType: 'Dexterity Multihop Router' };
      } else {
        // For order mode: x-multihop flow (subnet-based)
        // Users care about: input amount, guaranteed output, subnet protection
        const operations = [
          {
            type: 'input',
            description: 'You will send exactly',
            principal: walletAddress,
            token: inputToken,
            amount: inputAmount,
            condition: 'eq',
            category: 'send'
          },
          {
            type: 'output',
            description: 'You will receive at least',
            principal: walletAddress,
            token: outputToken,
            amount: minOutputWithSlippage,
            condition: 'gte',
            category: 'receive'
          },
          {
            type: 'subnet-protection',
            description: 'No tokens can leave your wallet address at all',
            principal: walletAddress,
            token: inputToken,
            amount: BigInt(0),
            condition: 'subnet-isolation',
            category: 'subnet-security'
          },
          {
            type: 'protection',
            description: 'Only the specified subnet token can be moved',
            principal: walletAddress,
            token: null,
            amount: BigInt(0),
            condition: 'protection',
            category: 'security'
          }
        ];

        return { operations, mode: 'order', contractType: 'X-Multihop Subnet Router' };
      }
    } catch (error) {
      console.error('Failed to generate post conditions:', error);
      return null;
    }
  }, [quote, mode, walletAddress]);

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

  // ===================== ORDER CREATION FUNCTIONALITY =====================

  /**
   * Create a triggered swap order (off-chain limit order)
   */
  const createTriggeredSwap = useCallback(async (opts: {
    conditionToken?: TokenCacheData | '*';
    baseToken?: TokenCacheData | null;
    targetPrice?: string;
    direction?: 'lt' | 'gt';
    amountDisplay: string;
    validFrom?: string;
    validTo?: string;
    // Manual-specific options
    manualDescription?: string;
    // Strategy-specific options
    strategyId?: string;
    strategyType?: 'dca' | 'split' | 'batch';
    strategySize?: number;
    strategyPosition?: number;
  }) => {
    console.log('📝 createTriggeredSwap called with:', opts);

    if (!walletAddress) throw new Error('Connect wallet');
    if (!selectedFromToken || !selectedToToken) throw new Error('Select tokens');

    const fromContractId = getContractIdForToken(selectedFromToken, useSubnetFrom);
    const toContractId = getContractIdForToken(selectedToToken, useSubnetTo);

    if (!fromContractId || !toContractId) throw new Error('Unable to determine contract IDs');

    console.log('🔢 Generating UUID and micro amount...');
    const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
    const micro = convertToMicroUnits(opts.amountDisplay, selectedFromToken.decimals || 6);

    console.log('📝 Order details:', {
      uuid,
      micro,
      fromContractId,
      toContractId,
      walletAddress,
      useSubnetFrom,
      useSubnetTo
    });

    console.log('✍️ Requesting signature for triggered swap...');
    const signatureData = {
      subnet: fromContractId,
      uuid,
      amount: BigInt(micro),
    };
    console.log('✍️ Signature data:', signatureData);

    try {
      const signature = await signTriggeredSwap(signatureData);
      console.log('✅ Signature received:', signature);

      console.log('📦 Building payload...');

      // Build payload - use passed options or fall back to context state
      let conditionToken, baseAsset, targetPrice, direction;

      // If specific condition is passed in opts, use it (for DCA)
      if (opts.conditionToken !== undefined) {
        conditionToken = typeof opts.conditionToken === 'string' ? opts.conditionToken : opts.conditionToken.contractId;
        baseAsset = opts.baseToken?.contractId;
        targetPrice = opts.targetPrice;
        direction = opts.direction;
      } else {
        // Otherwise use context state (for regular orders)
        if (hasPriceTrigger && hasRatioTrigger) {
          throw new Error('Cannot have both price and ratio triggers enabled simultaneously');
        }

        if (hasPriceTrigger) {
          if (!priceTriggerToken || !priceTargetPrice) {
            throw new Error('Price trigger requires trigger token and target price');
          }
          conditionToken = priceTriggerToken.contractId;
          targetPrice = priceTargetPrice;
          direction = priceDirection;
          // No baseAsset for price triggers (undefined = USD)
        } else if (hasRatioTrigger) {
          if (!ratioTriggerToken || !ratioBaseToken || !ratioTargetPrice) {
            throw new Error('Ratio trigger requires trigger token, base token, and target price');
          }
          conditionToken = ratioTriggerToken.contractId;
          baseAsset = ratioBaseToken.contractId;
          targetPrice = ratioTargetPrice;
          direction = ratioDirection;
        }
        // For manual orders, all trigger fields remain undefined
      }

      const payload: Record<string, unknown> = {
        owner: walletAddress,
        inputToken: fromContractId,
        outputToken: toContractId,
        amountIn: micro,
        conditionToken,
        baseAsset,
        targetPrice,
        direction,
        recipient: walletAddress,
        signature,
        uuid,
      };

      // Add time window constraints if provided
      if (opts.validFrom) {
        payload.validFrom = opts.validFrom;
      }
      if (opts.validTo) {
        payload.validTo = opts.validTo;
      }

      // Add manual description if it's a manual order
      if (isManualOrder && opts.manualDescription) {
        payload.description = opts.manualDescription;
      }

      // Add strategy metadata for DCA/batch orders
      if (opts.strategyId) {
        payload.strategyId = opts.strategyId;
      }
      if (opts.strategyType) {
        payload.strategyType = opts.strategyType;
      }
      if (opts.strategySize) {
        payload.strategySize = opts.strategySize;
      }
      if (opts.strategyPosition !== undefined) {
        payload.strategyPosition = opts.strategyPosition;
      }

      console.log('📤 Sending order to API:', payload);

      const res = await fetch('/api/v1/orders/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📥 API response status:', res.status);

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'unknown' }));
        console.error('❌ API error:', j);
        throw new Error(j.error || 'Order create failed');
      }

      console.log('✅ Order creation API call successful');
      setOrderSuccessInfo({ success: true });

      const result = await res.json();
      console.log('✅ Order created successfully:', result);
      return result;
    } catch (err) {
      console.error('❌ Error in createTriggeredSwap:', err);
      throw err;
    }
  }, [walletAddress, selectedFromToken, selectedToToken, useSubnetFrom, useSubnetTo, getContractIdForToken, hasPriceTrigger, hasRatioTrigger, priceTriggerToken, priceTargetPrice, priceDirection, ratioTriggerToken, ratioBaseToken, ratioTargetPrice, ratioDirection, isManualOrder, manualDescription]);

  // Callback for DcaDialog to create a single slice order
  const createSingleOrder = useCallback(async ({ amountDisplay, validFrom, validTo, strategyId, strategyPosition, strategySize }: {
    amountDisplay: string;
    validFrom: string;
    validTo: string;
    strategyId?: string;
    strategyPosition?: number;
    strategySize?: number;
  }) => {
    if (!selectedToToken) throw new Error('Missing target token');

    await createTriggeredSwap({
      // For DCA orders, use wildcard condition for time-based execution
      conditionToken: '*',
      baseToken: undefined,
      targetPrice: '0',
      direction: 'gt',
      amountDisplay,
      validFrom,
      validTo,
      // Add strategy metadata for DCA grouping
      strategyId,
      strategyType: 'dca',
      strategySize,
      strategyPosition,
    });
  }, [selectedToToken, createTriggeredSwap]);

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

    // Step 1: Quick check using enhanced balance feed - both mainnet and subnet balances are in the same entry
    // For subnet tokens, we need to look up the base token's balance data
    const baseContractId = token.type === 'SUBNET' && token.base ? token.base : token.contractId;
    const balanceData = balances[`${userAddress}:${baseContractId}`];

    console.log('🔍 Balance lookup in checkBalanceForOrder:', {
      tokenContract: token.contractId,
      tokenType: token.type,
      tokenBase: token.base,
      baseContractId,
      hasBalanceData: !!balanceData,
      balanceData: balanceData
    });

    // Get balances from the unified balance data
    const subnetBalance = balanceData?.formattedSubnetBalance ?? 0;
    const mainnetBalance = balanceData?.formattedBalance ?? 0;

    const hasEnoughSubnet = subnetBalance >= requiredAmount;
    const hasEnoughMainnet = mainnetBalance >= requiredAmount;

    // Calculate shortfall - how much more we need after accounting for available mainnet deposit
    const maxDepositAmount = Math.min(mainnetBalance, requiredAmount - subnetBalance);
    const shortfall = Math.max(0, requiredAmount - subnetBalance - maxDepositAmount);

    // Can deposit if we have any mainnet tokens and there's a subnet shortfall, and we have subnet contract info
    const canDeposit = (requiredAmount - subnetBalance) > 0 && mainnetBalance > 0 && !!balanceData?.subnetContractId;

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
      const swapOptions = await generateSwapOptions(token, requiredAmount);
      const finalResult = { ...initialResult, swapOptions };
      setIsLoadingSwapOptions(false);
      return finalResult;
    } catch (err) {
      console.error('Failed to generate swap options:', err);
      setIsLoadingSwapOptions(false);
      return initialResult;
    }
  }, [balances]);

  // Generate swap options for balance checking
  const generateSwapOptions = useCallback(async (
    targetToken: TokenCacheData,
    requiredAmount: number
  ): Promise<SwapOption[]> => {
    console.log(`🔄 Generating swap options for ${requiredAmount} ${targetToken.symbol}...`);

    const targetOutputMicro = convertToMicroUnits(requiredAmount.toString(), targetToken.decimals || 6);
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
      if (!sourceToken || sourceToken.contractId === targetToken.contractId) continue;

      // Use contractId directly since we don't need counterpart mapping
      if (seenTokens.has(contractId)) continue;
      seenTokens.add(contractId);

      swapPromises.push(
        (async (): Promise<SwapOption | null> => {
          try {
            // Use REVERSE quote: specify output amount, get required input amount
            const reverseQuoteResult = await getQuoteForTokens(targetToken.contractId, sourceToken.contractId, targetOutputMicro);

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
                const forwardQuoteResult = await getQuoteForTokens(sourceToken.contractId, targetToken.contractId, requiredInputMicro);

                if (forwardQuoteResult.success && forwardQuoteResult.data) {
                  const actualOutput = parseFloat(formatTokenAmount(
                    Number(forwardQuoteResult.data.amountOut),
                    targetToken.decimals || 6
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
  }, [displayTokens, subnetDisplayTokens, balances, getQuoteForTokens, convertToMicroUnits, formatTokenAmount]);

  // Enhanced order creation with fast balance checking
  const handleCreateLimitOrderWithBalanceCheck = useCallback(async () => {
    console.log('🚀 Starting order creation flow:', {
      selectedFromToken: selectedFromToken?.contractId,
      selectedToToken: selectedToToken?.contractId,
      displayAmount,
      walletAddress,
      hasPriceTrigger,
      hasRatioTrigger,
      hasTimeTrigger,
      isManualOrder,
      priceTriggerToken: priceTriggerToken?.contractId,
      ratioBaseToken: ratioBaseToken?.contractId,
      priceTargetPrice,
      ratioTargetPrice,
      timeStartTime,
      timeEndTime
    });

    // Basic validation
    if (!selectedFromToken || !selectedToToken) {
      setError('Please select both tokens for your swap');
      return;
    }
    if (!walletAddress) {
      setError('Please connect your wallet');
      return;
    }
    if (!displayAmount || parseFloat(displayAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Trigger validation using the context's validation function
    const triggerValidation = validateTriggers();
    if (!triggerValidation.isValid) {
      setError(triggerValidation.errors[0]); // Show the first error
      return;
    }

    console.log('🔍 Checking balance for order...');
    const balanceCheck = await checkBalanceForOrder(selectedFromToken, displayAmount, walletAddress);
    console.log('📊 Balance check result:', balanceCheck);
    setBalanceCheckResult(balanceCheck);

    // If user has enough subnet balance, create the order directly
    if (balanceCheck.hasEnoughSubnet) {
      console.log('✅ User has enough subnet balance, creating order...');
      try {
        await createTriggeredSwap({
          conditionToken: priceTriggerToken || ratioTriggerToken || selectedToToken,
          baseToken: ratioBaseToken,
          targetPrice: priceTargetPrice || ratioTargetPrice,
          direction: priceDirection || ratioDirection,
          amountDisplay: displayAmount,
          manualDescription,
        });
        console.log('✅ Order created successfully');
      } catch (err) {
        console.error('❌ Order creation failed:', err);
        setError(err instanceof Error ? err.message : 'Order creation failed');
      }
    } else {
      console.log('⚠️ User does not have enough subnet balance, showing balance check dialog');
    }
    // If not enough balance, the balance check dialog will show via balanceCheckResult
  }, [selectedFromToken, selectedToToken, displayAmount, hasPriceTrigger, hasRatioTrigger, hasTimeTrigger, priceTriggerToken, priceTargetPrice, priceDirection, ratioTriggerToken, ratioBaseToken, ratioTargetPrice, ratioDirection, timeStartTime, timeEndTime, manualDescription, validateTriggers, checkBalanceForOrder, createTriggeredSwap, walletAddress]);

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
        const txCfg = await buildSwapTransaction(router.current, swapOption.route, walletAddress);
        const res = await request('stx_callContract', txCfg);

        if (res && res.txid) {
          return true;
        }
      }
    } catch (err) {
      console.error('Swap for order failed:', err);
    }
    return false;
  }, [walletAddress, selectedFromToken, balanceCheckResult, router.current]);

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
  }, [quote, prices, selectedFromToken, selectedToToken, microAmount]);

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
    if (!isSubnetShift || !selectedToToken) return null;
    const toContractId = getContractIdForToken(selectedToToken, useSubnetTo);
    return toContractId?.includes('-subnet') ? 'to-subnet' : 'from-subnet';
  }, [isSubnetShift, selectedToToken, useSubnetTo, getContractIdForToken]);

  // Custom label based on operation type
  const toLabel = useMemo(() => {
    if (isSubnetShift) {
      return shiftDirection === 'to-subnet' ? 'You receive in subnet' : 'You receive in mainnet';
    }
    return 'You receive';
  }, [isSubnetShift, shiftDirection]);

  // Order creation validation
  const canCreateOrder = useMemo(() => {
    // Basic requirements
    if (!selectedFromToken || !selectedToToken || !walletAddress) return false;
    if (!displayAmount || parseFloat(displayAmount) <= 0) return false;

    // Trigger validation
    const triggerValidation = validateTriggers();
    return triggerValidation.isValid;
  }, [selectedFromToken, selectedToToken, walletAddress, displayAmount, validateTriggers]);

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

    // Post conditions data
    postConditionsData,

    // Security level
    securityLevel,

    // UI Helper Logic
    isSubnetShift,
    shiftDirection,
    toLabel,

    // Order validation
    canCreateOrder,

    // Pro mode
    isProMode,
    setIsProMode,
  };
}