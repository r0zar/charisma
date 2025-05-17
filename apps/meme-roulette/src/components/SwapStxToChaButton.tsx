// SwapStxToChaButton.tsx

'use client';

import { Button, buttonVariants } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { useWallet } from '@/contexts/wallet-context';
import { CHARISMA_SUBNET_CONTRACT } from '@repo/tokens';
import { zodResolver } from '@hookform/resolvers/zod';
import type { VariantProps } from 'class-variance-authority';
import { Coins, RefreshCw, Repeat } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Assuming QuoteResponse is correctly defined in swap-client and represents the structure of a successful quote.
// If it's the structure from dexterity-sdk's `Quote` type, ensure that's what `useWallet().getQuote()` actually returns.
// For now, using the existing import.
import type { QuoteResponse } from '../lib/swap-client';

// --- Constants ---
const STX_DECIMALS = 6;
const DEBOUNCE_DELAY = 500; // milliseconds for debounce

// --- Form Validation Schema ---
const formSchema = z.object({
    stxAmount: z
        .string()
        .min(1, 'Amount is required')
        .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
            message: 'Amount must be a positive number',
        })
        .refine((val) => Number(val) * (10 ** STX_DECIMALS) >= 1, { // Ensure at least 1 microSTX
            message: `Amount must be at least 0.000001 STX`,
        }),
});
type FormValues = z.infer<typeof formSchema>;

// --- State Types ---
interface QuoteFetchState {
    data: QuoteResponse | null;
    loading: boolean;
    error: string | null;
}

// --- Component Props ---
interface SwapStxToChaButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'size'>,
    VariantProps<typeof buttonVariants> {
    buttonLabel?: string;
    onSwapSuccess?: (txId: string) => void;
    onSwapError?: (error: Error) => void;
    asChild?: boolean;
}

// --- Helper Functions ---
const formatStxAmount = (microAmount: string | bigint | number, decimals = STX_DECIMALS): string => {
    try {
        const num = BigInt(microAmount);
        const divisor = BigInt(10 ** decimals);
        const integerPart = num / divisor;
        const fractionalPart = num % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toLocaleString();
        } else {
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '');
            return fractionalStr.length > 0 ? `${integerPart.toLocaleString()}.${fractionalStr}` : integerPart.toLocaleString();
        }
    } catch {
        return '0.00';
    }
};

