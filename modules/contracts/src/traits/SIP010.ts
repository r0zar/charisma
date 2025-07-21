/**
 * SIP-010 Fungible Token Standard Interface
 * Maps directly to the SIP-010 trait functions
 */
import type { Contract } from './Contract';

export interface SIP010 extends Contract {
  
  // === Core SIP-010 Functions ===
  getName(): Promise<string>;
  getSymbol(): Promise<string>;
  getDecimals(): Promise<number>;
  getBalance(owner: string): Promise<string>;
  getTotalSupply(): Promise<string>;
  getTokenUri(): Promise<string | null>;
  transfer(amount: string, from: string, to: string, memo?: string): Promise<boolean>;
}