// General purpose contract inspector for any Stacks contract
import { getContractInfo, callReadOnlyFunction } from '@repo/polyglot';

interface ContractAnalysis {
    contractId: string;
    info?: any;
    functions?: string[];
    readOnlyResults?: Record<string, any>;
    error?: string;
}

async function inspectContract(contractId: string): Promise<ContractAnalysis> {
    console.log(`\n🔍 Inspecting Contract: ${contractId}`);
    console.log('='.repeat(80));

    const analysis: ContractAnalysis = { contractId };

    try {
        // Get contract info
        console.log('📋 Fetching contract information...');
        const contractInfo = await getContractInfo(contractId);
        analysis.info = contractInfo;
        
        console.log('✅ Contract Info:');
        console.log(`   Canonical: ${contractInfo.canonical}`);
        console.log(`   Block Height: ${contractInfo.block_height}`);
        console.log(`   Tx ID: ${contractInfo.tx_id}`);
        
        // Display contract source if available
        if (contractInfo.source_code) {
            const sourceLines = contractInfo.source_code.split('\n');
            const commentLines = sourceLines.filter(line => line.trim().startsWith(';;')).slice(0, 10);
            
            if (commentLines.length > 0) {
                console.log('\n📝 Contract Description (from comments):');
                commentLines.forEach(line => console.log(`   ${line.trim()}`));
            }
            
            console.log(`\n📜 Source Code: ${sourceLines.length} lines`);
            console.log('   (Full source code available in analysis object)');
        }
        
        // Parse ABI if available
        console.log('\n🔧 Contract ABI Analysis:');
        console.log(`   ABI available: ${!!contractInfo.abi}`);
        
        if (contractInfo.abi) {
            console.log(`   ABI keys: ${Object.keys(contractInfo.abi).join(', ')}`);
            
            if (contractInfo.abi.functions) {
                console.log(`\n📋 Functions (${contractInfo.abi.functions.length}):`);
                contractInfo.abi.functions.forEach((func: any) => {
                    const args = func.args.map((arg: any) => `${arg.name}: ${arg.type}`).join(', ');
                    const access = func.access === 'read_only' ? '🔍' : '✏️';
                    console.log(`   ${access} ${func.access} ${func.name}(${args}) -> ${func.outputs.type}`);
                });
                
                analysis.functions = contractInfo.abi.functions.map((f: any) => f.name);
            } else {
                console.log('\n📋 No functions found in ABI');
            }
        } else {
            console.log('\n📋 No ABI available - parsing source code for functions...');
            
            // Parse functions from source code
            if (contractInfo.source_code) {
                const sourceLines = contractInfo.source_code.split('\n');
                const functionLines = sourceLines.filter(line => 
                    line.trim().startsWith('(define-public') || 
                    line.trim().startsWith('(define-read-only')
                );
                
                if (functionLines.length > 0) {
                    console.log(`\n📋 Functions found in source code (${functionLines.length}):`);
                    functionLines.forEach(line => {
                        const trimmed = line.trim();
                        const isReadOnly = trimmed.startsWith('(define-read-only');
                        const access = isReadOnly ? '🔍' : '✏️';
                        
                        // Extract function name
                        const match = trimmed.match(/\(define-(?:public|read-only)\s+\(([^)\s]+)/);
                        if (match) {
                            console.log(`   ${access} ${isReadOnly ? 'read_only' : 'public'} ${match[1]}(...)`);
                        }
                    });
                    
                    analysis.functions = functionLines.map(line => {
                        const match = line.trim().match(/\(define-(?:public|read-only)\s+\(([^)\s]+)/);
                        return match ? match[1] : 'unknown';
                    }).filter(name => name !== 'unknown');
                }
            }
        }
        
        // Additional ABI sections (only if ABI is available)
        if (contractInfo.abi) {
            if (contractInfo.abi.variables) {
                console.log(`\n📊 Variables (${contractInfo.abi.variables.length}):`);
                contractInfo.abi.variables.forEach((variable: any) => {
                    console.log(`   ${variable.access} ${variable.name}: ${variable.type}`);
                });
            }
            
            if (contractInfo.abi.maps && contractInfo.abi.maps.length > 0) {
                console.log(`\n🗺️ Maps (${contractInfo.abi.maps.length}):`);
                contractInfo.abi.maps.forEach((map: any) => {
                    console.log(`   ${map.name}: ${map.key} -> ${map.value}`);
                });
            }
            
            if (contractInfo.abi.fungible_tokens && contractInfo.abi.fungible_tokens.length > 0) {
                console.log(`\n🪙 Fungible Tokens (${contractInfo.abi.fungible_tokens.length}):`);
                contractInfo.abi.fungible_tokens.forEach((token: any) => {
                    console.log(`   ${token.name}`);
                });
            }
            
            if (contractInfo.abi.non_fungible_tokens && contractInfo.abi.non_fungible_tokens.length > 0) {
                console.log(`\n🖼️ Non-Fungible Tokens (${contractInfo.abi.non_fungible_tokens.length}):`);
                contractInfo.abi.non_fungible_tokens.forEach((nft: any) => {
                    console.log(`   ${nft.name}: ${nft.type}`);
                });
            }
        }
        
        // Test common read-only functions
        const readOnlyFunctions = contractInfo.abi?.functions
            ?.filter((f: any) => f.access === 'read_only' && f.args.length === 0)
            ?.map((f: any) => f.name) || [];

        if (readOnlyFunctions.length > 0) {
            console.log(`\n🧪 Testing Read-Only Functions (${readOnlyFunctions.length}):`);
            analysis.readOnlyResults = {};
            
            for (const functionName of readOnlyFunctions.slice(0, 10)) { // Limit to first 10
                try {
                    const result = await callReadOnlyFunction(contractId, functionName, []);
                    analysis.readOnlyResults[functionName] = result;
                    
                    if (result && typeof result === 'object') {
                        console.log(`   ✅ ${functionName}: ${JSON.stringify(result).substring(0, 100)}${JSON.stringify(result).length > 100 ? '...' : ''}`);
                    } else {
                        console.log(`   ✅ ${functionName}: ${result}`);
                    }
                } catch (error) {
                    console.log(`   ❌ ${functionName}: Error calling function`);
                }
            }
            
            if (readOnlyFunctions.length > 10) {
                console.log(`   ... and ${readOnlyFunctions.length - 10} more functions`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Error inspecting contract: ${error}`);
        analysis.error = error instanceof Error ? error.message : String(error);
    }

    console.log('\n✨ Contract inspection complete!');
    return analysis;
}

async function inspectMultipleContracts(contractIds: string[]): Promise<ContractAnalysis[]> {
    console.log('🚀 General Purpose Contract Inspector');
    console.log(`📋 Analyzing ${contractIds.length} contracts...`);
    
    const results: ContractAnalysis[] = [];
    
    for (const contractId of contractIds) {
        const analysis = await inspectContract(contractId);
        results.push(analysis);
        
        // Small delay between contracts to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANALYSIS SUMMARY');
    console.log('='.repeat(80));
    
    results.forEach((analysis, index) => {
        console.log(`\n${index + 1}. ${analysis.contractId}`);
        if (analysis.error) {
            console.log(`   ❌ Error: ${analysis.error}`);
        } else {
            console.log(`   ✅ Functions: ${analysis.functions?.length || 0}`);
            console.log(`   🔍 Read-only tested: ${Object.keys(analysis.readOnlyResults || {}).length}`);
            if (analysis.info?.abi?.fungible_tokens?.length > 0) {
                console.log(`   🪙 Fungible tokens: ${analysis.info.abi.fungible_tokens.length}`);
            }
            if (analysis.info?.abi?.non_fungible_tokens?.length > 0) {
                console.log(`   🖼️ NFT tokens: ${analysis.info.abi.non_fungible_tokens.length}`);
            }
        }
    });
    
    return results;
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: pnpm script general-contract-inspector <contract-id> [contract-id2] [contract-id3] ...');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm script general-contract-inspector SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy');
    console.log('  pnpm script general-contract-inspector SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.experience');
    console.log('');
    console.log('Preset contract lists:');
    console.log('  --charisma-core: Core Charisma protocol contracts');
    console.log('  --energy-system: Energy-related contracts');
    console.log('  --gamefi: GameFi and interaction contracts');
    process.exit(1);
}

// Handle preset contract lists
let contractIds: string[] = [];

if (args[0] === '--charisma-core') {
    contractIds = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-rulebook-v0',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.experience',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.status-effects-v0',
        'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token'
    ];
} else if (args[0] === '--energy-system') {
    contractIds = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.initialize-energy',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1'
    ];
} else if (args[0] === '--gamefi') {
    contractIds = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.meme-engine-cha',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.meme-engine-iou-welsh',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.meme-engine-iou-roo',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.fatigue',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-mine',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.the-troll-toll',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.keepers-petition'
    ];
} else {
    contractIds = args;
}

// Run the inspection
inspectMultipleContracts(contractIds).catch(console.error);