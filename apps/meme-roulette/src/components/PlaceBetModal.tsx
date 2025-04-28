'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Token, Vote } from '@/types/spin';
import { useWallet } from '@/contexts/wallet-context';
import { useSpin } from '@/contexts/SpinContext';
import { X, Search, Rocket, TrendingUp } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/components/ui/sonner';
import { Label } from "@/components/ui/label";
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';
import { z } from 'zod';
import { buttonVariants } from '@/components/ui/button';

interface PlaceBetModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
}

// Helper to format balance (assuming 6 decimals by default)
const formatBalance = (balance: string, decimals: number = 6) => {
    try {
        const num = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        const integerPart = num / divisor;
        const fractionalPart = num % divisor;

        if (fractionalPart === 0n) {
            return integerPart.toLocaleString(); // Format whole number
        } else {
            // Pad fractional part, format integer, combine
            const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
            return `${integerPart.toLocaleString()}.${fractionalStr}`;
        }
    } catch {
        return '0'; // Fallback for invalid input
    }
};

const PlaceBetModal = ({ isOpen, onClose, tokens }: PlaceBetModalProps) => {
    const { subnetBalance, subnetBalanceLoading, address } = useWallet();
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [chaAmount, setChaAmount] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    // Derive availableTokens directly from props
    const availableTokens = tokens || [];

    // Derive filteredTokens directly based on searchTerm and availableTokens
    const filteredTokens = searchTerm
        ? availableTokens.filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : availableTokens;

    useEffect(() => {
        if (!isOpen) {
            setSelectedToken(null);
            setChaAmount('');
            setSearchTerm('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const handlePlaceBet = async () => {
        if (!selectedToken || !chaAmount) return;

        const amount = parseFloat(chaAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid CHA amount entered.');
            return;
        }

        // Check if user has enough balance (using BigInt for precision)
        const amountInMicroCha = BigInt(Math.round(amount * 1_000_000)); // Assuming 6 decimals for CHA
        const availableBalance = BigInt(subnetBalance);

        if (amountInMicroCha > availableBalance) {
            toast.error(
                `Insufficient balance. You have ${availableBalance.toLocaleString()} CHA, ` +
                `but need ${amountInMicroCha.toLocaleString()} CHA.`
            );
            return;
        }

        setIsLoading(true);
        try {
            // Use wallet address as the userId, or a fallback for testing
            const userId = address || `anonymous_${Math.floor(Math.random() * 10000)}`;

            const response = await fetch('/api/place-bet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tokenId: selectedToken.id,
                    chaAmount: amount,
                    userId
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success(`Successfully committed ${amount} CHA to ${selectedToken.symbol}!`);

                onClose();
            } else {
                throw new Error(result.error || 'Failed to place bet');
            }

        } catch (error: any) {
            console.error("Error committing CHA:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            toast.error(`Failed to commit CHA: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const enteredAmountMicroCha = useMemo(() => {
        try {
            return BigInt(Math.round(parseFloat(chaAmount) * 1_000_000));
        } catch {
            return 0n;
        }
    }, [chaAmount]);

    const availableBalanceBigInt = useMemo(() => BigInt(subnetBalance), [subnetBalance]);

    const hasSufficientBalance = enteredAmountMicroCha > 0n && enteredAmountMicroCha <= availableBalanceBigInt;

    const canPlaceBet =
        selectedToken &&
        enteredAmountMicroCha > 0n &&
        hasSufficientBalance &&
        !isLoading &&
        !subnetBalanceLoading;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] p-0 max-h-[90vh] bg-card/95 backdrop-blur-md border-primary/20">
                <DialogHeader className="p-6 pb-4 bg-gradient-to-b from-card to-transparent">
                    <DialogTitle className="text-2xl font-display tracking-tight flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary animate-float" />
                        Commit to Pump a Token
                    </DialogTitle>
                    <DialogDescription className="text-base opacity-90">
                        Search for and select the memecoin you want to commit CHA to. Then enter the amount of CHA you wish to commit. Tokens don't leave your wallet until everyone swaps together.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 pb-4 overflow-y-hidden">
                    <div className="flex flex-col gap-4 overflow-y-hidden">
                        <div className="relative m-2">
                            <Input
                                type="text"
                                placeholder="Search token name or symbol..."
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                className="pl-10 input-field"
                            />
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <ScrollArea className="h-[400px] border border-border/50 rounded-xl glass-card m-2">
                            <div className="p-4 space-y-2">
                                {filteredTokens.length === 0 && <p className="text-sm text-muted-foreground text-center">No tokens found.</p>}
                                {filteredTokens.map((token) => (
                                    <button
                                        key={token.id}
                                        onClick={() => setSelectedToken(token)}
                                        className={`token-select w-full ${selectedToken?.id === token.id ? 'selected' : ''}`}
                                        type="button"
                                    >
                                        <Image
                                            src={token.imageUrl}
                                            alt={token.name}
                                            width={32}
                                            height={32}
                                            className="rounded-full object-cover h-8 w-8"
                                            onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                        />
                                        <div className="flex-grow min-w-0">
                                            <div className="font-medium font-display truncate">{token.name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{token.symbol}</div>
                                        </div>
                                        {selectedToken?.id === token.id && (
                                            <TrendingUp className="h-4 w-4 text-primary ml-2" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="flex flex-col justify-between gap-4">
                        {selectedToken ? (
                            <div className="glass-card p-5 flex flex-col gap-4 m-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Image
                                            src={selectedToken.imageUrl}
                                            alt={selectedToken.name}
                                            width={48}
                                            height={48}
                                            className="rounded-full object-cover h-12 w-12 border-2 border-primary/30"
                                            onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                        />
                                        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                            <TrendingUp className="h-3 w-3" />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-display font-semibold">{selectedToken.name}</h3>
                                        <p className="text-sm font-mono text-primary">{selectedToken.symbol}</p>
                                    </div>
                                    <DialogClose asChild className="ml-auto">
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedToken(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </DialogClose>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cha-amount" className="text-sm font-medium font-display flex items-center">
                                        CHA to Commit
                                        <span className="ml-1 text-xs text-muted-foreground">(increases your odds)</span>
                                    </Label>
                                    <Input
                                        id="cha-amount"
                                        aria-describedby="cha-balance-hint"
                                        type="number"
                                        placeholder="Enter CHA amount to commit"
                                        value={chaAmount}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChaAmount(e.target.value)}
                                        min="0"
                                        step="any"
                                        disabled={isLoading}
                                        className="text-lg font-mono input-field numeric"
                                    />
                                    <p id="cha-balance-hint" className="text-xs text-muted-foreground mt-1.5">
                                        Available: {subnetBalanceLoading ? '...' : formatBalance(subnetBalance)} CHA
                                    </p>
                                    {/* Show deposit button if balance is zero */}
                                    {!subnetBalanceLoading && availableBalanceBigInt === 0n && (
                                        <div className="mt-4 border-t border-border/30 pt-4">
                                            <p className="text-sm text-center text-muted-foreground mb-2">
                                                You need CHA to commit.
                                            </p>
                                            <div className="flex gap-2">
                                                <DepositCharismaButton
                                                    className="flex-1"
                                                    size="sm"
                                                    // Close this modal after deposit starts
                                                    onDepositSuccess={() => onClose()}
                                                />
                                                <SwapStxToChaButton
                                                    className="flex-1"
                                                    size="sm"
                                                    onSwapSuccess={() => onClose()} // Close after swap too
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-muted/40 p-3 rounded-lg border border-border/30">
                                    <p className="text-sm flex items-center justify-between">
                                        <span>Your commitment:</span>
                                        <span className="font-mono text-primary numeric">{chaAmount || '0'} CHA</span>
                                    </p>
                                    <p className="text-sm flex items-center justify-between mt-1">
                                        <span>Token:</span>
                                        <span className="font-mono">{selectedToken.symbol}</span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="glass-card flex flex-col items-center justify-center h-full py-12 px-4">
                                <div className="text-primary/30 mb-3">
                                    <Rocket size={48} />
                                </div>
                                <p className="text-muted-foreground text-center">Select a token from the list to commit CHA</p>
                            </div>
                        )}

                        <div className="flex-grow"></div>

                        <Button
                            type="button"
                            onClick={handlePlaceBet}
                            disabled={!canPlaceBet}
                            className={`button-primary w-full mt-auto py-4 text-lg ${!canPlaceBet ? '' : 'animate-pulse-medium'}`}
                        >
                            {isLoading ? 'Committing...' : `Commit ${chaAmount || '0'} CHA`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PlaceBetModal;
