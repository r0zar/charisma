import { getTokenMetadataCached, listTokens } from '@repo/tokens';
import { Token } from '../contracts/Token';
import { Credit } from '../contracts/Credit';
import { NFT } from '../contracts/NFT';
import { Sublink } from '../contracts/Sublink';
import { LiquidityPool } from '../contracts/LiquidityPool';
import { Blaze } from '../contracts/Blaze';
import { Multihop } from '../contracts/multihop';
import type { TokenCacheData } from '../types/shared';
import type { Contract } from '../traits/Contract';
import type { Vault } from '../traits/Vault';
import type { SIP010 } from '../traits/SIP010';
import type { SIP009 } from '../traits/SIP009';

/**
 * Smart contract factory for creating appropriate contract instances
 * based on metadata and contract type detection
 */
export class ContractFactory {
  private static tokenCache = new Map<string, SIP010>();
  private static nftCache = new Map<string, SIP009>();
  private static vaultCache = new Map<string, Sublink | LiquidityPool>();
  private static multihopCache = new Map<string, Multihop>();

  // === Token Creation ===

  /**
   * Create appropriate token instance based on metadata
   */
  static async createToken(contractId: string): Promise<SIP010> {
    // Check cache first
    if (this.tokenCache.has(contractId)) {
      return this.tokenCache.get(contractId)!;
    }

    try {
      const metadata = await getTokenMetadataCached(contractId);
      let token: SIP010;

      if (metadata.type === 'SUBNET' && metadata.base) {
        token = new Credit(contractId, metadata.base);
      } else {
        token = new Token(contractId);
      }

      // Pre-load metadata if method exists
      if ('getMetadata' in token && typeof token.getMetadata === 'function') {
        await token.getMetadata();
      }

      // Cache the instance
      this.tokenCache.set(contractId, token);
      return token;
    } catch (error) {
      console.warn(`Failed to create token for ${contractId}:`, error);
      // Return basic token as fallback
      const token = new Token(contractId);
      this.tokenCache.set(contractId, token);
      return token;
    }
  }

  /**
   * Create token instance if we already know it's a regular token
   */
  static createBasicToken(contractId: string): Token {
    const token = new Token(contractId);
    this.tokenCache.set(contractId, token);
    return token;
  }

  /**
   * Create credit token instance with known base contract
   */
  static createCredit(contractId: string, baseContract: string): Credit {
    const token = new Credit(contractId, baseContract);
    this.tokenCache.set(contractId, token);
    return token;
  }

  // === NFT Creation ===

