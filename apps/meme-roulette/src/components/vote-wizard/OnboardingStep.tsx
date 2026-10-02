'use client';

import React from 'react';
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';

interface OnboardingStepProps {
    hasMainnetCHA: boolean;
    mainnetCHAAmount: number;
    minVoteAmount: number;
    onContinue: () => void;
}

export const OnboardingStep = ({
    hasMainnetCHA,
    mainnetCHAAmount,
    minVoteAmount,
    onContinue
}: OnboardingStepProps) => {
    // If user has no CHA at all, show swap prompt
    if (!hasMainnetCHA) {
        return (
            <div className="px-6 pb-6 space-y-6">
                <div className="text-center space-y-4">
                    <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
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
        );
    }

    // If user has mainnet CHA but no subnet CHA, show deposit prompt
    return (
        <div className="px-6 pb-6 space-y-6">
            <div className="text-center space-y-4">
                <div className="bg-accent/10 border border-accent/20 rounded-xl p-6">
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
    );
}; 