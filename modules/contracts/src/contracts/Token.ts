import { callReadOnly } from '@repo/polyglot';
import { getTokenMetadataCached } from '@repo/tokens';
import { principalCV } from '@stacks/transactions';
import type { SIP010 } from '../traits/SIP010';
import type { TokenCacheData, TransactionResult } from '../types/shared';
import { formatTokenAmount, parseUserInput, DEFAULT_DECIMALS } from '../utils/formatting';
import { isValidStacksAddress, isValidAmount } from '../utils/validation';

/**
 * Token class implementing SIP-010 trait
 * Provides 1:1 mapping to SIP-010 contract functions plus utilities
 */
export class Token implements SIP010 {
  private _metadata?: TokenCacheData;

  constructor(public readonly contractId: string) {
    if (!contractId.includes('.')) {
      throw new Error('Invalid contract ID format');
    }
  }

  // === SIP-010 Trait Implementation ===

  async getName(): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-name', []);
      return result?.value || 'Unknown Token';
    } catch (error) {
      console.warn(`Failed to get name for ${this.contractId}:`, error);
      return 'Unknown Token';
    }
  }

  async getSymbol(): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-symbol', []);
      return result?.value || 'UNKNOWN';
    } catch (error) {
      console.warn(`Failed to get symbol for ${this.contractId}:`, error);
      return 'UNKNOWN';
    }
  }

  async getDecimals(): Promise<number> {
    try {
      const result = await callReadOnly(this.contractId, 'get-decimals', []);
      return result?.value || DEFAULT_DECIMALS;
    } catch (error) {
      console.warn(`Failed to get decimals for ${this.contractId}:`, error);
      return DEFAULT_DECIMALS;
    }
  }

  async getBalance(owner: string): Promise<string> {
    if (!isValidStacksAddress(owner)) {
      throw new Error('Invalid Stacks address');
    }

    try {
      const result = await callReadOnly(this.contractId, 'get-balance', [principalCV(owner)]);
      return result?.value?.toString() || '0';
    } catch (error) {
      console.warn(`Failed to get balance for ${this.contractId}:`, error);
      return '0';
    }
  }

  async getTotalSupply(): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-total-supply', []);
      return result?.value?.toString() || '0';
    } catch (error) {
      console.warn(`Failed to get total supply for ${this.contractId}:`, error);
      return '0';
    }
  }

  async getTokenUri(): Promise<string | null> {
    try {
      const result = await callReadOnly(this.contractId, 'get-token-uri', []);
      return result?.value || null;
    } catch (error) {
      console.warn(`Failed to get token URI for ${this.contractId}:`, error);
      return null;
    }
  }

  async transfer(amount: string, from: string, to: string, memo?: string): Promise<boolean> {
    // Note: This is a read-only implementation for interface compliance
    // Actual transfers would require transaction broadcasting
    if (!isValidAmount(amount) || !isValidStacksAddress(from) || !isValidStacksAddress(to)) {
      throw new Error('Invalid transfer parameters');
    }
    
    console.warn('Transfer function called - this requires transaction broadcasting');
    return false;
  }

  // === Utility Methods ===

  /**
   * Format atomic amount to human-readable string
   */
  formatBalance(atomicAmount: string | bigint): string {
    const decimals = this.metadata?.decimals || DEFAULT_DECIMALS;
    return formatTokenAmount(atomicAmount, decimals);
  }

  /**
   * Parse user input to atomic units
   */
  parseUserInput(input: string): string {
    const decimals = this.metadata?.decimals || DEFAULT_DECIMALS;
    return parseUserInput(input, decimals);
  }

  // === Cached Metadata Access ===

  /**
   * Get token metadata (cached)
   */
  async getMetadata(): Promise<TokenCacheData> {
    if (!this._metadata) {
      this._metadata = await getTokenMetadataCached(this.contractId);
    }
    return this._metadata;
  }

  /**
   * Get cached metadata or return cached value
   */
  private get metadata(): TokenCacheData | undefined {
    return this._metadata;
  }

  /**
   * Get symbol with fallback (synchronous)
   */
  get symbol(): string {
    return this.metadata?.symbol || 'UNKNOWN';
  }

  /**
   * Get decimals with fallback (synchronous)
   */
  get decimals(): number {
    return this.metadata?.decimals || DEFAULT_DECIMALS;
  }

  /**
   * Get name with fallback (synchronous)
   */
  get name(): string {
    return this.metadata?.name || 'Unknown Token';
  }

  // === Factory Methods ===

  /**
   * Create Token instance from contract ID
   */
  static async fromContractId(contractId: string): Promise<Token> {
    const token = new Token(contractId);
    await token.getMetadata(); // Pre-load metadata
    return token;
  }

  // === Type Information ===

  getType(): 'token' {
    return 'token';
  }

  // === Contract Interface Implementation ===

  getContractName(): string {
    return this.contractId.split('.')[1];
  }

  getContractAddress(): string {
    return this.contractId.split('.')[0];
  }

  isValid(): boolean {
    return this.contractId.includes('.') && this.contractId.split('.').length === 2;
  }

  toString(): string {
    return `Token(${this.contractId})`;
  }
}