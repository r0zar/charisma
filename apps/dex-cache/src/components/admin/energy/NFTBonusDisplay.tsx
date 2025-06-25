'use client';

import { useState, useEffect } from 'react';
import { Crown, Feather, Cpu, Shield, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useApp } from '@/lib/context/app-context';
import { useNFTBonuses } from '@/lib/nft-service';

interface NFTBonus {
    id: string;
    name: string;
    contractId: string;
    icon: React.ComponentType<{ className?: string }>;
    bonusType: 'energy_generation' | 'fee_discount' | 'capacity_increase';
    bonusValue: number;
    isActive: boolean;
    ownedCount: number;
    description: string;
    rarity: 'common' | 'rare' | 'legendary';
    glowColor: string;
}

interface NFTBonusDisplayProps {
    userAddress?: string;
    className?: string;
}

export function NFTBonusDisplay({ userAddress, className }: NFTBonusDisplayProps) {
    const { walletState } = useApp();
    const targetAddress = userAddress || walletState.address;
    
    // Use the new NFT service hook
    const { bonuses: realNFTBonuses, isLoading: nftLoading, error: nftError } = useNFTBonuses(targetAddress);
    
    const [nftBonuses, setNftBonuses] = useState<NFTBonus[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Convert real NFT bonuses to UI format
    useEffect(() => {
        if (nftLoading) {
            setIsLoading(true);
            return;
        }

        const bonuses: NFTBonus[] = [
            {
                id: 'energetic-welsh',
                name: 'Welsh Collections',
                contractId: 'various-welsh-contracts',
                icon: Crown,
                bonusType: 'energy_generation',
                bonusValue: realNFTBonuses?.energyGenerationBonus || 0,
                isActive: (realNFTBonuses?.totalWelshCount || 0) > 0,
                ownedCount: realNFTBonuses?.totalWelshCount || 0,
                description: 'Energy generation bonus from Welsh NFT collections (+5% per NFT)',
                rarity: 'rare',
                glowColor: 'rgba(34, 197, 94, 0.3)'
            },
            {
                id: 'raven-wisdom',
                name: 'Raven Collections',
                contractId: 'various-raven-contracts',
                icon: Feather,
                bonusType: 'fee_discount',
                bonusValue: realNFTBonuses?.feeDiscountBonus || 0,
                isActive: (realNFTBonuses?.totalRavenCount || 0) > 0,
                ownedCount: realNFTBonuses?.totalRavenCount || 0,
                description: 'Fee discounts from Raven NFT collections (25% base + variable based on highest Raven ID)',
                rarity: 'legendary',
                glowColor: 'rgba(147, 51, 234, 0.3)'
            },
            {
                id: 'power-cells',
                name: 'Memobot Collections',
                contractId: 'various-memobot-contracts',
                icon: Cpu,
                bonusType: 'capacity_increase',
                bonusValue: (realNFTBonuses?.capacityBonus || 0) / 1000000, // Convert from micro units
                isActive: (realNFTBonuses?.totalMemobotCount || 0) > 0,
                ownedCount: realNFTBonuses?.totalMemobotCount || 0,
                description: 'Energy capacity increase from Memobot NFT collections (+10 energy per NFT)',
                rarity: 'rare',
                glowColor: 'rgba(59, 130, 246, 0.3)'
            }
        ];

        setNftBonuses(bonuses);
        setIsLoading(false);

        if (realNFTBonuses && (realNFTBonuses.totalWelshCount > 0 || realNFTBonuses.totalRavenCount > 0 || realNFTBonuses.totalMemobotCount > 0)) {
            console.log('🎯 Real NFT bonuses loaded:', {
                welsh: `${realNFTBonuses.totalWelshCount} NFTs = +${realNFTBonuses.energyGenerationBonus}% energy generation`,
                raven: `${realNFTBonuses.totalRavenCount} NFTs = -${realNFTBonuses.feeDiscountBonus}% fees`,
                memobot: `${realNFTBonuses.totalMemobotCount} NFTs = +${realNFTBonuses.capacityBonus / 1000000} energy capacity`
            });
            console.log('🔍 Raw feeDiscountBonus value:', realNFTBonuses.feeDiscountBonus);
            console.log('🔍 Bonus value in UI component:', realNFTBonuses?.feeDiscountBonus || 0);
            console.log('🔍 Type of feeDiscountBonus:', typeof realNFTBonuses.feeDiscountBonus);
            console.log('🔍 Full realNFTBonuses object:', realNFTBonuses);
        }
    }, [realNFTBonuses, nftLoading]);

    const getRarityStyles = (rarity: string) => {
        switch (rarity) {
            case 'legendary':
                return {
                    border: 'border-purple-500/50',
                    bg: 'bg-purple-500/10',
                    text: 'text-purple-400',
                    glow: 'shadow-purple-500/20'
                };
            case 'rare':
                return {
                    border: 'border-blue-500/50',
                    bg: 'bg-blue-500/10',
                    text: 'text-blue-400',
                    glow: 'shadow-blue-500/20'
                };
            default:
                return {
                    border: 'border-gray-500/50',
                    bg: 'bg-gray-500/10',
                    text: 'text-gray-400',
                    glow: 'shadow-gray-500/20'
                };
        }
    };

    const getBonusTypeIcon = (bonusType: string) => {
        switch (bonusType) {
            case 'energy_generation':
                return <Plus className="h-3 w-3 text-green-400" />;
            case 'fee_discount':
                return <Shield className="h-3 w-3 text-purple-400" />;
            case 'capacity_increase':
                return <Cpu className="h-3 w-3 text-blue-400" />;
            default:
                return null;
        }
    };

    const formatBonusValue = (bonus: NFTBonus) => {
        switch (bonus.bonusType) {
            case 'energy_generation':
                return `+${bonus.bonusValue}%`;
            case 'fee_discount':
                return `-${bonus.bonusValue}%`;
            case 'capacity_increase':
                return `+${bonus.bonusValue}`;
            default:
                return bonus.bonusValue.toString();
        }
    };

    const activeBonuses = nftBonuses.filter(bonus => bonus.isActive);
    const totalEnergyBonus = nftBonuses
        .filter(b => b.bonusType === 'energy_generation' && b.isActive)
        .reduce((sum, b) => sum + b.bonusValue, 0);

    if (isLoading) {
        return (
            <div className={cn("glass-card p-4", className)}>
                <div className="animate-pulse">
                    <div className="h-4 bg-muted/30 rounded w-32 mb-3"></div>
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 bg-muted/20 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (nftError) {
        return (
            <div className={cn("glass-card p-4", className)}>
                <div className="text-center p-4 text-muted-foreground">
                    <div className="text-sm text-red-400">Error loading NFT bonuses</div>
                    <div className="text-xs mt-1">{nftError}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("glass-card p-4", className)}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-sm">NFT Bonuses</h3>
                    <p className="text-xs text-muted-foreground">Status effects from owned NFTs</p>
                </div>
                
                {activeBonuses.length > 0 && (
                    <Badge variant="outline" className="text-green-400 border-green-400/50">
                        {activeBonuses.length} Active
                    </Badge>
                )}
            </div>

            {/* Active Bonuses Summary */}
            {activeBonuses.length > 0 && (
                <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="text-xs text-primary font-medium mb-2">Active Effects</div>
                    <div className="grid grid-cols-1 gap-1 text-xs">
                        {totalEnergyBonus > 0 && (
                            <div className="flex items-center gap-2">
                                <Plus className="h-3 w-3 text-green-400" />
                                <span>Energy Generation: +{totalEnergyBonus}%</span>
                            </div>
                        )}
                        {nftBonuses.find(b => b.bonusType === 'fee_discount' && b.isActive) && (
                            <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3 text-purple-400" />
                                <span>Fee Discount: {formatBonusValue(nftBonuses.find(b => b.bonusType === 'fee_discount' && b.isActive)!)}</span>
                            </div>
                        )}
                        {nftBonuses.find(b => b.bonusType === 'capacity_increase' && b.isActive) && (
                            <div className="flex items-center gap-2">
                                <Cpu className="h-3 w-3 text-blue-400" />
                                <span>Extra Capacity: {formatBonusValue(nftBonuses.find(b => b.bonusType === 'capacity_increase' && b.isActive)!)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* NFT Cards */}
            <div className="space-y-3">
                {nftBonuses.map((bonus) => {
                    const rarityStyles = getRarityStyles(bonus.rarity);
                    const IconComponent = bonus.icon;

                    return (
                        <TooltipProvider key={bonus.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            "relative p-3 rounded-lg border-2 transition-all duration-300",
                                            bonus.isActive 
                                                ? `${rarityStyles.border} ${rarityStyles.bg} shadow-lg ${rarityStyles.glow}`
                                                : "border-muted/30 bg-muted/10 opacity-60"
                                        )}
                                        style={{
                                            boxShadow: bonus.isActive 
                                                ? `0 0 20px ${bonus.glowColor}` 
                                                : 'none'
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* NFT Icon */}
                                            <div className={cn(
                                                "h-10 w-10 rounded-lg flex items-center justify-center",
                                                bonus.isActive 
                                                    ? rarityStyles.bg 
                                                    : "bg-muted/20"
                                            )}>
                                                <IconComponent className={cn(
                                                    "h-5 w-5",
                                                    bonus.isActive 
                                                        ? rarityStyles.text 
                                                        : "text-muted-foreground"
                                                )} />
                                            </div>

                                            {/* NFT Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-medium text-sm truncate">
                                                        {bonus.name}
                                                    </div>
                                                    {bonus.isActive && (
                                                        <Badge 
                                                            variant="outline"
                                                            className={cn(
                                                                "text-xs px-1 py-0",
                                                                rarityStyles.text,
                                                                rarityStyles.border
                                                            )}
                                                        >
                                                            {bonus.rarity}
                                                        </Badge>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                    {getBonusTypeIcon(bonus.bonusType)}
                                                    <span className="text-xs text-muted-foreground">
                                                        {bonus.isActive 
                                                            ? `${formatBonusValue(bonus)} (${bonus.ownedCount} owned)`
                                                            : 'Not owned'
                                                        }
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Active Indicator */}
                                            {bonus.isActive && (
                                                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                                            )}
                                        </div>

                                        {/* Glow Effect for Active NFTs */}
                                        {bonus.isActive && (
                                            <div 
                                                className="absolute inset-0 rounded-lg pointer-events-none opacity-50"
                                                style={{
                                                    background: `radial-gradient(circle at center, ${bonus.glowColor} 0%, transparent 70%)`,
                                                    filter: 'blur(10px)'
                                                }}
                                            />
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="max-w-xs">
                                        <div className="font-medium">{bonus.name}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {bonus.description}
                                        </div>
                                        {bonus.isActive && (
                                            <div className="text-xs text-green-400 mt-1">
                                                Active: {formatBonusValue(bonus)}
                                            </div>
                                        )}
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                })}
            </div>

            {/* No Active Bonuses Message */}
            {activeBonuses.length === 0 && !isLoading && (
                <div className="text-center p-4 text-muted-foreground">
                    <div className="text-sm">No NFT bonuses active</div>
                    <div className="text-xs mt-1">
                        Acquire Welsh, Raven, or Memobot NFTs to unlock energy bonuses
                    </div>
                </div>
            )}
        </div>
    );
}