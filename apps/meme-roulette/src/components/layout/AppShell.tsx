'use client'; // Mark as client component

import React, { useState, useEffect, useMemo } from 'react';
import Footer from './Footer';
import { useSpinFeed } from '@/hooks/useSpinFeed';
import { useSpin } from '@/contexts/SpinContext';
import PlaceBetModal from '@/components/PlaceBetModal';
import { Button } from '@/components/ui/button';
import DevControls from '@/components/DevControls';
import { Rocket } from 'lucide-react';
import Link from 'next/link';

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const spinFeed = useSpinFeed();
    const spinContext = useSpin();

    // State for managing the modal
    const [isBetModalOpen, setIsBetModalOpen] = useState(false);

    const handleOpenBetModal = () => {
        setIsBetModalOpen(true);
    };

    // Determine if dev controls should be rendered and have setters
    const isDevelopment = process.env.NODE_ENV === 'development';
    const hasDevSetters = isDevelopment && '_devSetIsConnected' in spinFeed && '_devSetMyChaBalance' in spinContext.actions;

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-200">
            {/* Simple Inline Offline Banner */}
            {!spinFeed.isConnected && (
                <div className="bg-destructive text-destructive-foreground p-2 text-center text-sm fixed top-0 left-0 right-0 z-50 animate-pulse">
                    Connection lost. Attempting to reconnect... {spinFeed.error && `(${spinFeed.error.message})`}
                </div>
            )}

            {/* Header with navigation and balance */}
            <header className="py-4 px-4 border-b border-border/30 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
                <div className="container mx-auto flex items-center justify-between">
                    {/* Logo and title */}
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                            <Rocket className="text-primary h-5 w-5 animate-float" />
                            <span className="font-display font-bold text-lg">Meme Roulette</span>
                        </Link>
                    </div>

                    {/* Center nav links - could add more here */}
                    <nav className="hidden md:flex gap-6">
                        <Link href="/" className="text-foreground/80 hover:text-primary transition-colors">Home</Link>
                        <Link href="#" className="text-foreground/80 hover:text-primary transition-colors">About</Link>
                    </nav>

                    {/* User balance and actions */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-muted/40 border border-primary/20">
                            <div className="flex flex-col items-end">
                                <p className="text-xs text-muted-foreground">Balance</p>
                                <p className="font-display font-bold text-primary">
                                    <span className="font-mono numeric">{spinContext.state.myChaBalance?.toLocaleString() ?? '...'}</span> <span className="text-xs">CHA</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-grow container mx-auto px-4 py-8">
                {children}
            </main>

            <Footer />

            {/* Render the modal */}
            <PlaceBetModal
                isOpen={isBetModalOpen}
                onClose={() => setIsBetModalOpen(false)}
                tokens={spinContext.state.tokenList}
            />

            {/* Conditionally render Dev Controls */}
            {isDevelopment && hasDevSetters && (
                <DevControls
                    isConnected={spinFeed.isConnected}
                    // Type assertion needed because TS doesn't narrow based on 'in' check across hooks
                    setIsConnected={(spinFeed as any)._devSetIsConnected}
                    data={spinFeed.data}
                    chaBalance={spinContext.state.myChaBalance}
                    setChaBalance={(spinContext.actions as any)._devSetMyChaBalance}
                    tokenList={spinContext.state.tokenList}
                />
            )}
        </div>
    );
};

export default AppShell;
