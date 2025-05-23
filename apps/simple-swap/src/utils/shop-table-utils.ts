import { ShopItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { SHOP_CATEGORIES } from '@/lib/shop/constants';
import { TrendingUp, Coins, ImageIcon, Star } from 'lucide-react';

// Helper function to get token price in USD
export const getTokenPrice = (tokenId: string, prices: Record<string, any>): number => {
    // Look for price by contract ID in the prices object
    const priceEntry = Object.entries(prices || {}).find(([key]) =>
        key.includes(tokenId) || tokenId.includes(key)
    );
    return priceEntry ? parseFloat(String(priceEntry[1])) : 0;
};

// Helper function to format token amount with decimals
export const formatTokenAmount = (atomicAmount: string | number, decimals: number): number => {
    if (!atomicAmount || decimals === undefined || decimals === null) {
        return 0;
    }

    const amount = typeof atomicAmount === 'string' ? atomicAmount : String(atomicAmount);
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || decimals < 0) {
        return 0;
    }

    return parsedAmount / Math.pow(10, decimals);
};

// Helper function to format creator display
export const formatCreator = (address: string, bnsNames: Record<string, string | null>): string => {
    const bnsName = bnsNames[address];
    if (bnsName) {
        return bnsName;
    }
    // Show shortened address as fallback
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Get type configuration
export const getTypeConfig = (type: string) => {
    switch (type) {
        case SHOP_CATEGORIES.OFFER:
            return {
                icon: TrendingUp,
                color: 'bg-primary/10 text-primary border-primary/20',
                label: 'Offer'
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

// Format price display
export const formatPrice = (
    item: ShopItem,
    subnetTokens: TokenDef[],
    formatTokenAmount: (amount: string, decimals: number) => number
) => {
    if (item.type === SHOP_CATEGORIES.OFFER) {
        const bidCount = item.metadata?.bids?.length || 0;

        if (bidCount > 0) {
            const latestBid = item.metadata?.bids?.[bidCount - 1];
            if (latestBid && latestBid.offeredAssets && latestBid.offeredAssets.length > 0) {
                // Get the first offered asset from the latest bid
                const firstAsset = latestBid.offeredAssets[0];
                const amount = firstAsset.amount || '0';

                // Try to get token info for better symbol display
                const tokenId = firstAsset.token;
                const tokenInfo = subnetTokens.find(t => t.id === tokenId);
                const symbol = tokenInfo?.symbol || tokenId?.split('.')[1] || 'STX';

                // Format the amount (assuming it's in atomic units)
                const decimals = tokenInfo?.decimals || 6;
                const formattedAmount = formatTokenAmount(amount, decimals);

                return `${formattedAmount.toLocaleString()} ${symbol}`;
            }
        }
        return 'No bids';
    }

    if (item.price) {
        return `${item.price} ${item.payToken?.symbol || 'STX'}`;
    }

    return 'Free';
}; 