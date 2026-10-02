'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HowItWorks } from './HowItWorks';

const FIRST_VISIT_KEY = 'meme-roulette-first-visit-seen';

export default function FirstVisitPopup() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!localStorage.getItem(FIRST_VISIT_KEY)) {
                const timer = setTimeout(() => setOpen(true), 1000);
                return () => clearTimeout(timer);
            }
        } catch { /* storage blocked: skip the intro */ }
    }, []);

    const close = () => {
        try { localStorage.setItem(FIRST_VISIT_KEY, 'true'); } catch { /* storage blocked */ }
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) close(); }}>
            <DialogContent className="border-line bg-surface-raised sm:max-w-[720px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Welcome to Meme Roulette</DialogTitle>
                    <DialogDescription>A group buy with a wheel. Here's the whole game:</DialogDescription>
                </DialogHeader>
                <HowItWorks />
                <DialogFooter>
                    <Button onClick={close}>Let's play</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
