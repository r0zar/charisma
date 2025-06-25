// Inspect power-cells contract source code directly
import { getContractInfo } from '@repo/polyglot';

async function inspectPowerCellsContract() {
    console.log('🔍 Inspecting Power Cells Contract Source Code');
    console.log('='.repeat(80));

    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.power-cells';
    
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
            
            // Analyze for capacity logic
            const sourceLines = contractInfo.source_code.split('\n');
            
            console.log('\n🎯 ANALYZING FOR CAPACITY BONUS LOGIC...');
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
            
            // Look for data variables
            const dataVars = sourceLines.filter(line => 
                line.trim().startsWith('(define-data-var')
            );
            
            if (dataVars.length > 0) {
                console.log('\n📊 DATA VARIABLES:');
                dataVars.forEach((line, index) => {
                    const lineNum = sourceLines.indexOf(line) + 1;
                    console.log(`${lineNum}: ${line.trim()}`);
                });
            }
            
            // Look for get-max-capacity function
            const capacityFunctionStart = sourceLines.findIndex(line => 
                line.includes('get-max-capacity') || line.includes('get-user-capacity')
            );
            
            if (capacityFunctionStart !== -1) {
                console.log('\n📋 CAPACITY FUNCTION:');
                console.log('-'.repeat(30));
                const startLine = Math.max(0, capacityFunctionStart - 2);
                const endLine = Math.min(sourceLines.length, capacityFunctionStart + 15);
                
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
inspectPowerCellsContract().catch(console.error);