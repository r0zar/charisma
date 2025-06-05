'use client';

import React, { useMemo } from 'react';
import { Zap, ChevronLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useTokenPrices } from '@/hooks/useTokenPrices';

// CHA Token constants
const CHA_DECIMALS = 6;

// Base CHA amounts for voting presets
const QUICK_CHA_AMOUNTS = [
    { amount: 10, description: 'Small bet' },
    { amount: 25, description: 'Popular choice' },
    { amount: 50, description: 'Go big!' },
    { amount: 100, description: 'All in!' }
];

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

interface AmountSelectionStepProps {
    selectedAmount: number | null;
    subnetBalance: string;
    onAmountSelect: (amount: number) => void;
    onBack?: () => void;
}

export const AmountSelectionStep = ({
    selectedAmount,
    subnetBalance,
    onAmountSelect,
    onBack
}: AmountSelectionStepProps) => {
    const { chaPrice, isLoading: pricesLoading } = useTokenPrices();

    // Create dynamic quick amounts with real USD values
    const QUICK_AMOUNTS = useMemo(() => {
        return QUICK_CHA_AMOUNTS.map(base => {
            const usdValue = chaPrice ? base.amount * chaPrice : null;
            const usdLabel = pricesLoading ? 'Loading...' : usdValue ? `$${usdValue.toFixed(2)}` : '~$?';

            return {
                ...base,
                label: usdLabel,
                usdValue
            };
        });
    }, [chaPrice, pricesLoading]);

    const availableBalance = formatBalance(subnetBalance, CHA_DECIMALS);

    return (
        <div className="px-6 pb-6 space-y-6">
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
                                onClick={() => canAfford && onAmountSelect(preset.amount)}
                                disabled={!canAfford}
                                className={`
                                    p-4 h-auto flex flex-col items-center space-y-1 transition-all duration-200 rounded-xl border-2
                                    ${isSelected
                                        ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/20'
                                        : canAfford
                                            ? 'border-border/30 hover:border-primary/50 bg-background hover:bg-muted/50 cursor-pointer'
                                            : 'border-border/20 opacity-50 cursor-not-allowed bg-background'
                                    }
                                `}
                            >
                                <div className="font-bold text-lg">{preset.label}</div>
                                <div className="text-sm opacity-80">{preset.amount} CHA</div>
                                <div className="text-xs opacity-60">{preset.description}</div>
                                {isSelected && <Zap className="h-4 w-4 mt-1 text-current" />}
                            </button>
                        );
                    })}
                </div>

                <div className="text-center text-sm text-muted-foreground">
                    Balance: <span className="font-medium text-primary">{availableBalance} CHA</span>
                </div>
            </div>

            {/* Back Button */}
            {onBack && (
                <div className="pt-4 border-t border-border/30">
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className="flex items-center gap-2"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                    </Button>
                </div>
            )}
        </div>
    );
}; 