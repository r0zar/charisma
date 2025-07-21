import { TokenCacheData } from "@/lib/contract-registry-adapter";
import { Bid } from "@/lib/otc/schema";

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
        total_supply?: string | null;
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

// Funding offer interface (similar to Bid)
export interface FundingOffer {
    funderId: string;
    funderCollateralIntent: string; // Signed TRANSFER_TOKENS_LTE intent JSON
    maxCollateralOffered: string; // Maximum collateral they'll provide
    requestedFeeRate: string; // Fee rate they want (e.g. "3.5%")
    message?: string; // Optional message to trader
    createdAt: number;
    status: 'pending' | 'accepted' | 'rejected';
    fundingOfferId: string; // Unique ID for this funding offer
}

// P2P Perp funding request interface
export interface PerpFundingRequest extends BaseShopItem {
    type: 'perp_funding';
    // No price/currency - funded through offers
    price?: never;
    currency?: never;
    payToken?: never;
    vault?: never;

    // Links to perpetual position
    perpUuid: string;
    traderId: string;
    traderMarginIntent: string; // Signed REDEEM_BEARER intent JSON

    // Position details for display
    direction: 'long' | 'short';
    leverage: number;
    positionSize: string; // e.g. "$1000"
    entryPrice: string; // e.g. "$45.50" 
    liquidationPrice: string; // e.g. "$40.25"

    // Economic terms
    traderMargin: string; // What trader is putting up
    maxCollateralNeeded: string; // Maximum collateral needed from funders
    fundingFeeRate: string; // Guaranteed fee rate for funders

    // Token information
    baseToken: string; // STX, BTC, etc. (what position is on)
    quoteToken: string; // USDT, etc. (what margin/collateral is in)
    marginToken: string; // Usually same as quoteToken

    // Status and lifecycle
    fundingStatus: "seeking" | "funded" | "expired" | "settled";
    expiresAt: number; // When funding request expires
    funderId?: string; // Who funded it (when funded)
    fundedAt?: number; // When it was funded
    settledAt?: number; // When position was settled

    // Funding offers (like bids in OTC)
    fundingOffers: FundingOffer[];
}

// Union type for all shop items
export type ShopItem = PurchasableItem | OfferItem | PerpFundingRequest;

// Type guards for better type safety
export const isPurchasableItem = (item: ShopItem): item is PurchasableItem => {
    return item.type === 'token' || item.type === 'nft';
};

export const isOfferItem = (item: ShopItem): item is OfferItem => {
    return item.type === 'offer';
};

export const isPerpFundingRequest = (item: ShopItem): item is PerpFundingRequest => {
    return item.type === 'perp_funding';
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
        total_supply?: string | null;
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