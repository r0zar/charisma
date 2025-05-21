/* eslint-disable @typescript-eslint/no-explicit-any */

import { callReadOnlyFunction } from "@repo/polyglot";
import { Token, TokenCacheData } from "@repo/tokens";

/**
 * Configuration for the metadata service
 */
export interface MetadataServiceConfig {
    apiKey?: string;
    proxy?: string;
    ipfsGateway?: string;
    stxAddress?: string;
    debug?: boolean;
    privateKey?: string;
    metadataApiBaseUrl?: string;
}

/**
 * Service for fetching and managing token metadata
 */
export class Cryptonomicon {
    config: MetadataServiceConfig;

    constructor(config: MetadataServiceConfig = {}) {
        this.config = {
            apiKey: config.apiKey || "",
            metadataApiBaseUrl: 'https://metadata.charisma.rocks',
            ipfsGateway: "https://ipfs.io/ipfs/",
            debug: config.debug || false,
            ...config
        };
    }

    /**
     * Get token metadata, prioritizing external token_uri if available,
     * then Hiro API, and finally direct contract calls as fallbacks.
     *
     * @param contractId The contract ID to fetch metadata for
     * @returns TokenMetadata or null if not found
     */
    async getTokenMetadata(contractId: string): Promise<TokenCacheData | null> {
        // Handle special case for STX token
        if (contractId === ".stx") {
            // Predefined metadata for native STX
            return {
                type: "",
                name: "Stacks Token",
                symbol: "STX",
                decimals: 6,
                description: "The native token of the Stacks blockchain.",
                image: "https://placehold.co/200?text=\?",
                contractId: ".stx",
                identifier: "",
            };
        }

        let offChainMetadata: any = {};
        let fallbackContractData: any = {};
        let hiroApiMetadata: any = {};
        let tokenUri: string | null = null;

        try {
            // 1. Attempt to fetch external metadata from token_uri
            try {
                tokenUri = await this.getTokenUri(contractId); // Re-use existing method
                if (tokenUri) {
                    offChainMetadata = await this.fetchMetadataFromUri(tokenUri);
                    console.log(`[${contractId}] External URI (${tokenUri}) Data:`, offChainMetadata);
                }
            } catch (uriError) {
                console.warn(`Failed to get or fetch from token_uri for ${contractId}: ${uriError}`);
            }

            console.log(`[${contractId}] External Metadata:`, offChainMetadata);

            // // 2. Attempt to fetch from Hiro API
            // try {
            //     const path = `/metadata/v1/ft/${contractId}`;
            //     const baseUrl = "https://api.hiro.so";
            //     const headers = new Headers({ 'Content-Type': 'application/json' });
            //     const apiKey = this.config.apiKey || "";
            //     if (apiKey) headers.set('x-api-key', apiKey);
            //     const response = await fetch(`${baseUrl}${path}`, { headers });

            //     if (response.ok) {
            //         const rawApiData: any = await response.json();
            //         // Normalize Hiro structure (if necessary, adjust based on actual response)
            //         const normalizedApiData = {
            //             ...rawApiData,
            //             ...(rawApiData.metadata || {}),
            //             ...(rawApiData.properties || {}),
            //         };
            //         delete normalizedApiData.metadata;
            //         delete normalizedApiData.properties;
            //         delete normalizedApiData.generated;

            //         hiroApiMetadata = {
            //             contractId: contractId,
            //             name: normalizedApiData.name,
            //             symbol: normalizedApiData.symbol,
            //             decimals: normalizedApiData.decimals,
            //             description: normalizedApiData.description,
            //             image: normalizedApiData.image_uri || normalizedApiData.image_canonical_uri,
            //             identifier: normalizedApiData.asset_identifier?.split("::")[1], // Extract identifier if present
            //             total_supply: normalizedApiData.total_supply?.value ? Number(normalizedApiData.total_supply.value) : undefined,
            //             // Add other relevant fields from Hiro API if needed
            //         };
            //         if (this.config.debug) console.debug(`[${contractId}] Hiro API Data:`, hiroApiMetadata);
            //     } else {
            //         if (this.config.debug) {
            //             console.warn(`Hiro API request failed for ${contractId}: ${response.status}`);
            //         }
            //     }
            // } catch (apiError) {
            //     console.warn(`Error fetching from Hiro API for ${contractId}: ${apiError}`);
            // }

            // 3. Fetch essential data (name, symbol, decimals) directly from contract if needed
            // if (!hiroApiMetadata.name || !hiroApiMetadata.symbol || hiroApiMetadata.decimals === undefined) {
            //     try {
            //         const [name, symbol, decimals] = await Promise.all([
            //             this.getTokenName(contractId).catch(() => undefined),
            //             this.getTokenSymbol(contractId).catch(() => undefined),
            //             this.getTokenDecimals(contractId).catch(() => undefined)
            //         ]);
            //         // Assign ONLY name, symbol, decimals to fallback
            //         fallbackContractData = { name, symbol, decimals };
            //     } catch (contractError) {
            //         console.warn(`Failed to fetch on-chain basic info from contract ${contractId}: ${contractError}`);
            //     }
            // }

            // 3b. ALWAYS try fetching total supply directly from the contract
            let onChainSupply: number | undefined = undefined;
            try {
                onChainSupply = await this.getTokenSupply(contractId).catch(() => undefined);
                if (onChainSupply !== undefined && this.config.debug) {
                    console.debug(`[${contractId}] Fetched On-Chain Total Supply:`, onChainSupply);
                }
            } catch (supplyError) {
                if (this.config.debug) {
                    console.warn(`Failed to fetch total supply directly from contract ${contractId}: ${supplyError}`);
                }
            }

            // 4. Merge data: Prioritize External -> Custom API -> Hiro API -> Contract Fallback
            const finalMetadata: any = {
                ...this.filterUndefined(fallbackContractData),     // Least precedent
                ...this.filterUndefined(offChainMetadata),         // Most precedent for many fields
                // ...this.filterUndefined(hiroApiMetadata),
            };

            // 4b. Override total_supply with the on-chain value if fetched successfully
            if (onChainSupply !== undefined) {
                finalMetadata.total_supply = onChainSupply;
            }

            if (this.config.debug) console.debug(`[${contractId}] Final Merged Metadata (Supply Overridden):`, finalMetadata);

            if (!finalMetadata.name) {
                if (this.config.debug) {
                    console.warn(`Could not resolve essential metadata (name or symbol) for ${contractId}. Name: ${finalMetadata.name}, Symbol: ${finalMetadata.symbol}`);
                }
                // If name or symbol are missing after all attempts, return null
                return null;
            }

            return finalMetadata;
        } catch (error) {
            if (this.config.debug) {
                console.error(`Complete metadata retrieval failed for ${contractId}: ${error}`);
            }
            return null; // Final catch-all
        }
    }

