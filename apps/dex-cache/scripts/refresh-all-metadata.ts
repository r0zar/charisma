#!/usr/bin/env tsx

import { kv } from "@vercel/kv";
import { fetchMetadata } from '@repo/tokens';
import { Cryptonomicon } from '../src/lib/cryptonomicon';

/**
 * Comprehensive metadata refresh script
 * Updates symbol, decimals, image, description, and name for all tokens by fetching fresh data from contracts
 * Usage: pnpm script refresh-all-metadata [--dry-run]
 */

interface TokenMetadata {
    type: string;
    contractId: string;
    name: string;
    description?: string | null;
    image?: string | null;
    lastUpdated?: number | null;
    decimals?: number;
    symbol: string;
    token_uri?: string | null;
    identifier: string;
    total_supply?: string | null;
    [key: string]: any; // Allow additional properties
}

interface RefreshResult {
    contractId: string;
    changes: {
        symbol?: { old: string; new: string };
        decimals?: { old: number; new: number };
        image?: { old: string; new: string };
        description?: { old: string; new: string };
        name?: { old: string; new: string };
    };
    hasChanges: boolean;
    error?: string;
}

// Initialize Cryptonomicon for fresh contract data
const cryptonomicon = new Cryptonomicon({
    debug: false, // Reduce noise during batch processing
    apiKey: process.env.HIRO_API_KEY,
});

// Debug: Check if API key is loaded
if (!process.env.HIRO_API_KEY) {
    console.warn('⚠️  HIRO_API_KEY not found in environment variables');
} else {
    console.log(`✅ HIRO_API_KEY loaded: ${process.env.HIRO_API_KEY.substring(0, 8)}...`);
}

/**
 * Normalize image URLs for comparison
 */
function normalizeImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    return url.trim().toLowerCase();
}

/**
 * Check if an image is a placeholder
 */
function isPlaceholderImage(url: string | null | undefined): boolean {
    if (!url) return true;
    const normalized = normalizeImageUrl(url);
    return normalized.includes('ui-avatars.com') || 
           normalized.includes('placeholder') ||
           normalized === '';
}

/**
 * Generate a placeholder image URL for a token
 */
