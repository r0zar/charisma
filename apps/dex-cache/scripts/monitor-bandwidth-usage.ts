#!/usr/bin/env tsx

/**
 * Monitor Redis bandwidth usage and cache efficiency
 * Usage: pnpm script monitor-bandwidth-usage [duration-minutes]
 */

import { kv } from "@vercel/kv";

interface BandwidthMetrics {
    totalKeys: number;
    keysByPrefix: Record<string, number>;
    estimatedDataSize: number;
    cacheHitRatio: Record<string, number>;
    lastUpdated: number;
}

async function analyzeKeyPatterns() {
    console.log('🔍 Analyzing Redis key patterns and estimating bandwidth usage...\n');
    
    try {
        // Get all keys
        const allKeys = await kv.keys('*');
        console.log(`📊 Total keys in Redis: ${allKeys.length.toLocaleString()}`);
        
        // Group by prefix
        const keysByPrefix: Record<string, number> = {};
        const sampleSizes: Record<string, number> = {};
        
        for (const key of allKeys) {
            const prefix = key.split(':')[0];
            keysByPrefix[prefix] = (keysByPrefix[prefix] || 0) + 1;
        }
        
        console.log('\n📋 Keys by prefix:');
        Object.entries(keysByPrefix)
            .sort(([,a], [,b]) => b - a)
            .forEach(([prefix, count]) => {
                console.log(`  ${prefix}: ${count.toLocaleString()} keys`);
            });
        
        // Sample data sizes from each prefix
        console.log('\n💾 Estimating data sizes (sampling first 5 keys per prefix):');
        let totalEstimatedSize = 0;
        
        for (const [prefix, count] of Object.entries(keysByPrefix)) {
            const prefixKeys = allKeys.filter(k => k.startsWith(prefix + ':')).slice(0, 5);
            let prefixSampleSize = 0;
            
            for (const key of prefixKeys) {
                try {
                    const value = await kv.get(key);
                    const size = JSON.stringify(value).length;
                    prefixSampleSize += size;
                } catch (error) {
                    console.warn(`    Error sampling ${key}: ${error}`);
                }
            }
            
            const avgSizePerKey = prefixSampleSize / prefixKeys.length;
            const estimatedPrefixSize = avgSizePerKey * count;
            totalEstimatedSize += estimatedPrefixSize;
            
            console.log(`  ${prefix}: ~${formatBytes(avgSizePerKey)}/key, ~${formatBytes(estimatedPrefixSize)} total`);
            sampleSizes[prefix] = avgSizePerKey;
        }
        
        console.log(`\n💰 Total estimated data size: ${formatBytes(totalEstimatedSize)}`);
        
        // Identify optimization opportunities
        console.log('\n🎯 Bandwidth optimization opportunities:');
        
        const heavyPrefixes = Object.entries(sampleSizes)
            .filter(([, size]) => size > 10000) // >10KB per key
            .sort(([,a], [,b]) => b - a);
            
        if (heavyPrefixes.length > 0) {
            console.log('  Large objects (>10KB per key):');
            heavyPrefixes.forEach(([prefix, size]) => {
                console.log(`    ${prefix}: ${formatBytes(size)}/key`);
            });
        }
        
        const frequentPrefixes = Object.entries(keysByPrefix)
            .filter(([, count]) => count > 50)
            .sort(([,a], [,b]) => b - a);
            
        if (frequentPrefixes.length > 0) {
            console.log('  Frequent cache patterns (>50 keys):');
            frequentPrefixes.forEach(([prefix, count]) => {
                console.log(`    ${prefix}: ${count} keys`);
            });
        }
        
        // Check for old/stale data
        console.log('\n🕐 Checking for potentially stale data:');
        const testKeys = [
            'prices-api-response-v2:',
            'token-price:',
            'dex-vault:',
            'energy:analytics:'
        ];
        
        for (const prefix of testKeys) {
            const keys = allKeys.filter(k => k.startsWith(prefix)).slice(0, 3);
            for (const key of keys) {
                try {
                    const value = await kv.get(key) as any;
                    if (value && value.timestamp) {
                        const age = Date.now() - value.timestamp;
                        const ageHours = Math.round(age / 1000 / 60 / 60);
                        console.log(`    ${key}: ${ageHours}h old`);
                    } else if (value && value.lastUpdated) {
                        const age = Date.now() - value.lastUpdated;
                        const ageHours = Math.round(age / 1000 / 60 / 60);
                        console.log(`    ${key}: ${ageHours}h old`);
                    }
                } catch (error) {
                    // Skip errors
                }
            }
        }
        
        // Save metrics
        const metrics: BandwidthMetrics = {
            totalKeys: allKeys.length,
            keysByPrefix,
            estimatedDataSize: totalEstimatedSize,
            cacheHitRatio: {}, // Would need additional tracking to implement
            lastUpdated: Date.now()
        };
        
        await kv.set('bandwidth-metrics', metrics, { ex: 24 * 60 * 60 }); // 24h expiry
        
        console.log('\n✅ Bandwidth analysis complete!');
        console.log(`💡 Consider implementing compression for prefixes with >10KB per key`);
        console.log(`🔧 Review cache durations for frequently accessed patterns`);
        
    } catch (error) {
        console.error('❌ Error analyzing bandwidth usage:', error);
    }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script monitor-bandwidth-usage [duration-minutes]');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm script monitor-bandwidth-usage     # Analyze current state');
    console.log('  pnpm script monitor-bandwidth-usage 60  # Future: Monitor for 60 minutes');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the analysis
analyzeKeyPatterns().catch(console.error);