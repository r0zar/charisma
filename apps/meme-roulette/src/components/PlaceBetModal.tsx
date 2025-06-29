'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Token } from '@/types/spin';
import { useWallet } from '@/contexts/wallet-context';
import { X, Search, Rocket, TrendingUp, Coins, Flame } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from '@/components/ui/sonner';
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// import { Quote } from 'dexterity-sdk'; // Not used, can be removed if truly unused

// CHA Token specific constants - ideally, CHA token info (like decimals) would be more globally available
const CHA_DECIMALS = 6; // Assuming Charisma (CHA) token has 6 decimals
const CHA_SYMBOL = 'CHA'; // Assuming Charisma (CHA) token symbol

interface PlaceBetModalProps {
    isOpen: boolean;
    onClose: () => void;
    tokens: Token[];
}


// Helper to format balance (assuming 6 decimals by default)
const formatBalance = (balance: string, decimals: number = CHA_DECIMALS) => {
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
    const { subnetBalance, subnetBalanceLoading, address, placeBet } = useWallet();
    const [selectedToken, setSelectedToken] = useState<Token | null>(null);
    const [chaAmount, setChaAmount] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'search' | 'details'>('search');

    // Filter out SUBNET tokens, and then apply search term
    const filteredTokens = useMemo(() => {
        if (!tokens || tokens.length === 0) return [];

        // First, get only non-SUBNET tokens
        let displayTokens = tokens.filter(token => token.type !== 'SUBNET');

        // Then, apply search term if present
        if (searchTerm) {
            displayTokens = displayTokens.filter(t =>
                (t.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (t.symbol?.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        return displayTokens;
    }, [tokens, searchTerm]); // Added searchTerm to dependencies

    useEffect(() => {
        if (!isOpen) {
            setSelectedToken(null);
            setChaAmount('');
            setSearchTerm('');
            setIsLoading(false);
            setActiveTab('search');
        }
    }, [isOpen]);

    // Automatically switch to details tab when a token is selected on mobile
    useEffect(() => {
        if (selectedToken && window.innerWidth < 768) {
            setActiveTab('details');
        }
    }, [selectedToken]);

    const handlePlaceBet = async () => {
        if (!selectedToken || !chaAmount) return;

        let amountFloat: number;
        try {
            amountFloat = parseFloat(chaAmount);
        } catch (e) {
            toast.error('Invalid CHA amount. Please enter a valid number.');
            return;
        }

        if (isNaN(amountFloat) || amountFloat <= 0) {
            toast.error('CHA amount must be greater than zero.');
            return;
        }

        const amountInAtomicCHA = BigInt(Math.round(amountFloat * (10 ** CHA_DECIMALS)));
        const availableBalanceAtomic = BigInt(subnetBalance);

        if (amountInAtomicCHA > availableBalanceAtomic) {
            const availableBalanceFormatted = formatBalance(subnetBalance, CHA_DECIMALS);
            const amountNeededFormatted = (amountFloat).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: CHA_DECIMALS });

            toast.error(
                `Insufficient ${CHA_SYMBOL} balance. You have ${availableBalanceFormatted} ${CHA_SYMBOL}, ` +
                `but tried to commit ${amountNeededFormatted} ${CHA_SYMBOL}.`
            );
            return;
        }

        setIsLoading(true);
        try {
            // Sign and queue the bet with both amount and token ID
            const microAmount = Number(amountInAtomicCHA);
            const result = await placeBet(microAmount, selectedToken.id);

            if (!result.success) {
                throw new Error(result.error || 'Failed to place bet');
            }

            toast.success(`Committed ${amountFloat} ${CHA_SYMBOL} to ${selectedToken.symbol}! (UUID: ${result.uuid})`);
            onClose();
        } catch (error: any) {
            console.error("Error committing CHA:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            toast.error(`Failed to commit CHA: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const enteredAmountAtomicCHA = useMemo(() => {
        try {
            // Ensure chaAmount is parsed as float before multiplication
            const amountFloat = parseFloat(chaAmount);
            if (isNaN(amountFloat)) return 0n;
            return BigInt(Math.round(amountFloat * (10 ** CHA_DECIMALS)));
        } catch {
            return 0n;
        }
    }, [chaAmount]);

    const availableBalanceAtomicBigInt = useMemo(() => BigInt(subnetBalance), [subnetBalance]);

    const hasSufficientBalance = enteredAmountAtomicCHA > 0n && enteredAmountAtomicCHA <= availableBalanceAtomicBigInt;

    // Validation message for amount input
    const amountValidationMessage = useMemo(() => {
        if (!chaAmount) return null;
        try {
            const amountFloat = parseFloat(chaAmount);
            if (isNaN(amountFloat)) return "Please enter a valid number.";
            if (amountFloat <= 0) return "Amount must be greater than 0.";

            const enteredAtomic = BigInt(Math.round(amountFloat * (10 ** CHA_DECIMALS)));
            if (enteredAtomic > availableBalanceAtomicBigInt) {
                return "Insufficient balance.";
            }
        } catch {
            return "Invalid number format.";
        }
        return null;
    }, [chaAmount, availableBalanceAtomicBigInt]);

    const canPlaceBet =
        selectedToken &&
        enteredAmountAtomicCHA > 0n && // Ensures positive amount after conversion
        hasSufficientBalance &&
        !isLoading &&
        !subnetBalanceLoading &&
        !amountValidationMessage; // Add check for validation message

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="sm:max-w-[425px] md:max-w-[600px] lg:max-w-[800px] p-0 overflow-hidden max-h-[95vh] bg-card/95 backdrop-blur-md border-primary/20">
                <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 bg-gradient-to-b from-card to-transparent">
                    <DialogTitle className="text-lg sm:text-xl md:text-2xl font-display tracking-tight flex items-center gap-2">
                        <Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-primary animate-float" />
                        Commit to Pump a Token
                    </DialogTitle>
                    <DialogDescription className="text-sm md:text-base opacity-90">
                        Search for and select the memecoin you want to commit CHA to.
                    </DialogDescription>
                </DialogHeader>

                {/* Mobile Tab Buttons */}
                <div className="flex border-b border-border/30 md:hidden">
                    <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium ${activeTab === 'search' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                        onClick={() => setActiveTab('search')}
                    >
                        Find Token
                    </button>
                    <button
                        type="button"
                        className={`flex-1 py-2 text-sm font-medium ${activeTab === 'details' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                        onClick={() => setActiveTab('details')}
                        disabled={!selectedToken}
                    >
                        Details
                    </button>
                </div>

                <div className="flex flex-col md:grid md:grid-cols-2 md:gap-6 px-3 sm:px-4 md:px-6 pb-3 sm:pb-4 overflow-hidden max-h-[calc(95vh-12rem)]">
                    {/* Token Search Section - Hidden on mobile when details tab is active */}
                    <div className={`flex flex-col gap-3 sm:gap-4 overflow-hidden ${activeTab === 'details' ? 'hidden md:flex' : 'flex'}`}>
                        <div className="relative my-3 sm:my-4 md:my-2">
                            <Input
                                type="text"
                                placeholder="Search token name or symbol..."
                                value={searchTerm}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                className="pl-10 input-field"
                            />
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                        <ScrollArea className="h-[35vh] sm:h-[40vh] md:h-[350px] border-0 md:border border-border/50 rounded-none md:rounded-xl bg-background/30 md:glass-card overflow-y-auto">
                            <div className="p-3 sm:p-4 space-y-1">
                                {filteredTokens.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No tokens found.</p>}
                                {filteredTokens.map((token: Token) => (
                                    <button
                                        key={token.id}
                                        onClick={() => setSelectedToken(token)}
                                        className={`w-full p-3 rounded-lg transition-all duration-200 border-0 ${selectedToken?.id === token.id
                                            ? 'bg-primary/10 border-primary/30'
                                            : 'bg-background/50 hover:bg-background/80'
                                            }`}
                                        type="button"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-shrink-0">
                                                <Image
                                                    src={token.imageUrl}
                                                    alt={token.name}
                                                    width={32}
                                                    height={32}
                                                    className="rounded-full object-cover h-8 w-8"
                                                    onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                                />
                                                {token.type === 'SUBNET' && (
                                                    <TooltipProvider delayDuration={100}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="absolute -top-1 -right-1 bg-red-500 p-0.5 rounded-full shadow-md">
                                                                    <Flame className="h-3 w-3 text-white" />
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-background border-primary/30 shadow-xl rounded-md text-foreground p-2">
                                                                <p className="text-xs font-medium">Subnet Token</p>
                                                                <p className="text-xs text-muted-foreground">This token operates on a subnet for enhanced performance.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                            <div className="flex-grow min-w-0 text-left">
                                                <div className="font-medium font-display truncate">{token.name}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{token.symbol}</div>
                                            </div>
                                            {selectedToken?.id === token.id && (
                                                <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Token Details Section - Hidden on mobile when search tab is active */}
                    <div className={`flex flex-col gap-3 sm:gap-4 overflow-auto ${activeTab === 'search' ? 'hidden md:flex' : 'flex'}`}>
                        {selectedToken ? (
                            <div className="bg-background/30 md:glass-card p-4 md:p-5 flex flex-col gap-4 my-3 sm:my-4 md:my-2 border-0 md:border md:rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-shrink-0">
                                        <Image
                                            src={selectedToken.imageUrl}
                                            alt={selectedToken.name}
                                            width={48}
                                            height={48}
                                            className="rounded-full object-cover h-10 w-10 md:h-12 md:w-12 border-2 border-primary/30"
                                            onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                        />
                                        {selectedToken.type === 'SUBNET' && (
                                            <TooltipProvider delayDuration={100}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="absolute -top-1 -right-1 bg-red-500 p-1 rounded-full shadow-md">
                                                            <Flame className="h-3.5 w-3.5 text-white" />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-background border-primary/30 shadow-xl rounded-md text-foreground p-2">
                                                        <p className="text-xs font-medium">Subnet Token</p>
                                                        <p className="text-xs text-muted-foreground">This token operates on a subnet for enhanced performance.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center text-xs font-bold shadow-md">
                                            <TrendingUp className="h-3 w-3" />
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-lg md:text-xl font-display font-semibold truncate">{selectedToken.name}</h3>
                                        <p className="text-sm font-mono text-primary">{selectedToken.symbol}</p>
                                    </div>
                                    <div className="ml-auto md:hidden">
                                        <Button variant="ghost" size="icon" onClick={() => setActiveTab('search')}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="hidden ml-auto md:block">
                                        <DialogClose asChild>
                                            <Button variant="ghost" size="icon" onClick={() => setSelectedToken(null)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </DialogClose>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="chaAmountInput" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                                            <Coins className="h-4 w-4" /> Amount to Commit ({CHA_SYMBOL})
                                        </Label>
                                        <Input
                                            id="chaAmountInput"
                                            type="number"
                                            placeholder={`Enter ${CHA_SYMBOL} amount (e.g., 100)`}
                                            value={chaAmount}
                                            onChange={(e) => setChaAmount(e.target.value)}
                                            className="input-field text-base h-12"
                                            disabled={isLoading || subnetBalanceLoading}
                                            min="0"
                                        />
                                        {amountValidationMessage && (
                                            <p className="text-xs text-red-500 mt-2">{amountValidationMessage}</p>
                                        )}
                                    </div>

                                    <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
                                        Available to commit: {' '}
                                        <span className={`font-medium ${subnetBalanceLoading ? 'opacity-50' : 'text-primary'}`}>
                                            {subnetBalanceLoading ? 'Loading...' : `${formatBalance(subnetBalance, CHA_DECIMALS)} ${CHA_SYMBOL}`}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg border border-border/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Your commitment:</span>
                                        <span className="font-mono text-primary font-bold">{chaAmount || '0'} CHA</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Token:</span>
                                        <span className="font-mono text-foreground">{selectedToken.symbol}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-background/20 md:glass-card flex flex-col items-center justify-center h-[40vh] md:h-full py-12 px-4 my-4 md:my-2 border-0 md:border md:rounded-xl">
                                <div className="text-primary/30 mb-4">
                                    <Rocket size={48} />
                                </div>
                                <p className="text-muted-foreground text-center">Select a token from the list to commit CHA</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-3 sm:p-4 border-t border-border/30 bg-background/50">
                    <Button
                        type="button"
                        onClick={handlePlaceBet}
                        disabled={!canPlaceBet}
                        className={`button-primary w-full py-3 md:py-4 text-base md:text-lg ${!canPlaceBet ? '' : 'animate-pulse-medium'}`}
                    >
                        {isLoading ? 'Committing...' : `Commit ${chaAmount || '0'} CHA`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PlaceBetModal;
