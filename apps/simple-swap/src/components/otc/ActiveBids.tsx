"use client";

import React from "react";
import { Bid, Offer } from "@/lib/otc/schema";
import { TokenDef } from "@/types/otc";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/wallet-context";
import { signedFetch } from 'blaze-sdk';
import Image from "next/image";

// Helper to shorten addresses (optional, can be expanded)
const shortenAddress = (address: string, startChars = 6, endChars = 4) => {
    if (!address || address.length < startChars + endChars + 2) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

// Helper to format token amount (similar to ActiveBids)
const formatTokenAmount = (atomicAmount: string, tokenInfo: TokenDef | undefined): string => {
    if (!tokenInfo) return atomicAmount + " (atomic)";
    const amount = parseInt(atomicAmount) / 10 ** tokenInfo.decimals;
    return amount.toLocaleString(undefined, {
        maximumFractionDigits: tokenInfo.decimals,
        minimumFractionDigits: Math.min(tokenInfo.decimals, 2),
    }) + ` ${tokenInfo.symbol}`;
};

const getTimeAgo = (timestamp: number) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();
    const diffMinutes = Math.floor(diff / (1000 * 60));
    return `${diffMinutes} minutes ago`;
};

// Reusing formatTokenAmount and shortenAddress from EnhancedOfferDetails

interface ActiveBidsProps {
    bids: Bid[];
    subnetTokens: TokenDef[];
    offer: Offer;
}

export function EnhancedActiveBids({ bids, subnetTokens, offer }: ActiveBidsProps) {
    const { address } = useWallet();

    const handleSelectBid = async (bidId: string) => {
        // Confirmation dialog could be added here
        toast.loading("Processing bid acceptance...");

        try {
            const response = await signedFetch(`/api/v1/otc/accept-bid`, {
                method: "POST",
                body: JSON.stringify({
                    acceptedBidId: bidId,
                    offerIntentUuid: offer.intentUuid,
                }),
                message: offer.intentUuid,
            });

            if (response.ok) {
                toast.dismiss();
                toast.success("Bid accepted successfully! Trade is being executed.");
            } else {
                const data = await response.json();
                toast.dismiss();
                toast.error(data.error || "Failed to accept bid");
            }
        } catch (error) {
            toast.dismiss();
            toast.error("An error occurred while accepting the bid");
            console.error("Error accepting bid:", error);
        }
    };

    const getBidAssetDisplayInfo = (bid: Bid) => {
        const bidAssetDetails = bid.bidAssets[0]; // Assuming bidAssets always has one item
        if (!bidAssetDetails) return { name: "N/A", formattedAmount: "N/A", logo: null, symbol: "" };

        const tokenInfo = subnetTokens.find(t => t.id === bidAssetDetails.token);
        const tokenName = tokenInfo ? tokenInfo.name : shortenAddress(bidAssetDetails.token);
        const formattedAmount = formatTokenAmount(bidAssetDetails.amount, tokenInfo);

        return {
            name: tokenName,
            formattedAmount: formattedAmount,
            logo: tokenInfo?.logo,
            symbol: tokenInfo?.symbol || ""
        };
    };

    const getStatusBadgeVariant = (status: Bid['status']) => {
        switch (status) {
            case "pending": return "default";
            case "accepted": return "secondary";
            case "rejected": return "destructive";
            case "cancelled": return "outline";
            default: return "outline";
        }
    };

    const pendingBids = bids.filter(bid => bid.status === "pending");

    if (!bids || bids.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Active Bids</CardTitle>
                    <CardDescription>Bids placed on this offer</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-3">
                            <AlertCircle className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium mb-1">No bids have been placed yet</p>
                        <p className="text-xs text-muted-foreground max-w-xs">
                            When users place bids on this offer, they will appear here.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>
                    Active Bids{" "}
                    {pendingBids.length > 0 && (
                        <Badge variant="default" className="ml-2">
                            {pendingBids.length} pending
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription>Bids placed on this offer</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {bids.map((bid) => {
                        const { name: tokenName, formattedAmount, logo: tokenLogo, symbol } = getBidAssetDisplayInfo(bid);
                        const isOfferCreator = offer.offerCreatorAddress === address;
                        const isBidder = bid.bidderAddress === address;
                        const isPending = bid.status === "pending";

                        return (
                            <div key={bid.bidId} className={`p-4 rounded-lg border ${bid.status === 'accepted' ? 'bg-green-500/5 border-green-500/20' :
                                bid.status === 'rejected' || bid.status === 'cancelled' ? 'bg-muted/5 border-border/50' :
                                    'bg-card border-border'
                                }`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            {tokenLogo ? (
                                                <Image src={tokenLogo} width={40} height={40} alt={symbol} className="h-10 w-10 rounded-full" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-primary font-semibold">{symbol?.charAt(0) || '?'}</span>
                                                </div>
                                            )}
                                            {bid.status === 'accepted' && (
                                                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full h-5 w-5 flex items-center justify-center border-2 border-card">
                                                    <Check className="h-3 w-3" />
                                                </div>
                                            )}
                                            {(bid.status === 'rejected' || bid.status === 'cancelled') && (
                                                <div className="absolute -bottom-1 -right-1 bg-muted-foreground text-white rounded-full h-5 w-5 flex items-center justify-center border-2 border-card">
                                                    <X className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium">{formattedAmount}</p>
                                            <div className="flex items-center text-xs text-muted-foreground gap-2">
                                                <span className="font-mono">{shortenAddress(bid.bidderAddress)}</span>
                                                <span>•</span>
                                                <span className="flex items-center">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {getTimeAgo(bid.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant={getStatusBadgeVariant(bid.status)} className="capitalize">
                                            {bid.status}
                                        </Badge>

                                        {isOfferCreator && isPending && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelectBid(bid.bidId)}
                                                className="ml-2"
                                            >
                                                Accept Bid
                                            </Button>
                                        )}

                                        {isBidder && isPending && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => toast.info("Cancelling bids is not yet implemented")}
                                                className="ml-2"
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {bid.status === 'accepted' && (
                                    <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                                        <p className="text-green-600 dark:text-green-400 font-medium">Bid accepted</p>
                                        <p>Trade has been executed successfully.</p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}