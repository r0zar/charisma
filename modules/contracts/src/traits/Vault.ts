import { SIP010 } from "./SIP010";
import type { Contract } from './Contract';

/**
 * Vault Trait Interface
 * Shared by both Sublinks and LiquidityPools
 */
export interface Vault extends Contract {

  // === Core Vault Functions ===
  execute(amount: string, opcode?: string): Promise<VaultResult>;
  quote(amount: string, opcode?: string): Promise<VaultResult>;

  // === Type Information ===
  getType(): 'sublink' | 'liquidity-pool';

  // === Token Information ===
  tokenA: SIP010;
  tokenB: SIP010;
}

/**
 * Standard vault operation result
 */
export interface VaultResult {
  dx: string;
  dy: string;
  dk: string;
}