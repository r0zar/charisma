/* eslint-disable @typescript-eslint/no-explicit-any */

import { StacksClient } from "@repo/stacks";
import { principalCV } from "@stacks/transactions";

/**
 * Interface for token metadata
 */
export interface TokenMetadata {
  sip?: number;
  name: string;
  description: string;
  image: string;
  identifier?: string;
  symbol: string;
  decimals?: number;
  total_supply?: number;
  token_uri?: string;
  image_uri?: string;
  image_thumbnail_uri?: string;
  image_canonical_uri?: string;
  tx_id?: string;
  sender_address?: string;
  contractId: string;
  contract_principal?: string;
  asset_identifier?: string;
  cached_image?: string;
  cached_thumbnail_image?: string;
  // Added fields for liquidity pools
  tokenAContract?: string;
  tokenBContract?: string;
  lpRebatePercent?: number;
  externalPoolId?: string;
  engineContractId?: string;
  lastRefreshed?: number; // Timestamp (Date.now()) of when the data was last fetched/cached
}

/**
 * Basic token information
 */
export interface Token {
  contractId: string;
  identifier?: string;
  name: string;
  symbol: string;
  decimals: number;
  supply?: number;
  image?: string;
  description?: string;
  contract_principal?: string;
}

/**
 * Configuration for the metadata service
 */
export interface MetadataServiceConfig {
  apiKey?: string;
  apiKeys?: string[];
  apiKeyRotation?: "loop" | "random";
  proxy?: string;
  ipfsGateway?: string;
  stxAddress?: string;
  debug?: boolean;
  network?: 'mainnet' | 'testnet';
  retryDelay?: number;
  privateKey?: string;
  maxRetries?: number;
}

/**
 * Service for fetching and managing token metadata
 */
export class Cryptonomicon {
  config: MetadataServiceConfig;
  private client: StacksClient;
  private static currentKeyIndex = 0;

  constructor(config: MetadataServiceConfig = {}) {
    this.config = {
      apiKey: "",
      ipfsGateway: "https://ipfs.io/ipfs/",
      debug: false,
      network: 'mainnet',
      retryDelay: 3000,
      ...config
    };

    // Initialize StacksClient
    this.client = StacksClient.getInstance(config);

  }

  /**
   * Get the next API key based on the rotation strategy
   */
  private getNextApiKey(): string {
    const apiKeys = this.config.apiKeys?.length ? this.config.apiKeys : [this.config.apiKey || ""];
    if (!apiKeys.length) return "";

    const rotationStrategy = this.config.apiKeyRotation || "loop";

    if (rotationStrategy === "random") {
      const randomIndex = Math.floor(Math.random() * apiKeys.length);
      return apiKeys[randomIndex];
    } else {
      // Default loop strategy
      const key = apiKeys[Cryptonomicon.currentKeyIndex];
      Cryptonomicon.currentKeyIndex = (Cryptonomicon.currentKeyIndex + 1) % apiKeys.length;
      return key;
    }
  }

  /**
   * Get request headers with API key
   */
  private getRequestHeaders(): Headers {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    const apiKey = this.getNextApiKey();

    if (apiKey) headers.set('x-api-key', apiKey);

    return headers;
  }

  /**
   * Fetch from metadata API with API key rotation
   */
  private async fetchMetadata(path: string): Promise<Response> {
    // Use base URL
    const baseUrl = "https://api.hiro.so";
    // Make the fetch request with API key
    return fetch(`${baseUrl}${path}`, {
      headers: this.getRequestHeaders()
    });
  }

