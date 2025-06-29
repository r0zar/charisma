import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ShopItem as ShopItemInterface, isOfferItem, isPurchasableItem } from '@/types/shop';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ShoppingCart,
    CreditCard,
    Coins,
    ImageIcon,
    TrendingUp,
    Clock,
    Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { request } from '@stacks/connect';
import { Pc, uintCV } from '@stacks/transactions';
import { useWallet } from '@/contexts/wallet-context';
import { SHOP_CONTRACTS, SHOP_CATEGORIES } from '@/lib/shop/constants';

interface ShopItemProps {
    item: ShopItemInterface;
}

const ShopItem: React.FC<ShopItemProps> = ({ item }) => {
    // Add state for dialog open/close
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    // Add state for client-side rendering check
    const [isMounted, setIsMounted] = useState(false);

    const router = useRouter();
    const { address, balances, prices } = useWallet();

    // Get a clean title without the symbol in parentheses if present
    const cleanTitle = item.title.replace(/\s*\([^)]*\)\s*/, '');

    // Format the price with currency - offers don't have fixed prices
    const formattedPrice = item.type === SHOP_CATEGORIES.OFFER
        ? 'Auction-style bidding'
        : item.price
            ? `${item.price} ${item.payToken?.symbol || 'STX'}`
            : 'Free';

    // Use useEffect to safely set isMounted after component mounts
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Get energy balance using the constant
    const energyTokenKey = `${SHOP_CONTRACTS.ENERGY}::energy`;
    const energyBalance = balances.fungible_tokens?.[energyTokenKey]?.balance;

    // Get type-specific icon and color using theme system
    const getTypeConfig = (type: string) => {
        switch (type) {
            case SHOP_CATEGORIES.OFFER:
                return {
                    icon: TrendingUp,
                    color: 'bg-primary/10 text-primary border-primary/20',
                    label: 'OTC Offer'
                };
            case SHOP_CATEGORIES.TOKEN:
                return {
                    icon: Coins,
                    color: 'bg-secondary/10 text-secondary border-secondary/20',
                    label: 'Token'
                };
            case SHOP_CATEGORIES.NFT:
                return {
                    icon: ImageIcon,
                    color: 'bg-accent/50 text-accent-foreground border-border',
                    label: 'NFT'
                };
            default:
                return {
                    icon: Star,
                    color: 'bg-muted text-muted-foreground border-border',
                    label: 'Item'
                };
        }
    };

    const typeConfig = getTypeConfig(item.type);
    const TypeIcon = typeConfig.icon;

    // Component to render multiple offer asset images
    const OfferAssetsDisplay = ({ assets }: { assets: any[] }) => {
        if (!assets || assets.length === 0) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-muted/30">
                    <TrendingUp className="h-12 w-12 text-muted-foreground" />
                </div>
            );
        }

        // Helper function to render a single asset image with fallback
        const renderAssetImage = (asset: any, index: number) => (
            <div key={index} className="relative bg-muted/20">
                {asset?.image ? (
                    <Image
                        src={asset.image}
                        alt={asset?.symbol || 'Token'}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/30">
                        <div className="text-center">
                            <Coins className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                            <span className="text-xs text-muted-foreground font-medium">
                                {asset?.symbol || 'Token'}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );

        if (assets.length === 1) {
            return renderAssetImage(assets[0], 0);
        }

        if (assets.length === 2) {
            return (
                <div className="grid grid-cols-2 gap-1 w-full h-full">
                    {assets.slice(0, 2).map((asset, index) => renderAssetImage(asset, index))}
                </div>
            );
        }

        if (assets.length === 3) {
            return (
                <div className="grid grid-cols-2 gap-1 w-full h-full">
                    {renderAssetImage(assets[0], 0)}
                    <div className="grid grid-rows-2 gap-1">
                        {assets.slice(1, 3).map((asset, index) => renderAssetImage(asset, index + 1))}
                    </div>
                </div>
            );
        }

        // 4 or more assets - 2x2 grid with counter
        return (
            <div className="grid grid-cols-2 gap-1 w-full h-full">
                {assets.slice(0, 3).map((asset, index) => renderAssetImage(asset, index))}
                <div className="relative bg-muted/80 flex items-center justify-center">
                    <span className="text-xs font-semibold text-muted-foreground">
                        +{assets.length - 3}
                    </span>
                </div>
            </div>
        );
    };

    const handlePurchase = async () => {
        console.log("Purchasing item:", item.title, "for", formattedPrice);

        try {
            const result = await request('stx_callContract', {
                contract: item.vault as any,
                functionName: 'claim',
                functionArgs: [uintCV(energyBalance)],
                postConditions: [
                    Pc.principal(address).willSendLte(energyBalance).ft(SHOP_CONTRACTS.ENERGY, 'energy'),
                    Pc.principal(SHOP_CONTRACTS.HOOT_FARM).willSendLte(energyBalance).ft(SHOP_CONTRACTS.HOOT_TOKEN, 'hooter')
                ],
                network: 'mainnet'
            });
            console.log("Result:", result);
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Purchase failed:", error);
        }
    };

    const handleItemClick = () => {
        if (!isMounted) return;

        // Check if item is an offer type
        if (item.type === SHOP_CATEGORIES.OFFER) {
            router.push(`/shop/${item.id}`);
        } else {
            setIsDialogOpen(true);
        }
    };

    return (
        <div suppressHydrationWarning>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <div
                    className="group cursor-pointer bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 hover:-translate-y-1"
                    onClick={handleItemClick}
                >
                    {/* Image Section */}
                    <div className="relative h-32 bg-muted/30 overflow-hidden">
                        {isOfferItem(item) ? (
                            <OfferAssetsDisplay assets={item.offerAssets.map(asset => asset.tokenData).filter(Boolean) || []} />
                        ) : (
                            <Image
                                src={item.image || '/images/placeholder.png'}
                                alt={cleanTitle}
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                        )}

                        {/* Type Badge */}
                        <div className="absolute top-2 left-2 z-20">
                            <Badge
                                variant="outline"
                                className={`text-xs px-2 py-1 ${typeConfig.color} backdrop-blur-sm`}
                            >
                                <TypeIcon className="h-3 w-3 mr-1" />
                                {typeConfig.label}
                            </Badge>
                        </div>

                        {/* Featured/Special Badge */}
                        {item.id === 'hooter-farm' && (
                            <div className="absolute top-2 right-2 z-20">
                                <Badge className="text-xs px-2 py-1 bg-gradient-to-r from-primary to-secondary text-primary-foreground border-0">
                                    <Star className="h-3 w-3 mr-1" />
                                    Featured
                                </Badge>
                            </div>
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute top-0 left-0 right-0 bottom-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                            <button className="cursor-pointer button-primary text-sm py-2 px-4">
                                <CreditCard className="h-4 w-4 mr-2" />
                                {item.type === SHOP_CATEGORIES.OFFER ? 'View Offer' : 'Purchase'}
                            </button>
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-3 space-y-2">
                        {/* Title */}
                        <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                            {isOfferItem(item) && item.offerAssets && item.offerAssets.length > 0
                                ? (() => {
                                    const symbols = item.offerAssets
                                        .map((asset) => asset.tokenData?.symbol || asset.token?.split('.')[1])
                                        .filter(Boolean);

                                    if (symbols.length === 0) {
                                        return 'Multi-Token Offer';
                                    } else if (symbols.length <= 3) {
                                        return `${symbols.join(', ')} Offer`;
                                    } else {
                                        return `${symbols.slice(0, 2).join(', ')} & ${symbols.length - 2} More Offer`;
                                    }
                                })()
                                : cleanTitle
                            }
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                            {item.description}
                        </p>

                        {/* Price and Action Section */}
                        <div className="flex items-center justify-between pt-1">
                            {isOfferItem(item) ? (
                                // Show bid information for offers
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">
                                        {item.bids && item.bids.length > 0 ? 'Latest Bid' : 'Bids'}
                                    </span>
                                    {item.bids && item.bids.length > 0 ? (
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3 text-primary" />
                                            <span className="font-semibold text-sm">
                                                {item.bids[item.bids.length - 1]?.bidAssets?.[0]?.amount || 'N/A'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {item.bids[item.bids.length - 1]?.bidAssets?.[0]?.token?.split('.')[1] || 'STX'}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className="font-semibold text-sm text-muted-foreground">
                                                No bids yet
                                            </span>
                                        </div>
                                    )}
                                    {item.bids && item.bids.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            {item.bids.length} bid{item.bids.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            ) : isPurchasableItem(item) && item.price ? (
                                // Show price for regular items
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Price</span>
                                    <div className="flex items-center gap-1">
                                        {item.payToken?.image ? (
                                            <Image
                                                src={item.payToken.image}
                                                alt={item.payToken.symbol || ''}
                                                width={16}
                                                height={16}
                                                className="rounded-full"
                                            />
                                        ) : (
                                            <Coins className="h-4 w-4 text-primary" />
                                        )}
                                        <span className="font-semibold text-sm">
                                            {item.price}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {item.payToken?.symbol || 'STX'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                // Show free for items without price
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Price</span>
                                    <span className="font-semibold text-sm text-secondary">Free</span>
                                </div>
                            )}

                            {/* Action Button */}
                            <Button size="sm" variant="outline" className="text-xs px-3 py-1 h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/50">
                                {item.type === SHOP_CATEGORIES.OFFER ? (
                                    <>
                                        <TrendingUp className="h-3 w-3 mr-1" />
                                        Bid
                                    </>
                                ) : (
                                    <>
                                        <ShoppingCart className="h-3 w-3 mr-1" />
                                        Buy
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Additional Info for Offers */}
                        {isOfferItem(item) && item.offerAssets && (
                            <div className="pt-2 border-t border-border/50">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">
                                        Offering {item.offerAssets.length} token{item.offerAssets.length !== 1 ? 's' : ''}:
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {item.offerAssets.slice(0, 3).map((asset, index: number) => (
                                            <div key={index} className="flex items-center gap-1 bg-muted/30 rounded px-2 py-1">
                                                {asset.tokenData?.image ? (
                                                    <Image
                                                        src={asset.tokenData.image}
                                                        alt=""
                                                        width={12}
                                                        height={12}
                                                        className="rounded-full"
                                                    />
                                                ) : (
                                                    <Coins className="h-3 w-3 text-muted-foreground" />
                                                )}
                                                <span className="text-xs font-medium">
                                                    {asset.tokenData?.symbol || asset.token?.split('.')[1] || 'Token'}
                                                </span>
                                            </div>
                                        ))}
                                        {item.offerAssets.length > 3 && (
                                            <div className="flex items-center gap-1 bg-muted/30 rounded px-2 py-1">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    +{item.offerAssets.length - 3} more
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Additional Info for Featured Items */}
                        {item.id === 'hooter-farm' && isPurchasableItem(item) && item.metadata?.maxQuantity && (
                            <div className="pt-2 border-t border-border/50">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Max per purchase:</span>
                                    <span className="font-medium">{item.metadata.maxQuantity}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Purchase Dialog - Only for non-offer items */}
                {isMounted && item.type !== SHOP_CATEGORIES.OFFER && (
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <TypeIcon className="h-5 w-5" />
                                Confirm Purchase
                            </DialogTitle>
                            <DialogDescription>
                                You are about to purchase "{cleanTitle}".
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border">
                                    <Image
                                        src={item.image || '/images/placeholder.png'}
                                        alt={cleanTitle}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold">{cleanTitle}</h4>
                                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={typeConfig.color}>
                                            <TypeIcon className="h-3 w-3 mr-1" />
                                            {typeConfig.label}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Price breakdown */}
                            {item.type !== (SHOP_CATEGORIES.OFFER as string) && (
                                <div className="bg-muted/30 p-3 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Total Cost:</span>
                                        <div className="flex items-center gap-2">
                                            {item.payToken?.image && (
                                                <Image
                                                    src={item.payToken.image}
                                                    alt={item.payToken.symbol || ''}
                                                    width={20}
                                                    height={20}
                                                    className="rounded-full"
                                                />
                                            )}
                                            <span className="font-semibold">{formattedPrice}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                className="hover:bg-muted"
                            >
                                Cancel
                            </Button>
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    await handlePurchase();
                                }}
                                className="button-primary"
                            >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Confirm Purchase
                            </button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};

export default ShopItem;