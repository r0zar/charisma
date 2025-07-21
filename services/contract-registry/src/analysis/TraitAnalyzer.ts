/**
 * TraitAnalyzer - Analyzes contracts to determine implemented traits
 * 
 * Uses @repo/polyglot to fetch contract information and analyze ABIs
 * to determine what traits (SIP standards) a contract implements.
 */

import { getContractInfoWithParsedAbi, callReadOnly, type ContractAbi } from '@repo/polyglot';
import type { ContractAnalysis, ContractType, SourceMetadata } from '../types';
import { MetadataExtractor } from './MetadataExtractor';
import type { TokenCacheData } from '@repo/tokens';
// Note: Real API returns number[] for abi and structured object for parsed_abi
// Types from polyglot may not match exactly, but we handle both cases

export interface TraitAnalyzerConfig {
  timeout: number; // Analysis timeout in milliseconds
  enableSourceAnalysis: boolean; // Whether to analyze source code
  enableRuntimeCheck: boolean; // Whether to perform runtime trait validation
  enableMetadataExtraction: boolean; // Whether to extract token metadata
}

export interface TraitDefinition {
  name: string;
  requiredFunctions: string[];
  optionalFunctions?: string[];
  requiredVariables?: string[];
  description: string;
}

export interface TraitValidationResult {
  trait: string;
  implemented: boolean;
  confidence: number; // 0-1 score
  validationMethod: 'abi-check' | 'source-check' | 'runtime-check';
  missingFunctions?: string[];
  foundFunctions?: string[];
  notes?: string;
}

export class TraitAnalyzer {
  private config: TraitAnalyzerConfig;
  private traitDefinitions: Map<string, TraitDefinition>;
  private metadataExtractor: MetadataExtractor;

  constructor(config: Partial<TraitAnalyzerConfig> = {}) {
    this.config = {
      timeout: 30000, // 30 seconds
      enableSourceAnalysis: true,
      enableRuntimeCheck: false, // Expensive, disabled by default
      enableMetadataExtraction: true, // Enable by default
      ...config
    };

    this.traitDefinitions = this.initializeTraitDefinitions();
    this.metadataExtractor = new MetadataExtractor();
  }

