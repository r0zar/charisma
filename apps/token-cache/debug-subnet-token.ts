#!/usr/bin/env tsx

import { Cryptonomicon } from "./src/lib/cryptonomicon";

const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1';

async function debugSubnetToken() {
    console.log(`🔍 Debugging SUBNET token: ${contractId}`);
    console.log('Testing direct metadata retrieval...\n');
    
    const cryptonomicon = new Cryptonomicon({
        debug: true,
        apiKey: process.env.HIRO_API_KEY,
    });
    
    try {
        console.log('1. Testing getTokenIdentifier()...');
        const identifier = await cryptonomicon.getTokenIdentifier(contractId);
        console.log(`   Identifier: ${identifier}`);
        
        console.log('\n2. Testing getTokenName()...');
        const name = await cryptonomicon.getTokenName(contractId);
        console.log(`   Name: ${name}`);
        
        console.log('\n3. Testing getTokenSymbol()...');
        const symbol = await cryptonomicon.getTokenSymbol(contractId);
        console.log(`   Symbol: ${symbol}`);
        
        console.log('\n4. Testing getTokenDecimals()...');
        const decimals = await cryptonomicon.getTokenDecimals(contractId);
        console.log(`   Decimals: ${decimals}`);
        
        console.log('\n5. Testing getTokenUri()...');
        const tokenUri = await cryptonomicon.getTokenUri(contractId);
        console.log(`   Token URI: ${tokenUri}`);
        
        console.log('\n6. Testing getTokenSupply()...');
        const supply = await cryptonomicon.getTokenSupply(contractId);
        console.log(`   Supply: ${supply}`);
        
        console.log('\n7. Testing full getTokenMetadata()...');
        const metadata = await cryptonomicon.getTokenMetadata(contractId);
        
        if (metadata) {
            console.log('✅ Full metadata retrieved:');
            console.log(JSON.stringify(metadata, null, 2));
            
            console.log('\n🔍 Key fields for base token lookup:');
            console.log(`   identifier: "${metadata.identifier}"`);
            console.log(`   type: "${metadata.type}"`);
            console.log(`   base: "${(metadata as any).base}"`);
            console.log(`   tokenAContract: "${(metadata as any).tokenAContract}"`);
            console.log(`   tokenBContract: "${(metadata as any).tokenBContract}"`);
            
            // Check for any field that might indicate a base token
            const allFields = Object.keys(metadata);
            console.log('\n📋 All metadata fields:');
            allFields.forEach(field => {
                const value = (metadata as any)[field];
                console.log(`   ${field}: ${typeof value === 'string' ? `"${value}"` : value}`);
            });
        } else {
            console.log('❌ No metadata found');
        }
        
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

debugSubnetToken();