  /**
   * Call a read-only contract method
   */
  async callReadOnly(
    contractId: string,
    method: string,
    args: any[] = []
  ): Promise<any> {
    try {
      if (!this.config.proxy) {
        throw new Error("Proxy URL not configured");
      }

      const response = await fetch(this.config.proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          method,
          args,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to call ${contractId}.${method}: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      if (this.config.debug) {
        console.error(`Failed to call ${contractId}.${method}:`, error);
      }
      throw error;
    }
  }

  /**
   * Get token metadata, prioritizing external token_uri if available,
   * then Hiro API, and finally direct contract calls as fallbacks.
   *
   * @param contractId The contract ID to fetch metadata for
   * @returns TokenMetadata or null if not found
   */
  async getTokenMetadata(contractId: string): Promise<TokenMetadata | null> {
    // Handle special case for STX token
    if (contractId === ".stx") {
      // Predefined metadata for native STX
      return {
        sip: 10, // STX conforms to SIP-010 interface conceptually
        name: "Stacks Token",
        symbol: "STX",
        decimals: 6,
        description: "The native token of the Stacks blockchain.",
        image: "https://charisma.rocks/stx-logo.png", // Use a placeholder or official logo URL
        contract_principal: ".stx",
      };
    }

    let externalMetadata: Partial<TokenMetadata> = {};
    let fallbackContractData: Partial<TokenMetadata> = {};
    let apiMetadata: Partial<TokenMetadata> = {};
    let tokenUri: string | null = null;

    try {
      // 1. Attempt to fetch external metadata from token_uri
      try {
        tokenUri = await this.getTokenUri(contractId); // Re-use existing method
        if (tokenUri) {
          externalMetadata = await this.fetchMetadataFromUri(tokenUri);
          if (this.config.debug) console.debug(`[${contractId}] External URI (${tokenUri}) Data:`, externalMetadata);
        }
      } catch (uriError) {
        if (this.config.debug) {
          console.warn(`Failed to get or fetch from token_uri for ${contractId}: ${uriError}`);
        }
      }

      // 2. Attempt to fetch from Hiro API
      try {
        const path = `/metadata/v1/ft/${contractId}`;
        const response = await this.fetchMetadata(path); // Uses Hiro API keys

        if (response.ok) {
          const rawApiData: any = await response.json();
          // Normalize Hiro structure (if necessary, adjust based on actual response)
          const normalizedApiData = {
            ...rawApiData,
            ...(rawApiData.metadata || {}),
            ...(rawApiData.properties || {}),
          };
          delete normalizedApiData.metadata;
          delete normalizedApiData.properties;
          delete normalizedApiData.generated;

          apiMetadata = {
            contractId: contractId,
            name: normalizedApiData.name,
            symbol: normalizedApiData.symbol,
            decimals: normalizedApiData.decimals,
            description: normalizedApiData.description,
            image: normalizedApiData.image_uri || normalizedApiData.image_canonical_uri,
            identifier: normalizedApiData.asset_identifier?.split("::")[1], // Extract identifier if present
            total_supply: normalizedApiData.total_supply?.value ? Number(normalizedApiData.total_supply.value) : undefined,
            // Add other relevant fields from Hiro API if needed
          };
          if (this.config.debug) console.debug(`[${contractId}] Hiro API Data:`, apiMetadata);
        } else {
          if (this.config.debug) {
            console.warn(`Hiro API request failed for ${contractId}: ${response.status}`);
          }
        }
      } catch (apiError) {
        if (this.config.debug) {
          console.warn(`Error fetching from Hiro API for ${contractId}: ${apiError}`);
        }
        // Continue even if Hiro API fails, we might have external or contract data
      }

      // 3. Fetch essential data (name, symbol, decimals) directly from contract if needed
      if (!apiMetadata.name || !apiMetadata.symbol || apiMetadata.decimals === undefined) {
        try {
          const [name, symbol, decimals] = await Promise.all([
            this.getTokenName(contractId).catch(() => undefined),
            this.getTokenSymbol(contractId).catch(() => undefined),
            this.getTokenDecimals(contractId).catch(() => undefined)
          ]);
          // Assign ONLY name, symbol, decimals to fallback
          fallbackContractData = { name, symbol, decimals };
          if (this.config.debug) console.debug(`[${contractId}] Contract Fallback Data (Essentials):`, fallbackContractData);
        } catch (contractError) {
          if (this.config.debug) {
            console.warn(`Failed to fetch basic info from contract ${contractId}: ${contractError}`);
          }
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

      // 4. Merge data: Prioritize External -> API -> Contract Fallback (for non-supply fields)
      const finalMetadata: Partial<TokenMetadata> = {
        // Start with the least specific source (contract calls for name/symbol/decimals)
        ...this.filterUndefined(fallbackContractData),
        // Layer on API data (overwrites contract data if present, including its potentially incorrect supply)
        ...this.filterUndefined(apiMetadata),
        // Layer on External URI data (overwrites API/contract data if present, including its potentially incorrect supply)
        ...this.filterUndefined(externalMetadata),
        // Set non-critical fields defaults if they are still undefined after merges
        description: externalMetadata.description || apiMetadata.description || fallbackContractData.description || "",
        image: externalMetadata.image || apiMetadata.image || fallbackContractData.image || "",
        // Ensure contract_principal and token_uri are set
        token_uri: tokenUri || undefined,
        contract_principal: contractId,
      };

      // 4b. Override total_supply with the on-chain value if fetched successfully
      if (onChainSupply !== undefined) {
        finalMetadata.total_supply = onChainSupply;
      }

      if (this.config.debug) console.debug(`[${contractId}] Final Merged Metadata (Supply Overridden):`, finalMetadata);

      // Basic validation: Ensure essential fields (name, symbol) are present
      // Decimals are allowed to be undefined now.
      if (!finalMetadata.name || !finalMetadata.symbol) {
        if (this.config.debug) {
          // Adjusted warning message
          console.warn(`Could not resolve essential metadata (name or symbol) for ${contractId}. Name: ${finalMetadata.name}, Symbol: ${finalMetadata.symbol}`);
        }
        // If name or symbol are missing after all attempts, return null
        return null;
      }

      // Add a debug warning if decimals is missing, but don't fail
      if (finalMetadata.decimals === undefined && this.config.debug) {
        console.warn(`Decimals information missing for ${contractId}. Proceeding without it.`);
      }

      // Cast to definitive type now that validation passed for required fields
      return finalMetadata as TokenMetadata;
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
  private async fetchMetadataFromUri(uri: string): Promise<Partial<TokenMetadata>> {
    let metadataUri = uri;
    if (uri.startsWith('ipfs://')) {
      if (!this.config.ipfsGateway) {
        if (this.config.debug) console.warn(`IPFS URI found (${uri}) but no ipfsGateway configured.`);
        return {};
      }
      metadataUri = uri.replace('ipfs://', this.config.ipfsGateway);
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
        lpRebatePercent: externalData.lpRebatePercent || externalData.properties?.swapFeePercent || externalData.properties?.lpRebatePercent, // Include top-level fee
        tokenAContract: externalData.tokenAContract || externalData.properties?.tokenAContract,
        tokenBContract: externalData.tokenBContract || externalData.properties?.tokenBContract,
        external: externalData,
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
      // Use StacksClient to call the contract directly
      const result = await this.client.callReadOnly(contractId, "get-token-uri");

      if (typeof result === 'string') {
        return result;
      } else if (result && typeof result === 'object' && 'value' in result) {
        return result.value as string;
      }

      return null;
    } catch (error) {
      if (this.config.debug) {
        console.error("Failed to get token URI:", error);
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
        contractId: ".stx",
        identifier: "STX",
        name: "Stacks Token",
        symbol: "STX",
        decimals: 6,
        description: "The native token of the Stacks blockchain",
        image: "https://charisma.rocks/stx-logo.png",
        contract_principal: ".stx"
      };
    }

    try {
      // Get token metadata
      const metadata = await this.getTokenMetadata(contractId);

      if (metadata) {
        return {
          contractId,
          identifier: metadata.identifier,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals!,
          description: metadata.description || "",
          image: metadata.image || "",
          contract_principal: metadata.contract_principal || contractId
        };
      }

      // Fallback: fetch token info directly from contract
      const [symbol, decimals, name] = await Promise.all([
        this.getTokenSymbol(contractId),
        this.getTokenDecimals(contractId).catch(() => undefined),
        this.getTokenName(contractId)
      ]);

      return {
        contractId,
        identifier: undefined,
        name: name || "",
        symbol: symbol || "",
        decimals: decimals!,
        description: "",
        image: "",
        contract_principal: contractId
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
      const result = await this.client.callReadOnly(contractId, "get-symbol");
      return typeof result === 'string' ? result : (result as any)?.value || '';
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get symbol for ${contractId}:`, error);
      }
      return contractId.split('.')[1] || "UNKNOWN"; // Use contract name as fallback
    }
  }

  /**
   * Get a token's name from contract
   */
  async getTokenName(contractId: string): Promise<string> {
    try {
      const result = await this.client.callReadOnly(contractId, "get-name");
      return typeof result === 'string' ? result : (result as any)?.value || '';
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get name for ${contractId}:`, error);
      }
      return contractId.split('.')[1] || "Unknown Token"; // Use contract name as fallback
    }
  }

  /**
   * Get a token's decimals from contract
   */
  async getTokenDecimals(contractId: string): Promise<number> {
    try {
      const result = await this.client.callReadOnly(contractId, "get-decimals");
      return typeof result === 'number' ? result : Number(result);
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get decimals for ${contractId}:`, error);
      }
      return 6; // Default to 6 decimals if we can't determine
    }
  }

  /**
   * Get token total supply
   */
  async getTokenSupply(contractId: string): Promise<number> {
    try {
      const result = await this.client.callReadOnly(contractId, "get-total-supply");
      return typeof result === 'number' ? result : Number(result);
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get total supply for ${contractId}:`, error);
      }
      return 0;
    }
  }

  /**
   * Get token balance for a contract
   */
  async getTokenBalance(tokenContract: string, holderContract: string): Promise<number> {
    try {
      const result = await this.client.callReadOnly(
        tokenContract,
        "get-balance",
        [principalCV(holderContract)]
      );
      return typeof result === 'number' ? result : Number(result);
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get balance for ${tokenContract} of ${holderContract}:`, error);
      }
      return 0;
    }
  }

  /**
   * Get STX balance for an address
   */
  async getStxBalance(address: string): Promise<number> {
    try {
      const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/stx`, {
        headers: this.getRequestHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch STX balance: ${response.status}`);
      }

      const data: any = await response.json();
      return Number(data.balance);
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get STX balance for ${address}:`, error);
      }
      return 0;
    }
  }

  /**
   * Update metadata for a token
   * 
   * @param contractId The contract ID to update metadata for
   * @param metadata The metadata to update
   * @param signature The signature for authentication
   * @param publicKey The publicKey for authentication
   * @returns Promise resolving to success or error
   */
  async updateMetadata(
    contractId: string,
    metadata: TokenMetadata,
    signature: string,
    publicKey: string,
  ): Promise<boolean> {
    const uri = await this.getTokenUri(contractId);
    if (!uri) {
      throw new Error("No token URI configured for contract");
    }
    const response = await fetch(uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-public-key': publicKey,
      },
      body: JSON.stringify(metadata)
    });

