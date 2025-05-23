'use client';

import React from 'react';
import { InstructionsOverlayContent } from '@/components/InstructionsOverlay';
import { Github } from 'lucide-react';

export default function AboutPage() {
    return (
        <div className="w-full max-w-none sm:max-w-4xl mx-auto py-0 sm:py-12">
            {/* Main About Section */}
            <div className="bg-background/50 md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h1 className="text-2xl sm:text-4xl font-bold mb-6 sm:mb-8 text-center font-display">About Meme Roulette</h1>
                <InstructionsOverlayContent />
            </div>

            {/* How It Works Section */}
            <div className="bg-background/30 md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 font-display">How It Works</h2>
                <p className="mb-4">
                    Meme Roulette is a collective experiment in coordinated token purchases.
                    By pooling our CHA together, we create a meaningful market impact when the
                    purchase is executed.
                </p>
                <p className="mb-6 sm:mb-8">
                    Each round runs for a fixed period during which participants commit their CHA
                    to their preferred tokens. When the timer ends, one token is selected with
                    probability weighted by the amount of CHA committed to each token.
                </p>
            </div>

            {/* FAQs Section */}
            <div className="bg-background/40 md:glass-card px-4 py-6 md:p-8 border-b border-border/20 md:border md:rounded-xl">
                <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 font-display">FAQs</h2>
                <div className="space-y-3 sm:space-y-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-primary">Is this financial advice?</h3>
                        <p>No. Meme Roulette is an experimental project and does not constitute financial advice.</p>
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-primary">Can I withdraw my CHA after committing?</h3>
                        <p>Once CHA is committed to a round, it cannot be withdrawn until after the round completes.</p>
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-primary">How are tokens selected?</h3>
                        <p>Tokens are selected based on weighted probability. The more CHA committed to a token, the higher its chance of being selected for the collective purchase.</p>
                    </div>
                </div>
            </div>

            {/* Footer Content Section */}
            <div className="bg-background/20 md:glass-card px-4 py-6 md:p-8 md:border md:rounded-xl text-center text-sm text-muted-foreground space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p>© {new Date().getFullYear()} Charisma. All rights reserved.</p>
                    <p className="italic">Note: This app is purely for entertainment purposes only.</p>
                    <a
                        href="https://github.com/r0zar/charisma"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        <span>View Source</span>
                    </a>
                </div>
            </div>
        </div>
    );
} 