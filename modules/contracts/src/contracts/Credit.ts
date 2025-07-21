import { callReadOnly } from '@repo/polyglot';
import { principalCV, uintCV, stringUtf8CV, bufferCV, someCV, noneCV } from '@stacks/transactions';
import type { SIP069 } from '../traits/SIP069';
import { Token } from './Token';
import { isValidStacksAddress, isValidAmount, isValidSignature, isValidUuid } from '../utils/validation';

/**
 * Credit class implementing SIP069 trait
 * Extends Token with subnet credit functionality
 */
export class Credit extends Token implements SIP069 {
  constructor(
    contractId: string,
    public readonly baseTokenContract: string
  ) {
    super(contractId);

    if (!baseTokenContract.includes('.')) {
      throw new Error('Invalid base token contract ID format');
    }
  }

  // === Subnet-Specific Function Implementation ===

  async deposit(amount: string, recipient?: string): Promise<boolean> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (recipient && !isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        uintCV(amount),
        recipient ? someCV(principalCV(recipient)) : noneCV()
      ];

      const result = await callReadOnly(this.contractId, 'deposit', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to deposit to ${this.contractId}:`, error);
      return false;
    }
  }

  async withdraw(amount: string, recipient?: string): Promise<boolean> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (recipient && !isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        uintCV(amount),
        recipient ? someCV(principalCV(recipient)) : noneCV()
      ];

      const result = await callReadOnly(this.contractId, 'withdraw', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to withdraw from ${this.contractId}:`, error);
      return false;
    }
  }

  async xRedeem(signature: string, amount: string, uuid: string, to: string): Promise<boolean> {
    if (!isValidSignature(signature)) {
      throw new Error('Invalid signature format');
    }

    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }

    if (!isValidStacksAddress(to)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        bufferCV(Buffer.from(signature, 'hex')),
        uintCV(amount),
        stringUtf8CV(uuid),
        principalCV(to)
      ];

      const result = await callReadOnly(this.contractId, 'x-redeem', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to execute x-redeem on ${this.contractId}:`, error);
      return false;
    }
  }

  async xTransfer(signature: string, amount: string, uuid: string, to: string): Promise<boolean> {
    if (!isValidSignature(signature)) {
      throw new Error('Invalid signature format');
    }

    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }

    if (!isValidStacksAddress(to)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        bufferCV(Buffer.from(signature, 'hex')),
        uintCV(amount),
        stringUtf8CV(uuid),
        principalCV(to)
      ];

      const result = await callReadOnly(this.contractId, 'x-transfer', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to execute x-transfer on ${this.contractId}:`, error);
      return false;
    }
  }

  async xTransferLte(signature: string, bound: string, actual: string, uuid: string, to: string): Promise<boolean> {
    if (!isValidSignature(signature)) {
      throw new Error('Invalid signature format');
    }

    if (!isValidAmount(bound) || !isValidAmount(actual)) {
      throw new Error('Invalid amount');
    }

    if (BigInt(actual) > BigInt(bound)) {
      throw new Error('Actual amount exceeds bound');
    }

    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }

    if (!isValidStacksAddress(to)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        bufferCV(Buffer.from(signature, 'hex')),
        uintCV(bound),
        uintCV(actual),
        stringUtf8CV(uuid),
        principalCV(to)
      ];

      const result = await callReadOnly(this.contractId, 'x-transfer-lte', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to execute x-transfer-lte on ${this.contractId}:`, error);
      return false;
    }
  }

  // === Subnet Utilities ===

  /**
   * Check if this token can execute intents
   */
  canExecuteIntents(): boolean {
    return true;
  }

  /**
   * Type guard for subnet tokens
   */
  get isSubnet(): true {
    return true;
  }

  /**
   * Get the base token contract
   */
  get baseContract(): string {
    return this.baseTokenContract;
  }

  // === Factory Methods ===

  /**
   * Create Credit instance from contract ID and base contract
   */
  static async fromContractIds(contractId: string, baseContract: string): Promise<Credit> {
    const token = new Credit(contractId, baseContract);
    await token.getMetadata(); // Pre-load metadata
    return token;
  }

  // === Type Information ===

  getType(): 'token' {
    return 'token';
  }

  toString(): string {
    return `Credit(${this.contractId} -> ${this.baseTokenContract})`;
  }
}