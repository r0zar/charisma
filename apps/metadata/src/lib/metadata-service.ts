import { z } from 'zod';
import { kv } from '@vercel/kv';
import _ from 'lodash';

const PropertiesSchema = z.object({
    // Moved from MetadataSchema top-level
    symbol: z.string().optional(),
    decimals: z.number().optional(),
    identifier: z.string().optional(),

    // Existing properties
    lpRebatePercent: z.number().optional(),
    externalPoolId: z.string().optional(),
    engineContractId: z.string().optional(),
    tokenAContract: z.string().optional(),
    tokenBContract: z.string().optional(),
    swapFeePercent: z.number().optional()
}).passthrough();

// SIP-16 specific schemas
const AttributeSchema = z.object({
    trait_type: z.string(),
    value: z.any(), // Value can be string, number, or even object/array depending on trait
    display_type: z.string().optional(), // e.g., "number", "date", "boost_percentage"
});

// Defines the structure of the localization object when it IS present.
// URI is required if a localization object exists.
const BaseLocalizationSchema = z.object({
    uri: z.string(), // Must be a non-empty string if localization is provided.
    default: z.string().default('en'),
    locales: z.array(z.string()).default([]),
});

const MetadataSchema = z.object({
    // SIP-16 Core Fields
    sip: z.number().default(16), // SIP number, typically 16
    name: z.string(), // Name of the token (required by updated logic, previously optional)
    description: z.string().default('').optional(),
    image: z.string().optional(), // URL to the token image
    attributes: z.array(AttributeSchema).optional(),
    // Localization field is now optional. If present, it must conform to BaseLocalizationSchema.
    localization: BaseLocalizationSchema.optional(),

    // Properties bag for other/custom data including symbol, decimals, identifier
    properties: PropertiesSchema.optional(), // This now includes symbol, decimals, identifier

    // Deprecated fields from various standards, captured if present
    image_data: z.string().optional(),
    external_url: z.string().optional(),
    animation_url: z.string().optional(),

}).passthrough(); // Allow other fields not explicitly defined

export type TokenMetadata = z.infer<typeof MetadataSchema> & {
    contractId?: string; // Not part of stored metadata, but added for convenience in service
    lastUpdated?: string; // Timestamp of last update in KV
};

interface FormDataForMetadata {
    sip: number;
    name: string;
    description: string;
    symbol: string;
    decimals: number;
    identifier: string;
    attributes: Array<{ trait_type: string; value: any; display_type?: string }>;
    localization: { uri: string; default: string; locales: string[] };
}

