// Inspect raven-wisdom contract source code directly
import { getContractInfo } from '@repo/polyglot';

async function inspectRavenWisdomContract() {
    console.log('🔍 Inspecting Raven Wisdom Contract Source Code');
    console.log('='.repeat(80));

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.raven-wisdom';
    
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
            
            // Analyze for bonus logic
            const sourceLines = contractInfo.source_code.split('\n');
            
            console.log('\n🎯 ANALYZING FOR RAVEN BONUS LOGIC...');
            console.log('-'.repeat(50));
            
            // Look for constants
            const constants = sourceLines.filter(line => 
                line.trim().startsWith('(define-constant')
            );
            
            if (constants.length > 0) {
                console.log('\n📊 CONSTANTS:');
                constants.forEach((line, index) => {
                    const lineNum = sourceLines.indexOf(line) + 1;
                    console.log(`${lineNum}: ${line.trim()}`);
                });
            }
            
            // Look for apply function
            const applyFunctionStart = sourceLines.findIndex(line => 
                line.includes('define-read-only') && line.includes('apply')
            );
            
            if (applyFunctionStart !== -1) {
                console.log('\n📋 APPLY FUNCTION:');
                console.log('-'.repeat(30));
                const startLine = Math.max(0, applyFunctionStart - 2);
                const endLine = Math.min(sourceLines.length, applyFunctionStart + 20);
                
                for (let i = startLine; i < endLine; i++) {
                    console.log(`${i + 1}: ${sourceLines[i]}`);
                }
            }
            
        } else {
            console.log('❌ No source code available');
        }
        
    } catch (error) {
        console.error('❌ Error inspecting contract:', error);
    }
}

// Run the inspection
inspectRavenWisdomContract().catch(console.error);