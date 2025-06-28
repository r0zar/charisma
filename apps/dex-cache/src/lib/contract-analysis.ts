/**
 * Contract Analysis Library
 * 
 * Provides functions for analyzing Stacks smart contracts, extracting relationships,
 * and validating energy system contracts based on discovered patterns.
 */

import { getContractInfo, callReadOnlyFunction, ContractInfo } from '@repo/polyglot';
import { uintCV, principalCV, optionalCVOf, bufferCVFromString } from '@stacks/transactions';

export interface ContractRelationship {
    sourceContract: string;
    targetContract: string;
    relationshipType: 'contract-call' | 'trait-impl' | 'direct-reference';
    functionName?: string;
    extractedFrom: string; // The source line/pattern that revealed this relationship
}

export interface ContractAnalysis {
    contractId: string;
    info: ContractInfo;
    relationships: ContractRelationship[];
    constants: Record<string, string>;
    functions: string[];
    traits: string[];
    isEnergyContract: boolean;
    contractType: 'energize-vault' | 'hold-to-earn' | 'token' | 'trait' | 'unknown';
}

export interface EnergySystemRelationship {
    vaultContract: string;
    engineContract: string;
    baseToken?: string;
    traitImplementation?: string;
    isValid: boolean;
    validationErrors: string[];
}

/**
 * Analyze a smart contract by parsing its source code and extracting relationships
 */
export async function analyzeContract(contractId: string): Promise<ContractAnalysis | null> {
    try {
        const contractInfo = await getContractInfo(contractId);
        if (!contractInfo) {
            return null;
        }

        const analysis: ContractAnalysis = {
            contractId,
            info: contractInfo,
            relationships: [],
            constants: {},
            functions: [],
            traits: [],
            isEnergyContract: false,
            contractType: 'unknown'
        };

        const sourceCode = contractInfo.source_code;
        
        // Extract relationships
        analysis.relationships = extractContractRelationships(contractId, sourceCode);
        
        // Extract constants
        analysis.constants = extractConstants(sourceCode);
        
        // Extract function definitions
        analysis.functions = extractFunctionNames(sourceCode);
        
        // Extract trait implementations
        analysis.traits = extractTraitImplementations(sourceCode);
        
        // Determine contract type and if it's energy-related
        analysis.contractType = determineContractType(contractId, sourceCode, analysis);
        analysis.isEnergyContract = isEnergyRelatedContract(contractId, sourceCode, analysis);

        return analysis;
    } catch (error) {
        console.error(`Error analyzing contract ${contractId}:`, error);
        return null;
    }
}

/**
 * Extract contract relationships from source code using improved regex patterns
 */
export function extractContractRelationships(sourceContract: string, sourceCode: string): ContractRelationship[] {
    const relationships: ContractRelationship[] = [];
    
    // Pattern 1: Direct contract calls with quotes
    // Example: contract-call? 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn tap
    const contractCallPattern = /contract-call\?\s+'([A-Z0-9]{26,40}\.[a-zA-Z0-9-]+)(?:\s+([a-zA-Z0-9-]+))?/g;
    let match: RegExpExecArray | null;
    while ((match = contractCallPattern.exec(sourceCode)) !== null) {
        relationships.push({
            sourceContract,
            targetContract: match[1],
            relationshipType: 'contract-call',
            functionName: match[2] || undefined, // Function name might not always be captured
            extractedFrom: match[0].trim()
        });
    }
    
    // Pattern 2: Trait implementations
    // Example: impl-trait .dexterity-traits-v0.liquidity-pool-trait
    const traitImplPattern = /impl-trait\s+\.([a-zA-Z0-9-]+)\s*\.\s*([a-zA-Z0-9-]+)/g;
    while ((match = traitImplPattern.exec(sourceCode)) !== null) {
        const traitRef = `${match[1]}.${match[2]}`;
        relationships.push({
            sourceContract,
            targetContract: traitRef,
            relationshipType: 'trait-impl',
            extractedFrom: match[0].trim()
        });
    }
    
    // Pattern 3: Direct contract references (without quotes)
    const directContractPattern = /SP[A-Z0-9]{39}\.[a-zA-Z][a-zA-Z0-9-]*/g;
    while ((match = directContractPattern.exec(sourceCode)) !== null) {
        // Avoid duplicates from contract-call patterns
        const existing = relationships.find(r => r.targetContract === match![0]);
        if (!existing) {
            relationships.push({
                sourceContract,
                targetContract: match![0],
                relationshipType: 'direct-reference',
                extractedFrom: match![0]
            });
        }
    }
    
    return relationships;
}

