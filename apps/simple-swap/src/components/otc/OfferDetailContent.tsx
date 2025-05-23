"use client";

import React, { useState } from "react";
import { Offer, Bid } from "@/lib/otc/schema";
import { TokenDef } from "@/types/otc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package } from "lucide-react";
import OfferDetails from "@/components/otc/OfferDetails";
import { EnhancedActiveBids } from "@/components/otc/ActiveBids";

interface OfferDetailContentProps {
    offer: Offer;
    subnetTokens: TokenDef[];
    offerTokenMetadata: Record<string, any>;
}

export function OfferDetailContent({ offer, subnetTokens, offerTokenMetadata }: OfferDetailContentProps) {
    const [bids, setBids] = useState<Bid[]>(offer.bids || []);

    const handleBidUpdate = (bidId: string, newStatus: Bid['status']) => {
        setBids(prevBids =>
            prevBids.map(bid =>
                bid.bidId === bidId
                    ? { ...bid, status: newStatus }
                    : bid
            )
        );
    };

    const bidCount = bids.length;

    return (
        <>
            {/* Offer Details */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Offer Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <OfferDetails
                        offer={offer}
                        subnetTokens={subnetTokens}
                        offerTokenMetadata={offerTokenMetadata}
                    />
                </CardContent>
            </Card>

            {/* Active Bids */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Bidding Activity
                        <Badge variant="outline" className="ml-auto">
                            {bidCount} bid{bidCount !== 1 ? 's' : ''}
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <EnhancedActiveBids
                        bids={bids}
                        subnetTokens={subnetTokens}
                        offer={offer as any}
                        onBidUpdate={handleBidUpdate}
                    />
                </CardContent>
            </Card>
        </>
    );
} 