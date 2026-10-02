'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { listTokens } from 'dexterity-sdk';
import { isPlayableToken } from '@/lib/roulette/playable';

export interface GameToken {
    contractId: string;
    symbol: string;
    name: string;
    image?: string;
    decimals: number;
    playable: boolean;
}

interface TokensState {
    tokens: GameToken[];
    byId: Record<string, GameToken>;
    loading: boolean;
    error: string | null;
}

const TokensContext = createContext<TokensState | null>(null);

/** The token list, fetched once for the whole app. */
export function TokensProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<TokensState>({ tokens: [], byId: {}, loading: true, error: null });

    useEffect(() => {
        listTokens()
            .then(list => {
                const tokens: GameToken[] = list.map(t => ({
                    contractId: t.contractId,
                    symbol: t.symbol,
                    name: t.name,
                    image: t.image || undefined,
                    decimals: t.decimals,
                    playable: isPlayableToken(t),
                }));
                setState({ tokens, byId: Object.fromEntries(tokens.map(t => [t.contractId, t])), loading: false, error: null });
            })
            .catch(e => setState(s => ({ ...s, loading: false, error: `Couldn't load the token list: ${e instanceof Error ? e.message : String(e)}` })));
    }, []);

    return <TokensContext.Provider value={state}>{children}</TokensContext.Provider>;
}

export function useTokens(): TokensState {
    const ctx = useContext(TokensContext);
    if (!ctx) throw new Error('useTokens must be used inside <TokensProvider>');
    return ctx;
}
