#!/usr/bin/env tsx

import { fetchMetadata } from '@repo/tokens';

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
    tokenAContract?: string | null;
    tokenBContract?: string | null;
    lpRebatePercent?: number | null;
    externalPoolId?: string | null;
    engineContractId?: string | null;
    base?: string | null;
}

async function listAllTokenMetadata() {
    console.log('Fetching all token metadata from @repo/tokens...\n');

    try {
        // Fetch all metadata using fetchMetadata from @repo/tokens
        const metadataList: TokenMetadata[] = await fetchMetadata();
        
        if (metadataList.length === 0) {
            console.log('No token metadata found.');
            return;
        }

        console.log(`Found ${metadataList.length} tokens with metadata.\n`);

        // Display header
        console.log('ContractId\t\t\t\t\t\t\t\tImage\t\t\t\t\t\t\t\tType\tSymbol\tName');
        console.log('─'.repeat(200));

        // Display each token's metadata
        for (const token of metadataList) {
            const contractId = (token.contractId || 'N/A').padEnd(70, ' ');
            const image = (token.image || 'N/A').padEnd(80, ' ');
            const type = (token.type || 'N/A').padEnd(8, ' ');
            const symbol = (token.symbol || 'N/A').padEnd(12, ' ');
            const name = token.name || 'N/A';
            
            console.log(`${contractId}\t${image}\t${type}\t${symbol}\t${name}`);
        }

        console.log('\n' + '='.repeat(120));
        console.log('DETAILED METADATA SUMMARY');
        console.log('='.repeat(120));

        // Group tokens by type
        const tokensByType = metadataList.reduce((acc, token) => {
            const type = token.type || 'UNKNOWN';
            if (!acc[type]) acc[type] = [];
            acc[type].push(token);
            return acc;
        }, {} as Record<string, TokenMetadata[]>);

        console.log('\nTOKEN TYPES BREAKDOWN:');
        console.log('─'.repeat(50));
        Object.entries(tokensByType)
            .sort(([,a], [,b]) => b.length - a.length)
            .forEach(([type, tokens]) => {
                console.log(`${type}: ${tokens.length} tokens`);
            });

        // Show sample tokens from each type
        console.log('\nSAMPLE TOKENS BY TYPE:');
        console.log('─'.repeat(50));
        Object.entries(tokensByType).forEach(([type, tokens]) => {
            console.log(`\n${type} (${tokens.length} tokens):`);
            tokens.slice(0, 3).forEach(token => {
                console.log(`  • ${token.symbol} - ${token.name}`);
                console.log(`    Contract: ${token.contractId}`);
                console.log(`    Image: ${token.image || 'None'}`);
                if (token.decimals) console.log(`    Decimals: ${token.decimals}`);
                if (token.total_supply) console.log(`    Supply: ${token.total_supply}`);
                if (token.lpRebatePercent) console.log(`    LP Rebate: ${token.lpRebatePercent}%`);
                console.log('');
            });
            if (tokens.length > 3) {
                console.log(`  ... and ${tokens.length - 3} more\n`);
            }
        });

        // Statistics
        console.log('STATISTICS:');
        console.log('─'.repeat(50));
        console.log(`Total tokens: ${metadataList.length}`);
        console.log(`With images: ${metadataList.filter(t => t.image && t.image !== 'N/A').length}`);
        console.log(`Without images: ${metadataList.filter(t => !t.image || t.image === 'N/A').length}`);
        console.log(`With descriptions: ${metadataList.filter(t => t.description).length}`);
        console.log(`LP tokens: ${metadataList.filter(t => t.lpRebatePercent !== null).length}`);
        console.log(`Subnet tokens: ${metadataList.filter(t => t.type === 'SUBNET').length}`);
        console.log(`Pool tokens: ${metadataList.filter(t => t.type === 'POOL').length}`);
        console.log(`Energy tokens: ${metadataList.filter(t => t.type === 'ENERGY').length}`);

        // Recent updates
        const recentTokens = metadataList
            .filter(t => t.lastUpdated)
            .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
            .slice(0, 5);

        if (recentTokens.length > 0) {
            console.log('\nRECENTLY UPDATED TOKENS:');
            console.log('─'.repeat(50));
            recentTokens.forEach(token => {
                const date = new Date(token.lastUpdated!).toLocaleString();
                console.log(`${token.symbol} (${token.type}) - Updated: ${date}`);
            });
        }

        // Export option
        console.log('\n💾 To export data to JSON, uncomment the export section below:');
        console.log('// const fs = require("fs");');
        console.log('// fs.writeFileSync("./all-token-metadata.json", JSON.stringify(metadataList, null, 2));');
        
        // Uncomment these lines to export to JSON file:
        // const fs = require('fs');
        // const exportPath = './all-token-metadata.json';
        // fs.writeFileSync(exportPath, JSON.stringify(metadataList, null, 2));
        // console.log(`\n✅ Data exported to ${exportPath}`);

    } catch (error) {
        console.error('Error fetching token metadata:', error);
        process.exit(1);
    }
}

// Run the script
listAllTokenMetadata();