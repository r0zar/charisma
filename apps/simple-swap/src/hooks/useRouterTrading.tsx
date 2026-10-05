/**
 * useRouterTrading - Complete trading operations hook
 * Handles router, quotes, swaps, orders, balance checking, and all trading functionality
 */

import { SIGNER_PAYOUT_ROUTER } from '@/lib/orders/types';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getQuote, getRoutableTokens } from '../app/actions';
import { buildSwapTransaction, loadVaults, Route, Router } from 'dexterity-sdk';
import { request } from '@stacks/connect';
import { TransactionResult } from '@stacks/connect/dist/types/methods';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { signTriggeredSwap } from 'blaze-sdk';
import { uintCV, noneCV } from '@stacks/transactions';
import { formatTokenAmount, convertToMicroUnits } from '../lib/swap-utils';
import { useSwapTokens } from '../contexts/swap-tokens-context';
import { useOrderConditions } from '../contexts/order-conditions-context';
import { usePrices } from '@/contexts/token-price-context';
import { useBalances, useWalletBalances } from '@/contexts/wallet-balance-context';
import { landingSubnet, pairOf, type SubnetPair } from '@/lib/subnet-pairs';
import { payingSubnet } from '@/lib/subnet-commitments';
import { useWallet } from '@/contexts/wallet-context';
import { TxMonitorClient } from '@repo/tx-monitor-client';
import { registerTransactionForMonitoring } from '@/lib/activity/tx-monitor-client';
import { toast } from 'sonner';
import { baseTokenLeaves } from '@/lib/subnet-deposit';
import { moveOf } from '@/lib/route-move';

// Initialize tx-monitor client
const txMonitorClient = new TxMonitorClient();

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

