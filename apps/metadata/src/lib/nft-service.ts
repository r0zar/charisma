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
    /** Blob URL prefix the collection's images live under */
    imageBase: string;
    tokenCount: number;
    lastUpdated: string;
}

const collectionKey = (contractId: string) => `nft:${contractId}`;
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

    static async getToken(contractId: string, tokenId: string): Promise<TokenMetadata | null> {
        return kv.hget<TokenMetadata>(tokensKey(contractId), tokenId);
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