    if (!response.ok) {
      throw new Error(`Failed to persist metadata: ${response.statusText}`)
    } else {
      return true;
    }
  }

  /**
   * Search for tokens using Hiro's metadata API
   * 
   * @param options Search options
   * @returns Array of token information
   */
  async searchTokens(
    options: {
      name?: string;
      symbol?: string;
      address?: string;
      offset?: number;
      limit?: number;
      order_by?: string;
      order?: 'asc' | 'desc';
    } = {}
  ): Promise<any[]> {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (options.name) queryParams.append('name', options.name);
      if (options.symbol) queryParams.append('symbol', options.symbol);
      if (options.address) queryParams.append('address', options.address);
      if (options.offset !== undefined) queryParams.append('offset', options.offset.toString());
      if (options.limit !== undefined) queryParams.append('limit', options.limit.toString());
      if (options.order_by) queryParams.append('order_by', options.order_by);
      if (options.order) queryParams.append('order', options.order);

      // Use our metadata fetcher with API key rotation
      const response = await this.fetchMetadata(`/metadata/v1/ft?${queryParams.toString()}`);

      if (!response.ok) {
        if (this.config.debug) {
          console.warn(`Failed to fetch tokens from Hiro API: ${response.status}`);
        }
        return [];
      }

      const data: any = await response.json();
      return data.results || [];
    } catch (error) {
      if (this.config.debug) {
        console.error('Error searching tokens:', error);
      }
      return [];
    }
  }

  /**
   * Search for contracts implementing a specific trait
   */
  async searchContractsByTrait(
    trait: any,
    blacklist: string[] = []
  ): Promise<any[]> {
    let allContracts: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const path = `/extended/v1/contract/by_trait?trait_abi=${encodeURIComponent(JSON.stringify(trait))}&limit=50&offset=${offset}`;

        const response = await this.fetchMetadata(path);

        if (!response.ok) {
          throw new Error(`Failed to fetch contracts: ${response.status}`);
        }

        const data: any = await response.json();
        const results = data?.results || [];

        if (results.length === 0) {
          hasMore = false;
        } else {
          const filteredResults = results.filter(
            (contract: any) => !blacklist.includes(contract.contract_id)
          );
          allContracts = [...allContracts, ...filteredResults];
          offset += 50;
        }
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Error fetching contracts at offset ${offset}:`, error);
        }
        hasMore = false;
      }
    }

    return allContracts;
  }
}