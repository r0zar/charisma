import { Suspense } from 'react';
import { TokenCacheData } from '@repo/tokens';
import ShopClientPage from '@/components/shop/ShopPage';
import { ShopItem as ShopItemInterface } from '@/types/shop';
import { listTokens } from "@repo/tokens";
import { kv } from '@vercel/kv';
import { getOffer } from '@/lib/otc/kv';

// Server component to fetch data
export default async function ShopPage() {
    const result = await listTokens();
    const tokenMap: Record<string, TokenCacheData> = {}
    result.forEach((token) => {
        tokenMap[token.contractId] = token;
    });

    // Fetch offer keys
    const offerKeys = await getAllOfferKeys();

    // Fetch all offers in parallel
    const offersData = await fetchOffers(offerKeys);

    // Transform offers into shop items
    const shopItems = transformOffersToItems(offersData, tokenMap);

    // Create the HOOT token featured item
    const hootTokenItem = createHootTokenItem(tokenMap);

    // Combine all items
    const allItems = [hootTokenItem, ...shopItems];

    return (
        <Suspense fallback={<div>Loading shop...</div>}>
            <ShopClientPage initialItems={allItems} />
        </Suspense>
    );
}

// Helper function to get all offer keys
async function getAllOfferKeys(): Promise<string[]> {
    try {
        const keys = await kv.keys('otc:offer:*');

        // Extract just the UUIDs from the keys
        const uuids = keys.map(key => {
            // Ensure key is a string and extract the UUID part from the key format "otc:offer:UUID"
            if (typeof key === 'string') {
                const parts = key.split(':');
                return parts.length >= 3 ? parts[2] : key;
            }
            return null; // Or handle as an error/skip
        }).filter(uuid => uuid !== null) as string[]; // Filter out nulls and assert type
        return uuids;
    } catch (error) {
        console.error('Error fetching offer keys:', error);
        return [];
    }
}

// Helper function to fetch offers
async function fetchOffers(keys: string[]): Promise<any[]> {
    if (!keys || keys.length === 0) return [];

    try {
        const fetchPromises = keys.map(async (uuid: string) => {
            const offer = await getOffer(uuid);
            return offer;
        });

        return await Promise.all(fetchPromises);
    } catch (error) {
        console.error('Error fetching offers:', error);
        return [];
    }
}

// Helper function to transform offers data into shop items
function transformOffersToItems(offersData: any[], tokenMap: Record<string, TokenCacheData>): ShopItemInterface[] {
    return offersData
        .filter(result => result.status === 'open')
        .map(result => {
            const tokenInfo = tokenMap[result.offerAssets[0]?.token];
            return {
                ...result.offer,
                id: result.intentUuid,
                type: 'offer',
                image: tokenInfo?.image || 'https://placehold.co/400?text=Offer',
                title: tokenInfo?.symbol || 'OTC Offer',
                price: 1,
                description: `Make a bid for ${tokenInfo?.symbol || 'this token'}`,
            };
        });
}

// Helper function to create the HOOT token item
function createHootTokenItem(tokenMap: Record<string, any>): ShopItemInterface {
    return {
        id: 'hooter-farm',
        type: 'token',
        title: 'HOOT Tokens',
        description: 'Spend up to 1000 energy to collect HOOT token rewards.',
        price: 100,
        currency: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
        payToken: tokenMap['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy']!,
        image: tokenMap["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl"]?.image || null,
        vault: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm-x10',
        metadata: {
            contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
            tokenSymbol: 'HOOT',
            amount: '100',
            maxQuantity: 10,
            offerAssets: [
                tokenMap["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl"]
            ]
        }
    };
}