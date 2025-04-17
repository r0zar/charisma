/* eslint-disable @typescript-eslint/no-explicit-any */
import { AddressEntry } from '@stacks/connect/dist/types/methods';
import {
  ClarityValue,
  getAddressFromPrivateKey,
  signStructuredData,
} from '@stacks/transactions';

/**
 * Simple interface for structured message data
 */
export interface StructuredMessage {
  domain: ClarityValue;
  message: ClarityValue;
}

/**
 * Message signer for creating signatures for write intents
 */
export class MessageSigner {
  private privateKey?: string;
  address: string;
  network: 'mainnet' | 'testnet';

  /**
   * Create a new message signer
   * @param privateKey - Private key for signing messages
   * @param network - Network to use for address generation
   */
  constructor(privateKey?: string, network: 'mainnet' | 'testnet' = 'mainnet') {
    this.privateKey = privateKey;
    this.network = network;

    // If private key is provided, derive address immediately
    if (privateKey) {
      // Generate Stacks address from private key
      this.address = getAddressFromPrivateKey(privateKey, this.network);
    } else {
      // Default empty address
      this.address = '';
    }
  }

  /**
   * Get the signer's address
   */
  async getAddress(): Promise<string> {
    if (!this.address) {
      const addresses: AddressEntry[] = JSON.parse(localStorage.getItem('addresses') || '[]')
      if (addresses.length) return addresses[2].address
      const { connect } = await import('@stacks/connect')
      const result = await connect()
      localStorage.setItem('addresses', JSON.stringify(result.addresses))
      return result.addresses[2].address
    }
    return this.address;
  }

  /**
   * Sign a structured message with domain and message data
   * @param structuredData - Object containing domain and message
   * @returns Signature as hex string
   */
  async signStructuredData(structuredData: StructuredMessage): Promise<string> {
    try {

      if (!this.privateKey) {
        // Sign the structured data with sip30 wallet
        const { request } = await import('@stacks/connect')
        const result = await request('stx_signStructuredMessage', structuredData as any)
        return result.signature
      }

      // Sign the structured data with private key
      const signature = await signStructuredData({
        domain: structuredData.domain,
        message: structuredData.message,
        privateKey: this.privateKey!,
      });
      return signature;

    } catch (error) {
      console.error('Failed to sign structured data:', error);
      if (error instanceof Error) {
        throw new Error(`Signing failed: ${error.message}`);
      }
      throw new Error('Signing failed: Unknown error');
    }
  }

  /**
   * Verify a signature against a message and signer
   * @param message - Original message that was signed
   * @param signature - Signature to verify
   * @param signerAddress - Address of the signer
   * @returns Boolean indicating if signature is valid
   */
  verifySignature(
    message: any,
    signature: string,
    signerAddress: string
  ): boolean {
    try {
      // Note: This is a placeholder - in a real implementation, you would use
      // cryptographic verification to check the signature against the message and public key

      // For a real implementation, you would:
      // 1. Extract the public key from the signature
      // 2. Verify the signature against the message and public key
      // 3. Check that the public key matches the signerAddress

      // This would typically use libraries like @stacks/encryption or other verification methods
      // from @stacks/transactions
      console.log({ message, signature, signerAddress });
      console.warn('Signature verification is not fully implemented');

      // For now, just return true (assuming all signatures are valid)
      // In production, you must replace this with actual verification
      return true;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Set a new private key
   * @param privateKey - New private key to use
   */
  setPrivateKey(privateKey: string): void {
    this.privateKey = privateKey;
    this.address = getAddressFromPrivateKey(privateKey, this.network);
  }
}
