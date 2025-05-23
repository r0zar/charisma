'use client'; // Mark as client component

import React, { useState, useEffect, useMemo } from 'react';
import Footer from './Footer';
import MobileNav from './MobileNav';
import { useSpinFeed } from '@/hooks/useSpinFeed';
import { useWallet } from '@/contexts/wallet-context';
import VoteModal from '@/components/VoteModal';
import { Button } from '@/components/ui/button';
import { Rocket, LogOut, Menu } from 'lucide-react';
import Link from 'next/link';
import FirstVisitPopup from '@/components/FirstVisitPopup';
import { listTokens } from 'dexterity-sdk'; // Import server action
import type { Token as SpinToken } from '@/types/spin'; // Import the type expected by VoteModal
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';

// Helper to truncate Stacks address
const truncateAddress = (address: string, length = 4) => {
    if (!address) return "";
    if (address.length <= length * 2 + 3) return address;
    return `${address.substring(0, length)}...${address.substring(address.length - length)}`;
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
            // Basic formatting, consider libraries like `bignumber.js` for more complex needs
            return `${integerPart.toLocaleString()}.${fractionalStr}`;
        }
    } catch {
        return '0'; // Fallback for invalid input
    }
};

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const spinFeed = useSpinFeed();
    const {
        address,
        connected,
        connectWallet,
        disconnectWallet,
        isConnecting,
        mainnetBalance,
        subnetBalance,
        balanceLoading,
        subnetBalanceLoading,
    } = useWallet();

    // State for token list fetched from server action
    const [dexTokens, setDexTokens] = useState<SpinToken[]>([]);
    const [loadingTokens, setLoadingTokens] = useState(true);

    // State for managing the modal
    const [isBetModalOpen, setIsBetModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleOpenBetModal = () => {
        setIsBetModalOpen(true);
    };

    // Fetch tokens on mount
    useEffect(() => {
        async function loadTokens() {
            console.log("[AppShell] Fetching token list from server action...");
            setLoadingTokens(true);
            try {
                const result = await listTokens();
                if (result) {
                    console.log(`[AppShell] Received ${result.length} tokens from action.`);

                    // Map dexterity-sdk Token to SpinToken
                    const mappedTokens: SpinToken[] = result.map((token: any) => ({
                        type: token.type,
                        base: token.base,
                        id: token.contractId, // Use contractId as id
                        contractId: token.contractId,
                        name: token.name,
                        symbol: token.symbol,
                        decimals: token.decimals,
                        imageUrl: token.image || '/placeholder-token.png', // Use image or fallback
                        userBalance: 0, // Default userBalance, needs separate fetching logic if required
                    }));

                    setDexTokens(mappedTokens);
                    console.log("[AppShell] Mapped tokens set in state:", mappedTokens);
                } else {
                    console.error("[AppShell] Failed to list tokens:", result);
                    setDexTokens([]); // Set empty on error
                }
            } catch (err) {
                console.error("[AppShell] Error calling listTokens action:", err);
                setDexTokens([]); // Set empty on error
            } finally {
                setLoadingTokens(false);
            }
        }
        loadTokens();
    }, []); // Run once on mount

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-200">
            {/* Connection status LED (small circle) */}
            {/* We place it with the logo for subtlety */}
            <header className="py-3 px-2 sm:py-4 sm:px-4 border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
                <div className="container mx-auto flex items-center justify-between">
                    {/* Logo and title */}
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Rocket className="text-primary h-5 w-5 animate-float" aria-hidden="true" />
                            <span className="font-display font-bold text-base sm:text-lg">Meme Roulette</span>
                        </Link>
                        {/* LED indicator */}
                        <span
                            className={
                                `ml-2 h-2.5 w-2.5 rounded-full border border-background/70 ` +
                                (spinFeed.isConnected ? 'bg-emerald-500' : 'bg-red-500 animate-pulse')
                            }
                            title={spinFeed.isConnected ? 'Connected' : 'Disconnected'}
                        />
                    </div>

                    {/* Center nav links - could add more here */}
                    <nav className="hidden md:flex gap-6">
                        <Link href="/" className="text-foreground/80 hover:text-primary transition-colors">Home</Link>
                        <Link href="/about" className="text-foreground/80 hover:text-primary transition-colors">About</Link>
                        <Link href="/leaderboard" className="text-foreground/80 hover:text-primary transition-colors">Leaderboard</Link>
                    </nav>

                    {/* User Info & Actions Panel */}
                    <div className="flex items-center gap-2">
                        {connected ? (
                            // --- Logged In State ---
                            <div className="hidden sm:flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/30 shadow-sm">
                                {/* Balance Section */}
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="cursor-help px-2">
                                                <div className="flex flex-col items-end">
                                                    <p className="text-xs text-muted-foreground">Subnet Balance</p>
                                                    <p className="font-display font-bold text-primary">
                                                        <span className="font-mono numeric">
                                                            {subnetBalanceLoading ? '...' : formatBalance(subnetBalance)}
                                                        </span>{' '}
                                                        <span className="text-xs">CHA</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="end">
                                            <div className="text-sm space-y-1">
                                                <p>
                                                    <span className="font-medium">Mainnet CHA:</span> <span className="font-mono numeric">
                                                        {balanceLoading ? '...' : formatBalance(mainnetBalance)}
                                                    </span>
                                                </p>
                                                <p>
                                                    <span className="font-medium">Subnet CHA:</span> <span className="font-mono numeric">
                                                        {subnetBalanceLoading ? '...' : formatBalance(subnetBalance)}
                                                    </span>
                                                </p>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {/* Vertical Separator */}
                                <div className="h-10 w-px bg-border/50 mx-1"></div>

                                {/* Info & Actions Row */}
                                <div className="flex items-center gap-2">
                                    {/* Connected Address */}
                                    {address && (
                                        <div className="flex items-center text-xs rounded-md bg-background/50">
                                            <span className="text-muted-foreground mr-1 pl-2">Wallet:</span>
                                            <span className="font-mono font-medium" title={address}>{truncateAddress(address)}</span>
                                            {/* Subtle Sign Out Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 ml-1 text-muted-foreground hover:text-destructive/80"
                                                onClick={disconnectWallet}
                                                title="Sign Out"
                                            >
                                                <LogOut className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                    {/* Action Buttons */}
                                    <DepositCharismaButton size="sm" variant="ghost" className="text-xs h-7" />
                                    <SwapStxToChaButton size="sm" variant="ghost" buttonLabel="Load up CHA" className="text-xs h-7" />
                                </div>
                            </div>
                        ) : null}

                        {/* Desktop-only Connect Button when not connected */}
                        {!connected && (
                            <Button
                                onClick={connectWallet}
                                disabled={isConnecting}
                                size="sm"
                                className="hidden sm:block"
                            >
                                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto px-0 py-4 pb-[calc(var(--mobile-nav-height,65px)+1rem)] sm:px-4 sm:py-8 sm:pb-8">
                {children}
            </main>

            <Footer />

            {/* Mobile navigation */}
            <MobileNav />

            {/* Modals and popups */}
            <VoteModal
                isOpen={isBetModalOpen}
                onClose={() => setIsBetModalOpen(false)}
                tokens={dexTokens}
            />

            <FirstVisitPopup />

            {/* Apply CSS variable for mobile nav height */}
            <style jsx global>{`
                :root {
                    --mobile-nav-height: 65px;
                }
            `}</style>
        </div>
    );
};

export default AppShell;