/**
 * Extract constants from contract source code
 */
export function extractConstants(sourceCode: string): Record<string, string> {
    const constants: Record<string, string> = {};
    
    // Pattern: define-constant NAME value
    const constantPattern = /define-constant\s+([A-Z_][A-Z0-9_]*)\s+(.+?)(?=\))/g;
    let match;
    while ((match = constantPattern.exec(sourceCode)) !== null) {
        constants[match[1]] = match[2].trim();
    }
    
    return constants;
}

/**
 * Extract function names from contract source code
 */
export function extractFunctionNames(sourceCode: string): string[] {
    const functions: string[] = [];
    
    // Pattern: define-public, define-private, define-read-only
    const functionPatterns = [
        /define-public\s+\(([a-zA-Z0-9-]+)/g,
        /define-private\s+\(([a-zA-Z0-9-]+)/g,
        /define-read-only\s+\(([a-zA-Z0-9-]+)/g
    ];
    
    functionPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(sourceCode)) !== null) {
            if (!functions.includes(match[1])) {
                functions.push(match[1]);
            }
        }
    });
    
    return functions;
}

/**
 * Extract trait implementations from contract source code
 */
export function extractTraitImplementations(sourceCode: string): string[] {
    const traits: string[] = [];
    
    const traitPattern = /impl-trait\s+\.?([a-zA-Z0-9.-]+)/g;
    let match;
    while ((match = traitPattern.exec(sourceCode)) !== null) {
        traits.push(match[1]);
    }
    
    return traits;
}

/**
 * Determine the contract type based on analysis
 */
export function determineContractType(
    contractId: string, 
    sourceCode: string, 
    analysis: Partial<ContractAnalysis>
): ContractAnalysis['contractType'] {
    
    // Check for energize vault pattern
    if (contractId.includes('energize') || 
        analysis.traits?.includes('dexterity-traits-v0.liquidity-pool-trait') ||
        analysis.functions?.includes('quote') && analysis.functions?.includes('execute')) {
        return 'energize-vault';
    }
    
    // Check for hold-to-earn pattern
    if (contractId.includes('hold-to-earn') || 
        analysis.functions?.includes('tap') ||
        analysis.functions?.includes('get-last-tap-block')) {
        return 'hold-to-earn';
    }
    
    // Check for trait definition
    if (sourceCode.includes('define-trait') || contractId.includes('trait')) {
        return 'trait';
    }
    
    // Check for token pattern
    if (analysis.functions?.includes('transfer') || 
        analysis.functions?.includes('get-balance') ||
        analysis.functions?.includes('get-total-supply')) {
        return 'token';
    }
    
    return 'unknown';
}

/**
 * Check if a contract is energy-related
 */
export function isEnergyRelatedContract(
    contractId: string, 
    sourceCode: string, 
    analysis: Partial<ContractAnalysis>
): boolean {
    
    const energyKeywords = ['energy', 'energize', 'hold-to-earn', 'tap', 'harvest'];
    const lowercaseContract = contractId.toLowerCase();
    const lowercaseSource = sourceCode.toLowerCase();
    
    // Check contract ID
    if (energyKeywords.some(keyword => lowercaseContract.includes(keyword))) {
        return true;
    }
    
    // Check source code
    if (energyKeywords.some(keyword => lowercaseSource.includes(keyword))) {
        return true;
    }
    
    // Check relationships
    if (analysis.relationships?.some(rel => 
        energyKeywords.some(keyword => rel.targetContract.toLowerCase().includes(keyword)))) {
        return true;
    }
    
    return false;
}

