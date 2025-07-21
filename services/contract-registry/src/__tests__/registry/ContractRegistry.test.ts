/**
 * ContractRegistry Tests
 * Core functionality tests for the main orchestrator that coordinates all components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractRegistry } from '../../registry/ContractRegistry';
import {
  createSampleContractMetadata,
  createContractAnalysis,
  SAMPLE_CONTRACT_IDS,
  ERROR_SCENARIOS,
  mockFactory
} from '../fixtures/test-fixtures';
import type { ContractMetadata, ContractQuery } from '../../types';

// Create properly typed mock objects
const createMockBlobStorage = () => ({
  getContract: vi.fn(),
  getContracts: vi.fn(),
  putContract: vi.fn(),
  hasContract: vi.fn(),
  removeContract: vi.fn(),
  listContracts: vi.fn(),
  putContracts: vi.fn(),
  getStats: vi.fn(),
  getMonitoringStats: vi.fn(),
  getRecentOperations: vi.fn(),
  getAlerts: vi.fn()
});

const createMockIndexManager = () => ({
  addToIndexes: vi.fn(),
  removeFromIndexes: vi.fn(),
  updateIndexes: vi.fn(),
  getAllContracts: vi.fn(),
  getContractsByType: vi.fn(),
  getContractsByTrait: vi.fn(),
  getContractsByTraits: vi.fn(),
  getContractsByStatus: vi.fn(),
  getContractsByDiscovery: vi.fn(),
  getBlockedContracts: vi.fn(),
  hasContract: vi.fn(),
  blockContract: vi.fn(),
  unblockContract: vi.fn(),
  isBlocked: vi.fn(),
  rebuildIndexes: vi.fn(),
  clearAllIndexes: vi.fn(),
  getStats: vi.fn(),
  resetStats: vi.fn(),
  updateDiscoveryTimestamp: vi.fn(),
  updateAnalysisTimestamp: vi.fn(),
  getDiscoveryTimestamp: vi.fn(),
  getAnalysisTimestamp: vi.fn(),
  getTimestamp: vi.fn(),
  setTimestamp: vi.fn()
});

const createMockTraitAnalyzer = () => ({
  analyzeContract: vi.fn(),
  analyzeTraits: vi.fn(),
  getTraitDefinitions: vi.fn(),
  getTraitDefinition: vi.fn(),
  addTraitDefinition: vi.fn()
});

const createMockDiscoveryEngine = () => ({
  discoverByTrait: vi.fn(),
  discoverBySipStandard: vi.fn(),
  discoverByApiScan: vi.fn(),
  updateConfig: vi.fn(),
  getConfig: vi.fn(),
  addToBlacklist: vi.fn(),
  removeFromBlacklist: vi.fn(),
  getBlacklist: vi.fn()
});

// Mock external dependencies
vi.mock('../../storage/BlobStorage', () => ({
  BlobStorage: vi.fn()
}));

vi.mock('../../storage/IndexManager', () => ({
  IndexManager: vi.fn()
}));

vi.mock('../../analysis/TraitAnalyzer', () => ({
  TraitAnalyzer: vi.fn()
}));

vi.mock('../../discovery/TraitDiscoveryEngine', () => ({
  TraitDiscoveryEngine: vi.fn()
}));

vi.mock('@repo/tokens', () => ({
  listTokens: vi.fn()
}));

describe('ContractRegistry', () => {
  let contractRegistry: ContractRegistry;
  let sampleMetadata: ContractMetadata;
  let sampleAnalysis: any;

  // Mock instances
  let mockBlobStorage: ReturnType<typeof createMockBlobStorage>;
  let mockIndexManager: ReturnType<typeof createMockIndexManager>;
  let mockTraitAnalyzer: ReturnType<typeof createMockTraitAnalyzer>;
  let mockDiscoveryEngine: ReturnType<typeof createMockDiscoveryEngine>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh mock instances
    mockBlobStorage = createMockBlobStorage();
    mockIndexManager = createMockIndexManager();
    mockTraitAnalyzer = createMockTraitAnalyzer();
    mockDiscoveryEngine = createMockDiscoveryEngine();

    // Setup constructor mocks
    const { BlobStorage } = await import('../../storage/BlobStorage');
    const { IndexManager } = await import('../../storage/IndexManager');
    const { TraitAnalyzer } = await import('../../analysis/TraitAnalyzer');
    const { TraitDiscoveryEngine } = await import('../../discovery/TraitDiscoveryEngine');

    vi.mocked(BlobStorage).mockImplementation(() => mockBlobStorage as any);
    vi.mocked(IndexManager).mockImplementation(() => mockIndexManager as any);
    vi.mocked(TraitAnalyzer).mockImplementation(() => mockTraitAnalyzer as any);
    vi.mocked(TraitDiscoveryEngine).mockImplementation(() => mockDiscoveryEngine as any);

    // Set up @repo/tokens mock
    const { listTokens } = await import('@repo/tokens');
    vi.mocked(listTokens).mockResolvedValue([
      {
        contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        name: 'Charisma Token',
        type: 'SIP010',
        symbol: 'CHA',
        identifier: 'charisma-token'
      },
      {
        contractId: SAMPLE_CONTRACT_IDS.SIP009_NFT,
        name: 'Test NFT',
        type: 'SIP009',
        symbol: 'TNFT',
        identifier: 'test-nft'
      }
    ]);

    // Setup default successful mock responses
    setupDefaultMockResponses();

    // Create registry instance
    contractRegistry = new ContractRegistry({
      serviceName: 'test-registry',
      enableAnalysis: true,
      enableDiscovery: true,
      blobStoragePrefix: 'test-contracts/',
      analysisTimeout: 5000,
      blobStorage: {
        serviceName: 'test-registry',
        pathPrefix: 'test-contracts/'
      },
      indexManager: {
        serviceName: 'test-registry',
        keyPrefix: 'test:'
      },
      traitAnalyzer: {
        timeout: 5000,
        enableSourceAnalysis: true
      },
      discoveryEngine: {
        timeout: 5000,
        debug: false
      }
    });

    sampleMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    sampleAnalysis = createContractAnalysis(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
  });

  function setupDefaultMockResponses() {
    // BlobStorage defaults
    mockBlobStorage.getContract.mockResolvedValue(null);
    mockBlobStorage.putContract.mockResolvedValue(undefined);
    mockBlobStorage.hasContract.mockResolvedValue(false);
    mockBlobStorage.removeContract.mockResolvedValue(undefined);
    mockBlobStorage.listContracts.mockResolvedValue([]);
    mockBlobStorage.putContracts.mockResolvedValue({ successful: [], failed: [] });
    mockBlobStorage.getStats.mockResolvedValue({
      totalContracts: 100,
      totalSize: 1024000,
      averageSize: 10240,
      largestContract: null,
      compressionRatio: 0.3,
      lastUpdated: Date.now()
    });
    mockBlobStorage.getMonitoringStats.mockResolvedValue({});
    mockBlobStorage.getRecentOperations.mockResolvedValue([]);
    mockBlobStorage.getAlerts.mockResolvedValue([]);

    // IndexManager defaults
    mockIndexManager.addToIndexes.mockResolvedValue(undefined);
    mockIndexManager.removeFromIndexes.mockResolvedValue(undefined);
    mockIndexManager.updateIndexes.mockResolvedValue(undefined);
    mockIndexManager.getAllContracts.mockResolvedValue([]);
    mockIndexManager.getContractsByType.mockResolvedValue([]);
    mockIndexManager.getContractsByTrait.mockResolvedValue([]);
    mockIndexManager.getContractsByTraits.mockResolvedValue([]);
    mockIndexManager.getContractsByStatus.mockResolvedValue([]);
    mockIndexManager.getContractsByDiscovery.mockResolvedValue([]);
    mockIndexManager.getBlockedContracts.mockResolvedValue([]);
    mockIndexManager.hasContract.mockResolvedValue(false);
    mockIndexManager.blockContract.mockResolvedValue(undefined);
    mockIndexManager.unblockContract.mockResolvedValue(undefined);
    mockIndexManager.isBlocked.mockResolvedValue(false);
    mockIndexManager.rebuildIndexes.mockResolvedValue(undefined);
    mockIndexManager.clearAllIndexes.mockResolvedValue(undefined);
    mockIndexManager.resetStats.mockResolvedValue(undefined);
    mockIndexManager.updateDiscoveryTimestamp.mockResolvedValue(undefined);
    mockIndexManager.updateAnalysisTimestamp.mockResolvedValue(undefined);
    mockIndexManager.getDiscoveryTimestamp.mockResolvedValue(0);
    mockIndexManager.getAnalysisTimestamp.mockResolvedValue(0);
    mockIndexManager.getTimestamp.mockResolvedValue(0);
    mockIndexManager.setTimestamp.mockResolvedValue(undefined);
    mockIndexManager.getStats.mockResolvedValue({
      totalIndexes: 10,
      indexSizes: {},
      lastUpdated: {},
      hitRate: 95,
      totalQueries: 1000,
      cacheHits: 950
    });

    // TraitAnalyzer defaults
    mockTraitAnalyzer.analyzeContract.mockResolvedValue(
      createContractAnalysis(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
    );
    mockTraitAnalyzer.analyzeTraits.mockResolvedValue([]);
    mockTraitAnalyzer.getTraitDefinitions.mockResolvedValue([]);
    mockTraitAnalyzer.getTraitDefinition.mockResolvedValue(null);
    mockTraitAnalyzer.addTraitDefinition.mockResolvedValue(undefined);

    // DiscoveryEngine defaults
    mockDiscoveryEngine.discoverByTrait.mockResolvedValue({
      success: true,
      method: 'trait-search',
      timestamp: Date.now(),
      duration: 100,
      contractsFound: 1,
      contractsProcessed: 1,
      contractsAdded: 1,
      contractsUpdated: 0,
      contractsSkipped: 0,
      contractsErrored: 0,
      newContracts: [SAMPLE_CONTRACT_IDS.SIP010_TOKEN],
      errorContracts: []
    });

    mockDiscoveryEngine.discoverBySipStandard.mockResolvedValue({
      success: true,
      method: 'sip-scan',
      timestamp: Date.now(),
      duration: 100,
      contractsFound: 1,
      contractsProcessed: 1,
      contractsAdded: 1,
      contractsUpdated: 0,
      contractsSkipped: 0,
      contractsErrored: 0,
      newContracts: [SAMPLE_CONTRACT_IDS.SIP009_NFT],
      errorContracts: []
    });

    mockDiscoveryEngine.discoverByApiScan.mockResolvedValue({
      success: true,
      method: 'api-scan',
      timestamp: Date.now(),
      duration: 100,
      contractsFound: 0,
      contractsProcessed: 0,
      contractsAdded: 0,
      contractsUpdated: 0,
      contractsSkipped: 0,
      contractsErrored: 0,
      newContracts: [],
      errorContracts: []
    });

    mockDiscoveryEngine.updateConfig.mockResolvedValue(undefined);
    mockDiscoveryEngine.getConfig.mockResolvedValue({});
    mockDiscoveryEngine.addToBlacklist.mockResolvedValue(undefined);
    mockDiscoveryEngine.removeFromBlacklist.mockResolvedValue(undefined);
    mockDiscoveryEngine.getBlacklist.mockResolvedValue([]);
  }

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const registry = new ContractRegistry({
        serviceName: 'test-service',
        enableAnalysis: true,
        enableDiscovery: true,
        blobStoragePrefix: 'contracts/',
        analysisTimeout: 30 * 1000,
        blobStorage: {},
        indexManager: {},
        traitAnalyzer: {},
        discoveryEngine: {}
      });
      expect(registry).toBeInstanceOf(ContractRegistry);
    });

    it('should initialize with custom configuration', () => {
      const registry = new ContractRegistry({
        serviceName: 'custom-registry',
        enableAnalysis: false,
        enableDiscovery: false,
        blobStoragePrefix: 'custom-contracts/',
        analysisTimeout: 60000,
        blobStorage: { enforcementLevel: 'block' },
        indexManager: { keyPrefix: 'custom:' },
        traitAnalyzer: { enableSourceAnalysis: false },
        discoveryEngine: { debug: true }
      });
      expect(registry).toBeInstanceOf(ContractRegistry);
    });
  });

  describe('getContract', () => {
    it('should retrieve contract metadata successfully', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(sampleMetadata);

      const result = await contractRegistry.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result).toEqual(sampleMetadata);
      expect(mockBlobStorage.getContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
    });

    it('should return null for non-existent contract', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(null);

      const result = await contractRegistry.getContract('SP123.non-existent');

      expect(result).toBeNull();
    });

    it('should handle storage errors gracefully', async () => {
      mockBlobStorage.getContract.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await contractRegistry.getContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result).toBeNull();
    });
  });

  describe('addContract', () => {
    it('should add new contract with full analysis', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(false);
      mockTraitAnalyzer.analyzeContract.mockResolvedValueOnce(sampleAnalysis);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(true);
      expect(result.contractId).toBe(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(result.wasExisting).toBe(false);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.implementedTraits).toContain('SIP010');

      expect(mockTraitAnalyzer.analyzeContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(mockBlobStorage.putContract).toHaveBeenCalledWith(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        expect.objectContaining({
          contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
          contractType: 'token',
          implementedTraits: ['SIP010']
        })
      );
      expect(mockIndexManager.addToIndexes).toHaveBeenCalled();
    });

    it('should return existing contract without re-analyzing', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(true);
      mockBlobStorage.getContract.mockResolvedValueOnce(sampleMetadata);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(true);
      expect(result.wasExisting).toBe(true);
      expect(result.metadata).toEqual(sampleMetadata);

      expect(mockTraitAnalyzer.analyzeContract).not.toHaveBeenCalled();
      expect(mockBlobStorage.putContract).not.toHaveBeenCalled();
    });

    it('should re-analyze existing contract that lacks full analysis', async () => {
      // Create metadata that needs analysis (missing sourceCode, abi, or lastAnalyzed)
      const incompleteMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'token', {
        sourceCode: '', // Missing source code
        abi: '', // Missing ABI
        lastAnalyzed: 0 // Never analyzed
      });

      mockBlobStorage.hasContract.mockResolvedValueOnce(true);
      mockBlobStorage.getContract.mockResolvedValueOnce(incompleteMetadata);
      mockTraitAnalyzer.analyzeContract.mockResolvedValueOnce(sampleAnalysis);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(true);
      expect(result.wasExisting).toBe(true);
      expect(result.wasAnalyzed).toBe(true);
      expect(result.metadata?.sourceCode).toBe(sampleAnalysis.sourceCode);
      expect(result.metadata?.abi).toBe(sampleAnalysis.abi);
      expect(result.metadata?.lastAnalyzed).toBeGreaterThan(0);

      // Should have called analysis and updated the contract
      expect(mockTraitAnalyzer.analyzeContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(mockBlobStorage.putContract).toHaveBeenCalled();
      expect(mockIndexManager.addToIndexes).toHaveBeenCalled();
      expect(mockIndexManager.updateAnalysisTimestamp).toHaveBeenCalled();
    });

    it('should add contract with minimal metadata when analysis is disabled', async () => {
      const registryNoAnalysis = new ContractRegistry({
        serviceName: 'test-registry',
        enableAnalysis: false,
        enableDiscovery: true,
        blobStoragePrefix: 'contracts/',
        analysisTimeout: 30 * 1000,
        blobStorage: {},
        indexManager: {},
        traitAnalyzer: {},
        discoveryEngine: {}
      });

      mockBlobStorage.hasContract.mockResolvedValueOnce(false);

      const result = await registryNoAnalysis.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(true);
      expect(result.metadata?.contractType).toBe('unknown');
      expect(result.metadata?.implementedTraits).toEqual([]);
      expect(result.metadata?.validationStatus).toBe('pending');

      expect(mockTraitAnalyzer.analyzeContract).not.toHaveBeenCalled();
    });

    it('should handle analysis errors', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(false);
      mockTraitAnalyzer.analyzeContract.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network request failed');
    });

    it('should handle storage errors', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(false);
      mockBlobStorage.putContract.mockRejectedValueOnce(ERROR_SCENARIOS.BLOB_SIZE_ERROR);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Blob exceeds 512MB limit');
    });
  });

  describe('updateContract', () => {
    it('should update existing contract successfully', async () => {
      const existingMetadata = createSampleContractMetadata(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      const updates = { validationStatus: 'valid' as const, customField: 'test' };

      mockBlobStorage.getContract.mockResolvedValueOnce(existingMetadata);

      const result = await contractRegistry.updateContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, updates);

      expect(result.success).toBe(true);
      expect(result.contractId).toBe(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(result.updatedFields).toEqual(['validationStatus', 'customField']);
      expect(result.previousMetadata).toEqual(existingMetadata);
      expect(result.newMetadata).toEqual(expect.objectContaining(updates));

      expect(mockBlobStorage.putContract).toHaveBeenCalledWith(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        expect.objectContaining({
          ...existingMetadata,
          ...updates,
          lastUpdated: expect.any(Number)
        })
      );
      expect(mockIndexManager.updateIndexes).toHaveBeenCalled();
    });

    it('should return error for non-existent contract', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(null);

      const result = await contractRegistry.updateContract('SP123.non-existent', { validationStatus: 'valid' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle update errors', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(sampleMetadata);
      mockBlobStorage.putContract.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await contractRegistry.updateContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, { validationStatus: 'valid' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network request failed');
    });
  });

  describe('removeContract', () => {
    it('should remove existing contract successfully', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(sampleMetadata);

      const result = await contractRegistry.removeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(true);
      expect(result.contractId).toBe(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(result.wasRemoved).toBe(true);

      expect(mockBlobStorage.removeContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(mockIndexManager.removeFromIndexes).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, sampleMetadata);
    });

    it('should handle removal of non-existent contract', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(null);

      const result = await contractRegistry.removeContract('SP123.non-existent');

      expect(result.success).toBe(true);
      expect(result.wasRemoved).toBe(false);
    });

    it('should handle removal errors', async () => {
      mockBlobStorage.getContract.mockResolvedValueOnce(sampleMetadata);
      mockBlobStorage.removeContract.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

      const result = await contractRegistry.removeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network request failed');
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      // Setup mock for bulk getContracts method used by searchContracts
      mockBlobStorage.getContracts.mockImplementation((contractIds: string[]) => {
        const successful = contractIds.map(contractId => {
          if (contractId === SAMPLE_CONTRACT_IDS.SIP010_TOKEN) {
            return { contractId, metadata: createSampleContractMetadata(contractId, 'token') };
          }
          if (contractId === SAMPLE_CONTRACT_IDS.SIP009_NFT) {
            return { contractId, metadata: createSampleContractMetadata(contractId, 'nft') };
          }
          return null;
        }).filter(Boolean) as { contractId: string; metadata: any }[];

        return Promise.resolve({
          successful,
          failed: []
        });
      });
    });

    describe('getAllContracts', () => {
      it('should return all contract IDs', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN, SAMPLE_CONTRACT_IDS.SIP009_NFT];
        mockIndexManager.getAllContracts.mockResolvedValueOnce(expectedContracts);

        const result = await contractRegistry.getAllContracts();

        expect(result).toEqual(expectedContracts);
        expect(mockIndexManager.getAllContracts).toHaveBeenCalled();
      });
    });

    describe('getContractsByType', () => {
      it('should return contracts of specified type', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        mockIndexManager.getContractsByType.mockResolvedValueOnce(expectedContracts);

        const result = await contractRegistry.getContractsByType('token');

        expect(result).toEqual(expectedContracts);
        expect(mockIndexManager.getContractsByType).toHaveBeenCalledWith('token');
      });
    });

    describe('getContractsByTrait', () => {
      it('should return contracts implementing specified trait', async () => {
        const expectedContracts = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        mockIndexManager.getContractsByTrait.mockResolvedValueOnce(expectedContracts);

        const result = await contractRegistry.getContractsByTrait('SIP010');

        expect(result).toEqual(expectedContracts);
        expect(mockIndexManager.getContractsByTrait).toHaveBeenCalledWith('SIP010');
      });
    });

    describe('searchContracts', () => {
      it('should search contracts by type', async () => {
        const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        mockIndexManager.getContractsByType.mockResolvedValueOnce(contractIds);

        const query: ContractQuery = { contractType: 'token' };
        const result = await contractRegistry.searchContracts(query);

        expect(result.contracts).toHaveLength(1);
        expect(result.contracts[0].contractType).toBe('token');
        expect(result.total).toBe(1);
        expect(result.offset).toBe(0);
        expect(result.limit).toBe(50);
        expect(mockIndexManager.getContractsByType).toHaveBeenCalledWith('token');
      });

      it('should search contracts by traits', async () => {
        const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        mockIndexManager.getContractsByTraits.mockResolvedValueOnce(contractIds);

        const query: ContractQuery = { implementedTraits: ['SIP010'] };
        const result = await contractRegistry.searchContracts(query);

        expect(result.contracts).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(mockIndexManager.getContractsByTraits).toHaveBeenCalledWith(['SIP010']);
      });

      it('should search contracts by validation status', async () => {
        const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        mockIndexManager.getContractsByStatus.mockResolvedValueOnce(contractIds);

        const query: ContractQuery = { validationStatus: 'valid' };
        const result = await contractRegistry.searchContracts(query);

        expect(result.contracts).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(mockIndexManager.getContractsByStatus).toHaveBeenCalledWith('valid');
      });

      it('should search contracts by discovery method', async () => {
        const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN];
        mockIndexManager.getContractsByDiscovery.mockResolvedValueOnce(contractIds);

        const query: ContractQuery = { discoveryMethod: 'trait-search' };
        const result = await contractRegistry.searchContracts(query);

        expect(result.contracts).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(mockIndexManager.getContractsByDiscovery).toHaveBeenCalledWith('trait-search');
      });

      it('should return all contracts when no specific criteria provided', async () => {
        const contractIds = [SAMPLE_CONTRACT_IDS.SIP010_TOKEN, SAMPLE_CONTRACT_IDS.SIP009_NFT];
        mockIndexManager.getAllContracts.mockResolvedValueOnce(contractIds);

        const query: ContractQuery = {};
        const result = await contractRegistry.searchContracts(query);

        expect(result.contracts).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(mockIndexManager.getAllContracts).toHaveBeenCalled();
      });

      it('should apply pagination correctly', async () => {
        const contractIds = Array.from({ length: 100 }, (_, i) => `SP${i}.contract`);
        mockIndexManager.getAllContracts.mockResolvedValueOnce(contractIds);

        const query: ContractQuery = { offset: 10, limit: 20 };
        const result = await contractRegistry.searchContracts(query);

        expect(result.total).toBe(100);
        expect(result.offset).toBe(10);
        expect(result.limit).toBe(20);
        expect(result.contracts).toHaveLength(0); // No metadata found for these contracts
      });

      it('should handle search errors gracefully', async () => {
        mockIndexManager.getAllContracts.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

        const query: ContractQuery = {};
        const result = await contractRegistry.searchContracts(query);

        expect(result.contracts).toEqual([]);
        expect(result.total).toBe(0);
      });
    });
  });

  describe('Discovery Operations', () => {
    describe('discoverNewContracts', () => {
      it('should return disabled message when discovery is disabled', async () => {
        const registryNoDiscovery = new ContractRegistry({
          serviceName: 'test-registry',
          enableAnalysis: true,
          enableDiscovery: false,
          blobStoragePrefix: 'contracts/',
          analysisTimeout: 30 * 1000,
          blobStorage: {},
          indexManager: {},
          traitAnalyzer: {},
          discoveryEngine: {}
        });

        const result = await registryNoDiscovery.discoverNewContracts();

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Discovery is disabled');
      });

      it('should perform discovery when enabled', async () => {
        const result = await contractRegistry.discoverNewContracts();

        expect(result.success).toBe(true);
        expect(result.totalContractsFound).toBeGreaterThanOrEqual(0);
        expect(result.results).toBeInstanceOf(Array);
        expect(result.errors).toBeInstanceOf(Array);
      });
    });

    describe('analyzeContract', () => {
      it('should analyze contract successfully', async () => {
        mockTraitAnalyzer.analyzeContract.mockResolvedValueOnce(sampleAnalysis);

        const result = await contractRegistry.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result.success).toBe(true);
        expect(result.analysis).toEqual(sampleAnalysis);
        expect(mockTraitAnalyzer.analyzeContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      });

      it('should return disabled message when analysis is disabled', async () => {
        const registryNoAnalysis = new ContractRegistry({
          serviceName: 'test-registry',
          enableAnalysis: false,
          enableDiscovery: true,
          blobStoragePrefix: 'contracts/',
          analysisTimeout: 30 * 1000,
          blobStorage: {},
          indexManager: {},
          traitAnalyzer: {},
          discoveryEngine: {}
        });

        const result = await registryNoAnalysis.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Analysis is disabled');
      });

      it('should handle analysis errors', async () => {
        mockTraitAnalyzer.analyzeContract.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

        const result = await contractRegistry.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Network request failed');
      });
    });

    describe('syncWithTokenCache', () => {
      it('should sync with token cache successfully', async () => {
        // Mock hasContract to return false for new contracts
        mockBlobStorage.hasContract.mockResolvedValue(false);
        mockTraitAnalyzer.analyzeContract.mockResolvedValue(sampleAnalysis);

        const result = await contractRegistry.syncWithTokenCache();

        expect(result.success).toBe(true);
        expect(result.source).toBe('@repo/tokens');
        expect(result.totalProcessed).toBe(2);
        expect(result.added).toBe(2);
        expect(result.updated).toBe(0);
        expect(result.newContracts).toEqual([SAMPLE_CONTRACT_IDS.SIP010_TOKEN, SAMPLE_CONTRACT_IDS.SIP009_NFT]);
      });

      it('should update existing contracts during sync', async () => {
        // Mock hasContract to return true for existing contracts
        mockBlobStorage.hasContract.mockResolvedValue(true);
        mockBlobStorage.getContract.mockResolvedValue(sampleMetadata);

        const result = await contractRegistry.syncWithTokenCache();

        expect(result.success).toBe(true);
        expect(result.added).toBe(0);
        expect(result.updated).toBe(2);
        expect(result.updatedContracts).toEqual([SAMPLE_CONTRACT_IDS.SIP010_TOKEN, SAMPLE_CONTRACT_IDS.SIP009_NFT]);
      });

      it('should handle sync errors gracefully', async () => {
        mockBlobStorage.hasContract.mockResolvedValue(false);
        mockTraitAnalyzer.analyzeContract.mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);

        const result = await contractRegistry.syncWithTokenCache();

        expect(result.success).toBe(true);
        expect(result.added).toBe(0);
        expect(result.errors).toBe(2);
        expect(result.errorContracts).toHaveLength(2);
      });

      it('should skip invalid contract IDs', async () => {
        const { listTokens } = await import('@repo/tokens');
        vi.mocked(listTokens).mockResolvedValueOnce([
          { contractId: 'invalid-id', name: 'Invalid', type: 'token', symbol: 'INV', identifier: 'invalid' },
          { contractId: '', name: 'Empty', type: 'token', symbol: 'EMP', identifier: 'empty' },
          { contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN, name: 'Valid', type: 'token', symbol: 'VAL', identifier: 'valid' }
        ]);

        mockBlobStorage.hasContract.mockResolvedValue(false);
        mockTraitAnalyzer.analyzeContract.mockResolvedValue(sampleAnalysis);

        const result = await contractRegistry.syncWithTokenCache();

        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(3);
        expect(result.skipped).toBe(2);
        expect(result.added).toBe(1);
      });
    });
  });

  describe('Management Operations', () => {
    describe('blockContract', () => {
      it('should block contract successfully', async () => {
        mockBlobStorage.getContract.mockResolvedValueOnce(sampleMetadata);

        const result = await contractRegistry.blockContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN, 'Malicious contract');

        expect(result.success).toBe(true);
        expect(mockIndexManager.blockContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      });

      it('should return error for non-existent contract', async () => {
        mockBlobStorage.getContract.mockResolvedValueOnce(null);

        const result = await contractRegistry.blockContract('SP123.non-existent', 'Test reason');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('unblockContract', () => {
      it('should unblock contract successfully', async () => {
        const blockedMetadata = {
          ...sampleMetadata,
          validationStatus: 'blocked' as const,
          blocked: { reason: 'Test', blockedAt: Date.now(), blockedBy: 'system' }
        };
        mockBlobStorage.getContract.mockResolvedValueOnce(blockedMetadata);

        const result = await contractRegistry.unblockContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result.success).toBe(true);
        expect(mockIndexManager.unblockContract).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      });
    });

    describe('isBlocked', () => {
      it('should return blocked status', async () => {
        mockIndexManager.isBlocked.mockResolvedValueOnce(true);

        const result = await contractRegistry.isBlocked(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

        expect(result).toBe(true);
        expect(mockIndexManager.isBlocked).toHaveBeenCalledWith(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      });
    });
  });

  describe('Stats and Health', () => {
    describe('getStats', () => {
      it('should return comprehensive registry statistics', async () => {
        const result = await contractRegistry.getStats();

        expect(result).toEqual({
          totalContracts: 100,
          contractsByType: {
            token: 0,
            nft: 0,
            vault: 0,
            unknown: 0
          },
          contractsByStatus: {
            valid: 0,
            invalid: 0,
            blocked: 0,
            pending: 0
          },
          blockedContracts: 0,
          lastDiscovery: 0,
          lastAnalysis: 0,
          totalAnalysisTime: 0,
          averageAnalysisTime: 0,
          cacheHitRate: 95
        });
      });

      it('should handle stats errors gracefully', async () => {
        mockBlobStorage.getStats.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

        const result = await contractRegistry.getStats();

        expect(result.totalContracts).toBe(0);
        expect(result.cacheHitRate).toBe(0);
      });
    });

    describe('getHealth', () => {
      it('should return healthy status when all components work', async () => {
        // Ensure all stats return positive values
        mockBlobStorage.getStats.mockResolvedValueOnce({
          totalContracts: 100,
          totalSize: 1024000,
          averageSize: 10240,
          largestContract: null,
          compressionRatio: 0.3,
          lastUpdated: Date.now()
        });

        mockIndexManager.getStats.mockResolvedValueOnce({
          totalIndexes: 10,
          indexSizes: {},
          lastUpdated: {},
          hitRate: 95,
          totalQueries: 1000,
          cacheHits: 950
        });

        const result = await contractRegistry.getHealth();

        expect(result.healthy).toBe(true);
        expect(result.components).toEqual({
          blobStorage: true,
          kvIndexes: true,
          analyzer: true,
          discovery: true
        });
        expect(result.issues).toBeUndefined();
      });

      it('should return unhealthy status when components fail', async () => {
        mockBlobStorage.getStats.mockRejectedValueOnce(ERROR_SCENARIOS.NETWORK_ERROR);

        const result = await contractRegistry.getHealth();

        expect(result.healthy).toBe(false);
        expect(result.components.blobStorage).toBe(false);
        expect(result.issues).toEqual(['Health check failed: Network request failed']);
      });

      it('should detect unhealthy components', async () => {
        mockBlobStorage.getStats.mockResolvedValueOnce({ totalContracts: -1 });
        mockIndexManager.getStats.mockResolvedValueOnce({ totalIndexes: -1 });

        const result = await contractRegistry.getHealth();

        expect(result.healthy).toBe(false);
        expect(result.components.blobStorage).toBe(false);
        expect(result.components.kvIndexes).toBe(false);
        expect(result.issues).toContain('Blob storage not responding');
        expect(result.issues).toContain('KV indexes not responding');
      });
    });
  });

  describe('Performance and Integration', () => {
    it('should handle bulk operations efficiently', async () => {
      const contracts = mockFactory.createContracts(10);
      const operations = contracts.map((_, i) =>
        contractRegistry.addContract(`SP${i}.test`)
      );

      mockBlobStorage.hasContract.mockResolvedValue(false);
      mockTraitAnalyzer.analyzeContract.mockResolvedValue(sampleAnalysis);

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should maintain consistency across all components', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(false);
      mockTraitAnalyzer.analyzeContract.mockResolvedValueOnce(sampleAnalysis);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(true);

      // Verify all components were called correctly
      expect(mockBlobStorage.putContract).toHaveBeenCalledTimes(1);
      expect(mockIndexManager.addToIndexes).toHaveBeenCalledTimes(1);
      expect(mockTraitAnalyzer.analyzeContract).toHaveBeenCalledTimes(1);
    });

    it('should handle component failures gracefully', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(false);
      mockTraitAnalyzer.analyzeContract.mockResolvedValueOnce(sampleAnalysis);
      mockIndexManager.addToIndexes.mockRejectedValueOnce(ERROR_SCENARIOS.KV_ERROR);

      const result = await contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.success).toBe(false);
      expect(result.error).toContain('KV operation failed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed contract IDs', async () => {
      mockBlobStorage.hasContract.mockResolvedValueOnce(false);
      mockTraitAnalyzer.analyzeContract.mockRejectedValueOnce(new Error('Invalid contract ID format'));

      const result = await contractRegistry.addContract('invalid-contract-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid contract ID format');
    });

    it('should handle concurrent operations on same contract', async () => {
      mockBlobStorage.hasContract.mockResolvedValue(false);
      mockTraitAnalyzer.analyzeContract.mockResolvedValue(sampleAnalysis);

      const operations = [
        contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN),
        contractRegistry.addContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ];

      const results = await Promise.all(operations);

      // All should succeed (idempotent behavior)
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});