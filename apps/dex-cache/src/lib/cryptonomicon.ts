 

import { callReadOnlyFunction } from "@repo/polyglot";

/**
 * Basic token information
 */
export interface Token {
    type: string;
    contractId: string;
    identifier?: string;
    name: string;
    symbol: string;
    decimals: number;
    supply?: number;
    image?: string;
    description?: string;
}

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
    async getTokenMetadata(contractId: string): Promise<any | null> {

        let externalMetadata: any = {};
        let tokenUri: string | null = null;

        try {
            try {
                tokenUri = await this.getTokenUri(contractId);
                console.log(`Token URI: ${tokenUri}`);
                if (tokenUri) {
                    externalMetadata = await this.fetchMetadataFromUri(tokenUri);
                    if (this.config.debug) console.debug(`[${contractId}] External URI (${tokenUri}) Data:`, externalMetadata);
                }
            } catch (uriError) {
                if (this.config.debug) {
                    console.warn(`Failed to get or fetch from token_uri for ${contractId}: ${uriError}`);
                }
            }

            return externalMetadata;
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

        if (metadataUri.startsWith('data:application/json;base64,')) {
            const base64Data = metadataUri.split(',')[1];
            const jsonData = atob(base64Data);
            return JSON.parse(jsonData);
        }

        if (!metadataUri.startsWith('http://') && !metadataUri.startsWith('https://')) {
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
                type: externalData.type, // Include type field for LP token detection
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
    async getTokenInfo(contractId: string): Promise<Token | null> {
        // Handle special case for STX token
        if (contractId === ".stx") {
            return {
                type: '',
                contractId: ".stx",
                identifier: "STX",
                name: "Stacks Token",
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
                identifier: undefined,
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
    async getTokenDecimals(contractId: string): Promise<number | null> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenDecimals: ${contractId}`);
                return null;
            }
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                "get-decimals",
                []
            );
            if (result?.value !== undefined && result?.value !== null) {
                const decimals = Number(result.value);
                if (!isNaN(decimals) && decimals >= 0) {
                    return decimals;
                }
            }
            return null; // Return null if we can't get valid decimals
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get decimals for ${contractId}:`, error);
            }
            return null; // Return null if contract call fails
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
            return Number(result?.value) || 0;
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get total supply for ${contractId}:`, error);
            }
            return 0;
        }
    }
}