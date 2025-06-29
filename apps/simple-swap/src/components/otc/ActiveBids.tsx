"use client";

import React, { useState, useEffect } from "react";
import { Bid, Offer } from "@/lib/otc/schema";
import { TokenDef } from "@/types/otc";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, User, CheckCircle, XCircle, Wallet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/wallet-context";
import { signedFetch } from 'blaze-sdk';
import Image from "next/image";
import { checkBidderBalance } from "@/app/actions";
import { getPrimaryBnsName } from '@repo/polyglot';

// Helper to shorten addresses (optional, can be expanded)
const shortenAddress = (address: string, startChars = 6, endChars = 4) => {
    if (!address || address.length < startChars + endChars + 2) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

// Helper to generate blockchain explorer URL
const getExplorerUrl = (txId: string) => {
    const network = process.env.NODE_ENV === 'development' ? 'testnet' : 'mainnet';
    return `https://explorer.hiro.so/txid/${txId}?chain=${network}`;
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

// Enhanced time formatting helper
const formatTimeDisplay = (timestamp: number) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    // Show relative time for recent bids
    if (seconds < 60) {
        return {
            relative: "Just now",
            absolute: then.toLocaleString(),
            isVeryRecent: true
        };
    } else if (minutes < 60) {
        return {
            relative: `${minutes}m ago`,
            absolute: then.toLocaleString(),
            isRecent: minutes < 30
        };
    } else if (hours < 24) {
        return {
            relative: `${hours}h ago`,
            absolute: then.toLocaleString(),
            isRecent: hours < 6
        };
    } else if (days < 7) {
        return {
            relative: `${days}d ago`,
            absolute: then.toLocaleString(),
            isRecent: false
        };
    } else if (weeks < 4) {
        return {
            relative: `${weeks}w ago`,
            absolute: then.toLocaleString(),
            isRecent: false
        };
    } else {
        // For older bids, show the date
        return {
            relative: then.toLocaleDateString(),
            absolute: then.toLocaleString(),
            isRecent: false
        };
    }
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
    const [cancellingBids, setCancellingBids] = useState<Set<string>>(new Set());
    const [bnsNames, setBnsNames] = useState<Record<string, string | null>>({});
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Update current time for relative time calculations
    useEffect(() => {
        // Check if there are any very recent bids (less than 5 minutes)
        const hasRecentBids = bids.some(bid => {
            const diff = Date.now() - bid.createdAt;
            return diff < 5 * 60 * 1000; // 5 minutes
        });

        // Update more frequently if there are recent bids
        const updateInterval = hasRecentBids ? 10000 : 60000; // 10s vs 1min

        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, updateInterval);

        return () => clearInterval(interval);
    }, [bids]);

    // Fetch BNS name for a bidder address
    const fetchBnsName = async (address: string) => {
        if (bnsNames[address] !== undefined) return; // Already fetched or in progress

        setBnsNames(prev => ({ ...prev, [address]: null })); // Mark as loading

        try {
            const bnsName = await getPrimaryBnsName(address, 'stacks');
            setBnsNames(prev => ({ ...prev, [address]: bnsName }));
        } catch (error) {
            console.warn(`Failed to fetch BNS for ${address}:`, error);
            setBnsNames(prev => ({ ...prev, [address]: null }));
        }
    };

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

        // Fetch BNS names for all unique bidder addresses
        const uniqueBidders = [...new Set(bids.map(bid => bid.bidderAddress))];
        uniqueBidders.forEach(bidderAddress => {
            fetchBnsName(bidderAddress);
        });
    }, [bids]);

    // Helper to get display name for bidder
    const getBidderDisplayName = (address: string) => {
        const bnsName = bnsNames[address];
        if (bnsName === undefined) return "Loading..."; // Still fetching
        return bnsName || shortenAddress(address);
    };

    // Helper to get display class for bidder name
    const getBidderDisplayClass = (address: string) => {
        const bnsName = bnsNames[address];
        if (bnsName === undefined) return "animate-pulse text-muted-foreground"; // Loading
        return bnsName ? "font-medium text-primary" : "font-mono text-muted-foreground";
    };

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
                const responseData = await response.json();
                const txId = responseData.transactionDetails?.transferTxId;

                if (txId) {
                    toast.success("Bid accepted successfully! Trade is being executed.", {
                        description: `Transaction ID: ${txId.slice(0, 8)}...${txId.slice(-4)}`
                    });
                } else {
                    toast.success("Bid accepted successfully! Trade is being executed.");
                }

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

    const handleCancelBid = async (bidId: string) => {
        if (!address) {
            toast.error("Please connect your wallet to cancel a bid.");
            return;
        }

        setCancellingBids(prev => new Set(prev).add(bidId));
        toast.loading("Cancelling bid...");

        try {
            const response = await signedFetch(`/api/v1/otc/bid`, {
                method: "DELETE",
                body: JSON.stringify({
                    originalOfferIntentUuid: offer.intentUuid,
                    bidId: bidId,
                }),
                message: bidId, // Use bidId as the message to sign
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.dismiss();
                toast.success("Bid cancelled successfully!");

                // Update local state immediately for better UX
                setLocalBidStatuses(prev => ({ ...prev, [bidId]: 'cancelled' }));

                // Call parent callback if provided
                onBidUpdate?.(bidId, 'cancelled');
            } else {
                toast.dismiss();
                toast.error(data.error || "Failed to cancel bid");
            }
        } catch (error) {
            toast.dismiss();
            toast.error("An error occurred while cancelling the bid");
            console.error("Error cancelling bid:", error);
        } finally {
            setCancellingBids(prev => {
                const newSet = new Set(prev);
                newSet.delete(bidId);
                return newSet;
            });
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
                        const timeInfo = formatTimeDisplay(bid.createdAt);

                        // Use local status override if available, otherwise use original bid status
                        const currentStatus = localBidStatuses[bid.bidId] || bid.status;
                        const isPending = currentStatus === "pending";
                        const balanceInfo = bidBalances[bid.bidId];

                        return (
                            <div key={bid.bidId} className={`p-4 rounded-lg border border-border bg-card ${timeInfo.isVeryRecent ? 'ring-1 ring-green-500/20 bg-green-50/30 dark:bg-green-950/10' : ''
                                }`}>
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
                                                <span
                                                    className={getBidderDisplayClass(bid.bidderAddress)}
                                                    title={bnsNames[bid.bidderAddress] ? `${bnsNames[bid.bidderAddress]} (${bid.bidderAddress})` : bid.bidderAddress}
                                                >
                                                    {getBidderDisplayName(bid.bidderAddress)}
                                                </span>
                                                <Clock className="h-3 w-3 ml-2" />
                                                <span
                                                    className={`cursor-help ${timeInfo.isVeryRecent
                                                        ? 'text-green-600 dark:text-green-400 font-medium animate-pulse'
                                                        : timeInfo.isRecent
                                                            ? 'text-blue-600 dark:text-blue-400'
                                                            : 'text-muted-foreground'
                                                        }`}
                                                    title={timeInfo.absolute}
                                                >
                                                    {timeInfo.isVeryRecent && "🟢 "}
                                                    {timeInfo.relative}
                                                </span>
                                            </div>

                                            {/* Bid Message */}
                                            {bid.message && bid.message.trim() && (
                                                <div className="mt-2 p-2 bg-muted/20 rounded text-xs">
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <span className="font-medium text-primary">💬 Message:</span>
                                                    </div>
                                                    <p className="text-muted-foreground italic">
                                                        "{bid.message.trim()}"
                                                    </p>
                                                </div>
                                            )}

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
                                                onClick={() => handleCancelBid(bid.bidId)}
                                                className="ml-2"
                                                disabled={cancellingBids.has(bid.bidId)}
                                            >
                                                {cancellingBids.has(bid.bidId) && (
                                                    <div className="animate-spin -ml-1 mr-2 h-3 w-3 border border-current border-t-transparent rounded-full"></div>
                                                )}
                                                {cancellingBids.has(bid.bidId) ? 'Cancelling...' : 'Cancel'}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {currentStatus === 'accepted' && (
                                    <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                                        <p className="text-green-600 dark:text-green-400 font-medium">Bid accepted</p>
                                        <p>Trade has been executed successfully.</p>
                                        {bid.acceptanceDetails?.txId && (
                                            <div className="mt-2">
                                                <a
                                                    href={getExplorerUrl(bid.acceptanceDetails.txId)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    View transaction
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {currentStatus === 'cancelled' && (
                                    <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                                        <p className="text-amber-600 dark:text-amber-400 font-medium">Bid cancelled</p>
                                        <p>This bid has been cancelled by the bidder.</p>
                                    </div>
                                )}

                                {currentStatus === 'rejected' && (
                                    <div className="mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                                        <p className="text-red-600 dark:text-red-400 font-medium">Bid rejected</p>
                                        <p>Another bid was accepted for this offer.</p>
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