function generatePlaceholderImage(symbol: string): string {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const displaySymbol = cleanSymbol || 'TOKEN';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(displaySymbol)}&size=200&background=6366f1&color=ffffff&format=png&bold=true`;
}

/**
 * Fetch fresh metadata for a single token
 */
async function fetchFreshTokenData(contractId: string): Promise<{
    symbol: string;
    decimals: number | null;
    image: string;
    description: string;
    name: string;
}> {
    try {
        // Fetch fresh data from contract and token URI
        const [symbol, decimals, tokenMetadata, contractName] = await Promise.all([
            cryptonomicon.getTokenSymbol(contractId),
            cryptonomicon.getTokenDecimals(contractId),
            cryptonomicon.getTokenMetadata(contractId),
            cryptonomicon.getTokenName(contractId)
        ]);

        return {
            symbol: symbol || contractId.split('.')[1] || 'UNKNOWN',
            decimals: decimals, // Keep as-is, could be null if not determinable
            image: tokenMetadata?.image || '',
            description: tokenMetadata?.description || '',
            name: tokenMetadata?.name || contractName || '' // Use metadata name, fallback to contract name, then empty
        };
    } catch (error) {
        console.warn(`Failed to fetch fresh data for ${contractId}:`, error);
        throw error;
    }
}

/**
 * Compare and identify changes in token metadata
 */
function detectChanges(
    contractId: string, 
    current: TokenMetadata, 
    fresh: { symbol: string; decimals: number | null; image: string; description: string; name: string }
): RefreshResult {
    const changes: RefreshResult['changes'] = {};
    let hasChanges = false;

    // Check symbol changes
    if (current.symbol !== fresh.symbol) {
        changes.symbol = { old: current.symbol, new: fresh.symbol };
        hasChanges = true;
    }

    // Check decimals changes - only update if we have a definitive fresh value
    if (fresh.decimals !== null && current.decimals !== fresh.decimals) {
        changes.decimals = { old: current.decimals || 0, new: fresh.decimals };
        hasChanges = true;
    }

    // Check description changes
    const currentDescription = current.description || '';
    const freshDescription = fresh.description || '';
    if (currentDescription !== freshDescription) {
        // Only update if fresh description is not empty or if current is empty
        if (freshDescription || !currentDescription) {
            changes.description = { old: currentDescription, new: freshDescription };
            hasChanges = true;
        }
    }

    // Check name changes
    const currentName = current.name || '';
    const freshName = fresh.name || '';
    if (currentName !== freshName) {
        // Only update if fresh name is not empty or if current is empty
        if (freshName || !currentName) {
            changes.name = { old: currentName, new: freshName };
            hasChanges = true;
        }
    }

    // Check image changes with improved logic
    const currentImage = current.image;
    const freshImage = fresh.image;
    const currentIsPlaceholder = isPlaceholderImage(currentImage);
    const freshIsPlaceholder = isPlaceholderImage(freshImage);
    
    let newImage = currentImage; // Default to keeping current image
    
    if (!currentImage && !freshImage) {
        // Neither cache nor fresh has image - generate placeholder using fresh symbol
        newImage = generatePlaceholderImage(fresh.symbol);
        changes.image = { old: currentImage || '', new: newImage };
        hasChanges = true;
    } else if (!currentImage && freshImage) {
        // Cache has no image but fresh has one - use fresh image
        newImage = freshImage;
        changes.image = { old: currentImage || '', new: newImage };
        hasChanges = true;
    } else if (currentImage && !freshImage) {
        // Cache has image but fresh doesn't - keep current, but check if we can improve placeholder
        if (currentIsPlaceholder) {
            const improvedPlaceholder = generatePlaceholderImage(fresh.symbol);
            if (normalizeImageUrl(currentImage) !== normalizeImageUrl(improvedPlaceholder)) {
                newImage = improvedPlaceholder;
                changes.image = { old: currentImage, new: newImage };
                hasChanges = true;
            }
        }
        // Otherwise no change needed (don't downgrade real images)
    } else if (currentImage && freshImage && normalizeImageUrl(currentImage) !== normalizeImageUrl(freshImage)) {
        // Both have images but they're different
        if (currentIsPlaceholder && !freshIsPlaceholder) {
            // Upgrade from placeholder to real image
            newImage = freshImage;
            changes.image = { old: currentImage, new: newImage };
            hasChanges = true;
        } else if (!currentIsPlaceholder && freshIsPlaceholder) {
            // Don't downgrade from real image to placeholder
            // No change needed
        } else if (currentIsPlaceholder && freshIsPlaceholder) {
            // Both are placeholders, use fresh one (might have better symbol)
            newImage = freshImage;
            changes.image = { old: currentImage, new: newImage };
            hasChanges = true;
        } else {
            // Both are real images, prefer fresh one
            newImage = freshImage;
            changes.image = { old: currentImage, new: newImage };
            hasChanges = true;
        }
    }

    return {
        contractId,
        changes,
        hasChanges
    };
}

/**
 * Update token metadata in KV storage
 */
async function updateTokenInKV(contractId: string, current: TokenMetadata, changes: RefreshResult['changes']): Promise<boolean> {
    try {
        const kvKey = `sip10:${contractId}`;
        
        // Create updated metadata preserving existing fields
        const updatedMetadata = {
            ...current,
            ...(changes.symbol && { symbol: changes.symbol.new }),
            ...(changes.decimals && { decimals: changes.decimals.new }),
            ...(changes.image && { image: changes.image.new }),
            ...(changes.description && { description: changes.description.new }),
            ...(changes.name && { name: changes.name.new }),
            lastUpdated: Date.now()
        };

        await kv.set(kvKey, updatedMetadata);
        return true;
    } catch (error) {
        console.error(`Failed to update KV for ${contractId}:`, error);
        return false;
    }
}

/**
 * Process tokens in batches
 */
async function processBatch(
    tokens: TokenMetadata[], 
    batchSize: number = 15, 
    isDryRun: boolean = true
): Promise<RefreshResult[]> {
    const results: RefreshResult[] = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokens.length / batchSize)} (${batch.length} tokens)...`);
        
        const batchPromises = batch.map(async (token) => {
            try {
                const freshData = await fetchFreshTokenData(token.contractId);
                const result = detectChanges(token.contractId, token, freshData);
                
                // Update KV if not dry run and has changes
                if (!isDryRun && result.hasChanges) {
                    const updateSuccess = await updateTokenInKV(token.contractId, token, result.changes);
                    if (!updateSuccess) {
                        result.error = 'Failed to update KV storage';
                    }
                }
                
                return result;
            } catch (error) {
                return {
                    contractId: token.contractId,
                    changes: {},
                    hasChanges: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
            } else {
                console.error('Batch processing error:', result.reason);
            }
        }
        
        // Show progress for tokens with changes
        const changesInBatch = results.slice(-batch.length).filter(r => r.hasChanges);
        if (changesInBatch.length > 0) {
            console.log(`  ✨ Found ${changesInBatch.length} tokens with changes`);
        }
        
        // Delay between batches to avoid overwhelming APIs
        if (i + batchSize < tokens.length) {
            await new Promise(resolve => setTimeout(resolve, 4000)); // Increased delay to 4 seconds
        }
    }
    
    return results;
}

/**
 * Generate detailed report
 */
