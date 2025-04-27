'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, X } from 'lucide-react';

// The actual content, refactored from InstructionsOverlay
const InstructionsContent = () => (
    <>
        <DialogHeader>
            {/* Keep header empty or add a title if needed */}
            {/* <DialogTitle>How the Group Pump Works</DialogTitle> */}
            <DialogClose asChild>
                <Button variant="ghost" size="icon" className="absolute top-3 right-3">
                    <X className="h-4 w-4" />
                </Button>
            </DialogClose>
        </DialogHeader>
        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none py-4">
            {/* Copied content from InstructionsOverlay */}
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 text-primary">Welcome to the Group Token Pumper!</h2>
            <p className="text-center mb-6">
                Get ready for a collective meme coin pump! Join everyone in committing <span className="font-semibold text-primary">CHA</span> to influence which token gets the big buy. Here's the plan:
            </p>
            <ol className="list-decimal space-y-4 pl-5">
                <li>
                    <strong>Commit Your CHA:</strong> Use your <span className="font-semibold text-primary">CHA</span> balance to back the meme tokens you want to see pumped. The more <span className="font-semibold text-primary">CHA</span> collectively committed to a token, the higher its chance of being selected for the pump!
                </li>
                <li>
                    <strong>The Selection:</strong> When the timer hits zero, the voting phase locks. A token is then chosen based on the total <span className="font-semibold text-primary">CHA</span> committed to each one – more commitment means better odds.
                </li>
                <li>
                    <strong>The Group Pump:</strong> ALL <span className="font-semibold text-primary">CHA</span> committed by everyone this round is automatically used to market-buy the WINNING token! Everyone who committed receives the winning token equivalent to their committed <span className="font-semibold text-primary">CHA</span> amount (executed based on commitment time order).
                </li>
            </ol>
            <p className="text-center mt-8 font-semibold">
                Rally together! Which meme will get the pump? Commit your <span className="font-semibold text-primary">CHA</span> and boost the odds!
            </p>
        </div>
        <DialogFooter className="mt-6 sm:justify-center">
            {/* Use DialogClose for the button inside the footer */}
            <DialogClose asChild>
                <Button size="lg" variant="default">Pump It!</Button>
            </DialogClose>
        </DialogFooter>
    </>
);

export const InstructionsButton = () => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-lg bg-background/80 backdrop-blur-sm"
                    aria-label="Show Instructions"
                >
                    <Info className="h-6 w-6" />
                </Button>
            </DialogTrigger>
            {/* Render the content inside DialogContent */}
            <DialogContent className="max-w-lg p-6">
                <InstructionsContent />
            </DialogContent>
        </Dialog>
    );
}; 