'use client';

import React, { useEffect, useState } from 'react';
import { InstructionsOverlayContent } from './InstructionsOverlay';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket } from 'lucide-react';

const FIRST_VISIT_KEY = 'meme-roulette-first-visit-seen';

export default function FirstVisitPopup() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Check if this is the first visit
        const hasSeenIntro = localStorage.getItem(FIRST_VISIT_KEY);

        if (!hasSeenIntro) {
            // Show popup after a short delay to allow the page to load
            const timer = setTimeout(() => {
                setOpen(true);
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        // Mark that user has seen the intro
        localStorage.setItem(FIRST_VISIT_KEY, 'true');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) handleClose();
        }}>
            <DialogContent className="sm:max-w-[600px] md:max-w-[800px] glass-card p-0 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="p-6 pb-2 sticky top-0 z-10 bg-gradient-to-b from-card to-transparent">
                    <DialogTitle className="text-2xl font-display flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary animate-float" aria-hidden="true" />
                        Welcome to Meme Roulette!
                    </DialogTitle>
                    <DialogDescription>
                        Let's get you started with how everything works
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4">
                    <InstructionsOverlayContent />
                </div>

                <DialogFooter className="p-6 pt-2 sticky bottom-0 z-10 bg-gradient-to-t from-card to-transparent">
                    <Button onClick={handleClose} className="button-primary w-full sm:w-auto">
                        Got it, let's go!
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 