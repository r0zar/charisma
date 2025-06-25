// Fix missing token identifiers by fetching them from contract interfaces
import { listTokens, getTokenMetadataCached } from '@repo/tokens';
import { getContractInterface } from '@repo/polyglot';

interface IdentifierFixResult {
    contractId: string;
    currentIdentifier?: string;
    newIdentifier?: string;
    status: 'fixed' | 'no_change' | 'error' | 'not_found';
    error?: string;
}

async function getTokenIdentifierFromContract(contractId: string): Promise<string | undefined> {
    try {
        const [contractAddress, contractName] = contractId.split('.');
        if (!contractAddress || !contractName) {
            console.warn(`Invalid contractId: ${contractId}`);
            return undefined;
        }

        const contractInterface = await getContractInterface(contractAddress, contractName);
        
        if (contractInterface && contractInterface.fungible_tokens && Array.isArray(contractInterface.fungible_tokens) && contractInterface.fungible_tokens.length > 0) {
            // Extract the first fungible token identifier
            const fungibleToken = contractInterface.fungible_tokens[0] as any;
            if (fungibleToken && typeof fungibleToken === 'object' && fungibleToken.name) {
                return fungibleToken.name;
            }
        }

        return undefined;
    } catch (error) {
        console.warn(`Failed to get identifier for ${contractId}:`, error);
        return undefined;
    }
}

async function fixMissingIdentifiers(dryRun: boolean = true) {
    console.log('🔧 Fixing Missing Token Identifiers');
    console.log(`Mode: ${dryRun ? 'DRY RUN (read-only)' : 'LIVE (will make changes)'}`);
    console.log('');
    
    console.log('🔧 Environment Check:');
    console.log(`  TOKEN_CACHE_URL: ${process.env.TOKEN_CACHE_URL || process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'}`);
    console.log('');

    try {
        console.log('📥 Fetching all tokens...');
        const tokens = await listTokens();
        console.log(`Found ${tokens.length} tokens`);
        console.log('');

        // Filter tokens with missing or empty identifiers
        const tokensNeedingIdentifiers = tokens.filter(token => 
            !token.identifier || token.identifier.trim() === ''
        );

        console.log(`🔍 Found ${tokensNeedingIdentifiers.length} tokens missing identifiers:`);
        tokensNeedingIdentifiers.forEach(token => {
            console.log(`  - ${token.contractId} (${token.name} - ${token.symbol})`);
        });
        console.log('');

        if (tokensNeedingIdentifiers.length === 0) {
            console.log('✅ All tokens already have identifiers!');
            return;
        }

        console.log('🔄 Attempting to fetch identifiers from contract interfaces...');
        const results: IdentifierFixResult[] = [];

        for (const token of tokensNeedingIdentifiers) {
            console.log(`Processing ${token.contractId}...`);
            
            try {
                const newIdentifier = await getTokenIdentifierFromContract(token.contractId);
                
                if (newIdentifier) {
                    results.push({
                        contractId: token.contractId,
                        currentIdentifier: token.identifier,
                        newIdentifier,
                        status: 'fixed'
                    });
                    console.log(`  ✅ Found identifier: "${newIdentifier}"`);
                } else {
                    results.push({
                        contractId: token.contractId,
                        currentIdentifier: token.identifier,
                        status: 'not_found'
                    });
                    console.log(`  ❌ No identifier found in contract interface`);
                }
            } catch (error: any) {
                results.push({
                    contractId: token.contractId,
                    currentIdentifier: token.identifier,
                    status: 'error',
                    error: error.message
                });
                console.log(`  ❌ Error: ${error.message}`);
            }
        }

        console.log('');
        console.log('📊 RESULTS SUMMARY:');
        console.log('═'.repeat(50));

        const fixedCount = results.filter(r => r.status === 'fixed').length;
        const notFoundCount = results.filter(r => r.status === 'not_found').length;
        const errorCount = results.filter(r => r.status === 'error').length;

        console.log(`Fixed identifiers: ${fixedCount}`);
        console.log(`Not found in contract: ${notFoundCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('');

        // Show successful fixes
        const fixedResults = results.filter(r => r.status === 'fixed');
        if (fixedResults.length > 0) {
            console.log('✅ SUCCESSFULLY FIXED IDENTIFIERS:');
            console.log('─'.repeat(50));
            fixedResults.forEach(result => {
                console.log(`${result.contractId}`);
                console.log(`  New identifier: "${result.newIdentifier}"`);
            });
            console.log('');
        }

        // Show tokens that need manual attention
        const manualResults = results.filter(r => r.status === 'not_found');
        if (manualResults.length > 0) {
            console.log('⚠️  TOKENS REQUIRING MANUAL ATTENTION:');
            console.log('─'.repeat(50));
            manualResults.forEach(result => {
                console.log(`${result.contractId}`);
                console.log(`  Reason: No fungible tokens found in contract interface`);
            });
            console.log('');
            console.log('💡 These tokens may need manual identifier assignment or may not be standard SIP-10 tokens.');
        }

        // Show errors
        const errorResults = results.filter(r => r.status === 'error');
        if (errorResults.length > 0) {
            console.log('❌ ERRORS:');
            console.log('─'.repeat(50));
            errorResults.forEach(result => {
                console.log(`${result.contractId}`);
                console.log(`  Error: ${result.error}`);
            });
            console.log('');
        }

        if (dryRun) {
            console.log('🔄 This was a DRY RUN. To apply these changes, run:');
            console.log('  pnpm script fix-missing-identifiers live');
        } else {
            console.log('⚠️  LIVE MODE: In a real implementation, this would update the token cache with the new identifiers.');
            console.log('💡 You would need to implement API calls to update the token metadata in your cache.');
        }

        console.log('');
        console.log('🎯 NEXT STEPS:');
        console.log('1. Review the results above');
        console.log('2. For tokens with found identifiers, update your token cache');
        console.log('3. For tokens requiring manual attention, investigate contract structure');
        console.log('4. Consider implementing automatic identifier updates in your cache refresh process');
        
    } catch (error: any) {
        console.error('❌ Error during identifier fixing:', error.message);
    }
}

// Get command line argument for dry run vs live mode
const mode = process.argv[2] || 'dry-run';
const isLiveMode = mode === 'live';

fixMissingIdentifiers(!isLiveMode);