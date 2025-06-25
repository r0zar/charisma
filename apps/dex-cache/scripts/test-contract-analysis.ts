// Test the contract analysis library with real energy system contracts
import { 
    analyzeContract,
    discoverEnergySystemRelationships,
    getEnergySystemArchitecture,
    extractContractRelationships
} from '../src/lib/contract-analysis';

async function testContractAnalysis() {
    console.log('🔬 Testing Contract Analysis Library');
    console.log('');
    
    try {
        // Test 1: Analyze the energize vault contract
        console.log('📊 Analyzing Energize Vault Contract...');
        const energizeAnalysis = await analyzeContract('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1');
        
        if (energizeAnalysis) {
            console.log(`  ✅ Contract: ${energizeAnalysis.contractId}`);
            console.log(`  📋 Type: ${energizeAnalysis.contractType}`);
            console.log(`  ⚡ Is Energy Contract: ${energizeAnalysis.isEnergyContract}`);
            console.log(`  🔗 Relationships: ${energizeAnalysis.relationships.length}`);
            
            energizeAnalysis.relationships.forEach(rel => {
                console.log(`    - ${rel.relationshipType}: ${rel.targetContract}${rel.functionName ? ` (${rel.functionName})` : ''}`);
            });
            
            console.log(`  🎛️ Constants: ${Object.keys(energizeAnalysis.constants).length}`);
            Object.entries(energizeAnalysis.constants).forEach(([name, value]) => {
                console.log(`    - ${name}: ${value}`);
            });
            
            console.log(`  📋 Functions: ${energizeAnalysis.functions.length}`);
            energizeAnalysis.functions.forEach(func => {
                console.log(`    - ${func}`);
            });
            
            console.log(`  🎯 Traits: ${energizeAnalysis.traits.length}`);
            energizeAnalysis.traits.forEach(trait => {
                console.log(`    - ${trait}`);
            });
        } else {
            console.log('  ❌ Failed to analyze energize contract');
        }
        
        console.log('');
        
        // Test 2: Analyze the hold-to-earn engine contract
        console.log('🎯 Analyzing Hold-to-Earn Engine Contract...');
        const holdToEarnAnalysis = await analyzeContract('SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn');
        
        if (holdToEarnAnalysis) {
            console.log(`  ✅ Contract: ${holdToEarnAnalysis.contractId}`);
            console.log(`  📋 Type: ${holdToEarnAnalysis.contractType}`);
            console.log(`  ⚡ Is Energy Contract: ${holdToEarnAnalysis.isEnergyContract}`);
            console.log(`  🔗 Relationships: ${holdToEarnAnalysis.relationships.length}`);
            
            if (holdToEarnAnalysis.relationships.length > 0) {
                console.log('    Top 5 relationships:');
                holdToEarnAnalysis.relationships.slice(0, 5).forEach(rel => {
                    console.log(`    - ${rel.relationshipType}: ${rel.targetContract}${rel.functionName ? ` (${rel.functionName})` : ''}`);
                });
                if (holdToEarnAnalysis.relationships.length > 5) {
                    console.log(`    ... and ${holdToEarnAnalysis.relationships.length - 5} more`);
                }
            }
            
            console.log(`  🎛️ Constants: ${Object.keys(holdToEarnAnalysis.constants).length}`);
            
            // Show some key constants
            const keyConstants = Object.entries(holdToEarnAnalysis.constants)
                .filter(([name]) => name.includes('ERR') || name.includes('RATE') || name.includes('TIME'))
                .slice(0, 5);
            keyConstants.forEach(([name, value]) => {
                console.log(`    - ${name}: ${value}`);
            });
            
            console.log(`  📋 Functions: ${holdToEarnAnalysis.functions.length} (showing first 10)`);
            holdToEarnAnalysis.functions.slice(0, 10).forEach(func => {
                console.log(`    - ${func}`);
            });
        } else {
            console.log('  ❌ Failed to analyze hold-to-earn contract');
        }
        
        console.log('');
        
        // Test 3: Discover energy system relationships
        console.log('🔍 Discovering Energy System Relationships...');
        const vaultContracts = ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1'];
        const relationships = await discoverEnergySystemRelationships(vaultContracts);
        
        console.log(`  📊 Found ${relationships.length} energy system relationships`);
        relationships.forEach(rel => {
            const status = rel.isValid ? '✅' : '❌';
            console.log(`  ${status} Vault: ${rel.vaultContract}`);
            console.log(`     Engine: ${rel.engineContract}`);
            if (rel.baseToken) {
                console.log(`     Base Token: ${rel.baseToken}`);
            }
            if (rel.traitImplementation) {
                console.log(`     Trait: ${rel.traitImplementation}`);
            }
            if (rel.validationErrors.length > 0) {
                console.log(`     Errors: ${rel.validationErrors.join(', ')}`);
            }
        });
        
        console.log('');
        
        // Test 4: Get complete energy system architecture
        console.log('🏗️ Getting Complete Energy System Architecture...');
        const architecture = await getEnergySystemArchitecture();
        
        console.log(`  📊 Architecture Summary:`);
        console.log(`    Total Vaults: ${architecture.summary.totalVaults}`);
        console.log(`    Total Engines: ${architecture.summary.totalEngines}`);
        console.log(`    Valid Relationships: ${architecture.summary.validRelationships}`);
        console.log(`    Health Status: ${architecture.summary.healthStatus}`);
        
        console.log('  🗃️ Vault Details:');
        architecture.vaults.forEach(vault => {
            console.log(`    - ${vault.contractId} (${vault.contractType})`);
            console.log(`      Functions: ${vault.functions.length}, Relationships: ${vault.relationships.length}`);
        });
        
        console.log('  🎯 Engine Details:');
        architecture.engines.forEach(engine => {
            console.log(`    - ${engine.contractId} (${engine.contractType})`);
            console.log(`      Functions: ${engine.functions.length}, Relationships: ${engine.relationships.length}`);
        });
        
        console.log('');
        
        // Test 5: Test relationship extraction function directly
        console.log('🧪 Testing Relationship Extraction Function...');
        if (energizeAnalysis) {
            const directRelationships = extractContractRelationships(
                energizeAnalysis.contractId,
                energizeAnalysis.info.source_code
            );
            
            console.log(`  📋 Direct extraction found ${directRelationships.length} relationships:`);
            directRelationships.forEach(rel => {
                console.log(`    - ${rel.relationshipType}: ${rel.targetContract}`);
                console.log(`      Extracted from: ${rel.extractedFrom}`);
            });
        }
        
        console.log('');
        console.log('✨ Contract analysis testing complete!');
        
    } catch (error) {
        console.error('❌ Error during contract analysis testing:', error);
        process.exit(1);
    }
}

// Run the test
testContractAnalysis().catch(console.error);