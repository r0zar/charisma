"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bid, Offer } from "@/lib/otc/schema"; // Combined Offer import
import { TokenDef } from "@/types/otc"; // Assuming TokenDef type is here, ensure it's the correct source
import { useWallet } from '@/contexts/wallet-context';
import { signedFetch } from '@repo/stacks';
import { toast } from 'sonner';

// Basic fromAtomicString helper (consider moving to a shared util)
const fromAtomicString = (atomicAmount: string, decimals: number): number => {
    return parseInt(atomicAmount) / 10 ** decimals;
};

// Helper to format token amount with symbol
const formatTokenAmount = (atomicAmount: string, tokenInfo: TokenDef | undefined): string => {
    if (!tokenInfo) return atomicAmount + " (atomic)";
    const amount = fromAtomicString(atomicAmount, tokenInfo.decimals);
    return amount.toLocaleString(undefined, {
        maximumFractionDigits: tokenInfo.decimals,
        minimumFractionDigits: tokenInfo.decimals,
    }) + ` ${tokenInfo.symbol}`;
};

// Helper to shorten addresses (optional, can be expanded)
const shortenAddress = (address: string, startChars = 6, endChars = 4) => {
    if (!address || address.length < startChars + endChars + 2) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

interface ActiveBidsProps {
    bids: Bid[];
    subnetTokens: TokenDef[]; // Ensure TokenDef has id, name, symbol, decimals, image?
    offer: Offer;
}

export default function ActiveBids({
    bids,
    subnetTokens,
    offer,
}: ActiveBidsProps) {

    const handleSelectBid = (bidId: string) => {
        signedFetch(`/api/v1/otc/accept-bid`, {
            method: "POST",
            body: JSON.stringify({
                acceptedBidId: bidId,
                offerIntentUuid: offer.intentUuid,
            }),
            message: offer.intentUuid,
        });
        toast.success("Bid accepted successfully.");
    };

    const { address } = useWallet();

    if (!bids || bids.length === 0) {
        return (
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Active Bids</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No bids have been placed on this offer yet.</p>
                </CardContent>
            </Card>
        );
    }

    const getBidAssetDisplayInfo = (bid: Bid) => {
        const bidAssetDetails = bid.bidAssets[0]; // Assuming bidAssets always has one item
        if (!bidAssetDetails) return { name: "N/A", formattedAmount: "N/A", logo: null, symbol: "" };

        console.log("bidAssetDetails", bidAssetDetails);

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

    const getStatusVariant = (status: Bid['status']) => {
        switch (status) {
            case "pending": return "default";
            case "accepted": return "default";
            case "rejected": return "destructive";
            case "cancelled": return "outline";
            default: return "secondary";
        }
    };

    return (
        <Card className="">
            <CardHeader>
                <CardTitle>Active Bids ({bids.length})</CardTitle>
                <CardDescription>Bids placed on this offer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {bids.map((bid) => {
                    const { name: tokenName, formattedAmount, logo: tokenLogo } = getBidAssetDisplayInfo(bid);

                    return (
                        <div key={bid.bidId} className={`p-3 border rounded-lg bg-muted/20 space-y-1`}>
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-medium" title={bid.bidderAddress}>Bidder: <span className="font-mono text-xs">{shortenAddress(bid.bidderAddress)}</span></p>
                                <Badge variant={getStatusVariant(bid.status)} className="capitalize text-xs">
                                    {bid.status}
                                </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                                {tokenLogo && (
                                    <img src={tokenLogo} alt={tokenName} className="h-5 w-5 rounded-full" />
                                )}
                                <p className="text-sm">Offering: {formattedAmount}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Date: {new Date(bid.createdAt).toLocaleString()}
                            </p>
                            <div className="pt-1 text-right space-x-2">
                                {bid.status === 'pending' && offer.offerCreatorAddress === address && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSelectBid(bid.bidId)}
                                    >
                                        Select to Accept
                                    </Button>
                                )}
                                {/* {bid.status === 'pending' && bid.bidderAddress === address && (
                                    <Button size="sm" variant="destructive">
                                        Cancel My Bid
                                    </Button>
                                )} */}
                                {/* Display acceptance details if this bid was accepted */}
                                {bid.status === 'accepted' && bid.acceptanceDetails && (
                                    <div className="text-xs text-left pt-1 mt-1 border-t border-dashed">
                                        <p className="font-semibold">Acceptance Details:</p>
                                        <p>Final TX UUID: <span className="font-mono">{shortenAddress(bid.acceptanceDetails.executeOtcSwapIntentUuid, 10, 6)}</span></p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
} 