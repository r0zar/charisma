'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import type { SpinFeedData, Token, Vote } from '@/types/spin';

// Define the shape of the context state
interface SpinState {
    feedData: SpinFeedData | null;
    isFeedConnected: boolean;
    isFeedLoading: boolean;
    myBets: Vote[];
    myChaBalance: number; // Mock balance
    tokenList: Token[]; // Full list of available tokens
    tokenBets: Record<string, number>; // Map of tokenId -> totalBetAmount
}

// Define the actions available on the context
interface SpinActionsBase {
    placeBet: (tokenId: string, chaAmount: number) => void;
    _updateFeedData: (data: SpinFeedData) => void;
    _setFeedLoading: (loading: boolean) => void;
    _setFeedConnected: (connected: boolean) => void;
}

// Dev-only actions
interface SpinActionsDev extends SpinActionsBase {
    _devSetMyChaBalance: (balance: number) => void;
}

// Helper type for environment
type CurrentEnv = typeof process.env.NODE_ENV;

// Conditionally define the final actions type
type SpinActions = CurrentEnv extends 'development'
    ? SpinActionsDev
    : SpinActionsBase;

// Define the type for the context value, including the derived leaderboard
interface SpinContextValue {
    state: SpinState;
    actions: SpinActions; // Use the conditional type
    leaderboard: { token: Token; totalBet: number }[];
}

// Create the context with initial undefined value but use the extended type
const SpinContext = createContext<SpinContextValue | undefined>(undefined);

// Initial state values
const initialState: SpinState = {
    feedData: null,
    isFeedConnected: false,
    isFeedLoading: true, // Assume loading initially
    myBets: [],
    myChaBalance: 10000, // Example starting balance
    tokenList: [], // Initialize as empty
    tokenBets: {}, // Initialize as empty
};

// Define the provider component
export const SpinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<SpinState>(initialState);

    const actions: SpinActions = useMemo(() => {
        const baseActions: SpinActionsBase = {
            placeBet: (tokenId, chaAmount) => {
                // TODO: Implement actual bet placement logic
                // This might involve an API call and then updating myBets locally
                // For now, just log and add a mock bet
                console.log(`Placing bet: ${chaAmount} CHA on token ${tokenId}`);
                const newBet: Vote = {
                    id: `vote-${Date.now()}`,
                    tokenId,
                    voteAmountCHA: chaAmount,
                    voteTime: Date.now(),
                    userId: 'mock-user-id', // Replace with actual user ID later
                };
                setState(prevState => ({
                    ...prevState,
                    myBets: [...prevState.myBets, newBet],
                    myChaBalance: prevState.myChaBalance - chaAmount, // Deduct balance locally (mock)
                }));
                // Note: The actual incrementing of the *total* bet for the token happens server-side via API call
            },
            _updateFeedData: (data) => {
                setState(prevState => ({
                    ...prevState,
                    feedData: data, // Store the raw feed data
                    tokenList: data.initialTokens || prevState.tokenList, // Update token list only if initialTokens is present
                    tokenBets: data.tokenVotes || {}, // Use tokenVotes from SpinFeedData
                    isFeedLoading: false, // No longer loading once data arrives
                }));
            },
            _setFeedLoading: (loading) => {
                setState(prevState => ({ ...prevState, isFeedLoading: loading }));
            },
            _setFeedConnected: (connected) => {
                setState(prevState => ({ ...prevState, isFeedConnected: connected }));
            },
        };

        if (process.env.NODE_ENV === 'development') {
            return {
                ...baseActions,
                _devSetMyChaBalance: (balance: number) => {
                    setState(prevState => ({ ...prevState, myChaBalance: balance }));
                }
            } as SpinActions; // Cast to final type
        }

        return baseActions as SpinActions; // Cast to final type

    }, []); // No dependencies needed for actions themselves usually

    // --- Derived State: Leaderboard ---
    // Memoize the leaderboard calculation
    const leaderboard = useMemo(() => {
        // Ensure tokenBets is defined before attempting to access properties
        const tokenBets = state.tokenBets || {};

        // Combine tokenList and tokenBets
        return state.tokenList
            .map(token => ({
                token,
                totalBet: tokenBets[token.id] || 0, // Get bet amount, default to 0
            }))
            .filter(item => item.totalBet > 0) // Keep only tokens with bets > 0
            .sort((a, b) => b.totalBet - a.totalBet); // Sort descending by total bet
    }, [state.tokenList, state.tokenBets]);

    // Adjust context value to group state and actions
    const value: SpinContextValue = useMemo(() => ({ state, actions, leaderboard }), [state, actions, leaderboard]);

    return (
        <SpinContext.Provider value={value}>
            {children}
        </SpinContext.Provider>
    );
};

// Custom hook for easy context consumption
// Adjust hook to return structured value for clarity
export const useSpin = (): SpinContextValue => {
    const context = useContext(SpinContext);
    if (context === undefined) {
        throw new Error('useSpin must be used within a SpinProvider');
    }
    return context;
};
