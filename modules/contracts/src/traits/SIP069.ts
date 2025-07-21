import type { SIP010 } from './SIP010';

/**
 * SIP-069 Credit Token Trait Interface  
 * Extends SIP-010 with subnet credit functions
 */
export interface SIP069 extends SIP010 {
  readonly baseTokenContract: string;
  
  // === Subnet-Specific Functions ===
  deposit(amount: string, recipient?: string): Promise<boolean>;
  withdraw(amount: string, recipient?: string): Promise<boolean>;
  
  // === Intent-Based Execution Functions ===
  xRedeem(signature: string, amount: string, uuid: string, to: string): Promise<boolean>;
  xTransfer(signature: string, amount: string, uuid: string, to: string): Promise<boolean>;
  xTransferLte(signature: string, bound: string, actual: string, uuid: string, to: string): Promise<boolean>;
}