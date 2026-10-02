'use client'; // Mark as client component

import React from 'react';
import Footer from './Footer';
import MobileNav from './MobileNav';
import { useRound } from '@/hooks/useRound';
import Link from 'next/link';
import FirstVisitPopup from '@/components/FirstVisitPopup';
import { PendingReferralIndicator } from '@/components/ui/PendingReferralIndicator';
import { ThemeToggle } from '@repo/brand/react';
import { WalletMenu } from './WalletMenu';

const NAV = [
    { href: '/', label: 'Play' },
    { href: '/about', label: 'How it works' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/referrals', label: 'Referrals' },
];

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { error: roundError, payload } = useRound();
    const online = !!payload && !roundError;

    return (
        <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-30 border-b border-line bg-chrome px-2 py-3 text-on-chrome sm:px-4 sm:py-4">
                <div className="container mx-auto flex items-center justify-between">
                    {/* Lockup: the crest, the game, and who makes it */}
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
                            <span className="text-base font-bold tracking-tight sm:text-lg">
                                Meme Roulette <span className="hidden text-sm font-medium text-on-chrome-muted xl:inline">by Charisma</span>
                            </span>
                        </Link>
                        {/* LED indicator */}
                        <span
                            className={
                                `ml-2 h-2.5 w-2.5 rounded-full ` +
                                (online ? 'bg-success' : 'bg-danger animate-pulse')
                            }
                            title={online ? 'Live' : 'Reconnecting to the game'}
                        />
                    </div>

                    <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
                        {NAV.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className="rounded-xl px-3 py-2 text-sm font-semibold text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome xl:px-4"
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-chrome-muted transition-all duration-200 hover:bg-on-chrome/10 hover:text-on-chrome" />
                        <WalletMenu />
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto px-0 py-4 pb-[calc(var(--mobile-nav-height,65px)+1rem)] sm:px-4 sm:py-8 lg:pb-8">
                {children}
            </main>

            <Footer />

            {/* Mobile navigation */}
            <MobileNav />

            {/* Modals and popups */}
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
