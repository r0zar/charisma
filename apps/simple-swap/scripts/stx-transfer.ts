#!/usr/bin/env node

/**
 * STX Transfer Script
 * 
 * Performs a 1 microSTX transfer to a target address with a custom nonce
 * 
 * Usage:
 *   pnpm script scripts/stx-transfer.ts --target=SP1234... --nonce=123
 *   pnpm script scripts/stx-transfer.ts --target=SP1234... --nonce=123 --memo="Test transfer"
 *   pnpm script scripts/stx-transfer.ts --help
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '../.env.local') });

import { makeSTXTokenTransfer, broadcastTransaction, AnchorMode, PostConditionMode } from '@stacks/transactions';

interface ScriptArgs {
    target?: string;
    nonce?: number;
    memo?: string;
    help?: boolean;
}

function parseArgs(args: string[]): ScriptArgs {
    const parsed: ScriptArgs = {};
    
    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
        } else if (arg.startsWith('--target=')) {
            parsed.target = arg.split('=')[1];
        } else if (arg.startsWith('--nonce=')) {
            const nonce = parseInt(arg.split('=')[1]);
            if (isNaN(nonce) || nonce < 0) {
                throw new Error('Invalid nonce value. Must be a non-negative number.');
            }
            parsed.nonce = nonce;
        } else if (arg.startsWith('--memo=')) {
            parsed.memo = arg.split('=')[1];
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    
    return parsed;
}

function showHelp() {
    console.log(`
💰 STX Transfer Script

This script performs a 1 microSTX transfer to a target address with a custom nonce.

Usage:
  pnpm script stx-transfer [options]

Options:
  --target=ADDRESS    Target Stacks address (required)
  --nonce=NUMBER      Custom nonce to use for the transaction (required)
  --memo=TEXT         Optional memo for the transfer (default: "Script transfer")
  --help, -h          Show this help message

Examples:
  pnpm script stx-transfer --target=SP1234567890ABCDEF --nonce=123
  pnpm script stx-transfer --target=SP1234567890ABCDEF --nonce=123 --memo="Test transfer"

Environment Variables:
  Make sure your .env.local file contains:
  - BLAZE_SIGNER_PRIVATE_KEY

Notes:
  - This script transfers exactly 1 microSTX (0.000001 STX)
  - The transaction will be broadcast to mainnet
  - Make sure the nonce is correct to avoid conflicts
`);
}

function validateStacksAddress(address: string): boolean {
    // Basic validation for Stacks addresses
    return /^SP[0-9A-HJKMNP-Z]{39}$/.test(address);
}

async function main() {
    const args = process.argv.slice(2);
    
    try {
        const options = parseArgs(args);
        
        if (options.help) {
            showHelp();
            return;
        }
        
        // Validate required arguments
        if (!options.target) {
            throw new Error('Target address is required. Use --target=ADDRESS');
        }
        
        if (options.nonce === undefined) {
            throw new Error('Nonce is required. Use --nonce=NUMBER');
        }
        
        if (!validateStacksAddress(options.target)) {
            throw new Error('Invalid Stacks address format. Address should start with SP and be 41 characters long.');
        }
        
        const BLAZE_SIGNER_PRIVATE_KEY = process.env.BLAZE_SIGNER_PRIVATE_KEY;
        if (!BLAZE_SIGNER_PRIVATE_KEY) {
            throw new Error('BLAZE_SIGNER_PRIVATE_KEY environment variable not set. Check your .env.local file.');
        }
        
        const memo = options.memo || 'Script transfer';
        
        console.log(`💰 STX Transfer Script`);
        console.log(`📍 Target: ${options.target}`);
        console.log(`🔢 Nonce: ${options.nonce}`);
        console.log(`📝 Memo: ${memo}`);
        console.log(`💵 Amount: 1 microSTX`);
        console.log('');
        
        // Create the transaction
        console.log('🔨 Creating transaction...');
        
        const txOptions = {
            recipient: options.target,
            amount: 1, // 1 microSTX
            senderKey: BLAZE_SIGNER_PRIVATE_KEY,
            network: 'mainnet' as const,
            memo: memo,
            nonce: options.nonce,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow
        };
        
        const transaction = await makeSTXTokenTransfer(txOptions);
        console.log('✅ Transaction created successfully');
        
        // Broadcast the transaction
        console.log('📡 Broadcasting transaction...');
        const broadcastResponse = await broadcastTransaction({ transaction });
        
        console.log('✅ Transaction broadcast successful!');
        console.log('');
        console.log(`📋 Transaction Details:`);
        console.log(`   Transaction ID: ${broadcastResponse.txid}`);
        console.log(`   Target: ${options.target}`);
        console.log(`   Amount: 1 microSTX`);
        console.log(`   Nonce: ${options.nonce}`);
        console.log(`   Memo: ${memo}`);
        console.log('');
        console.log(`🔗 View on Explorer:`);
        console.log(`   https://explorer.stacks.co/txid/${broadcastResponse.txid}?chain=mainnet`);
        
    } catch (error) {
        console.error('❌ Script error:', error);
        console.log('');
        console.log('💡 Tips:');
        console.log('   - Make sure your .env.local file has BLAZE_SIGNER_PRIVATE_KEY set');
        console.log('   - Verify the target address is a valid Stacks address');
        console.log('   - Check that the nonce is not already used');
        console.log('   - Run with --help for usage information');
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});