"use client";

import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Offer } from "@/lib/otc/schema";
import { getPrimaryBnsName } from '@repo/polyglot';

interface CreatorInfoProps {
    offer: Offer;
}

export function CreatorInfo({ offer }: CreatorInfoProps) {
    const [bnsName, setBnsName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBnsName = async () => {
            try {
                const name = await getPrimaryBnsName(offer.offerCreatorAddress, 'stacks');
                setBnsName(name);
            } catch (error) {
                console.warn(`Failed to fetch BNS for ${offer.offerCreatorAddress}:`, error);
                setBnsName(null);
            } finally {
                setLoading(false);
            }
        };

        fetchBnsName();
    }, [offer.offerCreatorAddress]);

    const displayName = loading
        ? "Loading..."
        : bnsName || `${offer.offerCreatorAddress.slice(0, 8)}...${offer.offerCreatorAddress.slice(-4)}`;

    const displayClass = loading
        ? "font-medium text-sm text-muted-foreground animate-pulse"
        : bnsName
            ? "font-medium text-sm text-primary hover:text-primary/80 cursor-help transition-colors truncate"
            : "font-medium text-sm font-mono text-muted-foreground";

    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
                <div
                    className={displayClass}
                    title={loading ? "Loading BNS name..." : bnsName ? `${bnsName} (${offer.offerCreatorAddress})` : offer.offerCreatorAddress}
                >
                    {displayName}
                </div>
                <div className="text-xs text-muted-foreground">
                    {loading ? "Verifying identity..." : bnsName ? "Verified Creator" : "Creator"}
                </div>
            </div>
        </div>
    );
} 