import { callReadOnly } from '@repo/polyglot';
import { principalCV, stringUtf8CV, someCV, noneCV, bufferCV, uintCV } from '@stacks/transactions';
import type { IntentVerifier, IntentData } from '../traits/IntentVerifier';
import { BLAZE_CONTRACT } from '../utils/constants';
import { isValidStacksAddress, isValidSignature, isValidUuid } from '../utils/validation';

/**
 * Blaze class implementing IntentVerifier trait
 * Provides access to the Blaze intent verification system
 */
export class Blaze implements IntentVerifier {
  constructor(public readonly contractId: string = BLAZE_CONTRACT) {
    if (!contractId.includes('.')) {
      throw new Error('Invalid contract ID format');
    }
  }

  // === IntentVerifier Trait Implementation ===

  async hash(
    contract: string,
    intent: string,
    uuid: string,
    opcode?: string,
    amount?: string,
    target?: string
  ): Promise<string> {
    if (!isValidStacksAddress(contract)) {
      throw new Error('Invalid contract address');
    }
    
    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }
    
    if (target && !isValidStacksAddress(target)) {
      throw new Error('Invalid target address');
    }

    try {
      const args = [
        principalCV(contract),
        stringUtf8CV(intent),
        stringUtf8CV(uuid),
        opcode ? someCV(bufferCV(Buffer.from(opcode, 'hex'))) : noneCV(),
        amount ? someCV(uintCV(amount)) : noneCV(),
        target ? someCV(principalCV(target)) : noneCV()
      ];
      
      const result = await callReadOnly(this.contractId, 'hash', args);
      
      if (result?.value) {
        return result.value.toString();
      }
      
      throw new Error('Invalid response from hash');
    } catch (error) {
      console.warn(`Failed to generate hash with ${this.contractId}:`, error);
      throw error;
    }
  }

  async execute(
    signature: string,
    intent: string,
    uuid: string,
    opcode?: string,
    amount?: string,
    target?: string
  ): Promise<string> {
    if (!isValidSignature(signature)) {
      throw new Error('Invalid signature format');
    }
    
    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }
    
    if (target && !isValidStacksAddress(target)) {
      throw new Error('Invalid target address');
    }

    try {
      const args = [
        bufferCV(Buffer.from(signature, 'hex')),
        stringUtf8CV(intent),
        stringUtf8CV(uuid),
        opcode ? someCV(bufferCV(Buffer.from(opcode, 'hex'))) : noneCV(),
        amount ? someCV(uintCV(amount)) : noneCV(),
        target ? someCV(principalCV(target)) : noneCV()
      ];
      
      const result = await callReadOnly(this.contractId, 'execute', args);
      
      if (result?.value) {
        return result.value.toString();
      }
      
      throw new Error('Invalid response from execute');
    } catch (error) {
      console.warn(`Failed to execute intent with ${this.contractId}:`, error);
      throw error;
    }
  }

  async recover(
    signature: string,
    contract: string,
    intent: string,
    uuid: string,
    opcode?: string,
    amount?: string,
    target?: string
  ): Promise<string> {
    if (!isValidSignature(signature)) {
      throw new Error('Invalid signature format');
    }
    
    if (!isValidStacksAddress(contract)) {
      throw new Error('Invalid contract address');
    }
    
    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }
    
    if (target && !isValidStacksAddress(target)) {
      throw new Error('Invalid target address');
    }

    try {
      const args = [
        bufferCV(Buffer.from(signature, 'hex')),
        principalCV(contract),
        stringUtf8CV(intent),
        stringUtf8CV(uuid),
        opcode ? someCV(bufferCV(Buffer.from(opcode, 'hex'))) : noneCV(),
        amount ? someCV(uintCV(amount)) : noneCV(),
        target ? someCV(principalCV(target)) : noneCV()
      ];
      
      const result = await callReadOnly(this.contractId, 'recover', args);
      
      if (result?.value) {
        return result.value.toString();
      }
      
      throw new Error('Invalid response from recover');
    } catch (error) {
      console.warn(`Failed to recover signer with ${this.contractId}:`, error);
      throw error;
    }
  }

  async check(uuid: string): Promise<boolean> {
    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }

    try {
      const args = [stringUtf8CV(uuid)];
      
      const result = await callReadOnly(this.contractId, 'check', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to check UUID with ${this.contractId}:`, error);
      return false;
    }
  }

  // === Utility Methods ===

  /**
   * Generate a new UUID for intents
   */
  generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Verify an intent signature
   */
  async verifyIntent(intentData: IntentData, signature: string): Promise<boolean> {
    try {
      const expectedHash = await this.hash(
        intentData.contract,
        intentData.intent,
        intentData.uuid,
        intentData.opcode,
        intentData.amount,
        intentData.target
      );
      
      const recoveredSigner = await this.recover(
        signature,
        intentData.contract,
        intentData.intent,
        intentData.uuid,
        intentData.opcode,
        intentData.amount,
        intentData.target
      );
      
      return !!recoveredSigner; // Return true if we can recover a signer
    } catch (error) {
      console.warn('Failed to verify intent:', error);
      return false;
    }
  }

  /**
   * Check if a UUID has been used
   */
  async isUuidUsed(uuid: string): Promise<boolean> {
    return this.check(uuid);
  }

  // === Integration Helpers ===

  /**
   * Create intent hash for a subnet token operation
   */
  async createHashForSubnetToken(
    subnetTokenContract: string,
    intent: string,
    amount: string,
    target?: string
  ): Promise<string> {
    const uuid = this.generateUuid();
    
    return this.hash(
      subnetTokenContract,
      intent,
      uuid,
      undefined, // No opcode for basic subnet operations
      amount,
      target
    );
  }

  // === Factory Methods ===

  /**
   * Create Blaze instance
   */
  static create(contractId?: string): Blaze {
    return new Blaze(contractId);
  }

  /**
   * Get the default Blaze contract instance
   */
  static getDefault(): Blaze {
    return new Blaze();
  }

  toString(): string {
    return `Blaze(${this.contractId})`;
  }
}