function generateReport(results: RefreshResult[], isDryRun: boolean) {
    const changedResults = results.filter(r => r.hasChanges);
    const errorResults = results.filter(r => r.error);
    
    let symbolUpdates = 0;
    let decimalsUpdates = 0;
    let imageUpdates = 0;
    let descriptionUpdates = 0;
    let nameUpdates = 0;
    let imageUpgrades = 0; // placeholder to real
    let imageDowngradePrevented = 0; // real to placeholder prevented
    let placeholdersGenerated = 0; // no image to placeholder
    
    console.log(`\n${'='.repeat(100)}`);
    console.log(`${isDryRun ? '🔍 DRY RUN' : '✅ LIVE RUN'} RESULTS`);
    console.log(`${'='.repeat(100)}`);
    
    if (changedResults.length > 0) {
        console.log('\n📋 Changes detected:\n');
        
        changedResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}`);
            
            if (result.changes.symbol) {
                console.log(`   Symbol: ${result.changes.symbol.old} → ${result.changes.symbol.new} ✓`);
                symbolUpdates++;
            }
            
            if (result.changes.decimals) {
                console.log(`   Decimals: ${result.changes.decimals.old} → ${result.changes.decimals.new} ✓`);
                decimalsUpdates++;
            }
            
            if (result.changes.image) {
                const oldImage = result.changes.image.old || 'N/A';
                const newImage = result.changes.image.new || 'N/A';
                console.log(`   Image: ${oldImage.substring(0, 50)}${oldImage.length > 50 ? '...' : ''} → ${newImage.substring(0, 50)}${newImage.length > 50 ? '...' : ''} ✓`);
                imageUpdates++;
            }
            
            if (result.changes.description) {
                const oldDesc = result.changes.description.old || 'N/A';
                const newDesc = result.changes.description.new || 'N/A';
                console.log(`   Description: ${oldDesc.substring(0, 50)}${oldDesc.length > 50 ? '...' : ''} → ${newDesc.substring(0, 50)}${newDesc.length > 50 ? '...' : ''} ✓`);
                descriptionUpdates++;
            }
            
            if (result.changes.name) {
                const oldName = result.changes.name.old || 'N/A';
                const newName = result.changes.name.new || 'N/A';
                console.log(`   Name: ${oldName.substring(0, 50)}${oldName.length > 50 ? '...' : ''} → ${newName.substring(0, 50)}${newName.length > 50 ? '...' : ''} ✓`);
                nameUpdates++;
            }
            
            console.log('');
        });
    } else {
        console.log('\n✨ No changes detected in any tokens.\n');
    }
    
    if (errorResults.length > 0) {
        console.log('\n⚠️  Errors encountered:\n');
        errorResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.contractId}: ${result.error}`);
        });
        console.log('');
    }
    
    console.log('📊 Summary:');
    console.log(`- Tokens checked: ${results.length}`);
    console.log(`- Changes detected: ${changedResults.length}`);
    console.log(`- Symbol updates: ${symbolUpdates}`);
    console.log(`- Decimals updates: ${decimalsUpdates}`);
    console.log(`- Image updates: ${imageUpdates}`);
    console.log(`- Description updates: ${descriptionUpdates}`);
    console.log(`- Name updates: ${nameUpdates}`);
    console.log(`- No changes: ${results.length - changedResults.length}`);
    console.log(`- Errors: ${errorResults.length}`);
    
    if (isDryRun && changedResults.length > 0) {
        console.log(`\n💡 Run without --dry-run to apply these ${changedResults.length} changes.`);
    } else if (!isDryRun && changedResults.length > 0) {
        console.log(`\n🎉 Successfully applied ${changedResults.length} metadata updates!`);
    }
}

/**
 * Main execution function
 */
async function refreshAllMetadata() {
    const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');
    
    console.log(`🔄 ${isDryRun ? 'DRY RUN: ' : 'LIVE RUN: '}Refreshing metadata for all tokens...\n`);
    
    try {
        // Fetch all existing metadata
        console.log('📋 Fetching existing metadata from cache...');
        const existingMetadata: TokenMetadata[] = await fetchMetadata();
        console.log(`Found ${existingMetadata.length} tokens in cache\n`);
        
        if (existingMetadata.length === 0) {
            console.log('❌ No tokens found in metadata cache. Exiting.');
            return;
        }
        
        // Process all tokens with conservative batch size to avoid rate limits
        const results = await processBatch(existingMetadata, 10, isDryRun);
        
        // Generate final report
        generateReport(results, isDryRun);
        
    } catch (error) {
        console.error('❌ Fatal error during metadata refresh:', error);
        process.exit(1);
    }
}

// Show usage information
function showUsage() {
    console.log('Usage: pnpm script refresh-all-metadata [--dry-run]');
    console.log('\nOptions:');
    console.log('  --dry-run, -d    Show what would be updated without making changes');
    console.log('\nDescription:');
    console.log('  Refreshes symbol, decimals, image, description, and name for all tokens by fetching');
    console.log('  fresh data from blockchain contracts and token URIs.');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
    process.exit(0);
}

// Run the script
refreshAllMetadata().catch(console.error);