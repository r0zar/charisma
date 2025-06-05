'use client';

import React, { useState, useEffect } from 'react';
import { Token } from '@/types/spin';
import { useWallet } from '@/contexts/wallet-context';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Heart } from 'lucide-react';
import { OnboardingStep } from './OnboardingStep';
import { AmountSelectionStep } from './AmountSelectionStep';
import { TokenSelectionStep } from './TokenSelectionStep';
import { ConfirmationStep } from './ConfirmationStep';

export interface VoteWizardState {
    selectedAmount: number | null;
    selectedToken: Token | null;
    step: 'onboarding' | 'amount' | 'token' | 'confirmation';
    showingAllTokens: boolean;
}

interface VoteWizardProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
}

const VoteWizard = ({ isOpen, onClose, tokens }: VoteWizardProps) => {
    const { subnetBalance, subnetBalanceLoading, mainnetBalance, balanceLoading } = useWallet();

    const [wizardState, setWizardState] = useState<VoteWizardState>({
        selectedAmount: null,
        selectedToken: null,
        step: 'amount',
        showingAllTokens: false
    });

    // CHA Token constants
    const CHA_DECIMALS = 6;
    const minVoteAmount = 10; // Smallest preset amount (10 CHA)

    // Check user's CHA balance status
    const subnetCHAAmount = Number(subnetBalance) / (10 ** CHA_DECIMALS);
    const mainnetCHAAmount = Number(mainnetBalance) / (10 ** CHA_DECIMALS);
    const hasEnoughSubnetCHA = subnetCHAAmount >= minVoteAmount;
    const hasMainnetCHA = mainnetCHAAmount > 0;
    const isLoadingBalances = subnetBalanceLoading || balanceLoading;

    // Determine initial step based on user's balance
    useEffect(() => {
        if (isLoadingBalances) return;

        if (!hasEnoughSubnetCHA) {
            setWizardState(prev => ({ ...prev, step: 'onboarding' }));
        } else {
            setWizardState(prev => ({ ...prev, step: 'amount' }));
        }
    }, [isLoadingBalances, hasEnoughSubnetCHA]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setWizardState({
                selectedAmount: null,
                selectedToken: null,
                step: 'amount',
                showingAllTokens: false
            });
        }
    }, [isOpen]);

    const updateWizardState = (updates: Partial<VoteWizardState>) => {
        setWizardState(prev => ({ ...prev, ...updates }));
    };

    const nextStep = () => {
        switch (wizardState.step) {
            case 'onboarding':
                setWizardState(prev => ({ ...prev, step: 'amount' }));
                break;
            case 'amount':
                if (wizardState.selectedAmount) {
                    setWizardState(prev => ({ ...prev, step: 'token' }));
                }
                break;
            case 'token':
                if (wizardState.selectedToken) {
                    setWizardState(prev => ({ ...prev, step: 'confirmation' }));
                }
                break;
        }
    };

    const prevStep = () => {
        switch (wizardState.step) {
            case 'token':
                setWizardState(prev => ({ ...prev, step: 'amount' }));
                break;
            case 'confirmation':
                setWizardState(prev => ({ ...prev, step: 'token' }));
                break;
        }
    };

    const renderCurrentStep = () => {
        if (isLoadingBalances) {
            return (
                <div className="px-6 pb-6 text-center">
                    <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
                        <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
                    </div>
                    <p className="text-muted-foreground mt-4">Checking your CHA balance...</p>
                </div>
            );
        }

        switch (wizardState.step) {
            case 'onboarding':
                return (
                    <OnboardingStep
                        hasMainnetCHA={hasMainnetCHA}
                        mainnetCHAAmount={mainnetCHAAmount}
                        minVoteAmount={minVoteAmount}
                        onContinue={nextStep}
                    />
                );
            case 'amount':
                return (
                    <AmountSelectionStep
                        selectedAmount={wizardState.selectedAmount}
                        subnetBalance={subnetBalance}
                        onAmountSelect={(amount: number) => {
                            updateWizardState({ selectedAmount: amount, step: 'token' });
                        }}
                        onBack={hasEnoughSubnetCHA ? undefined : () => setWizardState(prev => ({ ...prev, step: 'onboarding' }))}
                    />
                );
            case 'token':
                return (
                    <TokenSelectionStep
                        tokens={tokens}
                        selectedToken={wizardState.selectedToken}
                        onTokenSelect={(token: Token) => {
                            updateWizardState({ selectedToken: token, step: 'confirmation' });
                        }}
                        onBack={prevStep}
                        onShowAllTokens={(showing: boolean) => {
                            updateWizardState({ showingAllTokens: showing });
                        }}
                    />
                );
            case 'confirmation':
                return (
                    <ConfirmationStep
                        selectedAmount={wizardState.selectedAmount!}
                        selectedToken={wizardState.selectedToken!}
                        onBack={prevStep}
                        onSuccess={onClose}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`${wizardState.step === 'token' && wizardState.showingAllTokens ? 'sm:max-w-[900px]' : 'sm:max-w-[600px]'} max-h-[90vh] p-0 overflow-hidden bg-card/95 backdrop-blur-md border-primary/20`}>
                <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-card to-transparent">
                    <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-500" />
                        Vote for Your Favorite!
                    </DialogTitle>
                    <p className="text-muted-foreground mt-1">
                        Pick a token and amount. Everyone gets the winning token - but it's nice when your favorite wins!
                    </p>
                </DialogHeader>

                {renderCurrentStep()}
            </DialogContent>
        </Dialog>
    );
};

export default VoteWizard; 