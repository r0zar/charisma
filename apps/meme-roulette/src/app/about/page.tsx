'use client';

import React from 'react';
import { InstructionsOverlayContent } from '@/components/InstructionsOverlay';

export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto py-12">
            <div className="glass-card p-8 rounded-xl">
                <h1 className="text-4xl font-bold mb-8 text-center font-display">About Meme Roulette</h1>
                <InstructionsOverlayContent />

                <div className="mt-12 border-t border-border pt-8">
                    <h2 className="text-2xl font-bold mb-4 font-display">How It Works</h2>
                    <p className="mb-4">
                        Meme Roulette is a collective experiment in coordinated token purchases.
                        By pooling our CHA together, we create a meaningful market impact when the
                        purchase is executed.
                    </p>
                    <p className="mb-8">
                        Each round runs for a fixed period during which participants commit their CHA
                        to their preferred tokens. When the timer ends, one token is selected with
                        probability weighted by the amount of CHA committed to each token.
                    </p>

                    <h2 className="text-2xl font-bold mb-4 font-display">FAQs</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-primary">Is this financial advice?</h3>
                            <p>No. Meme Roulette is an experimental project and does not constitute financial advice.</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-primary">Can I withdraw my CHA after committing?</h3>
                            <p>Once CHA is committed to a round, it cannot be withdrawn until after the round completes.</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-primary">How are tokens selected?</h3>
                            <p>Tokens are selected based on weighted probability. The more CHA committed to a token, the higher its chance of being selected for the collective purchase.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 