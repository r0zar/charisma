import { Dexterity, type Vault, type Route } from "@repo/dexterity";
import type { Token } from "@repo/cryptonomicon";
import { log } from "@repo/logger";
import "dotenv/config"

/**
 * Cache statistics
 */
interface CacheStats {
  vaults: number;
  tokens: number;
  lastUpdated: Date;
  indexing: boolean;
}

/**
 * Service that manages Dexterity functionality
 * Pre-indexes and caches vaults, tokens, and routes
 */
export class DexterityService {
  private static instance: DexterityService;

  // Cache storage
  private vaults: Vault[] = [];
  private tokens: Token[] = [];
  private tokenMap: Map<string, Token> = new Map();
  private popularPairs: Map<string, Route> = new Map();

  // Cache status
  private lastUpdated: Date = new Date(0);
  private isIndexing: boolean = false;
  private updateIntervalId: NodeJS.Timeout | null = null;
  private cacheTimeoutMs = 5 * 60 * 1000; // 5 minutes

  // Options
  private readonly routerAddress?: string;
  private readonly routerName?: string;

  // Private constructor (singleton pattern)
  private constructor(options?: {
    routerAddress?: string;
    routerName?: string;
    updateIntervalMs?: number;
  }) {
    // Set options
    this.routerAddress = options?.routerAddress;
    this.routerName = options?.routerName;

    // Configure Dexterity

    Dexterity.init({
      debug: true,
      apiKey: process.env.HIRO_API_KEY,
    });

    // Configure router if information provided
    if (this.routerAddress && this.routerName) {
      Dexterity.configureRouter(
        this.routerAddress,
        this.routerName,
        { maxHops: 3, defaultSlippage: 0.01 }
      );
      log(`Dexterity router configured: ${this.routerAddress}.${this.routerName}`);
    }

    // Start automatic updates if interval provided
    if (options?.updateIntervalMs) {
      this.indexData()
      this.updateIntervalId = setInterval(
        () => this.indexData(),
        options.updateIntervalMs
      );
      log(`Dexterity service scheduled to update every ${options.updateIntervalMs / 1000} seconds`);
    }
  }

  /**
   * Get the singleton instance
   */
  static getInstance(options?: {
    routerAddress?: string;
    routerName?: string;
    updateIntervalMs?: number;
  }): DexterityService {
    if (!DexterityService.instance) {
      DexterityService.instance = new DexterityService(options);
    }
    return DexterityService.instance;
  }

  /**
   * Stop the automatic update interval
   */
  stopUpdates(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return {
      vaults: this.vaults.length,
      tokens: this.tokens.length,
      lastUpdated: this.lastUpdated,
      indexing: this.isIndexing
    };
  }

  /**
   * Index all data (vaults, tokens, popular pairs)
   * This function is idempotent and will not run multiple times simultaneously
   */
  async indexData(): Promise<void> {
    // Prevent concurrent indexing
    if (this.isIndexing) {
      log("Skipping indexing as another indexing operation is in progress");
      return;
    }

    this.isIndexing = true;

    try {
      // Check if cache is still fresh
      const now = new Date();
      if ((now.getTime() - this.lastUpdated.getTime()) < this.cacheTimeoutMs) {
        log("Using cached data, still fresh");
        return;
      }

      log("Indexing Dexterity data...");

      // Discover and load vaults - increased max limit to ensure all vaults are loaded
      const vaults = await Dexterity.discoverAndLoad({
        continueOnError: true,
        parallelRequests: 10, // Increased for better performance
        maxVaultLoadLimit: 200 // Increased substantially to ensure all vaults are discovered
      });

      this.vaults = vaults;
      log(`Indexed ${vaults.length} vaults`);

      // Extract all unique tokens
      this.tokens = Dexterity.getAllVaultTokens(vaults);

      // Build token map for quick lookup
      this.tokenMap.clear();
      for (const token of this.tokens) {
        this.tokenMap.set(token.contractId, token);
      }

      log(`Indexed ${this.tokens.length} unique tokens`);

      // Update last updated timestamp
      this.lastUpdated = new Date();
      log("Dexterity indexing completed successfully");
    } catch (error) {
      log(`Error indexing Dexterity data: ${error}`);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Get all indexed vaults
   */
  getVaults(): Vault[] {
    return this.vaults;
  }

  /**
   * Get all indexed tokens
   */
  getTokens(): Token[] {
    return this.tokens;
  }

  /**
   * Get a specific token by ID
   */
  getToken(tokenId: string): Token | undefined {
    return this.tokenMap.get(tokenId);
  }

  /**
   * Get vaults containing a specific token
   */
  getVaultsWithToken(tokenId: string): Vault[] {
    return Dexterity.getVaultsWithToken(this.vaults, tokenId);
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(
    fromTokenId: string,
    toTokenId: string,
    amount: number
  ): Promise<{ route: Route; amountIn: number; amountOut: number; expectedPrice: number; minimumReceived: number; } | Error> {
    // Check cache for popular pairs
    const pairKey = `${fromTokenId}-${toTokenId}`;
    const cachedRoute = this.popularPairs.get(pairKey);

    // If we have a cached route and the amount is similar to what we indexed
    // we can use the cached route to estimate the price, but still get a fresh quote
    let estimatedPrice: number | undefined;

    if (cachedRoute) {
      estimatedPrice = cachedRoute.amountOut / cachedRoute.amountIn;
    }

    // Get a fresh quote
    return await Dexterity.getQuote(fromTokenId, toTokenId, amount);
  }
}