import React from 'react';
import { Rocket, DollarSign, TrendingUp, Users, Clock } from 'lucide-react';
import type { ValidationResults, Token } from '@/types/spin';
import TokenAmountDisplay from '@/components/TokenAmountDisplay';
import Image from 'next/image';

interface SpinReadyDisplayProps {
    validationResults: ValidationResults;
    tokens: Token[];
    chaPrice?: number;
    onStartSpin?: () => void;
}

const CHA_DECIMALS = 6;

export default function SpinReadyDisplay({
    validationResults,
    tokens,
    chaPrice,
    onStartSpin
}: SpinReadyDisplayProps) {
    const { validUsers, validTokenBets, totalValidCHA } = validationResults;

    // Get tokens with bets sorted by amount
    const tokensWithBets = Object.entries(validTokenBets)
        .filter(([_, amount]) => amount > 0)
        .map(([tokenId, amount]) => {
            const token = tokens.find(t => t.id === tokenId);
            return {
                tokenId,
                token,
                amount,
                percentage: totalValidCHA > 0 ? (amount / totalValidCHA) * 100 : 0
            };
        })
        .sort((a, b) => b.amount - a.amount);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
            <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold font-display mb-2 text-primary">
                        🚀 Ready to Spin!
                    </h2>
                    <p className="text-muted-foreground">
                        All validations complete. Here's what will be processed.
                    </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Total Amount */}
                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 text-center">
                        <DollarSign className="h-8 w-8 text-primary mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2 text-primary">Total CHA to Spend</h3>
                        <div className="text-3xl font-bold text-primary mb-2">
                            <TokenAmountDisplay
                                amount={totalValidCHA}
                                decimals={CHA_DECIMALS}
                                symbol="CHA"
                                usdPrice={chaPrice}
                                className="text-primary"
                                size="lg"
                                showUsd={true}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            From {validUsers.length} validated users
                        </p>
                    </div>

                    {/* Valid Users */}
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
                        <Users className="h-8 w-8 text-green-400 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2 text-green-400">Participating Users</h3>
                        <div className="text-3xl font-bold text-green-400 mb-2">
                            {validUsers.length}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Users with valid balances
                        </p>
                    </div>

                    {/* Tokens in Competition */}
                    <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-6 text-center">
                        <TrendingUp className="h-8 w-8 text-secondary mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-2 text-secondary">Tokens in Competition</h3>
                        <div className="text-3xl font-bold text-secondary mb-2">
                            {tokensWithBets.length}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Tokens with valid votes
                        </p>
                    </div>
                </div>

                {/* Token Breakdown */}
                <div className="bg-muted/20 border border-border rounded-xl p-6 mb-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Token Breakdown
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tokensWithBets.map(({ tokenId, token, amount, percentage }, index) => (
                            <div key={tokenId} className="bg-card/50 border border-border rounded-lg p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="relative">
                                        <Image
                                            src={token?.imageUrl || '/placeholder-token.png'}
                                            alt={token?.symbol || 'Token'}
                                            width={40}
                                            height={40}
                                            className="rounded-full object-cover"
                                            onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                        />
                                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-foreground">
                                            {token?.symbol || tokenId}
                                        </h4>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {token?.name || 'Unknown Token'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Amount:</span>
                                        <span className="font-semibold">
                                            <TokenAmountDisplay
                                                amount={amount}
                                                decimals={CHA_DECIMALS}
                                                symbol="CHA"
                                                usdPrice={chaPrice}
                                                className="text-primary"
                                                size="sm"
                                                showUsdInTooltip={true}
                                            />
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Share:</span>
                                        <span className="font-semibold text-primary">
                                            {percentage.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="w-full bg-muted rounded-full h-2">
                                        <div
                                            className="bg-primary rounded-full h-2 transition-all duration-500"
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {tokensWithBets.length === 0 && (
                        <div className="text-center py-8">
                            <div className="text-muted-foreground mb-2">No valid tokens found</div>
                            <p className="text-sm text-muted-foreground">
                                All user votes were invalidated due to insufficient balances
                            </p>
                        </div>
                    )}
                </div>

                {/* What Happens Next */}
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-primary flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        What Happens Next
                    </h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                            <div className="bg-primary/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-primary mt-0.5 shrink-0">
                                1
                            </div>
                            <p>One token will be randomly selected based on the CHA amounts committed</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="bg-primary/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-primary mt-0.5 shrink-0">
                                2
                            </div>
                            <p>All validated CHA will be swapped to the winning token</p>
                        </div>
                        <div className="flex items-start gap-2">
                            <div className="bg-primary/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-primary mt-0.5 shrink-0">
                                3
                            </div>
                            <p>Users who voted for the winning token will receive their share of tokens</p>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="text-center">
                    {onStartSpin ? (
                        <button
                            onClick={onStartSpin}
                            className="button-primary px-8 py-4 text-lg flex items-center gap-3 mx-auto animate-pulse-medium"
                        >
                            <Rocket className="h-6 w-6" />
                            Start the Spin!
                        </button>
                    ) : (
                        <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                            <div className="flex items-center justify-center gap-2 text-secondary">
                                <Clock className="h-5 w-5 animate-pulse" />
                                <span className="font-semibold">Preparing to spin...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 