// Fix missing SUBNET type for subnet tokens detected by naming convention
import { listTokens } from '@repo/tokens';
import { updateCachedTokenData } from '../src/app/actions';

interface SubnetFixResult {
    contractId: string;
    currentType?: string;
    status: 'fixed' | 'no_change' | 'error';
    error?: string;
}

async function fixSubnetTypes(dryRun: boolean = true) {
    console.log('🔧 Fixing Missing SUBNET Types');
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
        const isSubnetTokenByNaming = (token: any): boolean => {
            return token.contractId.includes('-subnet-') || 
                   token.contractId.includes('subnet-v');
        };

        // Find tokens that look like subnet tokens but don't have SUBNET type
        const subnetTokensNeedingTypefix = tokens.filter(token => 
            isSubnetTokenByNaming(token) && token.type !== 'SUBNET'
        );

        console.log(`🔍 Found ${subnetTokensNeedingTypefix.length} subnet tokens missing SUBNET type:`);
        subnetTokensNeedingTypefix.forEach(token => {
            console.log(`  - ${token.contractId} (${token.name} - ${token.symbol}) [current type: ${token.type || 'undefined'}]`);
        });
        console.log('');

        if (subnetTokensNeedingTypefix.length === 0) {
            console.log('✅ All subnet tokens already have correct SUBNET type!');
            return;
        }

        console.log('🔄 Updating SUBNET types...');
        const results: SubnetFixResult[] = [];

        for (const token of subnetTokensNeedingTypefix) {
            console.log(`Processing ${token.contractId}...`);
            
            try {
                let result: SubnetFixResult = {
                    contractId: token.contractId,
                    currentType: token.type,
                    status: 'fixed'
                };

                // If not in dry run mode, actually update the metadata
                if (!dryRun) {
                    console.log(`  📝 Updating type to SUBNET for ${token.contractId}...`);
                    
                    // Update only the type field - updateCachedTokenData will merge with existing data
                    const updateResponse = await updateCachedTokenData(token.contractId, {
                        type: 'SUBNET'
                    });
                    
                    if (updateResponse.success) {
                        console.log(`  ✅ Successfully updated type for ${token.contractId}`);
                    } else {
                        console.log(`  ❌ Failed to update type: ${updateResponse.error}`);
                        result.status = 'error';
                        result.error = updateResponse.error;
                    }
                } else {
                    console.log(`  ✅ Would update type to SUBNET for ${token.contractId}`);
                }
                
                results.push(result);
            } catch (error: any) {
                results.push({
                    contractId: token.contractId,
                    currentType: token.type,
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
        const errorCount = results.filter(r => r.status === 'error').length;

        console.log(`Fixed types: ${fixedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('');

        // Show successful fixes
        const fixedResults = results.filter(r => r.status === 'fixed');
        if (fixedResults.length > 0) {
            const title = dryRun ? '✅ TYPES THAT WOULD BE FIXED (DRY RUN):' : '✅ SUCCESSFULLY FIXED TYPES:';
            console.log(title);
            console.log('─'.repeat(50));
            fixedResults.forEach(result => {
                console.log(`${result.contractId}`);
                console.log(`  Previous type: ${result.currentType || 'undefined'} → New type: SUBNET`);
            });
            console.log('');
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
            console.log('  pnpm script fix-subnet-types live');
        } else {
            console.log('✅ LIVE MODE: Token metadata has been updated in the cache.');
            if (errorCount > 0) {
                console.log(`⚠️  ${errorCount} token(s) had update failures - please check the errors above.`);
            }
            if (fixedCount > 0) {
                console.log(`🎉 Successfully updated ${fixedCount} token types to SUBNET!`);
            }
        }

        console.log('');
        console.log('🎯 NEXT STEPS:');
        console.log('1. Review the results above');
        if (dryRun) {
            console.log('2. Run in live mode to apply the changes: pnpm script fix-subnet-types live');
        } else {
            console.log('2. Run the fix-missing-identifiers script again to process SUBNET tokens properly');
        }
        console.log('3. Verify that SUBNET tokens now have correct type and can use base token identifiers');
        
    } catch (error: any) {
        console.error('❌ Error during subnet type fixing:', error.message);
    }
}

// Get command line argument for dry run vs live mode
const mode = process.argv[2] || 'dry-run';
const isLiveMode = mode === 'live';

fixSubnetTypes(!isLiveMode);