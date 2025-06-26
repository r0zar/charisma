#!/usr/bin/env tsx

import { kv } from "@vercel/kv";

/**
 * Migrate LP token metadata from token-metadata: keys to sip10: keys
 * and add them to the managed token list
 */

async function migrateToSip10Keys() {
    console.log('🔄 Migrating LP token metadata to sip10: keys and managed list...\n');

    // Get all token-metadata keys to find our synced LP tokens
    const allKeys = await kv.keys('token-metadata:*');
    console.log(`Found ${allKeys.length} token-metadata keys\n`);

    let migratedCount = 0;
    let errorCount = 0;
    
    // Get current managed list
    const TOKEN_LIST_KEY = "token-list:sip10";
    let managedList = await kv.get<string[]>(TOKEN_LIST_KEY) || [];
    console.log(`Current managed list has ${managedList.length} tokens\n`);

    for (const tokenMetadataKey of allKeys) {
        try {
            // Extract contract ID from key
            const contractId = tokenMetadataKey.replace('token-metadata:', '');
            const sip10Key = `sip10:${contractId}`;
            
            console.log(`🔄 Migrating ${contractId}...`);
            
            // Get data from token-metadata key
            const tokenData = await kv.get(tokenMetadataKey);
            if (!tokenData) {
                console.log(`  ⚠️  No data found at ${tokenMetadataKey}`);
                continue;
            }
            
            // Check if already exists at sip10 key
            const existingSip10Data = await kv.get(sip10Key);
            if (existingSip10Data) {
                console.log(`  ℹ️  Data already exists at ${sip10Key}, updating with LP image...`);
                // Merge the data, keeping LP image
                const mergedData = {
                    ...existingSip10Data,
                    image: (tokenData as any).image, // Use LP image
                    lastUpdated: Date.now()
                };
                await kv.set(sip10Key, mergedData);
            } else {
                console.log(`  ✅ Creating new entry at ${sip10Key}`);
                await kv.set(sip10Key, tokenData);
            }
            
            // Add to managed list if not already present
            if (!managedList.includes(contractId)) {
                managedList.push(contractId);
                console.log(`  ✅ Added to managed list`);
            } else {
                console.log(`  ℹ️  Already in managed list`);
            }
            
            migratedCount++;
            
            // Small delay to avoid overwhelming KV
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error(`❌ Error migrating ${tokenMetadataKey}:`, error);
            errorCount++;
        }
    }
    
    // Update the managed list
    try {
        await kv.set(TOKEN_LIST_KEY, managedList);
        console.log(`\n✅ Updated managed list to ${managedList.length} tokens`);
    } catch (error) {
        console.error(`❌ Failed to update managed list:`, error);
        errorCount++;
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`Successfully migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total managed list size: ${managedList.length}`);
    
    if (migratedCount > 0) {
        console.log(`\n🎉 Migration complete! LP token images should now appear in fetchMetadata results.`);
    }
}

migrateToSip10Keys().catch(console.error);