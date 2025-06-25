// Inspect energetic-corgi contract source code directly
import { getContractInfo } from '@repo/polyglot';

async function inspectEnergeticCorgiContract() {
    console.log('🔍 Inspecting Energetic Corgi Contract Source Code');
    console.log('='.repeat(80));

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-corgi';
    
    try {
        console.log(`📋 Getting contract info for: ${contractId}`);
        console.log('-'.repeat(60));
        
        const contractInfo = await getContractInfo(contractId);
        
        if (!contractInfo) {
            console.log('❌ Contract not found or failed to fetch');
            return;
        }
        
        console.log('✅ Contract found!');
        console.log(`📦 Contract ID: ${contractInfo.contract_id}`);
        console.log(`📝 Transaction ID: ${contractInfo.tx_id}`);
        console.log(`🧱 Block Height: ${contractInfo.block_height}`);
        
        if (contractInfo.source_code) {
            console.log('\n📋 CONTRACT SOURCE CODE:');
            console.log('='.repeat(80));
            console.log(contractInfo.source_code);
            console.log('='.repeat(80));
            
            // Look for limits, caps, or max values in the source
            const sourceLines = contractInfo.source_code.split('\n');
            const relevantLines = sourceLines.filter(line => 
                line.toLowerCase().includes('max') ||
                line.toLowerCase().includes('limit') ||
                line.toLowerCase().includes('cap') ||
                line.toLowerCase().includes('100') ||
                line.toLowerCase().includes('1000000')
            );
            
            if (relevantLines.length > 0) {
                console.log('\n🎯 LINES CONTAINING LIMITS/CAPS:');
                console.log('-'.repeat(40));
                relevantLines.forEach((line, index) => {
                    const lineNum = sourceLines.indexOf(line) + 1;
                    console.log(`${lineNum}: ${line.trim()}`);
                });
            }
            
            // Look for define-constant or define-data-var declarations
            const constants = sourceLines.filter(line => 
                line.trim().startsWith('(define-constant') ||
                line.trim().startsWith('(define-data-var')
            );
            
            if (constants.length > 0) {
                console.log('\n📊 CONSTANTS AND VARIABLES:');
                console.log('-'.repeat(40));
                constants.forEach((line, index) => {
                    const lineNum = sourceLines.indexOf(line) + 1;
                    console.log(`${lineNum}: ${line.trim()}`);
                });
            }
            
        } else {
            console.log('❌ No source code available');
        }
        
        // Also try to get ABI info
        if (contractInfo.abi) {
            console.log('\n📋 CONTRACT ABI:');
            console.log('-'.repeat(40));
            console.log(JSON.stringify(contractInfo.abi, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error inspecting contract:', error);
        
        // Try alternative contract names
        const alternativeNames = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-corgi',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-welsh',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.status-effects-v0'
        ];
        
        console.log('\n🔄 Trying alternative contract names...');
        for (const altName of alternativeNames) {
            try {
                console.log(`\n📋 Trying: ${altName}`);
                const altInfo = await getContractInfo(altName);
                if (altInfo) {
                    console.log(`✅ Found contract: ${altName}`);
                    if (altInfo.source_code) {
                        console.log('📝 Has source code available');
                        // Look for energetic-corgi references
                        if (altInfo.source_code.includes('energetic-corgi') || 
                            altInfo.source_code.includes('corgi')) {
                            console.log('🎯 Contains corgi references!');
                            console.log('\nRelevant sections:');
                            const lines = altInfo.source_code.split('\n');
                            lines.forEach((line, idx) => {
                                if (line.toLowerCase().includes('corgi')) {
                                    console.log(`${idx + 1}: ${line.trim()}`);
                                }
                            });
                        }
                    }
                }
            } catch (altError) {
                console.log(`❌ ${altName}: Not found`);
            }
        }
    }
}

// Run the inspection
inspectEnergeticCorgiContract().catch(console.error);