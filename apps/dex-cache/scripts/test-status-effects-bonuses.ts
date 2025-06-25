// Test script to validate status effects bonus detection via read-only function calls
import { getContractInfo, callReadOnlyFunction } from '@repo/polyglot';
import { principalCV, uintCV, tupleCV } from '@stacks/transactions';

async function testStatusEffectBonuses() {
    console.log('🧪 Testing Status Effects Bonus Detection');
    console.log('='.repeat(80));

    const statusEffectsId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.status-effects-v0';
    
    // Test addresses - use deployer address and a few others
    const testAddresses = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', // Contract deployer
        'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ', // Another known address
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9'  // Random test address
    ];

    try {
        console.log('📋 Testing modify-energize function for bonus detection...\n');

        for (const testAddress of testAddresses) {
            console.log(`🔍 Testing address: ${testAddress}`);
            console.log('-'.repeat(50));

            try {
                // Test modify-energize function with proper tuple format
                console.log('  Testing modify-energize...');
                
                const energizeResult = await callReadOnlyFunction(
                    statusEffectsId,
                    'modify-energize',
                    [
                        tupleCV({
                            'amount': uintCV(1000000), // 1 energy with 6 decimals
                            'target': principalCV(testAddress),
                            'caller': principalCV(testAddress)
                        })
                    ]
                );

                console.log(`    ✅ modify-energize result:`, JSON.stringify(energizeResult, null, 2));

            } catch (error) {
                console.log(`    ❌ modify-energize failed:`, error.message);
            }

            try {
                // Test modify-transfer function for fee discounts with proper tuple format
                console.log('  Testing modify-transfer...');
                
                const transferResult = await callReadOnlyFunction(
                    statusEffectsId,
                    'modify-transfer',
                    [
                        tupleCV({
                            'amount': uintCV(1000000), // 1 token with 6 decimals
                            'sender': principalCV(testAddress),
                            'target': principalCV('SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ'),
                            'caller': principalCV(testAddress)
                        })
                    ]
                );

                console.log(`    ✅ modify-transfer result:`, JSON.stringify(transferResult, null, 2));

            } catch (error) {
                console.log(`    ❌ modify-transfer failed:`, error.message);
            }

            console.log(''); // Empty line between addresses
        }

        console.log('\n' + '='.repeat(80));
        console.log('🔍 Testing Individual Bonus Contracts');
        console.log('='.repeat(80));

        // Test individual bonus contracts
        const bonusContracts = [
            {
                name: 'Energetic Welsh',
                id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-welsh'
            },
            {
                name: 'Energetic Corgi',
                id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-corgi'
            },
            {
                name: 'Raven Wisdom', 
                id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.raven-wisdom'
            },
            {
                name: 'Power Cells',
                id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.power-cells'
            }
        ];

        for (const contract of bonusContracts) {
            console.log(`\n📦 Testing ${contract.name} (${contract.id})`);
            console.log('-'.repeat(60));

            try {
                // Get contract info to see available functions
                const contractInfo = await getContractInfo(contract.id);
                
                if (contractInfo.source_code) {
                    const sourceLines = contractInfo.source_code.split('\n');
                    const functions = sourceLines.filter(line => 
                        line.trim().startsWith('(define-public') || 
                        line.trim().startsWith('(define-read-only')
                    );

                    console.log(`  📋 Available functions (${functions.length}):`);
                    const functionNames: string[] = [];
                    
                    functions.forEach(line => {
                        // Improved regex to capture full function names and signatures
                        const match = line.trim().match(/\(define-(?:public|read-only)\s+\(([^)]+)\)/);
                        if (match) {
                            const isReadOnly = line.trim().startsWith('(define-read-only');
                            const fullSignature = match[1];
                            const functionName = fullSignature.split(/\s+/)[0]; // First word is function name
                            
                            console.log(`    ${isReadOnly ? '🔍' : '✏️'} ${fullSignature}`);
                            functionNames.push(functionName);
                        }
                    });

                    // Try to call discovered read-only functions
                    console.log(`\n  🧪 Testing discovered functions...`);
                    
                    for (const funcName of functionNames) {
                        // Only test read-only functions that likely take a principal parameter
                        const funcLine = functions.find(f => f.includes(funcName));
                        if (funcLine && funcLine.includes('define-read-only')) {
                            try {
                                console.log(`    Testing ${funcName}...`);
                                
                                // Try with principal parameter first
                                let result;
                                try {
                                    result = await callReadOnlyFunction(
                                        contract.id,
                                        funcName,
                                        [principalCV(testAddresses[0])]
                                    );
                                } catch (principalError) {
                                    // If principal fails, try with no parameters
                                    try {
                                        result = await callReadOnlyFunction(
                                            contract.id,
                                            funcName,
                                            []
                                        );
                                    } catch (noParamError) {
                                        console.log(`      ❌ ${funcName} failed: ${principalError.message}`);
                                        continue;
                                    }
                                }
                                
                                console.log(`      ✅ ${funcName} result:`, JSON.stringify(result, null, 2));
                                
                            } catch (error) {
                                console.log(`      ❌ ${funcName} failed:`, error.message);
                            }
                        }
                    }
                }

            } catch (error) {
                console.log(`  ❌ Failed to analyze ${contract.name}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('🎯 TESTING SPECIFIC BONUS FUNCTIONS');
        console.log('='.repeat(80));

        // Test specific known functions from our earlier analysis
        const specificTests = [
            {
                contract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.power-cells',
                function: 'get-user-capacity',
                params: [principalCV(testAddresses[0])],
                description: 'Get user energy capacity including Memobot bonuses'
            },
            {
                contract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.raven-wisdom',
                function: 'get-user-discount',
                params: [principalCV(testAddresses[0])],
                description: 'Get fee discount based on Raven NFT ownership'
            }
        ];

        for (const test of specificTests) {
            console.log(`\n🎯 ${test.description}`);
            console.log(`   Contract: ${test.contract}`);
            console.log(`   Function: ${test.function}`);
            
            try {
                const result = await callReadOnlyFunction(
                    test.contract,
                    test.function,
                    test.params
                );
                console.log(`   ✅ Result:`, JSON.stringify(result, null, 2));
            } catch (error) {
                console.log(`   ❌ Failed:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✨ STATUS EFFECTS BONUS TESTING COMPLETE');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Error during status effects testing:', error);
        process.exit(1);
    }
}

// Run the test
testStatusEffectBonuses().catch(console.error);