    /**
     * Helper to filter out undefined values from an object.
     * Useful for merging where undefined shouldn't overwrite existing values.
     */
    private filterUndefined(obj: Record<string, any>): Record<string, any> {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, any>);
    }


    /**
     * Fetches and parses metadata from a given HTTP(S) or IPFS URI.
     *
     * @param uri The metadata URI (http/https/ipfs).
     * @returns A partial TokenMetadata object or empty object if fetch/parse fails.
     */
    private async fetchMetadataFromUri(uri: string) {
        let metadataUri = uri;
        if (uri.startsWith('ipfs://')) {
            if (!this.config.ipfsGateway) {
                if (this.config.debug) console.warn(`IPFS URI found (${uri}) but no ipfsGateway configured.`);
                return {};
            }
            metadataUri = uri.replace('ipfs://', this.config.ipfsGateway);
        }

        if (!metadataUri.startsWith('http://') && !metadataUri.startsWith('https://') && !metadataUri.startsWith('data:application/json')) {
            if (this.config.debug) console.warn(`Invalid metadata URI scheme: ${metadataUri}`);
            return {};
        }

        try {
            const response = await fetch(metadataUri, {
                headers: { 'Accept': 'application/json' } // Request JSON
            });

            if (!response.ok) {
                if (this.config.debug) {
                    console.warn(`Failed to fetch metadata from URI ${metadataUri}: ${response.status} ${response.statusText}`);
                }
                return {};
            }

            const contentType = response.headers.get('content-type');
            let externalData: Record<string, any> = {}; // Initialize as empty

            // Warn if content-type is not JSON, but still try to parse
            if (!contentType || !contentType.includes('application/json')) {
                if (this.config.debug) {
                    console.warn(`Metadata URI ${metadataUri} did not return JSON content-type. Attempting to parse anyway...`);
                }
            }

            try {
                // Attempt to parse the body as JSON regardless of content-type
                externalData = await response.json() as Record<string, any>;
            } catch (parseError: any) {
                if (this.config.debug) {
                    console.warn(`Failed to parse JSON from ${metadataUri} (Content-Type: ${contentType}): ${parseError.message}`);
                }
                return {}; // Return empty if JSON parsing fails
            }

            // Map known fields from external JSON to TokenMetadata
            // IMPORTANT: Adjust these mappings based on common token_uri JSON structures
            return this.filterUndefined({
                name: externalData.name,
                symbol: externalData.symbol,
                decimals: externalData.decimals,
                description: externalData.description,
                image: externalData.image || externalData.image_uri, // Accept common variations
                identifier: externalData.identifier, // Look for identifier field
                lpRebatePercent: externalData.lpRebatePercent || externalData.properties?.swapFeePercent || externalData.properties?.lpRebatePercent, // Include top-level fee
                tokenAContract: externalData.tokenAContract || externalData.properties?.tokenAContract,
                tokenBContract: externalData.tokenBContract || externalData.properties?.tokenBContract,
            });

        } catch (error) {
            if (this.config.debug) {
                console.error(`Error fetching or parsing metadata from URI ${metadataUri}:`, error);
            }
            return {}; // Return empty on error
        }
    }

    /**
     * Get the token URI from a contract
     */
    async getTokenUri(contractId: string): Promise<string | null> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenUri: ${contractId}`);
                return null;
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-token-uri",
                []
            );
            return result?.value?.value;
        } catch (error) {
            if (this.config.debug) {
                console.error(`Failed to get token URI for ${contractId}:`, error);
            }
            return null;
        }
    }

    /**
     * Get token information (unified method)
     */
    async getTokenInfo(contractId: string): Promise<TokenCacheData | null> {
        // Handle special case for STX token
        if (contractId === ".stx") {
            return {
                type: '',
                contractId: ".stx",
                identifier: "STX",
                name: "STX Token",
                symbol: "STX",
                decimals: 6,
                description: "The native token of the Stacks blockchain",
                image: "https://charisma.rocks/stx-logo.png",
            };
        }

        try {
            // Get token metadata
            const metadata = await this.getTokenMetadata(contractId);

            if (metadata) {
                return {
                    type: metadata.type,
                    contractId,
                    identifier: metadata.identifier,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    decimals: metadata.decimals!,
                    description: metadata.description || "",
                    image: metadata.image || "",
                };
            }

            // Fallback: fetch token info directly from contract
            const [symbol, decimals, name] = await Promise.all([
                this.getTokenSymbol(contractId).catch(() => undefined),
                this.getTokenDecimals(contractId).catch(() => undefined),
                this.getTokenName(contractId).catch(() => undefined)
            ]);

            return {
                type: '',
                contractId,
                identifier: "",
                name: name || "",
                symbol: symbol || "",
                decimals: decimals!,
                description: "",
                image: "",
            };
        } catch (error) {
            if (this.config.debug) {
                console.error(`Failed to fetch token info for ${contractId}:`, error);
            }
            return null;
        }
    }

    /**
     * Get a token's symbol from contract
     */
    async getTokenSymbol(contractId: string): Promise<string> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenSymbol: ${contractId}`);
                return contractId.split('.')[1] || "UNKNOWN"; // Original fallback
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-symbol",
                []
            );
            return result?.value;
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get symbol for ${contractId}:`, error);
            }
            return contractId.split('.')[1] || "UNKNOWN"; // Fallback to contract name part
        }
    }

    /**
     * Get a token's name from contract
     */
    async getTokenName(contractId: string): Promise<string> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenName: ${contractId}`);
                return contractId.split('.')[1] || "Unknown Token"; // Original fallback
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-name",
                []
            );
            return result?.value;
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get name for ${contractId}:`, error);
            }
            return contractId.split('.')[1] || "Unknown Token"; // Fallback to contract name part
        }
    }

    /**
     * Get a token's decimals from contract
     */
    async getTokenDecimals(contractId: string): Promise<number> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenDecimals: ${contractId}`);
                return 6; // Original fallback
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-decimals",
                []
            );
            return result?.value;
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get decimals for ${contractId}:`, error);
            }
            return 6; // Default to 6 decimals if contract call fails
        }
    }

    /**
     * Get token total supply
     */
    async getTokenSupply(contractId: string): Promise<number> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenSupply: ${contractId}`);
                return 0; // Original fallback
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-total-supply",
                []
            );
            return result?.value;
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get total supply for ${contractId}:`, error);
            }
            return 0;
        }
    }
}