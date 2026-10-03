'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useRouterTradingState } from '@/hooks/useRouterTrading';

type RouterTrading = ReturnType<typeof useRouterTradingState>;
const RouterTradingContext = createContext<RouterTrading | null>(null);

/** One trading state for the whole swap page: one quote, fetched once, that every panel reads */
export function RouterTradingProvider({ children }: { children: ReactNode }) {
    return <RouterTradingContext.Provider value={useRouterTradingState()}>{children}</RouterTradingContext.Provider>;
}

export function useRouterTrading(): RouterTrading {
    const value = useContext(RouterTradingContext);
    if (!value) throw new Error('useRouterTrading must be used inside a RouterTradingProvider (the swap page mounts one)');
    return value;
}
