'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Token } from '@/types/spin';
import { useSpin } from '@/contexts/SpinContext';
import { TrendingUp, Flame, Users, Crown, ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// CHA Token constants
const CHA_DECIMALS = 6;

// Helper to format balance
const formatBalance = (balance: string, decimals: number = CHA_DECIMALS) => {
    try {
        const num = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        const integerPart = num / divisor;
        const fractionalPart = num % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toLocaleString();
        } else {
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
            return `${integerPart.toLocaleString()}.${fractionalStr}`;
        }
    } catch {
        return '0';
    }
};



interface TokenSelectionStepProps {
    tokens: Token[];
    selectedToken: Token | null;
    onTokenSelect: (token: Token) => void;
    onBack: () => void;
    onShowAllTokens?: (showing: boolean) => void;
}

interface EnhancedToken extends Token {
    currentVotes: number;
    isHot: boolean;
    isTrending: boolean;
}

export const TokenSelectionStep = ({
    tokens,
    selectedToken,
    onTokenSelect,
    onBack,
    onShowAllTokens
}: TokenSelectionStepProps) => {
    const { state } = useSpin();
    const [showAllTokens, setShowAllTokens] = useState(false);

    // Get popular tokens (by current vote count) and format them
    const popularTokens = useMemo(() => {
        if (!tokens || tokens.length === 0) return [];

        // Filter non-SUBNET tokens and exclude specific tokens
        const validTokens = tokens.filter(token =>
            token.type !== 'SUBNET' &&
            !token.id.includes('.stx') &&
            !token.id.includes('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token')
        );
        const tokenBets = state.tokenBets || {};

        // Sort by current round voting activity
        return validTokens
            .map(token => ({
                ...token,
                currentVotes: tokenBets[token.id] || 0,
                isHot: (tokenBets[token.id] || 0) > 1000,
                isTrending: (tokenBets[token.id] || 0) > 500
            }))
            .sort((a, b) => b.currentVotes - a.currentVotes)
            .slice(0, 3); // Top 3 tokens (only show what we display)
    }, [tokens, state.tokenBets]);

    // Get all tokens when showing all tokens view
    const allTokens = useMemo(() => {
        if (!tokens || tokens.length === 0) return [];

        const validTokens = tokens.filter(token =>
            token.type !== 'SUBNET' &&
            !token.id.includes('.stx') &&
            !token.id.includes('.charisma-token')
        );
        const tokenBets = state.tokenBets || {};

        return validTokens
            .map(token => ({
                ...token,
                currentVotes: tokenBets[token.id] || 0,
                isHot: (tokenBets[token.id] || 0) > 1000,
                isTrending: (tokenBets[token.id] || 0) > 500
            }))
            .sort((a, b) => b.currentVotes - a.currentVotes); // Sort by votes, popular first
    }, [tokens, state.tokenBets]);

    // Simple function to show all tokens
    const handleShowAllTokens = () => {
        setShowAllTokens(true);
        onShowAllTokens?.(true);
    };

    const TokenCard = ({ token, isSelected, onClick }: {
        token: EnhancedToken,
        isSelected: boolean,
        onClick: () => void
    }) => (
        <button
            onClick={onClick}
            className={`
                relative p-4 rounded-xl border-2 transition-all duration-200 text-left w-full
                ${isSelected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border/30 hover:border-primary/50 hover:bg-background/50'
                }
            `}
        >
            {/* Hot/Trending badges */}
            {token.isHot && (
                <div className="absolute -top-2 -right-2 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    HOT
                </div>
            )}
            {token.isTrending && !token.isHot && (
                <div className="absolute -top-2 -right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    TRENDING
                </div>
            )}

            <div className="flex items-center gap-3">
                <Image
                    src={token.imageUrl}
                    alt={token.name}
                    width={40}
                    height={40}
                    className="rounded-full border-2 border-border/20"
                    onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{token.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">{token.symbol}</div>
                    {token.currentVotes > 0 && (
                        <div className="flex items-center gap-1 text-xs text-primary mt-1">
                            <Users className="h-3 w-3" />
                            {formatBalance(token.currentVotes.toString(), CHA_DECIMALS)} CHA voted
                        </div>
                    )}
                </div>
                {isSelected && <Crown className="h-5 w-5 text-primary" />}
            </div>
        </button>
    );

    return (
        <div className="px-6 pb-6 space-y-6">

            <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                    Pick Your Token
                </h3>

                {!showAllTokens ? (
                    <>
                        {/* Popular Tokens */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">🔥 POPULAR</Badge>
                                <span className="text-sm text-muted-foreground">Most voted this round</span>
                            </div>

                            <div className="grid gap-2">
                                {popularTokens.slice(0, 3).map((token) => (
                                    <TokenCard
                                        key={token.id}
                                        token={token}
                                        isSelected={selectedToken?.id === token.id}
                                        onClick={() => onTokenSelect(token)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Show All Button */}
                        <Button
                            variant="outline"
                            onClick={handleShowAllTokens}
                            className="w-full"
                        >
                            Show All Tokens ({allTokens.length} total)
                        </Button>
                    </>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">📝 ALL TOKENS</Badge>
                            <span className="text-sm text-muted-foreground">Popular tokens shown first</span>
                        </div>
                        <ScrollArea className="h-48 sm:h-64 md:h-80 lg:h-96 border rounded-lg">
                            <div className="p-2 sm:p-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                                    {allTokens.map((token) => (
                                        <div
                                            key={token.id}
                                            onClick={() => onTokenSelect(token)}
                                            className={`
                                                relative p-2 sm:p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer text-center
                                                ${selectedToken?.id === token.id
                                                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                                    : 'border-border/30 hover:border-primary/50 hover:bg-background/50'
                                                }
                                            `}
                                        >
                                            {/* Hot/Trending badges */}
                                            {token.isHot && (
                                                <div className="absolute -top-1 -right-1 bg-orange-500 text-white px-1 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <Flame className="h-2 w-2" />
                                                </div>
                                            )}
                                            {token.isTrending && !token.isHot && (
                                                <div className="absolute -top-1 -right-1 bg-green-500 text-white px-1 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                                    <TrendingUp className="h-2 w-2" />
                                                </div>
                                            )}

                                            <div className="flex flex-col items-center gap-1 sm:gap-2">
                                                <Image
                                                    src={token.imageUrl}
                                                    alt={token.name}
                                                    width={24}
                                                    height={24}
                                                    className="rounded-full border border-border/20 sm:w-8 sm:h-8"
                                                    onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                                />
                                                <div className="min-w-0 w-full">
                                                    <div className="font-semibold text-xs sm:text-sm truncate">{token.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">{token.symbol}</div>
                                                    {token.currentVotes > 0 && (
                                                        <div className="flex items-center justify-center gap-1 text-xs text-primary mt-1">
                                                            <Users className="h-2 w-2" />
                                                            <span className="hidden sm:inline">{formatBalance(token.currentVotes.toString(), CHA_DECIMALS)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedToken?.id === token.id && <Crown className="h-2 w-2 sm:h-3 sm:w-3 text-primary" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>

            {/* Additional Back Button at Bottom */}
            <div className="pt-4 border-t border-border/30">
                <Button
                    variant="ghost"
                    onClick={onBack}
                    className="flex items-center gap-2"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Amount
                </Button>
            </div>
        </div>
    );
}; 