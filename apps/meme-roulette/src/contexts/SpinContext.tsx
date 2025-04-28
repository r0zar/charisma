'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import type { SpinFeedData, Token, Vote } from '@/types/spin';

// Define the shape of the context state
export interface SpinState {
    feedData: SpinFeedData | null;
    isFeedConnected: boolean;
    isFeedLoading: boolean;
    myBets: Vote[] | undefined;
    tokenBets: Record<string, number> | undefined;
}

// Define the actions available on the context
export interface SpinActions {
    setFeedData: (data: SpinFeedData) => void;
    setIsFeedConnected: (connected: boolean) => void;
    setIsFeedLoading: (loading: boolean) => void;
    setMyBets: (bets: Vote[] | undefined) => void;
    setTokenBets: (bets: Record<string, number> | undefined) => void;
}

// Define the type for the context value, including the derived leaderboard
export const SpinContext = createContext<
    | {
        state: SpinState;
        actions: SpinActions;
        leaderboard: { token: Token; amount: number }[];
    }
    | undefined
>(undefined);

// Initial state values
const initialState: SpinState = {
    feedData: null,
    isFeedConnected: false,
    isFeedLoading: true, // Assume loading initially
    myBets: undefined,
    tokenBets: undefined,
};

// Define the provider component
export const SpinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<SpinState>(initialState);

    const actions: SpinActions = useMemo(() => ({
        setFeedData: (data) => {
            console.log("[SpinContext] Received feed data:", data); // Log received data
            console.log("[SpinContext] currentUserBets:", data.currentUserBets); // Add explicit logging for currentUserBets

            setState(prevState => ({
                ...prevState,
                feedData: data, // Store the raw feed data
                tokenBets: data.tokenVotes || {}, // Use tokenVotes from SpinFeedData
                myBets: data.currentUserBets || prevState.myBets, // Update user's bets if present in feed data
                isFeedLoading: false, // No longer loading once data arrives
            }));
        },
        setIsFeedLoading: (loading) => {
            setState(prevState => ({ ...prevState, isFeedLoading: loading }));
        },
        setIsFeedConnected: (connected) => {
            setState(prevState => ({ ...prevState, isFeedConnected: connected }));
        },
        setMyBets: (bets) => {
            setState(prevState => ({ ...prevState, myBets: bets }));
        },
        setTokenBets: (bets) => {
            setState(prevState => ({ ...prevState, tokenBets: bets }));
        },
    }), []);

    // Calculate leaderboard from state
    const leaderboard = useMemo(() => {
        if (!state.feedData?.initialTokens || !state.feedData.tokenVotes) {
            return [];
        }

        return state.feedData.initialTokens
            .map((token) => ({
                token,
                amount: state.feedData?.tokenVotes[token.id] || 0,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [state.feedData?.initialTokens, state.feedData?.tokenVotes]);

    // Adjust context value to group state and actions
    const value = useMemo(() => ({ state, actions, leaderboard }), [state, actions, leaderboard]);

    return (
        <SpinContext.Provider value={value}>
            {children}
        </SpinContext.Provider>
    );
};

// Custom hook for easy context consumption
// Adjust hook to return structured value for clarity
export const useSpin = (): { state: SpinState; actions: SpinActions; leaderboard: { token: Token; amount: number }[] } => {
    const context = useContext(SpinContext);
    if (context === undefined) {
        throw new Error('useSpin must be used within a SpinProvider');
    }
    return context;
};
