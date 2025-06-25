// Validate energy data integrity by testing contract functions and data consistency
import { getContractInfo, callReadOnlyFunction, getContractInterface } from '@repo/polyglot';
import { getAllVaultData } from '../src/lib/pool-service';
import { principalCV, uintCV, optionalCVOf, bufferCVFromString } from '@stacks/transactions';

interface DataIntegrityCheck {
    contractId: string;
    name: string;
    checks: {
        contractAccessible: boolean;
        functionsCallable: boolean;
        dataConsistent: boolean;
        parametersValid: boolean;
    };
    functionTests: FunctionTestResult[];
    parameterValues: ParameterValue[];
    issues: string[];
    overallHealth: 'healthy' | 'warning' | 'critical';
}

interface FunctionTestResult {
    functionName: string;
    testType: 'read-only' | 'view' | 'parameter';
    success: boolean;
    result?: any;
    error?: string;
    responseTime?: number;
}

interface ParameterValue {
    name: string;
    value: any;
    type: string;
    isReasonable: boolean;
    notes?: string;
}

async function validateEnergyDataIntegrity() {
    console.log('🔬 Energy Data Integrity Validation');
    console.log('');
    
    console.log('🔧 Environment Check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`  KV_URL: ${process.env.KV_URL ? 'set ✅' : 'not set ❌'}`);
    console.log(`  HIRO_API_KEY: ${process.env.HIRO_API_KEY ? 'set ✅' : 'not set ❌'}`);
    console.log('');

    try {
        // Get energy contracts
        console.log('📊 Fetching energy contracts...');
        const energyVaults = await getAllVaultData({ type: 'ENERGY' });
        
        if (energyVaults.length === 0) {
            console.log('❌ No energy contracts found');
            return;
        }

        console.log(`📋 Testing ${energyVaults.length} energy contracts`);
        console.log('');

        const integrityResults: DataIntegrityCheck[] = [];

        // Test each contract
        for (const vault of energyVaults) {
            console.log(`🧪 Testing contract: ${vault.contractId}`);
            
            const integrityCheck: DataIntegrityCheck = {
                contractId: vault.contractId,
                name: vault.name,
                checks: {
                    contractAccessible: false,
                    functionsCallable: false,
                    dataConsistent: false,
                    parametersValid: false
                },
                functionTests: [],
                parameterValues: [],
                issues: [],
                overallHealth: 'critical'
            };

            try {
                // Test 1: Contract accessibility
                const contractInfo = await getContractInfo(vault.contractId);
                if (contractInfo) {
                    integrityCheck.checks.contractAccessible = true;
                    console.log(`  ✅ Contract accessible (block ${contractInfo.block_height})`);
                } else {
                    integrityCheck.issues.push('Contract not accessible');
                    console.log(`  ❌ Contract not accessible`);
                }

                // Test 2: Function callability
                if (integrityCheck.checks.contractAccessible) {
                    integrityCheck.functionTests = await testContractFunctions(vault.contractId);
                    
                    const successfulTests = integrityCheck.functionTests.filter(t => t.success).length;
                    const totalTests = integrityCheck.functionTests.length;
                    
                    integrityCheck.checks.functionsCallable = successfulTests > 0;
                    console.log(`  📊 Function tests: ${successfulTests}/${totalTests} successful`);
                    
                    // Display function test results
                    integrityCheck.functionTests.forEach(test => {
                        const status = test.success ? '✅' : '❌';
                        const timing = test.responseTime ? ` (${test.responseTime}ms)` : '';
                        console.log(`    ${status} ${test.functionName}${timing}`);
                        if (!test.success && test.error) {
                            console.log(`       Error: ${test.error}`);
                        }
                    });
                }

                // Test 3: Parameter validation
                if (integrityCheck.checks.contractAccessible) {
                    integrityCheck.parameterValues = await extractContractParameters(vault.contractId, contractInfo!);
                    
                    const validParams = integrityCheck.parameterValues.filter(p => p.isReasonable).length;
                    const totalParams = integrityCheck.parameterValues.length;
                    
                    integrityCheck.checks.parametersValid = validParams === totalParams;
                    console.log(`  🎛️ Parameters: ${validParams}/${totalParams} reasonable`);
                    
                    // Display parameter values
                    integrityCheck.parameterValues.forEach(param => {
                        const status = param.isReasonable ? '✅' : '⚠️';
                        console.log(`    ${status} ${param.name}: ${param.value} (${param.type})`);
                        if (param.notes) {
                            console.log(`       Note: ${param.notes}`);
                        }
                    });
                }

                // Test 4: Data consistency checks
                if (integrityCheck.checks.functionsCallable) {
                    integrityCheck.checks.dataConsistent = await performConsistencyChecks(
                        vault.contractId, 
                        integrityCheck.functionTests
                    );
                    
                    if (integrityCheck.checks.dataConsistent) {
                        console.log(`  ✅ Data consistency checks passed`);
                    } else {
                        console.log(`  ⚠️ Data consistency issues detected`);
                        integrityCheck.issues.push('Data consistency issues detected');
                    }
                }

                // Determine overall health
                integrityCheck.overallHealth = determineOverallHealth(integrityCheck);
                
                const healthIcon = integrityCheck.overallHealth === 'healthy' ? '🟢' : 
                                 integrityCheck.overallHealth === 'warning' ? '🟡' : '🔴';
                console.log(`  ${healthIcon} Overall health: ${integrityCheck.overallHealth}`);

            } catch (error) {
                integrityCheck.issues.push(`Error during testing: ${error}`);
                console.log(`  ❌ Error: ${error}`);
            }
            
            integrityResults.push(integrityCheck);
            console.log('');
        }

        // Generate integrity report
        generateIntegrityReport(integrityResults);

    } catch (error) {
        console.error('❌ Error during integrity validation:', error);
        process.exit(1);
    }
}

async function testContractFunctions(contractId: string): Promise<FunctionTestResult[]> {
    const [contractAddress, contractName] = contractId.split('.');
    const functionTests: FunctionTestResult[] = [];
    
    // Test energize vault contract functions (read-only only - public functions require wallet signatures)
    const energizeFunctions = [
        { name: 'quote', args: [uintCV(0), optionalCVOf(bufferCVFromString('07'))], type: 'read-only' },
        { name: 'quote', args: [uintCV(0), optionalCVOf(null)], type: 'read-only', description: 'quote-no-opcode' },
        { name: 'get-token-uri', args: [], type: 'read-only' }, // Note: Fixed type from 'view' to 'read-only'
    ];

    // Test the energize vault functions
    for (const testFunc of energizeFunctions) {
        const startTime = Date.now();
        
        try {
            const result = await callReadOnlyFunction(
                contractAddress,
                contractName,
                testFunc.name,
                testFunc.args
            );
            
            const responseTime = Date.now() - startTime;
            
            functionTests.push({
                functionName: testFunc.description || testFunc.name,
                testType: testFunc.type as any,
                success: result !== null,
                result: result,
                responseTime
            });
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            functionTests.push({
                functionName: testFunc.description || testFunc.name,
                testType: testFunc.type as any,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                responseTime
            });
        }
    }

    // Also test hold-to-earn contract functions (read-only only - tap() requires wallet signature)
    const holdToEarnContractId = 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn';
    const [hteAddress, hteName] = holdToEarnContractId.split('.');
    
    // Test hold-to-earn read-only functions (tap() is public and requires signatures)
    const holdToEarnFunctions = [
        { name: 'get-last-tap-block', args: [principalCV(contractAddress)], type: 'read-only' },
    ];

    for (const testFunc of holdToEarnFunctions) {
        const startTime = Date.now();
        
        try {
            const result = await callReadOnlyFunction(
                hteAddress,
                hteName,
                testFunc.name,
                testFunc.args
            );
            
            const responseTime = Date.now() - startTime;
            
            functionTests.push({
                functionName: `hte-${testFunc.name}`,
                testType: testFunc.type as any,
                success: result !== null,
                result: result,
                responseTime
            });
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            functionTests.push({
                functionName: `hte-${testFunc.name}`,
                testType: testFunc.type as any,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                responseTime
            });
        }
    }
    
    return functionTests;
}

async function extractContractParameters(contractId: string, contractInfo: any): Promise<ParameterValue[]> {
    const parameters: ParameterValue[] = [];
    const sourceCode = contractInfo.source_code;
    
    if (!sourceCode) return parameters;
    
    // Extract define-constant and define-data-var declarations
    const constantPatterns = [
        /define-constant\s+(\w+)\s+(.+)/g,
        /define-data-var\s+(\w+)\s+\w+\s+(.+)/g
    ];
    
    constantPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(sourceCode)) !== null) {
            const name = match[1];
            const value = match[2].trim();
            
            const parameter: ParameterValue = {
                name,
                value,
                type: inferParameterType(value),
                isReasonable: validateParameterValue(name, value)
            };
            
            if (!parameter.isReasonable) {
                parameter.notes = getParameterValidationNote(name, value);
            }
            
            parameters.push(parameter);
        }
    });
    
    return parameters;
}

