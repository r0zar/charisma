import { z } from 'zod';
import { kv } from '@vercel/kv';

const PropertiesSchema = z.object({
    lpRebatePercent: z.number().optional(),
    externalPoolId: z.string().optional(),
    engineContractId: z.string().optional(),
    tokenAContract: z.string().optional(),
    tokenBContract: z.string().optional()
}).passthrough();

const MetadataSchema = z.object({
    name: z.string(),
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    identifier: z.string().optional(),
    description: z.string(),
    image: z.string(),
    properties: PropertiesSchema.optional()
}).passthrough();

export type TokenMetadata = z.infer<typeof MetadataSchema> & {
    contractId?: string;
    lastUpdated?: string;
};

export class MetadataService {
    // Using "metadata:" prefix instead of "sip10:"
    private static readonly KEY_PREFIX = 'metadata:';

    static async get(contractId: string): Promise<TokenMetadata> {
        const metadata = await kv.get<TokenMetadata>(`${this.KEY_PREFIX}${contractId}`);
        if (!metadata) {
            console.error('Metadata not found', contractId);
            return {} as TokenMetadata;
        }
        return { ...metadata, contractId };
    }

    static async set(contractId: string, metadata: TokenMetadata) {
        try {
            // Get existing metadata if it exists
            const existingMetadata = await kv.get<TokenMetadata>(`${this.KEY_PREFIX}${contractId}`);

            // Prepare metadata with updates
            const updatedMetadata = {
                ...existingMetadata,
                ...metadata,
                lastUpdated: new Date().toISOString()
            };

            // Validate metadata
            console.log('Validating metadata', updatedMetadata);
            const validatedMetadata = MetadataSchema.parse(updatedMetadata);

            // Save to KV store
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
            // Delete the key from KV store
            const deleted = await kv.del(`${this.KEY_PREFIX}${contractId}`);
            console.log(`Deleted metadata for ${contractId}:`, deleted);
            return deleted === 1;
        } catch (error) {
            console.error(`Error deleting metadata for ${contractId}:`, error);
            throw new Error(`Failed to delete metadata: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    static async list(address?: string): Promise<TokenMetadata[]> {
        // List keys with our prefix
        const keys = await kv.keys(`${this.KEY_PREFIX}*`);

        // Filter by address if provided
        const filteredKeys = address
            ? keys.filter(key => {
                const contractId = key.replace(this.KEY_PREFIX, '');
                return contractId.startsWith(address);
            })
            : keys;

        // Get all metadata
        const metadataPromises = filteredKeys.map(async (key) => {
            const contractId = key.replace(this.KEY_PREFIX, '');
            const metadata = await kv.get<TokenMetadata>(key);
            if (!metadata) return { contractId } as TokenMetadata;
            return { ...metadata, contractId };
        });

        return Promise.all(metadataPromises);
    }
} 