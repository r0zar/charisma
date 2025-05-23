"use client";

import React, { useState, useEffect } from "react";
import { Bid, Offer } from "@/lib/otc/schema";
import { TokenDef } from "@/types/otc";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Check, X, User, CheckCircle, XCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/wallet-context";
import { signedFetch } from 'blaze-sdk';
import Image from "next/image";
import { checkBidderBalance } from "@/app/actions";

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

interface BalanceInfo {
    sufficient: boolean;
    humanReadableBalance: number;
    humanReadableRequired: number;
    loading: boolean;
}

interface ActiveBidsProps {
    bids: Bid[];
    subnetTokens: TokenDef[];
    offer: Offer;
    onBidUpdate?: (bidId: string, newStatus: Bid['status']) => void;
}

export function EnhancedActiveBids({ bids, subnetTokens, offer, onBidUpdate }: ActiveBidsProps) {
    const { address } = useWallet();
    const [bidBalances, setBidBalances] = useState<Record<string, BalanceInfo>>({});
    const [localBidStatuses, setLocalBidStatuses] = useState<Record<string, Bid['status']>>({});

    // Fetch bidder balance for a specific bid
    const fetchBidderBalance = async (bid: Bid) => {
        const bidAsset = bid.bidAssets[0];
        if (!bidAsset) return;

        const tokenInfo = subnetTokens.find(t => t.id === bidAsset.token);
        if (!tokenInfo) return;

        setBidBalances(prev => ({
            ...prev,
            [bid.bidId]: { ...prev[bid.bidId], loading: true }
        }));

        try {
            const balanceInfo = await checkBidderBalance(
                bid.bidderAddress,
                bidAsset.token,
                bidAsset.amount
            );

            setBidBalances(prev => ({
                ...prev,
                [bid.bidId]: {
                    sufficient: balanceInfo.sufficient,
                    humanReadableBalance: balanceInfo.humanReadableBalance,
                    humanReadableRequired: balanceInfo.humanReadableRequired,
                    loading: false
                }
            }));
        } catch (error) {
            console.error('Error fetching bidder balance:', error);
            setBidBalances(prev => ({
                ...prev,
                [bid.bidId]: {
                    sufficient: false,
                    humanReadableBalance: 0,
                    humanReadableRequired: 0,
                    loading: false
                }
            }));
        }
    };

    // Fetch balances for all pending bids when component mounts
    useEffect(() => {
        const pendingBids = bids.filter(bid => bid.status === "pending");
        pendingBids.forEach(bid => {
            if (!bidBalances[bid.bidId]) {
                fetchBidderBalance(bid);
            }
        });
    }, [bids]);

    const handleSelectBid = async (bidId: string) => {
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

                // Update local state immediately for better UX
                setLocalBidStatuses(prev => ({ ...prev, [bidId]: 'accepted' }));

                // Call parent callback if provided
                onBidUpdate?.(bidId, 'accepted');
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

    const pendingBids = bids.filter(bid => {
        const currentStatus = localBidStatuses[bid.bidId] || bid.status;
        return currentStatus === "pending";
    });

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

                        // Use local status override if available, otherwise use original bid status
                        const currentStatus = localBidStatuses[bid.bidId] || bid.status;
                        const isPending = currentStatus === "pending";
                        const balanceInfo = bidBalances[bid.bidId];

                        return (
                            <div key={bid.bidId} className="p-4 rounded-lg border border-border bg-card">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="flex items-center gap-2">
                                            {tokenLogo ? (
                                                <Image src={tokenLogo} alt={symbol} width={32} height={32} className="rounded-full" />
                                            ) : (
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-primary text-sm font-semibold">{symbol.charAt(0)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-sm">{formattedAmount}</p>
                                                <span className="text-xs text-muted-foreground">({tokenName})</span>
                                            </div>

                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                                <User className="h-3 w-3" />
                                                <span title={bid.bidderAddress}>
                                                    {shortenAddress(bid.bidderAddress)}
                                                </span>
                                                <Clock className="h-3 w-3 ml-2" />
                                                <span>{new Date(bid.createdAt).toLocaleDateString()}</span>
                                            </div>

                                            {/* Balance Information */}
                                            {isOfferCreator && isPending && (
                                                <div className="mt-2 p-2 bg-muted/30 rounded text-xs">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Wallet className="h-3 w-3" />
                                                        <span className="font-medium">Bidder Balance Check:</span>
                                                    </div>
                                                    {balanceInfo?.loading ? (
                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                            <div className="animate-pulse">Checking balance...</div>
                                                        </div>
                                                    ) : balanceInfo ? (
                                                        <div className={`flex items-center gap-1 ${balanceInfo.sufficient ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                            {balanceInfo.sufficient ? (
                                                                <>
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    <span>✓ Sufficient balance ({balanceInfo.humanReadableBalance.toLocaleString()} {symbol})</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="h-3 w-3" />
                                                                    <span>⚠ Insufficient balance ({balanceInfo.humanReadableBalance.toLocaleString()} / {balanceInfo.humanReadableRequired.toLocaleString()} {symbol})</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-muted-foreground">Balance check failed</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant={getStatusBadgeVariant(currentStatus)} className="capitalize">
                                            {currentStatus}
                                        </Badge>

                                        {isOfferCreator && isPending && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelectBid(bid.bidId)}
                                                className="ml-2"
                                                variant={balanceInfo && !balanceInfo.sufficient ? "outline" : "default"}
                                            >
                                                Accept Bid
                                                {balanceInfo && !balanceInfo.sufficient && (
                                                    <span className="ml-1 text-xs">⚠</span>
                                                )}
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

                                {currentStatus === 'accepted' && (
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