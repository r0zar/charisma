// Deep analysis of the status-effects-v0 contract and its dependencies
import { getContractInfo, callReadOnlyFunction } from '@repo/polyglot';

async function analyzeStatusEffectsContract() {
    console.log('🔍 Deep Analysis: Status Effects System');
    console.log('='.repeat(80));

    const statusEffectsId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.status-effects-v0';

    try {
        console.log('📋 Fetching status-effects-v0 contract...');
        const contractInfo = await getContractInfo(statusEffectsId);
        
        console.log('✅ Contract Info:');
        console.log(`   Block Height: ${contractInfo.block_height}`);
        console.log(`   Tx ID: ${contractInfo.tx_id}`);
        console.log(`   Source Lines: ${contractInfo.source_code?.split('\n').length}`);
        
        // Extract and analyze the source code
        if (contractInfo.source_code) {
            console.log('\n📜 Analyzing Source Code...');
            const sourceLines = contractInfo.source_code.split('\n');
            
            // Find all function definitions
            const functions = sourceLines.filter(line => 
                line.trim().startsWith('(define-public') || 
                line.trim().startsWith('(define-read-only')
            );
            
            console.log(`\n🔧 Functions Found (${functions.length}):`);
            functions.forEach(line => {
                const trimmed = line.trim();
                const isReadOnly = trimmed.startsWith('(define-read-only');
                const access = isReadOnly ? '🔍 read-only' : '✏️  public';
                
                // Extract function name
                const match = trimmed.match(/\(define-(?:public|read-only)\s+\(([^)\s]+)/);
                if (match) {
                    console.log(`   ${access} ${match[1]}`);
                }
            });
            
            // Find contract calls to understand dependencies
            console.log('\n🔗 Contract Dependencies:');
            const contractCalls = sourceLines.filter(line => 
                line.includes('contract-call?') && line.includes('.')
            );
            
            const dependencies = new Set();
            contractCalls.forEach(line => {
                // Extract contract references like .contract-name
                const matches = line.match(/\.([a-zA-Z0-9-]+)/g);
                if (matches) {
                    matches.forEach(match => {
                        if (!match.startsWith('.status-effects')) { // Exclude self-references
                            dependencies.add(match.substring(1)); // Remove the dot
                        }
                    });
                }
            });
            
            console.log(`   Dependencies found: ${dependencies.size}`);
            Array.from(dependencies).forEach(dep => {
                console.log(`   📦 .${dep}`);
            });
            
            // Look for modification functions specifically
            console.log('\n⚡ Modification Functions:');
            const modifyFunctions = sourceLines.filter(line => 
                line.includes('modify-') && (
                    line.includes('reward') || 
                    line.includes('punish') || 
                    line.includes('energize') || 
                    line.includes('exhaust') ||
                    line.includes('transfer') ||
                    line.includes('mint') ||
                    line.includes('burn') ||
                    line.includes('lock') ||
                    line.includes('unlock')
                )
            );
            
            modifyFunctions.forEach(line => {
                console.log(`   🔧 ${line.trim()}`);
            });
            
            // Look for data structures and maps
            console.log('\n🗄️  Data Structures:');
            const dataMaps = sourceLines.filter(line => 
                line.trim().startsWith('(define-map') ||
                line.trim().startsWith('(define-data-var')
            );
            
            dataMaps.forEach(line => {
                console.log(`   📊 ${line.trim()}`);
            });
            
            // Look for constants and configuration
            console.log('\n⚙️  Constants & Configuration:');
            const constants = sourceLines.filter(line => 
                line.trim().startsWith('(define-constant')
            );
            
            constants.forEach(line => {
                console.log(`   🔒 ${line.trim()}`);
            });
            
            // Extract key comments and documentation
            console.log('\n📝 Key Documentation:');
            const docLines = sourceLines.filter(line => 
                line.trim().startsWith(';;') && 
                line.length > 5 && 
                !line.includes('---') &&
                (line.toLowerCase().includes('status') || 
                 line.toLowerCase().includes('effect') ||
                 line.toLowerCase().includes('modif') ||
                 line.toLowerCase().includes('middleware'))
            ).slice(0, 10); // First 10 relevant doc lines
            
            docLines.forEach(line => {
                console.log(`   📄 ${line.trim()}`);
            });
            
        }
        
        // Now let's analyze the dependencies we found
        console.log('\n' + '='.repeat(80));
        console.log('🔍 ANALYZING STATUS EFFECTS DEPENDENCIES');
        console.log('='.repeat(80));
        
        // Check if the dependencies we found actually exist
        const potentialDeps = [
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.achievement-system',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nft-effects',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.boost-manager',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.seasonal-effects',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.condition-checker'
        ];
        
        for (const depId of potentialDeps) {
            try {
                console.log(`\n🔍 Checking: ${depId}`);
                const depInfo = await getContractInfo(depId);
                console.log(`✅ EXISTS - Block: ${depInfo.block_height}, Lines: ${depInfo.source_code?.split('\n').length}`);
                
                // Quick analysis of dependency
                if (depInfo.source_code) {
                    const depLines = depInfo.source_code.split('\n');
                    const depFunctions = depLines.filter(line => 
                        line.trim().startsWith('(define-public') || 
                        line.trim().startsWith('(define-read-only')
                    );
                    console.log(`   📋 Functions: ${depFunctions.length}`);
                    
                    // Show first few functions
                    depFunctions.slice(0, 3).forEach(line => {
                        const match = line.trim().match(/\(define-(?:public|read-only)\s+\(([^)\s]+)/);
                        if (match) {
                            console.log(`   🔧 ${match[1]}`);
                        }
                    });
                }
                
                // Small delay to be respectful to API
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`❌ NOT FOUND: ${depId}`);
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('📊 STATUS EFFECTS ANALYSIS COMPLETE');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.log(`❌ Error analyzing status effects: ${error}`);
    }
}

// Run the analysis
analyzeStatusEffectsContract().catch(console.error);