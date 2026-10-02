'use client'; // Mark as client component

import React, { useState, useEffect } from 'react';
import Footer from './Footer';
import MobileNav from './MobileNav';
import { useSpinFeed } from '@/hooks/useSpinFeed';
import { useWallet } from '@/contexts/wallet-context';
import VoteModal from '@/components/VoteModal';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import FirstVisitPopup from '@/components/FirstVisitPopup';
import { PendingReferralIndicator } from '@/components/ui/PendingReferralIndicator';
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
import { ThemeToggle } from '@repo/brand/react';

const NAV = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/referrals', label: 'Referrals' },
];

// ghost buttons on the chrome bar: the bar's own ink, not the page's
const CHROME_GHOST = 'h-7 text-xs text-on-chrome-muted hover:bg-on-chrome/10 hover:text-on-chrome';

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
        <div className="flex min-h-screen flex-col">
            {/* Connection status LED (small circle) */}
            {/* We place it with the logo for subtlety */}
            <header className="sticky top-0 z-30 border-b border-line bg-chrome px-2 py-3 text-on-chrome sm:px-4 sm:py-4">
                <div className="container mx-auto flex items-center justify-between">
                    {/* Lockup: the crest, the game, and who makes it */}
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                            <span className="text-base font-bold tracking-tight sm:text-lg">
                                Meme Roulette <span className="hidden text-sm font-medium text-on-chrome-muted sm:inline">by Charisma</span>
                            </span>
                        </Link>
                        {/* LED indicator */}
                        <span
                            className={
                                `ml-2 h-2.5 w-2.5 rounded-full ` +
                                (spinFeed.isConnected ? 'bg-success' : 'bg-danger animate-pulse')
                            }
                            title={spinFeed.isConnected ? 'Connected' : 'Disconnected'}
                        />
                    </div>

                    <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
                        {NAV.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome"
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>

                    {/* User Info & Actions Panel */}
                    <div className="flex items-center gap-2">
                        <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome" />
                        {connected ? (
                            // --- Logged In State ---
                            <div className="hidden items-center gap-3 rounded-lg border border-on-chrome-muted/20 bg-on-chrome/5 p-2 sm:flex">
                                {/* Balance Section */}
                                <TooltipProvider delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="cursor-help px-2">
                                                <div className="flex flex-col items-end">
                                                    <p className="text-xs text-on-chrome-muted">Subnet balance</p>
                                                    <p className="font-bold text-chrome-accent">
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
                                <div className="mx-1 h-10 w-px bg-on-chrome-muted/20"></div>

                                {/* Info & Actions Row */}
                                <div className="flex items-center gap-2">
                                    {/* Connected Address */}
                                    {address && (
                                        <div className="flex items-center rounded-md text-xs">
                                            <span className="mr-1 pl-2 text-on-chrome-muted">Wallet:</span>
                                            <span className="font-mono font-medium" title={address}>{truncateAddress(address)}</span>
                                            {/* Subtle Sign Out Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="ml-1 h-6 w-6 text-on-chrome-muted hover:bg-on-chrome/10 hover:text-danger"
                                                onClick={disconnectWallet}
                                                title="Sign out"
                                            >
                                                <LogOut className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    )}
                                    {/* Action Buttons */}
                                    <DepositCharismaButton size="sm" variant="ghost" className={CHROME_GHOST} />
                                    <SwapStxToChaButton size="sm" variant="ghost" buttonLabel="Load up CHA" className={CHROME_GHOST} />
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
                                {isConnecting ? 'Connecting...' : 'Connect wallet'}
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

            {/* Referral code indicator */}
            <PendingReferralIndicator />

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
