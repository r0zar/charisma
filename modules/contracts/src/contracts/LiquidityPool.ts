import { callReadOnly } from '@repo/polyglot';
import { uintCV, someCV, noneCV, bufferCV } from '@stacks/transactions';
import type { Vault, VaultResult } from '../traits/Vault';
import { isValidAmount } from '../utils/validation';
import { SIP010 } from '../traits/SIP010';

/**
 * LiquidityPool class implementing Vault trait
 * Represents an AMM liquidity pool contract
 */
export class LiquidityPool implements Vault {
  constructor(
    public readonly contractId: string,
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

  getType(): 'liquidity-pool' {
    return 'liquidity-pool';
  }

  // === AMM-Specific Operations ===

  /**
   * Add liquidity to the pool
   */
  async addLiquidity(amountX: string, amountY: string): Promise<VaultResult> {
    if (!isValidAmount(amountX) || !isValidAmount(amountY)) {
      throw new Error('Invalid amounts');
    }

    try {
      const args = [uintCV(amountX), uintCV(amountY)];

      const result = await callReadOnly(this.contractId, 'add-liquidity', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from add-liquidity');
    } catch (error) {
      console.warn(`Failed to add liquidity to ${this.contractId}:`, error);
      throw error;
    }
  }

  /**
   * Remove liquidity from the pool
   */
  async removeLiquidity(lpTokens: string): Promise<VaultResult> {
    if (!isValidAmount(lpTokens)) {
      throw new Error('Invalid LP token amount');
    }

    try {
      const args = [uintCV(lpTokens)];

      const result = await callReadOnly(this.contractId, 'remove-liquidity', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from remove-liquidity');
    } catch (error) {
      console.warn(`Failed to remove liquidity from ${this.contractId}:`, error);
      throw error;
    }
  }

  /**
   * Swap exact tokens for tokens
   */
  async swapExactTokensForTokens(amountIn: string, minAmountOut: string): Promise<VaultResult> {
    if (!isValidAmount(amountIn) || !isValidAmount(minAmountOut)) {
      throw new Error('Invalid swap amounts');
    }

    try {
      const args = [uintCV(amountIn), uintCV(minAmountOut)];

      const result = await callReadOnly(this.contractId, 'swap-exact-tokens-for-tokens', args);

      if (result?.value) {
        return {
          dx: result.value.dx?.toString() || '0',
          dy: result.value.dy?.toString() || '0',
          dk: result.value.dk?.toString() || '0'
        };
      }

      throw new Error('Invalid response from swap');
    } catch (error) {
      console.warn(`Failed to swap on ${this.contractId}:`, error);
      throw error;
    }
  }

  // === AMM Utilities ===

  /**
   * Get pool reserves
   */
  async getReserves(): Promise<{ reserveX: string, reserveY: string }> {
    try {
      const result = await callReadOnly(this.contractId, 'get-reserves', []);

      if (result?.value) {
        return {
          reserveX: result.value.reserveX?.toString() || '0',
          reserveY: result.value.reserveY?.toString() || '0'
        };
      }

      throw new Error('Invalid response from get-reserves');
    } catch (error) {
      console.warn(`Failed to get reserves from ${this.contractId}:`, error);
      return { reserveX: '0', reserveY: '0' };
    }
  }

  /**
   * Get LP token total supply
   */
  async getLPTokenSupply(): Promise<string> {
    try {
      const result = await callReadOnly(this.contractId, 'get-total-supply', []);
      return result?.value?.toString() || '0';
    } catch (error) {
      console.warn(`Failed to get LP token supply from ${this.contractId}:`, error);
      return '0';
    }
  }

  /**
   * Calculate slippage for a trade
   */
  calculateSlippage(amountIn: string, expectedOut: string, actualOut: string): number {
    const expected = Number(expectedOut);
    const actual = Number(actualOut);

    if (expected === 0) return 0;

    return Math.abs((expected - actual) / expected) * 100;
  }

  /**
   * Check if this is an AMM pool
   */
  get isAMM(): boolean {
    return true;
  }

  // === Factory Methods ===

  /**
   * Create LiquidityPool instance from contract ID
   */
  static fromContractId(
    contractId: string,
    tokenA: SIP010,
    tokenB: SIP010
  ): LiquidityPool {
    return new LiquidityPool(contractId, tokenA, tokenB);
  }

  toString(): string {
    return `LiquidityPool(${this.contractId})`;
  }
}