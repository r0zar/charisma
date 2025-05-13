/* eslint-disable @typescript-eslint/no-explicit-any */

import { callReadOnlyFunction } from "@repo/polyglot";
import { cvToValue, principalCV } from "@stacks/transactions";

/**
 * Interface for token metadata
 */
export interface TokenMetadata {
  type: string;
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
  type: string;
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
  async getTokenMetadata(contractId: string): Promise<TokenMetadata | null> {
    // Handle special case for STX token
    if (contractId === ".stx") {
      // Predefined metadata for native STX
      return {
        type: "",
        sip: 10, // STX conforms to SIP-010 interface conceptually
        name: "Stacks Token",
        symbol: "STX",
        decimals: 6,
        description: "The native token of the Stacks blockchain.",
        image: "https://charisma.rocks/stx-logo.png", // Use a placeholder or official logo URL
        contractId: ".stx",
        contract_principal: ".stx",
      };
    }

    let customSourceMetadata: Partial<TokenMetadata> = {}; // Initialize for custom API data
    // 1. Attempt to fetch from custom metadata API if configured
    if (this.config.metadataApiBaseUrl) {
      try {
        const customApiUrl = `${this.config.metadataApiBaseUrl}/api/v1/metadata/${contractId}`.replace(/([^:]\/)\/+/g, "$1");
        if (this.config.debug) console.debug(`[${contractId}] Attempting to fetch from custom metadata API: ${customApiUrl}`);
        const response = await fetch(customApiUrl);

        if (response.ok) {
          const customData = await response.json() as Partial<TokenMetadata>;
          console.log(`[${contractId}] Custom API Data:`, customData);
          if (this.config.debug) console.debug(`[${contractId}] Custom API Data:`, customData);

          // Populate customSourceMetadata if data is useful, primarily name, description, image
          // but include any other relevant fields from the custom API response.
          if (customData && (customData.name || customData.description || customData.image)) {
            if (this.config.debug) console.debug(`[${contractId}] Data from custom metadata API will be used for merging.`);
            customSourceMetadata = {
              // Map all potential fields from customData that align with TokenMetadata
              ...customData, // Spread all fields from customData first
              // Explicitly ensure types or fallbacks for critical/expected fields if necessary
              name: customData.name || undefined,
              description: customData.description || undefined,
              image: customData.image || undefined,
              // Convert total_supply if it exists and is a string/number
              total_supply: customData.total_supply !== undefined ? Number(customData.total_supply) : undefined,
            };
          } else {
            if (this.config.debug) console.warn(`[${contractId}] Custom API data did not contain expected fields (name, description, image) or was empty.`);
          }
        } else {
          if (this.config.debug) console.warn(`[${contractId}] Custom metadata API request failed: ${response.status} ${response.statusText}`);
        }
      } catch (customApiError) {
        if (this.config.debug) {
          console.warn(`[${contractId}] Error fetching from custom metadata API:`, customApiError);
        }
        // If custom API fetch fails, customSourceMetadata remains empty, and we fall through
      }
    }

    console.log(`[${contractId}] Custom Source Metadata:`, customSourceMetadata);

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
        const baseUrl = "https://api.hiro.so";
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const apiKey = this.config.apiKey || "";
        if (apiKey) headers.set('x-api-key', apiKey);
        const response = await fetch(`${baseUrl}${path}`, { headers });

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

      // 4. Merge data: Prioritize External -> Custom API -> Hiro API -> Contract Fallback
      const finalMetadata: Partial<TokenMetadata> = {
        ...this.filterUndefined(externalMetadata),         // Most precedent for many fields
        ...this.filterUndefined(fallbackContractData),     // Least precedent
        ...this.filterUndefined(apiMetadata),
        ...this.filterUndefined(customSourceMetadata),     // Data from your custom API

        // Explicitly set description and image with fallback chain
        description: externalMetadata.description || customSourceMetadata.description || apiMetadata.description || fallbackContractData.description || "",
        image: externalMetadata.image || customSourceMetadata.image || apiMetadata.image || fallbackContractData.image || "",

        // token_uri: prioritize external, then custom, then direct contract call result (tokenUri)
        token_uri: externalMetadata.token_uri || customSourceMetadata.token_uri || tokenUri || undefined,
        contract_principal: contractId, // Always set this to the requested contractId

        // Consolidate identifier and asset_identifier, prioritizing external, then custom, then api
        identifier: externalMetadata.identifier || customSourceMetadata.identifier || apiMetadata.identifier || undefined,
        asset_identifier: externalMetadata.asset_identifier || customSourceMetadata.asset_identifier ||
          externalMetadata.identifier || customSourceMetadata.identifier ||
          apiMetadata.identifier || undefined, // apiMetadata might only have 'identifier'
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
        contract_principal: ".stx"
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
        type: '',
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

  /**
   * Get token balance for a contract
   */
  async getTokenBalance(tokenContractId: string, holderPrincipal: string): Promise<number> {
    try {
      const [contractAddress, contractName] = tokenContractId.split('.');
      if (!contractAddress || !contractName) {
        if (this.config.debug) console.warn(`Invalid tokenContractId for getTokenBalance: ${tokenContractId}`);
        return 0; // Original fallback
      }
      const result = await callReadOnlyFunction(
        contractAddress,
        contractName,
        "get-balance",
        [principalCV(holderPrincipal)]
      );
      return result?.value;
    } catch (error) {
      if (this.config.debug) {
        console.warn(`Failed to get balance for ${tokenContractId} of ${holderPrincipal}:`, error);
      }
      return 0;
    }
  }

  /**
   * Get STX balance for an address
   */
  async getStxBalance(address: string): Promise<number> {
    try {
      const headers = new Headers({ 'Content-Type': 'application/json' }); // Content-Type might not be strictly necessary for a GET request but keeping for consistency
      const apiKey = this.config.apiKey || "";
      if (apiKey) headers.set('x-api-key', apiKey);
      const response = await fetch(`https://api.hiro.so/extended/v1/address/${address}/stx`, {
        headers: headers
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

        const baseUrl = "https://api.hiro.so";
        const headers = new Headers({ 'Content-Type': 'application/json' });
        const apiKey = this.config.apiKey || "";
        if (apiKey) headers.set('x-api-key', apiKey);
        const response = await fetch(`${baseUrl}${path}`, { headers });

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