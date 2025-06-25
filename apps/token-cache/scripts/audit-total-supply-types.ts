#!/usr/bin/env tsx
// Script to audit total_supply field types in metadata store

interface TypeAnalysis {
    contractId: string;
    name?: string;
    symbol?: string;
    total_supply: any;
    total_supply_type: string;
    needsConversion: boolean;
    convertedValue?: number;
    hasOldTotalSupply?: boolean;
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

async function auditTotalSupplyTypes(): Promise<void> {
    console.log('🔍 AUDITING TOTAL_SUPPLY FIELD TYPES IN METADATA STORE');
    console.log('Checking all tokens to ensure total_supply is stored as numbers...');
    console.log('');
    
    try {
        // Import KV to check the store directly
        const { kv } = await import('@vercel/kv');
        
        // Scan for all metadata keys
        console.log('📥 Scanning KV store for all metadata entries...');
        
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
        
        // Analyze each entry
        const analyses: TypeAnalysis[] = [];
        let processedCount = 0;
        
        for (const key of allKeys) {
            try {
                const metadata = await kv.get(key);
                if (!metadata) continue;
                
                const contractId = key.replace(/^(metadata:|sip10:)/, '');
                const metadataObj = metadata as any;
                
                const total_supply = metadataObj.total_supply;
                const analysis = analyzeSupplyType(total_supply);
                
                // Check if old totalSupply field exists
                const hasOldTotalSupply = 'totalSupply' in metadataObj;
                
                analyses.push({
                    contractId,
                    name: metadataObj.name,
                    symbol: metadataObj.symbol,
                    total_supply,
                    total_supply_type: analysis.type,
                    needsConversion: analysis.needsConversion,
                    convertedValue: analysis.convertedValue,
                    hasOldTotalSupply
                });
                
                processedCount++;
                if (processedCount % 100 === 0) {
                    console.log(`  Processed ${processedCount}/${allKeys.length} entries...`);
                }
                
            } catch (error) {
                console.error(`❌ Error processing ${key}:`, error);
            }
        }
        
        console.log('');
        console.log('📊 TOTAL_SUPPLY TYPE ANALYSIS');
        console.log('═'.repeat(80));
        
        // Summary statistics
        const totalTokens = analyses.length;
        const correctType = analyses.filter(a => a.total_supply_type === 'number').length;
        const stringNumeric = analyses.filter(a => a.total_supply_type === 'string (numeric)').length;
        const stringNonNumeric = analyses.filter(a => a.total_supply_type === 'string (non-numeric)').length;
        const nullUndefined = analyses.filter(a => a.total_supply_type === 'null/undefined').length;
        const otherTypes = analyses.filter(a => !['number', 'string (numeric)', 'string (non-numeric)', 'null/undefined'].includes(a.total_supply_type)).length;
        const hasOldField = analyses.filter(a => a.hasOldTotalSupply).length;
        const needsConversion = analyses.filter(a => a.needsConversion).length;
        
        console.log(`Total tokens analyzed: ${totalTokens}`);
        console.log(`✅ Correct type (number): ${correctType}`);
        console.log(`⚠️  String (numeric - needs conversion): ${stringNumeric}`);
        console.log(`❌ String (non-numeric): ${stringNonNumeric}`);
        console.log(`⚪ Null/undefined: ${nullUndefined}`);
        console.log(`❓ Other types: ${otherTypes}`);
        console.log(`🔄 Has old 'totalSupply' field: ${hasOldField}`);
        console.log(`🚨 Total needing conversion: ${needsConversion}`);
        console.log('');
        
        // Type breakdown
        console.log('🔍 DETAILED TYPE BREAKDOWN:');
        console.log('─'.repeat(80));
        
        const typeCount = new Map<string, number>();
        analyses.forEach(analysis => {
            typeCount.set(analysis.total_supply_type, (typeCount.get(analysis.total_supply_type) || 0) + 1);
        });
        
        Array.from(typeCount.entries())
            .sort(([, a], [, b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / totalTokens) * 100).toFixed(1);
                const status = type === 'number' ? '✅' : 
                             type === 'string (numeric)' ? '⚠️' : 
                             type === 'null/undefined' ? '⚪' : '❌';
                console.log(`${status} ${type}: ${count} tokens (${percentage}%)`);
            });
        
        console.log('');
        
        // Show tokens needing conversion
        const needsConversionList = analyses.filter(a => a.needsConversion);
        if (needsConversionList.length > 0) {
            console.log('⚠️  TOKENS NEEDING CONVERSION (STRING → NUMBER):');
            console.log('─'.repeat(80));
            
            needsConversionList.slice(0, 20).forEach((analysis, index) => {
                console.log(`${index + 1}. ${analysis.name || 'Unknown'} (${analysis.symbol || 'Unknown'})`);
                console.log(`   Contract: ${analysis.contractId}`);
                console.log(`   Current: "${analysis.total_supply}" (${analysis.total_supply_type})`);
                console.log(`   Will be: ${analysis.convertedValue} (number)`);
                console.log('');
            });
            
            if (needsConversionList.length > 20) {
                console.log(`... and ${needsConversionList.length - 20} more tokens needing conversion`);
                console.log('');
            }
        }
        
        // Show tokens with old totalSupply field
        const hasOldFieldList = analyses.filter(a => a.hasOldTotalSupply);
        if (hasOldFieldList.length > 0) {
            console.log('🔄 TOKENS WITH OLD "totalSupply" FIELD:');
            console.log('─'.repeat(80));
            
            hasOldFieldList.slice(0, 10).forEach((analysis, index) => {
                console.log(`${index + 1}. ${analysis.name || 'Unknown'} (${analysis.symbol || 'Unknown'})`);
                console.log(`   Contract: ${analysis.contractId}`);
                console.log('   → This token still has the old "totalSupply" field that should be removed');
                console.log('');
            });
            
            if (hasOldFieldList.length > 10) {
                console.log(`... and ${hasOldFieldList.length - 10} more tokens with old field`);
                console.log('');
            }
        }
        
        // Show problematic tokens
        const problematicTokens = analyses.filter(a => 
            a.total_supply_type === 'string (non-numeric)' || 
            !['number', 'string (numeric)', 'null/undefined'].includes(a.total_supply_type)
        );
        
        if (problematicTokens.length > 0) {
            console.log('❌ PROBLEMATIC TOKENS (NON-CONVERTIBLE):');
            console.log('─'.repeat(80));
            
            problematicTokens.forEach((analysis, index) => {
                console.log(`${index + 1}. ${analysis.name || 'Unknown'} (${analysis.symbol || 'Unknown'})`);
                console.log(`   Contract: ${analysis.contractId}`);
                console.log(`   total_supply: ${analysis.total_supply} (${analysis.total_supply_type})`);
                console.log('');
            });
        }
        
        console.log('🚀 RECOMMENDATIONS:');
        console.log('─'.repeat(80));
        
        if (needsConversion > 0) {
            console.log(`1. Convert ${needsConversion} tokens with string numeric values to numbers`);
        }
        
        if (hasOldField > 0) {
            console.log(`2. Remove old "totalSupply" field from ${hasOldField} tokens`);
        }
        
        if (problematicTokens.length > 0) {
            console.log(`3. Review ${problematicTokens.length} tokens with non-convertible total_supply values`);
        }
        
        if (needsConversion === 0 && hasOldField === 0) {
            console.log('🎉 All tokens have properly typed total_supply fields!');
        } else {
            console.log('');
            console.log('Next steps:');
            console.log('• Run fix script to convert string numbers to actual numbers');
            console.log('• Clean up any remaining old field names');
            console.log('• Ensure all future metadata uses number type for total_supply');
        }
        
    } catch (error: any) {
        console.error('❌ Error auditing total supply types:', error.message);
        console.log('');
        console.log('Possible issues:');
        console.log('• KV store environment variables not configured');
        console.log('• Network connectivity issues');
        console.log('• Insufficient permissions');
    }
}

// Run the audit
auditTotalSupplyTypes().catch(console.error);