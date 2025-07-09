#!/usr/bin/env node

/**
 * Check order status script
 * 
 * Usage:
 *   pnpm script scripts/check-order-status.ts
 *   pnpm script scripts/check-order-status.ts --hours=12
 *   pnpm script scripts/check-order-status.ts --verbose
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '../.env.local') });

import { kv } from '@vercel/kv';
import { getOrdersNeedingMonitoring } from '../src/lib/transaction-monitor';
import { TxMonitorClient } from '@repo/tx-monitor-client';

interface ScriptArgs {
    hours?: number;
    verbose?: boolean;
    help?: boolean;
}

function parseArgs(args: string[]): ScriptArgs {
    const parsed: ScriptArgs = {};
    
    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
        } else if (arg === '--verbose' || arg === '-v') {
            parsed.verbose = true;
        } else if (arg.startsWith('--hours=')) {
            const hours = parseInt(arg.split('=')[1]);
            if (isNaN(hours) || hours <= 0) {
                throw new Error('Invalid hours value. Must be a positive number.');
            }
            parsed.hours = hours;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    
    return parsed;
}

function showHelp() {
    console.log(`
📊 Check Order Status Script

This script checks the status of orders in the monitoring queue.

Usage:
  pnpm script check-order-status [options]

Options:
  --hours=N       Show only orders older than N hours (default: show all)
  --verbose, -v   Show detailed output including transaction IDs
  --help, -h      Show this help message

Examples:
  pnpm script check-order-status
  pnpm script check-order-status --hours=24
  pnpm script check-order-status --verbose

Environment Variables:
  Make sure your .env.local file contains:
  - KV_REST_API_URL
  - KV_REST_API_TOKEN
`);
}

function formatAge(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (60 * 60 * 1000));
    const minutes = Math.floor((milliseconds % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours === 0) {
        return `${minutes}m`;
    } else if (minutes === 0) {
        return `${hours}h`;
    } else {
        return `${hours}h ${minutes}m`;
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    try {
        const options = parseArgs(args);
        
        if (options.help) {
            showHelp();
            return;
        }
        
        const minAgeHours = options.hours;
        const minAge = minAgeHours ? minAgeHours * 60 * 60 * 1000 : 0;
        const now = Date.now();
        
        console.log(`📊 Checking order status${minAgeHours ? ` (older than ${minAgeHours} hours)` : ''}...`);
        
        if (options.verbose) {
            console.log('📝 Verbose mode enabled');
        }
        
        console.log('');
        
        // Check KV connection
        try {
            await kv.ping();
            console.log('✅ KV connection successful');
        } catch (error) {
            console.error('❌ KV connection failed:', error);
            console.log('💡 Make sure KV_REST_API_URL and KV_REST_API_TOKEN are set in .env.local');
            process.exit(1);
        }
        
        // Initialize tx-monitor client
        const txMonitorClient = new TxMonitorClient();
        
        // Test tx-monitor client connection
        try {
            const health = await txMonitorClient.getHealthCheck();
            console.log(`✅ TX Monitor service: ${health.api === 'healthy' ? 'healthy' : 'unhealthy'}`);
        } catch (error) {
            console.warn('⚠️  TX Monitor service unavailable (will show limited info)');
        }
        
        // Get all orders that need monitoring
        const ordersToCheck = await getOrdersNeedingMonitoring();
        
        if (ordersToCheck.length === 0) {
            console.log('✅ No orders need monitoring');
            return;
        }
        
        console.log(`📊 Found ${ordersToCheck.length} orders being monitored`);
        
        // Filter by age if specified
        const filteredOrders = ordersToCheck.filter(({ order }) => {
            const orderAge = now - new Date(order.createdAt).getTime();
            return orderAge >= minAge;
        });
        
        if (filteredOrders.length === 0) {
            console.log(`✅ No orders ${minAgeHours ? `older than ${minAgeHours} hours` : 'to show'}`);
            return;
        }
        
        console.log(`🎯 ${filteredOrders.length} orders to check:`);
        console.log('');
        
        // Group by age categories
        const categories = {
            recent: [] as any[],      // < 1 hour
            normal: [] as any[],      // 1-24 hours
            old: [] as any[],         // 24+ hours
            veryOld: [] as any[]      // 48+ hours
        };
        
        for (const { uuid, order } of filteredOrders) {
            const orderAge = now - new Date(order.createdAt).getTime();
            const ageHours = orderAge / (60 * 60 * 1000);
            
            const item = {
                uuid,
                order,
                age: orderAge,
                ageHours: Math.round(ageHours * 10) / 10,
                createdAt: order.createdAt,
                txid: order.txid
            };
            
            if (ageHours < 1) {
                categories.recent.push(item);
            } else if (ageHours < 24) {
                categories.normal.push(item);
            } else if (ageHours < 48) {
                categories.old.push(item);
            } else {
                categories.veryOld.push(item);
            }
        }
        
        // Show summary
        console.log('📈 Age Distribution:');
        console.log(`   < 1 hour:   ${categories.recent.length} orders`);
        console.log(`   1-24 hours: ${categories.normal.length} orders`);
        console.log(`   24-48 hours: ${categories.old.length} orders`);
        console.log(`   48+ hours:  ${categories.veryOld.length} orders`);
        console.log('');
        
        // Show detailed breakdown
        const allOrders = [...categories.recent, ...categories.normal, ...categories.old, ...categories.veryOld];
        
        if (options.verbose) {
            console.log('📋 Detailed Order List:');
            
            for (const { uuid, ageHours, createdAt, txid, order } of allOrders) {
                const shortUuid = uuid.substring(0, 8);
                const shortTxid = txid ? txid.substring(0, 16) + '...' : 'N/A';
                const ageIcon = ageHours < 1 ? '🟢' : ageHours < 24 ? '🟡' : ageHours < 48 ? '🟠' : '🔴';
                
                console.log(`  ${ageIcon} ${shortUuid} (${ageHours}h) - TX: ${shortTxid}`);
                console.log(`     Created: ${new Date(createdAt).toLocaleString()}`);
                console.log(`     Owner: ${order.owner}`);
                console.log(`     Status: ${order.status}`);
                
                // Try to get live transaction status
                try {
                    const txStatus = await txMonitorClient.getTransactionStatus(txid);
                    console.log(`     TX Status: ${txStatus.status} (${txStatus.fromCache ? 'cached' : 'live'})`);
                } catch (error) {
                    console.log(`     TX Status: Unable to check (${error.message})`);
                }
                
                console.log('');
            }
        } else {
            // Show summary format
            console.log('📋 Order Summary:');
            
            for (const { uuid, ageHours, createdAt } of allOrders) {
                const shortUuid = uuid.substring(0, 8);
                const ageIcon = ageHours < 1 ? '🟢' : ageHours < 24 ? '🟡' : ageHours < 48 ? '🟠' : '🔴';
                const createdDate = new Date(createdAt).toLocaleDateString();
                
                console.log(`  ${ageIcon} ${shortUuid} - ${ageHours}h old (${createdDate})`);
            }
        }
        
        console.log('');
        
        // Show recommendations
        if (categories.veryOld.length > 0) {
            console.log('🚨 Recommendations:');
            console.log(`   • ${categories.veryOld.length} orders are 48+ hours old and should be cleaned up`);
            console.log('   • Run: pnpm script cleanup-old-orders --hours=48');
        } else if (categories.old.length > 0) {
            console.log('⚠️  Recommendations:');
            console.log(`   • ${categories.old.length} orders are 24+ hours old`);
            console.log('   • Consider running: pnpm script cleanup-old-orders --hours=24');
        } else {
            console.log('✅ All orders are within normal age ranges');
        }
        
    } catch (error) {
        console.error('❌ Script error:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});