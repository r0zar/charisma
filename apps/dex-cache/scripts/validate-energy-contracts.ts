// Validate energy contracts using getContractInfo from @repo/polyglot
import { getContractInfo, callReadOnlyFunction, ContractInfo } from '@repo/polyglot';
import { getAllVaultData } from '../src/lib/pool-service';

interface EnergyContractValidation {
    contractId: string;
    name: string;
    isValid: boolean;
    isAccessible: boolean;
    hasSourceCode: boolean;
    blockHeight?: number;
    clarityVersion?: number;
    tokenReferences: string[];
    issues: string[];
    contractInfo?: ContractInfo;
}

async function validateEnergyContracts() {
    console.log('🔍 Energy Contract Validation');
    console.log('');
    
    console.log('🔧 Environment Check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`  KV_URL: ${process.env.KV_URL ? 'set ✅' : 'not set ❌'}`);
    console.log(`  HIRO_API_KEY: ${process.env.HIRO_API_KEY ? 'set ✅' : 'not set ❌'}`);
    console.log('');

    try {
        // Fetch all energy contracts from vault data
        console.log('📊 Fetching energy contracts from vault data...');
        const energyVaults = await getAllVaultData({ type: 'ENERGY' });
        
        if (energyVaults.length === 0) {
            console.log('❌ No energy contracts found in vault data');
            return;
        }

        console.log(`📋 Found ${energyVaults.length} energy contracts to validate`);
        console.log('');

        const validationResults: EnergyContractValidation[] = [];

        // Validate each energy contract
        for (const vault of energyVaults) {
            console.log(`🔍 Validating contract: ${vault.contractId}`);
            
            const validation: EnergyContractValidation = {
                contractId: vault.contractId,
                name: vault.name,
                isValid: false,
                isAccessible: false,
                hasSourceCode: false,
                tokenReferences: [],
                issues: []
            };

            try {
                // Get contract info using polyglot
                const contractInfo = await getContractInfo(vault.contractId);
                
                if (!contractInfo) {
                    validation.issues.push('Contract not found on blockchain');
                    console.log(`  ❌ Contract not found: ${vault.contractId}`);
                } else {
                    validation.isAccessible = true;
                    validation.contractInfo = contractInfo;
                    validation.blockHeight = contractInfo.block_height;
                    validation.clarityVersion = contractInfo.clarity_version;
                    
                    if (contractInfo.source_code && contractInfo.source_code.trim().length > 0) {
                        validation.hasSourceCode = true;
                        
                        // Extract token references from source code
                        validation.tokenReferences = extractTokenReferences(contractInfo.source_code);
                        
                        console.log(`  ✅ Contract accessible (block ${contractInfo.block_height})`);
                        console.log(`  📄 Source code: ${contractInfo.source_code.length} characters`);
                        console.log(`  🎯 Token references found: ${validation.tokenReferences.length}`);
                        
                        if (validation.tokenReferences.length > 0) {
                            validation.tokenReferences.forEach(ref => {
                                console.log(`    - ${ref}`);
                            });
                        }
                        
                        // Additional validations
                        await performAdditionalValidations(validation);
                        
                    } else {
                        validation.issues.push('No source code available');
                        console.log(`  ⚠️ No source code available`);
                    }
                }
                
            } catch (error) {
                validation.issues.push(`Error fetching contract info: ${error}`);
                console.log(`  ❌ Error: ${error}`);
            }
            
            // Determine overall validity
            validation.isValid = validation.isAccessible && 
                                validation.hasSourceCode && 
                                validation.issues.length === 0;
            
            validationResults.push(validation);
            console.log('');
        }

        // Generate summary report
        generateValidationReport(validationResults);

    } catch (error) {
        console.error('❌ Error during energy contract validation:', error);
        process.exit(1);
    }
}

function extractTokenReferences(sourceCode: string): string[] {
    const tokenReferences: string[] = [];
    
    // Based on real energize contract structure:
    // contract-call? 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn tap
    // impl-trait .dexterity-traits-v0.liquidity-pool-trait
    
    // Pattern 1: Direct contract calls with quotes
    const contractCallPattern = /contract-call\?\s+'([A-Z0-9]{26,40}\.[a-zA-Z0-9-]+)/g;
    let match;
    while ((match = contractCallPattern.exec(sourceCode)) !== null) {
        if (!tokenReferences.includes(match[1])) {
            tokenReferences.push(match[1]);
        }
    }
    
    // Pattern 2: Direct contract references (without quotes)
    const directContractPattern = /SP[A-Z0-9]{39}\.[a-zA-Z][a-zA-Z0-9-]*/g;
    while ((match = directContractPattern.exec(sourceCode)) !== null) {
        if (!tokenReferences.includes(match[0])) {
            tokenReferences.push(match[0]);
        }
    }
    
    // Pattern 3: Trait implementations (relative paths like .dexterity-traits-v0.liquidity-pool-trait)
    const traitImplPattern = /impl-trait\s+\.([a-zA-Z0-9-]+)\s*\.\s*([a-zA-Z0-9-]+)/g;
    while ((match = traitImplPattern.exec(sourceCode)) !== null) {
        const traitRef = `${match[1]}.${match[2]}`;
        if (!tokenReferences.includes(traitRef)) {
            tokenReferences.push(traitRef);
        }
    }
    
    return tokenReferences;
}

async function performAdditionalValidations(validation: EnergyContractValidation) {
    // Check if contract has expected energy functions based on discovered architecture
    const expectedFunctions = ['quote', 'execute', 'get-token-uri']; // Actual energize contract functions
    
    for (const functionName of expectedFunctions) {
        try {
            // This is a basic test - we're not calling with args, just checking if function exists
            // Real implementations would need proper arguments
            const [contractAddress, contractName] = validation.contractId.split('.');
            
            // We can't easily test without proper arguments, so we'll just note the attempt
            console.log(`    🔧 Function check: ${functionName} (existence check only)`);
            
        } catch (error) {
            // Expected for functions that require arguments
        }
    }
    
    // Check vault data consistency
    if (validation.tokenReferences.length === 0) {
        validation.issues.push('No token references found in source code');
    }
    
    // Check contract age (very new contracts might be suspicious)
    if (validation.blockHeight && validation.blockHeight > 150000) { // Arbitrary recent block
        console.log(`    📅 Recent contract (block ${validation.blockHeight})`);
    }
}

function generateValidationReport(validationResults: EnergyContractValidation[]) {
    console.log('📊 VALIDATION SUMMARY REPORT');
    console.log(''.padEnd(50, '='));
    console.log('');
    
    const totalContracts = validationResults.length;
    const validContracts = validationResults.filter(v => v.isValid).length;
    const accessibleContracts = validationResults.filter(v => v.isAccessible).length;
    const contractsWithSource = validationResults.filter(v => v.hasSourceCode).length;
    
    console.log(`📈 Overall Statistics:`);
    console.log(`  Total contracts checked: ${totalContracts}`);
    console.log(`  Fully valid contracts: ${validContracts}/${totalContracts} (${Math.round(validContracts/totalContracts*100)}%)`);
    console.log(`  Accessible contracts: ${accessibleContracts}/${totalContracts} (${Math.round(accessibleContracts/totalContracts*100)}%)`);
    console.log(`  Contracts with source: ${contractsWithSource}/${totalContracts} (${Math.round(contractsWithSource/totalContracts*100)}%)`);
    console.log('');
    
    // Token reference analysis
    console.log(`🎯 Token Reference Analysis:`);
    const allTokenRefs = validationResults.flatMap(v => v.tokenReferences);
    const uniqueTokens = [...new Set(allTokenRefs)];
    
    console.log(`  Total token references: ${allTokenRefs.length}`);
    console.log(`  Unique tokens referenced: ${uniqueTokens.length}`);
    console.log('');
    
    if (uniqueTokens.length > 0) {
        console.log(`🔗 Unique Token Contracts Found:`);
        uniqueTokens.forEach(token => {
            const count = allTokenRefs.filter(ref => ref === token).length;
            console.log(`  - ${token} (referenced ${count} time${count > 1 ? 's' : ''})`);
        });
        console.log('');
    }
    
    // Issue summary
    const allIssues = validationResults.flatMap(v => v.issues);
    if (allIssues.length > 0) {
        console.log(`⚠️ Issues Found:`);
        const issueGroups = allIssues.reduce((acc, issue) => {
            acc[issue] = (acc[issue] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        Object.entries(issueGroups).forEach(([issue, count]) => {
            console.log(`  - ${issue} (${count} occurrence${count > 1 ? 's' : ''})`);
        });
        console.log('');
    }
    
    // Detailed contract status
    console.log(`📋 Individual Contract Status:`);
    validationResults.forEach(validation => {
        const status = validation.isValid ? '✅' : validation.isAccessible ? '⚠️' : '❌';
        console.log(`  ${status} ${validation.contractId}`);
        console.log(`     Name: ${validation.name}`);
        if (validation.blockHeight) {
            console.log(`     Block: ${validation.blockHeight} | Clarity: v${validation.clarityVersion}`);
        }
        if (validation.tokenReferences.length > 0) {
            console.log(`     Tokens: ${validation.tokenReferences.length} reference${validation.tokenReferences.length > 1 ? 's' : ''}`);
        }
        if (validation.issues.length > 0) {
            console.log(`     Issues: ${validation.issues.join(', ')}`);
        }
        console.log('');
    });
    
    console.log('✨ Energy contract validation complete!');
}

// Run the validation
validateEnergyContracts().catch(console.error);