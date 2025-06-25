#!/usr/bin/env tsx
// Script to fix all total_supply field types in metadata store

interface FixResult {
    contractId: string;
    success: boolean;
    action: 'converted_string_to_number' | 'removed_old_field' | 'both_fixes' | 'no_change' | 'error';
    before: {
        total_supply?: any;
        total_supply_type?: string;
        had_totalSupply?: boolean;
    };
    after: {
        total_supply?: any;
        total_supply_type?: string;
    };
    error?: string;
}

function analyzeSupplyType(total_supply: any): { type: string; needsConversion: boolean; convertedValue?: number } {
    if (total_supply === null || total_supply === undefined) {
        return { type: 'null/undefined', needsConversion: false };
    }
    
    if (typeof total_supply === 'number') {
        return { type: 'number', needsConversion: false };
    }
    
    if (typeof total_supply === 'string') {
        // Check if it's a numeric string that should be converted
        const numValue = Number(total_supply);
        if (!isNaN(numValue) && isFinite(numValue)) {
            return { type: 'string (numeric)', needsConversion: true, convertedValue: numValue };
        } else {
            return { type: 'string (non-numeric)', needsConversion: false };
        }
    }
    
    return { type: typeof total_supply, needsConversion: false };
}

async function fixMetadataTotalSupplyTypes(dryRun: boolean = true): Promise<void> {
    console.log('🔧 FIXING METADATA TOTAL_SUPPLY FIELD TYPES');
    console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (will update metadata store)'}`);
    console.log('Converting string numbers to numbers and cleaning up old fields...');
    console.log('');
    
    try {
        // Import KV to check the store directly
        const { kv } = await import('@vercel/kv');
        
        // Scan for all metadata keys
        console.log('📥 Scanning KV store for metadata entries needing fixes...');
        
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
        
        // Find tokens that need fixing
        const tokensNeedingFix: Array<{
            key: string;
            contractId: string;
            metadata: any;
            needsStringConversion: boolean;
            convertedValue?: number;
            hasOldTotalSupply: boolean;
            currentSupplyValue: any;
            currentSupplyType: string;
        }> = [];
        
        let processedCount = 0;
        
        for (const key of allKeys) {
            try {
                const metadata = await kv.get(key);
                if (!metadata) continue;
                
                const contractId = key.replace(/^(metadata:|sip10:)/, '');
                const metadataObj = metadata as any;
                
                const total_supply = metadataObj.total_supply;
                const analysis = analyzeSupplyType(total_supply);
                const hasOldTotalSupply = 'totalSupply' in metadataObj;
                
                // Only include tokens that need some kind of fix
                if (analysis.needsConversion || hasOldTotalSupply) {
                    tokensNeedingFix.push({
                        key,
                        contractId,
                        metadata: metadataObj,
                        needsStringConversion: analysis.needsConversion,
                        convertedValue: analysis.convertedValue,
                        hasOldTotalSupply,
                        currentSupplyValue: total_supply,
                        currentSupplyType: analysis.type
                    });
                }
                
                processedCount++;
                if (processedCount % 200 === 0) {
                    console.log(`  Processed ${processedCount}/${allKeys.length} entries...`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${key}:`, error);
            }
        }
        
        console.log('');
        console.log('📊 FIX ANALYSIS');
        console.log('═'.repeat(80));
        
        const totalNeeding = tokensNeedingFix.length;
        const needsStringConversion = tokensNeedingFix.filter(t => t.needsStringConversion).length;
        const hasOldField = tokensNeedingFix.filter(t => t.hasOldTotalSupply).length;
        const needsBoth = tokensNeedingFix.filter(t => t.needsStringConversion && t.hasOldTotalSupply).length;
        
        console.log(`Total tokens scanned: ${allKeys.length}`);
        console.log(`Tokens needing fixes: ${totalNeeding}`);
        console.log(`  Need string → number conversion: ${needsStringConversion}`);
        console.log(`  Have old 'totalSupply' field to remove: ${hasOldField}`);
        console.log(`  Need both fixes: ${needsBoth}`);
        console.log('');
        
        if (totalNeeding === 0) {
            console.log('🎉 All tokens have properly typed total_supply fields!');
            return;
        }
        
        // Show sample of tokens that will be fixed
        console.log('🔧 TOKENS TO BE FIXED (sample):');
        console.log('─'.repeat(80));
        
        tokensNeedingFix.slice(0, 15).forEach((token, index) => {
            const fixes = [];
            if (token.needsStringConversion) {
                fixes.push(`Convert "${token.currentSupplyValue}" → ${token.convertedValue}`);
            }
            if (token.hasOldTotalSupply) {
                fixes.push('Remove old "totalSupply" field');
            }
            
            console.log(`${index + 1}. ${token.metadata.name || 'Unknown'} (${token.metadata.symbol || 'Unknown'})`);
            console.log(`   Contract: ${token.contractId}`);
            console.log(`   Fixes: ${fixes.join(', ')}`);
            console.log('');
        });
        
        if (totalNeeding > 15) {
            console.log(`... and ${totalNeeding - 15} more tokens needing fixes`);
            console.log('');
        }
        
        if (dryRun) {
            console.log('🔄 DRY RUN MODE - No actual updates will be made');
            console.log('To execute these fixes, run: pnpm script fix-metadata-total-supply-types live');
            return;
        }
        
        console.log('🚀 EXECUTING FIXES...');
        console.log('');
        
        const results: FixResult[] = [];
        let fixedCount = 0;
        
        for (const token of tokensNeedingFix) {
            try {
                console.log(`🔧 Fixing ${token.metadata.name || 'Unknown'}...`);
                
                let action: FixResult['action'] = 'no_change';
                let updatedMetadata = { ...token.metadata };
                
                // Fix 1: Convert string total_supply to number
                if (token.needsStringConversion && token.convertedValue !== undefined) {
                    updatedMetadata.total_supply = token.convertedValue;
                    action = 'converted_string_to_number';
                    console.log(`  ✅ Converted total_supply: "${token.currentSupplyValue}" → ${token.convertedValue}`);
                }
                
                // Fix 2: Remove old totalSupply field
                if (token.hasOldTotalSupply) {
                    delete updatedMetadata.totalSupply;
                    if (action === 'converted_string_to_number') {
                        action = 'both_fixes';
                    } else {
                        action = 'removed_old_field';
                    }
                    console.log(`  ✅ Removed old "totalSupply" field`);
                }
                
                // Update timestamp
                updatedMetadata.lastUpdated = Date.now().toString();
                
                // Store the updated metadata
                await kv.set(token.key, updatedMetadata);
                
                results.push({
                    contractId: token.contractId,
                    success: true,
                    action,
                    before: {
                        total_supply: token.currentSupplyValue,
                        total_supply_type: token.currentSupplyType,
                        had_totalSupply: token.hasOldTotalSupply
                    },
                    after: {
                        total_supply: updatedMetadata.total_supply,
                        total_supply_type: typeof updatedMetadata.total_supply
                    }
                });
                
                fixedCount++;
                
            } catch (error: any) {
                console.log(`  ❌ Failed: ${error.message}`);
                
                results.push({
                    contractId: token.contractId,
                    success: false,
                    action: 'error',
                    before: {
                        total_supply: token.currentSupplyValue,
                        total_supply_type: token.currentSupplyType,
                        had_totalSupply: token.hasOldTotalSupply
                    },
                    after: {},
                    error: error.message
                });
            }
            
            // Small delay between updates
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Progress indicator
            if (fixedCount % 50 === 0) {
                console.log(`  Progress: ${fixedCount}/${totalNeeding} tokens fixed...`);
            }
        }
        
        console.log('');
        console.log('📊 FIX RESULTS');
        console.log('═'.repeat(80));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const stringConverted = results.filter(r => r.action === 'converted_string_to_number' || r.action === 'both_fixes');
        const oldFieldRemoved = results.filter(r => r.action === 'removed_old_field' || r.action === 'both_fixes');
        const bothFixes = results.filter(r => r.action === 'both_fixes');
        
        console.log(`Total fixes attempted: ${results.length}`);
        console.log(`Successful fixes: ${successful.length}`);
        console.log(`Failed fixes: ${failed.length}`);
        console.log(`  String → number conversions: ${stringConverted.length}`);
        console.log(`  Old field removals: ${oldFieldRemoved.length}`);
        console.log(`  Both fixes applied: ${bothFixes.length}`);
        console.log('');
        
        if (stringConverted.length > 0) {
            console.log('✅ STRING → NUMBER CONVERSIONS:');
            console.log('─'.repeat(40));
            stringConverted.slice(0, 10).forEach(result => {
                const token = tokensNeedingFix.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'}: "${result.before.total_supply}" → ${result.after.total_supply}`);
            });
            if (stringConverted.length > 10) {
                console.log(`  ... and ${stringConverted.length - 10} more conversions`);
            }
            console.log('');
        }
        
        if (oldFieldRemoved.length > 0) {
            console.log('✅ OLD FIELD REMOVALS:');
            console.log('─'.repeat(40));
            oldFieldRemoved.slice(0, 10).forEach(result => {
                const token = tokensNeedingFix.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'}: Removed "totalSupply" field`);
            });
            if (oldFieldRemoved.length > 10) {
                console.log(`  ... and ${oldFieldRemoved.length - 10} more removals`);
            }
            console.log('');
        }
        
        if (failed.length > 0) {
            console.log('❌ FAILED FIXES:');
            console.log('─'.repeat(40));
            failed.forEach(result => {
                const token = tokensNeedingFix.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'}: ${result.error}`);
            });
            console.log('');
        }
        
        if (successful.length > 0) {
            console.log('🎉 SUCCESS!');
            console.log(`Fixed ${successful.length} tokens in the metadata store!`);
            console.log('');
            console.log('Summary:');
            console.log(`• ${stringConverted.length} tokens converted from string to number`);
            console.log(`• ${oldFieldRemoved.length} tokens had old "totalSupply" field removed`);
            console.log('• All total_supply fields now use consistent number types');
            console.log('');
            console.log('Next steps:');
            console.log('1. Verify the changes work correctly in applications');
            console.log('2. Monitor for any type-related issues');
            console.log('3. Ensure future metadata always uses number type for total_supply');
        }
        
    } catch (error: any) {
        console.error('❌ Error fixing metadata total supply types:', error.message);
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
    console.log('⚠️  LIVE MODE - This will make actual updates to the metadata store!');
    console.log('Press Ctrl+C to cancel if you want to review the plan first.');
    console.log('');
}

// Run the fix
fixMetadataTotalSupplyTypes(!isLiveMode).catch(console.error);