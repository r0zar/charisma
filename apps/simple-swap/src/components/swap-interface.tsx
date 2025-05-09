"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import TokenDropdown from "./TokenDropdown";
import { useSwap } from "../hooks/useSwap";
import type { Token } from "../lib/swap-client";
import TokenLogo from "./TokenLogo";
import { ArrowDown, ClockArrowUp, Flame, Repeat } from 'lucide-react';
import TokenInputSection from './swap-interface/TokenInputSection';
import TokenOutputSection from './swap-interface/TokenOutputSection';
import SwapDetails from './swap-interface/swap-details';
import LoadingState from './swap-interface/loading-state';
import SwapButton from './swap-interface/swap-button';
import SwapHeader from './swap-interface/swap-header';
import LimitConditionSection from './swap-interface/LimitConditionSection';
import { Button } from "./ui/button";
import MiniTokenChartWrapper from './mini-token-chart-wrapper';
import { DcaDialog } from "./dca-dialog";
import { useSearchParams } from "next/navigation";

interface SwapInterfaceProps {
  initialTokens?: Token[];
  urlParams?: any;
}

// Helper function to get explorer URL
const getExplorerUrl = (txId: string) => {
  // You can switch this to mainnet or testnet as appropriate
  return `https://explorer.stacks.co/txid/${txId}`;
};

const USD_PRECISION = 6;

