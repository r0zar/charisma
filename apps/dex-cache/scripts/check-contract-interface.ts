// Check contract interface to identify read-only functions
import { getContractInterface, getContractInfo } from '@repo/polyglot';

async function checkContractInterface() {
    console.log('🔍 Checking Contract Interfaces for Read-Only Functions');
    console.log('');
    
    const contracts = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1',
        'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn'
    ];
    
    for (const contractId of contracts) {
        console.log(`📋 Analyzing: ${contractId}`);
        
        try {
            const [contractAddress, contractName] = contractId.split('.');
            
            // Get contract interface
            console.log('  Getting contract interface...');
            const contractInterface = await getContractInterface(contractAddress, contractName);
            
            if (contractInterface?.functions) {
                console.log(`  📊 Found ${contractInterface.functions.length} functions:`);
                
                // Type assertion to access function properties
                const functions = contractInterface.functions as Array<{
                    name: string;
                    access: string;
                    args: Array<{ name: string; type: string }>;
                    outputs: { type: string };
                }>;
                
                const readOnlyFunctions = functions.filter(f => f.access === 'read_only');
                const publicFunctions = functions.filter(f => f.access === 'public');
                const privateFunctions = functions.filter(f => f.access === 'private');
                
                console.log(`    🔍 Read-only functions (${readOnlyFunctions.length}):`);
                readOnlyFunctions.forEach(func => {
                    const argTypes = func.args.map(arg => `${arg.name}: ${arg.type}`).join(', ');
                    console.log(`      - ${func.name}(${argTypes}) -> ${func.outputs.type}`);
                });
                
                console.log(`    🔒 Public functions (${publicFunctions.length}) - require signatures:`);
                publicFunctions.slice(0, 5).forEach(func => {
                    const argTypes = func.args.map(arg => `${arg.name}: ${arg.type}`).join(', ');
                    console.log(`      - ${func.name}(${argTypes}) -> ${func.outputs.type}`);
                });
                if (publicFunctions.length > 5) {
                    console.log(`      ... and ${publicFunctions.length - 5} more public functions`);
                }
                
                if (privateFunctions.length > 0) {
                    console.log(`    🔐 Private functions (${privateFunctions.length}) - internal only`);
                }
            } else {
                console.log('  ❌ No function interface available');
            }
            
            // Also get source code for manual parsing
            console.log('  Getting source code for manual analysis...');
            const contractInfo = await getContractInfo(contractId);
            
            if (contractInfo?.source_code) {
                const sourceCode = contractInfo.source_code;
                
                // Parse read-only functions from source
                const readOnlyPattern = /define-read-only\s+\(([a-zA-Z0-9-]+)/g;
                const readOnlyFromSource: string[] = [];
                let match;
                while ((match = readOnlyPattern.exec(sourceCode)) !== null) {
                    readOnlyFromSource.push(match[1]);
                }
                
                if (readOnlyFromSource.length > 0) {
                    console.log(`  📄 Read-only functions from source (${readOnlyFromSource.length}):`);
                    readOnlyFromSource.forEach(func => {
                        console.log(`      - ${func}`);
                    });
                }
                
                // Parse public functions that might be testable without signatures
                const publicPattern = /define-public\s+\(([a-zA-Z0-9-]+)/g;
                const publicFromSource: string[] = [];
                while ((match = publicPattern.exec(sourceCode)) !== null) {
                    publicFromSource.push(match[1]);
                }
                
                if (publicFromSource.length > 0) {
                    console.log(`  ⚠️ Public functions (${publicFromSource.length}) - require wallet signature:`);
                    publicFromSource.forEach(func => {
                        console.log(`      - ${func}`);
                    });
                }
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error}`);
        }
        
        console.log('');
    }
    
    console.log('💡 Summary:');
    console.log('  - Only read-only functions can be called without wallet signatures');
    console.log('  - Public functions require wallet signatures and gas fees');
    console.log('  - Private functions are internal and cannot be called externally');
    console.log('');
    console.log('✨ Contract interface analysis complete!');
}

// Run the check
checkContractInterface().catch(console.error);