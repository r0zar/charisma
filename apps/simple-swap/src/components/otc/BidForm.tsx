"use client";
import React, { useState } from "react";
import { Asset as OtcAsset, TokenDef } from "@/types/otc";
import { Offer } from "@/lib/otc/schema";
import TokenDropdown from "@/components/TokenDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useWallet } from "@/contexts/wallet-context";
import { IntentInput, signIntentWithWallet } from "blaze-sdk";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from 'next/navigation';

interface Props {
    intentUuid: string;
    subnetTokens: TokenDef[];
    offer: Offer;
    onBidPlaced?: () => void;
}

const toAtomicString = (amountStr: string, decimals: number): string => {
    return (Number(amountStr) * 10 ** decimals).toString();
};

export default function BidForm({ intentUuid, subnetTokens, offer, onBidPlaced }: Props) {
    const router = useRouter();
    const { address: stxAddress } = useWallet();
    const [bidAsset, setBidAsset] = useState<OtcAsset>({ token: "", amount: "" });
    const [isSigning, setIsSigning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedTokenInfo = subnetTokens?.find(t => t.id === bidAsset.token);

    const dropdownTokens = subnetTokens.map(td => ({
        ...td,
        contractId: td.id,
        type: "SUBNET"
    }));

    const updateBidAsset = (field: "token" | "amount", value: string) => {
        setBidAsset((prev) => ({ ...prev, [field]: value }));
    };

    const isValid = () => {
        if (!stxAddress) return false;
        if (!bidAsset.token || !bidAsset.amount) return false;
        const tokenInfo = subnetTokens.find(t => t.id === bidAsset.token);
        if (!tokenInfo) return false;
        const amountNum = parseFloat(bidAsset.amount);
        return amountNum > 0 && !isNaN(amountNum);
    };

    const placeBid = async () => {
        if (!isValid()) {
            if (!stxAddress) {
                toast.error("Please connect your wallet to place a bid.");
            } else {
                toast.error("Please select a token and enter a valid amount for your bid.");
            }
            return;
        }

        if (!signIntentWithWallet) {
            toast.error("Signing function is not available. Please try again.");
            return;
        }

        if (!selectedTokenInfo) {
            toast.error("Selected token details not found.");
            return;
        }

        setIsSigning(true);
        try {
            const atomicBidAmountStr = toAtomicString(bidAsset.amount, selectedTokenInfo.decimals);
            const numericAtomicBidAmount = parseInt(atomicBidAmountStr, 10);

            if (isNaN(numericAtomicBidAmount)) {
                throw new Error(`Failed to convert bid amount to atomic units for ${selectedTokenInfo.name}`);
            }

            const bidderSideIntentUuid = uuidv4();
            const intentInputForBidAsset: IntentInput = {
                intent: "TRANSFER_TOKENS",
                contract: bidAsset.token,
                amount: numericAtomicBidAmount,
                uuid: bidderSideIntentUuid,
                target: offer.offerCreatorAddress,
            };

            console.log("[BidForm] Intent input for bid asset:", intentInputForBidAsset);

            const signedBidIntent = await signIntentWithWallet(intentInputForBidAsset);
            setIsSigning(false);
            setIsSubmitting(true);

            const payload = {
                originalOfferIntentUuid: intentUuid,
                bidderAddress: stxAddress!,
                bidAssets: [{ token: bidAsset.token, amount: atomicBidAmountStr }],
                bidSignature: signedBidIntent.signature,
                bidderSideIntentUuid: bidderSideIntentUuid,
            };

            const res = await fetch(`/api/v1/otc/bid`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();

            if (json.success) {
                toast.success("Bid placed successfully!");
                router.refresh();
                onBidPlaced?.();
                setBidAsset({ token: "", amount: "" });
            } else {
                throw new Error(json.error || "API failed to process the bid.");
            }
        } catch (err: any) {
            console.error("Error placing bid:", err);
            toast.error(err.message || "Failed to place bid due to an unexpected error.");
        } finally {
            setIsSigning(false);
            setIsSubmitting(false);
        }
    };

    const isLoading = isSigning || isSubmitting;
    let buttonText = "Place Bid";
    if (isSigning) buttonText = "Signing...";
    if (isSubmitting) buttonText = "Submitting...";

    return (
        <div className="space-y-4 p-1">
            <div>
                <Label htmlFor="bid-token-dropdown" className="text-sm font-medium mb-1 block">You Offer This Asset:</Label>
                <TokenDropdown
                    tokens={dropdownTokens}
                    selected={dropdownTokens.find((t) => t.contractId === bidAsset.token) ?? null}
                    onSelect={(token) => updateBidAsset("token", token.contractId)}
                />
                {selectedTokenInfo && selectedTokenInfo.logo && (
                    <div className="mt-2 flex items-center space-x-2 p-2 bg-muted/30 rounded-md">
                        <img src={selectedTokenInfo.logo} alt={selectedTokenInfo.name} className="h-6 w-6 rounded-full" />
                        <span className="text-sm text-muted-foreground">Selected: {selectedTokenInfo.name} ({selectedTokenInfo.symbol})</span>
                    </div>
                )}
            </div>
            <div>
                <Label htmlFor="bid-amount" className="text-sm font-medium mb-1 block">Amount:</Label>
                <div className="flex items-center">
                    <Input
                        id="bid-amount"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.0"
                        value={bidAsset.amount}
                        onChange={(e) => updateBidAsset("amount", e.target.value)}
                        disabled={isLoading}
                        className="w-full rounded-r-none"
                    />
                    {selectedTokenInfo && (
                        <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-input bg-muted text-sm text-muted-foreground h-10">
                            {selectedTokenInfo.symbol}
                        </span>
                    )}
                </div>
            </div>
            <Button onClick={placeBid} disabled={isLoading || !isValid()} className="w-full">
                {buttonText}
            </Button>
        </div>
    );
}