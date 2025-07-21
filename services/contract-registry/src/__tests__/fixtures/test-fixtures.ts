/**
 * Test Fixtures for Contract Registry
 * Comprehensive sample data for testing all components
 */

import type { 
  ContractMetadata, 
  ContractType, 
  ValidationStatus,
  DiscoveryMethod,
  ContractAnalysis,
  DiscoveryResult,
  RegistryStats
} from '../../types';
import type { TraitDefinition, TraitValidationResult } from '../../analysis/TraitAnalyzer';
import type { ContractAbi, ContractInfo, ContractInfoWithParsedAbi } from '@repo/polyglot';
import type { BlobStorageStats } from '../../storage/BlobStorage';
import type { IndexStats } from '../../storage/IndexManager';

// Sample Contract IDs
export const SAMPLE_CONTRACT_IDS = {
  SIP010_TOKEN: 'SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.charisma-token',
  SIP009_NFT: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60.crashpunks-v2',
  VAULT_CONTRACT: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-vault',
  UNKNOWN_CONTRACT: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-dao',
  INVALID_CONTRACT: 'INVALID.CONTRACT'
} as const;

// Sample SIP010 Token Contract
export const SIP010_CONTRACT_INFO: ContractInfo = {
  tx_id: '0x1234567890abcdef1234567890abcdef12345678',
  canonical: true,
  contract_id: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
  block_height: 150000,
  clarity_version: 2,
  source_code: `
;; Charisma Token (CHA) - SIP010 Fungible Token
(define-fungible-token charisma)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender from) (is-eq contract-caller from)) err-not-token-owner)
    (ft-transfer? charisma amount from to)
  )
)

(define-read-only (get-name)
  (ok "Charisma")
)

(define-read-only (get-symbol)
  (ok "CHA")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance charisma who))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply charisma))
)

(define-public (mint (amount uint) (to principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? charisma amount to)
  )
)
`,
  abi: `{
    "functions": [
      {
        "name": "transfer",
        "access": "public",
        "args": [
          {"name": "amount", "type": "uint128"},
          {"name": "from", "type": "principal"},
          {"name": "to", "type": "principal"},
          {"name": "memo", "type": {"optional": {"buffer": {"length": 34}}}}
        ],
        "outputs": {"type": {"response": {"ok": "bool", "error": "uint128"}}}
      },
      {
        "name": "get-name",
        "access": "read_only",
        "args": [],
        "outputs": {"type": {"response": {"ok": {"string-ascii": {"length": 8}}, "error": "none"}}}
      },
      {
        "name": "get-symbol",
        "access": "read_only",
        "args": [],
        "outputs": {"type": {"response": {"ok": {"string-ascii": {"length": 3}}, "error": "none"}}}
      },
      {
        "name": "get-decimals",
        "access": "read_only",
        "args": [],
        "outputs": {"type": {"response": {"ok": "uint128", "error": "none"}}}
      },
      {
        "name": "get-balance",
        "access": "read_only",
        "args": [{"name": "who", "type": "principal"}],
        "outputs": {"type": {"response": {"ok": "uint128", "error": "none"}}}
      },
      {
        "name": "get-total-supply",
        "access": "read_only",
        "args": [],
        "outputs": {"type": {"response": {"ok": "uint128", "error": "none"}}}
      },
      {
        "name": "mint",
        "access": "public",
        "args": [
          {"name": "amount", "type": "uint128"},
          {"name": "to", "type": "principal"}
        ],
        "outputs": {"type": {"response": {"ok": "bool", "error": "uint128"}}}
      }
    ],
    "variables": [
      {"name": "contract-owner", "type": "principal", "access": "constant"}
    ],
    "maps": [],
    "fungible_tokens": [{"name": "charisma"}],
    "non_fungible_tokens": [],
    "clarity_version": "Clarity2",
    "epoch": "Epoch24"
  }`
};

