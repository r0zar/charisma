// Sync energy vault data with live contract information and detect mismatches
import { getContractInfo, callReadOnlyFunction } from '@repo/polyglot';
import { getAllVaultData } from '../src/lib/pool-service';
import { analyzeContract } from '../src/lib/contract-analysis';
import { uintCV, optionalCVOf, bufferCVFromString } from '@stacks/transactions';

interface DataMismatch {
    field: string;
    vaultValue: any;
    contractValue: any;
    severity: 'critical' | 'warning' | 'info';
    impact: string;
}

interface VaultSyncResult {
    vaultId: string;
    vaultName: string;
    contractId: string;
    isAccessible: boolean;
    lastChecked: string;
    mismatches: DataMismatch[];
    contractData: {
        exists: boolean;
        blockHeight?: number;
        clarityVersion?: number;
        sourceLength?: number;
        quoteWorking?: boolean;
        tokenUriWorking?: boolean;
    };
    recommendations: string[];
}

async function syncEnergyVaultData() {
    console.log('🔄 Syncing Energy Vault Data with Live Contracts');
    console.log('');

    try {
        // Get all energy vaults
        console.log('📊 Fetching energy vault configurations...');
        const energyVaults = await getAllVaultData({ type: 'ENERGY' });
        
        if (energyVaults.length === 0) {
            console.log('❌ No energy vaults found in configuration');
            return;
        }

        console.log(`📋 Found ${energyVaults.length} energy vault(s) to sync`);
        console.log('');

        const syncResults: VaultSyncResult[] = [];

        for (const vault of energyVaults) {
            console.log(`🔍 Syncing vault: ${vault.name} (${vault.contractId})`);
            
            const syncResult: VaultSyncResult = {
                vaultId: vault.contractId,
                vaultName: vault.name,
                contractId: vault.contractId,
                isAccessible: false,
                lastChecked: new Date().toISOString(),
                mismatches: [],
                contractData: {
                    exists: false
                },
                recommendations: []
            };

            try {
                // 1. Check if contract exists and is accessible
                console.log('  📡 Checking contract accessibility...');
                const contractInfo = await getContractInfo(vault.contractId);
                
                if (!contractInfo) {
                    console.log('  ❌ Contract not found on blockchain');
                    syncResult.contractData.exists = false;
                    syncResult.mismatches.push({
                        field: 'contract_existence',
                        vaultValue: 'exists',
                        contractValue: 'not_found',
                        severity: 'critical',
                        impact: 'Vault references a non-existent contract'
                    });
                } else {
                    console.log('  ✅ Contract found and accessible');
                    syncResult.isAccessible = true;
                    syncResult.contractData = {
                        exists: true,
                        blockHeight: contractInfo.block_height,
                        clarityVersion: contractInfo.clarity_version,
                        sourceLength: contractInfo.source_code.length
                    };

                    // 2. Test contract functions
                    console.log('  🧪 Testing contract functions...');
                    const functionResults = await testContractFunctions(vault.contractId);
                    syncResult.contractData.quoteWorking = functionResults.quoteWorking;
                    syncResult.contractData.tokenUriWorking = functionResults.tokenUriWorking;

                    // 3. Analyze contract and compare with vault config
                    console.log('  🔬 Analyzing contract relationships...');
                    const contractAnalysis = await analyzeContract(vault.contractId);
                    
                    if (contractAnalysis) {
                        await compareVaultWithContract(vault, contractAnalysis, syncResult);
                    }

                    // 4. Generate recommendations
                    generateRecommendations(vault, syncResult);
                }

                console.log(`  📊 Found ${syncResult.mismatches.length} data mismatches`);
                console.log(`  💡 Generated ${syncResult.recommendations.length} recommendations`);

            } catch (error) {
                console.log(`  ❌ Error syncing vault: ${error}`);
                syncResult.recommendations.push(`Error during sync: ${error}`);
            }

            syncResults.push(syncResult);
            console.log('');
        }

        // Generate comprehensive sync report
        generateSyncReport(syncResults);

    } catch (error) {
        console.error('❌ Error during energy vault data sync:', error);
        process.exit(1);
    }
}

