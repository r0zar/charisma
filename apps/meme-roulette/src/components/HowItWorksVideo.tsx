'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

/** A quiet "How does this work?" link that plays the explainer in a lightbox. */
export function HowItWorksVideo() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="group inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
            >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line transition-colors group-hover:border-accent-line group-hover:text-accent-text">
                    <Play className="h-2.5 w-2.5 translate-x-px fill-current" />
                </span>
                How does this work?
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="gap-3 bg-surface-raised p-3 sm:max-w-4xl sm:p-4">
                    <DialogTitle className="pr-8 text-base">How Meme Roulette works</DialogTitle>
                    <DialogDescription className="sr-only">A 27-second video: back a meme, the wheel spins, the whole pot buys the winner.</DialogDescription>
                    {/* mounted only while open, so closing the lightbox stops it */}
                    <video
                        src="/how-it-works.mp4"
                        poster="/how-it-works.jpg"
                        controls
                        autoPlay
                        playsInline
                        preload="metadata"
                        className="aspect-video w-full rounded-lg bg-chrome"
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
