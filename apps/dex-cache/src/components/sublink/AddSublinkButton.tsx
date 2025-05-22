"use client";

import React, { useState, useTransition } from 'react';
import AddSublinkDialog from './AddSublinkDialog';
import { createNewSublinkAction } from '@/lib/sublinks/actions';
import { FetchedSublinkDetails } from './AddSublinkDialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function AddSublinkButton() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    if (!isDevelopment) {
        return null;
    }

    const handleOpenDialog = () => {
        setIsDialogOpen(true);
    };

    const handleSublinkCreated = async (sublinkData: FetchedSublinkDetails) => {
        let toastId: string | number | undefined;
        startTransition(async () => {
            toastId = toast.loading("Saving new sublink...");
            try {
                const result = await createNewSublinkAction(sublinkData);
                if (result.success) {
                    toast.success(result.message || "Sublink saved successfully!", { id: toastId });
                    setIsDialogOpen(false);
                } else {
                    toast.error(result.error || "Failed to save sublink.", { id: toastId });
                    console.error("Error from server action:", result.error);
                }
            } catch (error: any) {
                toast.error("An unexpected error occurred.", { id: toastId, description: error.message });
                console.error("Client-side error calling server action:", error);
            }
        });
    };

    return (
        <>
            <button
                onClick={handleOpenDialog}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 flex items-center justify-center"
            >
                {isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                    'Add New Sublink'
                )}
            </button>
            <AddSublinkDialog
                isOpen={isDialogOpen}
                onOpenChange={(isOpen) => {
                    if (isPending) return;
                    setIsDialogOpen(isOpen);
                }}
                onSublinkCreated={handleSublinkCreated}
            />
        </>
    );
} 