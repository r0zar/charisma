import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { listTokens, getTokenMetadataCached } from '@/lib/contract-registry-adapter';
import { kv } from '@vercel/kv';
import { getOffer } from '@/lib/otc/kv';
import { ShopItem, PurchasableItem, OfferItem, OfferAsset, PerpFundingRequest } from '@/types/shop';
import { TokenDef } from '@/types/otc';
import { SHOP_CONTRACTS, FEATURED_ITEMS, OFFER_STATUS } from './constants';
import { getAllFundingRequests } from '@/lib/perps/p2p-kv';
import { FundingRequest } from '@/lib/perps/p2p-schema';

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
     * Transform funding requests into shop items
     */
    static transformFundingRequestsToItems(
        fundingRequests: FundingRequest[],
        tokenMap: Record<string, TokenCacheData>
    ): PerpFundingRequest[] {
        return fundingRequests
            .filter(request => request.fundingStatus === 'seeking') // Only show seeking funding
            .map(request => {
                // Get token metadata for display
                const baseTokenData = tokenMap[request.baseToken];
                const quoteTokenData = tokenMap[request.quoteToken];

                // Generate title based on position
                const direction = request.direction.toUpperCase();
                const baseSymbol = baseTokenData?.symbol || request.baseToken.split('.')[1] || 'TOKEN';
                const leverage = request.leverage;
                const title = `${direction} ${baseSymbol} ${leverage}x Position`;

                // Generate description
                const positionSize = parseFloat(request.positionSize);
                const feeRate = request.fundingFeeRate;
                const description = `Fund a ${positionSize} ${request.direction} position on ${baseSymbol} with ${leverage}x leverage. ${feeRate} funding fee.`;

                // Use base token image for display
                const image = baseTokenData?.image || 'https://placehold.co/400?text=P2P';

                return {
                    id: request.id,
                    type: 'perp_funding' as const,
                    title,
                    description,
                    image,
                    createdAt: request.createdAt,

                    // Funding request specific data
                    perpUuid: request.perpUuid,
                    traderId: request.traderId,
                    traderMarginIntent: request.traderMarginIntent,

                    // Position details
                    direction: request.direction,
                    leverage: request.leverage,
                    positionSize: request.positionSize,
                    entryPrice: request.entryPrice,
                    liquidationPrice: request.liquidationPrice,

                    // Economic terms
                    traderMargin: request.traderMargin,
                    maxCollateralNeeded: request.maxCollateralNeeded,
                    fundingFeeRate: request.fundingFeeRate,

                    // Token information
                    baseToken: request.baseToken,
                    quoteToken: request.quoteToken,
                    marginToken: request.marginToken,

                    // Status and lifecycle
                    fundingStatus: request.fundingStatus,
                    expiresAt: request.expiresAt,
                    funderId: request.funderId,
                    fundedAt: request.fundedAt,
                    settledAt: request.settledAt,

                    // Funding offers
                    fundingOffers: request.fundingOffers.map(offer => ({
                        funderId: offer.funderId,
                        funderCollateralIntent: offer.funderCollateralIntent || '',
                        maxCollateralOffered: offer.maxCollateralOffered,
                        requestedFeeRate: offer.requestedFeeRate,
                        message: offer.message,
                        createdAt: offer.createdAt,
                        status: offer.status,
                        fundingOfferId: offer.fundingOfferId,
                    }))
                } as PerpFundingRequest;
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
     * Get all shop items (offers + featured items + funding requests)
     */
    static async getAllShopItems(): Promise<ShopItem[]> {
        // Fetch tokens and create map
        const allTokens = await this.getTokensByType();
        const tokenMap = this.createTokenMap(allTokens);

        console.log(`Loaded ${allTokens.length} tokens for shop items`);

        // Fetch offers and funding requests in parallel
        const [offerKeys, fundingRequests] = await Promise.all([
            this.getAllOfferKeys(),
            getAllFundingRequests()
        ]);

        const offersData = await this.fetchOffers(offerKeys);

        console.log(`Found ${offersData.length} offers and ${fundingRequests.length} funding requests to process`);

        // Extract all unique token contract IDs from offers and funding requests
        const offerTokenIds = new Set<string>();
        offersData.forEach(result => {
            result.offerAssets?.forEach((asset: any) => {
                if (asset.token) {
                    offerTokenIds.add(asset.token);
                }
            });
        });

        // Add token IDs from funding requests
        fundingRequests.forEach(request => {
            offerTokenIds.add(request.baseToken);
            offerTokenIds.add(request.quoteToken);
            offerTokenIds.add(request.marginToken);
        });

        console.log('Unique tokens found in offers and funding requests:', Array.from(offerTokenIds));

        // Check for missing tokens and try to fetch them
        const missingTokens = Array.from(offerTokenIds).filter(tokenId => !tokenMap[tokenId]);
        if (missingTokens.length > 0) {
            console.warn('Missing token data for shop items:', missingTokens);

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
        const offerItems = this.transformOffersToItems(offersData, tokenMap);
        const fundingRequestItems = this.transformFundingRequestsToItems(fundingRequests, tokenMap);
        const hootTokenItem = this.createHootTokenItem(tokenMap);

        console.log(`Transformed ${offerItems.length} offers, ${fundingRequestItems.length} funding requests, and 1 featured item`);

        return [hootTokenItem, ...offerItems, ...fundingRequestItems];
    }

    /**
     * Get subnet tokens for OTC forms
     */
    static async getSubnetTokensForOTC(): Promise<TokenDef[]> {
        const subnetTokens = await this.getTokensByType('SUBNET');
        return this.mapToTokenDef(subnetTokens);
    }
} 