async function testContractFunctions(contractId: string): Promise<{
    quoteWorking: boolean;
    tokenUriWorking: boolean;
}> {
    const [contractAddress, contractName] = contractId.split('.');
    const results = {
        quoteWorking: false,
        tokenUriWorking: false
    };

    try {
        // Test quote function
        const quoteResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'quote',
            [uintCV(0), optionalCVOf(bufferCVFromString('07'))]
        );
        results.quoteWorking = quoteResult !== null;
    } catch (error) {
        console.log(`    ⚠️ Quote function failed: ${error}`);
    }

    try {
        // Test get-token-uri function
        const uriResult = await callReadOnlyFunction(
            contractAddress,
            contractName,
            'get-token-uri',
            []
        );
        results.tokenUriWorking = uriResult !== null;
    } catch (error) {
        console.log(`    ⚠️ Token URI function failed: ${error}`);
    }

    return results;
}

async function compareVaultWithContract(
    vault: any, 
    contractAnalysis: any, 
    syncResult: VaultSyncResult
): Promise<void> {
    
    // Check if vault's engine contract matches what's in the source code
    const engineFromSource = contractAnalysis.relationships.find((rel: any) => 
        rel.relationshipType === 'contract-call' && rel.targetContract.includes('hold-to-earn')
    );

    if (vault.engineContractId && engineFromSource) {
        if (vault.engineContractId !== engineFromSource.targetContract) {
            syncResult.mismatches.push({
                field: 'engine_contract',
                vaultValue: vault.engineContractId,
                contractValue: engineFromSource.targetContract,
                severity: 'warning',
                impact: 'Vault config engine differs from contract source code'
            });
        }
    } else if (vault.engineContractId && !engineFromSource) {
        syncResult.mismatches.push({
            field: 'engine_contract',
            vaultValue: vault.engineContractId,
            contractValue: 'not_found_in_source',
            severity: 'warning',
            impact: 'Vault specifies engine but contract source does not reference it'
        });
    }

    // Check trait implementation
    const traitFromSource = contractAnalysis.traits.find((trait: string) => 
        trait.includes('liquidity-pool-trait')
    );

    if (vault.protocol === 'CHARISMA' && !traitFromSource) {
        syncResult.mismatches.push({
            field: 'trait_implementation',
            vaultValue: 'expected_liquidity_pool_trait',
            contractValue: 'no_trait_found',
            severity: 'info',
            impact: 'Charisma protocol vault should implement liquidity-pool-trait'
        });
    }

    // Check contract type classification
    if (contractAnalysis.contractType !== 'energize-vault') {
        syncResult.mismatches.push({
            field: 'contract_type',
            vaultValue: 'energy_vault',
            contractValue: contractAnalysis.contractType,
            severity: 'warning',
            impact: 'Contract type classification does not match energy vault expectations'
        });
    }

    // Check if base token appears in contract relationships
    if (vault.base) {
        const baseTokenInRelationships = contractAnalysis.relationships.some((rel: any) => 
            rel.targetContract === vault.base
        );

        if (!baseTokenInRelationships) {
            syncResult.mismatches.push({
                field: 'base_token',
                vaultValue: vault.base,
                contractValue: 'not_referenced_in_source',
                severity: 'info',
                impact: 'Base token not explicitly referenced in contract source code'
            });
        }
    }
}

function generateRecommendations(vault: any, syncResult: VaultSyncResult): void {
    const recommendations: string[] = [];

    // Critical issues
    const criticalMismatches = syncResult.mismatches.filter(m => m.severity === 'critical');
    if (criticalMismatches.length > 0) {
        recommendations.push('🔴 URGENT: Resolve critical contract accessibility issues');
    }

    // Function failures
    if (!syncResult.contractData.quoteWorking) {
        recommendations.push('⚠️ Fix quote function - essential for price discovery');
    }

    if (!syncResult.contractData.tokenUriWorking) {
        recommendations.push('⚠️ Fix get-token-uri function - needed for metadata');
    }

    // Engine contract mismatches
    const engineMismatch = syncResult.mismatches.find(m => m.field === 'engine_contract');
    if (engineMismatch) {
        recommendations.push('🔧 Update vault config or contract to align engine references');
    }

    // Trait implementation
    const traitMismatch = syncResult.mismatches.find(m => m.field === 'trait_implementation');
    if (traitMismatch) {
        recommendations.push('💡 Consider implementing liquidity-pool-trait for standardization');
    }

    // General health
    if (syncResult.mismatches.length === 0 && syncResult.contractData.quoteWorking && syncResult.contractData.tokenUriWorking) {
        recommendations.push('✅ Vault data is well-synchronized with contract');
    }

    // Performance recommendations
    if (vault.protocol === 'CHARISMA' && syncResult.contractData.clarityVersion && syncResult.contractData.clarityVersion < 3) {
        recommendations.push('⬆️ Consider upgrading to Clarity version 3 for better performance');
    }

    syncResult.recommendations = recommendations;
}