// Custom hook for debouncing
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}


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
    const [lastTxId, setLastTxId] = useState<string | null>(null); // Potentially for display or other logic

    const [quoteState, setQuoteState] = useState<QuoteFetchState>({
        data: null,
        loading: false,
        error: null,
    });

    const { address, connected, stxBalance, stxBalanceLoading, swapTokens, getQuote } = useWallet();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { stxAmount: '' },
        mode: 'onChange', // Validate on change for better UX
    });

    const stxAmountInput = form.watch('stxAmount');
    const debouncedStxAmount = useDebounce(stxAmountInput, DEBOUNCE_DELAY);

    const clearQuote = useCallback(() => {
        setQuoteState({ data: null, loading: false, error: null });
    }, []);

    // Fetch Quote Effect
    useEffect(() => {
        // Ensure getQuote is stable, otherwise this effect might loop if getQuote changes identity.
        // This is typically handled by memoizing getQuote in useWallet with useCallback.
        if (!getQuote) return;


        const fetchQuoteAsync = async () => {
            if (!debouncedStxAmount || Number(debouncedStxAmount) <= 0 || form.formState.errors.stxAmount) {
                clearQuote();
                return;
            }

            setQuoteState((prev) => ({ ...prev, loading: true, error: null }));
            try {
                const amountInMicroStx = Math.round(Number(debouncedStxAmount) * (10 ** STX_DECIMALS));
                if (amountInMicroStx <= 0) {
                    clearQuote();
                    setQuoteState((prev) => ({ ...prev, error: "Amount too low", loading: false }));
                    return;
                }

                // Assuming getQuote from useWallet returns:
                // - { quote: QuoteResponseData } for success
                // - An Error instance for failure
                const response = await getQuote('.stx', CHARISMA_SUBNET_CONTRACT, amountInMicroStx);

                if (response instanceof Error) {
                    setQuoteState({ data: null, loading: false, error: response.message });
                } else if (response && typeof response === 'object' && response.quote !== undefined) {
                    setQuoteState({ data: response.quote as QuoteResponse, loading: false, error: null });
                } else {
                    setQuoteState({ data: null, loading: false, error: 'Invalid quote data received.' });
                }
            } catch (err) {
                setQuoteState({
                    data: null,
                    loading: false,
                    error: err instanceof Error ? err.message : 'An unknown error occurred while fetching quote.',
                });
            }
        };

        fetchQuoteAsync();
    }, [debouncedStxAmount, getQuote, clearQuote, form.formState.errors.stxAmount]);


    // Swap Transaction Logic
    const handleSwapSubmit = async (values: FormValues) => {
        if (!connected || !address) {
            toast.error('Wallet not connected.');
            return;
        }
        if (!quoteState.data) {
            toast.error('No valid quote available to perform swap.');
            return;
        }

        const stxAmountMicro = BigInt(Math.round(Number(values.stxAmount) * (10 ** STX_DECIMALS)));
        const availableStxBalance = BigInt(stxBalance); // Assuming stxBalance is in microSTX

        if (stxAmountMicro > availableStxBalance) {
            toast.error('Insufficient STX balance.');
            return;
        }

        setIsSubmitting(true);
        setLastTxId(null); // Reset last TxId

        try {
            // Assuming swapTokens from useWallet takes these arguments: tokenInId, tokenOutId, amountString (human-readable)
            // And internally uses the best route, or if it needs a quote/route object, that should be passed.
            // The current implementation of swapTokens in the original file was `swapTokens()`
            // which might imply it gets context elsewhere.
            // Reverting to the more explicit version for clarity if it's a generic swap function:
            const result = await swapTokens('.stx', CHARISMA_SUBNET_CONTRACT, values.stxAmount);


            // Assuming result has { txid: string } on success or { error: string } on failure from useWallet().swapTokens
            if (result && typeof result === 'object' && 'txid' in result && result.txid) {
                const txId = String(result.txid);
                setLastTxId(txId);
                toast.success('Swap Submitted!', {
                    description: `Tx ID: ${txId.substring(0, 10)}...`,
                    action: {
                        label: 'View',
                        onClick: () => window.open(`https://explorer.stacks.co/txid/${txId}?chain=mainnet`, '_blank'),
                    },
                });
                form.reset(); // Reset form fields
                clearQuote();   // Clear the quote
                setIsOpen(false); // Close dialog
                onSwapSuccess?.(txId);
            } else if (result && typeof result === 'object' && 'error' in result) {
                const errorMessage = String(result.error) || 'Swap failed or was cancelled by the wallet.';
                toast.error('Swap Failed', { description: errorMessage });
                onSwapError?.(new Error(errorMessage));
            } else {
                toast.error('Swap Failed', { description: 'An unexpected response was received from the swap action.' });
                onSwapError?.(new Error('Unexpected swap response.'));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('cancelled') || message.toLowerCase().includes('rejected')) {
                toast.info('Swap Cancelled');
            } else {
                toast.error('Swap Operation Failed', { description: message });
            }
            onSwapError?.(error instanceof Error ? error : new Error(message));
        } finally {
            setIsSubmitting(false);
        }
    };

    const availableStxFormatted = useMemo(() => formatStxAmount(stxBalance), [stxBalance]);
    const canSubmit = !isSubmitting && !quoteState.loading && !!quoteState.data && connected && !form.formState.errors.stxAmount;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) { // Reset states when dialog closes
                form.reset();
                clearQuote();
            }
        }}>
            <DialogTrigger asChild>
                <Button className={className} variant={variant} size={size} {...buttonProps}>
                    {buttonLabel}
                </Button>
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
                <form onSubmit={form.handleSubmit(handleSwapSubmit)} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="stxAmount">You Pay (STX)</Label>
                            <span className="text-xs text-muted-foreground">
                                Balance: {stxBalanceLoading ? 'Loading...' : availableStxFormatted} STX
                            </span>
                        </div>
                        <Input
                            id="stxAmount"
                            type="number"
                            step="any"
                            placeholder="0.00"
                            {...form.register('stxAmount')}
                            disabled={isSubmitting || quoteState.loading}
                            className="input-field text-lg font-mono"
                        />
                        {form.formState.errors.stxAmount && (
                            <p className="text-sm text-destructive">{form.formState.errors.stxAmount.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center text-muted-foreground">
                        <Coins className="h-5 w-5" />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="chaAmountOut">You Receive (CHA)</Label>
                        <div className="h-[40px] px-3 py-2 text-sm rounded-md border border-input bg-muted/50 flex items-center font-mono min-h-[40px]">
                            {quoteState.loading ? (
                                <span className="flex items-center text-muted-foreground">
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Fetching quote...
                                </span>
                            ) : quoteState.error ? (
                                <span className="text-destructive text-xs">{quoteState.error}</span>
                            ) : quoteState.data ? (
                                <>
                                    ~ {formatStxAmount(String(quoteState.data.amountOut))} CHA
                                    {quoteState.data.minimumReceived !== undefined && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                            (Min: {formatStxAmount(String(quoteState.data.minimumReceived))})
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span className="text-muted-foreground">Enter STX amount</span>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" className="w-full" disabled={!canSubmit}>
                            {isSubmitting
                                ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                : quoteState.loading
                                    ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Getting Quote...</>
                                    : 'Confirm Swap'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}