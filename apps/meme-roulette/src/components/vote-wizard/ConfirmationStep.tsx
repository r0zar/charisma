'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Token } from '@/types/spin';
import { useWallet } from '@/contexts/wallet-context';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from '@/components/ui/sonner';

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

interface ConfirmationStepProps {
    selectedAmount: number;
    selectedToken: Token;
    onBack: () => void;
    onSuccess: () => void;
}

export const ConfirmationStep = ({
    selectedAmount,
    selectedToken,
    onBack,
    onSuccess
}: ConfirmationStepProps) => {
    const { subnetBalance, placeBet } = useWallet();
    const [isLoading, setIsLoading] = useState(false);

    const handleVote = async () => {
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
            onSuccess();
        } catch (error: any) {
            console.error("Vote failed:", error);
            const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
            toast.error(`Vote failed: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="px-4 sm:px-6 pb-6 space-y-4 sm:space-y-6">

            <div className="space-y-3 sm:space-y-4">
                <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm font-bold">3</span>
                    Confirm Your Vote
                </h3>

                {/* Vote Summary Card */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 sm:p-6 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Voting Amount</span>
                        <span className="font-bold text-lg">{selectedAmount} CHA</span>
                    </div>

                    <div className="border-t border-primary/20 pt-3 sm:pt-4">
                        <span className="text-sm text-muted-foreground block mb-2">Selected Token</span>
                        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-background/50 rounded-lg">
                            <Image
                                src={selectedToken.imageUrl}
                                alt={selectedToken.name}
                                width={40}
                                height={40}
                                className="rounded-full border-2 border-border/20 sm:w-12 sm:h-12"
                                onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-base sm:text-lg truncate">{selectedToken.name}</div>
                                <div className="text-sm text-muted-foreground font-mono">{selectedToken.symbol}</div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-primary/20 pt-3 sm:pt-4 text-xs sm:text-sm text-muted-foreground space-y-2">
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>Everyone gets the winning token worth their vote amount</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>If <strong className="break-all">{selectedToken.symbol}</strong> wins, it's extra nice if you already hold some!</span>
                        </div>
                    </div>
                </div>

                {/* Confirm Button */}
                <Button
                    onClick={handleVote}
                    disabled={isLoading}
                    className="w-full py-3 sm:py-4 text-sm sm:text-lg"
                    size="lg"
                >
                    {isLoading ? (
                        'Placing Vote...'
                    ) : (
                        <>
                            <span className="sm:hidden">🚀 Confirm Vote!</span>
                            <span className="hidden sm:inline">🚀 Confirm Vote: {selectedAmount} CHA for {selectedToken.symbol}!</span>
                        </>
                    )}
                </Button>

                <p className="text-center text-xs sm:text-sm text-muted-foreground px-2">
                    By confirming, you agree to vote {selectedAmount} CHA for <span className="break-all font-medium">{selectedToken.symbol}</span>.
                    This action cannot be undone.
                </p>

                {/* Additional Back Button at Bottom */}
                <div className="pt-3 sm:pt-4 border-t border-border/30">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm sm:text-base"
                        disabled={isLoading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="sm:hidden">Back</span>
                        <span className="hidden sm:inline">Back to Token Selection</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}; 