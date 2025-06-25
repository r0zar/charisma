// Inspect energetic-welsh contract source code directly
import { getContractInfo } from '@repo/polyglot';

async function inspectEnergeticWelshContract() {
    console.log('🔍 Inspecting Energetic Welsh Contract Source Code');
    console.log('='.repeat(80));

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energetic-welsh';
    
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
            
            console.log('\n🎯 ANALYZING FOR BONUS LIMITS...');
            console.log('-'.repeat(50));
            
            // Look for define-constant declarations
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
            
            // Look for any max/limit related lines
            const limitLines = sourceLines.filter((line, idx) => 
                line.toLowerCase().includes('max') ||
                line.toLowerCase().includes('limit') ||
                line.toLowerCase().includes('cap') ||
                line.includes('1000000') ||
                line.includes('100')
            );
            
            if (limitLines.length > 0) {
                console.log('\n🎯 LINES WITH LIMITS/CAPS/MAX:');
                limitLines.forEach((line, index) => {
                    const lineNum = sourceLines.indexOf(line) + 1;
                    console.log(`${lineNum}: ${line.trim()}`);
                });
            }
            
            // Look for the apply function specifically
            const applyFunctionStart = sourceLines.findIndex(line => 
                line.includes('define-read-only') && line.includes('apply')
            );
            
            if (applyFunctionStart !== -1) {
                console.log('\n📋 APPLY FUNCTION:');
                console.log('-'.repeat(30));
                // Show the apply function and surrounding context
                const startLine = Math.max(0, applyFunctionStart - 2);
                const endLine = Math.min(sourceLines.length, applyFunctionStart + 15);
                
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
inspectEnergeticWelshContract().catch(console.error);