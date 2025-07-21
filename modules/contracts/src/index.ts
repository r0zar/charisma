// === Contract Classes ===
export { Token } from './contracts/Token';
export { Credit } from './contracts/Credit';
export { NFT } from './contracts/NFT';
export { Sublink } from './contracts/Sublink';
export { LiquidityPool } from './contracts/LiquidityPool';
export { Blaze } from './contracts/Blaze';

// === Multihop Module ===
export { Multihop, Router } from './contracts/multihop';
export type {
  VaultOperation,
  MultihopConfig,
  Route,
  RouteHop
} from './contracts/multihop';
export { OPCODES, defaultMultihopConfig } from './contracts/multihop';

// === Factory ===
export { ContractFactory } from './factory/ContractFactory';

// === Trait Interfaces ===
export type { Contract } from './traits/Contract';
export type { SIP010 } from './traits/SIP010';
export type { SIP009, NFTMetadata } from './traits/SIP009';
export type { Vault, VaultResult } from './traits/Vault';
export type { SIP069 } from './traits/SIP069';
export type { IntentVerifier, IntentData } from './traits/IntentVerifier';

// === Utilities ===
export * from './utils';

// === Types ===
export type { TransactionResult, ContractMetadata, TokenCacheData } from './types/shared';