  /**
   * Create NFT instance with automatic type detection
   */
  static async createNFT(contractId: string): Promise<SIP009> {
    // Check cache first
    if (this.nftCache.has(contractId)) {
      return this.nftCache.get(contractId)!;
    }

    try {
      const nft = new NFT(contractId);
      
      // Validate it's actually an NFT contract
      const isNFT = await NFT.isNFT(contractId);
      if (!isNFT) {
        throw new Error('Contract does not implement SIP-009 interface');
      }

      // Cache the instance
      this.nftCache.set(contractId, nft);
      return nft;
    } catch (error) {
      console.warn(`Failed to create NFT for ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Create NFT instance without validation
   */
  static createBasicNFT(contractId: string): NFT {
    const nft = new NFT(contractId);
    this.nftCache.set(contractId, nft);
    return nft;
  }

  // === Vault Creation ===

  /**
   * Create appropriate vault instance based on type detection
   */
  static async createVault(contractId: string, tokenAContractId: string, tokenBContractId: string): Promise<Sublink | LiquidityPool> {
    // Check cache first
    if (this.vaultCache.has(contractId)) {
      return this.vaultCache.get(contractId)!;
    }

    try {
      const vaultType = await this.detectVaultType(contractId);
      const tokenA = await this.createToken(tokenAContractId);
      const tokenB = await this.createToken(tokenBContractId);
      let vault: Sublink | LiquidityPool;

      if (vaultType === 'sublink') {
        vault = new Sublink(contractId, tokenA, tokenB);
      } else {
        vault = new LiquidityPool(contractId, tokenA, tokenB);
      }

      // Cache the instance
      this.vaultCache.set(contractId, vault);
      return vault;
    } catch (error) {
      console.warn(`Failed to create vault for ${contractId}:`, error);
      // Return liquidity pool as fallback
      const tokenA = await this.createToken(tokenAContractId);
      const tokenB = await this.createToken(tokenBContractId);
      const vault = new LiquidityPool(contractId, tokenA, tokenB);
      this.vaultCache.set(contractId, vault);
      return vault;
    }
  }

  /**
   * Create sublink instance
   */
  static createSublink(contractId: string, tokenA: SIP010, tokenB: SIP010): Sublink {
    const sublink = new Sublink(contractId, tokenA, tokenB);
    this.vaultCache.set(contractId, sublink);
    return sublink;
  }

  /**
   * Create liquidity pool instance
   */
  static createLiquidityPool(contractId: string, tokenA: SIP010, tokenB: SIP010): LiquidityPool {
    const pool = new LiquidityPool(contractId, tokenA, tokenB);
    this.vaultCache.set(contractId, pool);
    return pool;
  }

  // === Blaze Contract Creation ===

  /**
   * Create Blaze contract instance
   */
  static createBlaze(contractId?: string): Blaze {
    return new Blaze(contractId);
  }

  /**
   * Get the default Blaze contract
   */
  static getDefaultBlaze(): Blaze {
    return Blaze.getDefault();
  }

  // === Multihop Contract Creation ===

  /**
   * Create Multihop contract instance
   */
  static createMultihop(contractId: string): Multihop {
    // Check cache first
    if (this.multihopCache.has(contractId)) {
      return this.multihopCache.get(contractId)!;
    }

    const multihop = new Multihop(contractId);
    this.multihopCache.set(contractId, multihop);
    return multihop;
  }

  /**
   * Get default Multihop contract (common default address)
   */
  static getDefaultMultihop(): Multihop {
    const defaultContractId = '';
    return this.createMultihop(defaultContractId);
  }

  // === Helper Methods ===

  /**
   * Find credit token for a given base contract
   */
  static async findCredit(baseContract: string): Promise<Credit | null> {
    try {
      const allTokens = await listTokens();
      const subnetMetadata = allTokens.find(
        token => token.type === 'SUBNET' && token.base === baseContract
      );

      if (subnetMetadata) {
        return await this.createToken(subnetMetadata.contractId) as Credit;
      }

      return null;
    } catch (error) {
      console.warn(`Failed to find credit token for ${baseContract}:`, error);
      return null;
    }
  }

  /**
   * Get all credit tokens for a base contract
   */
  static async getAllCredits(baseContract: string): Promise<Credit[]> {
    try {
      const allTokens = await listTokens();
      const subnetMetadata = allTokens.filter(
        token => token.type === 'SUBNET' && token.base === baseContract
      );

      const subnetTokens = await Promise.all(
        subnetMetadata.map(async metadata =>
          await this.createToken(metadata.contractId) as Credit
        )
      );

      return subnetTokens;
    } catch (error) {
      console.warn(`Failed to get credit tokens for ${baseContract}:`, error);
      return [];
    }
  }

  // === Generic Contract Creation ===

  /**
   * Create a generic contract instance (useful for base Contract interface)
   */
  static createGenericContract(contractId: string): Contract {
    return {
      contractId,
      getContractName: () => contractId.split('.')[1],
      getContractAddress: () => contractId.split('.')[0],
      isValid: () => contractId.includes('.') && contractId.split('.').length === 2
    };
  }

  // === Type Detection ===

  /**
   * Detect contract type based on interface analysis
   */
  static async detectContractType(contractId: string): Promise<'token' | 'credit' | 'nft' | 'vault' | 'multihop' | 'unknown'> {
    try {
      // Try to get metadata first
      const metadata = await getTokenMetadataCached(contractId);
      
      if (metadata.type === 'SUBNET') {
        return 'credit';
      }
      
      if (metadata.type === 'SUBLINK') {
        return 'vault';
      }
      
      // Try NFT detection
      const isNFT = await NFT.isNFT(contractId);
      if (isNFT) {
        return 'nft';
      }
      
      // Try token detection (SIP-010)
      try {
        const token = new Token(contractId);
        await token.getSymbol();
        return 'token';
      } catch (error) {
        // Not a token
      }
      
      // Default to unknown
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Detect vault type based on contract analysis
   */
  private static async detectVaultType(contractId: string): Promise<'sublink' | 'liquidity-pool'> {
    try {
      // Try to get metadata that might indicate vault type
      const metadata = await getTokenMetadataCached(contractId);

      if (metadata.type === 'SUBLINK') {
        return 'sublink';
      }

      // Default to liquidity pool
      return 'liquidity-pool';
    } catch (error) {
      // If we can't determine type, default to liquidity pool
      return 'liquidity-pool';
    }
  }

  // === Type Guards ===

  /**
   * Check if contract implements Vault interface
   */
  static isVault(contract: any): contract is Vault {
    return contract instanceof Sublink || contract instanceof LiquidityPool;
  }

  /**
   * Check if vault is a sublink
   */
  static isSublink(vault: Vault): vault is Sublink {
    return vault.getType() === 'sublink';
  }

  /**
   * Check if vault is a liquidity pool
   */
  static isLiquidityPool(vault: Vault): vault is LiquidityPool {
    return vault.getType() === 'liquidity-pool';
  }

  /**
   * Check if token is a credit token
   */
  static isCredit(token: SIP010): token is Credit {
    return token instanceof Credit;
  }

  /**
   * Check if contract is a multihop router
   */
  static isMultihop(contract: any): contract is Multihop {
    return contract instanceof Multihop;
  }

  /**
   * Check if contract is an NFT
   */
  static isNFT(contract: any): contract is NFT {
    return contract instanceof NFT;
  }

  // === Cache Management ===

  /**
   * Clear all caches
   */
  static clearCaches(): void {
    this.tokenCache.clear();
    this.nftCache.clear();
    this.vaultCache.clear();
    this.multihopCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { tokens: number; nfts: number; vaults: number; multihops: number } {
    return {
      tokens: this.tokenCache.size,
      nfts: this.nftCache.size,
      vaults: this.vaultCache.size,
      multihops: this.multihopCache.size
    };
  }

  /**
   * Remove specific contract from cache
   */
  static removeCached(contractId: string): void {
    this.tokenCache.delete(contractId);
    this.nftCache.delete(contractId);
    this.vaultCache.delete(contractId);
    this.multihopCache.delete(contractId);
  }
}