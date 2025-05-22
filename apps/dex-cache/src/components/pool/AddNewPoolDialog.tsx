"use client";

import React from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface AddNewPoolDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    launchpadUrl: string;
}

export default function AddNewPoolDialog({ isOpen, onOpenChange, launchpadUrl }: AddNewPoolDialogProps) {
    const handleNavigate = () => {
        window.open(launchpadUrl, '_blank');
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Create a New Liquidity Pool</DialogTitle>
                    <DialogDescription className="pt-2">
                        You will be redirected to the Charisma Launchpad to configure and deploy your new liquidity pool.
                        The Launchpad provides a step-by-step wizard to guide you through the process.
                    </DialogDescription>
                </DialogHeader>

                <div className='py-4 text-sm text-muted-foreground'>
                    Ensure you have your Stacks wallet ready and enough STX for transaction fees.
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleNavigate}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Proceed to Launchpad
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
} 