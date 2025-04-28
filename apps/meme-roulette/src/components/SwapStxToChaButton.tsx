'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/contexts/wallet-context';
import { zodResolver } from '@hookform/resolvers/zod';
import { swapClient } from '../lib/swap-client'; // Import the local swap client
import type { QuoteResponse } from '../lib/swap-client'; // Import QuoteResponse type
import type { VariantProps } from 'class-variance-authority';
import { Coins, RefreshCw, Repeat } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from '@/components/ui/sonner';
import { z } from 'zod';
import { buttonVariants } from '@/components/ui/button';

// --- Constants ---
const MAINNET_CHA_CONTRACT_ID =
    process.env.NEXT_PUBLIC_MAINNET_CHA_CONTRACT_ID ||
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

// Assumed API endpoint for getting swap quotes (relative to the current app)
// This might need adjustment based on where simple-swap API runs / CORS
// REMOVED - swapClient handles endpoints

// Assumed swap function details (needs verification from simple-swap or dex contract)
// REMOVED - swapClient handles contract details

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

    const { address, connected, stxBalance, stxBalanceLoading } = useWallet();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            stxAmount: '',
        },
    });

    const stxAmountInput = form.watch('stxAmount');

    // --- Quote Fetching Logic ---
    const fetchQuote = useCallback(async (amount: string) => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            setQuote(null);
            setQuoteError(null);
            return;
        }

        setIsFetchingQuote(true);
        setQuoteError(null);
        setQuote(null); // Clear previous quote

        try {
            const microStxAmount = BigInt(Math.round(Number(amount) * 1_000_000)); // Convert STX to micro-STX

            // Use swapClient to get quote
            const quoteData = await swapClient.getQuote(
                '.stx', // Use '.stx' identifier for native STX
                MAINNET_CHA_CONTRACT_ID,
                microStxAmount.toString()
            );

            setQuote(quoteData);

        } catch (error: any) {
            console.error('Error fetching swap quote:', error);
            const message = error instanceof Error ? error.message : 'Failed to get quote';
            setQuoteError(message);
            setQuote(null);
        } finally {
            setIsFetchingQuote(false);
        }
    }, []); // No dependencies needed if constants are outside

    // Debounced quote fetching
    useEffect(() => {
        const handler = setTimeout(() => {
            fetchQuote(stxAmountInput);
        }, 500); // Debounce time in ms

        return () => {
            clearTimeout(handler);
        };
    }, [stxAmountInput, fetchQuote]);

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
            const result = await swapClient.executeSwap(quote.route);

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
                            disabled={isSubmitting || isFetchingQuote || !quote || !connected || !form.formState.isValid}
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