function inferParameterType(value: string): string {
    if (/^u\d+$/.test(value)) return 'uint';
    if (/^\d+$/.test(value)) return 'int';
    if (/^".*"$/.test(value)) return 'string';
    if (/^true|false$/.test(value)) return 'bool';
    if (/^'/.test(value)) return 'principal';
    if (/^\{/.test(value)) return 'tuple';
    if (/^\(list/.test(value)) return 'list';
    return 'unknown';
}

function validateParameterValue(name: string, value: string): boolean {
    const nameUpper = name.toUpperCase();
    
    // Capacity validation
    if (nameUpper.includes('CAPACITY') || nameUpper.includes('MAX')) {
        const numValue = parseInt(value.replace(/^u/, ''));
        return numValue > 0 && numValue <= 1000000; // Reasonable capacity range
    }
    
    // Incentive score validation
    if (nameUpper.includes('INCENTIVE') || nameUpper.includes('SCORE')) {
        const numValue = parseInt(value.replace(/^u/, ''));
        return numValue > 0 && numValue <= 1000000; // Reasonable incentive range
    }
    
    // Rate validation
    if (nameUpper.includes('RATE')) {
        const numValue = parseInt(value.replace(/^u/, ''));
        return numValue >= 0 && numValue <= 100000; // Reasonable rate range
    }
    
    // Block time validation
    if (nameUpper.includes('BLOCK') && nameUpper.includes('TIME')) {
        const numValue = parseInt(value.replace(/^u/, ''));
        return numValue >= 60 && numValue <= 3600; // 1 minute to 1 hour
    }
    
    // Default to true for unrecognized parameters
    return true;
}

function getParameterValidationNote(name: string, value: string): string {
    const nameUpper = name.toUpperCase();
    const numValue = parseInt(value.replace(/^u/, ''));
    
    if (nameUpper.includes('CAPACITY') && (numValue <= 0 || numValue > 1000000)) {
        return `Capacity value ${numValue} seems unreasonable (expected 1-1000000)`;
    }
    
    if (nameUpper.includes('INCENTIVE') && (numValue <= 0 || numValue > 1000000)) {
        return `Incentive score ${numValue} seems unreasonable (expected 1-1000000)`;
    }
    
    if (nameUpper.includes('RATE') && (numValue < 0 || numValue > 100000)) {
        return `Rate value ${numValue} seems unreasonable (expected 0-100000)`;
    }
    
    return 'Parameter value outside expected range';
}

async function performConsistencyChecks(contractId: string, functionTests: FunctionTestResult[]): Promise<boolean> { let consistencyIssues = 0;
    
    // Check if basic functions return reasonable values
    const balanceTest = functionTests.find(t => t.functionName === 'get-balance' && t.success);
    const total_supplyTest = functionTests.find(t => t.functionName === 'get-total-supply' && t.success);
    const energyTest = functionTests.find(t => t.functionName === 'get-energy' && t.success);
    
    // Validate balance is not negative
    if (balanceTest && balanceTest.result && balanceTest.result < 0) {
        consistencyIssues++;
    }
    
    // Validate total supply is positive
    if (totalSupplyTest && totalSupplyTest.result && totalSupplyTest.result <= 0) {
        consistencyIssues++;
    }
    
    // Validate energy is not negative
    if (energyTest && energyTest.result && energyTest.result < 0) {
        consistencyIssues++;
    }
    
    // Check response times are reasonable (< 5 seconds)
    const slowTests = functionTests.filter(t => t.responseTime && t.responseTime > 5000);
    if (slowTests.length > 0) {
        consistencyIssues++;
    }
    
    return consistencyIssues === 0;
}

function determineOverallHealth(check: DataIntegrityCheck): 'healthy' | 'warning' | 'critical' {
    const { checks, issues, functionTests } = check;
    
    // Critical if contract not accessible
    if (!checks.contractAccessible) {
        return 'critical';
    }
    
    // Critical if no functions work
    if (!checks.functionsCallable) {
        return 'critical';
    }
    
    // Warning if data consistency issues or unreasonable parameters
    if (!checks.dataConsistent || !checks.parametersValid) {
        return 'warning';
    }
    
    // Warning if there are any issues
    if (issues.length > 0) {
        return 'warning';
    }
    
    // Warning if less than 50% of function tests pass
    const successRate = functionTests.filter(t => t.success).length / functionTests.length;
    if (successRate < 0.5) {
        return 'warning';
    }
    
    return 'healthy';
}

function generateIntegrityReport(results: DataIntegrityCheck[]) {
    console.log('🔬 ENERGY DATA INTEGRITY REPORT');
    console.log(''.padEnd(50, '='));
    console.log('');
    
    const totalContracts = results.length;
    const healthyContracts = results.filter(r => r.overallHealth === 'healthy').length;
    const warningContracts = results.filter(r => r.overallHealth === 'warning').length;
    const criticalContracts = results.filter(r => r.overallHealth === 'critical').length;
    
    console.log('📊 Health Summary:');
    console.log(`  Total contracts tested: ${totalContracts}`);
    console.log(`  🟢 Healthy: ${healthyContracts} (${Math.round(healthyContracts/totalContracts*100)}%)`);
    console.log(`  🟡 Warning: ${warningContracts} (${Math.round(warningContracts/totalContracts*100)}%)`);
    console.log(`  🔴 Critical: ${criticalContracts} (${Math.round(criticalContracts/totalContracts*100)}%)`);
    console.log('');
    
    // Function success rate analysis
    const allFunctionTests = results.flatMap(r => r.functionTests);
    const successfulFunctions = allFunctionTests.filter(t => t.success).length;
    const totalFunctionTests = allFunctionTests.length;
    
    console.log('🔧 Function Testing:');
    console.log(`  Total function tests: ${totalFunctionTests}`);
    console.log(`  Successful calls: ${successfulFunctions} (${Math.round(successfulFunctions/totalFunctionTests*100)}%)`);
    console.log('');
    
    // Performance analysis
    const testsWithTiming = allFunctionTests.filter(t => t.responseTime);
    if (testsWithTiming.length > 0) {
        const avgResponseTime = testsWithTiming.reduce((sum, t) => sum + (t.responseTime || 0), 0) / testsWithTiming.length;
        const slowTests = testsWithTiming.filter(t => (t.responseTime || 0) > 2000).length;
        
        console.log('⚡ Performance Metrics:');
        console.log(`  Average response time: ${Math.round(avgResponseTime)}ms`);
        console.log(`  Slow responses (>2s): ${slowTests}/${testsWithTiming.length}`);
        console.log('');
    }
    
    // Parameter validation summary
    const allParameters = results.flatMap(r => r.parameterValues);
    const validParameters = allParameters.filter(p => p.isReasonable).length;
    const totalParameters = allParameters.length;
    
    if (totalParameters > 0) {
        console.log('🎛️ Parameter Validation:');
        console.log(`  Total parameters found: ${totalParameters}`);
        console.log(`  Reasonable values: ${validParameters} (${Math.round(validParameters/totalParameters*100)}%)`);
        console.log('');
    }
    
    // Individual contract details
    console.log('📋 Individual Contract Health:');
    results.forEach(result => {
        const healthIcon = result.overallHealth === 'healthy' ? '🟢' : 
                          result.overallHealth === 'warning' ? '🟡' : '🔴';
        
        console.log(`  ${healthIcon} ${result.contractId}`);
        console.log(`     Name: ${result.name}`);
        console.log(`     Function tests: ${result.functionTests.filter(t => t.success).length}/${result.functionTests.length} passed`);
        
        if (result.parameterValues.length > 0) {
            console.log(`     Parameters: ${result.parameterValues.filter(p => p.isReasonable).length}/${result.parameterValues.length} valid`);
        }
        
        if (result.issues.length > 0) {
            console.log(`     Issues: ${result.issues.join(', ')}`);
        }
        console.log('');
    });
    
    // Recommendations
    console.log('💡 Recommendations:');
    if (criticalContracts > 0) {
        console.log(`  - Investigate ${criticalContracts} critical contract(s) immediately`);
    }
    if (warningContracts > 0) {
        console.log(`  - Review ${warningContracts} contract(s) with warnings`);
    }
    if (successfulFunctions / totalFunctionTests < 0.8) {
        console.log('  - Function success rate is low - check contract interfaces');
    }
    if (totalParameters > 0 && validParameters / totalParameters < 0.9) {
        console.log('  - Some parameter values seem unreasonable - review contract configuration');
    }
    
    console.log('');
    console.log('✨ Energy data integrity validation complete!');
}

// Run the validation
validateEnergyDataIntegrity().catch(console.error);