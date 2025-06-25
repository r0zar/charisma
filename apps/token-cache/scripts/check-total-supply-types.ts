#!/usr/bin/env tsx
// Script to check that all tokens have totalSupply as numbers, not strings

interface TokenSupplyIssue {
    contractId: string;
    name?: string;
    symbol?: string;
    totalSupply: any;
    totalSupplyType: string;
    needsConversion: boolean;
}

function analyzeSupplyType(totalSupply: any): { type: string; needsConversion: boolean } {
    if (totalSupply === null || totalSupply === undefined) {
        return { type: 'null/undefined', needsConversion: false };
    }
    
    if (typeof totalSupply === 'number') {
        return { type: 'number', needsConversion: false };
    }
    
    if (typeof totalSupply === 'string') {
        // Check if it's a numeric string that should be converted
        const numValue = Number(totalSupply);
        if (!isNaN(numValue) && isFinite(numValue)) {
            return { type: 'string (numeric)', needsConversion: true };
        } else {
            return { type: 'string (non-numeric)', needsConversion: false };
        }
    }
    
    return { type: typeof totalSupply, needsConversion: false };
}

async function checkTotalSupplyTypes(): Promise<void> {
    console.log('🔢 CHECKING TOTAL SUPPLY TYPES');
    console.log('Analyzing all tokens to ensure totalSupply is stored as numbers...');
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
        
        if (allKeys.length === 0) {
            console.log('❌ No metadata keys found in KV store');
            return;
        }
        
        // Analyze each entry
        console.log('🔍 ANALYZING TOTAL SUPPLY TYPES...');
        const issues: TokenSupplyIssue[] = [];
        
        for (const key of allKeys) {
            try {
                const metadata = await kv.get(key);
                if (!metadata) continue;
                
                const contractId = key.replace(/^(metadata:|sip10:)/, '');
                const metadataObj = metadata as any;
                const totalSupply = metadataObj.totalSupply;
                
                const analysis = analyzeSupplyType(totalSupply);
                
                // Only track issues if there's a problem
                if (analysis.needsConversion || analysis.type !== 'number') {
                    issues.push({
                        contractId,
                        name: metadataObj.name,
                        symbol: metadataObj.symbol,
                        totalSupply,
                        totalSupplyType: analysis.type,
                        needsConversion: analysis.needsConversion
                    });
                }
                
                // Log each token being processed
                const status = analysis.type === 'number' ? '✅' : 
                             analysis.needsConversion ? '⚠️' : '❌';
                console.log(`${status} ${metadataObj.name || 'Unknown'} (${metadataObj.symbol || 'Unknown'})`);
                console.log(`    Contract: ${contractId}`);
                console.log(`    Total Supply: ${totalSupply} (${analysis.type})`);
                console.log('');
                
            } catch (error) {
                console.error(`❌ Error processing ${key}:`, error);
            }
        }
        
        console.log('📊 TOTAL SUPPLY TYPE ANALYSIS');
        console.log('═'.repeat(80));
        
        // Summary statistics
        const totalTokens = allKeys.length;
        const correctTypeCount = totalTokens - issues.length;
        const needsConversionCount = issues.filter(i => i.needsConversion).length;
        const otherIssuesCount = issues.filter(i => !i.needsConversion).length;
        
        console.log(`Total tokens analyzed: ${totalTokens}`);
        console.log(`Correct type (number): ${correctTypeCount}`);
        console.log(`Needs conversion (string → number): ${needsConversionCount}`);
        console.log(`Other issues: ${otherIssuesCount}`);
        console.log('');
        
        // Show tokens that need conversion
        const needsConversion = issues.filter(i => i.needsConversion);
        if (needsConversion.length > 0) {
            console.log('⚠️  TOKENS NEEDING CONVERSION (STRING → NUMBER):');
            console.log('─'.repeat(80));
            
            needsConversion.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.name} (${issue.symbol})`);
                console.log(`   Contract: ${issue.contractId}`);
                console.log(`   Current: "${issue.totalSupply}" (${issue.totalSupplyType})`);
                console.log(`   Should be: ${Number(issue.totalSupply)} (number)`);
                console.log('');
            });
        }
        
        // Show tokens with other issues
        const otherIssues = issues.filter(i => !i.needsConversion);
        if (otherIssues.length > 0) {
            console.log('❌ TOKENS WITH OTHER ISSUES:');
            console.log('─'.repeat(80));
            
            otherIssues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.name} (${issue.symbol})`);
                console.log(`   Contract: ${issue.contractId}`);
                console.log(`   Total Supply: ${issue.totalSupply} (${issue.totalSupplyType})`);
                console.log('');
            });
        }
        
        // Type breakdown
        console.log('🔍 TYPE BREAKDOWN:');
        console.log('─'.repeat(80));
        
        const typeCount = new Map<string, number>();
        
        // Count correct types
        typeCount.set('number', correctTypeCount);
        
        // Count issue types
        issues.forEach(issue => {
            typeCount.set(issue.totalSupplyType, (typeCount.get(issue.totalSupplyType) || 0) + 1);
        });
        
        Array.from(typeCount.entries())
            .sort(([, a], [, b]) => b - a)
            .forEach(([type, count]) => {
                const status = type === 'number' ? '✅' : 
                             type === 'string (numeric)' ? '⚠️' : '❌';
                console.log(`${status} ${type}: ${count} tokens`);
            });
        
        console.log('');
        console.log('🚀 RECOMMENDATIONS:');
        console.log('─'.repeat(80));
        
        if (needsConversion.length > 0) {
            console.log(`1. Convert ${needsConversion.length} tokens with numeric strings to numbers`);
            console.log('   → Create a script to update these tokens in the KV store');
        }
        
        if (otherIssues.length > 0) {
            console.log(`2. Review ${otherIssues.length} tokens with other totalSupply issues`);
            console.log('   → These may need manual investigation');
        }
        
        if (issues.length === 0) {
            console.log('🎉 All tokens have correct totalSupply types!');
        } else {
            console.log('');
            console.log('Next steps:');
            console.log('• Create a fix script for tokens needing conversion');
            console.log('• Investigate tokens with null/undefined totalSupply');
            console.log('• Ensure all future metadata uses number type for totalSupply');
        }
        
    } catch (error: any) {
        console.error('❌ Error checking total supply types:', error.message);
        console.log('');
        console.log('Possible issues:');
        console.log('• KV store environment variables not configured');
        console.log('• Network connectivity issues');
        console.log('• Insufficient permissions');
    }
}

// Run the check
checkTotalSupplyTypes().catch(console.error);