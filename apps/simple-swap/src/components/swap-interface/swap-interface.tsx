"use client";

import React, { useEffect } from "react";
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
import { DcaDialog } from "./dca-dialog";
import { TokenCacheData } from "@repo/tokens";
import { SwapTokensProvider, useSwapTokens } from "../../contexts/swap-tokens-context";
import { useRouterTrading } from "../../hooks/useRouterTrading";
import { toast } from '@/components/ui/sonner';

interface SwapInterfaceProps {
  initialTokens?: TokenCacheData[];
  urlParams?: any;
  searchParams?: URLSearchParams;
  headerOnly?: boolean;
}

// Inner component that uses the swap context
function SwapInterfaceInner({ urlParams: _unused, headerOnly = false }: { urlParams?: any; headerOnly?: boolean }) {
  // Get swap token state from context
  const {
    mode,
    isInitializing,
    isLoadingTokens,
  } = useSwapTokens();

  // Get router and trading functionality
  const {
    quote,
    balanceCheckResult,
    setBalanceCheckResult,
    orderSuccessInfo,
    clearOrderSuccessInfo,
  } = useRouterTrading();

  useEffect(() => {
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
    // Note: Swap success toasts are now handled by the enhanced toast system in useRouterTrading
    // The old swapSuccessInfo toast has been removed to avoid duplicates
  }, [orderSuccessInfo, toast, clearOrderSuccessInfo]);

  // Header-only mode for the full-width header
  if (headerOnly) {
    return <SwapHeader />;
  }

  // Enhanced loading animation - Use LoadingState component
  if (isInitializing || isLoadingTokens) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">

      {/* Main Trading Interface - Clean & Focused */}
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Limit Order Conditions */}
        {mode === 'order' && (
          <div className="glass-card p-6 shadow-xl border border-white/[0.10]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-purple-500/[0.03] pointer-events-none rounded-2xl" />
            <div className="relative">
              <LimitConditionSection />
            </div>
          </div>
        )}

        {/* Token Input */}
        <div className="glass-card p-6 shadow-xl border border-white/[0.10] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-blue-500/[0.02] pointer-events-none rounded-2xl" />
          <div className="relative">
            <TokenInputSection />
          </div>
        </div>

        {/* Swap Direction Control */}
        <div className="flex justify-center -my-2 relative z-10">
          <ReverseTokensButton />
        </div>

        {/* Token Output */}
        <div className="glass-card p-6 shadow-xl border border-white/[0.10] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-green-500/[0.02] pointer-events-none rounded-2xl" />
          <div className="relative">
            <TokenOutputSection />
          </div>
        </div>

        {/* Compact Route Summary - Quick Overview Only */}
        <div className="glass-card p-4 shadow-lg border border-white/[0.08]">
          <SwapDetails compact={true} />
        </div>

        {/* Action Controls */}
        <div className="glass-card p-6 shadow-xl border border-white/[0.10]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-orange-500/[0.02] pointer-events-none rounded-2xl" />
          <div className="relative space-y-4">
            <ErrorAlert />
            {mode === 'swap' && <SwapButton />}
            {mode === 'order' && <OrderButton />}
            
            {/* Route disclaimer for orders */}
            {mode === 'order' && quote && (
              <p className="text-xs italic text-white/60 text-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                Routes are optimized at execution time
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Hidden Dialogs */}
      <DcaDialog />
      <BalanceCheckDialog
        open={!!balanceCheckResult && !balanceCheckResult.hasEnoughSubnet}
        onOpenChange={(open) => !open && setBalanceCheckResult(null)}
      />
    </div>
  );
}

// Main component that provides the swap context
export default function SwapInterface({ initialTokens = [], urlParams, searchParams, headerOnly = false }: SwapInterfaceProps) {
  // If we have initialTokens or searchParams, create a provider; otherwise, assume we're in an existing provider
  const needsProvider = initialTokens.length > 0 || searchParams;
  
  if (needsProvider) {
    return (
      <SwapTokensProvider initialTokens={initialTokens} searchParams={searchParams}>
        <SwapInterfaceInner urlParams={urlParams} headerOnly={headerOnly} />
      </SwapTokensProvider>
    );
  }
  
  // Use existing provider context
  return <SwapInterfaceInner urlParams={urlParams} headerOnly={headerOnly} />;
}
