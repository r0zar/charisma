#!/usr/bin/env tsx
// Script to fix totalSupply types - convert string numbers to actual numbers

interface FixResult {
    contractId: string;
    success: boolean;
    before: any;
    after: any;
    error?: string;
}

function analyzeSupplyType(totalSupply: any): { needsConversion: boolean; convertedValue?: number } {
    if (typeof totalSupply === 'string') {
        const numValue = Number(totalSupply);
        if (!isNaN(numValue) && isFinite(numValue)) {
            return { needsConversion: true, convertedValue: numValue };
        }
    }
    return { needsConversion: false };
}

async function fixTotalSupplyTypes(dryRun: boolean = true): Promise<void> {
    console.log('🔧 FIXING TOTAL SUPPLY TYPES');
    console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (will update KV store)'}`);
    console.log('Converting string numbers to actual numbers...');
    console.log('');
    
    try {
        // Import KV to check the store directly
        const { kv } = await import('@vercel/kv');
        
        // Scan for all metadata keys
        console.log('📥 Scanning KV store for metadata entries with string totalSupply...');
        
        let cursor = 0;
        let allKeys: string[] = [];
        
        // Get all metadata: keys
        do {
            const result = await kv.scan(cursor, { match: 'metadata:*', count: 1000 });
            const [nextCursor, batch] = result;
            allKeys.push(...batch);
            cursor = Number(nextCursor);
        } while (cursor !== 0);
        
        // Get all sip10: keys
        cursor = 0;
        do {
            const result = await kv.scan(cursor, { match: 'sip10:*', count: 1000 });
            const [nextCursor, batch] = result;
            allKeys.push(...batch);
            cursor = Number(nextCursor);
        } while (cursor !== 0);
        
        console.log(`✅ Found ${allKeys.length} total metadata keys`);
        console.log('');
        
        // Find tokens that need conversion
        const tokensNeedingFix: Array<{
            key: string;
            contractId: string;
            metadata: any;
            currentSupply: any;
            convertedSupply: number;
        }> = [];
        
        for (const key of allKeys) {
            try {
                const metadata = await kv.get(key);
                if (!metadata) continue;
                
                const contractId = key.replace(/^(metadata:|sip10:)/, '');
                const metadataObj = metadata as any;
                const totalSupply = metadataObj.totalSupply;
                
                const analysis = analyzeSupplyType(totalSupply);
                
                if (analysis.needsConversion && analysis.convertedValue !== undefined) {
                    tokensNeedingFix.push({
                        key,
                        contractId,
                        metadata: metadataObj,
                        currentSupply: totalSupply,
                        convertedSupply: analysis.convertedValue
                    });
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${key}:`, error);
            }
        }
        
        console.log('📊 CONVERSION SUMMARY');
        console.log('═'.repeat(80));
        console.log(`Total tokens scanned: ${allKeys.length}`);
        console.log(`Tokens needing conversion: ${tokensNeedingFix.length}`);
        console.log('');
        
        if (tokensNeedingFix.length === 0) {
            console.log('🎉 No tokens need totalSupply type conversion!');
            return;
        }
        
        // Show tokens that will be converted
        console.log('⚠️  TOKENS TO BE CONVERTED:');
        console.log('─'.repeat(80));
        
        tokensNeedingFix.forEach((token, index) => {
            console.log(`${index + 1}. ${token.metadata.name || 'Unknown'} (${token.metadata.symbol || 'Unknown'})`);
            console.log(`   Contract: ${token.contractId}`);
            console.log(`   Current: "${token.currentSupply}" (string)`);
            console.log(`   Will be: ${token.convertedSupply} (number)`);
            console.log('');
        });
        
        if (dryRun) {
            console.log('🔄 DRY RUN MODE - No actual updates will be made');
            console.log('To execute these conversions, run: pnpm script fix-total-supply-types live');
            return;
        }
        
        console.log('🚀 EXECUTING CONVERSIONS...');
        console.log('');
        
        const results: FixResult[] = [];
        
        for (const token of tokensNeedingFix) {
            try {
                console.log(`🔧 Converting ${token.metadata.name || 'Unknown'}...`);
                
                // Create updated metadata with number totalSupply
                const updatedMetadata = {
                    ...token.metadata,
                    totalSupply: token.convertedSupply,
                    lastUpdated: Date.now().toString()
                };
                
                // Store the updated metadata
                await kv.set(token.key, updatedMetadata);
                
                console.log(`  ✅ Converted: "${token.currentSupply}" → ${token.convertedSupply}`);
                
                results.push({
                    contractId: token.contractId,
                    success: true,
                    before: token.currentSupply,
                    after: token.convertedSupply
                });
                
            } catch (error: any) {
                console.log(`  ❌ Failed: ${error.message}`);
                
                results.push({
                    contractId: token.contractId,
                    success: false,
                    before: token.currentSupply,
                    after: token.convertedSupply,
                    error: error.message
                });
            }
            
            // Small delay between updates
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('');
        console.log('📊 CONVERSION RESULTS');
        console.log('═'.repeat(80));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`Total conversions attempted: ${results.length}`);
        console.log(`Successful conversions: ${successful.length}`);
        console.log(`Failed conversions: ${failed.length}`);
        console.log('');
        
        if (successful.length > 0) {
            console.log('✅ SUCCESSFUL CONVERSIONS:');
            console.log('─'.repeat(40));
            successful.forEach(result => {
                const token = tokensNeedingFix.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'}: "${result.before}" → ${result.after}`);
            });
            console.log('');
        }
        
        if (failed.length > 0) {
            console.log('❌ FAILED CONVERSIONS:');
            console.log('─'.repeat(40));
            failed.forEach(result => {
                const token = tokensNeedingFix.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'}: ${result.error}`);
            });
            console.log('');
        }
        
        if (successful.length > 0) {
            console.log('🎉 SUCCESS!');
            console.log(`Converted ${successful.length} tokens from string to number totalSupply!`);
            console.log('');
            console.log('All totalSupply values are now properly typed as numbers.');
        }
        
    } catch (error: any) {
        console.error('❌ Error fixing total supply types:', error.message);
        console.log('');
        console.log('Possible issues:');
        console.log('• KV store environment variables not configured');
        console.log('• Network connectivity issues');
        console.log('• Insufficient permissions');
    }
}

// Get command line arguments
const mode = process.argv[2] || 'dry-run';
const isLiveMode = mode === 'live';

if (isLiveMode) {
    console.log('⚠️  LIVE MODE - This will make actual updates to the KV store!');
    console.log('Press Ctrl+C to cancel if you want to review the plan first.');
    console.log('');
}

// Run the fix
fixTotalSupplyTypes(!isLiveMode).catch(console.error);