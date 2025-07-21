/**
 * Contract constants and addresses
 */

// Default Blaze contract
export const BLAZE_CONTRACT = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1';

// Common subnet token opcodes
export const SUBNET_OPCODES = {
  DEPOSIT: 0x05,
  WITHDRAW: 0x06,
} as const;

// Common intent types
export const INTENT_TYPES = {
  TRANSFER_TOKENS: 'TRANSFER_TOKENS',
  TRANSFER_TOKENS_LTE: 'TRANSFER_TOKENS_LTE', 
  REDEEM_BEARER: 'REDEEM_BEARER',
  EXECUTE_SWAP: 'EXECUTE_SWAP',
} as const;

// Default token decimals
export const DEFAULT_DECIMALS = 6;