  /**
   * Analyze a contract to determine implemented traits and metadata
   */
  async analyzeContract(contractId: string): Promise<ContractAnalysis> {
    const startTime = Date.now();

    try {
      // Fetch contract information with parsed ABI
      const contractInfo = await this.fetchContractInfo(contractId);
      if (!contractInfo) {
        throw new Error(`Contract ${contractId} not found`);
      }

      // Use parsed_abi for trait analysis (the structured ABI data)
      // Real API returns structured object in parsed_abi, raw abi is number[]
      const abiForAnalysis = contractInfo.parsed_abi;
      
      // Determine contract type based on implemented traits
      const traitResults = await this.analyzeTraits(contractId, abiForAnalysis);
      const implementedTraits = traitResults
        .filter(result => result.implemented)
        .map(result => result.trait);

      const contractType = this.determineContractType(implementedTraits);

      // Analyze source code metadata if enabled
      const sourceMetadata = this.config.enableSourceAnalysis ?
        this.analyzeSourceCode(contractInfo.source_code) : undefined;

      // Extract token metadata if enabled and contract is a token/NFT
      let tokenMetadata: TokenCacheData | undefined;
      if (this.config.enableMetadataExtraction && (contractType === 'token' || contractType === 'nft')) {
        try {
          const extractedMetadata = await this.metadataExtractor.extractMetadata(contractId, contractType, implementedTraits);
          if (extractedMetadata) {
            tokenMetadata = this.metadataExtractor.convertToTokenCacheData(contractId, extractedMetadata, contractType);
          }
        } catch (error) {
          console.warn(`Failed to extract token metadata for ${contractId}:`, error instanceof Error ? error.message : error);
        }
      }

      return {
        contractId,
        implementedTraits,
        contractType,
        sourceCode: contractInfo.source_code,
        abi: contractInfo.abi,
        parsedAbi: contractInfo.parsed_abi || undefined,
        clarityVersion: contractInfo.clarity_version || undefined,
        sourceMetadata,
        tokenMetadata,
        deploymentInfo: {
          blockHeight: contractInfo.block_height,
          txId: contractInfo.tx_id
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Contract analysis failed for ${contractId}: ${errorMessage}`);
    }
  }

  /**
   * Analyze what traits a contract implements
   */
  async analyzeTraits(contractId: string, abi: ContractAbi | null): Promise<TraitValidationResult[]> {
    const results: TraitValidationResult[] = [];

    for (const traitDef of Array.from(this.traitDefinitions.values())) {
      try {
        const result = await this.validateTrait(contractId, traitDef, abi);
        results.push(result);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          trait: traitDef.name,
          implemented: false,
          confidence: 0,
          validationMethod: 'abi-check',
          notes: `Validation failed: ${errorMessage}`
        });
      }
    }

    return results;
  }

  /**
   * Validate if a contract implements a specific trait
   */
  private async validateTrait(
    contractId: string,
    traitDef: TraitDefinition,
    abi: ContractAbi | null
  ): Promise<TraitValidationResult> {
    // Primary validation: ABI-based check
    const abiResult = this.validateTraitFromAbi(traitDef, abi);

    // If ABI validation is conclusive, return it
    if (abiResult.confidence > 0.8) {
      return abiResult;
    }

    // Fallback: Runtime validation (if enabled and ABI check was inconclusive)
    if (this.config.enableRuntimeCheck && abiResult.confidence < 0.5) {
      try {
        const runtimeResult = await this.validateTraitAtRuntime(contractId, traitDef);
        // Use runtime result if it has higher confidence
        if (runtimeResult.confidence > abiResult.confidence) {
          return runtimeResult;
        }
      } catch (error) {
        // Runtime check failed, stick with ABI result
      }
    }

    return abiResult;
  }

  /**
   * Validate trait implementation by analyzing the parsed contract ABI
   */
  private validateTraitFromAbi(
    traitDef: TraitDefinition,
    abi: ContractAbi | null
  ): TraitValidationResult {
    if (!abi) {
      return {
        trait: traitDef.name,
        implemented: false,
        confidence: 0,
        validationMethod: 'abi-check',
        notes: 'No ABI available for analysis'
      };
    }

    // For SIP standards and complex traits, use enhanced signature validation
    if (traitDef.name === 'SIP010' || traitDef.name === 'SIP009' || traitDef.name === 'SIP069' || 
        traitDef.name === 'Vault' || traitDef.name === 'Sublink') {
      return this.validateSipSignatures(traitDef, abi);
    }

    // Legacy validation for other traits (function name-based)
    const functionNames = abi.functions.map(f => f.name);
    const foundFunctions = traitDef.requiredFunctions.filter(fn => functionNames.includes(fn));
    const missingFunctions = traitDef.requiredFunctions.filter(fn => !functionNames.includes(fn));

    const hasAllRequired = missingFunctions.length === 0;
    const requiredRatio = foundFunctions.length / traitDef.requiredFunctions.length;

    // Calculate confidence based on function coverage
    let confidence = requiredRatio;

    // Boost confidence if optional functions are also present
    if (traitDef.optionalFunctions) {
      const optionalFound = traitDef.optionalFunctions.filter(fn => functionNames.includes(fn));
      const optionalRatio = optionalFound.length / traitDef.optionalFunctions.length;
      confidence = Math.min(1.0, confidence + (optionalRatio * 0.2));
    }

    return {
      trait: traitDef.name,
      implemented: hasAllRequired,
      confidence,
      validationMethod: 'abi-check',
      foundFunctions,
      missingFunctions: missingFunctions.length > 0 ? missingFunctions : undefined
    };
  }

  /**
   * Enhanced validation for SIP standards that checks exact function signatures
   */
  private validateSipSignatures(
    traitDef: TraitDefinition,
    abi: ContractAbi
  ): TraitValidationResult {
    const expectedSignatures = this.getSipExpectedSignatures(traitDef.name);
    const foundFunctions: string[] = [];
    const missingFunctions: string[] = [];
    const invalidSignatures: string[] = [];

    for (const funcName of traitDef.requiredFunctions) {
      const actualFunc = abi.functions.find(f => f.name === funcName);
      const expectedSig = expectedSignatures[funcName];

      if (!actualFunc) {
        missingFunctions.push(funcName);
        continue;
      }

      if (!expectedSig) {
        // No signature definition - fall back to name-based check
        foundFunctions.push(funcName);
        continue;
      }

      // Validate function signature
      const isValidSignature = this.validateFunctionSignature(actualFunc, expectedSig);
      if (isValidSignature) {
        foundFunctions.push(funcName);
      } else {
        invalidSignatures.push(funcName);
      }
    }

    const hasAllRequired = missingFunctions.length === 0 && invalidSignatures.length === 0;
    const validFunctionCount = foundFunctions.length;
    const totalRequired = traitDef.requiredFunctions.length;
    
    // Stricter confidence calculation for SIP standards
    let confidence = validFunctionCount / totalRequired;
    
    // Penalize invalid signatures more than missing functions
    if (invalidSignatures.length > 0) {
      confidence *= 0.5; // Significant penalty for wrong signatures
    }

    const notes: string[] = [];
    if (invalidSignatures.length > 0) {
      notes.push(`Invalid signatures: ${invalidSignatures.join(', ')}`);
    }

    return {
      trait: traitDef.name,
      implemented: hasAllRequired,
      confidence,
      validationMethod: 'abi-check',
      foundFunctions,
      missingFunctions: missingFunctions.length > 0 ? missingFunctions : undefined,
      notes: notes.length > 0 ? notes.join('; ') : undefined
    };
  }

  /**
   * Get expected function signatures for SIP standards
   */
  private getSipExpectedSignatures(sipName: string): Record<string, any> {
    if (sipName === 'SIP010') {
      return {
        'transfer': {
          access: 'public',
          argCount: 4, // amount, from, to, memo
          requiredArgTypes: ['uint', 'principal', 'principal'], // memo is optional
          returnType: 'response'
        },
        'get-name': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-symbol': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-decimals': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-balance': {
          access: 'read_only',
          argCount: 1,
          requiredArgTypes: ['principal'],
          returnType: 'response'
        },
        'get-total-supply': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        }
      };
    }

    if (sipName === 'SIP009') {
      return {
        'get-last-token-id': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-token-uri': {
          access: 'read_only',
          argCount: 1,
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        'get-owner': {
          access: 'read_only',
          argCount: 1,
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        'transfer': {
          access: 'public',
          argCount: 3, // token-id, from, to
          requiredArgTypes: ['uint', 'principal', 'principal'],
          returnType: 'response'
        }
      };
    }

    if (sipName === 'SIP069') {
      return {
        // SIP010 base functions
        'transfer': {
          access: 'public',
          argCount: 4, // amount, from, to, memo
          requiredArgTypes: ['uint', 'principal', 'principal'],
          returnType: 'response'
        },
        'get-name': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-symbol': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-decimals': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        'get-balance': {
          access: 'read_only',
          argCount: 1,
          requiredArgTypes: ['principal'],
          returnType: 'response'
        },
        'get-total-supply': {
          access: 'read_only',
          argCount: 0,
          returnType: 'response'
        },
        // Credit-specific functions
        'deposit': {
          access: 'public',
          argCount: 2, // amount, recipient?
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        'withdraw': {
          access: 'public',
          argCount: 2, // amount, recipient?
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        'x-redeem': {
          access: 'public',
          argCount: 4, // signature, amount, uuid, to
          requiredArgTypes: ['buffer', 'uint', 'string-utf8', 'principal'],
          returnType: 'response'
        },
        'x-transfer': {
          access: 'public',
          argCount: 4, // signature, amount, uuid, to
          requiredArgTypes: ['buffer', 'uint', 'string-utf8', 'principal'],
          returnType: 'response'
        }
      };
    }

    if (sipName === 'Vault') {
      return {
        'execute': {
          access: 'public',
          argCount: 2, // amount, opcode?
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        'quote': {
          access: 'read_only',
          argCount: 2, // amount, opcode?
          requiredArgTypes: ['uint'],
          returnType: 'response'
        }
      };
    }

    if (sipName === 'Sublink') {
      return {
        // Vault trait functions
        'execute': {
          access: 'public',
          argCount: 2, // amount, opcode?
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        'quote': {
          access: 'read_only',
          argCount: 2, // amount, opcode?
          requiredArgTypes: ['uint'],
          returnType: 'response'
        },
        // Bridge functions
        'deposit': {
          access: 'public',
          argCount: 2, // amount, recipient
          requiredArgTypes: ['uint', 'principal'],
          returnType: 'response'
        },
        'withdraw': {
          access: 'public',
          argCount: 2, // amount, recipient
          requiredArgTypes: ['uint', 'principal'],
          returnType: 'response'
        },
        'x-execute': {
          access: 'public',
          argCount: 5, // amount, opcode, signature, uuid, recipient
          requiredArgTypes: ['uint', 'buffer', 'buffer', 'string-utf8', 'principal'],
          returnType: 'response'
        }
      };
    }

    return {};
  }

  /**
   * Validate a specific function signature against expected signature
   */
  private validateFunctionSignature(actualFunc: any, expectedSig: any): boolean {
    // Check access level
    if (actualFunc.access !== expectedSig.access) {
      return false;
    }

    // Check argument count
    const actualArgCount = actualFunc.args?.length || 0;
    if (actualArgCount !== expectedSig.argCount) {
      return false;
    }

    // Check required argument types (if specified)
    if (expectedSig.requiredArgTypes && actualFunc.args) {
      for (let i = 0; i < expectedSig.requiredArgTypes.length; i++) {
        const expectedType = expectedSig.requiredArgTypes[i];
        const actualArg = actualFunc.args[i];
        
        if (!actualArg) continue;
        
        // Flexible type checking - allow uint128/uint variations
        const actualType = typeof actualArg.type === 'string' ? actualArg.type : 'complex';
        if (expectedType === 'uint' && (actualType === 'uint' || actualType === 'uint128')) {
          continue; // Accept both uint and uint128
        }
        if (actualType !== expectedType) {
          return false;
        }
      }
    }

    // Check return type (basic check for response type)
    if (expectedSig.returnType === 'response') {
      const hasResponseReturn = actualFunc.outputs?.type?.response !== undefined;
      if (!hasResponseReturn) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate trait implementation by calling contract functions at runtime
   */
  private async validateTraitAtRuntime(
    contractId: string,
    traitDef: TraitDefinition
  ): Promise<TraitValidationResult> {
    const foundFunctions: string[] = [];
    const missingFunctions: string[] = [];

    // Test each required function with a simple call
    for (const functionName of traitDef.requiredFunctions) {
      try {
        // Try calling the function with no arguments
        const result = await callReadOnly(contractId, functionName, []);
        if (result !== null) {
          foundFunctions.push(functionName);
        } else {
          missingFunctions.push(functionName);
        }
      } catch (error) {
        // Function call failed, likely doesn't exist
        missingFunctions.push(functionName);
      }
    }

    const hasAllRequired = missingFunctions.length === 0;
    const confidence = foundFunctions.length / traitDef.requiredFunctions.length;

    return {
      trait: traitDef.name,
      implemented: hasAllRequired,
      confidence,
      validationMethod: 'runtime-check',
      foundFunctions,
      missingFunctions: missingFunctions.length > 0 ? missingFunctions : undefined
    };
  }

  /**
   * Fetch contract information using polyglot
   */
  private async fetchContractInfo(contractId: string) {
    return await getContractInfoWithParsedAbi(contractId);
  }

  /**
   * Determine contract type based on implemented traits
   */
  private determineContractType(implementedTraits: string[]): ContractType {
    // Priority-based classification
    if (implementedTraits.includes('SIP010')) {
      return 'token';
    }
    if (implementedTraits.includes('SIP009')) {
      return 'nft';
    }
    if (implementedTraits.includes('Vault')) {
      return 'vault';
    }

    return 'unknown';
  }

  /**
   * Analyze source code to extract metadata
   */
  private analyzeSourceCode(sourceCode: string): SourceMetadata {
    const lines = sourceCode.split('\n');
    const codeLines = lines.filter(line =>
      line.trim() && !line.trim().startsWith(';;')
    ).length;

    const transferAnalysis = this.analyzeTransferFunction(sourceCode);

    return {
      hasComments: sourceCode.includes(';;'),
      hasConstants: sourceCode.includes('define-constant'),
      hasDataVars: sourceCode.includes('define-data-var'),
      hasMaps: sourceCode.includes('define-map'),
      complexity: this.calculateComplexity(sourceCode),
      codeLines,
      transferFunctionSize: transferAnalysis.size,
      transferHasExternalCalls: transferAnalysis.hasExternalCalls
    };
  }

  /**
   * Calculate basic complexity score for source code
   */
  private calculateComplexity(sourceCode: string): number {
    const complexityKeywords = [
      'if', 'match', 'fold', 'map', 'filter', 'unwrap!', 'try!',
      'define-public', 'define-private', 'define-read-only'
    ];

    let complexity = 0;
    for (const keyword of complexityKeywords) {
      const matches = sourceCode.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      complexity += matches ? matches.length : 0;
    }

    return complexity;
  }

  /**
   * Initialize standard trait definitions
   */
  private initializeTraitDefinitions(): Map<string, TraitDefinition> {
    const traits = new Map<string, TraitDefinition>();

    // SIP010 - Fungible Token Standard
    traits.set('SIP010', {
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

    // SIP009 - Non-Fungible Token Standard
    traits.set('SIP009', {
      name: 'SIP009',
      requiredFunctions: [
        'get-last-token-id',
        'get-token-uri',
        'get-owner',
        'transfer'
      ],
      optionalFunctions: ['mint', 'burn'],
      description: 'Standard Non-Fungible Token (SIP009)'
    });

    return traits;
  }

  /**
   * Add custom trait definition
   */
  addTraitDefinition(trait: TraitDefinition): void {
    this.traitDefinitions.set(trait.name, trait);
  }

  /**
   * Get all known trait definitions
   */
  getTraitDefinitions(): TraitDefinition[] {
    return Array.from(this.traitDefinitions.values());
  }

  /**
   * Get specific trait definition
   */
  getTraitDefinition(traitName: string): TraitDefinition | null {
    return this.traitDefinitions.get(traitName) || null;
  }

  /**
   * Analyze the transfer function for size and external calls
   */
  private analyzeTransferFunction(sourceCode: string): { size: number; hasExternalCalls: boolean } {
    // Look for transfer function definition
    const transferFunctionPattern = /\(define-public\s+\(\s*transfer\s+[^)]*\)\s*[\s\S]*?\)\s*(?=\(define-|\s*$)/i;
    const match = sourceCode.match(transferFunctionPattern);
    
    if (!match) {
      return { size: 0, hasExternalCalls: false }; // No transfer function found
    }

    const transferFunction = match[0];
    
    // Calculate size (excluding whitespace and newlines)
    const cleanFunction = transferFunction.replace(/\s+/g, '');
    const size = cleanFunction.length;
    
    // Check for external contract calls
    const externalCallPattern = /contract-call\?/;
    const hasExternalCalls = externalCallPattern.test(transferFunction);
    
    return { size, hasExternalCalls };
  }
}