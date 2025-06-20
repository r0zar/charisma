"use client";

import React, { useEffect } from "react";
import TokenInputSection from './TokenInputSection';
import TokenOutputSection from './TokenOutputSection';
import SwapDetails from './swap-details';
import LoadingState from './loading-state';
import SwapButton from './swap-button';
import LimitConditionSection from './LimitConditionSection';
import OrderButton from './order-button';
import ReverseTokensButton from './reverse-tokens-button';
import ErrorAlert from './error-alert';
import BalanceCheckDialog from './balance-check-dialog';
import { DcaDialog } from "./dca-dialog";
import { TokenCacheData } from "@repo/tokens";
import { useSwapTokens } from "../../contexts/swap-tokens-context";
import { useRouterTrading } from "../../hooks/useRouterTrading";
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
  if (isInitializing || isLoadingTokens) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Main Trading Interface - Adaptive Layout */}
      {mode === 'order' ? (
        /* Order Mode - Responsive Layout */
        <div className="max-w-7xl mx-auto">
          {/* 2XL+ screens: Side-by-side 3/5 Grid Layout */}
          <div className="hidden 2xl:grid grid-cols-5 gap-6">
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

          {/* Below 2XL: Vertical Stack Layout */}
          <div className="2xl:hidden max-w-2xl mx-auto">
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
  return <SwapInterfaceContentInner />;
}