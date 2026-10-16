import { kv } from '@vercel/kv';
import { put } from '@vercel/blob';
import type { TokenMetadata } from './metadata-service';

/** A SIP-009 collection whose token metadata and images this service owns */
export interface NftCollection {
    contractId: string;
    /** Short path segment, for contracts whose base URI has little room (Bitgear's holds 90 characters) */
    slug: string;
    name: string;
    description?: string;
    /** Cover image: the first token's */
    image?: string;
    /** Blob URL prefix the collection's images live under */
    imageBase: string;
    tokenCount: number;
    lastUpdated: string;
}

// `nft:` keys belong to an older NFT system that shares this KV, so collections keep their own prefix
const collectionKey = (contractId: string) => `nft-collection:${contractId}`;
const slugKey = (slug: string) => `nft-slug:${slug}`;
const tokensKey = (contractId: string) => `nft-tokens:${contractId}`;

/** The base URI a contract points at: token metadata is `<base><id>.json`, images `<base><field>/<file>` */
export const nftBaseUri = (slug: string) => `https://metadata.charisma.rocks/nft/${slug}/`;

export class NftService {
    /** A collection by its contract id or its slug */
    static async getCollection(key: string): Promise<NftCollection | null> {
        const contractId = key.includes('.') ? key : await kv.get<string>(slugKey(key));
        return contractId ? kv.get<NftCollection>(collectionKey(contractId)) : null;
    }

    static async listCollections(): Promise<NftCollection[]> {
        const keys: string[] = [];
        let cursor = 0;
        do {
            const [next, batch] = await kv.scan(cursor, { match: 'nft-collection:*', count: 1000 });
            cursor = Number(next);
            keys.push(...batch);
        } while (cursor !== 0);
        if (!keys.length) return [];
        return (await kv.mget<NftCollection[]>(...keys)).filter(Boolean);
    }

    static async getToken(contractId: string, tokenId: string): Promise<TokenMetadata | null> {
        return kv.hget<TokenMetadata>(tokensKey(contractId), tokenId);
    }

    /** One page of a collection's tokens, in token id order */
    static async listTokens(contractId: string, offset: number, limit: number) {
        const ids = (await kv.hkeys(tokensKey(contractId))).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
        const page = ids.slice(offset, offset + limit);
        const metadata = page.length ? await kv.hmget<Record<string, TokenMetadata>>(tokensKey(contractId), ...page) : null;
        return { total: ids.length, tokens: page.map(id => ({ id, ...metadata![id] })) };
    }

    static async saveCollection(collection: NftCollection) {
        const owner = await kv.get<string>(slugKey(collection.slug));
        if (owner && owner !== collection.contractId) {
            throw new Error(`Slug "${collection.slug}" already belongs to ${owner}`);
        }
        await kv.set(collectionKey(collection.contractId), collection);
        await kv.set(slugKey(collection.slug), collection.contractId);
    }

    static async saveTokens(contractId: string, tokens: Record<string, TokenMetadata>) {
        await kv.hset(tokensKey(contractId), tokens);
    }

    /** Stores one of the collection's images at `<path>` and returns its blob URL */
    static async saveImage(contractId: string, path: string, bytes: Buffer, contentType: string) {
        const { url } = await put(`nft/${contractId}/${path}`, bytes, { access: 'public', addRandomSuffix: false, contentType });
        return url;
    }
}
