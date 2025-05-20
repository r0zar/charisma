import { TokenCacheData } from "@repo/tokens";

export type ShopItemType = 'nft' | 'token' | 'offer';

export interface ShopItem {
    id: string;
    type: ShopItemType;
    title: string;
    description: string;
    price?: number;
    currency?: string;
    image: string;
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
        [key: string]: any; // For other type-specific metadata
    };
}