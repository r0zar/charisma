import { TokenCacheData } from "@repo/tokens";
import { Offer, Bid } from "@/lib/otc/schema";

// Base interface for all marketplace items
interface BaseShopItem {
    id: string;
    title: string;
    description: string;
    image?: string | null;
    createdAt?: number;
}

// Specific interface for regular purchasable items (tokens, NFTs)
export interface PurchasableItem extends BaseShopItem {
    type: 'token' | 'nft';
    price: number;
    currency: string;
    payToken?: TokenCacheData;
    vault?: string;
    metadata: {
        contractId: string;
        tokenSymbol?: string;
        decimals?: number;
        totalSupply?: string | null;
        maxQuantity?: number;
        edition?: string | number;
        artist?: string;
        blockchain?: string;
    };
}

// Token amount with metadata for offers
export interface OfferAsset {
    token: string; // Contract ID
    amount: string; // Atomic units as string
    tokenData?: TokenCacheData; // Enhanced token metadata
}

// Specific interface for OTC offers
export interface OfferItem extends BaseShopItem {
    type: 'offer';
    // Offers don't have fixed prices - they're bid on
    price?: never;
    currency?: never;
    payToken?: never;
    vault?: never;

    // Offer-specific data
    intentUuid: string;
    offerCreatorAddress: string;
    offerAssets: OfferAsset[]; // Properly typed with amounts
    status: "open" | "filled" | "cancelled";
    bids: Bid[];
}

// Union type for all shop items
export type ShopItem = PurchasableItem | OfferItem;

// Type guards for better type safety
export const isPurchasableItem = (item: ShopItem): item is PurchasableItem => {
    return item.type === 'token' || item.type === 'nft';
};

export const isOfferItem = (item: ShopItem): item is OfferItem => {
    return item.type === 'offer';
};

// Helper type for the old interface during migration
export type LegacyShopItem = {
    id: string;
    type: 'nft' | 'token' | 'offer';
    title: string;
    description: string;
    price?: number;
    currency?: string;
    image?: string | null;
    payToken?: TokenCacheData;
    vault?: string;
    metadata: {
        contractId: string;
        tokenSymbol?: string;
        amount?: string;
        decimals?: number;
        totalSupply?: string | null;
        maxQuantity?: number;
        edition?: string | number;
        artist?: string;
        blockchain?: string;
        offerCreatorAddress?: string;
        offerAssets?: TokenCacheData[];
        offerUuid?: string;
        createdAt?: string | number;
        bids?: Bid[];
        [key: string]: any;
    };
};