import { z } from 'zod';
import { kv } from '@vercel/kv';
import _ from 'lodash';

const PropertiesSchema = z.object({
    lpRebatePercent: z.number().optional(),
    externalPoolId: z.string().optional(),
    engineContractId: z.string().optional(),
    tokenAContract: z.string().optional(),
    tokenBContract: z.string().optional(),
    swapFeePercent: z.number().optional()
}).passthrough();

const MetadataSchema = z.object({
    name: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    identifier: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    properties: PropertiesSchema.optional()
}).passthrough();

export type TokenMetadata = z.infer<typeof MetadataSchema> & {
    contractId?: string;
    lastUpdated?: string;
};

export class MetadataService {
    // Using "metadata:" prefix for new storage
    private static readonly KEY_PREFIX = 'metadata:';
    // Legacy prefix for backward compatibility
    private static readonly LEGACY_KEY_PREFIX = 'sip10:';

    static async get(contractId: string): Promise<TokenMetadata> {
        // Try to get from metadata prefix first
        let metadata = await kv.get<TokenMetadata>(`${this.KEY_PREFIX}${contractId}`);

        // If not found, try legacy prefix
        if (!metadata) {
            metadata = await kv.get<TokenMetadata>(`${this.LEGACY_KEY_PREFIX}${contractId}`);
        }

        console.log(`Metadata: ${JSON.stringify(metadata)}`);
        if (!metadata) {
            console.log('Metadata not found for', contractId);
            return {} as TokenMetadata;
        }
        return { ...metadata, contractId };
    }

    static async set(contractId: string, metadata: TokenMetadata) {
        try {
            // Get existing metadata if it exists (checking both prefixes)
            let existingMetadata = await kv.get<TokenMetadata>(`${this.KEY_PREFIX}${contractId}`);

            if (!existingMetadata) {
                existingMetadata = await kv.get<TokenMetadata>(`${this.LEGACY_KEY_PREFIX}${contractId}`);
            }

            // Prepare metadata with updates
            const updatedMetadata = {
                ...existingMetadata,
                ...metadata,
                lastUpdated: new Date().toISOString()
            };

            // Validate metadata
            console.log('Validating metadata', updatedMetadata);
            const validatedMetadata = MetadataSchema.parse(updatedMetadata);

            // Save to KV store using only the metadata prefix
            await kv.set(`${this.KEY_PREFIX}${contractId}`, validatedMetadata);

            return {
                success: true,
                contractId,
                metadata: { ...validatedMetadata, contractId }
            };
        } catch (error) {
            console.error('Error saving metadata:', error);
            if (error instanceof z.ZodError) {
                throw new Error(`Validation error: ${error.message}`);
            }
            throw new Error(`Failed to save metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static async delete(contractId: string): Promise<boolean> {
        try {
            // Delete the key from KV store (both prefixes)
            const deletedMetadata = await kv.del(`${this.KEY_PREFIX}${contractId}`);
            const deletedLegacy = await kv.del(`${this.LEGACY_KEY_PREFIX}${contractId}`);

            console.log(`Deleted metadata for ${contractId}:`, { metadata: deletedMetadata, legacy: deletedLegacy });
            return deletedMetadata === 1 || deletedLegacy === 1;
        } catch (error) {
            console.error(`Error deleting metadata for ${contractId}:`, error);
            throw new Error(`Failed to delete metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static async list(address?: string): Promise<TokenMetadata[]> {
        // List keys with both prefixes
        const metadataKeys = await kv.keys(`${this.KEY_PREFIX}*`);
        const legacyKeys = await kv.keys(`${this.LEGACY_KEY_PREFIX}*`);

        // Combine keys and remove duplicates (when a key exists in both systems)
        const allKeys = [...metadataKeys, ...legacyKeys];
        const uniqueContractIds = new Set<string>();
        const uniqueKeys: string[] = [];

        allKeys.forEach(key => {
            let prefix = key.startsWith(this.KEY_PREFIX) ? this.KEY_PREFIX : this.LEGACY_KEY_PREFIX;
            const contractId = key.replace(prefix, '');

            if (!uniqueContractIds.has(contractId)) {
                uniqueContractIds.add(contractId);
                uniqueKeys.push(key);
            }
        });

        // Filter by address if provided
        const filteredKeys = address
            ? uniqueKeys.filter(key => {
                let prefix = key.startsWith(this.KEY_PREFIX) ? this.KEY_PREFIX : this.LEGACY_KEY_PREFIX;
                const contractId = key.replace(prefix, '');
                return contractId.startsWith(address);
            })
            : uniqueKeys;

        // Get all metadata
        const metadataPromises = filteredKeys.map(async (key) => {
            let prefix = key.startsWith(this.KEY_PREFIX) ? this.KEY_PREFIX : this.LEGACY_KEY_PREFIX;
            const contractId = key.replace(prefix, '');
            const metadata = await kv.get<TokenMetadata>(key);
            if (!metadata) return { contractId } as TokenMetadata;
            return { ...metadata, contractId };
        });

        return Promise.all(metadataPromises);
    }
} 