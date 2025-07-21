/**
 * SIP-009 Non-Fungible Token Standard
 * https://github.com/stacksgov/sips/blob/main/sips/sip-009/sip-009-nft-standard.md
 */

import type { Contract } from './Contract';
import type { TransactionResult } from '../types/shared';

export interface SIP009 extends Contract {
  // === Read-Only Functions ===
  
  /**
   * Get the last token ID
   */
  getLastTokenId(): Promise<string>;
  
  /**
   * Get the token URI for a given token ID
   */
  getTokenUri(tokenId: string): Promise<string>;
  
  /**
   * Get the owner of a token
   */
  getOwner(tokenId: string): Promise<string>;
  
  /**
   * Get the approved address for a token
   */
  getApproved(tokenId: string): Promise<string | null>;
  
  /**
   * Check if an operator is approved for all tokens of an owner
   */
  isApprovedForAll(owner: string, operator: string): Promise<boolean>;
  
  /**
   * Get the balance of NFTs for an owner
   */
  getBalance(owner: string): Promise<string>;
  
  // === Public Functions ===
  
  /**
   * Transfer a token from one address to another
   */
  transfer(tokenId: string, sender: string, recipient: string): Promise<TransactionResult>;
  
  /**
   * Transfer a token from one address to another (with operator support)
   */
  transferFrom(tokenId: string, sender: string, recipient: string): Promise<TransactionResult>;
  
  /**
   * Approve an address to transfer a specific token
   */
  approve(tokenId: string, spender: string): Promise<TransactionResult>;
  
  /**
   * Set approval for all tokens
   */
  setApprovalForAll(operator: string, approved: boolean): Promise<TransactionResult>;
  
  /**
   * Mint a new token (if contract supports it)
   */
  mint?(recipient: string, tokenUri?: string): Promise<TransactionResult>;
  
  /**
   * Burn a token (if contract supports it)
   */
  burn?(tokenId: string): Promise<TransactionResult>;

  /**
   * Get all tokens owned by an address (utility method)
   */
  getOwnedTokens?(owner: string): Promise<string[]>;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}