export default function SwapInterface({ initialTokens = [], urlParams: _unused }: SwapInterfaceProps) {
  const swap = useSwap({ initialTokens });
  // Extract the tokenPrices to a local constant to avoid linter errors
  const tokenPrices = swap.tokenPrices || null;
  const [swapping, setSwapping] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<'high' | 'medium' | 'low'>('high');

  // State for toggling subnet preference
  const [useSubnetFrom, setUseSubnetFrom] = useState(false);
  const [useSubnetTo, setUseSubnetTo] = useState(false);

  // Keep track of the token selected by the user from the dropdown (might be base or subnet)
  // This helps manage the state before the useEffect updates the actual selected token in useSwap
  const [baseSelectedFromToken, setBaseSelectedFromToken] = useState<Token | null>(null);
  const [baseSelectedToToken, setBaseSelectedToToken] = useState<Token | null>(null);

  // market vs limit
  const [targetPrice, setTargetPrice] = useState('');
  const [conditionToken, setConditionToken] = useState<Token | null>(null);
  const [baseToken, setBaseToken] = useState<Token | null>(null); // null = USD
  const [conditionDir, setConditionDir] = useState<'lt' | 'gt'>('gt');

  const {
    mode,
    setMode,
    selectedTokens,
    selectedFromToken,
    setSelectedFromTokenSafe,
    selectedToToken,
    setSelectedToToken,
    displayAmount,
    setDisplayAmount,
    microAmount,
    setMicroAmount,
    quote,
    error,
    isInitializing,
    isLoadingTokens,
    isLoadingRouteInfo,
    isLoadingQuote,
    isLoadingPrices,
    priceError,
    formatTokenAmount,
    convertToMicroUnits,
    convertFromMicroUnits,
    getTokenLogo,
    handleSwap,
    handleSwitchTokens,
    swapSuccessInfo,
    fromTokenBalance,
    toTokenBalance,
    userAddress,
    fromTokenValueUsd,
    toTokenValueUsd,
    createTriggeredSwap,
    displayTokens,
    tokenCounterparts,
    subnetDisplayTokens,
    hasBothVersions,
  } = swap;

  // Ref to track previous mode
  const prevModeRef = useRef<string>(mode);

  // DCA dialog control
  const [dcaDialogOpen, setDcaDialogOpen] = useState(false);

  // -------------------------------------------------------------------
  // One-time deep-link parameters pulled from the URL (client-only)
  // -------------------------------------------------------------------
  const searchParams = useSearchParams();
  const initialParams = useRef({
    fromSymbol: searchParams.get('fromSymbol') ?? undefined,
    toSymbol: searchParams.get('toSymbol') ?? undefined,
    amount: searchParams.get('amount') ?? undefined,
    mode: searchParams.get('mode') as 'swap' | 'order' | undefined,
    targetPrice: searchParams.get('targetPrice') ?? undefined,
    direction: searchParams.get('direction') as 'lt' | 'gt' | undefined,
    conditionToken: searchParams.get('conditionToken') ?? undefined,
    baseAsset: searchParams.get('baseAsset') ?? undefined,
  }).current;

  const [initDone, setInitDone] = useState(false);

  // Effect to update the ACTUAL selectedFromToken in useSwap based on the toggle
  useEffect(() => {
    if (!baseSelectedFromToken) return; // Only run if a base token is selected

    const isBaseSubnet = baseSelectedFromToken.contractId.includes('-subnet');
    const baseId = isBaseSubnet
      ? baseSelectedFromToken.contractId.substring(0, baseSelectedFromToken.contractId.lastIndexOf('-subnet'))
      : baseSelectedFromToken.contractId;
    const counterparts = tokenCounterparts.get(baseId);

    if (!counterparts) return; // Should not happen if baseSelected exists

    const targetToken = useSubnetFrom ? counterparts.subnet : counterparts.mainnet;

    // Only update if the target token exists and is different from the current actual token
    if (targetToken && targetToken.contractId !== selectedFromToken?.contractId) {
      console.log(`Setting ACTUAL From Token: ${targetToken.symbol} (${targetToken.contractId}) based on toggle ${useSubnetFrom}`);
      setSelectedFromTokenSafe(targetToken);
      // Recalculate microAmount when the underlying token (and thus decimals) might change
      setMicroAmount(convertToMicroUnits(displayAmount, targetToken.decimals));
    }
  }, [baseSelectedFromToken, useSubnetFrom, tokenCounterparts, setSelectedFromTokenSafe, selectedFromToken?.contractId, setMicroAmount, displayAmount, convertToMicroUnits]);

  // Effect to set from token after switching to order mode IF fromtoken does not have -subnet
  useEffect(() => {
    if (mode === 'order' && !selectedTokens[0].contractId.includes('-subnet')) {
      const subnetTokens = selectedTokens.filter(t => t.contractId.includes('-subnet'));
      if (subnetTokens.length > 0) {
        console.log(subnetTokens[0])
        setSelectedFromTokenSafe(subnetTokens[0]);
      }
    }
  }, [mode, selectedTokens, setSelectedFromTokenSafe]);


  // Effect to update the ACTUAL selectedToToken in useSwap based on the toggle
  useEffect(() => {
    if (!baseSelectedToToken) return; // Only run if a base token is selected

    const isBaseSubnet = baseSelectedToToken.contractId.includes('-subnet');
    const baseId = isBaseSubnet
      ? baseSelectedToToken.contractId.substring(0, baseSelectedToToken.contractId.lastIndexOf('-subnet'))
      : baseSelectedToToken.contractId;
    const counterparts = tokenCounterparts.get(baseId);

    if (!counterparts) return;

    const targetToken = useSubnetTo ? counterparts.subnet : counterparts.mainnet;

    // Only update if the target token exists and is different from the current actual token
    if (targetToken && targetToken.contractId !== selectedToToken?.contractId) {
      console.log(`Setting ACTUAL To Token: ${targetToken.symbol} (${targetToken.contractId}) based on toggle ${useSubnetTo}`);
      setSelectedToToken(targetToken);
    }
  }, [baseSelectedToToken, useSubnetTo, tokenCounterparts, setSelectedToToken, selectedToToken?.contractId]);


  // -------------------------------------------------------------------
  // Initialise component state from deep-link once tokens & lists are ready
  // -------------------------------------------------------------------
  useEffect(() => {
    if (initDone || !displayTokens.length) return;

    const { mode: m, targetPrice: tp, direction: dir, fromSymbol, toSymbol, amount } = initialParams;

    if (m === 'order') setMode('order');
    if (tp) setTargetPrice(tp);
    if (dir === 'lt' || dir === 'gt') setConditionDir(dir);

    if (fromSymbol) {
      const t = displayTokens.find(tok => tok.symbol.toLowerCase() === fromSymbol.toLowerCase());
      if (t) setBaseSelectedFromToken(t);
    }

    if (toSymbol) {
      const t = displayTokens.find(tok => tok.symbol.toLowerCase() === toSymbol.toLowerCase());
      if (t) setBaseSelectedToToken(t);
    }

    if (amount && !isNaN(Number(amount))) {
      setDisplayAmount(amount);
    }

    if (initialParams.conditionToken) {
      const t = displayTokens.find(tok => tok.symbol.toLowerCase() === initialParams.conditionToken!.toLowerCase());
      if (t) setConditionToken(t);
    }

    if (initialParams.baseAsset) {
      const t = displayTokens.find(tok => tok.symbol.toLowerCase() === initialParams.baseAsset!.toLowerCase());
      if (t) setBaseToken(t);
    }

    setInitDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTokens]);

  // Determine routing efficiency based on path
  useEffect(() => {
    if (!quote) return;

    // Simple heuristic: based on number of hops
    const hops = quote.route.path.length - 1;
    if (hops === 1) setSecurityLevel('high');
    else if (hops === 2) setSecurityLevel('medium');
    else setSecurityLevel('low');
  }, [quote]);

  // Get USD price helper
  const getUsdPrice = useCallback((contractId: string): number | undefined => {
    if (!tokenPrices) return undefined;
    return contractId === '.stx' ? tokenPrices['stx'] : tokenPrices[contractId];
  }, [tokenPrices]);

  // default target price when token changes
  useEffect(() => {
    if (mode !== 'order') return;
    if (initialParams.targetPrice) return; // don't override deep-linked preset
    if (!conditionToken) return;
    const price = getUsdPrice(conditionToken.contractId);
    if (price !== undefined && targetPrice === '') {
      setTargetPrice(price.toFixed(USD_PRECISION));
    }
  }, [conditionToken, mode, getUsdPrice, targetPrice]);

  // Update target price when condition/base token or prices change
  useEffect(() => {
    if (mode !== 'order') return;
    if (initialParams.targetPrice) return; // don't override deep-linked preset
    if (!conditionToken) return;
    if (!tokenPrices || Object.keys(tokenPrices).length === 0) return;

    const getPrice = (t: Token | null): number | undefined => {
      if (!t) return undefined;
      if (t.contractId === '.stx') return tokenPrices['stx'];
      return tokenPrices[t.contractId];
    };

    const condPrice = getPrice(conditionToken);
    const basePrice = baseToken ? getPrice(baseToken) : tokenPrices['SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt'];

    if (condPrice !== undefined && basePrice && basePrice !== 0) {
      const ratio = condPrice / basePrice;
      setTargetPrice(ratio.toFixed(USD_PRECISION));
    }
  }, [conditionToken, baseToken, tokenPrices, mode]);

  const handleBumpPrice = (percent: number) => {
    const current = parseFloat(targetPrice || '0');
    if (isNaN(current) || current === 0) return;
    const updated = current * (1 + percent);
    setTargetPrice(updated.toFixed(USD_PRECISION));
  };

  // Effect to handle mode changes, specifically defaulting for 'order' mode
  useEffect(() => {
    // Update prevModeRef *after* checking the condition
    const prevMode = prevModeRef.current;
    prevModeRef.current = mode;

    console.log(`Mode changed: ${prevMode} -> ${mode}. Condition token: ${conditionToken?.symbol}`);

    // Only default condition token when switching *into* order mode and not deep-linked tokens
    if (mode === 'order' && prevMode !== 'order' && !conditionToken && !initialParams.fromSymbol && !initialParams.toSymbol) {
      console.log('Attempting to default to Charisma for Order mode...');
      // Locate the base (main-net) Charisma token in the available list
      const charismaBase = displayTokens.find(
        (t) => t.contractId.includes('.charisma-token') && !t.contractId.includes('-subnet')
      );

      if (!charismaBase) {
        console.log('Charisma base token not found in displayTokens yet.');
        return;
      }

      console.log('Found Charisma base token:', charismaBase);

      // 1. Select Charisma as the base FROM token - REQUIRED for subnet toggle effect
      setBaseSelectedFromToken(charismaBase);

      // 2. Enable subnet mode for FROM token
      setUseSubnetFrom(true);

      // 3. Set the condition token to Charisma (prefer subnet variant if present)
      const counterparts = tokenCounterparts.get(charismaBase.contractId);
      const charismaToSet = counterparts?.subnet ?? charismaBase;
      setConditionToken(charismaToSet);
      console.log('Defaulted From token base to Charisma, enabled subnet, set Condition token to Charisma:', charismaToSet);
    }
    // No else needed - we don't want to interfere if the mode is not 'order' or if a token is already selected

  }, [mode, conditionToken, displayTokens, tokenCounterparts, setBaseSelectedFromToken, setUseSubnetFrom, setConditionToken]);

  // Enhanced swap handler with state transitions
  const handleEnhancedSwap = async () => {
    setSwapping(true);
    try {
      await handleSwap(); // handleSwap in useSwap uses the actual selectedFrom/ToToken state
    } catch (err) {
      console.error('Swap failed:', err);
    } finally {
      setSwapping(false);
    }
  };

  const handleSwapTokensClick = () => {
    // update useSwap internal selections
    handleSwitchTokens();

    // swap base token selections as well
    setBaseSelectedFromToken(baseSelectedToToken);
    setBaseSelectedToToken(baseSelectedFromToken);

    // reset subnet toggles
    const prev = useSubnetFrom;
    setUseSubnetFrom(useSubnetTo);
    setUseSubnetTo(prev);
  };

  // Calculate estimated LP fees from the route if available
  const calculateRouteFees = () => {
    // Uses selectedFromToken which is correctly set by useEffect
    if (!quote || !quote.route || !quote.route.hops || quote.route.hops.length === 0 || !selectedFromToken) {
      return null;
    }

    try {
      // Each vault typically charges a fee (e.g., 0.3%)
      // We'll show the number of hops and estimated structure
      const totalHops = quote.route.hops.length;

      // Let's prepare information about each hop's fee, with the token it's paid in
      const hopFees = quote.route.hops.map((hop, index) => {
        const token = index === 0 ? selectedFromToken : quote.route.path[index]; // Use actual token
        const tokenSymbol = token?.symbol || '?';

        // The fee could be stored in different formats:
        // - As a decimal (0.003 = 0.3%)
        // - As basis points (30 = 0.3%)
        // - As a percentage directly (0.3 = 0.3%)
        let feePercentage = 0.3; // Default fallback

        if (hop.vault.fee !== undefined) {
          const rawFee = Number(hop.vault.fee);
          if (!isNaN(rawFee)) {
            // If fee is very large (>100), assume it's in basis points (e.g., 30 = 0.3%)
            if (rawFee > 100) {
              feePercentage = rawFee / 10000;
            }
            // If fee is moderate (0.01-100), assume it's already a percentage
            else if (rawFee >= 0.01 && rawFee <= 100) {
              feePercentage = rawFee;
            }
            // If fee is very small (<0.01), assume it's a decimal representation (e.g., 0.003 = 0.3%)
            else if (rawFee < 0.01 && rawFee > 0) {
              feePercentage = rawFee * 100;
            }
          }
        }

        return {
          token: tokenSymbol,
          percentage: feePercentage,
          vault: hop.vault,
          opcode: hop.opcode,
          quote: hop.quote
        };
      });

      return {
        totalHops,
        hopFees
      };
    } catch (err) {
      console.error('Error calculating route fees:', err);
      return null;
    }
  };

  // Helper to format USD currency
  const formatUsd = (value: number | null) => {
    if (value === null || isNaN(value)) return null;
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate price impact for the whole swap
  const calculateTotalPriceImpact = () => {
    // Uses selectedFromToken and selectedToToken which are correctly set by useEffect
    if (!quote || !selectedFromToken || !selectedToToken || !tokenPrices) return null;

    // Get prices, handling the ".stx" vs "stx" key difference
    const getPrice = (contractId: string): number | undefined => {
      return contractId === '.stx' ? tokenPrices['stx'] : tokenPrices[contractId];
    };

    const fromPrice = getPrice(selectedFromToken.contractId);
    const toPrice = getPrice(selectedToToken.contractId);

    if (fromPrice === undefined || toPrice === undefined) return null;

    const inputValueUsd = Number(microAmount) * fromPrice / (10 ** selectedFromToken.decimals);
    const outputValueUsd = Number(quote.amountOut) * toPrice / (10 ** selectedToToken.decimals);

    if (isNaN(inputValueUsd) || isNaN(outputValueUsd) || inputValueUsd === 0) return null; // Avoid division by zero or NaN results

    const priceImpact = ((outputValueUsd / inputValueUsd) - 1) * 100;

    return {
      inputValueUsd,
      outputValueUsd,
      priceImpact: isNaN(priceImpact) ? null : priceImpact // Ensure impact is not NaN
    };
  };

  // Calculate price impact for each hop in the route
  const calculateHopPriceImpacts = () => {
    if (!quote || !tokenPrices) return [];

    // Helper to get price, handling the ".stx" vs "stx" key difference
    const getPrice = (contractId: string): number | undefined => {
      return contractId === '.stx' ? tokenPrices['stx'] : tokenPrices[contractId];
    };

    const impacts = quote.route.hops.map((hop, index) => {
      const fromToken = quote.route.path[index];
      const toToken = quote.route.path[index + 1];

      const fromPrice = getPrice(fromToken.contractId);
      const toPrice = getPrice(toToken.contractId);

      if (fromPrice === undefined || toPrice === undefined) {
        return { impact: null, fromValueUsd: null, toValueUsd: null };
      }

      // Calculate USD values
      const fromValueUsd = Number(hop.quote?.amountIn || 0) * fromPrice / (10 ** (fromToken.decimals || 6));
      const toValueUsd = Number(hop.quote?.amountOut || 0) * toPrice / (10 ** (toToken.decimals || 6));

      if (isNaN(fromValueUsd) || isNaN(toValueUsd) || fromValueUsd === 0) { // Avoid division by zero or NaN results
        return { impact: null, fromValueUsd: isNaN(fromValueUsd) ? null : fromValueUsd, toValueUsd: isNaN(toValueUsd) ? null : toValueUsd };
      }

      const impact = ((toValueUsd / fromValueUsd) - 1) * 100;

      return {
        impact: isNaN(impact) ? null : impact, // Ensure impact is not NaN
        fromValueUsd,
        toValueUsd
      };
    });

    return impacts;
  };

  const priceImpacts = calculateHopPriceImpacts();
  const totalPriceImpact = calculateTotalPriceImpact();

  // Determine which token is currently displayed in the 'From' dropdown (could be base or subnet)
  const displayedFromToken = displayTokens.find(dt => {
    const baseId = dt.contractId.includes('-subnet')
      ? dt.contractId.substring(0, dt.contractId.lastIndexOf('-subnet'))
      : dt.contractId;
    const selectedBaseId = selectedFromToken?.contractId.includes('-subnet')
      ? selectedFromToken.contractId.substring(0, selectedFromToken.contractId.lastIndexOf('-subnet'))
      : selectedFromToken?.contractId;
    return baseId === selectedBaseId;
  }) || null;

  // Determine which token is currently displayed in the 'To' dropdown
  const displayedToToken = displayTokens.find(dt => {
    const baseId = dt.contractId.includes('-subnet')
      ? dt.contractId.substring(0, dt.contractId.lastIndexOf('-subnet'))
      : dt.contractId;
    const selectedBaseId = selectedToToken?.contractId.includes('-subnet')
      ? selectedToToken.contractId.substring(0, selectedToToken.contractId.lastIndexOf('-subnet'))
      : selectedToToken?.contractId;
    return baseId === selectedBaseId;
  }) || null;


  // Enhanced loading animation - Use LoadingState component
  if (isInitializing || isLoadingTokens || isLoadingRouteInfo) {
    return <LoadingState
      isInitializing={isInitializing}
      isLoadingTokens={isLoadingTokens}
      isLoadingRouteInfo={isLoadingRouteInfo}
    />;
  }

  // Show balance for the currently active token (mainnet or subnet based on toggle)
  const currentFromBalance = fromTokenBalance;
  const currentToBalance = toTokenBalance;

  // Determine if this is a subnet shift operation
  const isSubnetShift = quote?.route.hops.some(hop =>
    hop.vault.name === 'SUB_LINK' ||
    hop.vault.contractName === 'SUB_LINK' ||
    hop.vault.symbol === 'SL'
  );

  // Get shift direction for label customization
  const getShiftDirection = () => {
    if (!isSubnetShift || !selectedToToken) return null;
    return selectedToToken.contractId.includes('-subnet') ? 'to-subnet' : 'from-subnet';
  };

  const shiftDirection = getShiftDirection();

  // Custom label based on operation type
  const toLabel = isSubnetShift
    ? (shiftDirection === 'to-subnet' ? 'You receive in subnet' : 'You receive in mainnet')
    : 'You receive';

  // ---- Limit order creation ----
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

  // ---- DCA Orders creation ----
  async function handleCreateDcaOrders({ slices, intervalHours }: { slices: number; intervalHours: number }) {
    if (!selectedFromToken || !selectedToToken) return;
    if (!displayAmount || Number(displayAmount) <= 0) return;
    if (!targetPrice) return;

    const totalAmount = convertToMicroUnits(displayAmount, selectedFromToken.decimals);
    const sliceAmountMicro = (BigInt(totalAmount) / BigInt(slices)).toString();

    const nowMs = Date.now();
    const intervalMs = intervalHours * 60 * 60 * 1000;

    for (let i = 0; i < slices; i++) {
      const validFrom = new Date(nowMs + i * intervalMs).toISOString();
      const validTo = new Date(nowMs + (i + 1) * intervalMs).toISOString();

      try {
        await createTriggeredSwap({
          conditionToken: conditionToken || selectedToToken,
          baseToken,
          targetPrice,
          direction: conditionDir,
          amountDisplay: convertFromMicroUnits(sliceAmountMicro, selectedFromToken.decimals),
          validFrom,
          validTo,
        });
      } catch (err) {
        console.error('DCA slice creation failed:', err);
      }
    }

    // Optionally notify user
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

  // Share handler
  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (selectedFromToken) params.set('fromSymbol', selectedFromToken.symbol);
    if (selectedToToken) params.set('toSymbol', selectedToToken.symbol);
    if (displayAmount) params.set('amount', displayAmount);
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
    const text = mode === 'order'
      ? `Planning a order on Charisma: ${displayAmount || ''} ${selectedFromToken?.symbol} → ${toTag} when price ${conditionDir === 'lt' ? '≤' : '≥'} ${targetPrice}. `
      : `Swap ${displayAmount || ''} ${selectedFromToken?.symbol} for ${toTag} on Charisma:`;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(tweetUrl, '_blank');
  };

  return (
    <div className="glass-card overflow-hidden shadow-xl border border-border/60">
      {/* Header */}
      <SwapHeader securityLevel={securityLevel} userAddress={userAddress} mode={mode} onModeChange={setMode} onShare={handleShare} />

      <div className="p-6">
        {/* Limit order builder */}
        {mode === 'order' && (
          <>
            <LimitConditionSection
              displayTokens={displayTokens}
              selectedToken={conditionToken || displayedToToken}
              baseToken={baseToken}
              onSelectToken={(t) => {
                setConditionToken(t);
                setTargetPrice(''); // Reset price when condition token changes
              }}
              onSelectBaseToken={(t) => { setBaseToken(t); setTargetPrice(''); }}
              targetPrice={targetPrice}
              onTargetChange={setTargetPrice}
              direction={conditionDir}
              onDirectionChange={setConditionDir}
              onBump={handleBumpPrice}
            />
          </>
        )}


        {/* From section - Use TokenInputSection */}
        <TokenInputSection
          label={'You send'}
          selectedToken={selectedFromToken}
          displayedToken={mode === 'order' ? selectedFromToken : displayedFromToken}
          displayAmount={displayAmount}
          onAmountChange={(v) => {
            if (/^[0-9]*\.?[0-9]*$/.test(v) || v === "") {
              setDisplayAmount(v);
              if (selectedFromToken) {
                setMicroAmount(convertToMicroUnits(v, selectedFromToken.decimals));
              }
            }
          }}
          balance={currentFromBalance}
          displayTokens={mode === 'order' ? subnetDisplayTokens : displayTokens}
          onSelectToken={(t) => {
            console.log("Selected base FROM token:", t.symbol);
            setBaseSelectedFromToken(t);
            // In order mode we ALWAYS use subnet version
            if (mode === 'order') {
              setUseSubnetFrom(true);
            } else {
              setUseSubnetFrom(false);
            }
          }}
          hasBothVersions={mode === 'order' ? true : hasBothVersions(selectedFromToken)}
          isSubnetSelected={mode === 'order' ? true : useSubnetFrom}
          onToggleSubnet={() => {
            if (mode !== 'order') {
              setUseSubnetFrom(!useSubnetFrom);
            }
          }}
          isLoadingPrice={isLoadingPrices}
          tokenValueUsd={formatUsd(fromTokenValueUsd)}
          formatUsd={formatUsd}
          onSetMax={() => {
            setDisplayAmount(currentFromBalance);
            if (selectedFromToken) {
              setMicroAmount(convertToMicroUnits(currentFromBalance, selectedFromToken.decimals));
            }
          }}
        />

        {/* Vertical switch button between From and To */}
        <div className="relative h-10 my-2 flex justify-center">

          <button onClick={handleSwapTokensClick} className="cursor-pointer rounded-full p-2 shadow bg-muted hover:bg-muted/70 transition-transform active:scale-95">
            <ArrowDown className="w-5 h-5 text-primary" />
          </button>
        </div>

        {/* To section - Use TokenOutputSection */}
        <TokenOutputSection
          label={toLabel}
          selectedToken={selectedToToken}
          displayedToken={displayedToToken}
          outputAmount={quote && selectedToToken ? formatTokenAmount(Number(quote.amountOut), selectedToToken.decimals || 0) : "0.00"}
          minimumReceived={quote && selectedToToken ? formatTokenAmount(Number(quote.minimumReceived), selectedToToken.decimals || 0) : ""}
          balance={currentToBalance}
          displayTokens={displayTokens}
          onSelectToken={(t) => {
            console.log("Selected base TO token:", t.symbol);
            setBaseSelectedToToken(t);
            setUseSubnetTo(false); // Reset subnet toggle
            // Actual token update happens in useEffect
          }}
          hasBothVersions={hasBothVersions(selectedToToken)}
          isSubnetSelected={useSubnetTo}
          onToggleSubnet={() => setUseSubnetTo(!useSubnetTo)}
          isLoadingQuote={isLoadingQuote}
          isLoadingPrice={isLoadingPrices}
          tokenValueUsd={formatUsd(toTokenValueUsd)}
          formatUsd={formatUsd}
          quoteHops={quote ? quote.route.path.length - 1 : null}
          priceImpactDisplay={
            totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingPrices && !isLoadingQuote ? (
              <div className={`px-1.5 py-0.5 rounded-sm text-xs font-medium ${totalPriceImpact.priceImpact > 0
                ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                : 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
                }`}>
                {totalPriceImpact.priceImpact > 0 ? '+' : ''}
                {totalPriceImpact.priceImpact.toFixed(2)}% impact
              </div>
            ) : null
          }
        />

        {/* Route visualization - Swap details */}
        <SwapDetails
          quote={quote}
          selectedToToken={selectedToToken}
          microAmount={microAmount}
          tokenPrices={tokenPrices}
          totalPriceImpact={totalPriceImpact}
          priceImpacts={priceImpacts}
          isLoadingPrices={isLoadingPrices}
          isLoadingQuote={isLoadingQuote}
          securityLevel={securityLevel}
          formatTokenAmount={formatTokenAmount}
          formatUsd={formatUsd}
        />

        {/* Route disclaimer for orders */}
        {mode === 'order' && quote && (
          <p className="mt-1 text-xs italic text-muted-foreground text-center">
            Route shown for reference - orders swap routes are optimised at the time of execution.
          </p>
        )}

        {/* Error with enhanced styling */}
        {(error || priceError) && (
          <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-400 animate-[appear_0.3s_ease-out]">
            <div className="flex items-start space-x-3">
              <div className="h-6 w-6 flex-shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mt-0.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1">Transaction Error</h4>
                {error && <p className="text-xs leading-relaxed">{error}</p>}
                {priceError && <p className="text-xs leading-relaxed mt-1">{priceError}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Success Message with enhanced styling */}
        {swapSuccessInfo && (
          <div className="mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-700 dark:text-green-400 animate-[appear_0.3s_ease-out]">
            <div className="flex items-start space-x-3">
              <div className="h-6 w-6 flex-shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mt-0.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1">Swap Successful</h4>
                <p className="text-xs mb-1.5">Your transaction has been confirmed on the Stacks blockchain.</p>
                <div className="flex items-center space-x-1 text-xs">
                  <span className="text-muted-foreground">View on explorer:</span>
                  <a
                    href={getExplorerUrl(swapSuccessInfo.txId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/90 hover:underline flex items-center font-medium"
                  >
                    {swapSuccessInfo.txId.substring(0, 8)}...{swapSuccessInfo.txId.substring(swapSuccessInfo.txId.length - 6)}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced swap button - Use SwapButton component */}
        {mode === 'swap' && <SwapButton
          quote={quote}
          isLoadingQuote={isLoadingQuote}
          swapping={swapping}
          handleSwap={handleEnhancedSwap} // Pass the enhanced handler
          selectedFromToken={selectedFromToken}
          selectedToToken={selectedToToken}
          displayAmount={displayAmount}
        />}

        {mode === 'order' && (
          <div className="mt-6">
            <div className="flex w-full shadow-lg">
              <Button
                onClick={handleCreateLimitOrder}
                className="relative flex-1 rounded-r-none bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 font-semibold overflow-hidden hover:brightness-110 transition-transform active:scale-95 focus:outline-none rounded-l-xl"
              >
                <span className="absolute inset-0 opacity-10 animate-pulse" />
                <span className="relative z-10 flex items-center justify-center">
                  <ClockArrowUp className="w-4 h-4 mr-2" />
                  Create Swap Order
                </span>
              </Button>

              {/* DCA trigger button */}
              <Button
                className="relative w-12 h-auto rounded-l-none bg-gradient-to-r from-purple-700 to-purple-800 text-white overflow-hidden hover:brightness-110 transition-transform active:scale-95 focus:outline-none rounded-r-xl border-l border-white/20"
                title="Create DCA orders"
                onClick={() => setDcaDialogOpen(true)}
              >
                <Repeat className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* DCA dialog */}
        <DcaDialog
          open={dcaDialogOpen}
          onOpenChange={setDcaDialogOpen}
          defaultAmount={displayAmount}
          fromToken={selectedFromToken}
          toToken={selectedToToken}
          conditionToken={conditionToken || selectedToToken}
          baseToken={baseToken}
          targetPrice={targetPrice}
          direction={conditionDir}
          createOrder={createSingleOrder}
        />
      </div>
    </div>
  );

}
