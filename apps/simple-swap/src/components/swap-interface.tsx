"use client";

import React, { useState, useEffect } from "react";
import TokenDropdown from "./TokenDropdown";
import { useSwap } from "../hooks/useSwap";
import type { Token } from "../lib/swap-client";
import TokenLogo from "./TokenLogo";

interface SwapInterfaceProps {
  initialTokens?: Token[];
  urlParams?: {
    fromSymbol?: string;
    toSymbol?: string;
    amount?: string;
  };
}

// Helper function to get explorer URL
const getExplorerUrl = (txId: string) => {
  // You can switch this to mainnet or testnet as appropriate
  return `https://explorer.stacks.co/txid/${txId}`;
};

export default function SwapInterface({ initialTokens = [], urlParams }: SwapInterfaceProps) {
  const swap = useSwap({ initialTokens });
  // Extract the tokenPrices to a local constant to avoid linter errors
  const tokenPrices = swap.tokenPrices || null;
  const [showDetails, setShowDetails] = useState(false);
  const [showRouteDetails, setShowRouteDetails] = useState(true);
  const [swapping, setSwapping] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<'high' | 'medium' | 'low'>('high');

  const {
    selectedTokens,
    selectedFromToken,
    setSelectedFromToken,
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
    getTokenLogo,
    handleSwap,
    handleSwitchTokens,
    swapSuccessInfo,
    fromTokenBalance,
    toTokenBalance,
    userAddress,
    fromTokenValueUsd,
    toTokenValueUsd,
  } = swap;

  // Apply URL parameters when component loads
  useEffect(() => {
    if (!urlParams || !selectedTokens?.length || (!urlParams.fromSymbol && !urlParams.toSymbol)) {
      return;
    }

    // Only apply URL params once when tokens are loaded
    if (selectedFromToken && selectedToToken) {
      return;
    }

    // Find tokens by symbol (case insensitive) or contract ID
    if (urlParams.fromSymbol) {
      const fromToken = selectedTokens.find(
        (token: Token) =>
          token.symbol.toLowerCase() === urlParams.fromSymbol?.toLowerCase() ||
          token.contractId === urlParams.fromSymbol
      );
      if (fromToken) {
        setSelectedFromToken(fromToken);
      }
    }

    if (urlParams.toSymbol) {
      const toToken = selectedTokens.find(
        (token: Token) =>
          token.symbol.toLowerCase() === urlParams.toSymbol?.toLowerCase() ||
          token.contractId === urlParams.toSymbol
      );
      if (toToken) {
        setSelectedToToken(toToken);
      }
    }

    // Set initial amount if provided
    if (urlParams.amount && !isNaN(Number(urlParams.amount))) {
      setDisplayAmount(urlParams.amount);

      // Update microAmount if we have the from token
      if (selectedFromToken) {
        setMicroAmount(convertToMicroUnits(urlParams.amount, selectedFromToken.decimals));
      }
    }
  }, [selectedTokens, urlParams, selectedFromToken, selectedToToken, setSelectedFromToken, setSelectedToToken, setDisplayAmount, setMicroAmount, convertToMicroUnits]);

  // Determine routing efficiency based on path
  useEffect(() => {
    if (!quote) return;

    // Simple heuristic: based on number of hops
    const hops = quote.route.path.length - 1;
    if (hops === 1) setSecurityLevel('high');
    else if (hops === 2) setSecurityLevel('medium');
    else setSecurityLevel('low');
  }, [quote]);

  // Enhanced swap handler with state transitions
  const handleEnhancedSwap = async () => {
    setSwapping(true);
    try {
      await handleSwap();
    } catch (err) {
      console.error('Swap failed:', err);
    } finally {
      setSwapping(false);
    }
  };

  // Calculate estimated LP fees from the route if available
  const calculateRouteFees = () => {
    if (!quote || !quote.route || !quote.route.hops || quote.route.hops.length === 0) {
      return null;
    }

    try {
      // Each vault typically charges a fee (e.g., 0.3%)
      // We'll show the number of hops and estimated structure
      const totalHops = quote.route.hops.length;

      // Let's prepare information about each hop's fee, with the token it's paid in
      const hopFees = quote.route.hops.map((hop, index) => {
        const token = index === 0 ? selectedFromToken : quote.route.path[index];
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

  const routeFees = calculateRouteFees();

  // Helper to format USD currency
  const formatUsd = (value: number | null) => {
    if (value === null || isNaN(value)) return null;
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate price impact for the whole swap
  const calculateTotalPriceImpact = () => {
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

  // Enhanced loading animation
  if (isInitializing || isLoadingTokens || isLoadingRouteInfo) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center h-[400px]">
        <div className="relative flex items-center justify-center w-16 h-16 mb-6">
          <div className="absolute w-full h-full border-4 border-primary/20 rounded-full"></div>
          <div className="absolute w-full h-full border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
          <div className="absolute w-2/3 h-2/3 border-4 border-primary/30 rounded-full animate-[spin_1.2s_linear_infinite]"></div>
        </div>
        <h3 className="text-xl font-semibold mb-2 text-foreground">Initializing Secure Swap</h3>
        <div className="flex flex-col gap-2 items-center">
          <p className="text-sm text-muted-foreground animate-pulse">
            {isInitializing ? "Establishing secure connection..." :
              isLoadingTokens ? "Loading verified token list..." :
                "Building secure routing graph..."}
          </p>
          <div className="w-48 h-1 mt-3 bg-muted/30 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{
              width: isInitializing ? '30%' : isLoadingTokens ? '60%' : '90%'
            }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden shadow-xl border border-border/60">
      {/* Header with security indicator */}
      <div className="border-b border-border/30 p-5 flex justify-between items-center bg-gradient-to-r from-card to-card/90">
        <div className="flex items-center flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-foreground">Secure Token Swap</h2>

          {/* Security level indicator */}
          {securityLevel && (
            <div className="flex items-center bg-background/40 px-2 py-0.5 rounded-full">
              <span className={`h-2 w-2 rounded-full mr-1.5 ${securityLevel === 'high' ? 'bg-green-500' :
                securityLevel === 'medium' ? 'bg-blue-500' : 'bg-purple-500'
                }`}></span>
              <span className="text-xs">Routing optimizer</span>
            </div>
          )}
        </div>

        <div className="flex items-center shrink-0">
          {userAddress && (
            <div className="flex items-center text-xs text-muted-foreground px-2 py-1 bg-muted/40 rounded-md cursor-pointer hover:bg-muted/60 transition-colors max-w-[120px] sm:max-w-none"
              title={userAddress}>
              <svg className="h-3 w-3 mr-1 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* From section */}
        <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-1 backdrop-blur-sm border border-muted/40 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0 mb-2">
            <div className="flex items-center">
              <label className="text-sm text-foreground/80 font-medium">You pay</label>
              {microAmount && Number(microAmount) > 0 && !isLoadingQuote && (
                <span className="ml-2 text-xs px-1.5 py-0.5 font-mono bg-primary/10 text-primary rounded">
                  {formatTokenAmount(Number(microAmount), selectedFromToken?.decimals || 6)} {selectedFromToken?.symbol}
                </span>
              )}
            </div>

            {selectedFromToken && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-full self-start">
                Balance: <span className="font-semibold text-foreground">{fromTokenBalance}</span> {selectedFromToken.symbol}
                {Number(fromTokenBalance) > 0 && (
                  <button
                    className="ml-1 text-primary font-semibold bg-primary/10 px-1.5 rounded hover:bg-primary/20 transition-colors"
                    onClick={() => {
                      setDisplayAmount(fromTokenBalance);
                      if (selectedFromToken) {
                        setMicroAmount(convertToMicroUnits(fromTokenBalance, selectedFromToken.decimals));
                      }
                    }}
                  >
                    MAX
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <input
              value={displayAmount}
              onChange={(e) => {
                const v = e.target.value;
                if (/^[0-9]*\.?[0-9]*$/.test(v) || v === "") {
                  setDisplayAmount(v);
                  if (selectedFromToken) {
                    setMicroAmount(convertToMicroUnits(v, selectedFromToken.decimals));
                  }
                }
              }}
              placeholder="0.00"
              className="bg-transparent border-none text-xl sm:text-2xl font-medium focus:outline-none w-full placeholder:text-muted-foreground/50"
            />

            <div className="min-w-[120px] sm:min-w-[140px] shrink-0">
              <TokenDropdown
                tokens={selectedTokens}
                selected={selectedFromToken}
                onSelect={(t) => {
                  setSelectedFromToken(t);
                  setMicroAmount(convertToMicroUnits(displayAmount, t.decimals));
                }}
                label=""
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 h-4 flex items-center">
            {isLoadingPrices ? (
              <div className="flex items-center space-x-1">
                <span className="h-2 w-2 bg-primary/30 rounded-full animate-pulse"></span>
                <span className="animate-pulse">Loading price...</span>
              </div>
            ) : fromTokenValueUsd !== null ? (
              <span>~{formatUsd(fromTokenValueUsd)}</span>
            ) : null}
          </div>
        </div>

        {/* Switch button */}
        <div className="relative h-10 flex justify-center">
          <button
            onClick={handleSwitchTokens}
            className="absolute z-10 rounded-full p-2.5 shadow-md transition-all"
            style={{
              background: "linear-gradient(to bottom right, var(--color-background), var(--color-muted))"
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </button>
        </div>

        {/* To section */}
        <div className="bg-muted/20 rounded-2xl p-4 sm:p-5 mb-5 backdrop-blur-sm border border-muted/40 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-0 mb-2">
            <div className="flex items-center">
              <label className="text-sm text-foreground/80 font-medium">You receive</label>
              {quote && !isLoadingQuote && (
                <span className="ml-2 text-xs px-1.5 py-0.5 font-mono bg-green-500/10 text-green-600 dark:text-green-400 rounded">
                  Min: {formatTokenAmount(Number(quote.minimumReceived), selectedToToken?.decimals || 6)} {selectedToToken?.symbol}
                </span>
              )}
            </div>

            {selectedToToken && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 bg-background/40 px-2 py-0.5 rounded-full self-start">
                Balance: <span className="font-semibold text-foreground">{toTokenBalance}</span> {selectedToToken.symbol}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center gap-3">
            <div className="text-xl sm:text-2xl font-medium text-foreground relative min-h-[36px]">
              {isLoadingQuote ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse bg-muted rounded-md h-8 w-20"></div>
                  <div className="relative h-4 w-4">
                    <div className="absolute animate-ping h-full w-full rounded-full bg-primary opacity-30"></div>
                    <div className="absolute h-full w-full rounded-full bg-primary opacity-75 animate-pulse"></div>
                  </div>
                </div>
              ) : quote ? (
                <>
                  {formatTokenAmount(Number(quote.amountOut), selectedToToken?.decimals || 0)}
                  <div className="text-sm text-muted-foreground flex items-center">
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                      {quote.route.path.length - 1} {quote.route.path.length - 1 === 1 ? 'hop' : 'hops'}
                    </span>
                  </div>
                </>
              ) : (
                "0.00"
              )}
            </div>

            <div className="min-w-[120px] sm:min-w-[140px] shrink-0">
              <TokenDropdown
                tokens={selectedTokens}
                selected={selectedToToken}
                onSelect={setSelectedToToken}
                label=""
              />
            </div>
          </div>
          <div className="text-xs mt-1.5 h-4 flex items-center justify-between">
            <div className="text-muted-foreground">
              {isLoadingQuote ? null : // Don't show loading if quote is loading
                isLoadingPrices ? (
                  <div className="flex items-center space-x-1">
                    <span className="h-2 w-2 bg-primary/30 rounded-full animate-pulse"></span>
                    <span className="animate-pulse">Loading price...</span>
                  </div>
                ) : toTokenValueUsd !== null ? (
                  <span>~{formatUsd(toTokenValueUsd)}</span>
                ) : null}
            </div>
            {totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingPrices && !isLoadingQuote && (
              <div className={`px-1.5 py-0.5 rounded-sm font-medium ${totalPriceImpact.priceImpact > 0
                ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                : 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
                }`}>
                {totalPriceImpact.priceImpact > 0 ? '+' : ''}
                {totalPriceImpact.priceImpact.toFixed(2)}% impact
              </div>
            )}
          </div>
        </div>

        {/* Route visualization - always show this section */}
        <div className="mb-5 border border-border/40 rounded-xl overflow-hidden bg-card/30 backdrop-blur-sm shadow-sm">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex justify-between items-center p-4 hover:bg-muted/10 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-primary transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <div className="flex items-center">
                <span className="font-medium text-foreground">Swap details</span>
                {securityLevel && (
                  <span className={`ml-2 inline-flex px-1.5 py-0.5 text-xs rounded-full items-center ${securityLevel === 'high' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                    securityLevel === 'medium' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                      'bg-purple-500/10 text-purple-700 dark:text-purple-400'
                    }`}>
                    <span className={`h-1.5 w-1.5 rounded-full mr-1 ${securityLevel === 'high' ? 'bg-green-500' :
                      securityLevel === 'medium' ? 'bg-blue-500' : 'bg-purple-500'
                      }`}></span>
                    {securityLevel === 'high' ? 'Direct route' :
                      securityLevel === 'medium' ? 'Optimized path' : 'Advanced routing'}
                  </span>
                )}
              </div>
            </div>
            {!isLoadingQuote && quote && (
              <div className="text-sm text-muted-foreground flex items-center">
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                  {quote.route.path.length - 1} {quote.route.path.length - 1 === 1 ? 'hop' : 'hops'}
                </span>
              </div>
            )}
          </button>

          {showDetails && (
            <div className="p-4 pt-0 pb-0 bg-card/50 text-sm space-y-4">
              {/* Minimum received */}
              {quote && (
                <div className="flex justify-between pt-3 border-t border-border/30">
                  <span className="text-muted-foreground flex items-center">
                    <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                    Minimum received
                  </span>
                  <span className="font-medium text-foreground flex items-center">
                    {formatTokenAmount(Number(quote.minimumReceived), selectedToToken?.decimals || 0)} {selectedToToken?.symbol}
                  </span>
                </div>
              )}

              {/* Path/Route visualization with price impacts */}
              {quote && (
                <div className="flex flex-col pt-3 border-t border-border/30">
                  <button
                    onClick={() => setShowRouteDetails(!showRouteDetails)}
                    className="flex items-center justify-between w-full"
                  >
                    <span className="text-muted-foreground flex items-center">
                      <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      Route details ({quote.route.path.length - 1} {quote.route.path.length - 1 === 1 ? 'hop' : 'hops'})
                    </span>
                    <div className="flex items-center gap-1">
                      {/* Replace price impact with mini-path view */}
                      {quote && quote.route.path.length > 0 && (
                        <div className="flex items-center space-x-0.5">
                          {quote.route.path.map((token, index) => (
                            <React.Fragment key={token.contractId || index}>
                              <div className="h-4 w-4 rounded-full bg-background flex items-center justify-center overflow-hidden border border-border/30">
                                <TokenLogo token={token} size="sm" />
                              </div>
                              {index < quote.route.path.length - 1 && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-muted-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 text-primary/70 transition-transform duration-200 ${showRouteDetails ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </button>

                  {showRouteDetails && (
                    <div className="flex flex-col space-y-2 mt-3 animate-[slideDown_0.2s_ease-out]">
                      {/* Starting token with USD value */}
                      <div className="bg-muted/20 rounded-xl p-3 sm:p-3.5 border border-border/40">
                        <div className="flex items-center mb-2">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                            <TokenLogo token={quote.route.path[0]} size="lg" />
                          </div>
                          <div className="ml-2 sm:ml-2.5">
                            <div className="font-medium text-sm sm:text-base">
                              {quote.route.path[0].symbol}
                              <span className="font-normal ml-1 text-xs text-muted-foreground">
                                ({formatTokenAmount(Number(microAmount), quote.route.path[0].decimals || 6)})
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center">
                              <span>Start</span>
                              {tokenPrices && tokenPrices[quote.route.path[0].contractId] && (
                                <span className="ml-1">
                                  ~{formatUsd(Number(microAmount) * tokenPrices[quote.route.path[0].contractId] / (10 ** (quote.route.path[0].decimals || 6)))}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hops with price impact */}
                      {quote.route.hops.map((hop, idx) => {
                        const fromToken = quote.route.path[idx];
                        const toToken = quote.route.path[idx + 1];
                        const vaultName = hop.vault.name || 'Liquidity Pool';
                        const formattedFee = (hop.vault.fee / 10000).toFixed(2);
                        const priceImpact = priceImpacts[idx];

                        return (
                          <div key={`hop-${idx}`} className="flex flex-col">
                            {/* Arrow connecting nodes */}
                            <div className="h-6 flex justify-center items-center">
                              <div className="h-full border-l-2 border-dashed border-primary/30"></div>
                            </div>

                            {/* Pool node with price impact */}
                            <div className="bg-muted/20 rounded-xl p-3 sm:p-3.5 border border-primary/30 border-dashed">
                              <div className="flex items-center mb-2">
                                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-primary/20 flex items-center justify-center">
                                  <img className="rounded-md" src={hop.vault.image} alt="Vault" width={32} height={32} />
                                </div>
                                <div className="ml-2 sm:ml-2.5">
                                  <div className="font-medium text-sm sm:text-base">{vaultName}</div>
                                  <div className="text-xs text-muted-foreground flex items-center">
                                    <span className="text-primary">{formattedFee} % fee to LP providers</span>
                                    {/* Price impact badge */}
                                    {priceImpact && priceImpact.impact !== null && (
                                      <span className={`ml-2 px-1.5 py-0.5 rounded-sm ${priceImpact.impact > 0
                                        ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                                        : 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
                                        }`}>
                                        {priceImpact.impact > 0 ? '+' : ''}
                                        {priceImpact.impact.toFixed(2)}% impact
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:justify-between text-xs mt-1 text-muted-foreground">
                                <div className="flex items-center">
                                  <div className="h-5 w-5 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden mr-1.5">
                                    <TokenLogo token={fromToken} size="sm" />
                                  </div>
                                  <span className="font-medium text-foreground/90">{fromToken.symbol}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    {idx === 0 ? `(${formatTokenAmount(Number(microAmount), fromToken.decimals || 6)})` : `(${formatTokenAmount(Number(hop.quote?.amountIn), fromToken.decimals || 6)})`}
                                  </span>
                                  {/* Add USD value */}
                                  {priceImpact && priceImpact.fromValueUsd !== null && (
                                    <span className="ml-1">~{formatUsd(priceImpact.fromValueUsd)}</span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  <div className="h-5 w-5 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden mr-1.5">
                                    <TokenLogo token={toToken} size="sm" />
                                  </div>
                                  <span className="font-medium text-foreground/90">{toToken.symbol}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    {`(${formatTokenAmount(Number(hop.quote?.amountOut), toToken.decimals || 6)})`}
                                  </span>
                                  {/* Add USD value */}
                                  {priceImpact && priceImpact.toValueUsd !== null && (
                                    <span className="ml-1">~{formatUsd(priceImpact.toValueUsd)}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Arrow connecting nodes */}
                            <div className="h-6 flex justify-center items-center">
                              <div className="h-full border-l-2 border-dashed border-primary/30"></div>
                            </div>

                            {/* Only show intermediate tokens (not the final destination) */}
                            {idx < quote.route.hops.length - 1 && (
                              <div className="bg-muted/20 rounded-xl p-3 sm:p-3.5 border border-border/40">
                                <div className="flex items-center">
                                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                                    <TokenLogo token={toToken} size="lg" />
                                  </div>
                                  <div className="ml-2 sm:ml-2.5">
                                    <div className="font-medium text-sm sm:text-base">{toToken.symbol}</div>
                                    <div className="text-xs text-muted-foreground flex items-center">
                                      <span>Intermediate</span>
                                      {tokenPrices && tokenPrices[toToken.contractId] && (
                                        <span className="ml-1">
                                          ~{formatUsd(Number(hop.quote?.amountOut) * tokenPrices[toToken.contractId] / (10 ** (toToken.decimals || 6)))}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Final token with USD value */}
                      <div className="bg-green-500/10 dark:bg-green-900/20 rounded-xl p-2.5 sm:p-3.5 border border-green-500/30">
                        <div className="flex items-center">
                          <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-full bg-background shadow-sm border border-border/50 flex items-center justify-center overflow-hidden">
                            <TokenLogo token={quote.route.path[quote.route.path.length - 1]} size="lg" />
                          </div>
                          <div className="ml-2 sm:ml-2.5">
                            <div className="font-medium text-xs sm:text-base">
                              {quote.route.path[quote.route.path.length - 1].symbol}
                              <span className="font-normal ml-1 text-xs text-muted-foreground">
                                ({formatTokenAmount(Number(quote.amountOut), quote.route.path[quote.route.path.length - 1].decimals || 6)})
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-xs text-green-600 dark:text-green-400">Destination</span>
                              {tokenPrices && tokenPrices[quote.route.path[quote.route.path.length - 1].contractId] && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ~{formatUsd(Number(quote.amountOut) * tokenPrices[quote.route.path[quote.route.path.length - 1].contractId] / (10 ** (quote.route.path[quote.route.path.length - 1].decimals || 6)))}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Total price impact summary */}
              {quote && totalPriceImpact && totalPriceImpact.priceImpact !== null && !isLoadingPrices && (
                <div className="flex justify-between py-3 border-t border-border/30">
                  <span className="text-muted-foreground flex items-center">
                    <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                    </svg>
                    Total price impact
                  </span>
                  <div className="flex items-center">
                    <div className="mr-2 text-xs flex">
                      <span className="text-muted-foreground">Input:</span>
                      <span className="ml-1 text-foreground/90">{formatUsd(totalPriceImpact.inputValueUsd)}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="text-muted-foreground">Output:</span>
                      <span className="ml-1 text-foreground/90">{formatUsd(totalPriceImpact.outputValueUsd)}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-sm text-xs font-medium ${totalPriceImpact.priceImpact > 0
                      ? 'text-green-600 dark:text-green-400 bg-green-100/30 dark:bg-green-900/20'
                      : 'text-red-600 dark:text-red-400 bg-red-100/30 dark:bg-red-900/20'
                      }`}>
                      {totalPriceImpact.priceImpact > 0 ? '+' : ''}
                      {totalPriceImpact.priceImpact.toFixed(2)}% impact
                    </span>
                  </div>
                </div>
              )}

              {/* Vault Security Info */}
              {quote && (
                <div className="flex justify-between py-3 border-t border-border/30">
                  <span className="text-muted-foreground flex items-center">
                    <svg className="h-4 w-4 mr-1.5 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Vault security
                  </span>
                  <span className="font-medium flex items-center bg-green-500/10 px-2 py-0.5 text-xs rounded text-green-700 dark:text-green-400">
                    <svg className="h-3.5 w-3.5 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    Isolated contracts
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

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

        {/* Enhanced swap button */}
        <button
          disabled={!quote || isLoadingQuote || swapping}
          onClick={handleEnhancedSwap}
          className={`w-full py-3.5 rounded-xl font-medium text-white shadow-lg transition-all transform relative overflow-hidden ${!quote || isLoadingQuote || swapping
            ? 'bg-primary/60 cursor-not-allowed opacity-70'
            : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary/80 active:scale-[0.99]'
            }`}
        >
          {isLoadingQuote ? (
            <span className="flex items-center justify-center space-x-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Computing best route...</span>
            </span>
          ) : swapping ? (
            <span className="flex items-center justify-center space-x-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing transaction...</span>
            </span>
          ) : !selectedFromToken || !selectedToToken ? (
            <span className="flex items-center justify-center">
              <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="8" y1="12" x2="16" y2="12"></line>
              </svg>
              Select Tokens
            </span>
          ) : !displayAmount || displayAmount === "0" ? (
            <span className="flex items-center justify-center">
              <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Enter Amount
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
              Execute Secure Swap
            </span>
          )}

          {/* Animated background for the button */}
          {!isLoadingQuote && !swapping && quote && selectedFromToken && selectedToToken && displayAmount && displayAmount !== "0" && (
            <div className="absolute top-0 right-0 bottom-0 left-0 opacity-10">
              <div className="absolute inset-0 bg-white h-full w-1/3 blur-xl transform -skew-x-12 translate-x-full animate-[shimmer_2s_infinite]"></div>
            </div>
          )}
        </button>

        {/* Security note */}
        <div className="mt-4 text-xs text-muted-foreground flex items-center justify-center">
          <svg className="h-3 w-3 mr-1 text-primary/70" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          Protected by automatic post-conditions and isolated vaults
        </div>
      </div>
    </div>
  );
}
