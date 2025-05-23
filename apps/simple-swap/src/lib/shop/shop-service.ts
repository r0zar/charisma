import { TokenCacheData, listTokens, getTokenMetadataCached } from '@repo/tokens';
import { kv } from '@vercel/kv';
import { getOffer } from '@/lib/otc/kv';
import { ShopItem, PurchasableItem, OfferItem, OfferAsset, LegacyShopItem } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { SHOP_CONTRACTS, FEATURED_ITEMS, OFFER_STATUS } from './constants';

/**
 * Unified shop service for all marketplace data operations
 */
export class ShopService {

    /**
     * Get tokens filtered by type with consistent mapping
     */
    static async getTokensByType(type?: 'SUBNET' | 'BASE'): Promise<TokenCacheData[]> {
        try {
            const allTokens = await listTokens();
            console.log(allTokens.filter(token => token.symbol === 'CHA'));

            if (type === 'SUBNET') {
                return allTokens.filter(token => token.type === 'SUBNET');
            } else if (type === 'BASE') {
                return allTokens.filter(token => token.type !== 'SUBNET');
            }

            return allTokens;
        } catch (error) {
            console.error('Error fetching tokens:', error);
            return [];
        }
    }

    /**
     * Create a token map for quick lookups
     */
    static createTokenMap(tokens: TokenCacheData[]): Record<string, TokenCacheData> {
        const tokenMap: Record<string, TokenCacheData> = {};
        tokens.forEach(token => {
            tokenMap[token.contractId] = token;
        });
        return tokenMap;
    }

    /**
     * Transform tokens to TokenDef format (for OTC forms)
     */
    static mapToTokenDef(tokens: TokenCacheData[]): TokenDef[] {
        return tokens.map(token => ({
            id: token.contractId,
            name: token.name || '',
            symbol: token.symbol || '',
            logo: token.image || '',
            decimals: token.decimals || 0,
            image: token.image || '',
            identifier: token.identifier || '',
        }));
    }

    /**
     * Get all offer keys from KV store
     */
    static async getAllOfferKeys(): Promise<string[]> {
        try {
            const keys = await kv.keys('otc:offer:*');

            // Extract UUIDs from keys
            return keys
                .map(key => {
                    if (typeof key === 'string') {
                        const parts = key.split(':');
                        return parts.length >= 3 ? parts[2] : key;
                    }
                    return null;
                })
                .filter((uuid): uuid is string => uuid !== null);
        } catch (error) {
            console.error('Error fetching offer keys:', error);
            return [];
        }
    }

    /**
     * Fetch multiple offers in parallel
     */
    static async fetchOffers(keys: string[]): Promise<any[]> {
        if (!keys || keys.length === 0) return [];

        try {
            const fetchPromises = keys.map(async (uuid: string) => {
                return await getOffer(uuid);
            });

            return await Promise.all(fetchPromises);
        } catch (error) {
            console.error('Error fetching offers:', error);
            return [];
        }
    }

    /**
     * Transform offers into shop items with proper token amounts
     */
    static transformOffersToItems(
        offersData: any[],
        tokenMap: Record<string, TokenCacheData>
    ): OfferItem[] {
        return offersData
            .filter(result => result.status === OFFER_STATUS.OPEN)
            .map(result => {
                // Properly map offer assets with amounts preserved
                const offerAssets: OfferAsset[] = result.offerAssets?.map((asset: any) => {
                    const tokenData = tokenMap[asset.token];
                    if (!tokenData) {
                        console.warn(`Token data not found for: ${asset.token}`);
                        // Create fallback token data
                        const fallbackTokenData: TokenCacheData = {
                            contractId: asset.token,
                            symbol: asset.token?.split('.')[1] || 'Unknown',
                            name: asset.token?.split('.')[1] || 'Unknown Token',
                            image: '',
                            decimals: 6,
                            identifier: asset.token,
                            type: 'SUBNET'
                        };
                        return {
                            token: asset.token,
                            amount: asset.amount, // Preserve the amount!
                            tokenData: fallbackTokenData
                        };
                    }
                    return {
                        token: asset.token,
                        amount: asset.amount, // Preserve the amount!
                        tokenData: tokenData
                    };
                }) || [];

                // Get primary token info for title/image
                const primaryToken = offerAssets[0]?.tokenData;
                const tokenCount = offerAssets.length;

                // Generate descriptive title
                const title = tokenCount === 1
                    ? `${primaryToken?.symbol || 'Token'} Offer`
                    : tokenCount <= 3
                        ? `${offerAssets.map(a => a.tokenData?.symbol).join(', ')} Bundle`
                        : `Multi-Token Bundle (${tokenCount} tokens)`;

                return {
                    id: result.intentUuid,
                    type: 'offer' as const,
                    title,
                    description: `OTC offer with ${tokenCount} token${tokenCount !== 1 ? 's' : ''}`,
                    image: primaryToken?.image || 'https://placehold.co/400?text=Offer',
                    createdAt: result.createdAt,
                    intentUuid: result.intentUuid,
                    offerCreatorAddress: result.offerCreatorAddress,
                    offerAssets, // Now properly includes amounts!
                    status: result.status,
                    bids: result.bids || []
                } as OfferItem;
            });
    }

