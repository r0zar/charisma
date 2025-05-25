"use client";

import React from "react";
import TokenInputSection from './TokenInputSection';
import TokenOutputSection from './TokenOutputSection';
import SwapDetails from './swap-details';
import LoadingState from './loading-state';
import SwapButton from './swap-button';
import SwapHeader from './swap-header';
import LimitConditionSection from './LimitConditionSection';
import OrderButton from './order-button';
import ReverseTokensButton from './reverse-tokens-button';
import ErrorAlert from './error-alert';
import SuccessAlert from './success-alert';
import BalanceCheckDialog from './balance-check-dialog';
import ProModeLayout from './pro-mode-layout';
import { DcaDialog } from "./dca-dialog";
import { TokenCacheData } from "@repo/tokens";
import { SwapProvider, useSwapContext } from "../../contexts/swap-context";

interface SwapInterfaceProps {
  initialTokens?: TokenCacheData[];
  urlParams?: any;
}

// Inner component that uses the swap context
function SwapInterfaceInner({ urlParams: _unused }: { urlParams?: any }) {
  // Get all swap state from context
  const {
    mode,
    quote,
    isInitializing,
    isLoadingTokens,
    isLoadingRouteInfo,
    balanceCheckResult,
    setBalanceCheckResult,
    isProMode,
  } = useSwapContext();

  // Enhanced loading animation - Use LoadingState component
  if (isInitializing || isLoadingTokens || isLoadingRouteInfo) {
    return <LoadingState />;
  }

  // Render Pro mode layout if enabled and in order mode
  if (isProMode && mode === 'order') {
    return (
      <>
        <SwapHeader />
        <ProModeLayout />
      </>
    );
  }

  return (
    <div className="glass-card overflow-hidden shadow-xl border border-border/60">
      {/* Header */}
      <SwapHeader />

      <div className="p-6">

        {/* Limit order builder */}
        {mode === 'order' && <LimitConditionSection />}

        {/* From section - Use TokenInputSection */}
        <TokenInputSection />

        {/* Vertical switch button between From and To */}
        <ReverseTokensButton />

        {/* To section - Use TokenOutputSection */}
        <TokenOutputSection />

        {/* Route visualization - Swap details */}
        <SwapDetails />

        {/* Route disclaimer for orders */}
        {mode === 'order' && quote && (
          <p className="mt-1 text-xs italic text-muted-foreground text-center">
            Route shown for reference - orders swap routes are optimised at the time of execution.
          </p>
        )}

        {/* Error and Success Messages */}
        <ErrorAlert />
        <SuccessAlert />

        {/* Enhanced swap button - Use SwapButton component */}
        {mode === 'swap' && <SwapButton />}

        {mode === 'order' && <OrderButton />}

        {/* DCA dialog */}
        <DcaDialog />

        {/* Balance Check Dialog */}
        <BalanceCheckDialog
          open={!!balanceCheckResult && !balanceCheckResult.hasEnoughSubnet}
          onOpenChange={(open) => !open && setBalanceCheckResult(null)}
        />
      </div>
    </div>
  );
}

// Main component that provides the swap context
export default function SwapInterface({ initialTokens = [], urlParams }: SwapInterfaceProps) {
  return (
    <SwapProvider initialTokens={initialTokens}>
      <SwapInterfaceInner urlParams={urlParams} />
    </SwapProvider>
  );
}
