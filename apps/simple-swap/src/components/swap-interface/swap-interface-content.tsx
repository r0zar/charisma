"use client";

import React, { useEffect } from "react";
import TokenInputSection from './TokenInputSection';
import TokenOutputSection from './TokenOutputSection';
import LoadingState from './loading-state';
import SwapButton from './swap-button';
import LimitConditionSection from './LimitConditionSection';
import OrderButton from './order-button';
import ReverseTokensButton from './reverse-tokens-button';
import BalanceCheckDialog from './balance-check-dialog';
import { DcaDialog } from "./dca-dialog";
import { TokenCacheData } from "@repo/tokens";
import { useSwapTokens } from "../../contexts/swap-tokens-context";
import { useRouterTrading } from "../../hooks/useRouterTrading";
import { useOrderConditions } from "../../contexts/order-conditions-context";
import { toast } from '@/components/ui/sonner';

interface SwapInterfaceContentProps {
  initialTokens?: TokenCacheData[];
  searchParams?: URLSearchParams;
}

// Inner component that uses the swap context
function SwapInterfaceContentInner() {
  // Get swap token state from context
  const {
    mode,
    isInitializing,
    isLoadingTokens,
  } = useSwapTokens();

  // Get router and trading functionality
  const {
    quote,
    error,
    balanceCheckResult,
    setBalanceCheckResult,
    swapSuccessInfo,
    clearSwapSuccessInfo,
  } = useRouterTrading();

  // Get order functionality (separate from router trading)
  const {
    orderSuccessInfo,
    clearOrderState,
  } = useOrderConditions();

  useEffect(() => {
    if (orderSuccessInfo) {
      toast.success(
        <div className="flex flex-col gap-2">
          <div>
            <div className="font-semibold text-white text-sm">Order Created Successfully</div>
            <div className="text-white/80 text-xs mt-0.5">
              Your triggered order has been submitted and is now active.
            </div>
          </div>
          <a
            href="/orders"
            className="inline-flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 border border-green-500/20 hover:border-green-500/30 px-3 py-1.5 text-xs rounded-xl font-medium transition-all duration-200 w-fit"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            View Orders
          </a>
        </div>,
        { duration: 8000 }
      );
      clearOrderState();
    }
    if (swapSuccessInfo && swapSuccessInfo.txid) {
      toast.success(
        <div className="flex flex-col gap-2">
          <div>
            <div className="font-semibold text-white text-sm">Swap Transaction Submitted</div>
            <div className="text-white/80 text-xs mt-0.5">
              Your transaction has been broadcast to the Stacks blockchain.
            </div>
          </div>
          <a
            href={`https://explorer.hiro.so/txid/${swapSuccessInfo.txid}?chain=mainnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/30 px-3 py-1.5 text-xs rounded-xl font-medium transition-all duration-200 w-fit"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on Hiro Explorer
          </a>
        </div>,
        { duration: 10000 }
      );
      clearSwapSuccessInfo();
    }
  }, [orderSuccessInfo, swapSuccessInfo, clearOrderState, clearSwapSuccessInfo]);

  // Enhanced loading animation - Use LoadingState component
  if (isInitializing || isLoadingTokens) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Main Trading Interface - Adaptive Layout */}
      {mode === 'order' ? (
        /* Order Mode - Responsive Layout */
        <div className="max-w-7xl mx-auto">
          {/* 3XL+ screens: Side-by-side 3/5 Grid Layout */}
          <div className="hidden 3xl:grid grid-cols-5 gap-6">
            {/* Left Side - Limit Conditions (3/5) */}
            <div className="col-span-3 space-y-6">
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 backdrop-blur-sm">
                <LimitConditionSection />
              </div>

            </div>

            {/* Right Side - Send/Receive (2/5) */}
            <div className="col-span-2">
              {/* Token Input */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm mb-6">
                <TokenInputSection />
              </div>

              {/* Swap Direction Control - Properly positioned */}
              <div className="flex justify-center -my-3 relative z-10">
                <ReverseTokensButton />
              </div>

              {/* Token Output */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm mt-6 mb-6">
                <TokenOutputSection />
              </div>

              {/* Action Controls */}
              <div>
                <OrderButton />
              </div>
            </div>
          </div>

          {/* Below 3XL: Vertical Stack Layout */}
          <div className="3xl:hidden max-w-3xl mx-auto">
            {/* Limit Order Conditions */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 backdrop-blur-sm mb-6">
              <LimitConditionSection />
            </div>

            {/* Token Input */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm mb-6">
              <TokenInputSection />
            </div>

            {/* Swap Direction Control - Properly positioned */}
            <div className="flex justify-center -my-3 relative z-10">
              <ReverseTokensButton />
            </div>

            {/* Token Output */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm mt-6 mb-6">
              <TokenOutputSection />
            </div>


            {/* Action Controls */}
            <div>
              <OrderButton />
            </div>
          </div>
        </div>
      ) : (
        /* Swap Mode - Traditional Centered Layout */
        <div className="max-w-2xl mx-auto">
          {/* Token Input */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm mb-6">
            <TokenInputSection />
          </div>

          {/* Swap Direction Control */}
          <div className="flex justify-center -my-3 relative z-10">
            <ReverseTokensButton />
          </div>

          {/* Token Output */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm mt-6 mb-6">
            <TokenOutputSection />
          </div>


          {/* Action Controls */}
          <div>
            <SwapButton />
          </div>
        </div>
      )}

      {/* Hidden Dialogs */}
      <DcaDialog />
      <BalanceCheckDialog
        open={!!balanceCheckResult && !balanceCheckResult.hasEnoughSubnet}
        onOpenChange={(open) => !open && setBalanceCheckResult(null)}
      />
    </div>
  );
}

// Main component that uses the existing swap context
export default function SwapInterfaceContent({ initialTokens = [], searchParams }: SwapInterfaceContentProps) {
  // OrderConditionsProvider is now provided at a higher level in SwapPageClient
  return <SwapInterfaceContentInner />;
}