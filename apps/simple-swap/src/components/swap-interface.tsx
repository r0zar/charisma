"use client";

import React, { useState } from "react";
import TokenDropdown from "./TokenDropdown";
import { useSwap } from "../hooks/useSwap";
import type { Token } from "../lib/swap-client";
import TokenLogo from "./TokenLogo";

interface SwapInterfaceProps {
  initialTokens?: Token[];
}

// Helper function to get explorer URL
const getExplorerUrl = (txId: string) => {
  // You can switch this to mainnet or testnet as appropriate
  return `https://explorer.stacks.co/txid/${txId}`;
};

export default function SwapInterface({ initialTokens = [] }: SwapInterfaceProps) {
  const swap = useSwap({ initialTokens });
  const [showDetails, setShowDetails] = useState(false);

  const {
    tokens,
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
    formatTokenAmount,
    convertToMicroUnits,
    getTokenLogo,
    handleSwap,
    handleSwitchTokens,
    swapSuccessInfo,
    fromTokenBalance,
    toTokenBalance,
    userAddress,
  } = swap;

  // Simple loader while initializing
  if (isInitializing || isLoadingTokens || isLoadingRouteInfo) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center h-64">
        <div className="relative flex items-center justify-center w-12 h-12 mb-4">
          <div className="absolute w-full h-full border-4 border-primary-400/30 rounded-full"></div>
          <div className="absolute w-full h-full border-4 border-primary-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
        <p className="text-dark-700">Loading swap interface...</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-dark-300/20 p-5 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-dark-800">Swap Tokens</h2>
        <div className="text-xs text-dark-600 truncate max-w-[180px]" title={userAddress}>
          {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}
        </div>
      </div>

      <div className="p-5">
        {/* From section */}
        <div className="bg-dark-300/10 rounded-xl p-4 mb-1">
          <div className="flex justify-between mb-2">
            <label className="text-xs text-dark-600">You pay</label>
            {selectedFromToken && (
              <span className="text-xs text-dark-600 flex items-center gap-1">
                Balance: <span className="font-medium">{fromTokenBalance}</span> {selectedFromToken.symbol}
                {Number(fromTokenBalance) > 0 && (
                  <button
                    className="ml-1 text-primary-500 hover:text-primary-600 font-medium"
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
              </span>
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
              className="input-field text-2xl font-semibold placeholder:text-dark-500"
            />
            <div className="min-w-[130px]">
              <TokenDropdown
                tokens={tokens}
                selected={selectedFromToken}
                onSelect={(t) => {
                  setSelectedFromToken(t);
                  setMicroAmount(convertToMicroUnits(displayAmount, t.decimals));
                }}
                label=""
              />
            </div>
          </div>
        </div>

        {/* Switch button */}
        <div className="relative h-8">
          <button
            onClick={handleSwitchTokens}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-dark-300 hover:bg-dark-400 rounded-full p-2 shadow-md transition-colors z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-dark-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-9 9h2" />
              <path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 9-9h-2" />
              <path d="M17 8l-4-4-4 4" />
              <path d="M7 16l4 4 4-4" />
            </svg>
          </button>
        </div>

        {/* To section */}
        <div className="bg-dark-300/10 rounded-xl p-4 mb-5">
          <div className="flex justify-between mb-2">
            <label className="text-xs text-dark-600">You receive</label>
            {selectedToToken && (
              <span className="text-xs text-dark-600">
                Balance: <span className="font-medium">{toTokenBalance}</span> {selectedToToken.symbol}
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <div className="text-2xl font-semibold text-dark-800">
              {isLoadingQuote ? (
                <div className="animate-pulse flex space-x-1 items-center">
                  <div className="h-5 w-5 bg-dark-400/20 rounded-md"></div>
                  <div className="h-5 w-16 bg-dark-400/20 rounded-md"></div>
                </div>
              ) : quote ? (
                formatTokenAmount(Number(quote.amountOut), selectedToToken?.decimals || 0)
              ) : (
                "0.00"
              )}
            </div>
            <div className="min-w-[130px]">
              <TokenDropdown
                tokens={tokens}
                selected={selectedToToken}
                onSelect={setSelectedToToken}
                label=""
              />
            </div>
          </div>
        </div>

        {/* Quote details */}
        {quote && !isLoadingQuote && (
          <div
            className="mb-5 border-dark-300/20 border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex justify-between items-center p-3 hover:bg-dark-300/10 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="font-medium text-dark-700">Swap details</span>
              </div>
              <div className="text-sm text-dark-600">
                1 {selectedFromToken?.symbol} = {quote.expectedPrice.toFixed(6)} {selectedToToken?.symbol}
              </div>
            </button>

            {showDetails && (
              <div className="p-3 pt-0 bg-dark-300/5 text-sm space-y-3">
                <div className="flex justify-between py-2 border-t border-dark-300/10">
                  <span className="text-dark-600">Minimum received</span>
                  <span className="font-medium">{formatTokenAmount(Number(quote.minimumReceived), selectedToToken?.decimals || 0)} {selectedToToken?.symbol}</span>
                </div>

                {/* Path */}
                <div className="flex justify-between py-2 border-t border-dark-300/10">
                  <span className="text-dark-600">Route</span>
                  <div className="flex items-center">
                    {quote.route.path.map((tok: Token, idx: number) => (
                      <div key={tok.contractId} className="flex items-center">
                        {idx > 0 && <svg className="h-4 w-4 mx-1 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>}
                        <div className="flex items-center space-x-1">
                          <TokenLogo token={tok} size="sm" />
                          <span className="font-medium">{tok.symbol}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600">
            <div className="flex items-start space-x-2">
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Success Message */}
        {swapSuccessInfo && (
          <div className="mb-5 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600">
            <div className="flex items-start space-x-2">
              <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <span className="block">Swap successful!</span>
                <div className="text-sm flex items-center space-x-1 mt-0.5">
                  <span>View transaction:</span>
                  <a
                    href={getExplorerUrl(swapSuccessInfo.txId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 hover:underline flex items-center"
                  >
                    {swapSuccessInfo.txId.substring(0, 8)}...
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          disabled={!quote || isLoadingQuote}
          onClick={handleSwap}
          className="button-primary w-full"
        >
          {isLoadingQuote ? (
            <span className="flex items-center space-x-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading Quote</span>
            </span>
          ) : !selectedFromToken || !selectedToToken ? (
            "Select Tokens"
          ) : !displayAmount || displayAmount === "0" ? (
            "Enter Amount"
          ) : (
            "Swap Tokens"
          )}
        </button>
      </div>
    </div>
  );
}
