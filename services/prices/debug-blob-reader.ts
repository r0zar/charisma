#!/usr/bin/env tsx
/**
 * Debug script to read blob storage and analyze snapshot data structure
 */

import { list } from '@vercel/blob';

async function main() {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
        console.error('Error: BLOB_READ_WRITE_TOKEN environment variable is required');
        process.exit(1);
    }

    try {
        console.log('🔍 Fetching blob list...');
        
        // Get list of snapshots - look much further back
        const { blobs } = await list({ 
            prefix: 'snapshots/', 
            limit: 1000 // Look way back to find comprehensive token data
        });

        console.log(`📊 Found ${blobs.length} snapshot blobs`);
        
        if (blobs.length === 0) {
            console.log('❌ No snapshots found');
            return;
        }

        // Sort by upload date and get the most recent
        const sortedBlobs = blobs.sort((a, b) => 
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        );

        const latestBlob = sortedBlobs[0];
        console.log(`\n📋 Latest snapshot: ${latestBlob.pathname}`);
        console.log(`📅 Uploaded: ${new Date(latestBlob.uploadedAt).toISOString()}`);
        console.log(`📏 Size: ${latestBlob.size} bytes`);

        // Fetch and analyze the snapshot
        console.log('\n🔄 Fetching snapshot data...');
        const response = await fetch(latestBlob.url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const snapshot = await response.json();
        
        console.log('\n📊 Snapshot Analysis:');
        console.log('='.repeat(50));
        
        // Analyze top-level structure
        console.log('\n🏗️  Top-level structure:');
        Object.keys(snapshot).forEach(key => {
            const value = snapshot[key];
            const type = Array.isArray(value) ? `Array[${value.length}]` : typeof value;
            console.log(`  ${key}: ${type}`);
        });

        // Analyze prices structure
        if (snapshot.prices) {
            console.log('\n💰 Prices structure:');
            
            if (Array.isArray(snapshot.prices)) {
                console.log(`  Format: Array with ${snapshot.prices.length} entries`);
                
                if (snapshot.prices.length > 0) {
                    const firstPrice = snapshot.prices[0];
                    console.log('\n📝 First price entry structure:');
                    Object.keys(firstPrice).forEach(key => {
                        const value = firstPrice[key];
                        const type = typeof value;
                        console.log(`    ${key}: ${type} = ${JSON.stringify(value)}`);
                    });

                    // Show a few token IDs for reference
                    console.log('\n🪙  Sample token IDs:');
                    snapshot.prices.slice(0, 5).forEach((price: any, index: number) => {
                        console.log(`    ${index + 1}. ${price.tokenId || 'No tokenId'}`);
                    });

                    console.log('\n🔍 Looking for specific tokens:');
                    const searchTokens = [
                        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
                        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.crystals',
                        'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
                    ];

                    searchTokens.forEach(tokenId => {
                        const found = snapshot.prices.find((p: any) => p.tokenId === tokenId);
                        console.log(`    ${tokenId.substring(0, 20)}...: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
                        if (found) {
                            console.log(`      Price: $${found.usdPrice}, Source: ${found.source}`);
                        }
                    });
                }
            } else if (snapshot.prices && typeof snapshot.prices === 'object') {
                console.log(`  Format: Object/Map with ${Object.keys(snapshot.prices).length} entries`);
                
                // Show first few keys
                const keys = Object.keys(snapshot.prices).slice(0, 5);
                console.log('\n🔑 Sample keys:');
                keys.forEach(key => {
                    console.log(`    ${key}`);
                });
            } else {
                console.log(`  Format: ${typeof snapshot.prices}`);
                console.log(`  Value: ${JSON.stringify(snapshot.prices)}`);
            }
        } else {
            console.log('❌ No prices property found');
        }

        // Look at more snapshots to find ones with comprehensive token data
        console.log('\n📚 Searching for snapshots with comprehensive token data:');
        console.log('='.repeat(50));
        
        const testTokens = [
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
            'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.crystals',
            'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'
        ];

        let bestSnapshot = null;
        let maxTokens = 0;

        // Search backwards through time to find comprehensive snapshots
        for (let i = sortedBlobs.length - 1; i >= 0; i--) {
            const blob = sortedBlobs[i];
            
            try {
                const resp = await fetch(blob.url);
                const snap = await resp.json();
                
                if (snap.prices && Array.isArray(snap.prices)) {
                    console.log(`📋 ${blob.pathname}: ${snap.prices.length} tokens (${new Date(blob.uploadedAt).toISOString()})`);
                    
                    if (snap.prices.length > maxTokens) {
                        maxTokens = snap.prices.length;
                        bestSnapshot = { blob, snap };
                    }

                    // Show details for snapshots with more than 2 tokens
                    if (snap.prices.length > 2) {
                        console.log(`  🎯 Found comprehensive snapshot with ${snap.prices.length} tokens!`);
                        
                        testTokens.forEach(tokenId => {
                            const found = snap.prices.find((p: any) => p.tokenId === tokenId);
                            console.log(`     ${tokenId.substring(0, 25)}...: ${found ? '✅' : '❌'}`);
                        });

                        // Show sample of token IDs in this snapshot
                        console.log(`  🪙 Sample tokens in this snapshot:`);
                        snap.prices.slice(0, 10).forEach((price: any, idx: number) => {
                            console.log(`     ${idx + 1}. ${price.tokenId}`);
                        });
                        
                        console.log(''); // Add spacing
                        break; // Found a good one, stop searching
                    }
                }
            } catch (error) {
                console.log(`   ❌ Error reading ${blob.pathname}: ${error}`);
            }
        }

        if (bestSnapshot && bestSnapshot.snap.prices.length > 2) {
            console.log(`\n🏆 Best snapshot found: ${bestSnapshot.blob.pathname}`);
            console.log(`   📊 Contains ${bestSnapshot.snap.prices.length} tokens`);
            console.log(`   📅 Date: ${new Date(bestSnapshot.blob.uploadedAt).toISOString()}`);
        } else {
            console.log(`\n⚠️  No comprehensive snapshots found - all snapshots contain only ${maxTokens} tokens`);
            console.log('   This explains why sparklines are not working for most tokens.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);