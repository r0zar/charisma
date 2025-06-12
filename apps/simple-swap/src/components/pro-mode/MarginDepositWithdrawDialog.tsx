"use client";

import React, { useState, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Plus, Minus, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { MarginAccount } from '../../lib/margin/types';

interface Props {
    type: 'deposit' | 'withdraw';
    open: boolean;
    onOpenChange: (open: boolean) => void;
    marginAccount: MarginAccount | null;
    depositMargin: (amount: number) => Promise<boolean>;
    withdrawMargin: (amount: number) => Promise<boolean>;
    formatBalance: (amount: number) => string;
}

const MarginDepositWithdrawDialog = memo(function MarginDepositWithdrawDialog({
    type,
    open,
    onOpenChange,
    marginAccount,
    depositMargin,
    withdrawMargin,
    formatBalance
}: Props) {
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Don't render if no account data
    if (!marginAccount) {
        return null;
    }

    // Reset when dialog opens
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            setAmount('');
            setError('');
        }
        onOpenChange(newOpen);
    };

    // Simple validation
    const validate = (value: string): string => {
        const num = parseFloat(value);
        if (!value || isNaN(num) || num <= 0) {
            return 'Please enter a valid amount';
        }
        if (type === 'withdraw' && num > marginAccount.freeMargin) {
            return `Maximum withdrawal: ${formatBalance(marginAccount.freeMargin)}`;
        }
        if (type === 'deposit' && num > 1000000) {
            return 'Maximum deposit: $1,000,000';
        }
        return '';
    };

    // Handle amount change
    const handleAmountChange = (value: string) => {
        // Only allow numbers and decimal
        if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
            setAmount(value);
            setError(validate(value));
        }
    };

    // Handle submit
    const handleSubmit = async () => {
        const validationError = validate(amount);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const success = type === 'deposit'
                ? await depositMargin(parseFloat(amount))
                : await withdrawMargin(parseFloat(amount));

            if (success) {
                onOpenChange(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Transaction failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const numAmount = parseFloat(amount) || 0;
    const canSubmit = amount && !error && !isSubmitting && numAmount > 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        {type === 'deposit' ? (
                            <Plus className="w-4 h-4 text-green-500" />
                        ) : (
                            <Minus className="w-4 h-4 text-blue-500" />
                        )}
                        <span>{type === 'deposit' ? 'Deposit' : 'Withdraw'} Margin</span>
                        <Badge variant="secondary" className="text-xs">Preview</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Current Status */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
                        <div>
                            <div className="text-muted-foreground">Account Equity</div>
                            <div className="font-medium">{formatBalance(marginAccount.accountEquity)}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground">
                                {type === 'deposit' ? 'Current Balance' : 'Available'}
                            </div>
                            <div className="font-medium">
                                {formatBalance(type === 'deposit' ? marginAccount.totalBalance : marginAccount.freeMargin)}
                            </div>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Amount (USD)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={amount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder="0.00"
                                className="pl-10 text-lg"
                                disabled={isSubmitting}
                            />
                        </div>
                        {error && (
                            <div className="flex items-center space-x-2 text-sm text-red-500">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Quick amounts for deposit */}
                    {type === 'deposit' && (
                        <div className="space-y-2">
                            <label className="text-sm text-muted-foreground">Quick Select</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[500, 1000, 5000].map((quickAmount) => (
                                    <Button
                                        key={quickAmount}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAmountChange(quickAmount.toString())}
                                        disabled={isSubmitting}
                                        className="text-xs"
                                    >
                                        ${quickAmount.toLocaleString()}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Warning for withdrawals with active positions */}
                    {type === 'withdraw' && marginAccount.usedMargin > 0 && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-yellow-600 dark:text-yellow-400">
                                <AlertTriangle className="w-4 h-4" />
                                <div>
                                    <div className="font-medium">Active Positions</div>
                                    <div>You have ${marginAccount.usedMargin.toLocaleString()} in active positions.</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3 pt-2">
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
                            disabled={!canSubmit}
                            className="flex-1"
                        >
                            {isSubmitting ? 'Processing...' :
                                `${type === 'deposit' ? 'Deposit' : 'Withdraw'} ${numAmount > 0 ? formatBalance(numAmount) : ''
                                }`
                            }
                        </Button>
                    </div>

                    {/* Preview Notice */}
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                            <CheckCircle className="w-4 h-4" />
                            <div>
                                <div className="font-medium">Preview Mode</div>
                                <div>Simulated trading with virtual funds. No real money involved.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});

export default MarginDepositWithdrawDialog; 