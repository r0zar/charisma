/**
 * Core contract metadata and type definitions
 */

import type { ContractAbi } from '@repo/polyglot';
import type { TokenCacheData } from '@repo/tokens';

// Core contract types
export type ContractType = 'token' | 'nft' | 'vault' | 'unknown';

export type DiscoveryMethod = 'trait-search' | 'sip-scan' | 'api-scan' | 'manual';

export type ValidationStatus = 'valid' | 'invalid' | 'blocked' | 'pending';

// Blocked contract information
export interface BlockedContractInfo {
  reason: string;
  blockedAt: number;
  blockedBy: string;
}

// Source code metadata extracted during analysis
export interface SourceMetadata {
  hasComments: boolean;
  hasConstants: boolean;
  hasDataVars: boolean;
  hasMaps: boolean;
  complexity: number;
  codeLines: number;
  transferFunctionSize: number; // Character count of transfer function (excluding whitespace/newlines)
  transferHasExternalCalls: boolean; // Whether transfer function includes contract-call?
}

// Contract metadata - comprehensive information about a contract
export interface ContractMetadata {
  // Basic identification
  contractId: string;
  contractAddress: string;
  contractName: string;
  blockHeight: number;
  txId: string;
  deployedAt: number;

  // Classification results
  contractType: ContractType;
  implementedTraits: string[]; // ['SIP010', 'Vault', 'SIP069', etc.]

  // Source code & ABI
  sourceCode: string;
  abi: string;
  parsedAbi?: ContractAbi;
  clarityVersion?: number;
  sourceMetadata?: SourceMetadata;

  // Token-specific data (if applicable)
  tokenMetadata?: TokenCacheData;

  // Discovery & analysis metadata
  discoveryMethod: DiscoveryMethod;
  discoveredAt: number;
  lastAnalyzed: number;
  lastUpdated: number;

  // Status & validation
  validationStatus: ValidationStatus;
  blocked?: BlockedContractInfo;
}

// Contract analysis result
export interface ContractAnalysis {
  contractId: string;
  implementedTraits: string[];
  contractType: ContractType;
  sourceCode: string;
  abi: string;
  parsedAbi?: ContractAbi;
  clarityVersion?: number;
  sourceMetadata?: SourceMetadata;
  tokenMetadata?: TokenCacheData;
  deploymentInfo: {
    blockHeight: number;
    txId: string;
  };
}

// Contract query interface
export interface ContractQuery {
  contractType?: ContractType;
  implementedTraits?: string[];
  validationStatus?: ValidationStatus;
  discoveryMethod?: DiscoveryMethod;
  discoveredAfter?: number;
  discoveredBefore?: number;
  limit?: number;
  offset?: number;
}

// Contract update request
export interface ContractUpdateRequest {
  contractType?: ContractType;
  implementedTraits?: string[];
  validationStatus?: ValidationStatus;
  tokenMetadata?: Partial<TokenCacheData>;
  blocked?: BlockedContractInfo;
}

// Helper type for trait implementation validation
export interface TraitImplementation {
  trait: string;
  validated: boolean;
  validationMethod: 'abi-check' | 'source-check' | 'runtime-check';
  validatedAt: number;
}

// Contract list response
export interface ContractListResponse {
  contracts: string[];
  total: number;
  offset: number;
  limit: number;
}

// Contract search response
export interface ContractSearchResponse {
  contracts: ContractMetadata[];
  total: number;
  offset: number;
  limit: number;
  queryTime: number;
}