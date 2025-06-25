#!/usr/bin/env tsx
// Script to fetch total supply from smart contracts for tokens with null/undefined total_supply

import { callReadOnlyFunction } from '@repo/polyglot';

interface SupplyFetchResult {
    contractId: string;
    success: boolean;
    before: any;
    after?: number;
    error?: string;
    contractAddress?: string;
    contractName?: string;
}

interface TokenToFetch {
    key: string;
    contractId: string;
    metadata: any;
    contractAddress: string;
    contractName: string;
}

async function fetchTotalSupplyFromContract(contractAddress: string, contractName: string): Promise<number | null> {
    try {
        const result = await callReadOnlyFunction(
            contractAddress,
            contractName,
            "get-total-supply",
            []
        );
        
        if (result?.value !== undefined) {
            const totalSupply = Number(result.value);
            if (!isNaN(totalSupply) && isFinite(totalSupply)) {
                return totalSupply;
            }
        }
        
        return null;
    } catch (error) {
        // Contract might not have get-total-supply function or might be invalid
        return null;
    }
}

async function fetchMissingTotalSupply(dryRun: boolean = true, maxTokens: number = 100): Promise<void> {
    console.log('🔍 FETCHING MISSING TOTAL_SUPPLY FROM SMART CONTRACTS');
    console.log(`Mode: ${dryRun ? 'DRY RUN (simulation)' : 'LIVE (will update metadata store)'}`);
    console.log(`Max tokens to process: ${maxTokens}`);
    console.log('Calling get-total-supply on contracts with null/undefined total_supply...');
    console.log('');
    
    try {
        // Import KV to check the store directly
        const { kv } = await import('@vercel/kv');
        
        // Scan for all metadata keys
        console.log('📥 Scanning KV store for tokens with missing total_supply...');
        
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
        
        // Find tokens with null/undefined total_supply
        const tokensToFetch: TokenToFetch[] = [];
        let processedCount = 0;
        
        for (const key of allKeys) {
            try {
                const metadata = await kv.get(key);
                if (!metadata) continue;
                
                const contractId = key.replace(/^(metadata:|sip10:)/, '');
                const metadataObj = metadata as any;
                
                // Check if total_supply is null/undefined
                const total_supply = metadataObj.total_supply;
                if (total_supply === null || total_supply === undefined) {
                    // Parse contract ID to get address and name
                    const parts = contractId.split('.');
                    if (parts.length === 2) {
                        const [contractAddress, contractName] = parts;
                        
                        tokensToFetch.push({
                            key,
                            contractId,
                            metadata: metadataObj,
                            contractAddress,
                            contractName
                        });
                        
                        // Stop once we reach the max limit
                        if (tokensToFetch.length >= maxTokens) {
                            break;
                        }
                    }
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
        console.log('📊 TOTAL SUPPLY FETCH ANALYSIS');
        console.log('═'.repeat(80));
        
        console.log(`Total tokens scanned: ${processedCount}`);
        console.log(`Tokens with missing total_supply: ${tokensToFetch.length}`);
        console.log(`Will attempt to fetch: ${Math.min(tokensToFetch.length, maxTokens)}`);
        console.log('');
        
        if (tokensToFetch.length === 0) {
            console.log('🎉 All tokens already have total_supply values!');
            return;
        }
        
        // Show sample of tokens that will be processed
        console.log('🔍 TOKENS TO FETCH TOTAL SUPPLY FOR (sample):');
        console.log('─'.repeat(80));
        
        tokensToFetch.slice(0, 10).forEach((token, index) => {
            console.log(`${index + 1}. ${token.metadata.name || 'Unknown'} (${token.metadata.symbol || 'Unknown'})`);
            console.log(`   Contract: ${token.contractAddress}.${token.contractName}`);
            console.log(`   Current total_supply: ${token.metadata.total_supply}`);
            console.log('');
        });
        
        if (tokensToFetch.length > 10) {
            console.log(`... and ${tokensToFetch.length - 10} more tokens`);
            console.log('');
        }
        
        if (dryRun) {
            console.log('🔄 DRY RUN MODE - No actual contract calls or updates will be made');
            console.log('To execute these fetches, run: pnpm script fetch-missing-total-supply live [maxTokens]');
            return;
        }
        
        console.log('🚀 FETCHING TOTAL SUPPLY FROM CONTRACTS...');
        console.log('');
        
        const results: SupplyFetchResult[] = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < tokensToFetch.length; i++) {
            const token = tokensToFetch[i];
            
            try {
                console.log(`📞 [${i + 1}/${tokensToFetch.length}] Calling ${token.metadata.name || 'Unknown'}...`);
                console.log(`   Contract: ${token.contractAddress}.${token.contractName}`);
                
                const totalSupply = await fetchTotalSupplyFromContract(token.contractAddress, token.contractName);
                
                if (totalSupply !== null) {
                    console.log(`   ✅ Found total supply: ${totalSupply.toLocaleString()}`);
                    
                    // Update the metadata
                    const updatedMetadata = {
                        ...token.metadata,
                        total_supply: totalSupply,
                        lastUpdated: Date.now().toString()
                    };
                    
                    // Store the updated metadata
                    await kv.set(token.key, updatedMetadata);
                    
                    results.push({
                        contractId: token.contractId,
                        success: true,
                        before: token.metadata.total_supply,
                        after: totalSupply,
                        contractAddress: token.contractAddress,
                        contractName: token.contractName
                    });
                    
                    successCount++;
                } else {
                    console.log(`   ⚠️  No total supply found (contract may not support get-total-supply)`);
                    
                    results.push({
                        contractId: token.contractId,
                        success: false,
                        before: token.metadata.total_supply,
                        error: 'Contract does not support get-total-supply or returned invalid value',
                        contractAddress: token.contractAddress,
                        contractName: token.contractName
                    });
                    
                    errorCount++;
                }
                
            } catch (error: any) {
                console.log(`   ❌ Error: ${error.message}`);
                
                results.push({
                    contractId: token.contractId,
                    success: false,
                    before: token.metadata.total_supply,
                    error: error.message,
                    contractAddress: token.contractAddress,
                    contractName: token.contractName
                });
                
                errorCount++;
            }
            
            // Small delay between contract calls to be respectful
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Progress indicator
            if ((i + 1) % 10 === 0) {
                console.log(`   Progress: ${i + 1}/${tokensToFetch.length} tokens processed (${successCount} successful, ${errorCount} failed)`);
                console.log('');
            }
        }
        
        console.log('');
        console.log('📊 FETCH RESULTS');
        console.log('═'.repeat(80));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`Total fetch attempts: ${results.length}`);
        console.log(`Successful fetches: ${successful.length}`);
        console.log(`Failed fetches: ${failed.length}`);
        console.log('');
        
        if (successful.length > 0) {
            console.log('✅ SUCCESSFUL TOTAL SUPPLY FETCHES:');
            console.log('─'.repeat(80));
            successful.forEach(result => {
                const token = tokensToFetch.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'} (${token?.metadata.symbol || 'Unknown'})`);
                console.log(`  Contract: ${result.contractAddress}.${result.contractName}`);
                console.log(`  Total Supply: ${result.after?.toLocaleString()}`);
                console.log('');
            });
            console.log('');
        }
        
        if (failed.length > 0) {
            console.log('❌ FAILED FETCHES:');
            console.log('─'.repeat(80));
            
            // Group errors by type
            const errorTypes = new Map<string, number>();
            failed.forEach(result => {
                const errorType = result.error?.includes('does not support') ? 'No get-total-supply function' :
                                result.error?.includes('network') ? 'Network error' :
                                result.error?.includes('invalid') ? 'Invalid response' :
                                'Other error';
                errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
            });
            
            console.log('Error breakdown:');
            Array.from(errorTypes.entries()).forEach(([errorType, count]) => {
                console.log(`  ${errorType}: ${count} tokens`);
            });
            console.log('');
            
            // Show sample of failed tokens
            failed.slice(0, 5).forEach(result => {
                const token = tokensToFetch.find(t => t.contractId === result.contractId);
                console.log(`• ${token?.metadata.name || 'Unknown'}: ${result.error}`);
            });
            
            if (failed.length > 5) {
                console.log(`  ... and ${failed.length - 5} more failed fetches`);
            }
            console.log('');
        }
        
        if (successful.length > 0) {
            console.log('🎉 SUCCESS!');
            console.log(`Fetched total supply for ${successful.length} tokens from smart contracts!`);
            console.log('');
            console.log('Summary:');
            console.log(`• ${successful.length} tokens now have real total_supply values from contracts`);
            console.log(`• ${failed.length} tokens could not be fetched (likely don't support get-total-supply)`);
            console.log('• All fetched values are stored as proper number types');
            console.log('');
            
            if (tokensToFetch.length >= maxTokens) {
                const remaining = tokensToFetch.length - maxTokens;
                console.log(`Note: Processed maximum of ${maxTokens} tokens.`);
                console.log(`There may be more tokens with missing total_supply.`);
                console.log(`To process more, run: pnpm script fetch-missing-total-supply live ${maxTokens + 100}`);
            }
        }
        
    } catch (error: any) {
        console.error('❌ Error fetching missing total supply:', error.message);
        console.log('');
        console.log('Possible issues:');
        console.log('• KV store environment variables not configured');
        console.log('• Network connectivity issues');
        console.log('• Stacks node connectivity issues');
        console.log('• Insufficient permissions');
    }
}

// Get command line arguments
const mode = process.argv[2] || 'dry-run';
const maxTokensArg = process.argv[3];
const isLiveMode = mode === 'live';
const maxTokens = maxTokensArg ? parseInt(maxTokensArg, 10) : 100;

if (isNaN(maxTokens) || maxTokens < 1) {
    console.error('❌ Invalid maxTokens argument. Must be a positive number.');
    process.exit(1);
}

if (isLiveMode) {
    console.log('⚠️  LIVE MODE - This will make actual smart contract calls and update the metadata store!');
    console.log('Press Ctrl+C to cancel if you want to review the plan first.');
    console.log('');
}

// Run the fetch
fetchMissingTotalSupply(!isLiveMode, maxTokens).catch(console.error);