export const constructSip16MetadataObject = (
    formData: FormDataForMetadata,
    contractIdSuffix: string,
    currentImageUrl: string,
    unsavedImageUrl: string,
    existingTokenProperties?: Record<string, any>
): TokenMetadata => {
    const newMetadata: Partial<TokenMetadata> = {
        sip: Number(formData.sip || 16),
        name: formData.name || (contractIdSuffix ? contractIdSuffix.toUpperCase().replace(/-/g, ' ') : 'Unnamed Token'),
        // description, image, attributes, localization, properties will be added conditionally
    };

    // Conditionally add description if it's not an empty string
    if (formData.description && formData.description.trim() !== "") {
        newMetadata.description = formData.description;
    }
    // If formData.description is empty, newMetadata.description remains unset.
    // Zod's .default('') will apply during parsing if schema requires it.

    if (unsavedImageUrl) {
        newMetadata.image = unsavedImageUrl;
    } else if (currentImageUrl) {
        newMetadata.image = currentImageUrl;
    } // If neither, newMetadata.image remains unset (optional field)

    // Conditionally add attributes if it's not an empty array
    if (formData.attributes && formData.attributes.length > 0) {
        newMetadata.attributes = formData.attributes;
    }
    // If formData.attributes is empty, newMetadata.attributes remains unset.

    // Conditionally add localization if a URI is provided
    if (formData.localization && formData.localization.uri && formData.localization.uri.trim() !== "") {
        const locFromForm = formData.localization;
        const locForMeta: Partial<z.infer<typeof BaseLocalizationSchema>> = { uri: locFromForm.uri };

        if (locFromForm.default && locFromForm.default.trim() !== '') {
            locForMeta.default = locFromForm.default;
        } // If not provided or empty, Zod's default('en') from BaseLocalizationSchema will apply

        if (Array.isArray(locFromForm.locales) && locFromForm.locales.length > 0) {
            locForMeta.locales = locFromForm.locales.filter(l => typeof l === 'string');
        } // If not provided or empty, Zod's default([]) from BaseLocalizationSchema will apply

        newMetadata.localization = locForMeta as z.infer<typeof BaseLocalizationSchema>;
    }
    // If no valid URI, newMetadata.localization is NOT set, so it should be omitted from the object.


    // Initialize properties, ensuring it exists if we are adding to it.
    // Start with existing properties, then overwrite/add from formData and tokenIdentifier.
    const properties: Record<string, any> = { ...(existingTokenProperties || {}) };

    if (formData.symbol && formData.symbol.trim() !== "") {
        properties.symbol = formData.symbol.trim();
    }
    if (typeof formData.decimals === 'number') {
        properties.decimals = formData.decimals;
    }
    // Use formData.identifier for properties.identifier
    // If formData.identifier is provided and not just whitespace, use it.
    if (formData.identifier && formData.identifier.trim() !== "") {
        properties.identifier = formData.identifier.trim();
    }

    // Conditionally add properties if it's not an empty object
    // after potentially adding symbol, decimals, and identifier.
    if (Object.keys(properties).length > 0) {
        newMetadata.properties = properties;
    } else {
        // Ensure properties is not set at all if it would be empty.
        delete newMetadata.properties;
    }

    // Ensure name is set (already handled by initial assignment, but good for robustness)
    if (!newMetadata.name) {
        newMetadata.name = contractIdSuffix ? contractIdSuffix.toUpperCase().replace(/-/g, ' ') : 'Unnamed Token';
    }

    // These are no longer needed as symbol, decimals, identifier are only added to properties
    // delete (newMetadata as any).symbol;
    // delete (newMetadata as any).decimals;
    // delete (newMetadata as any).identifier;

    return newMetadata as TokenMetadata;
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

            // --- BEGIN CACHE REFRESH LOGIC ---
            const cacheRefreshBaseUrl = 'https://tokens.charisma.rocks/api/v1/sip10';
            const refreshPromises: Promise<void>[] = [];

            // 1. Refresh cache for the current token itself
            refreshPromises.push(
                fetch(`${cacheRefreshBaseUrl}/${contractId}`)
                    .then(res => {
                        if (!res.ok) {
                            console.warn(`Cache refresh for ${contractId} failed: ${res.status} ${res.statusText}`);
                        } else {
                            console.log(`Cache refresh successfully triggered for ${contractId}`);
                        }
                    })
                    .catch(err => console.error(`Error triggering cache refresh for ${contractId}:`, err))
            );

            // 2. If it's an LP token, refresh base tokens
            if (validatedMetadata.properties?.tokenAContract) {
                const tokenA = validatedMetadata.properties.tokenAContract;
                refreshPromises.push(
                    fetch(`${cacheRefreshBaseUrl}/${tokenA}`)
                        .then(res => {
                            if (!res.ok) {
                                console.warn(`Cache refresh for LP base token ${tokenA} failed: ${res.status} ${res.statusText}`);
                            } else {
                                console.log(`Cache refresh successfully triggered for LP base token ${tokenA}`);
                            }
                        })
                        .catch(err => console.error(`Error triggering cache refresh for LP base token ${tokenA}:`, err))
                );
            }
            if (validatedMetadata.properties?.tokenBContract) {
                const tokenB = validatedMetadata.properties.tokenBContract;
                refreshPromises.push(
                    fetch(`${cacheRefreshBaseUrl}/${tokenB}`)
                        .then(res => {
                            if (!res.ok) {
                                console.warn(`Cache refresh for LP base token ${tokenB} failed: ${res.status} ${res.statusText}`);
                            } else {
                                console.log(`Cache refresh successfully triggered for LP base token ${tokenB}`);
                            }
                        })
                        .catch(err => console.error(`Error triggering cache refresh for LP base token ${tokenB}:`, err))
                );
            }

            // Execute all refresh promises but don't await them (fire-and-forget)
            Promise.allSettled(refreshPromises).then(results => {
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error('A cache refresh promise was rejected:', result.reason);
                    }
                });
            });
            // --- END CACHE REFRESH LOGIC ---

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