/** The swap page's trading state. Mounted once by RouterTradingProvider; read it with useRouterTrading() */
export function useRouterTradingState() {

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

  // Get prices and balances from new contexts
  const { prices } = usePrices();
  const { getTokenBalance, getSubnetBalance, getSubnetBalanceExact } = useBalances(walletAddress ? [walletAddress] : []);
  const { onSheet } = useWalletBalances();

  // Router config for post conditions
  const routerConfig = useMemo(() => ({
    routerAddress: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    routerName: process.env.NEXT_PUBLIC_ROUTER_NAME || 'multihop'
  }), []);

  // Which of a pair's subnets a route starts from, for quoting: the old-first pick from on-chain balances (the source
  // is settled again, open orders included, right before anything is signed). Both price the same.
  const quoteSource = (pair: SubnetPair, micro: string): string => {
    if (!walletAddress || !micro) return pair.v1;
    const v1 = BigInt(Math.floor(getSubnetBalanceExact(walletAddress, pair.v1)));
    const v2 = BigInt(Math.floor(getSubnetBalanceExact(walletAddress, pair.v2)));
    const amount = BigInt(micro);
    return v1 >= amount || v2 < amount ? pair.v1 : pair.v2;
  };

  /** The subnet that pays `micro` right now: for a v1/v2 pair, old first, after what open orders already commit (throws if split) */
  const resolveSpendSubnetNow = async (contractId: string, micro: string): Promise<string> => {
    if (!walletAddress) throw new Error('Connect wallet');
    return payingSubnet(contractId, walletAddress, BigInt(micro), subnet => getSubnetBalanceExact(walletAddress, subnet));
  };
  // the memoised handlers below always read today's balances through this ref
  const resolveSpendSubnetRef = useRef(resolveSpendSubnetNow);
  resolveSpendSubnetRef.current = resolveSpendSubnetNow;
  const resolveSpendSubnet = (contractId: string, micro: string) => resolveSpendSubnetRef.current(contractId, micro);

  const microAmountRef = useRef('');

  // Helper function to get the contract ID to use for a token based on subnet toggle.
  // CHA, WELSH and sBTC paid into the subnet land in Blaze v2; spent from it, they come from v1 first.
  const getContractIdForToken = useCallback((token: TokenCacheData | null, useSubnet: boolean, side: 'from' | 'to' = 'from'): string | null => {
    if (!token) return null;

    // If we want subnet and token is mainnet, find subnet version
    const id = useSubnet && token.type !== 'SUBNET'
      ? subnetDisplayTokens.find(t => t.base === token.contractId)?.contractId || token.contractId
      : token.contractId;
    const pair = pairOf(id);
    if (pair) return side === 'to' ? pair.v2 : quoteSource(pair, microAmountRef.current);
    return id;
  }, [subnetDisplayTokens, walletAddress, getSubnetBalanceExact]);

  // Derive microAmount from displayAmount (use selected token for decimals)
  const microAmount = displayAmount && selectedFromToken ?
    convertToMicroUnits(displayAmount, selectedFromToken.decimals || 6) : '';
  microAmountRef.current = microAmount;

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

  // The route's two ends as plain ids, so a balance refresh that leaves them unchanged doesn't re-quote
  const fromContractId = getContractIdForToken(selectedFromToken, useSubnetFrom);
  const toContractId = getContractIdForToken(selectedToToken, useSubnetTo, 'to');
  const [quoteTick, setQuoteTick] = useState(0);
  const fetchQuote = () => setQuoteTick(n => n + 1);

  // Quote when the route's ends or the amount change, and again quietly every 30s so it never goes stale. The last
  // quote stays on screen meanwhile; panels only dim it while it doesn't match the inputs.
  useEffect(() => {
    if (!fromContractId || !toContractId) return;
    if (!microAmount || Number(microAmount) <= 0) {
      setQuote(null);
      return;
    }
    let live = true;
    setIsLoadingQuote(true);
    setError(null);
    getQuote(fromContractId, toContractId, microAmount)
      .then(result => {
        if (!live) return;
        if (!result?.data) throw new Error(result?.error || 'Failed to get quote');
        setQuote(result.data);
      })
      .catch(err => {
        if (!live) return;
        setError(err instanceof Error ? err.message : 'Failed to get quote');
        setQuote(null);
      })
      .finally(() => { if (live) setIsLoadingQuote(false); });
    return () => { live = false; };
  }, [fromContractId, toContractId, microAmount, quoteTick]);

  const hasQuote = !!quote;
  useEffect(() => {
    if (!hasQuote) return;
    const id = setInterval(() => setQuoteTick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, [hasQuote]);

  // Whether the quote on screen is for exactly what's entered now (a background refresh keeps it usable)
  const quoteMatches = !!quote && Number(quote.amountIn) === Number(microAmount)
    && quote.path[0]?.contractId === fromContractId && quote.path[quote.path.length - 1]?.contractId === toContractId;

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

  // Create a ref to store the current totalPriceImpact value
  const totalPriceImpactRef = useRef<{ priceImpact: number | null } | null>(null);

  // ---------------------- Swap pop-up ----------------------
  // One pop-up per swap: sent the moment the wallet returns, then confirmed or failed in the same live balance push
  // that settles the balance, so the two never disagree
  const swapToast = (txid: string, state: 'sent' | 'confirmed' | 'failed' | 'waiting') => {
    const [title, detail] = {
      sent: ['Swap sent', 'Waiting for its block…'],
      confirmed: ['Swap confirmed', 'It settled on the chain.'],
      failed: ["Swap didn't go through", 'It failed on the chain, so nothing was swapped.'],
      waiting: ['Still waiting for a block', 'Your swap is sent and will settle on its own.'],
    }[state];
    const body = (
      <div className="flex flex-col gap-1">
        <div className="font-semibold text-foreground">{title}</div>
        <div className="text-muted-foreground text-sm">{detail}</div>
        <a
          href={`https://explorer.hiro.so/txid/${txid}?chain=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block button-primary px-3 py-1.5 text-xs rounded-lg font-medium mt-1 w-fit"
        >
          View on explorer
        </a>
      </div>
    );
    const options = { id: `swap-${txid}`, duration: state === 'sent' ? Infinity : 7000 };
    if (state === 'sent') toast.loading(body, options);
    else if (state === 'confirmed') toast.success(body, options);
    else if (state === 'failed') toast.error(body, options);
    else toast.info(body, options);
  };

  /** A sent transaction's fate as the live balance stream reports it (its chain status); null if the stream goes quiet */
  const fateFromBalances = (address: string, txid: string) => new Promise<string | null>(resolve => {
    const same = (other: string) => other.replace(/^0x/, '').toLowerCase() === txid.replace(/^0x/, '').toLowerCase();
    const done = (status: string | null) => { stop(); clearTimeout(timer); resolve(status); };
    const stop = onSheet(address, sheet => {
      if (sheet.confirmed?.some(c => same(c.txid))) done('success');
      else {
        const failed = sheet.failed.find(f => same(f.txid));
        if (failed) done(failed.status);
      }
    });
    const timer = setTimeout(() => done(null), 3 * 60_000);
  });

  /** Follows a sent swap to its end: from the live balances, or the transaction monitor if they go quiet */
  const followSwap = async (txid: string, recordId: string, fate: Promise<string | null>) => {
    const registered = registerTransactionForMonitoring(txid, recordId, 'swap')
      .catch(error => console.error(`[Swap] Couldn't register ${txid} with the transaction monitor:`, error));
    const status = (await fate) ?? (await txMonitorClient.getTransactionStatus(txid).then(s => s.status, () => null));
    swapToast(txid, status === 'success' ? 'confirmed' : status && status !== 'pending' && status !== 'broadcasted' ? 'failed' : 'waiting');
    await registered;
    if (status) window.dispatchEvent(new CustomEvent('activityStatusUpdate', { detail: { txid, recordId, status } }));
  };

  // Execute swap transaction
  const handleSwap = useCallback(async () => {
    if (!quote || !walletAddress || !selectedFromToken || !selectedToToken) return;
    setError(null);
    setSwapSuccessInfo(null);
    setSwapping(true);
    
    // Track swap initiation
    let swapRecordId: string | null = null;
    
    try {
      let route = quote;
      const first = quote.path[0]?.contractId;
      if (pairOf(first)) {
        const source = await resolveSpendSubnet(first, String(quote.amountIn));
        if (source !== first) {
          const requote = await getQuote(source, quote.path[quote.path.length - 1].contractId, String(quote.amountIn));
          if (!requote?.data) throw new Error(`No route from ${source}: ${requote?.error ?? 'empty quote'}`);
          route = requote.data;
        }
      }

      // First, build and submit transaction to wallet
      const txCfg = await buildSwapTransaction(router.current, route, walletAddress);
      // The post-conditions name walletAddress: ask the wallet to sign with that account, not whichever is active
      const res = await request('stx_callContract', { ...txCfg, address: walletAddress });
      console.log("Swap result:", res);

      if ("error" in res) {
        console.error("Swap failed:", res.error);
        setError("Swap failed");
        // Throw error so it can be caught by swap-button
        throw new Error(res.error);
      }

      // Only create swap record after successful broadcast with txid
      if (res.txid) {
        // Say it's sent at once, and start listening before anything else can delay us
        swapToast(res.txid, 'sent');
        const fate = fateFromBalances(walletAddress, res.txid);
        const { addSwapRecord } = await import('@/lib/swaps/store');
        
        const swapRecord = await addSwapRecord({
          owner: walletAddress,
          inputToken: selectedFromToken.contractId,
          outputToken: selectedToToken.contractId,
          inputAmount: quote.amountIn,
          routePath: quote.path.map(token => token.contractId),
          priceImpact: totalPriceImpactRef.current?.priceImpact || undefined,
          status: 'pending',
          txid: res.txid,
          metadata: {
            route: quote.hops,
            isSubnetShift: moveOf(quote.hops) !== null
          }
        });
        swapRecordId = swapRecord.id;
        console.log('📊 Created swap record after successful broadcast:', swapRecordId, 'txid:', res.txid);
        void followSwap(res.txid, swapRecordId, fate);
      } else {
        setSwapSuccessInfo(res);
      }
    } catch (err) {
      console.error('Swap failed:', err);
      
      // Check if this is a wallet broadcast failure
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isWalletBroadcastError = errorMessage.includes('JsonRpcError') && errorMessage.includes('Error broadcasting transaction');
      
      if (isWalletBroadcastError) {
        // Show wallet-specific error toast
        toast.error(
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <div className="font-semibold text-foreground">Wallet Broadcast Failed</div>
              <div className="text-muted-foreground text-sm">
                Your wallet failed to broadcast the transaction. Please check your connection and try again.
              </div>
            </div>
          </div>,
          { 
            duration: 7000 
          }
        );
      }
      
      // Only update swap record if it was created (i.e., transaction was broadcasted)
      if (swapRecordId) {
        try {
          const { updateSwapRecord } = await import('@/lib/swaps/store');
          await updateSwapRecord(swapRecordId, {
            status: 'failed',
            metadata: { error: err instanceof Error ? err.message : 'Unknown error' }
          });
        } catch (updateErr) {
          console.error('Failed to update swap record:', updateErr);
        }
      }
      
      setError(err instanceof Error ? err.message : "Swap failed");
    } finally {
      setSwapping(false);
    }
  }, [quote, walletAddress, selectedFromToken, selectedToToken]);

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
    strategyType?: 'dca' | 'split' | 'batch' | 'range';
    strategySize?: number;
    strategyPosition?: number;
  }) => {
    console.log('📝 createTriggeredSwap called with:', opts);

    if (!walletAddress) throw new Error('Connect wallet');
    if (!selectedFromToken || !selectedToToken) throw new Error('Select tokens');

    const quotedFrom = getContractIdForToken(selectedFromToken, useSubnetFrom);
    const toContractId = getContractIdForToken(selectedToToken, useSubnetTo, 'to');

    if (!quotedFrom || !toContractId) throw new Error('Unable to determine contract IDs');

    console.log('🔢 Generating UUID and micro amount...');
    const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
    const micro = convertToMicroUnits(opts.amountDisplay, selectedFromToken.decimals || 6);
    // CHA pays from Blaze v1 first, then v2, after what open orders already commit
    const fromContractId = await resolveSpendSubnet(quotedFrom, micro);

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
      multihopContractId: SIGNER_PAYOUT_ROUTER,
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
        router: SIGNER_PAYOUT_ROUTER,
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

    // Step 1: Get balance data using new context functions
    // For mainnet tokens, get both mainnet balance and subnet balance (if subnet version exists)
    // For subnet tokens, get the subnet balance directly
    let mainnetBalance = 0;
    let subnetBalance = 0;

    if (token.type === 'SUBNET') {
      // For subnet tokens, get subnet balance directly and mainnet balance from base token
      subnetBalance = getSubnetBalance(userAddress, token.contractId);
      if (token.base) {
        mainnetBalance = getTokenBalance(userAddress, token.base);
      }
    } else {
      // For mainnet tokens, get mainnet balance and check if subnet version exists
      mainnetBalance = getTokenBalance(userAddress, token.contractId);
      // Look for subnet version of this token
      const subnetVersion = subnetDisplayTokens.find(t => t.base === token.contractId);
      if (subnetVersion) {
        subnetBalance = getSubnetBalance(userAddress, subnetVersion.contractId);
      }
    }

    console.log('🔍 Balance lookup in checkBalanceForOrder:', {
      tokenContract: token.contractId,
      tokenType: token.type,
      tokenBase: token.base,
      mainnetBalance,
      subnetBalance,
      userAddress
    });

    const hasEnoughSubnet = subnetBalance >= requiredAmount;
    const hasEnoughMainnet = mainnetBalance >= requiredAmount;

    // Calculate shortfall - how much more we need after accounting for available mainnet deposit
    const maxDepositAmount = Math.min(mainnetBalance, requiredAmount - subnetBalance);
    const shortfall = Math.max(0, requiredAmount - subnetBalance - maxDepositAmount);

    // Can deposit if we have any mainnet tokens and there's a subnet shortfall
    // TODO: Add subnet contract info check if needed for deposit functionality
    const canDeposit = (requiredAmount - subnetBalance) > 0 && mainnetBalance > 0;

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
  }, [getTokenBalance, getSubnetBalance, subnetDisplayTokens]);

  // Generate swap options for balance checking
  const generateSwapOptions = useCallback(async (
    targetToken: TokenCacheData,
    requiredAmount: number
  ): Promise<SwapOption[]> => {
    console.log(`🔄 Generating swap options for ${requiredAmount} ${targetToken.symbol}...`);

    const targetOutputMicro = convertToMicroUnits(requiredAmount.toString(), targetToken.decimals || 6);
    const seenTokens = new Set<string>();
    const swapPromises: Promise<SwapOption | null>[] = [];

    // TODO: Reimplement balance enumeration with new context
    // For now, return empty array since we need to rewrite this to work with the new balance context
    console.log('⚠️  Swap options generation temporarily disabled - needs rewrite for new balance context');
    return [];
  }, [displayTokens, subnetDisplayTokens, getQuoteForTokens, convertToMicroUnits, formatTokenAmount, getTokenBalance]);

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

      // CHA, WELSH and sBTC deposits land in Blaze v2
      const into = landingSubnet(subnetToken.contractId);
      const params = {
        address: walletAddress,
        contract: into as `${string}.${string}`,
        functionName: 'deposit',
        functionArgs: [
          uintCV(Number(microAmount)),
          noneCV()
        ],
        postConditions: [baseTokenLeaves(walletAddress, mainnetToken, Number(microAmount))]
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
        const res = await request('stx_callContract', { ...txCfg, address: walletAddress });

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
      const price = contractId === '.stx' ? prices['stx'] : prices[contractId];
      return price ? price : undefined;
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

  // Update the ref whenever totalPriceImpact changes
  useEffect(() => {
    totalPriceImpactRef.current = totalPriceImpact;
  }, [totalPriceImpact]);

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
  // Moving one token between Stacks and Blaze, and which way; anything that changes the token is a swap
  const shiftDirection = moveOf(quote?.hops);
  const isSubnetShift = shiftDirection !== null;

  // Custom label based on operation type
  const toLabel = useMemo(() => {
    if (isSubnetShift) {
      return shiftDirection === 'to-subnet' ? 'You receive on Blaze' : 'You receive on Stacks';
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

    // Quote state: isLoadingQuote while the quote on screen isn't for the current inputs (swapping waits for it);
    // isRefreshingQuote while a matching quote is quietly re-checked (nothing changes on screen)
    quote,
    isLoadingQuote: isLoadingQuote && !quoteMatches,
    isRefreshingQuote: isLoadingQuote && quoteMatches,
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