/**
 * Discover energy system relationships by analyzing vault and engine contracts
 */
export async function discoverEnergySystemRelationships(vaultContracts: string[]): Promise<EnergySystemRelationship[]> {
    const relationships: EnergySystemRelationship[] = [];
    
    for (const vaultContract of vaultContracts) {
        try {
            const analysis = await analyzeContract(vaultContract);
            if (!analysis) continue;
            
            // Find the engine contract from relationships
            const engineRelationship = analysis.relationships.find(
                rel => rel.relationshipType === 'contract-call' && 
                       (rel.targetContract.includes('hold-to-earn') || rel.functionName === 'tap')
            );
            
            if (engineRelationship) {
                const relationship: EnergySystemRelationship = {
                    vaultContract,
                    engineContract: engineRelationship.targetContract,
                    traitImplementation: analysis.traits[0], // First trait implementation
                    isValid: true,
                    validationErrors: []
                };
                
                // Validate the relationship
                await validateEnergySystemRelationship(relationship);
                relationships.push(relationship);
            }
        } catch (error) {
            console.error(`Error analyzing vault contract ${vaultContract}:`, error);
        }
    }
    
    return relationships;
}

/**
 * Validate an energy system relationship by testing contract functions
 */
export async function validateEnergySystemRelationship(relationship: EnergySystemRelationship): Promise<void> {
    const errors: string[] = [];
    
    try {
        // Test vault contract functions
        const [vaultAddress, vaultName] = relationship.vaultContract.split('.');
        
        // Test quote function
        const quoteResult = await callReadOnlyFunction(
            vaultAddress,
            vaultName,
            'quote',
            [uintCV(0), optionalCVOf(bufferCVFromString('07'))]
        );
        
        if (quoteResult === null) {
            errors.push('Vault quote function not accessible');
        }
        
        // Test engine contract functions
        const [engineAddress, engineName] = relationship.engineContract.split('.');
        
        // Test get-last-tap-block function
        const tapResult = await callReadOnlyFunction(
            engineAddress,
            engineName,
            'get-last-tap-block',
            [principalCV(vaultAddress)]
        );
        
        if (tapResult === null) {
            errors.push('Engine get-last-tap-block function not accessible');
        }
        
    } catch (error) {
        errors.push(`Validation error: ${error}`);
    }
    
    relationship.validationErrors = errors;
    relationship.isValid = errors.length === 0;
}

/**
 * Get a summary of energy system architecture
 */
export async function getEnergySystemArchitecture(): Promise<{
    vaults: ContractAnalysis[];
    engines: ContractAnalysis[];
    relationships: EnergySystemRelationship[];
    summary: {
        totalVaults: number;
        totalEngines: number;
        validRelationships: number;
        healthStatus: 'healthy' | 'warning' | 'critical';
    };
}> {
    
    // For now, we know there's only one energize contract
    const knownVaultContracts = ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1'];
    const knownEngineContracts = ['SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'];
    
    const vaults = await Promise.all(
        knownVaultContracts.map(contract => analyzeContract(contract))
    ).then(results => results.filter(Boolean) as ContractAnalysis[]);
    
    const engines = await Promise.all(
        knownEngineContracts.map(contract => analyzeContract(contract))
    ).then(results => results.filter(Boolean) as ContractAnalysis[]);
    
    const relationships = await discoverEnergySystemRelationships(knownVaultContracts);
    
    const validRelationships = relationships.filter(rel => rel.isValid).length;
    const healthStatus = validRelationships === relationships.length ? 'healthy' : 
                        validRelationships > 0 ? 'warning' : 'critical';
    
    return {
        vaults,
        engines,
        relationships,
        summary: {
            totalVaults: vaults.length,
            totalEngines: engines.length,
            validRelationships,
            healthStatus
        }
    };
}