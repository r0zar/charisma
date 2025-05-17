'use client';

import Link from 'next/link';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Zap } from 'lucide-react';
import { TokenCacheData } from '@repo/tokens';

// Interface shared with the parent component
interface Vault {
    contractId: string;
    type?: string;
    name: string;
    symbol?: string;
    description: string;
    image: string;
    externalPoolId?: string;
    engineContractId?: string;
    reservesA?: number;
    reservesB?: number;
    tokenForRewards?: TokenCacheData;
}

interface EnergyVaultCardProps {
    vault: Vault;
}

export function EnergyVaultCard({ vault }: EnergyVaultCardProps) {
    return (
        <Link href={`/energy/${vault.contractId}`} passHref>
            <Card className="h-full flex flex-col overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 group border-primary/10 p-4">
                {/* Primary focus: Token required for rewards */}
                {vault.tokenForRewards && (
                    <div className="flex items-center gap-4 mb-4">
                        {/* Token image */}
                        <div className="w-20 h-20 rounded-lg overflow-hidden shadow-sm bg-primary/5 flex-shrink-0 border border-primary/20 p-1">
                            <img
                                src={vault.tokenForRewards?.image || `https://placehold.co/150x150?text=${vault.tokenForRewards?.symbol || 'Token'}`}
                                alt={vault.tokenForRewards?.name || 'Token'}
                                className="w-full h-full object-cover rounded"
                            />
                        </div>

                        {/* Token information */}
                        <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <Coins className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium text-foreground">
                                    Hold to earn rewards:
                                </span>
                            </div>

                            <h3 className="text-lg font-semibold text-primary mb-1">
                                {vault.tokenForRewards?.name || 'Token'}
                            </h3>

                            <Badge variant="outline" className="w-fit">
                                {vault.tokenForRewards?.symbol || 'TOK'}
                            </Badge>
                        </div>
                    </div>
                )}

                {/* Energy indicator */}
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Earn Energy</span>
                </div>

                {/* Token description (if available) or vault description as fallback */}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-grow">
                    {vault.tokenForRewards?.description || vault.description || "Hold tokens to earn energy rewards."}
                </p>

                {/* Vault metadata as footnote */}
                <div className="flex items-center justify-between pt-3 border-t border-border/30 mt-auto">
                    <div className="flex items-center gap-2">
                        <img
                            src={vault.image || 'https://placehold.co/40x40?text=V'}
                            alt={vault.name}
                            className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="text-xs text-muted-foreground truncate">
                            Vault: {vault.name}
                        </span>
                    </div>

                    <Badge variant="secondary" className="text-xs">
                        {vault.type || 'ENERGY'}
                    </Badge>
                </div>
            </Card>
        </Link>
    );
} 