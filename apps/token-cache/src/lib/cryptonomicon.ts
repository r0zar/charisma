 

import { callReadOnlyFunction, getContractInterface } from "@repo/polyglot";
import { TokenCacheData } from "@repo/tokens";

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
                identifier: "STX",
            };
        }

        let offChainMetadata: any = {};
        let fallbackContractData: any = {};
        let metadataApiData: any = {};
        let tokenUri: string | null = null;

        try {
            // 1. Attempt to fetch from metadata API service
            try {
                const metadataApiUrl = `${this.config.metadataApiBaseUrl}/api/metadata/${contractId}`;
                const response = await fetch(metadataApiUrl, {
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    metadataApiData = await response.json();
                    if (this.config.debug) console.debug(`[${contractId}] Metadata API Data:`, metadataApiData);
                } else {
                    if (this.config.debug) {
                        console.warn(`Metadata API request failed for ${contractId}: ${response.status}`);
                    }
                }
            } catch (apiError) {
                console.warn(`Error fetching from metadata API for ${contractId}: ${apiError}`);
            }

            // 2. Attempt to fetch external metadata from token_uri as fallback
            try {
                tokenUri = await this.getTokenUri(contractId);
                if (tokenUri) {
                    offChainMetadata = await this.fetchMetadataFromUri(tokenUri);
                    console.log(`[${contractId}] External URI (${tokenUri}) Data:`, offChainMetadata);
                }
            } catch (uriError) {
                console.warn(`Failed to get or fetch from token_uri for ${contractId}: ${uriError}`);
            }

            console.log(`[${contractId}] External Metadata:`, offChainMetadata);
            console.log(`[${contractId}] Metadata API Data:`, metadataApiData);

            // 3. Fetch essential data (name, symbol, decimals, identifier) directly from contract if needed
            if (!metadataApiData.name || !offChainMetadata.name || !metadataApiData.symbol || !offChainMetadata.symbol ||
                metadataApiData.decimals === undefined || offChainMetadata.decimals === undefined ||
                !metadataApiData.identifier || !offChainMetadata.identifier) {
                try {
                    if (this.config.debug) console.debug(`[${contractId}] Fetching basic contract data as fallback...`);
                    const [name, symbol, decimals, identifier] = await Promise.all([
                        this.getTokenName(contractId).catch(() => undefined),
                        this.getTokenSymbol(contractId).catch(() => undefined),
                        this.getTokenDecimals(contractId).catch(() => undefined),
                        this.getTokenIdentifier(contractId).catch(() => undefined)
                    ]);
                    // Assign name, symbol, decimals, identifier to fallback
                    fallbackContractData = { name, symbol, decimals, identifier };
                    if (this.config.debug) console.debug(`[${contractId}] Contract fallback data:`, fallbackContractData);
                } catch (contractError) {
                    console.warn(`Failed to fetch on-chain basic info from contract ${contractId}: ${contractError}`);
                }
            }

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

            // 4. Generate default metadata when external sources fail
            const defaultMetadata = this.generateDefaultMetadata(contractId, fallbackContractData);

            // 5. Merge data: Default -> Contract Fallback -> External URI -> Metadata API (highest precedence)
            const finalMetadata: any = {
                ...defaultMetadata,                                 // Base defaults
                ...this.filterUndefined(fallbackContractData),     // Contract data overrides defaults
                ...this.filterUndefined(offChainMetadata),         // External URI data
                ...this.filterUndefined(metadataApiData),          // Metadata API has highest precedence
                contractId, // Ensure contractId is always set
            };

            // 4b. Override total_supply with the on-chain value if fetched successfully
            if (onChainSupply !== undefined) {
                finalMetadata.total_supply = onChainSupply;
            }

            if (this.config.debug) console.debug(`[${contractId}] Final Merged Metadata (Supply Overridden):`, finalMetadata);

            // Validate essential fields more comprehensively
            const missingFields = [];
            if (!finalMetadata.name) missingFields.push('name');
            if (!finalMetadata.symbol) missingFields.push('symbol');
            if (finalMetadata.decimals === undefined) missingFields.push('decimals');

            if (missingFields.length > 0) {
                console.warn(`[${contractId}] Missing essential metadata fields: ${missingFields.join(', ')}`);
                if (this.config.debug) {
                    console.debug(`[${contractId}] Metadata state:`, {
                        offChainMetadata: Object.keys(offChainMetadata),
                        fallbackContractData: Object.keys(fallbackContractData),
                        finalMetadata: Object.keys(finalMetadata)
                    });
                }
                // Return null only if critical fields are missing
                if (missingFields.includes('name') && missingFields.includes('symbol')) {
                    return null;
                }
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
     * Generate default metadata for tokens when external sources fail
     */
    private generateDefaultMetadata(contractId: string, contractData: any): Record<string, any> {
        const [contractAddress, contractName] = contractId.split('.');

        // Generate a deterministic default image based on contract ID
        const imageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(contractData.symbol || contractName || 'TOKEN')}&size=200&background=6366f1&color=ffffff&format=png&bold=true`;

        // Generate a basic description
        const tokenName = contractData.name || contractName || 'Unknown Token';
        const tokenSymbol = contractData.symbol || 'TOKEN';
        const description = `${tokenName} (${tokenSymbol}) is a fungible token on the Stacks blockchain. Contract: ${contractId}`;

        return {
            name: contractData.name || contractName || 'Unknown Token',
            symbol: contractData.symbol || 'TOKEN',
            decimals: contractData.decimals || 6,
            description,
            image: imageUrl,
            identifier: contractData.identifier || contractName || 'token',
        };
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
     * Get the token identifier from the contract interface
     */
    async getTokenIdentifier(contractId: string): Promise<string | undefined> {
        try {
            const [contractAddress, contractName] = contractId.split('.');
            if (!contractAddress || !contractName) {
                if (this.config.debug) console.warn(`Invalid contractId for getTokenIdentifier: ${contractId}`);
                return undefined;
            }

            const contractInterface = await getContractInterface(contractAddress, contractName);

            if (contractInterface && contractInterface.fungible_tokens && Array.isArray(contractInterface.fungible_tokens) && contractInterface.fungible_tokens.length > 0) {
                if (this.config.debug) {
                    console.debug(`[${contractId}] Found ${contractInterface.fungible_tokens.length} fungible tokens in contract interface`);
                }

                // Extract the first fungible token identifier
                // In most cases, contracts have a single fungible token
                const fungibleToken = contractInterface.fungible_tokens[0] as any;
                if (fungibleToken && typeof fungibleToken === 'object' && fungibleToken.name) {
                    const identifier = fungibleToken.name;
                    if (this.config.debug) {
                        console.debug(`[${contractId}] Token identifier from contract interface: ${identifier}`);
                    }
                    return identifier;
                }
            }

            if (this.config.debug) {
                console.debug(`[${contractId}] No fungible tokens found in contract interface or interface is null`);
            }
            return undefined;
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get token identifier for ${contractId}:`, error);
            }
            return undefined;
        }
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
            const [symbol, decimals, name, identifier] = await Promise.all([
                this.getTokenSymbol(contractId).catch(() => undefined),
                this.getTokenDecimals(contractId).catch(() => undefined),
                this.getTokenName(contractId).catch(() => undefined),
                this.getTokenIdentifier(contractId).catch(() => undefined)
            ]);

            return {
                type: '',
                contractId,
                identifier: identifier || "",
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
            if (result?.value) {
                if (this.config.debug) console.debug(`[${contractId}] Symbol from contract: ${result.value}`);
                return result.value;
            } else {
                if (this.config.debug) console.warn(`[${contractId}] Contract returned no symbol value`);
                return contractId.split('.')[1] || "UNKNOWN";
            }
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
            if (result?.value) {
                if (this.config.debug) console.debug(`[${contractId}] Name from contract: ${result.value}`);
                return result.value;
            } else {
                if (this.config.debug) console.warn(`[${contractId}] Contract returned no name value`);
                return contractId.split('.')[1] || "Unknown Token";
            }
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
            if (result?.value !== undefined) {
                const decimals = Number(result.value);
                if (this.config.debug) console.debug(`[${contractId}] Decimals from contract: ${decimals}`);
                return decimals;
            } else {
                if (this.config.debug) console.warn(`[${contractId}] Contract returned no decimals value`);
                return 6;
            }
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
            if (result?.value !== undefined) {
                const total_supply = Number(result.value);
                if (this.config.debug) console.debug(`[${contractId}] Total supply from contract: ${total_supply}`);
                return total_supply;
            } else {
                if (this.config.debug) console.warn(`[${contractId}] Contract returned no total supply value`);
                return 0;
            }
        } catch (error) {
            if (this.config.debug) {
                console.warn(`Failed to get total supply for ${contractId}:`, error);
            }
            return 0;
        }
    }
}