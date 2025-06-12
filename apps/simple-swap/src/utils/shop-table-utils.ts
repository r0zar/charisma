import { ShopItem, OfferItem, PurchasableItem, PerpFundingRequest, isOfferItem, isPurchasableItem, isPerpFundingRequest, OfferAsset } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { SHOP_CATEGORIES } from '@/lib/shop/constants';
import { TrendingUp, Coins, ImageIcon, Star, LineChart } from 'lucide-react';

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

// Helper function to format time ago
const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
};

// Helper function to format creator display
export const formatCreator = (item: ShopItem): string => {
    if (isOfferItem(item)) {
        const bidCount = item.bids?.length || 0;
        const status = bidCount > 0 ? `${bidCount} bid${bidCount !== 1 ? 's' : ''}` : 'No bids';
        const latestBid = item.bids?.[bidCount - 1];
        const timeAgo = latestBid ? formatTimeAgo(latestBid.createdAt) : '';

        return `${status}${timeAgo ? ` • Latest ${timeAgo}` : ''}`;
    }

    if (isPerpFundingRequest(item)) {
        const offerCount = item.fundingOffers?.length || 0;
        const status = offerCount > 0 ? `${offerCount} offer${offerCount !== 1 ? 's' : ''}` : 'No offers';
        const latestOffer = item.fundingOffers?.[offerCount - 1];
        const timeAgo = latestOffer ? formatTimeAgo(latestOffer.createdAt) : '';

        return `${status}${timeAgo ? ` • Latest ${timeAgo}` : ''}`;
    }

    return 'Available';
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
        case 'perp_funding':
            return {
                icon: LineChart,
                color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
                label: 'P2P Perps'
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
    if (isOfferItem(item)) {
        const bidCount = item.bids?.length || 0;

        if (bidCount > 0) {
            const latestBid = item.bids?.[bidCount - 1];
            if (latestBid && latestBid.bidAssets && latestBid.bidAssets.length > 0) {
                // Get the first bid asset from the latest bid
                const firstAsset = latestBid.bidAssets[0];
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

    if (isPerpFundingRequest(item)) {
        // Show funding fee rate for P2P perps
        return `${item.fundingFeeRate} fee`;
    }

    if (isPurchasableItem(item) && item.price) {
        return `${item.price} ${item.payToken?.symbol || 'STX'}`;
    }

    return 'Free';
};

/**
 * Format OfferAsset amount with proper decimal handling
 */
export const formatOfferAssetAmount = (asset: OfferAsset): string => {
    if (!asset.amount || asset.amount === '0') {
        return '0';
    }

    const decimals = asset.tokenData?.decimals || 6;
    const formattedAmount = formatTokenAmount(asset.amount, decimals);

    if (formattedAmount < 0.001) {
        return formattedAmount.toExponential(3);
    } else if (formattedAmount < 1) {
        return formattedAmount.toFixed(6);
    } else {
        return formattedAmount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }
};

/**
 * Calculate total USD value for an offer
 */
export const calculateOfferValue = (offerItem: OfferItem, prices: Record<string, any>): number => {
    return offerItem.offerAssets.reduce((total, asset) => {
        const decimals = asset.tokenData?.decimals || 6;
        const formattedAmount = formatTokenAmount(asset.amount, decimals);
        const pricePerToken = getTokenPrice(asset.token, prices);
        return total + (formattedAmount * pricePerToken);
    }, 0);
};

/**
 * Get offer summary for display
 */
export const getOfferSummary = (offerItem: OfferItem): {
    tokenCount: number;
    primaryToken: string;
    totalTokens: string;
} => {
    const tokenCount = offerItem.offerAssets.length;
    const primaryToken = offerItem.offerAssets[0]?.tokenData?.symbol || 'Unknown';

    if (tokenCount === 1) {
        return {
            tokenCount,
            primaryToken,
            totalTokens: primaryToken
        };
    } else if (tokenCount <= 3) {
        return {
            tokenCount,
            primaryToken,
            totalTokens: offerItem.offerAssets.map(a => a.tokenData?.symbol || 'UNK').join(', ')
        };
    } else {
        return {
            tokenCount,
            primaryToken,
            totalTokens: `${primaryToken} & ${tokenCount - 1} more`
        };
    }
}; 