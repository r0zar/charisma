/**
 * Intent Verifier Trait Interface
 * Maps to the blaze-v1 contract functions for intent verification
 */
import type { Contract } from './Contract';

export interface IntentVerifier extends Contract {
  
  // === Core Blaze Functions ===
  hash(
    contract: string,
    intent: string, 
    uuid: string,
    opcode?: string,
    amount?: string,
    target?: string
  ): Promise<string>;
  
  execute(
    signature: string,
    intent: string,
    uuid: string,
    opcode?: string,
    amount?: string,
    target?: string
  ): Promise<string>; // Returns signer principal
  
  recover(
    signature: string,
    contract: string,
    intent: string,
    uuid: string,
    opcode?: string,
    amount?: string,
    target?: string
  ): Promise<string>; // Returns signer principal
  
  check(uuid: string): Promise<boolean>;
}

/**
 * Intent data structure for Blaze operations
 */
export interface IntentData {
  contract: string;
  intent: string;
  opcode?: string;
  amount?: string;
  target?: string;
  uuid: string;
}