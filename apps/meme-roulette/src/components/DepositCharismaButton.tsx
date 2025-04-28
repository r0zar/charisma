'use client';

import React, { useState } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { request } from '@stacks/connect';
import { noneCV, Pc, uintCV } from '@stacks/transactions';
import { getTokenMetadataCached } from '@repo/tokens';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogTrigger, DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket } from 'lucide-react';

// Helper to format balance
const formatBalance = (balance: string, decimals: number = 6) => {
    try {
        const num = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        const integerPart = num / divisor;
        const fractionalPart = num % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toLocaleString();
        } else {
            // Format with exactly `decimals` fractional digits, removing trailing zeros if needed for display
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
            return `${integerPart.toLocaleString()}.${fractionalStr}`;
        }
    } catch {
        return '0'; // Fallback for invalid input
    }
};

// --- Constants ---
const MAINNET_CHA_CONTRACT_ID =
    process.env.NEXT_PUBLIC_MAINNET_CHA_CONTRACT_ID ||
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

// TODO: Replace with the actual contract principal that receives deposits
const CHARISMA_SUBNET_CONTRACT =
    process.env.NEXT_PUBLIC_CHARISMA_SUBNET_CONTRACT ||
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1'; // Replace this placeholder!

// --- Form Validation Schema ---
const formSchema = z.object({
    amount: z
        .string()
        .min(1, 'Amount is required')
        .refine((val: string) => !isNaN(Number(val)) && Number(val) > 0, {
            message: 'Amount must be a positive number',
        }),
});

type FormValues = z.infer<typeof formSchema>;

// --- Component Props ---
interface DepositCharismaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    buttonLabel?: string;
    onDepositSuccess?: (txId: string) => void;
    onDepositError?: (error: Error) => void;
    asChild?: boolean;
}

// --- Component ---
export function DepositCharismaButton({
    buttonLabel = 'Deposit CHA',
    onDepositSuccess,
    onDepositError,
    className,
    variant,
    size,
    ...buttonProps
}: DepositCharismaButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastTxId, setLastTxId] = useState<string | null>(null);
    const { address, connected, mainnetBalance, balanceLoading } = useWallet();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: '',
        },
    });

    const onSubmit = async (values: FormValues) => {
        if (!connected || !address) {
            toast.error('Wallet not connected', { description: 'Please connect your wallet first.' });
            return;
        }
        if (CHARISMA_SUBNET_CONTRACT.includes('...placeholder')) {
            toast.error('Configuration Error', { description: 'Deposit target contract not configured.' });
            return;
        }

        setIsSubmitting(true);
        setLastTxId(null);

        try {
            const [targetAddress, targetContractName] = CHARISMA_SUBNET_CONTRACT.split('.');
            if (!targetAddress || !targetContractName) {
                throw new Error('Invalid target contract format');
            }

            const tokenMetadata = await getTokenMetadataCached(MAINNET_CHA_CONTRACT_ID);
            const decimals = tokenMetadata.decimals ?? 6;
            const numericAmount = BigInt(Math.round(Number(values.amount) * Math.pow(10, decimals)));

            if (numericAmount <= 0n) {
                throw new Error('Amount must be greater than zero');
            }

            const params = {
                contract: CHARISMA_SUBNET_CONTRACT as any,
                functionName: 'deposit', // Assuming the function is named 'deposit'
                functionArgs: [
                    uintCV(numericAmount),
                    noneCV()
                ] as any,
                postConditions: [
                    Pc.principal(address)
                        .willSendEq(numericAmount)
                        .ft(MAINNET_CHA_CONTRACT_ID as `${string}.${string}`, tokenMetadata.identifier!),
                ],
                network: 'mainnet', // Assuming mainnet
            };

            const result = await request('stx_callContract', params as any);

            // --- Handle Success --- 
            if (result && result.txid) {
                const txId = result.txid;
                setLastTxId(txId);
                toast.success('Deposit Submitted!', {
                    description: `Tx ID: ${txId.substring(0, 10)}...`,
                    action: {
                        label: 'View',
                        onClick: () => window.open(`https://explorer.stacks.co/txid/${txId}?chain=mainnet`, '_blank'),
                    },
                });
                form.reset();
                setIsOpen(false); // Close modal on success
                onDepositSuccess?.(txId);
            } else {
                // Handle cases where the wallet might close without confirming (cancel)
                // or if the request returns an unexpected success shape
                toast.info('Deposit Cancelled or Failed', {
                    description: 'The transaction was not submitted.'
                });
            }

        } catch (error: any) {
            // --- Handle Error/Cancel --- 
            console.error('Error initiating CHA deposit:', error);
            const message = error instanceof Error ? error.message : String(error);
            // Distinguish between actual errors and user cancellation if possible
            if (message.toLowerCase().includes('cancelled') || message.toLowerCase().includes('rejected')) {
                toast.info('Deposit Cancelled');
            } else {
                toast.error('Deposit Failed', { description: message });
            }
            onDepositError?.(error instanceof Error ? error : new Error(message));
        } finally {
            // --- Always run regardless of outcome --- 
            setIsSubmitting(false); // Ensure loading state is always reset
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className={className} variant={variant} size={size} {...buttonProps}>{buttonLabel}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" /> Deposit Mainnet CHA
                    </DialogTitle>
                    <DialogDescription>
                        Enter the amount of mainnet CHA you want to deposit.
                        This will call the `{CHARISMA_SUBNET_CONTRACT.split('.')[1]}` function.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="amount">Amount (CHA)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="any"
                            placeholder="0.00"
                            {...form.register('amount')}
                            disabled={isSubmitting}
                            className="input-field"
                        />
                        {form.formState.errors.amount && (
                            <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
                        )}
                    </div>
                    {/* Display available mainnet balance */}
                    <div className="text-xs text-muted-foreground text-right mt-1">
                        Available Mainnet Balance: {balanceLoading ? 'Loading...' : formatBalance(mainnetBalance)} CHA
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isSubmitting || !connected}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                'Confirm Deposit'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
} 