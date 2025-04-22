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
  identifier: string;
  symbol: string;
  decimals: number;
  total_supply?: string;
  token_uri?: string;
  image_uri?: string;
  image_thumbnail_uri?: string;
  image_canonical_uri?: string;
  tx_id?: string;
  sender_address?: string;
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
}

/**
 * Basic token information
 */
export interface Token {
  contractId: string;
  identifier: string;
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
      apiKeys: [],
      apiKeyRotation: "random",
      proxy: "https://charisma.rocks/api/v0/proxy",
      ipfsGateway: "https://ipfs.io/ipfs/",
      debug: false,
      network: 'mainnet',
      retryDelay: 3000,
      ...config
    };

    // Initialize StacksClient
    this.client = StacksClient.getInstance(config);

    if (this.config.debug) {
      console.debug("Cryptonomicon initialized with config:", this.config);
    }
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
   * Get token metadata from the Hiro API
   * 
   * @param contractId The contract ID to fetch metadata for
   * @returns TokenMetadata or null if not found
   */
  async getTokenMetadata(contractId: string): Promise<TokenMetadata | null> {
    try {
      // Build the URL path with properly encoded principal
      const path = `/metadata/v1/ft/${contractId}`;

      // Try to fetch the metadata using our metadata fetch method with API keys
      try {
        // Use our custom fetchMetadata method to make the request
        const response = await this.fetchMetadata(path);

        // Parse the JSON metadata from the API
        let apiMetadata: any = await response.json();

        // Normalize the metadata structure
        apiMetadata = Object.assign(apiMetadata, apiMetadata.metadata);
        apiMetadata = Object.assign(apiMetadata, apiMetadata.properties);
        delete apiMetadata.metadata;
        delete apiMetadata.properties;
        delete apiMetadata.generated;

        const fallbackData = await this.getTokenMetadataFallback(contractId);

        // Map the API response to our TokenMetadata interface
        return {
          ...fallbackData,
          ...apiMetadata,
          image: apiMetadata.image_uri || apiMetadata.image_canonical_uri || "",
          identifier: apiMetadata.asset_identifier?.split("::")[1] || "",
          contract_principal: contractId, // Always use the passed contractId
        };
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Error fetching from Hiro API for ${contractId}: ${error}`);
        }
        return await this.getTokenMetadataFallback(contractId);
      }
    } catch (error) {
      if (this.config.debug) {
        console.error(`Complete metadata retrieval failed for ${contractId}: ${error}`);
      }
      return null;
    }
  }

  /**
   * Fallback method to get token metadata using contract read-only functions
   * when Hiro API fails
   * 
   * @param contractId The contract ID to fetch metadata for
   * @returns TokenMetadata or null if not found
   */
  private async getTokenMetadataFallback(contractId: string): Promise<TokenMetadata | null> {
    try {
      // Try to get the token URI from the contract
      const uri = await this.getTokenUri(contractId);
      if (!uri) {
        if (this.config.debug) {
          console.warn(`No token URI available for ${contractId}, skipping`);
        }
        return null;
      }

      // Handle IPFS URIs
      let metadataUri = uri;
      if (uri.startsWith('ipfs://') && this.config.ipfsGateway) {
        const ipfsGateway = this.config.ipfsGateway;
        metadataUri = uri.replace('ipfs://', ipfsGateway);
      }

      // Try to fetch the metadata
      let response;
      try {
        response = await fetch(metadataUri);
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Failed to fetch from ${metadataUri}: ${error}`);
        }
        return null;
      }

      if (!response.ok) {
        if (this.config.debug) {
          console.warn(`Failed to fetch metadata from ${metadataUri}: ${response.status}`);
        }
        return null;
      }

      // Parse the JSON metadata and fill in any missing fields with defaults
      try {
        let metadata: any = await response.json();

        // Normalize the metadata structure
        metadata = Object.assign(metadata, metadata.metadata);
        metadata = Object.assign(metadata, metadata.properties);
        delete metadata.metadata;
        delete metadata.properties;
        delete metadata.generated;

        // Ensure all required fields exist with reasonable defaults
        return {
          ...metadata,
          token_uri: uri,
          contract_principal: contractId, // Always include the contract_principal with the passed contractId
        };
      } catch (error) {
        if (this.config.debug) {
          console.warn(`Failed to parse metadata JSON from ${metadataUri}: ${error}`);
        }
        return null;
      }
    } catch (error) {
      if (this.config.debug) {
        console.error(`Fallback metadata retrieval failed for ${contractId}: ${error}`);
      }
      return null;
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
          decimals: metadata.decimals,
          description: metadata.description || "",
          image: metadata.image || "",
          contract_principal: metadata.contract_principal || contractId
        };
      }

      // Fallback: fetch token info directly from contract
      const [symbol, decimals, name] = await Promise.all([
        this.getTokenSymbol(contractId),
        this.getTokenDecimals(contractId),
        this.getTokenName(contractId)
      ]);

      return {
        contractId,
        identifier: symbol,
        name,
        symbol,
        decimals,
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