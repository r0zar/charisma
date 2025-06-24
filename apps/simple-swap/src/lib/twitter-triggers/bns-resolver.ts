import { BNSResolutionResult } from './types';
import { resolveBnsNameToAddress } from '@repo/polyglot';

/**
 * Extracts BNS names from Twitter handles and display names
 * Supports formats like: @username.btc, username.btc, "Alice.btc 🎯", etc.
 */
export function extractBNSName(handle: string, displayName: string): string | null {
    // Patterns to match BNS names (ending with .btc)
    const bnsPatterns = [
        /([a-zA-Z0-9_-]+\.btc)/gi, // Basic pattern: username.btc
        /@([a-zA-Z0-9_-]+\.btc)/gi, // With @ prefix: @username.btc
    ];
    
    // Check both handle and display name
    const textToCheck = [handle, displayName].join(' ');
    
    for (const pattern of bnsPatterns) {
        const matches = textToCheck.match(pattern);
        if (matches && matches.length > 0) {
            // Clean up the match (remove @ if present)
            const bnsName = matches[0].replace('@', '').toLowerCase();
            if (bnsName.endsWith('.btc')) {
                return bnsName;
            }
        }
    }
    
    return null;
}

/**
 * Resolves a BNS name to a Stacks address using the shared polyglot BNS function
 */
export async function resolveBNSToAddress(bnsName: string): Promise<BNSResolutionResult> {
    try {
        console.log(`[BNS Resolver] Attempting to resolve: ${bnsName}`);
        
        // Check if we should use mock data for testing
        const useMockBNS = process.env.BNS_USE_MOCK === 'true';
        
        if (useMockBNS) {
            console.log(`[BNS Resolver] Using mock BNS resolution for testing`);
            return getMockBNSResolution(bnsName);
        }
        
        // Use the shared resolveBnsNameToAddress function from @repo/polyglot
        console.log(`[BNS Resolver] Using shared resolveBnsNameToAddress for: ${bnsName}`);
        
        const address = await resolveBnsNameToAddress(bnsName);
        
        if (address) {
            console.log(`[BNS Resolver] Successfully resolved ${bnsName} to address: ${address}`);
            return {
                bnsName,
                address,
                success: true
            };
        } else {
            console.log(`[BNS Resolver] BNS name ${bnsName} not found`);
            return {
                bnsName,
                success: false,
                error: 'BNS name not found in registry'
            };
        }
        
    } catch (error) {
        console.error(`[BNS Resolver] Error resolving ${bnsName}:`, error);
        
        // Fall back to mock data for development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[BNS Resolver] Falling back to mock data in development`);
            return getMockBNSResolution(bnsName);
        }
        
        return {
            bnsName,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Mock BNS resolution for testing and development
 */
function getMockBNSResolution(bnsName: string): BNSResolutionResult {
    const mockAddresses: Record<string, string> = {
        'test.btc': 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'alice.btc': 'SP1P72Z3704VMT3DMHPP2CB8TGQWGDBHD3RPR9GZS',
        'bob.btc': 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'charlie.btc': 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        'developer.btc': 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'satoshi.btc': 'SP3FGQ8Z7JY4D5WZ5KW8N6Y4K3J2H1M9G8L7F6E5D',
        'hal.btc': 'SP2HVFG9X4DJQFG8YX6K9J7L5M3N4B2C9A8F6E1D0',
    };
    
    const address = mockAddresses[bnsName.toLowerCase()];
    
    if (address) {
        return {
            bnsName,
            address,
            success: true
        };
    }
    
    return {
        bnsName,
        success: false,
        error: 'Mock BNS name not found'
    };
}

/**
 * Validates if a string could be a valid BNS name
 */
export function isValidBNSFormat(name: string): boolean {
    // BNS names should be lowercase, contain only letters, numbers, hyphens, underscores
    // and end with .btc
    const bnsPattern = /^[a-z0-9_-]+\.btc$/;
    return bnsPattern.test(name.toLowerCase());
}

/**
 * Processes a Twitter reply to extract and resolve BNS information
 */
export async function processBNSFromReply(handle: string, displayName: string): Promise<{
    bnsName: string | null;
    resolution: BNSResolutionResult | null;
}> {
    const bnsName = extractBNSName(handle, displayName);
    
    if (!bnsName) {
        return { bnsName: null, resolution: null };
    }
    
    if (!isValidBNSFormat(bnsName)) {
        return { 
            bnsName, 
            resolution: {
                bnsName,
                success: false,
                error: 'Invalid BNS name format - must end with .btc'
            }
        };
    }
    
    const resolution = await resolveBNSToAddress(bnsName);
    return { bnsName, resolution };
}