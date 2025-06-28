#!/usr/bin/env tsx

import { kv } from "@vercel/kv";

/**
 * Script to directly check KV store for synced LP token metadata
 * This bypasses the token-cache API and looks directly at the KV data
 */

async function checkKvDirect() {
    console.log('🔍 Checking KV store directly for synced LP token metadata...\n');

    // Get the list of LP tokens we synced (these are the ones with real images)
    const lpContractIds = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.synthetic-welsh',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.experience',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.liquid-staked-charisma',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dme000-governance-token',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.age000-governance-token',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wstx',
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.wcha',
        'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
        'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token',
        'SP466FNC0P7JWTNM2R9T199QRZN1MYEDTAR0KP27.minotaur-token',
        'SP27BB1Y2DGSXZHS7G9YHKTSH6KQ6BD3QG0AN3CR9.slime-token',
        'SP2TZK01NKDC89J6TA56SA47SDF7RTHYEQ79AAB9A.Wrapped-Bitcoin',
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc',
        'SP3D6PV2ACBPEKYJTCMH7HEN02KP87QSP8KTEH335.mega',
        'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',
        'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.slp-token',
        'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx',
        'SP3MBWGMCVC9KZ5DTAYFMG1D0AEJCR7NENTM3FTK4.stacking-dao-core-v1',
        'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
        'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
        'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.stsw-token',
        'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token',
        'SP3YXJZ4DZ6V11WE92WNCFH8N9D6XTMX2E0YHJS11.sts-token',
        'SP3AQBJ0WGSPD8X6DJBP0PYAWT8T04VBBS98C73BS.token-9bba57ac-6e2e-5c3d-a6f8-9ae55e6d0b02',
        'SP1KMAA7TPZ5AZZ9JDADBE8ATBHQV9R6E5VKG99V0.slm-cha-lp-01',
        'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.cwss-token',
        'SP2AKWJYC7BNY18W1XXKPGP0YVEK63QJG4793Z2D4.sip-010-trait-ft-standard',
        'SPM1Q7YG18378H6W254YN8PABEVRPT38ZCY01SJD.the-explorer-guild',
        'SP3M2SYQPKHY2XVS57KZYSS8BCDVEV76MP0XR3CHK.bit-token'
    ];

    console.log(`Checking ${lpContractIds.length} LP token contract IDs...\n`);

    // Check different key patterns
    const keyPatterns = [
        'token-metadata:', // Pattern used by sync script
        'sip10:', // Pattern used by token-cache service
        'metadata:', // Alternative pattern
        'dex-vault:' // Vault pattern
    ];

    let foundCount = 0;
    let totalChecked = 0;

    for (const contractId of lpContractIds) {
        console.log(`\n📋 ${contractId}:`);
        let foundAny = false;

        for (const pattern of keyPatterns) {
            const key = pattern + contractId;
            try {
                const data = await kv.get(key);
                totalChecked++;
                
                if (data) {
                    foundCount++;
                    foundAny = true;
                    console.log(`  ✅ Found at ${key}`);
                    
                    if (typeof data === 'object' && data !== null) {
                        const obj = data as any;
                        if (obj.image) {
                            console.log(`     Image: ${obj.image}`);
                        }
                        if (obj.name) {
                            console.log(`     Name: ${obj.name}`);
                        }
                        if (obj.symbol) {
                            console.log(`     Symbol: ${obj.symbol}`);
                        }
                    }
                } else {
                    console.log(`  ❌ Not found at ${key}`);
                }
            } catch (error) {
                console.log(`  ⚠️  Error checking ${key}: ${error}`);
            }
        }

        if (!foundAny) {
            console.log(`  🚫 No data found for ${contractId} in any pattern`);
        }
    }

    console.log(`\n📊 Summary:`);
    console.log(`Total keys checked: ${totalChecked}`);
    console.log(`Keys with data found: ${foundCount}`);
    console.log(`Success rate: ${totalChecked > 0 ? ((foundCount / totalChecked) * 100).toFixed(1) : 0}%`);

    // Also check the managed token list
    console.log(`\n🔍 Checking managed token lists:`);
    
    const tokenListKeys = [
        'token-list:sip10',
        'token-list:vault',
        'token-list:dex'
    ];

    for (const listKey of tokenListKeys) {
        try {
            const list = await kv.get<string[]>(listKey);
            if (list && Array.isArray(list)) {
                console.log(`\n📋 ${listKey}: ${list.length} tokens`);
                
                // Check how many of our LP tokens are in this list
                const lpTokensInList = lpContractIds.filter(id => list.includes(id));
                console.log(`  LP tokens in this list: ${lpTokensInList.length}/${lpContractIds.length}`);
                
                if (lpTokensInList.length > 0) {
                    console.log(`  Examples: ${lpTokensInList.slice(0, 3).join(', ')}${lpTokensInList.length > 3 ? '...' : ''}`);
                }
            } else {
                console.log(`\n📋 ${listKey}: Not found or not an array`);
            }
        } catch (error) {
            console.log(`\n📋 ${listKey}: Error - ${error}`);
        }
    }
}

checkKvDirect().catch(console.error);