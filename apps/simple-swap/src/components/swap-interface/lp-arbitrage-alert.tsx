"use client";

import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { useSwapTokens } from "../../contexts/swap-tokens-context";
import { useRouterTrading } from "../../hooks/useRouterTrading";

export default function LPArbitrageAlert() {
  const { selectedFromToken, mode, forceBurnSwap, setForceBurnSwap } = useSwapTokens();
  const { burnSwapRoutes, isLoadingBurnSwapRoutes } = useRouterTrading();

  // Check if the from token is an LP token
  const isLPToken = useMemo(() => {
    if (!selectedFromToken) return false;
    // Check for type = "POOL" first (covers all LP tokens including older ones like CORGI)
    if (selectedFromToken.type === 'POOL') {
      return true;
    }
    // Fallback to legacy detection for compatibility
    return (selectedFromToken.properties?.tokenAContract && selectedFromToken.properties?.tokenBContract) ||
      (selectedFromToken.tokenAContract && selectedFromToken.tokenBContract);
  }, [selectedFromToken]);

  // Don't render if not an LP token or not in swap mode
  if (!isLPToken || mode !== 'swap') {
    return null;
  }

  const handleToggle = () => {
    console.log('LP Arbitrage Alert: Toggling forceBurnSwap from', forceBurnSwap, 'to', !forceBurnSwap);
    setForceBurnSwap(!forceBurnSwap);
  };

  return (
    <button
      onClick={handleToggle}
      className={`w-full p-4 rounded-xl border backdrop-blur-sm transition-all duration-200 ${forceBurnSwap
        ? 'bg-purple-500/[0.08] border-purple-500/[0.15] hover:bg-purple-500/[0.12] hover:border-purple-500/[0.25]'
        : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.12]'
        }`}
      title={forceBurnSwap ? "Click to switch to auto routing" : "Click to force burn-swap routing"}
    >
      <div className="flex items-center space-x-3">
        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center flex-shrink-0 backdrop-blur-sm ${forceBurnSwap
          ? 'bg-purple-500/20 border-purple-500/30'
          : 'bg-white/[0.08] border-white/[0.12]'
          }`}>
          <TrendingUp className={`w-5 h-5 ${forceBurnSwap ? 'text-purple-400' : 'text-white/90'
            }`} />
        </div>
        <div className="flex-1 text-left">
          <h3 className={`text-sm font-medium mb-1 ${forceBurnSwap ? 'text-purple-400' : 'text-white/95'
            }`}>
            LP Token Detected
          </h3>
          <p className={`text-xs ${forceBurnSwap ? 'text-white/70' : 'text-white/70'
            }`}>
            {selectedFromToken?.symbol} can be burned to underlying assets for optimized routing.
          </p>
          {forceBurnSwap && (
            <div className="mt-2 text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded">
              🔥 Burn-swap routing forced - will use LP arbitrage regardless of profitability
            </div>
          )}
        </div>
      </div>
    </button>
  );
}