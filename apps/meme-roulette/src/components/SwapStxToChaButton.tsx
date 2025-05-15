'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/contexts/wallet-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSwapClient } from '../lib/swap-client'; // Still needed for executeSwap
import type { QuoteResponse } from '../lib/swap-client';
import type { VariantProps } from 'class-variance-authority';
import { Coins, RefreshCw, Repeat } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/sonner';
import { z } from 'zod';
import { buttonVariants } from '@/components/ui/button';
import { CHARISMA_SUBNET_CONTRACT } from '@repo/tokens';
import { Quote } from 'dexterity-sdk';

// --- Form Validation Schema ---
const formSchema = z.object({
    stxAmount: z
        .string()
        .min(1, 'Amount is required')
        .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
            message: 'Amount must be a positive number',
        }),
});

type FormValues = z.infer<typeof formSchema>;

// --- Quote Data Structure (adjust based on actual API response) ---
// Using QuoteResponse from swap-client

// --- Component Props ---
interface SwapStxToChaButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    VariantProps<typeof buttonVariants> {
    buttonLabel?: string;
    onSwapSuccess?: (txId: string) => void;
    onSwapError?: (error: Error) => void;
    asChild?: boolean;
}

// --- Helper Functions ---
const formatStx = (microStx: string | bigint, decimals = 6): string => {
    try {
        const num = BigInt(microStx);
        const divisor = BigInt(10 ** decimals);
        const integerPart = num / divisor;
        const fractionalPart = num % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toLocaleString();
        } else {
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, ''); // Remove trailing zeros
            return `${integerPart.toLocaleString()}.${fractionalStr}`;
        }
    } catch {
        return '0';
    }
};

// --- Component ---
export function SwapStxToChaButton({
    buttonLabel = 'Load up CHA',
    onSwapSuccess,
    onSwapError,
    className,
    variant,
    size,
    ...buttonProps
}: SwapStxToChaButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFetchingQuote, setIsFetchingQuote] = useState(false);
    const [lastTxId, setLastTxId] = useState<string | null>(null);
    const [quote, setQuote] = useState<QuoteResponse | null>(null);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);

    const { address, connected, stxBalance, stxBalanceLoading, swapTokens, getQuote } = useWallet();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            stxAmount: '',
        },
    });

    const stxAmountInput = form.watch('stxAmount');

    // --- Quote preview on change ---
    useEffect(() => {
        const fetchQuote = async () => {
            if (!stxAmountInput || Number(stxAmountInput) <= 0) {
                setQuote(null);
                setQuoteError(null);
                return;
            }

            setQuoteLoading(true);
            setQuoteError(null);
            const amountToQuote = Math.round(Number(stxAmountInput) * 1_000_000);

            // Log the raw response for debugging
            // console.log("Calling getQuote with:", '.stx', CHARISMA_SUBNET_CONTRACT, amountToQuote);
            const response = await getQuote('.stx', CHARISMA_SUBNET_CONTRACT, amountToQuote);
            // console.log("Raw response from useWallet().getQuote:", response);
            const typedResponse = response;
            if (typedResponse instanceof Error) {
                setQuoteError(typedResponse.message);
                setQuote(null);
            } else if (response.quote) {
                // Handle direct successful QuoteResponse data (heuristic check)
                setQuote(response.quote);
                setQuoteError(null);
            }
        };

        fetchQuote();
    }, [stxAmountInput, getQuote, setQuote, setQuoteLoading, setQuoteError]);


    // --- Swap Transaction Logic ---
    const onSubmit = async (values: FormValues) => {
        if (!connected || !address) {
            toast.error('Wallet not connected'); return;
        }
        if (!quote) {
            toast.error('No valid quote available'); return;
        }

        const stxAmountMicro = BigInt(Math.round(Number(values.stxAmount) * 1_000_000));
        const availableStxBalance = BigInt(stxBalance);

        if (stxAmountMicro > availableStxBalance) {
            toast.error('Insufficient STX balance'); return;
        }

        setIsSubmitting(true);
        setLastTxId(null);

        try {
            // Use swapClient to execute the swap using the fetched route
            const result = await swapTokens('.stx', CHARISMA_SUBNET_CONTRACT, stxAmountInput);

            // Check the result structure from swapClient
            if ('txId' in result && result.txId) {
                const txId = result.txId;
                setLastTxId(txId);
                toast.success('Swap Submitted!', {
                    description: `Tx ID: ${txId.substring(0, 10)}...`,
                    action: {
                        label: 'View',
                        onClick: () => window.open(`https://explorer.stacks.co/txid/${txId}?chain=mainnet`, '_blank'),
                    },
                });
                form.reset();
                setQuote(null);
                setIsOpen(false);
                onSwapSuccess?.(txId);
            } else {
                // Handle error case from swapClient
                const errorMessage = ('error' in result && result.error) || 'Swap failed or was cancelled.';
                toast.error('Swap Failed', { description: errorMessage });
                // Optionally trigger onSwapError callback here if needed
                // onSwapError?.(new Error(errorMessage));
            }
        } catch (error: any) {
            console.error('Error initiating STX to CHA swap:', error);
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('cancelled') || message.toLowerCase().includes('rejected')) {
                toast.info('Swap Cancelled');
            } else {
                toast.error('Swap Failed', { description: message });
            }
            onSwapError?.(error instanceof Error ? error : new Error(message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const availableStxFormatted = formatStx(stxBalance);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className={className} variant={variant} size={size} {...buttonProps}>{buttonLabel}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Repeat className="h-5 w-5 text-primary" /> Swap STX for CHA
                    </DialogTitle>
                    <DialogDescription>
                        Enter the amount of STX you want to swap. The estimated CHA received will be shown.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                    {/* STX Input Section */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="stxAmount">You Pay (STX)</Label>
                            <span className="text-xs text-muted-foreground">
                                Balance: {stxBalanceLoading ? '...' : availableStxFormatted} STX
                            </span>
                        </div>
                        <Input
                            id="stxAmount"
                            type="number"
                            step="any"
                            placeholder="0.00"
                            {...form.register('stxAmount')}
                            disabled={isSubmitting}
                            className="input-field text-lg font-mono"
                        />
                        {form.formState.errors.stxAmount && (
                            <p className="text-sm text-destructive">{form.formState.errors.stxAmount.message}</p>
                        )}
                    </div>

                    {/* Swap Icon */}
                    <div className="flex justify-center text-muted-foreground">
                        <Coins className="h-5 w-5" />
                    </div>

                    {/* CHA Output Section */}
                    <div className="space-y-1.5">
                        <Label htmlFor="chaAmountOut">You Receive (CHA)</Label>
                        <div className="h-[40px] px-3 py-2 text-sm rounded-md border border-input bg-muted/50 flex items-center font-mono">
                            {isFetchingQuote ? (
                                <span className="flex items-center text-muted-foreground">
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Fetching quote...
                                </span>
                            ) : quoteError ? (
                                <span className="text-destructive text-xs">{quoteError}</span>
                            ) : quote ? (
                                <>
                                    ~ {formatStx(String(quote.amountOut))} CHA
                                    <span className="text-xs text-muted-foreground ml-2">(Min: {formatStx(String(quote.minimumReceived))})</span>
                                </>
                            ) : (
                                <span className="text-muted-foreground">Enter STX amount</span>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting || isFetchingQuote || !quote || !connected}
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing...
                                </>
                            ) : isFetchingQuote ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Getting Quote...
                                </>
                            ) : (
                                'Confirm Swap'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 