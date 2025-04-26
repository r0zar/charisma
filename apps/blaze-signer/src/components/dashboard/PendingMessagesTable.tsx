"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner for toasts, adjust if using something else
import type { QueuedTxIntent } from "@/lib/types";

interface PendingMessagesTableProps {
    pendingMessages: QueuedTxIntent[];
}

// Helper function to truncate Stacks principal
function truncatePrincipal(principal: string | null | undefined, startLength = 6, endLength = 4): string {
    if (!principal) return 'N/A';
    if (principal.length <= startLength + endLength + 3) return principal; // No need to truncate if too short
    return `${principal.substring(0, startLength)}...${principal.substring(principal.length - endLength)}`;
}

export function PendingMessagesTable({ pendingMessages }: PendingMessagesTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

    const handleDelete = async (uuidToDelete: string) => {
        setDeletingUuid(uuidToDelete); // Set loading state for the specific button

        try {
            const response = await fetch('/api/queue/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuidToDelete }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success(result.message || "Message deleted successfully!");
                // Refresh server components
                startTransition(() => {
                    router.refresh();
                });
            } else {
                throw new Error(result.error || "Failed to delete message.");
            }
        } catch (error) {
            console.error("Failed to delete message:", error);
            toast.error(error instanceof Error ? error.message : "An unknown error occurred.");
        } finally {
            setDeletingUuid(null); // Clear loading state
        }
    };

    return (
        <AlertDialog>
            <Table>
                <TableCaption>
                    {pendingMessages.length === 0
                        ? "The transaction queue is currently empty."
                        : `Showing ${pendingMessages.length} pending message(s).`}
                </TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>UUID</TableHead>
                        <TableHead>Intent (Type)</TableHead>
                        <TableHead>Authorized Contract</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Signature (Start)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pendingMessages.map((msg) => {
                        const isDeleting = deletingUuid === msg.uuid;

                        // --- Updated Contract Display Logic ---
                        let principalPart = '(unknown)';
                        let contractName = '(unknown)';
                        if (msg.contractId && msg.contractId.includes('.')) {
                            const parts = msg.contractId.split('.');
                            principalPart = parts[0];
                            contractName = parts[1];
                        } else if (msg.contractId) {
                            // Handle case where only principal might be stored (though shouldn't happen now)
                            principalPart = msg.contractId;
                        }
                        const truncatedPrincipal = truncatePrincipal(principalPart);
                        const displayContract = contractName === '(unknown)'
                            ? truncatedPrincipal
                            : `${truncatedPrincipal}.${contractName}`;
                        const titleContract = msg.contractId ?? 'N/A';
                        // --- End Updated Logic ---

                        return (
                            <TableRow key={msg.uuid}>
                                <TableCell className="font-mono text-xs">{msg.uuid.substring(0, 8)}...</TableCell>
                                <TableCell>{msg.intent}</TableCell>
                                <TableCell className="font-mono text-xs" title={titleContract}>
                                    {displayContract}
                                </TableCell>
                                <TableCell>{msg.amountOptional ?? 'N/A'}</TableCell>
                                <TableCell className="font-mono text-xs" title={msg.targetOptional ?? 'N/A'}>
                                    {truncatePrincipal(msg.targetOptional)}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-right">{msg.signature.substring(0, 10)}...</TableCell>
                                <TableCell className="text-right">
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={isPending || isDeleting} // Disable while any deletion is processing
                                        >
                                            {isDeleting ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </AlertDialogTrigger>
                                </TableCell>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the message
                                            with UUID starting {msg.uuid.substring(0, 8)}... from the queue.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setDeletingUuid(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(msg.uuid)} disabled={isDeleting}>
                                            {isDeleting ? "Deleting..." : "Yes, delete message"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </AlertDialog>
    );
} 