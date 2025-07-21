/**
 * TraitAnalyzer Tests
 * Core functionality tests for contract trait analysis and classification
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraitAnalyzer } from '../../analysis/TraitAnalyzer';
import {
  SAMPLE_CONTRACT_IDS,
  SIP010_CONTRACT_INFO,
  SIP010_CONTRACT_INFO_WITH_PARSED_ABI,
  SIP009_CONTRACT_INFO,
  SIP010_PARSED_ABI,
  ERROR_SCENARIOS
} from '../fixtures/test-fixtures';
import type { ContractAbi } from '@repo/polyglot';
import { getContractInfoWithParsedAbi, callReadOnly } from '@repo/polyglot';

// Mock @repo/polyglot functions directly in this test file
vi.mock('@repo/polyglot', () => ({
  getContractInfoWithParsedAbi: vi.fn(),
  callReadOnly: vi.fn()
}));

describe('TraitAnalyzer', () => {
  let traitAnalyzer: TraitAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mock implementations to successful defaults
    vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue(SIP010_CONTRACT_INFO_WITH_PARSED_ABI);
    vi.mocked(callReadOnly).mockResolvedValue('mock-result');

    traitAnalyzer = new TraitAnalyzer({
      timeout: 5000,
      enableSourceAnalysis: true,
      enableRuntimeCheck: false
    });
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const analyzer = new TraitAnalyzer();
      expect(analyzer).toBeInstanceOf(TraitAnalyzer);
      expect(analyzer.getTraitDefinitions()).toHaveLength(2); // SIP010 and SIP009
    });

    it('should initialize with custom configuration', () => {
      const analyzer = new TraitAnalyzer({
        timeout: 10000,
        enableSourceAnalysis: false,
        enableRuntimeCheck: true
      });
      expect(analyzer).toBeInstanceOf(TraitAnalyzer);
    });

    it('should load standard trait definitions', () => {
      const traits = traitAnalyzer.getTraitDefinitions();
      expect(traits).toHaveLength(2);

      const sip010 = traitAnalyzer.getTraitDefinition('SIP010');
      expect(sip010).toEqual({
        name: 'SIP010',
        requiredFunctions: [
          'transfer',
          'get-name',
          'get-symbol',
          'get-decimals',
          'get-balance',
          'get-total-supply'
        ],
        optionalFunctions: ['transfer-memo', 'mint', 'burn'],
        description: 'Standard Fungible Token (SIP010)'
      });
    });
  });

  describe('analyzeContract', () => {
    it('should analyze SIP010 token contract successfully', async () => {
      const contractInfo = {
        ...SIP010_CONTRACT_INFO,
        parsed_abi: SIP010_PARSED_ABI
      };
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue(contractInfo);

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result).toEqual({
        contractId: SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        implementedTraits: ['SIP010'],
        contractType: 'token',
        sourceCode: SIP010_CONTRACT_INFO.source_code,
        abi: SIP010_CONTRACT_INFO.abi,
        parsedAbi: SIP010_PARSED_ABI,
        clarityVersion: 2,
        sourceMetadata: {
          hasComments: true,
          hasConstants: true,
          hasDataVars: false,
          hasMaps: false,
          complexity: expect.any(Number),
          codeLines: expect.any(Number),
          transferFunctionSize: expect.any(Number),
          transferHasExternalCalls: expect.any(Boolean)
        },
        deploymentInfo: {
          blockHeight: 150000,
          txId: '0x1234567890abcdef1234567890abcdef12345678'
        }
      });
    });

    it('should analyze SIP009 NFT contract successfully', async () => {
      const contractInfo = {
        ...SIP009_CONTRACT_INFO,
        parsed_abi: {
          functions: [
            { name: 'get-last-token-id', access: 'read_only' as const, args: [], outputs: { type: 'uint128' as const } },
            { name: 'get-token-uri', access: 'read_only' as const, args: [{ name: 'id', type: 'uint128' as const }], outputs: { type: 'string' as const } },
            { name: 'get-owner', access: 'read_only' as const, args: [{ name: 'id', type: 'uint128' as const }], outputs: { type: 'principal' as const } },
            { name: 'transfer', access: 'public' as const, args: [{ name: 'id', type: 'uint128' as const }], outputs: { type: 'bool' as const } }
          ],
          variables: [],
          maps: [],
          fungible_tokens: [],
          non_fungible_tokens: [{ name: 'crashpunks' }],
          clarity_version: 'Clarity1',
          epoch: 'Epoch21'
        }
      };
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue(contractInfo);

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP009_NFT);

      expect(result.implementedTraits).toEqual(['SIP009']);
      expect(result.contractType).toBe('nft');
      expect(result.sourceMetadata?.hasDataVars).toBe(true);
    });

    it('should handle contract not found', async () => {
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue(null);

      await expect(
        traitAnalyzer.analyzeContract('SP123.non-existent')
      ).rejects.toThrow('Contract SP123.non-existent not found');
    });

    it('should handle polyglot fetch errors', async () => {
      vi.mocked(getContractInfoWithParsedAbi).mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);

      await expect(
        traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN)
      ).rejects.toThrow('Contract analysis failed');
    });

    it('should skip source analysis when disabled', async () => {
      const analyzerNoSource = new TraitAnalyzer({ enableSourceAnalysis: false });
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        parsed_abi: SIP010_PARSED_ABI
      });

      const result = await analyzerNoSource.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.sourceMetadata).toBeUndefined();
    });
  });

  describe('analyzeTraits', () => {
    it('should identify SIP010 implementation correctly', async () => {
      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        SIP010_PARSED_ABI
      );

      const sip010Result = results.find(r => r.trait === 'SIP010');
      expect(sip010Result).toEqual({
        trait: 'SIP010',
        implemented: true,
        confidence: 1.0, // All required functions present
        validationMethod: 'abi-check',
        foundFunctions: [
          'transfer',
          'get-name',
          'get-symbol',
          'get-decimals',
          'get-balance',
          'get-total-supply'
        ],
        missingFunctions: undefined
      });
    });

    it('should identify partial trait implementation', async () => {
      const partialAbi: ContractAbi = {
        functions: [
          { name: 'transfer', access: 'public', args: [], outputs: { type: 'bool' } },
          { name: 'get-name', access: 'read_only', args: [], outputs: { type: 'string' } },
          { name: 'get-symbol', access: 'read_only', args: [], outputs: { type: 'string' } }
          // Missing get-decimals, get-balance, get-total-supply
        ],
        variables: [],
        maps: [],
        fungible_tokens: [],
        non_fungible_tokens: [],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        partialAbi
      );

      const sip010Result = results.find(r => r.trait === 'SIP010');
      expect(sip010Result?.implemented).toBe(false);
      expect(sip010Result?.confidence).toBe(0.5); // 3 out of 6 functions
      expect(sip010Result?.missingFunctions).toEqual([
        'get-decimals',
        'get-balance',
        'get-total-supply'
      ]);
    });

    it('should handle null ABI gracefully', async () => {
      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        null
      );

      expect(results).toHaveLength(2); // SIP010 and SIP009
      results.forEach(result => {
        expect(result.implemented).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.notes).toBe('No ABI available for analysis');
      });
    });

    it('should include optional functions in confidence calculation', async () => {
      const enhancedAbi: ContractAbi = {
        functions: [
          ...SIP010_PARSED_ABI.functions,
          { name: 'mint', access: 'public', args: [], outputs: { type: 'bool' } },
          { name: 'burn', access: 'public', args: [], outputs: { type: 'bool' } }
        ],
        variables: SIP010_PARSED_ABI.variables,
        maps: SIP010_PARSED_ABI.maps,
        fungible_tokens: SIP010_PARSED_ABI.fungible_tokens,
        non_fungible_tokens: SIP010_PARSED_ABI.non_fungible_tokens,
        clarity_version: SIP010_PARSED_ABI.clarity_version,
        epoch: SIP010_PARSED_ABI.epoch
      };

      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        enhancedAbi
      );

      const sip010Result = results.find(r => r.trait === 'SIP010');
      expect(sip010Result?.confidence).toBe(1.0); // Capped at 1.0, but includes optional functions
    });

    it('should handle trait validation errors gracefully', async () => {
      // Mock an error during trait validation
      const originalValidateTrait = traitAnalyzer['validateTrait'];
      traitAnalyzer['validateTrait'] = vi.fn().mockRejectedValue(new Error('Validation error'));

      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        SIP010_PARSED_ABI
      );

      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.implemented).toBe(false);
        expect(result.confidence).toBe(0);
        expect(result.notes).toContain('Validation failed: Validation error');
      });

      // Restore original method
      traitAnalyzer['validateTrait'] = originalValidateTrait;
    });
  });

  describe('Runtime Validation', () => {
    beforeEach(() => {
      // Enable runtime checking for these tests
      traitAnalyzer = new TraitAnalyzer({
        enableRuntimeCheck: true,
        enableSourceAnalysis: false
      });
    });

    it('should perform runtime validation when ABI check is inconclusive', async () => {
      // Mock ABI with low confidence result
      const inconclusiveAbi: ContractAbi = {
        functions: [
          { name: 'transfer', access: 'public', args: [], outputs: { type: 'bool' } }
          // Only 1 out of 6 required functions
        ],
        variables: [],
        maps: [],
        fungible_tokens: [],
        non_fungible_tokens: [],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      // Mock successful runtime calls
      vi.mocked(callReadOnly).mockResolvedValue('success');

      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        inconclusiveAbi
      );

      const sip010Result = results.find(r => r.trait === 'SIP010');
      expect(sip010Result?.validationMethod).toBe('runtime-check');
      expect(sip010Result?.implemented).toBe(true);
      expect(sip010Result?.confidence).toBe(1.0);
    });

    it('should handle runtime validation failures', async () => {
      const inconclusiveAbi: ContractAbi = {
        functions: [
          { name: 'transfer', access: 'public', args: [], outputs: { type: 'bool' } }
        ],
        variables: [],
        maps: [],
        fungible_tokens: [],
        non_fungible_tokens: [],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      // Mock failed runtime calls
      vi.mocked(callReadOnly).mockRejectedValue(new Error('Function not found'));

      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        inconclusiveAbi
      );

      const sip010Result = results.find(r => r.trait === 'SIP010');
      // ABI check should have low confidence, so runtime should be used
      expect(sip010Result?.validationMethod).toBe('abi-check'); // Falls back when runtime fails
      expect(sip010Result?.implemented).toBe(false);
      expect(sip010Result?.confidence).toBeLessThanOrEqual(0.2); // Low confidence from partial ABI
    });

    it('should fallback to ABI result when runtime check fails', async () => {
      // Mock runtime validation to throw error
      vi.mocked(callReadOnly).mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);

      const results = await traitAnalyzer.analyzeTraits(
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        SIP010_PARSED_ABI
      );

      const sip010Result = results.find(r => r.trait === 'SIP010');
      expect(sip010Result?.validationMethod).toBe('abi-check');
      expect(sip010Result?.implemented).toBe(true);
    });
  });

  describe('Contract Type Determination', () => {
    it('should classify token contracts correctly', async () => {
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        parsed_abi: SIP010_PARSED_ABI
      });

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.contractType).toBe('token');
      expect(result.implementedTraits).toContain('SIP010');
    });

    it('should classify NFT contracts correctly', async () => {
      const nftAbi: ContractAbi = {
        functions: [
          { name: 'get-last-token-id', access: 'read_only', args: [], outputs: { type: 'uint128' } },
          { name: 'get-token-uri', access: 'read_only', args: [], outputs: { type: 'string' } },
          { name: 'get-owner', access: 'read_only', args: [], outputs: { type: 'principal' } },
          { name: 'transfer', access: 'public', args: [], outputs: { type: 'bool' } }
        ],
        variables: [],
        maps: [],
        fungible_tokens: [],
        non_fungible_tokens: [{ name: 'test-nft' }],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP009_CONTRACT_INFO,
        parsed_abi: nftAbi
      });

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP009_NFT);

      expect(result.contractType).toBe('nft');
      expect(result.implementedTraits).toContain('SIP009');
    });

    it('should classify unknown contracts correctly', async () => {
      const unknownAbi: ContractAbi = {
        functions: [
          { name: 'some-function', access: 'public', args: [], outputs: { type: 'bool' } }
        ],
        variables: [],
        maps: [],
        fungible_tokens: [],
        non_fungible_tokens: [],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        parsed_abi: unknownAbi
      });

      const result = await traitAnalyzer.analyzeContract('SP123.unknown-contract');

      expect(result.contractType).toBe('unknown');
      expect(result.implementedTraits).toEqual([]);
    });

    it('should prioritize token over NFT when both traits are present', async () => {
      const hybridAbi: ContractAbi = {
        functions: [
          // SIP010 functions
          ...SIP010_PARSED_ABI.functions,
          // SIP009 functions
          { name: 'get-last-token-id', access: 'read_only', args: [], outputs: { type: 'uint128' } },
          { name: 'get-token-uri', access: 'read_only', args: [], outputs: { type: 'string' } },
          { name: 'get-owner', access: 'read_only', args: [], outputs: { type: 'principal' } }
        ],
        variables: SIP010_PARSED_ABI.variables,
        maps: SIP010_PARSED_ABI.maps,
        fungible_tokens: SIP010_PARSED_ABI.fungible_tokens,
        non_fungible_tokens: [{ name: 'test-nft' }],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        parsed_abi: hybridAbi
      });

      const result = await traitAnalyzer.analyzeContract('SP123.hybrid-contract');

      expect(result.contractType).toBe('token'); // Token priority over NFT
      expect(result.implementedTraits).toContain('SIP010');
      expect(result.implementedTraits).toContain('SIP009');
    });
  });

  describe('Source Code Analysis', () => {
    it('should analyze source code metadata correctly', async () => {
      const sourceCode = `
        ;; Test contract with comments
        (define-constant contract-owner tx-sender)
        (define-data-var total-supply uint u1000000)
        (define-map balances principal uint)
        
        (define-public (transfer (amount uint))
          (begin
            (if (> amount u0)
              (ok true)
              (err u1)
            )
          )
        )
      `;

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        source_code: sourceCode,
        parsed_abi: SIP010_PARSED_ABI
      });

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.sourceMetadata).toEqual({
        hasComments: true,
        hasConstants: true,
        hasDataVars: true,
        hasMaps: true,
        complexity: expect.any(Number),
        codeLines: expect.any(Number),
        transferFunctionSize: expect.any(Number),
        transferHasExternalCalls: expect.any(Boolean)
      });
      expect(result.sourceMetadata?.complexity).toBeGreaterThan(0);
      expect(result.sourceMetadata?.codeLines).toBeGreaterThan(0);
    });

    it('should calculate complexity correctly', async () => {
      const complexSource = `
        (define-public (complex-function (amount uint))
          (begin
            (if (> amount u0)
              (match (map-get? balances tx-sender)
                balance (if (>= balance amount)
                  (try! (ft-transfer? token amount tx-sender recipient))
                  (err u1)
                )
                (err u2)
              )
              (err u3)
            )
          )
        )
      `;

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        source_code: complexSource,
        parsed_abi: SIP010_PARSED_ABI
      });

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.sourceMetadata?.complexity).toBeGreaterThanOrEqual(5); // Multiple complexity keywords
    });
  });

  describe('Custom Trait Definitions', () => {
    it('should allow adding custom trait definitions', () => {
      const customTrait = {
        name: 'CustomVault',
        requiredFunctions: ['deposit', 'withdraw', 'get-balance'],
        optionalFunctions: ['emergency-withdraw'],
        description: 'Custom vault interface'
      };

      traitAnalyzer.addTraitDefinition(customTrait);

      const traits = traitAnalyzer.getTraitDefinitions();
      expect(traits).toHaveLength(3); // Original 2 + custom 1

      const retrieved = traitAnalyzer.getTraitDefinition('CustomVault');
      expect(retrieved).toEqual(customTrait);
    });

    it('should validate custom traits in analysis', async () => {
      const vaultTrait = {
        name: 'Vault',
        requiredFunctions: ['deposit', 'withdraw'],
        description: 'Vault Interface'
      };

      traitAnalyzer.addTraitDefinition(vaultTrait);

      const vaultAbi: ContractAbi = {
        functions: [
          { name: 'deposit', access: 'public', args: [], outputs: { type: 'bool' } },
          { name: 'withdraw', access: 'public', args: [], outputs: { type: 'bool' } },
          { name: 'get-balance', access: 'read_only', args: [], outputs: { type: 'uint128' } }
        ],
        variables: [],
        maps: [],
        fungible_tokens: [],
        non_fungible_tokens: [],
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      const results = await traitAnalyzer.analyzeTraits('SP123.vault', vaultAbi);

      const vaultResult = results.find(r => r.trait === 'Vault');
      expect(vaultResult?.implemented).toBe(true);
      expect(vaultResult?.confidence).toBe(1.0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed ABI gracefully', async () => {
      const malformedAbi = {
        // Missing required fields - functions is null
        functions: null,
        variables: undefined
      } as unknown as ContractAbi;

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        parsed_abi: malformedAbi
      });

      // The implementation should handle null functions gracefully and return unknown type
      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      expect(result.contractType).toBe('unknown');
      expect(result.implementedTraits).toEqual([]);
    });

    it('should handle empty source code', async () => {
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        source_code: '',
        parsed_abi: SIP010_PARSED_ABI
      });

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.sourceMetadata).toEqual({
        hasComments: false,
        hasConstants: false,
        hasDataVars: false,
        hasMaps: false,
        complexity: 0,
        codeLines: 0,
        transferFunctionSize: 0,
        transferHasExternalCalls: false
      });
    });

    it('should handle contracts without clarity version', async () => {
      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        clarity_version: null,
        parsed_abi: SIP010_PARSED_ABI
      });

      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);

      expect(result.clarityVersion).toBeUndefined();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large ABIs efficiently', async () => {
      const largeFunctions = Array.from({ length: 100 }, (_, i) => ({
        name: `function-${i}`,
        access: 'public' as const,
        args: [],
        outputs: { type: 'bool' as const }
      }));

      const largeAbi: ContractAbi = {
        functions: [
          ...SIP010_PARSED_ABI.functions,
          ...largeFunctions
        ],
        variables: SIP010_PARSED_ABI.variables,
        maps: SIP010_PARSED_ABI.maps,
        fungible_tokens: SIP010_PARSED_ABI.fungible_tokens,
        non_fungible_tokens: SIP010_PARSED_ABI.non_fungible_tokens,
        clarity_version: 'Clarity2',
        epoch: 'Epoch24'
      };

      vi.mocked(getContractInfoWithParsedAbi).mockResolvedValue({
        ...SIP010_CONTRACT_INFO,
        parsed_abi: largeAbi
      });

      const startTime = Date.now();
      const result = await traitAnalyzer.analyzeContract(SAMPLE_CONTRACT_IDS.SIP010_TOKEN);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.implementedTraits).toContain('SIP010');
    });

    it('should handle concurrent analysis efficiently', async () => {
      const contracts = [
        SAMPLE_CONTRACT_IDS.SIP010_TOKEN,
        SAMPLE_CONTRACT_IDS.SIP009_NFT,
        'SP123.contract3',
        'SP456.contract4',
        'SP789.contract5'
      ];

      vi.mocked(getContractInfoWithParsedAbi).mockImplementation((contractId) => {
        if (contractId.includes('token')) {
          return Promise.resolve({ ...SIP010_CONTRACT_INFO, parsed_abi: SIP010_PARSED_ABI });
        }
        return Promise.resolve({ ...SIP009_CONTRACT_INFO, parsed_abi: null });
      });

      const analyses = contracts.map(contractId =>
        traitAnalyzer.analyzeContract(contractId)
      );

      const results = await Promise.all(analyses);

      expect(results).toHaveLength(5);
      expect(results[0].contractType).toBe('token');
      expect(results[1].contractType).toBe('unknown'); // No parsed ABI
    });
  });
});