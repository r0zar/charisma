'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { request } from '@stacks/connect';
import { Coins, Zap, Check, Loader2 } from 'lucide-react';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';

// Interface shared with the parent component
interface HoldToEarnVault {
    contractId: string;
    type?: string;
    name: string;
    description: string;
    image: string;
    base: string;
    engineContractId: `${string}.${string}`;
}

interface EnergyVaultCardProps {
    vault: HoldToEarnVault;
}

export function EnergyVaultCard({ vault }: EnergyVaultCardProps) {
    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [harvestSuccess, setHarvestSuccess] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    // useEffect to fetch the base token metadata
    useEffect(() => {
        const fetchTokenMetadata = async () => {
            try {
                setIsLoading(true);
                const metadata = await getTokenMetadataCached(vault.base);
                setTokenMetadata(metadata);
            } catch (error) {
                console.error("Failed to fetch token metadata:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTokenMetadata();
    }, [vault.base]);

    // request contract call to tap for energy
    const handleTapForEnergy = async () => {
        try {
            setIsHarvesting(true);
            const response = await request('stx_callContract', {
                contract: vault.engineContractId,
                functionName: 'tap',
                functionArgs: [],
            });

            console.log(response);
            setHarvestSuccess(true);

            // Reset success state after 2 seconds
            setTimeout(() => {
                setHarvestSuccess(false);
            }, 2000);
        } catch (error) {
            console.error("Harvesting failed:", error);
        } finally {
            setIsHarvesting(false);
        }
    };

    return (
        <Card
            className={`relative h-full flex flex-col overflow-hidden transition-all duration-300
                border-primary/10 p-5 rounded-xl glass-card
                ${isHovered ? 'scale-[1.01] shadow-lg' : 'hover:shadow-md'}
                ${isLoading ? 'animate-pulse-medium' : 'animate-appear'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 bg-card/80 flex items-center justify-center z-10">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            )}

            {/* Energy indicator at top */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    <Zap className={`h-4 w-4 ${isHovered ? 'animate-pulse-glow' : ''}`} />
                </div>
                <span className="text-sm font-medium text-primary">Earn Energy</span>
            </div>

            {/* Primary focus: Token required for rewards */}
            {tokenMetadata && (
                <div className="flex gap-4 mb-5">
                    {/* Token image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md bg-muted flex-shrink-0 border border-primary/20">
                        <Image
                            width={150}
                            height={150}
                            src={tokenMetadata?.image || `https://placehold.co/150x150?text=${vault.base || 'Token'}`}
                            alt={tokenMetadata?.name || vault.base || 'Token'}
                            className={`w-full h-full object-cover ${isHovered ? 'scale-105' : ''} transition-transform duration-300`}
                        />
                    </div>

                    {/* Token information */}
                    <div className="flex flex-col justify-center">
                        <h3 className="text-lg font-semibold text-foreground mb-1 tracking-tight">
                            {tokenMetadata?.name || vault.base || 'Token'}
                        </h3>

                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-xs px-2 py-0.5">
                                {tokenMetadata?.symbol || vault.base || 'TOK'}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                                Hold to earn
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Token description */}
            <p className="text-sm text-muted-foreground mb-6 flex-grow">
                {vault.description || "Hold tokens to earn energy rewards over time."}
            </p>

            {/* Vault metadata and action button */}
            <div className="flex items-center justify-between pt-4 border-t border-border/30 mt-auto">
                <div className="flex items-center gap-2">
                    <Image
                        width={40}
                        height={40}
                        src={vault.image || 'https://placehold.co/40x40?text=V'}
                        alt={vault.name}
                        className="w-6 h-6 rounded-full object-cover border border-primary/20"
                    />
                    <span className="text-xs text-muted-foreground truncate">
                        {vault.name}
                    </span>
                </div>

                <Button
                    variant={harvestSuccess ? "secondary" : "default"}
                    size="sm"
                    className={`transition-all duration-300 ${harvestSuccess ? 'bg-success text-white' : ''}`}
                    onClick={handleTapForEnergy}
                    disabled={isHarvesting || isLoading}
                >
                    {isHarvesting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            <span>Harvesting</span>
                        </>
                    ) : harvestSuccess ? (
                        <>
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            <span>Harvested!</span>
                        </>
                    ) : (
                        <>
                            <Zap className={`h-3.5 w-3.5 mr-1.5 ${isHovered ? 'animate-pulse-fast' : ''}`} />
                            <span>Harvest Energy</span>
                        </>
                    )}
                </Button>
            </div>

            {/* Subtle glow effect when hovered */}
            {isHovered && (
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 to-transparent rounded-xl" />
            )}
        </Card>
    );
}