import { callReadOnly } from '@repo/polyglot';
import { principalCV, uintCV, stringUtf8CV, bufferCV, someCV, noneCV } from '@stacks/transactions';
import type { Vault, VaultResult } from '../traits/Vault';
import { isValidStacksAddress, isValidAmount, isValidSignature, isValidUuid } from '../utils/validation';
import { SIP010 } from '../traits';

/**
 * Sublink class implementing Vault trait
 * Represents a bridge contract between mainnet and subnet
 */
export class Sublink implements Vault {
  constructor(public readonly contractId: string,
    public readonly tokenA: SIP010,
    public readonly tokenB: SIP010
  ) {
    if (!contractId.includes('.')) {
      throw new Error('Invalid contract ID format');
    }
  }

  // === Vault Trait Implementation ===

  async execute(amount: string, opcode?: string): Promise<VaultResult> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    try {
      const args = [
        uintCV(amount),
        opcode ? someCV(bufferCV(Buffer.from(opcode, 'hex'))) : noneCV()
      ];

      const result = await callReadOnly(this.contractId, 'execute', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from execute');
    } catch (error) {
      console.warn(`Failed to execute on ${this.contractId}:`, error);
      throw error;
    }
  }

  async quote(amount: string, opcode?: string): Promise<VaultResult> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    try {
      const args = [
        uintCV(amount),
        opcode ? someCV(bufferCV(Buffer.from(opcode, 'hex'))) : noneCV()
      ];

      const result = await callReadOnly(this.contractId, 'quote', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from quote');
    } catch (error) {
      console.warn(`Failed to get quote from ${this.contractId}:`, error);
      throw error;
    }
  }

  getType(): 'sublink' {
    return 'sublink';
  }

  // === Bridge-Specific Operations ===

  /**
   * Deposit tokens to subnet
   */
  async deposit(amount: string, recipient: string): Promise<VaultResult> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (!isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        uintCV(amount),
        principalCV(recipient)
      ];

      const result = await callReadOnly(this.contractId, 'deposit', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from deposit');
    } catch (error) {
      console.warn(`Failed to deposit to ${this.contractId}:`, error);
      throw error;
    }
  }

  /**
   * Withdraw tokens from subnet
   */
  async withdraw(amount: string, recipient: string): Promise<VaultResult> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (!isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        uintCV(amount),
        principalCV(recipient)
      ];

      const result = await callReadOnly(this.contractId, 'withdraw', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from withdraw');
    } catch (error) {
      console.warn(`Failed to withdraw from ${this.contractId}:`, error);
      throw error;
    }
  }

  /**
   * Execute signed intent on bridge
   */
  async xExecute(
    amount: string,
    opcode: string,
    signature: string,
    uuid: string,
    recipient: string
  ): Promise<boolean> {
    if (!isValidAmount(amount)) {
      throw new Error('Invalid amount');
    }

    if (!isValidSignature(signature)) {
      throw new Error('Invalid signature format');
    }

    if (!isValidUuid(uuid)) {
      throw new Error('Invalid UUID format');
    }

    if (!isValidStacksAddress(recipient)) {
      throw new Error('Invalid recipient address');
    }

    try {
      const args = [
        uintCV(amount),
        bufferCV(Buffer.from(opcode, 'hex')),
        bufferCV(Buffer.from(signature, 'hex')),
        stringUtf8CV(uuid),
        principalCV(recipient)
      ];

      const result = await callReadOnly(this.contractId, 'x-execute', args);
      return result?.value === true;
    } catch (error) {
      console.warn(`Failed to execute x-execute on ${this.contractId}:`, error);
      return false;
    }
  }

  // === Bridge Utilities ===

  /**
   * Get deposit quote
   */
  async getDepositQuote(amount: string): Promise<VaultResult> {
    return this.quote(amount, '05'); // DEPOSIT opcode
  }

  /**
   * Get withdraw quote
   */
  async getWithdrawQuote(amount: string): Promise<VaultResult> {
    return this.quote(amount, '06'); // WITHDRAW opcode
  }

  /**
   * Format vault result for display
   */
  formatQuote(quote: VaultResult): string {
    return `dx: ${quote.dx}, dy: ${quote.dy}, dk: ${quote.dk}`;
  }

  /**
   * Check if this is a bridge contract
   */
  get isBridge(): boolean {
    return true;
  }

  // === Factory Methods ===

  /**
   * Create Sublink instance from contract ID
   */
  static fromContractId(
    contractId: string,
    tokenA: SIP010,
    tokenB: SIP010
  ): Sublink {
    return new Sublink(contractId, tokenA, tokenB);
  }

  toString(): string {
    return `Sublink(${this.contractId})`;
  }
}