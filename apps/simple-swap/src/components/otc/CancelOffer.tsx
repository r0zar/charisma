// cancel an offer

"use client";
import { Button } from "@/components/ui/button";
import { signedFetch } from "blaze-sdk";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { redirect } from "next/navigation";



export const CancelOffer = ({ intentUuid }: { intentUuid: string }) => {

    // add a way to cancel the offer
    const cancelOffer = async () => {
        const response = await signedFetch('/api/v1/otc/cancel', {
            method: 'DELETE',
            message: intentUuid,
            body: JSON.stringify({ offerId: intentUuid }),
        });
        if (response.ok) {
            toast.success('Offer cancelled');
            redirect(`/shop`);
        } else {
            toast.error('Failed to cancel offer');
        }
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>Cancel Offer</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Cancel Offer</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                    Are you sure you want to cancel this offer?
                </DialogDescription>
                <DialogFooter>
                    <Button onClick={cancelOffer}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}