export const SIP010_PARSED_ABI: ContractAbi = {
  functions: [
    {
      name: 'transfer',
      access: 'public',
      args: [
        { name: 'amount', type: 'uint128' },
        { name: 'from', type: 'principal' },
        { name: 'to', type: 'principal' },
        { name: 'memo', type: { optional: { buffer: { length: 34 } } } }
      ],
      outputs: { type: { response: { ok: 'bool', error: 'uint128' } } }
    },
    {
      name: 'get-name',
      access: 'read_only',
      args: [],
      outputs: { type: { response: { ok: { 'string-ascii': { length: 8 } }, error: 'none' } } }
    },
    {
      name: 'get-symbol',
      access: 'read_only',
      args: [],
      outputs: { type: { response: { ok: { 'string-ascii': { length: 3 } }, error: 'none' } } }
    },
    {
      name: 'get-decimals',
      access: 'read_only',
      args: [],
      outputs: { type: { response: { ok: 'uint128', error: 'none' } } }
    },
    {
      name: 'get-balance',
      access: 'read_only',
      args: [{ name: 'who', type: 'principal' }],
      outputs: { type: { response: { ok: 'uint128', error: 'none' } } }
    },
    {
      name: 'get-total-supply',
      access: 'read_only',
      args: [],
      outputs: { type: { response: { ok: 'uint128', error: 'none' } } }
    },
    {
      name: 'mint',
      access: 'public',
      args: [
        { name: 'amount', type: 'uint128' },
        { name: 'to', type: 'principal' }
      ],
      outputs: { type: { response: { ok: 'bool', error: 'uint128' } } }
    }
  ],
  variables: [
    { name: 'contract-owner', type: 'principal', access: 'constant' }
  ],
  maps: [],
  fungible_tokens: [{ name: 'charisma' }],
  non_fungible_tokens: [],
  clarity_version: 'Clarity2',
  epoch: 'Epoch24'
};

// Sample SIP010 Contract with parsed ABI
export const SIP010_CONTRACT_INFO_WITH_PARSED_ABI: ContractInfoWithParsedAbi = {
  ...SIP010_CONTRACT_INFO,
  parsed_abi: SIP010_PARSED_ABI
};

// Sample SIP009 NFT Contract
export const SIP009_CONTRACT_INFO: ContractInfo = {
  tx_id: '0xabcdef1234567890abcdef1234567890abcdef12',
  canonical: true,
  contract_id: SAMPLE_CONTRACT_IDS.SIP009_NFT,
  block_height: 140000,
  clarity_version: 1,
  source_code: `
;; CrashPunks V2 - SIP009 Non-Fungible Token
(define-non-fungible-token crashpunks uint)

(define-data-var last-token-id uint u0)

(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (id uint))
  (ok (some "https://crashpunks.com/metadata/{id}"))
)

(define-read-only (get-owner (id uint))
  (ok (nft-get-owner? crashpunks id))
)

(define-public (transfer (id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) (err u403))
    (nft-transfer? crashpunks id sender recipient)
  )
)
`,
  abi: `{
    "functions": [
      {
        "name": "get-last-token-id",
        "access": "read_only",
        "args": [],
        "outputs": {"type": {"response": {"ok": "uint128", "error": "none"}}}
      },
      {
        "name": "get-token-uri",
        "access": "read_only",
        "args": [{"name": "id", "type": "uint128"}],
        "outputs": {"type": {"response": {"ok": {"optional": {"string-ascii": {"length": 256}}}, "error": "none"}}}
      },
      {
        "name": "get-owner",
        "access": "read_only",
        "args": [{"name": "id", "type": "uint128"}],
        "outputs": {"type": {"response": {"ok": {"optional": "principal"}, "error": "none"}}}
      },
      {
        "name": "transfer",
        "access": "public",
        "args": [
          {"name": "id", "type": "uint128"},
          {"name": "sender", "type": "principal"},
          {"name": "recipient", "type": "principal"}
        ],
        "outputs": {"type": {"response": {"ok": "bool", "error": "uint128"}}}
      }
    ],
    "variables": [
      {"name": "last-token-id", "type": "uint128", "access": "variable"}
    ],
    "maps": [],
    "fungible_tokens": [],
    "non_fungible_tokens": [{"name": "crashpunks"}],
    "clarity_version": "Clarity1",
    "epoch": "Epoch21"
  }`
};

// Sample Contract Metadata
export const createSampleContractMetadata = (
  contractId: string, 
  type: ContractType = 'token',
  overrides: Partial<ContractMetadata> = {}
): ContractMetadata => ({
  contractId,
  contractAddress: contractId.split('.')[0],
  contractName: contractId.split('.')[1],
  blockHeight: 150000,
  txId: '0x1234567890abcdef1234567890abcdef12345678',
  deployedAt: Date.now() - 86400000, // 1 day ago
  contractType: type,
  implementedTraits: type === 'token' ? ['SIP010'] : type === 'nft' ? ['SIP009'] : [],
  sourceCode: type === 'token' ? SIP010_CONTRACT_INFO.source_code : SIP009_CONTRACT_INFO.source_code,
  abi: type === 'token' ? SIP010_CONTRACT_INFO.abi : SIP009_CONTRACT_INFO.abi,
  parsedAbi: type === 'token' ? SIP010_PARSED_ABI : undefined,
  clarityVersion: 2,
  sourceMetadata: {
    hasComments: true,
    hasConstants: true,
    hasDataVars: type === 'nft',
    hasMaps: false,
    complexity: 10,
    codeLines: 25,
    transferFunctionSize: type === 'token' ? 250 : 0,
    transferHasExternalCalls: false
  },
  discoveryMethod: 'manual',
  discoveredAt: Date.now() - 3600000, // 1 hour ago
  lastAnalyzed: Date.now() - 1800000, // 30 minutes ago
  lastUpdated: Date.now() - 900000, // 15 minutes ago
  validationStatus: 'valid',
  ...overrides
});

