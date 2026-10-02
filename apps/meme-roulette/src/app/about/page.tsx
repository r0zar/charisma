'use client';

import React from 'react';
import { HowItWorks } from '@/components/HowItWorks';
import { Github } from 'lucide-react';

export default function AboutPage() {
    return (
        <div className="w-full max-w-none sm:max-w-4xl mx-auto py-0 sm:py-12">
            {/* Main About Section */}
            <div className="bg-surface md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h1 className="text-2xl sm:text-4xl font-bold mb-6 sm:mb-8 text-center font-display">About Meme Roulette</h1>
                <HowItWorks />
            </div>

            {/* How It Works Section */}
            <div className="bg-surface md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 font-display">Fair by design</h2>
                <p className="mb-4">
                    Each round publishes a sealed seed before anyone bets. When betting closes, the seed is mixed with the hash of the
                    first Stacks block mined after the deadline, which nobody can know in advance. That picks a ticket in the pot, and
                    the meme holding that ticket wins: the bigger a meme's stake, the more tickets it holds.
                </p>
                <p className="mb-6 sm:mb-8">
                    Every finished round links to its full record (seed, block, stakes, ticket), so anyone can check the result.
                    Every screen plays the same spin from that record.
                </p>
            </div>

            {/* FAQs Section */}
            <div className="bg-surface md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 font-display">FAQs</h2>
                <div className="space-y-3 sm:space-y-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-accent-text">Is this financial advice?</h3>
                        <p>No. Meme Roulette is an experimental project and does not constitute financial advice.</p>
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-accent-text">Is my CHA locked when I back a meme?</h3>
                        <p>No. Your CHA stays in your subnet balance until the draw. A bet only counts if your balance still covers it when the wheel spins.</p>
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-accent-text">How is the winner picked?</h3>
                        <p>By stake. Each micro-CHA in the pot is one ticket, so a meme with 30% of the pot has a 30% chance.</p>
                    </div>
                </div>
            </div>

            {/* Footer Content Section */}
            <div className="bg-surface md:glass-card px-4 py-6 md:p-8 md:border md:rounded-xl text-center text-sm text-muted-foreground space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p>© {new Date().getFullYear()} Charisma. All rights reserved.</p>
                    <p className="italic">Note: This app is purely for entertainment purposes only.</p>
                    <a
                        href="https://github.com/r0zar/charisma"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-muted-foreground hover:text-accent-text transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        <span>View Source</span>
                    </a>
                </div>
            </div>
        </div>
    );
} 