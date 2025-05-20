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

interface OfferDetailsProps {
    offer: Offer;
    subnetTokens: TokenDef[];
}

export default function EnhancedOfferDetails({ offer, subnetTokens }: OfferDetailsProps) {
    const { address } = useWallet();
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

    return (
        <Card className="w-full h-full">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                    <CardTitle className="text-xl">Offer Details</CardTitle>
                    <CardDescription>
                        Created by <span className="font-mono">{shortenAddress(offer.offerCreatorAddress)}</span>
                        {" · "}
                        <span title={new Date(offer.createdAt).toLocaleString()}>
                            {getTimeAgo(offer.createdAt)}
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
                                const tokenInfo = subnetTokens?.find(t => t.id === asset.token);
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