// Trait Definitions for Testing
export const SAMPLE_TRAIT_DEFINITIONS: TraitDefinition[] = [
  {
    name: 'SIP010',
    requiredFunctions: ['transfer', 'get-name', 'get-symbol', 'get-decimals', 'get-balance', 'get-total-supply'],
    optionalFunctions: ['transfer-memo', 'mint', 'burn'],
    description: 'Standard Fungible Token (SIP010)'
  },
  {
    name: 'SIP009',
    requiredFunctions: ['get-last-token-id', 'get-token-uri', 'get-owner', 'transfer'],
    optionalFunctions: ['mint', 'burn'],
    description: 'Standard Non-Fungible Token (SIP009)'
  },
  {
    name: 'Vault',
    requiredFunctions: ['deposit', 'withdraw'],
    optionalFunctions: ['get-balance', 'get-total-supply'],
    description: 'Generic Vault Interface'
  }
];

// Sample Trait Validation Results
export const createTraitValidationResult = (
  trait: string,
  implemented: boolean = true,
  confidence: number = 1.0
): TraitValidationResult => ({
  trait,
  implemented,
  confidence,
  validationMethod: 'abi-check',
  foundFunctions: implemented ? SAMPLE_TRAIT_DEFINITIONS.find(t => t.name === trait)?.requiredFunctions : [],
  missingFunctions: implemented ? undefined : SAMPLE_TRAIT_DEFINITIONS.find(t => t.name === trait)?.requiredFunctions
});

// Sample Contract Analysis
export const createContractAnalysis = (contractId: string, type: ContractType = 'token'): ContractAnalysis => ({
  contractId,
  implementedTraits: type === 'token' ? ['SIP010'] : type === 'nft' ? ['SIP009'] : [],
  contractType: type,
  sourceCode: type === 'token' ? SIP010_CONTRACT_INFO.source_code : SIP009_CONTRACT_INFO.source_code,
  abi: type === 'token' ? SIP010_CONTRACT_INFO.abi : SIP009_CONTRACT_INFO.abi,
  parsedAbi: type === 'token' ? SIP010_PARSED_ABI : undefined,
  clarityVersion: 2,
  sourceMetadata: {
    hasComments: true,
    hasConstants: true,
    hasDataVars: type === 'nft',
    hasMaps: false,
    complexity: 10,
    codeLines: 25,
    transferFunctionSize: type === 'token' ? 250 : 0,
    transferHasExternalCalls: false
  },
  deploymentInfo: {
    blockHeight: 150000,
    txId: '0x1234567890abcdef1234567890abcdef12345678'
  }
});

// Sample Discovery Results
export const createDiscoveryResult = (
  method: DiscoveryMethod = 'trait-search',
  success: boolean = true,
  contractsFound: number = 5
): DiscoveryResult => ({
  success,
  method,
  timestamp: Date.now(),
  duration: 2500,
  contractsFound,
  contractsProcessed: contractsFound,
  contractsAdded: success ? contractsFound : 0,
  contractsUpdated: 0,
  contractsSkipped: 0,
  contractsErrored: success ? 0 : contractsFound,
  newContracts: success ? Array.from({ length: contractsFound }, (_, i) => 
    `SP${i}123.contract-${i}`
  ) : [],
  errorContracts: success ? [] : [
    { contractId: 'SP123.failed-contract', error: 'Network timeout' }
  ],
  error: success ? undefined : 'Discovery failed'
});

// Sample Registry Stats
export const createRegistryStats = (): RegistryStats => ({
  totalContracts: 150,
  contractsByType: {
    token: 100,
    nft: 30,
    vault: 15,
    unknown: 5
  },
  contractsByStatus: {
    valid: 140,
    invalid: 5,
    blocked: 3,
    pending: 2
  },
  blockedContracts: 3,
  lastDiscovery: Date.now() - 3600000,
  lastAnalysis: Date.now() - 1800000,
  totalAnalysisTime: 45000,
  averageAnalysisTime: 300,
  cacheHitRate: 85.5
});

