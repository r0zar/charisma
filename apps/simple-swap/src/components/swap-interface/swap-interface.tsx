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
import BalanceCheckDialog from './balance-check-dialog';
import ProModeLayout from './pro-mode-layout';
import { DcaDialog } from "./dca-dialog";
import { TokenCacheData } from "@repo/tokens";
import { SwapProvider, useSwapContext } from "../../contexts/swap-context";
import { toast } from '@/components/ui/sonner';
import { CheckCircle } from 'lucide-react';

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
    orderSuccessInfo,
    clearOrderSuccessInfo,
    swapSuccessInfo,
    clearSwapSuccessInfo,
  } = useSwapContext();

  React.useEffect(() => {
    if (orderSuccessInfo) {
      toast.success(
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <div className="font-semibold text-foreground">Order Created</div>
            <div className="text-muted-foreground text-sm">
              You can view and manage your orders on the Orders page.
            </div>
            <a
              href="/orders"
              className="inline-block button-primary px-3 py-1.5 text-xs rounded-lg font-medium mt-1 w-fit"
            >
              View Orders
            </a>
          </div>
        </div>,
        { duration: 7000 }
      );
      clearOrderSuccessInfo();
    }
    if (swapSuccessInfo && swapSuccessInfo.txid) {
      toast.success(
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <div className="font-semibold text-foreground">Swap Successful</div>
            <div className="text-muted-foreground text-sm">
              Your transaction has been broadcast to the Stacks blockchain.
            </div>
            <a
              href={`https://explorer.stacks.co/txid/${swapSuccessInfo.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block button-primary px-3 py-1.5 text-xs rounded-lg font-medium mt-1 w-fit"
            >
              View on explorer
            </a>
          </div>
        </div>,
        { duration: 7000 }
      );
      clearSwapSuccessInfo();
    }
  }, [orderSuccessInfo, swapSuccessInfo, toast, clearOrderSuccessInfo, clearSwapSuccessInfo]);

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
