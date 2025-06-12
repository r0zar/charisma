"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Separator } from '../ui/separator';
import {
    Wallet,
    Plus,
    Minus,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    Info
} from 'lucide-react';
import { useMarginAccountAPI } from '../../hooks/useMarginAccountAPI';

interface MarginDepositWithdrawDialogProps {
    type: 'deposit' | 'withdraw';
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const QUICK_AMOUNTS = {
    deposit: [500, 1000, 2500, 5000, 10000],
    withdraw: [] // Will be calculated based on available balance
};

export default function MarginDepositWithdrawDialog({
    type,
    open,
    onOpenChange
}: MarginDepositWithdrawDialogProps) {
    const {
        account,
        depositMargin,
        withdrawMargin,
        formatBalance,
        getLiquidationRisk
    } = useMarginAccountAPI();

    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');

    // Reset form when dialog opens/closes
    useEffect(() => {
        if (open) {
            setAmount('');
            setValidationMessage('');
        }
    }, [open]);

    // Don't render if account is not loaded
    if (!account) {
        return null;
    }

    // Calculate quick amounts for withdrawal
    const getQuickAmounts = () => {
        if (type === 'deposit') {
            return QUICK_AMOUNTS.deposit;
        } else {
            // For withdrawals, suggest percentages of free margin
            const freeMargin = account.freeMargin;
            if (freeMargin <= 0) return [];

            const percentages = [0.25, 0.5, 0.75, 1.0];
            return percentages
                .map(pct => Math.floor(freeMargin * pct))
                .filter(amt => amt >= 10); // Only show amounts >= $10
        }
    };

    // Validate amount input
    const validateAmount = (value: string) => {
        const numValue = parseFloat(value);

        if (!value || isNaN(numValue) || numValue <= 0) {
            setValidationMessage('Please enter a valid amount');
            return false;
        }

        if (type === 'deposit') {
            if (numValue > 1000000) {
                setValidationMessage('Maximum deposit is $1,000,000 in preview mode');
                return false;
            }
        } else {
            if (numValue > account.freeMargin) {
                setValidationMessage(`Maximum withdrawal is ${formatBalance(account.freeMargin)}`);
                return false;
            }

            // Check if withdrawal would create dangerous margin ratio
            const newTotalBalance = account.totalBalance - numValue;
            const newAccountEquity = newTotalBalance + account.unrealizedPnL;
            const newMarginRatio = account.usedMargin > 0 ? (account.usedMargin / newAccountEquity) * 100 : 0;

            if (newMarginRatio > 80) {
                setValidationMessage('This withdrawal would create high liquidation risk');
                return false;
            }
        }

        setValidationMessage('');
        return true;
    };

    // Handle amount input change
    const handleAmountChange = (value: string) => {
        // Only allow numeric input with up to 2 decimal places
        if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
            setAmount(value);
            if (value) {
                validateAmount(value);
            } else {
                setValidationMessage('');
            }
        }
    };

    // Handle quick amount selection
    const selectQuickAmount = (quickAmount: number) => {
        const amountStr = quickAmount.toString();
        setAmount(amountStr);
        validateAmount(amountStr);
    };

    // Handle submit
    const handleSubmit = async () => {
        if (!validateAmount(amount)) return;

        setIsSubmitting(true);
        try {
            const success = type === 'deposit'
                ? await depositMargin(parseFloat(amount))
                : await withdrawMargin(parseFloat(amount));

            if (success) {
                onOpenChange(false);
            }
        } catch (error) {
            console.error('Transaction failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const quickAmounts = getQuickAmounts();
    const isValid = amount && validateAmount(amount) && !validationMessage;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        {type === 'deposit' ? (
                            <Plus className="w-5 h-5 text-green-500" />
                        ) : (
                            <Minus className="w-5 h-5 text-blue-500" />
                        )}
                        <span>
                            {type === 'deposit' ? 'Deposit Margin' : 'Withdraw Margin'}
                        </span>
                        <Badge variant="secondary" className="text-xs">Preview Mode</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Current Account Status */}
                    <Card className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-muted-foreground">Account Equity</div>
                                <div className="font-medium">{formatBalance(account.accountEquity)}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">
                                    {type === 'deposit' ? 'Current Balance' : 'Available to Withdraw'}
                                </div>
                                <div className="font-medium">
                                    {type === 'deposit'
                                        ? formatBalance(account.totalBalance)
                                        : formatBalance(account.freeMargin)
                                    }
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Amount Input */}
                    <div className="space-y-3">
                        <Label htmlFor="amount">Amount (USD)</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                id="amount"
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder="0.00"
                                className="pl-10 text-lg font-medium"
                                disabled={isSubmitting}
                            />
                        </div>

                        {validationMessage && (
                            <div className="flex items-center space-x-2 text-sm text-red-500">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{validationMessage}</span>
                            </div>
                        )}
                    </div>

                    {/* Quick Amount Buttons */}
                    {quickAmounts.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm text-muted-foreground">Quick Select</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {quickAmounts.map((quickAmount) => (
                                    <Button
                                        key={quickAmount}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => selectQuickAmount(quickAmount)}
                                        disabled={isSubmitting}
                                        className="text-xs"
                                    >
                                        ${quickAmount.toLocaleString()}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Warning for Withdrawals */}
                    {type === 'withdraw' && account.usedMargin > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                                <Info className="w-4 h-4 text-yellow-500 mt-0.5" />
                                <div className="text-sm">
                                    <div className="font-medium text-yellow-700 dark:text-yellow-300">
                                        Active Positions
                                    </div>
                                    <div className="text-yellow-600 dark:text-yellow-400 mt-1">
                                        You have ${account.usedMargin.toLocaleString()} in active positions.
                                        Withdrawing too much could increase liquidation risk.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!isValid || isSubmitting}
                            className="flex-1"
                        >
                            {isSubmitting ? (
                                'Processing...'
                            ) : (
                                <>
                                    {type === 'deposit' ? 'Deposit' : 'Withdraw'} {
                                        amount && formatBalance(parseFloat(amount))
                                    }
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Preview Mode Notice */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                            <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                            <div className="text-sm">
                                <div className="font-medium text-blue-700 dark:text-blue-300">
                                    Preview Mode Active
                                </div>
                                <div className="text-blue-600 dark:text-blue-400 mt-1">
                                    This is simulated trading with virtual funds. No real money is involved.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 