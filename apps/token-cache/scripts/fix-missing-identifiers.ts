// Fix missing token identifiers by fetching them from contract interfaces
import { listTokens, getTokenMetadataCached } from '@repo/tokens';
import { getContractInterface } from '@repo/polyglot';
import { updateCachedTokenData } from '../src/app/actions';

interface IdentifierFixResult {
    contractId: string;
    currentIdentifier?: string;
    newIdentifier?: string;
    status: 'fixed' | 'no_change' | 'error' | 'not_found' | 'update_failed';
    error?: string;
    updateError?: string;
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

async function getIdentifierForSubnetToken(token: any): Promise<string | undefined> {
    if (!token.base) {
        console.warn(`SUBNET token ${token.contractId} missing base property`);
        return undefined;
    }

    try {
        // Get the metadata for the base token
        const baseToken = await getTokenMetadataCached(token.base);
        if (baseToken && baseToken.identifier) {
            return baseToken.identifier;
        }
        
        // If base token doesn't have identifier, try to get it from contract
        const baseIdentifier = await getTokenIdentifierFromContract(token.base);
        return baseIdentifier;
    } catch (error) {
        console.warn(`Failed to get identifier for SUBNET base token ${token.base}:`, error);
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

        // Helper function to detect SUBNET tokens by naming convention
        const isSubnetToken = (token: any): boolean => {
            return token.type === 'SUBNET' || 
                   token.contractId.includes('-subnet-') || 
                   token.contractId.includes('subnet-v');
        };

        // Get statistics about token types
        const allMissingIdentifiers = tokens.filter(token => 
            !token.identifier || token.identifier.trim() === ''
        );
        const sublinkTokens = allMissingIdentifiers.filter(token => token.type === 'SUBLINK');
        const subnetTokens = allMissingIdentifiers.filter(token => isSubnetToken(token));
        const energyTokens = allMissingIdentifiers.filter(token => token.type === 'ENERGY');
        const regularTokens = allMissingIdentifiers.filter(token => 
            token.type !== 'SUBLINK' && 
            !isSubnetToken(token) && 
            token.type !== 'ENERGY'
        );

        console.log(`📊 Tokens without identifiers breakdown:`);
        console.log(`  Total missing identifiers: ${allMissingIdentifiers.length}`);
        console.log(`  SUBLINK tokens (ignored): ${sublinkTokens.length}`);
        console.log(`  SUBNET tokens (use base): ${subnetTokens.length}`);
        console.log(`  ENERGY tokens (ignored): ${energyTokens.length}`);
        console.log(`  Regular tokens: ${regularTokens.length}`);
        console.log('');

        // Filter tokens with missing or empty identifiers
        // SUBLINK and ENERGY tokens don't need identifiers and can be ignored
        const tokensNeedingIdentifiers = tokens.filter(token => 
            (!token.identifier || token.identifier.trim() === '') && 
            token.type !== 'SUBLINK' && 
            token.type !== 'ENERGY'
        );

        console.log(`🔍 Found ${tokensNeedingIdentifiers.length} tokens missing identifiers (excluding SUBLINK and ENERGY):`);
        tokensNeedingIdentifiers.forEach(token => {
            const typeInfo = isSubnetToken(token) ? ` [SUBNET - base: ${token.base || 'not set'}]` : '';
            console.log(`  - ${token.contractId} (${token.name} - ${token.symbol})${typeInfo}`);
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
                let newIdentifier: string | undefined;
                
                // Check if this is a SUBNET token
                if (isSubnetToken(token)) {
                    console.log(`  🔗 SUBNET token detected, checking base token: ${token.base || 'not set'}`);
                    newIdentifier = await getIdentifierForSubnetToken(token);
                    if (newIdentifier) {
                        console.log(`  ✅ Found identifier from base token: "${newIdentifier}"`);
                    } else {
                        console.log(`  ❌ No identifier found in base token`);
                    }
                } else {
                    // Regular token, get identifier from contract interface
                    newIdentifier = await getTokenIdentifierFromContract(token.contractId);
                    if (newIdentifier) {
                        console.log(`  ✅ Found identifier: "${newIdentifier}"`);
                    } else {
                        console.log(`  ❌ No identifier found in contract interface`);
                    }
                }
                
                if (newIdentifier) {
                    let updateResult: IdentifierFixResult = {
                        contractId: token.contractId,
                        currentIdentifier: token.identifier,
                        newIdentifier,
                        status: 'fixed'
                    };

                    // If not in dry run mode, actually update the metadata
                    if (!dryRun) {
                        console.log(`  📝 Updating metadata for ${token.contractId}...`);
                        
                        try {
                            // Update only the identifier field - updateCachedTokenData will merge with existing data
                            const updateResponse = await updateCachedTokenData(token.contractId, {
                                identifier: newIdentifier
                            });
                            
                            if (updateResponse.success) {
                                console.log(`  ✅ Successfully updated metadata for ${token.contractId}`);
                            } else {
                                console.log(`  ❌ Failed to update metadata: ${updateResponse.error}`);
                                updateResult.status = 'update_failed';
                                updateResult.updateError = updateResponse.error;
                            }
                        } catch (updateError: any) {
                            console.log(`  ❌ Error updating metadata: ${updateError.message}`);
                            updateResult.status = 'update_failed';
                            updateResult.updateError = updateError.message;
                        }
                    }
                    
                    results.push(updateResult);
                } else {
                    results.push({
                        contractId: token.contractId,
                        currentIdentifier: token.identifier,
                        status: 'not_found'
                    });
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
        const updateFailedCount = results.filter(r => r.status === 'update_failed').length;

        console.log(`Fixed identifiers: ${fixedCount}`);
        console.log(`Not found in contract: ${notFoundCount}`);
        console.log(`Errors: ${errorCount}`);
        if (!dryRun) {
            console.log(`Update failures: ${updateFailedCount}`);
        }
        console.log('');

        // Show successful fixes
        const fixedResults = results.filter(r => r.status === 'fixed');
        if (fixedResults.length > 0) {
            const title = dryRun ? '✅ IDENTIFIERS FOUND (DRY RUN):' : '✅ SUCCESSFULLY FIXED IDENTIFIERS:';
            console.log(title);
            console.log('─'.repeat(50));
            fixedResults.forEach(result => {
                console.log(`${result.contractId}`);
                console.log(`  New identifier: "${result.newIdentifier}"`);
            });
            console.log('');
        }

        // Show update failures (only in live mode)
        if (!dryRun) {
            const updateFailedResults = results.filter(r => r.status === 'update_failed');
            if (updateFailedResults.length > 0) {
                console.log('❌ FAILED TO UPDATE METADATA:');
                console.log('─'.repeat(50));
                updateFailedResults.forEach(result => {
                    console.log(`${result.contractId}`);
                    console.log(`  Found identifier: "${result.newIdentifier}"`);
                    console.log(`  Update error: ${result.updateError}`);
                });
                console.log('');
            }
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
            console.log('✅ LIVE MODE: Token metadata has been updated in the cache.');
            if (updateFailedCount > 0) {
                console.log(`⚠️  ${updateFailedCount} token(s) had update failures - please check the errors above.`);
            }
            if (fixedCount > 0) {
                console.log(`🎉 Successfully updated ${fixedCount} token identifiers!`);
            }
        }

        console.log('');
        console.log('🎯 NEXT STEPS:');
        console.log('1. Review the results above');
        if (dryRun) {
            console.log('2. Run in live mode to apply the changes: pnpm script fix-missing-identifiers live');
            console.log('3. For tokens requiring manual attention, investigate contract structure');
        } else {
            console.log('2. For tokens requiring manual attention, investigate contract structure');
            console.log('3. For update failures, check the error messages and try manual updates');
        }
        console.log('4. Consider implementing automatic identifier updates in your cache refresh process');
        
    } catch (error: any) {
        console.error('❌ Error during identifier fixing:', error.message);
    }
}

// Get command line argument for dry run vs live mode
const mode = process.argv[2] || 'dry-run';
const isLiveMode = mode === 'live';

fixMissingIdentifiers(!isLiveMode);