function generateSyncReport(syncResults: VaultSyncResult[]) {
    console.log('📊 ENERGY VAULT DATA SYNC REPORT');
    console.log(''.padEnd(50, '='));
    console.log('');

    const totalVaults = syncResults.length;
    const accessibleVaults = syncResults.filter(r => r.isAccessible).length;
    const vaultsWithMismatches = syncResults.filter(r => r.mismatches.length > 0).length;
    const totalMismatches = syncResults.reduce((sum, r) => sum + r.mismatches.length, 0);

    console.log('📈 Sync Summary:');
    console.log(`  Total vaults: ${totalVaults}`);
    console.log(`  Accessible contracts: ${accessibleVaults}/${totalVaults} (${Math.round(accessibleVaults/totalVaults*100)}%)`);
    console.log(`  Vaults with mismatches: ${vaultsWithMismatches}/${totalVaults}`);
    console.log(`  Total data mismatches: ${totalMismatches}`);
    console.log('');

    // Function health
    const workingQuote = syncResults.filter(r => r.contractData.quoteWorking).length;
    const workingUri = syncResults.filter(r => r.contractData.tokenUriWorking).length;
    
    console.log('🔧 Function Health:');
    console.log(`  Quote function working: ${workingQuote}/${accessibleVaults}`);
    console.log(`  Token URI function working: ${workingUri}/${accessibleVaults}`);
    console.log('');

    // Mismatch analysis
    if (totalMismatches > 0) {
        console.log('⚠️ Data Mismatches by Severity:');
        const severityCount = syncResults.flatMap(r => r.mismatches).reduce((acc, mismatch) => {
            acc[mismatch.severity] = (acc[mismatch.severity] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(severityCount).forEach(([severity, count]) => {
            const icon = severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
            console.log(`  ${icon} ${severity}: ${count}`);
        });
        console.log('');
    }

    // Individual vault reports
    console.log('📋 Individual Vault Status:');
    syncResults.forEach(result => {
        const statusIcon = !result.isAccessible ? '🔴' : 
                          result.mismatches.filter(m => m.severity === 'critical').length > 0 ? '🔴' :
                          result.mismatches.length > 0 ? '🟡' : '✅';

        console.log(`  ${statusIcon} ${result.vaultName} (${result.contractId})`);
        
        if (result.contractData.exists) {
            console.log(`     Contract: Block ${result.contractData.blockHeight}, Clarity v${result.contractData.clarityVersion}`);
            console.log(`     Functions: quote=${result.contractData.quoteWorking ? '✅' : '❌'}, uri=${result.contractData.tokenUriWorking ? '✅' : '❌'}`);
        } else {
            console.log(`     Contract: ❌ Not found on blockchain`);
        }

        if (result.mismatches.length > 0) {
            console.log(`     Mismatches (${result.mismatches.length}):`);
            result.mismatches.forEach(mismatch => {
                const icon = mismatch.severity === 'critical' ? '🔴' : mismatch.severity === 'warning' ? '🟡' : '🔵';
                console.log(`       ${icon} ${mismatch.field}: ${mismatch.impact}`);
            });
        }

        if (result.recommendations.length > 0) {
            console.log(`     Top recommendations:`);
            result.recommendations.slice(0, 2).forEach(rec => {
                console.log(`       ${rec}`);
            });
        }
        console.log('');
    });

    // Overall recommendations
    console.log('💡 Priority Actions:');
    
    const criticalIssues = syncResults.filter(r => 
        r.mismatches.some(m => m.severity === 'critical') || !r.isAccessible
    );
    if (criticalIssues.length > 0) {
        console.log(`  🔴 ${criticalIssues.length} vault(s) need immediate attention`);
    }

    const functionIssues = syncResults.filter(r => 
        r.isAccessible && (!r.contractData.quoteWorking || !r.contractData.tokenUriWorking)
    );
    if (functionIssues.length > 0) {
        console.log(`  🔧 ${functionIssues.length} vault(s) have function issues`);
    }

    const configMismatches = syncResults.filter(r => 
        r.mismatches.some(m => m.field === 'engine_contract')
    );
    if (configMismatches.length > 0) {
        console.log(`  📝 ${configMismatches.length} vault(s) have configuration mismatches`);
    }

    if (totalMismatches === 0 && accessibleVaults === totalVaults) {
        console.log('  ✅ All vaults are properly synchronized!');
    }

    console.log('');
    console.log(`🕐 Sync completed at: ${new Date().toISOString()}`);
    console.log('✨ Energy vault data sync complete!');
}

// Run the sync
syncEnergyVaultData().catch(console.error);