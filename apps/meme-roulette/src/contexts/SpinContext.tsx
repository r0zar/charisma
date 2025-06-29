'use client';

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import type { SpinFeedData, Token, Vote } from '@/types/spin';
import { toast } from '@/components/ui/sonner';
import { Rocket } from 'lucide-react';
import Image from 'next/image';

// Define the shape of the context state
export interface SpinState {
    feedData: SpinFeedData | null;
    isFeedConnected: boolean;
    isFeedLoading: boolean;
    myBets: Vote[] | undefined;
    tokenBets: Record<string, number> | undefined;
    lastProcessedVoteId: string | null;
    currentUserId: string | null;
}

// Define the actions available on the context
export interface SpinActions {
    setFeedData: (data: SpinFeedData) => void;
    setIsFeedConnected: (connected: boolean) => void;
    setIsFeedLoading: (loading: boolean) => void;
    setMyBets: (bets: Vote[] | undefined) => void;
    setTokenBets: (bets: Record<string, number> | undefined) => void;
    setCurrentUserId: (userId: string | null) => void;
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
    lastProcessedVoteId: null,
    currentUserId: null,
};

// Helper to truncate Stacks address
const truncateAddress = (address: string, length = 4) => {
    if (!address) return "Anonymous";
    if (address.length <= length * 2 + 3) return address;
    return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
};

// Helper to display vote notifications
const showVoteNotification = (amount: number, token: Token, userId: string) => {
    const tokenSymbol = token?.symbol || 'Unknown';
    const displayAddress = truncateAddress(userId);
    const tokenImage = token?.imageUrl || '/placeholder-token.png';

    const notificationContent = (
        <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-1">
                <Image
                    src={tokenImage}
                    alt={tokenSymbol}
                    width={32}
                    height={32}
                    className="rounded-full"
                    unoptimized
                />
            </div>
            <div className="flex-1">
                {amount >= 50 ? (
                    <>
                        <div className="animate-shake font-bold">
                            <span className="text-lg uppercase text-green-500">MEGA BUY!</span>
                        </div>
                        <div>
                            <span className="font-medium">{displayAddress}</span> just committed <span className="text-primary font-bold">{amount} CHA</span> to {tokenSymbol}!
                        </div>
                    </>
                ) : (
                    <>
                        <div className={amount >= 20 ? "font-bold" : ""}>
                            {amount >= 20 && <span className="text-green-400 font-bold">BIG BUY! </span>}
                            <span className="font-medium">{displayAddress}</span> committed <span className="text-primary font-bold">{amount} CHA</span> to {tokenSymbol}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    if (amount >= 50) {
        // For large amounts (50+ CHA) - MEGA BUY with shake effect
        toast.success(notificationContent, {
            icon: <Rocket className="h-5 w-5 text-primary animate-bounce" />,
            duration: 5000,
            className: "bg-black/90 border-green-500"
        });
    } else if (amount >= 20) {
        // For medium amounts (20-50 CHA)
        toast.success(notificationContent, {
            icon: <Rocket className="h-5 w-5 text-primary" />,
            duration: 4000
        });
    } else {
        // For regular amounts
        toast.success(notificationContent, {
            duration: 3000
        });
    }
};

// Define the provider component
export const SpinProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<SpinState>(initialState);

    const actions: SpinActions = useMemo(() => ({
        setFeedData: (data) => {
            setState(prevState => {
                // Handle new vote notifications if present
                if (data.type === 'new_vote' && data.newVote) {
                    const { tokenId, amount, voteId, userId } = data.newVote;

                    // Skip if we've already processed this vote
                    if (voteId === prevState.lastProcessedVoteId) {
                        return prevState;
                    }

                    // Skip notifications for user's own votes
                    if (userId && prevState.currentUserId && userId === prevState.currentUserId) {
                        console.log(`[SpinContext] Skipping notification for user's own vote: ${voteId}`);
                        return {
                            ...prevState,
                            feedData: data,
                            tokenBets: data.tokenVotes || prevState.tokenBets,
                            myBets: data.currentUserBets || prevState.myBets,
                            isFeedLoading: false,
                            lastProcessedVoteId: voteId
                        };
                    }

                    // Find token info
                    const token = data.initialTokens?.find(t => t.id === tokenId);

                    // Show toast notification with token and user info
                    showVoteNotification(amount, token!, userId);

                    // Return updated state with the new vote ID tracked
                    return {
                        ...prevState,
                        feedData: data,
                        tokenBets: data.tokenVotes || prevState.tokenBets,
                        myBets: data.currentUserBets || prevState.myBets,
                        isFeedLoading: false,
                        lastProcessedVoteId: voteId
                    };
                }

                // Regular data update (not a new vote notification)
                return {
                    ...prevState,
                    feedData: data,
                    tokenBets: data.tokenVotes || prevState.tokenBets,
                    myBets: data.currentUserBets || prevState.myBets,
                    isFeedLoading: false,
                };
            });
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
        setCurrentUserId: (userId) => {
            setState(prevState => ({ ...prevState, currentUserId: userId }));
        }
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
