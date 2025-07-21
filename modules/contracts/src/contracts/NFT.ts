/**
 * NFT Contract Class implementing SIP-009 standard
 */

import { callReadOnly } from '@repo/polyglot';
import { principalCV, uintCV } from '@stacks/transactions';
import type { SIP009, NFTMetadata } from '../traits/SIP009';
import type { TransactionResult } from '../types/shared';
import { isValidStacksAddress } from '../utils/validation';

export class NFT implements SIP009 {
  constructor(public readonly contractId: string) {
    if (!contractId.includes('.')) {
      throw new Error('Invalid contract ID format');
    }
  }
  /**
   * Get the last token ID
   */
  async getLastTokenId(): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-last-token-id', []);
      return result?.value?.toString() || '0';
    } catch (error) {
      console.warn(`Failed to get last token ID for ${this.contractId}:`, error);
      return '0';
    }
  }

  /**
   * Get the token URI for a given token ID
   */
  async getTokenUri(tokenId: string): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-token-uri', [uintCV(tokenId)]);
      return result?.value?.toString() || '';
    } catch (error) {
      console.warn(`Failed to get token URI for ${tokenId}:`, error);
      return '';
    }
  }

  /**
   * Get the owner of a token
   */
  async getOwner(tokenId: string): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-owner', [uintCV(tokenId)]);
      return result?.value?.toString() || '';
    } catch (error) {
      console.warn(`Failed to get owner for token ${tokenId}:`, error);
      return '';
    }
  }

  /**
   * Get the approved address for a token
   */
  async getApproved(tokenId: string): Promise<string | null> {
    try {
      const result = await callReadOnly(this.contractId, 'get-approved', [uintCV(tokenId)]);
      return result?.value?.toString() || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if an operator is approved for all tokens of an owner
   */
  async isApprovedForAll(owner: string, operator: string): Promise<boolean> {
    if (!isValidStacksAddress(owner)) {
      throw new Error('Invalid owner address');
    }
    if (!isValidStacksAddress(operator)) {
      throw new Error('Invalid operator address');
    }
    
    try {
      const result = await callReadOnly(this.contractId, 'is-approved-for-all', [
        principalCV(owner),
        principalCV(operator)
      ]);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to check approval for all:`, error);
      return false;
    }
  }

  /**
   * Get the balance of NFTs for an owner
   */
  async getBalance(owner: string): Promise<string> {
    if (!isValidStacksAddress(owner)) {
      throw new Error('Invalid owner address');
    }
    
    try {
      const result = await callReadOnly(this.contractId, 'get-balance', [principalCV(owner)]);
      return result?.value?.toString() || '0';
    } catch (error) {
      console.warn(`Failed to get NFT balance for ${owner}:`, error);
      return '0';
    }
  }

  /**
   * Transfer a token from one address to another
   */
  async transfer(tokenId: string, sender: string, recipient: string): Promise<TransactionResult> {
    if (!isValidStacksAddress(sender)) {
      throw new Error('Invalid sender address');
    }
    if (!isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }
    
    // TODO: Implement transaction calling when available
    throw new Error('Transaction functions not implemented yet');
  }

  /**
   * Transfer a token from one address to another (with operator support)
   */
  async transferFrom(tokenId: string, sender: string, recipient: string): Promise<TransactionResult> {
    if (!isValidStacksAddress(sender)) {
      throw new Error('Invalid sender address');
    }
    if (!isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }
    
    // TODO: Implement transaction calling when available
    throw new Error('Transaction functions not implemented yet');
  }

  /**
   * Approve an address to transfer a specific token
   */
  async approve(tokenId: string, spender: string): Promise<TransactionResult> {
    if (!isValidStacksAddress(spender)) {
      throw new Error('Invalid spender address');
    }
    
    // TODO: Implement transaction calling when available
    throw new Error('Transaction functions not implemented yet');
  }

  /**
   * Set approval for all tokens
   */
  async setApprovalForAll(operator: string, approved: boolean): Promise<TransactionResult> {
    if (!isValidStacksAddress(operator)) {
      throw new Error('Invalid operator address');
    }
    
    // TODO: Implement transaction calling when available
    throw new Error('Transaction functions not implemented yet');
  }

  /**
   * Mint a new token (if contract supports it)
   */
  async mint(recipient: string, tokenUri?: string): Promise<TransactionResult> {
    if (!isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }
    
    // TODO: Implement transaction calling when available
    throw new Error('Transaction functions not implemented yet');
  }

  /**
   * Burn a token (if contract supports it)
   */
  async burn(tokenId: string): Promise<TransactionResult> {
    // TODO: Implement transaction calling when available
    throw new Error('Transaction functions not implemented yet');
  }

  /**
   * Get NFT metadata from token URI
   */
  async getMetadata(tokenId: string): Promise<NFTMetadata | null> {
    try {
      const uri = await this.getTokenUri(tokenId);
      
      // Handle IPFS URIs
      if (uri.startsWith('ipfs://')) {
        const ipfsHash = uri.replace('ipfs://', '');
        const metadataResponse = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
        return await metadataResponse.json() as NFTMetadata;
      }
      
      // Handle HTTP URIs
      if (uri.startsWith('http')) {
        const metadataResponse = await fetch(uri);
        return await metadataResponse.json() as NFTMetadata;
      }
      
      // Handle data URIs
      if (uri.startsWith('data:')) {
        const base64Data = uri.split(',')[1];
        const jsonString = atob(base64Data);
        return JSON.parse(jsonString) as NFTMetadata;
      }
      
      return null;
    } catch (error) {
      console.warn(`Failed to fetch metadata for token ${tokenId}:`, error);
      return null;
    }
  }

  /**
   * Get all tokens owned by an address
   */
  async getOwnedTokens(owner: string): Promise<string[]> {
    if (!isValidStacksAddress(owner)) {
      throw new Error('Invalid owner address');
    }
    
    try {
      const balance = await this.getBalance(owner);
      const balanceNum = parseInt(balance);
      
      if (balanceNum === 0) {
        return [];
      }
      
      // This is a simplified implementation
      // In practice, you'd need to implement token enumeration
      // or use events to track owned tokens
      const tokens: string[] = [];
      const lastTokenId = await this.getLastTokenId();
      const lastTokenIdNum = parseInt(lastTokenId);
      
      for (let i = 1; i <= lastTokenIdNum; i++) {
        try {
          const tokenOwner = await this.getOwner(i.toString());
          if (tokenOwner === owner) {
            tokens.push(i.toString());
          }
        } catch (error) {
          // Token might not exist, continue
        }
      }
      
      return tokens;
    } catch (error) {
      console.warn(`Failed to get owned tokens for ${owner}:`, error);
      return [];
    }
  }

  /**
   * Check if this is an NFT contract
   */
  static async isNFT(contractId: string): Promise<boolean> {
    try {
      // Try to call a standard NFT function
      await callReadOnly(contractId, 'get-last-token-id', []);
      return true;
    } catch (error) {
      return false;
    }
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
}