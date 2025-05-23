"use client";

import { Offer } from "@/lib/otc/schema";
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TokenDef } from "@/types/otc";
import { Clock } from "lucide-react";
import { CancelOffer } from "./CancelOffer";
import { useWallet } from "@/contexts/wallet-context";

// Helper to shorten addresses (optional, can be expanded)
const shortenAddress = (address: string, startChars = 6, endChars = 4) => {
    if (!address || address.length < startChars + endChars + 2) return address;
    return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
};

// Helper to format token amount (similar to ActiveBids)
const formatTokenAmount = (atomicAmount: string, tokenInfo: TokenDef | undefined): string => {
    if (!tokenInfo || !atomicAmount) return atomicAmount ? atomicAmount + " (unknown token)" : "0";

    const parsedAmount = parseFloat(atomicAmount);
    if (isNaN(parsedAmount)) return "0 " + tokenInfo.symbol;

    const amount = parsedAmount / 10 ** tokenInfo.decimals;
    return amount.toLocaleString(undefined, {
        maximumFractionDigits: Math.min(tokenInfo.decimals, 8),
        minimumFractionDigits: 0,
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

    // Show relative time for recent offers
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
        // For older offers, show the date
        return {
            relative: then.toLocaleDateString(),
            absolute: then.toLocaleString(),
            isRecent: false
        };
    }
};

interface OfferDetailsProps {
    offer: Offer;
    subnetTokens: TokenDef[];
    offerTokenMetadata?: Record<string, TokenDef>;
}

export default function EnhancedOfferDetails({ offer, subnetTokens, offerTokenMetadata }: OfferDetailsProps) {
    const { address } = useWallet();

    // Get time display info once
    const timeInfo = formatTimeDisplay(offer.createdAt);

    const getBadgeVariant = (status: Offer["status"]) => {
        switch (status) {
            case "open":
                return "default";
            case "filled":
                return "secondary";
            case "cancelled":
                return "destructive";
            default:
                return "outline";
        }
    };

    // Enhanced token lookup function
    const getTokenInfo = (tokenId: string): TokenDef | undefined => {
        // First check offer token metadata (most accurate)
        if (offerTokenMetadata && offerTokenMetadata[tokenId]) {
            return offerTokenMetadata[tokenId];
        }

        // Fallback to subnet tokens
        const subnetToken = subnetTokens?.find(t => t.id === tokenId);
        if (subnetToken) {
            return subnetToken;
        }

        // Create fallback token info
        const contractParts = tokenId.split('.');
        const tokenName = contractParts[1] || 'Unknown Token';

        return {
            id: tokenId,
            name: tokenName,
            symbol: tokenName.toUpperCase(),
            logo: '',
            image: '',
            identifier: tokenName.toLowerCase(),
            decimals: 6,
        };
    };

    return (
        <Card className="w-full h-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-xl">Offer Details</CardTitle>
                    <CardDescription>
                        Created by <span className="font-mono">{shortenAddress(offer.offerCreatorAddress)}</span>
                        {" · "}
                        <span
                            className={`cursor-help ${timeInfo.isVeryRecent
                                ? 'text-green-600 dark:text-green-400 font-medium'
                                : timeInfo.isRecent
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-muted-foreground'
                                }`}
                            title={timeInfo.absolute}
                        >
                            {timeInfo.isVeryRecent && "🟢 "}
                            {timeInfo.relative}
                        </span>
                    </CardDescription>
                </div>
                <Badge variant={getBadgeVariant(offer.status)} className="capitalize">
                    {offer.status}
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-sm font-medium mb-3 text-muted-foreground">Assets Offered:</h3>
                        <div className="space-y-3">
                            {offer.offerAssets.map((asset, index) => {
                                const tokenInfo = getTokenInfo(asset.token);
                                const formattedAmount = formatTokenAmount(asset.amount, tokenInfo);

                                return (
                                    <div key={index} className="flex items-center p-3 rounded-lg bg-muted/10 border border-border">
                                        <div className="mr-3">
                                            {tokenInfo?.logo ? (
                                                <img src={tokenInfo.logo} alt={tokenInfo.name} className="h-10 w-10 rounded-full" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-primary font-semibold">{tokenInfo?.symbol?.charAt(0) || '?'}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-grow">
                                            <p className="font-semibold">
                                                {formattedAmount}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {tokenInfo ? `${tokenInfo.name} (${tokenInfo.symbol})` : asset.token}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {offer.status === "filled" && (
                        <div className="rounded-lg p-3 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
                            <p className="text-sm font-medium">This offer has been filled</p>
                            <p className="text-xs mt-1">
                                A bid was accepted and the trade has been executed.
                            </p>
                        </div>
                    )}

                    {offer.status === "cancelled" && (
                        <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                            <p className="text-sm font-medium">This offer has been cancelled</p>
                            <p className="text-xs mt-1">
                                The creator has cancelled this offer and it is no longer available.
                            </p>
                        </div>
                    )}

                    {offer.status === "open" && (
                        <div className="rounded-lg p-3 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <p className="text-sm font-medium">This offer is active</p>
                            </div>
                            <p className="text-xs mt-1">
                                You can place a bid to exchange tokens with the creator.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter>
                {offer.status === "open" && offer.offerCreatorAddress === address && (
                    <CancelOffer intentUuid={offer.intentUuid} />
                )}
            </CardFooter>
        </Card>
    );
}