// Sample Storage Stats
export const createBlobStorageStats = (): BlobStorageStats => ({
  totalContracts: 150,
  totalSize: 1024 * 1024 * 50, // 50MB
  averageSize: 1024 * 350, // 350KB average
  largestContract: {
    contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
    size: 1024 * 1024 * 2 // 2MB
  },
  compressionRatio: 0.3,
  largeContractCount: 2, // Contracts over 512MB
  oversizedContracts: [], // No contracts over 1GB in test
  lastUpdated: Date.now()
});

export const createIndexStats = (): IndexStats => ({
  totalIndexes: 12,
  indexSizes: {
    'contracts:all': 150,
    'contracts:type:token': 100,
    'contracts:type:nft': 30,
    'contracts:trait:SIP010': 100,
    'contracts:trait:SIP009': 30,
    'contracts:status:valid': 140,
    'contracts:blocked': 3
  },
  lastUpdated: {
    'contracts:all': Date.now() - 300000,
    'contracts:type:token': Date.now() - 600000
  },
  hitRate: 92.5,
  totalQueries: 1000,
  cacheHits: 925
});

// Sample Token Data (for @repo/tokens integration)
export const SAMPLE_TOKENS = [
  {
    contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
    name: 'Charisma',
    symbol: 'CHA',
    decimals: 6,
    totalSupply: '1000000000000000',
    verified: true
  },
  {
    contractId: 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx',
    name: 'Wrapped STX',
    symbol: 'wSTX',
    decimals: 6,
    totalSupply: '500000000000000',
    verified: true
  }
];

// Error Scenarios for Testing
export const ERROR_SCENARIOS = {
  NETWORK_ERROR: new Error('Network request failed'),
  TIMEOUT_ERROR: new Error('Request timeout after 30000ms'),
  INVALID_CONTRACT: new Error('Contract SP123.invalid not found'),
  BLOB_SIZE_ERROR: new Error('Blob exceeds 512MB limit'),
  KV_ERROR: new Error('KV operation failed'),
  ANALYSIS_ERROR: new Error('Contract analysis failed: Invalid ABI'),
  DISCOVERY_ERROR: new Error('Discovery failed: API rate limit exceeded')
};

// Mock Factory Functions
export const mockFactory = {
  /**
   * Create multiple sample contracts
   */
  createContracts: (count: number, type: ContractType = 'token'): ContractMetadata[] => {
    return Array.from({ length: count }, (_, i) => 
      createSampleContractMetadata(`SP${i}123.contract-${i}`, type)
    );
  },

  /**
   * Create large dataset for performance testing
   */
  createLargeDataset: (size: number = 1000): ContractMetadata[] => {
    const types: ContractType[] = ['token', 'nft', 'vault', 'unknown'];
    return Array.from({ length: size }, (_, i) => {
      const type = types[i % types.length];
      return createSampleContractMetadata(`SP${i}123.contract-${i}`, type);
    });
  },

  /**
   * Create invalid data for error testing
   */
  createInvalidData: () => ({
    invalidContractMetadata: {
      contractId: '', // Invalid empty ID
      contractAddress: 'INVALID',
      contractName: '',
      blockHeight: -1, // Invalid negative height
      txId: 'invalid-tx-id',
      deployedAt: NaN, // Invalid timestamp
      contractType: 'invalid-type' as ContractType,
      implementedTraits: null as any,
      sourceCode: null as any,
      abi: 'invalid-json',
      discoveryMethod: 'invalid-method' as DiscoveryMethod,
      discoveredAt: 'invalid-date' as any,
      lastAnalyzed: undefined as any,
      lastUpdated: -1,
      validationStatus: 'invalid-status' as ValidationStatus
    },
    malformedAbi: '{"functions": [invalid json}',
    emptySourceCode: '',
    nullData: null,
    undefinedData: undefined
  })
};

// Performance Test Data
export const PERFORMANCE_TEST_CONFIG = {
  SMALL_DATASET: 10,
  MEDIUM_DATASET: 100,
  LARGE_DATASET: 1000,
  STRESS_DATASET: 5000,
  TIMEOUT_THRESHOLD: 5000, // 5 seconds
  MEMORY_THRESHOLD: 100 * 1024 * 1024 // 100MB
};

// Test Utilities
export const testUtils = {
  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random contract ID
   */
  randomContractId: () => `SP${Math.random().toString(36).substr(2, 9).toUpperCase()}.test-contract-${Date.now()}`,

  /**
   * Deep clone object for test isolation
   */
  deepClone: <T>(obj: T): T => JSON.parse(JSON.stringify(obj)),

  /**
   * Create timestamp in the past
   */
  pastTimestamp: (hoursAgo: number = 1) => Date.now() - (hoursAgo * 60 * 60 * 1000),

  /**
   * Create timestamp in the future
   */
  futureTimestamp: (hoursFromNow: number = 1) => Date.now() + (hoursFromNow * 60 * 60 * 1000)
};