    /**
     * Create the featured HOOT token item
     */
    static createHootTokenItem(tokenMap: Record<string, TokenCacheData>): PurchasableItem {
        const config = FEATURED_ITEMS.HOOT_FARM;

        return {
            id: config.id,
            type: config.type as 'token',
            title: config.title,
            description: config.description,
            price: config.price,
            currency: SHOP_CONTRACTS.ENERGY,
            payToken: tokenMap[SHOP_CONTRACTS.ENERGY],
            image: tokenMap[SHOP_CONTRACTS.HOOT_TOKEN]?.image || null,
            vault: SHOP_CONTRACTS.HOOT_FARM,
            metadata: {
                contractId: SHOP_CONTRACTS.HOOT_TOKEN,
                tokenSymbol: 'HOOT',
                maxQuantity: config.maxQuantity
            }
        } as PurchasableItem;
    }

    /**
     * Get all shop items (offers + featured items)
     */
    static async getAllShopItems(): Promise<ShopItem[]> {
        // Fetch tokens and create map
        const allTokens = await this.getTokensByType();
        const tokenMap = this.createTokenMap(allTokens);

        console.log(`Loaded ${allTokens.length} tokens for shop items`);

        // Fetch offers
        const offerKeys = await this.getAllOfferKeys();
        const offersData = await this.fetchOffers(offerKeys);

        console.log(`Found ${offersData.length} offers to process`);

        // Extract all unique token contract IDs from offers
        const offerTokenIds = new Set<string>();
        offersData.forEach(result => {
            result.offerAssets?.forEach((asset: any) => {
                if (asset.token) {
                    offerTokenIds.add(asset.token);
                }
            });
        });

        console.log('Unique tokens found in offers:', Array.from(offerTokenIds));

        // Check for missing tokens and try to fetch them
        const missingTokens = Array.from(offerTokenIds).filter(tokenId => !tokenMap[tokenId]);
        if (missingTokens.length > 0) {
            console.warn('Missing token data for offers:', missingTokens);

            // Fetch missing tokens individually
            const missingTokenPromises = missingTokens.map(async (tokenId) => {
                try {
                    console.log(`Fetching missing token: ${tokenId}`);
                    const tokenData = await getTokenMetadataCached(tokenId);
                    return { tokenId, tokenData };
                } catch (error) {
                    console.error(`Failed to fetch token ${tokenId}:`, error);
                    return { tokenId, tokenData: null };
                }
            });

            const missingTokenResults = await Promise.all(missingTokenPromises);

            // Add successfully fetched tokens to the token map
            missingTokenResults.forEach(({ tokenId, tokenData }) => {
                if (tokenData) {
                    tokenMap[tokenId] = tokenData;
                    console.log(`Successfully added token ${tokenId} to map`);
                }
            });
        }

        // Transform data
        const shopItems = this.transformOffersToItems(offersData, tokenMap);
        const hootTokenItem = this.createHootTokenItem(tokenMap);

        return [hootTokenItem, ...shopItems];
    }

    /**
     * Get subnet tokens for OTC forms
     */
    static async getSubnetTokensForOTC(): Promise<TokenDef[]> {
        const subnetTokens = await this.getTokensByType('SUBNET');
        return this.mapToTokenDef(subnetTokens);
    }
} 