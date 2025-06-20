"use client";

import React, { useEffect } from "react";
import { TokenCacheData } from "@repo/tokens";
import { SwapTokensProvider, useSwapTokens } from "../../contexts/swap-tokens-context";
import { useRouterTrading } from "../../hooks/useRouterTrading";
import { toast } from '@/components/ui/sonner';
import LoadingState from '../swap-interface/loading-state';
import ProModeLayout from '../pro-mode/ProModeLayout';

interface ProInterfaceProps {
  initialTokens?: TokenCacheData[];
  searchParams?: URLSearchParams;
}

// Inner component that uses the swap context
function ProInterfaceInner() {
  // Get swap token state from context
  const {
    mode,
    setMode,
    isInitializing,
    isLoadingTokens,
  } = useSwapTokens();

  // Get router and trading functionality
  const {
    orderSuccessInfo,
    clearOrderSuccessInfo,
    setIsProMode,
  } = useRouterTrading();

  // Set pro mode and order mode on mount
  useEffect(() => {
    setIsProMode(true);
    setMode('order');
    
    // Cleanup when component unmounts
    return () => {
      setIsProMode(false);
    };
  }, [setIsProMode, setMode]);

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
  }, [orderSuccessInfo, clearOrderSuccessInfo]);

  // Enhanced loading animation - Use LoadingState component
  if (isInitializing || isLoadingTokens) {
    return <LoadingState />;
  }

  return <ProModeLayout />;
}

// Main component that provides the swap context
export default function ProInterface({ initialTokens = [], searchParams }: ProInterfaceProps) {
  return (
    <SwapTokensProvider initialTokens={initialTokens} searchParams={searchParams}>
      <ProInterfaceInner />
    </SwapTokensProvider>
  );
}