'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Token, Vote } from '@/types/spin';
import { useWallet } from '@/contexts/wallet-context';
import { useSpin } from '@/contexts/SpinContext';
import { TrendingUp, Flame, Users, Crown, Zap, Heart } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/components/ui/sonner';
import { Badge } from "@/components/ui/badge";
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';

// CHA Token constants
const CHA_DECIMALS = 6;
const CHA_SYMBOL = 'CHA';

// Preset voting amounts (in CHA)
const QUICK_AMOUNTS = [
    { amount: 10, label: '$5', description: 'Small bet' },
    { amount: 25, label: '$12', description: 'Popular choice' },
    { amount: 50, label: '$25', description: 'Go big!' },
    { amount: 100, label: '$50', description: 'All in!' }
];

interface VoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
}

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

const VoteModal = ({ isOpen, onClose, tokens }: VoteModalProps) => {
    const { subnetBalance, subnetBalanceLoading, mainnetBalance, balanceLoading, placeBet } = useWallet();
    const { state } = useSpin();
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showAllTokens, setShowAllTokens] = useState(false);
    const [shuffledOtherTokens, setShuffledOtherTokens] = useState<typeof popularTokens>([]);

    // Helper function to shuffle array
    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // Get popular tokens (by current vote count) and format them
    const popularTokens = useMemo(() => {
        if (!tokens || tokens.length === 0) return [];

        // Filter non-SUBNET tokens and sort by current vote counts
        const validTokens = tokens.filter(token => token.type !== 'SUBNET');
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
            .slice(0, 6); // Top 6 tokens
    }, [tokens, state.tokenBets]);

    // Simple function to shuffle and show all tokens - runs only once when clicked
    const handleShowAllTokens = () => {
        if (!tokens || shuffledOtherTokens.length > 0) {
            setShowAllTokens(true);
            return;
        }

        const popularIds = new Set(popularTokens.map(t => t.id));
        const tokenBets = state.tokenBets || {};

        const filteredTokens = tokens
            .filter(token => token.type !== 'SUBNET' && !popularIds.has(token.id))
            .map(token => ({
                ...token,
                currentVotes: tokenBets[token.id] || 0,
                isHot: (tokenBets[token.id] || 0) > 1000,
                isTrending: (tokenBets[token.id] || 0) > 500
            }));

        // Shuffle once and store
        setShuffledOtherTokens(shuffleArray(filteredTokens));
        setShowAllTokens(true);
    };

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedToken(null);
            setSelectedAmount(null);
            setIsLoading(false);
            setShowAllTokens(false);
            setShuffledOtherTokens([]);
        }
    }, [isOpen]);

    const handleVote = async () => {
        if (!selectedToken || !selectedAmount) return;

        const amountInAtomicCHA = BigInt(Math.round(selectedAmount * (10 ** CHA_DECIMALS)));
        const availableBalanceAtomic = BigInt(subnetBalance);

        if (amountInAtomicCHA > availableBalanceAtomic) {
            const availableFormatted = formatBalance(subnetBalance, CHA_DECIMALS);
            toast.error(`Need ${selectedAmount} CHA but you only have ${availableFormatted} CHA`);
            return;
        }

        setIsLoading(true);
        try {
            const microAmount = Number(amountInAtomicCHA);
            const result = await placeBet(microAmount, selectedToken.id);

            if (!result.success) {
                throw new Error(result.error || 'Failed to place vote');
            }

            toast.success(`🎉 Voted ${selectedAmount} CHA for ${selectedToken.symbol}!`);
            onClose();
        } catch (error: any) {
            console.error("Vote failed:", error);
            const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
            toast.error(`Vote failed: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const canVote = selectedToken && selectedAmount && !isLoading && !subnetBalanceLoading;
    const availableBalance = formatBalance(subnetBalance, CHA_DECIMALS);

    // Check user's CHA balance status for onboarding prompts
    const subnetCHAAmount = Number(subnetBalance) / (10 ** CHA_DECIMALS);
    const mainnetCHAAmount = Number(mainnetBalance) / (10 ** CHA_DECIMALS);
    const minVoteAmount = QUICK_AMOUNTS[0].amount; // Smallest preset amount (10 CHA)

    const hasEnoughSubnetCHA = subnetCHAAmount >= minVoteAmount;
    const hasMainnetCHA = mainnetCHAAmount > 0;
    const isLoadingBalances = subnetBalanceLoading || balanceLoading;

    // Determine what content to show
    const showOnboarding = !isLoadingBalances && !hasEnoughSubnetCHA;
    const showBuyCHAPrompt = showOnboarding && !hasMainnetCHA;
    const showDepositPrompt = showOnboarding && hasMainnetCHA;

    const TokenCard = ({ token, isSelected, onClick }: {
        token: typeof popularTokens[0],
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
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-card/95 backdrop-blur-md border-primary/20">
                <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-card to-transparent">
                    <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-500" />
                        Vote for Your Favorite!
                    </DialogTitle>
                    <p className="text-muted-foreground mt-1">
                        Pick a token and amount. Everyone gets the winning token - but it's nice when your favorite wins!
                    </p>
                </DialogHeader>

                {/* Loading State */}
                {isLoadingBalances && (
                    <div className="px-6 pb-6 text-center">
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
                            <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
                        </div>
                        <p className="text-muted-foreground mt-4">Checking your CHA balance...</p>
                    </div>
                )}

                {/* Buy CHA Prompt - User has no CHA at all */}
                {showBuyCHAPrompt && (
                    <div className="px-6 pb-6 space-y-6">
                        <div className="text-center space-y-4">
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6">
                                <div className="text-4xl mb-3">💰</div>
                                <h3 className="font-bold text-lg mb-2">Get Some CHA to Start Voting!</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    You need CHA tokens to vote. You can swap STX for CHA tokens to get started.
                                </p>
                                <div className="bg-background/50 rounded-lg p-3 text-xs text-muted-foreground mb-4">
                                    <p><strong>How it works:</strong></p>
                                    <p>1. Swap STX → CHA tokens</p>
                                    <p>2. Deposit CHA to voting subnet</p>
                                    <p>3. Vote for your favorite tokens!</p>
                                </div>
                                <SwapStxToChaButton
                                    size="lg"
                                    className="w-full mb-3"
                                    buttonLabel="🔄 Swap STX for CHA"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Need at least {minVoteAmount} CHA to vote
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Deposit CHA Prompt - User has mainnet CHA but no subnet CHA */}
                {showDepositPrompt && (
                    <div className="px-6 pb-6 space-y-6">
                        <div className="text-center space-y-4">
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                                <div className="text-4xl mb-3">🏦</div>
                                <h3 className="font-bold text-lg mb-2">Deposit CHA to Start Voting!</h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    You have <strong>{mainnetCHAAmount.toFixed(2)} CHA</strong> on mainnet.
                                    Deposit some to the voting subnet to start voting!
                                </p>
                                <div className="bg-background/50 rounded-lg p-3 text-xs text-muted-foreground mb-4">
                                    <p><strong>Quick & Easy:</strong></p>
                                    <p>• Transfer CHA from mainnet to subnet</p>
                                    <p>• Instant and secure</p>
                                    <p>• Start voting immediately</p>
                                </div>
                                <DepositCharismaButton
                                    size="lg"
                                    className="w-full mb-3"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Need at least {minVoteAmount} CHA to vote
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Voting Interface - Only show if user has enough subnet CHA */}
                {!isLoadingBalances && hasEnoughSubnetCHA && (
                    <div className="px-6 pb-6 space-y-6">
                        {/* Step 1: Choose Amount */}
                        <div className="space-y-3">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                                Choose Your Vote Amount
                            </h3>

                            <div className="grid grid-cols-2 gap-2">
                                {QUICK_AMOUNTS.map((preset) => {
                                    const isSelected = selectedAmount === preset.amount;
                                    const canAfford = Number(subnetBalance) >= preset.amount * (10 ** CHA_DECIMALS);

                                    return (
                                        <button
                                            key={preset.amount}
                                            onClick={() => setSelectedAmount(preset.amount)}
                                            disabled={!canAfford}
                                            className={`
                                            p-4 rounded-xl border-2 transition-all duration-200 
                                            ${isSelected
                                                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                                                    : canAfford
                                                        ? 'border-border/30 hover:border-primary/50'
                                                        : 'border-border/20 opacity-50 cursor-not-allowed'
                                                }
                                        `}
                                        >
                                            <div className="font-bold text-lg">{preset.label}</div>
                                            <div className="text-sm text-muted-foreground">{preset.amount} CHA</div>
                                            <div className="text-xs text-muted-foreground">{preset.description}</div>
                                            {isSelected && <Zap className="h-4 w-4 text-primary mx-auto mt-1" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="text-center text-sm text-muted-foreground">
                                Balance: <span className="font-medium text-primary">{availableBalance} CHA</span>
                            </div>
                        </div>

                        {/* Step 2: Choose Token */}
                        {selectedAmount && (
                            <div className="space-y-3">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                                    Pick Your Token
                                </h3>

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
                                                onClick={() => setSelectedToken(token)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* More Options */}
                                {!showAllTokens ? (
                                    <Button
                                        variant="outline"
                                        onClick={handleShowAllTokens}
                                        className="w-full"
                                    >
                                        Show More Tokens ({tokens.filter(t => t.type !== 'SUBNET').length - 3} more)
                                    </Button>
                                ) : (
                                    <div className="space-y-2">
                                        <Badge variant="secondary" className="text-xs">📝 ALL TOKENS</Badge>
                                        <ScrollArea className="h-48 border rounded-lg">
                                            <div className="p-2 space-y-2">
                                                {shuffledOtherTokens.map((token) => (
                                                    <TokenCard
                                                        key={token.id}
                                                        token={token}
                                                        isSelected={selectedToken?.id === token.id}
                                                        onClick={() => setSelectedToken(token)}
                                                    />
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Vote Button */}
                        {selectedAmount && (
                            <div className="pt-4 border-t border-border/30">
                                <Button
                                    onClick={handleVote}
                                    disabled={!canVote}
                                    className={`w-full py-4 text-lg ${canVote ? 'animate-pulse-glow' : ''}`}
                                    size="lg"
                                >
                                    {isLoading ? (
                                        'Placing Vote...'
                                    ) : selectedToken ? (
                                        `🚀 Vote ${selectedAmount} CHA for ${selectedToken.symbol}!`
                                    ) : (
                                        'Pick a token to continue'
                                    )}
                                </Button>

                                {selectedToken && selectedAmount && (
                                    <p className="text-center text-sm text-muted-foreground mt-2">
                                        Everyone gets the winning token worth their vote amount. If <strong>{selectedToken.symbol}</strong> wins, it's extra nice if you already hold some! 💰
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default VoteModal; 