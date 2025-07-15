#!/usr/bin/env node

/**
 * Cleanup script for old broadcasted orders
 * 
 * Usage:
 *   pnpm script scripts/cleanup-old-orders.ts
 *   pnpm script scripts/cleanup-old-orders.ts --hours=12
 *   pnpm script scripts/cleanup-old-orders.ts --dry-run
 *   pnpm script scripts/cleanup-old-orders.ts --verbose
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: join(__dirname, '../.env.local') });

import { kv } from '@vercel/kv';
import { cancelOrder } from '../src/lib/orders/store';
import { logger } from './logger';

/**
 * Get orders that need transaction monitoring
 * These are orders with broadcasted transactions that need status checking
 */
async function getOrdersNeedingMonitoring(): Promise<Array<{ uuid: string; order: any }>> {
    const orders = await kv.hgetall('orders') || {};
    const ordersToCheck = [];
    
    for (const [uuid, orderData] of Object.entries(orders)) {
        if (typeof orderData === 'string') {
            try {
                const order = JSON.parse(orderData);
                
                // Only monitor orders with broadcasted transactions
                if (order.status === 'broadcasted' && order.txid) {
                    ordersToCheck.push({ uuid, order });
                }
            } catch (error) {
                console.error(`Error parsing order ${uuid}:`, error);
            }
        }
    }
    
    return ordersToCheck;
}

interface ScriptArgs {
    hours?: number;
    days?: number;
    dryRun?: boolean;
    verbose?: boolean;
    help?: boolean;
}

function parseArgs(args: string[]): ScriptArgs {
    const parsed: ScriptArgs = {};
    
    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            parsed.help = true;
        } else if (arg === '--dry-run' || arg === '-d') {
            parsed.dryRun = true;
        } else if (arg === '--verbose' || arg === '-v') {
            parsed.verbose = true;
        } else if (arg.startsWith('--hours=')) {
            const hours = parseInt(arg.split('=')[1]);
            if (isNaN(hours) || hours <= 0) {
                throw new Error('Invalid hours value. Must be a positive number.');
            }
            parsed.hours = hours;
        } else if (arg.startsWith('--days=') || arg.startsWith('--max-days=')) {
            const days = parseInt(arg.split('=')[1]);
            if (isNaN(days) || days <= 0) {
                throw new Error('Invalid days value. Must be a positive number.');
            }
            if (days > 90) {
                throw new Error('Days value cannot exceed 90 (maximum order lifetime).');
            }
            parsed.days = days;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    
    return parsed;
}

function showHelp() {
    console.log(`
🧹 Cleanup Old Orders Script

This script removes orders that have been in 'broadcasted' status for too long.

Usage:
  pnpm script cleanup-old-orders [options]

Options:
  --hours=N       Maximum age in hours (default: 24)
  --days=N        Maximum age in days (alternative to --hours, max: 90)
  --max-days=N    Same as --days (for clarity)
  --dry-run, -d   Show what would be cleaned up without actually doing it
  --verbose, -v   Show detailed output
  --help, -h      Show this help message

Examples:
  pnpm script cleanup-old-orders
  pnpm script cleanup-old-orders --hours=12
  pnpm script cleanup-old-orders --days=7
  pnpm script cleanup-old-orders --max-days=90
  pnpm script cleanup-old-orders --dry-run --verbose
  pnpm script cleanup-old-orders --hours=6 --dry-run

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
        
        // Validate that only one time option is provided
        if (options.hours && options.days) {
            throw new Error('Cannot specify both --hours and --days options. Please use only one.');
        }
        
        // Calculate max age in milliseconds
        let maxAge: number;
        let ageDescription: string;
        
        if (options.days) {
            maxAge = options.days * 24 * 60 * 60 * 1000;
            ageDescription = `${options.days} days`;
        } else {
            const maxAgeHours = options.hours || 24;
            maxAge = maxAgeHours * 60 * 60 * 1000;
            ageDescription = `${maxAgeHours} hours`;
        }
        
        const now = Date.now();
        
        await logger.info(`🧹 Starting cleanup of orders older than ${ageDescription}...`);
        
        if (options.dryRun) {
            await logger.info('🔍 DRY RUN MODE - No changes will be made');
        }
        
        if (options.verbose) {
            await logger.info('📝 Verbose mode enabled');
        }
        
        // Check KV connection
        try {
            await kv.ping();
            await logger.success('KV connection successful');
        } catch (error) {
            await logger.error('KV connection failed: ' + error);
            await logger.info('💡 Make sure KV_REST_API_URL and KV_REST_API_TOKEN are set in .env.local');
            process.exit(1);
        }
        
        // Get all orders that need monitoring
        const ordersToCheck = await getOrdersNeedingMonitoring();
        
        if (ordersToCheck.length === 0) {
            await logger.success('No orders need monitoring');
            return;
        }
        
        await logger.info(`📊 Found ${ordersToCheck.length} orders to check`);
        
        // Find old orders
        const oldOrders = [];
        
        for (const { uuid, order } of ordersToCheck) {
            const orderAge = now - new Date(order.createdAt).getTime();
            
            if (orderAge > maxAge) {
                const ageHours = Math.round(orderAge / (60 * 60 * 1000));
                oldOrders.push({
                    uuid,
                    order,
                    age: orderAge,
                    ageHours,
                    createdAt: order.createdAt,
                    txid: order.txid
                });
                
                if (options.verbose) {
                    await logger.info(`🕐 Found old order: ${uuid} (${formatAge(orderAge)} old)`);
                }
            }
        }
        
        if (oldOrders.length === 0) {
            await logger.success(`No orders older than ${ageDescription} found`);
            return;
        }
        
        await logger.info(`🎯 Found ${oldOrders.length} orders to clean up:`);
        
        // Show details
        for (const { uuid, ageHours, createdAt, txid } of oldOrders) {
            const shortUuid = uuid.substring(0, 8);
            const shortTxid = txid ? txid.substring(0, 16) + '...' : 'N/A';
            console.log(`  • ${shortUuid} (${ageHours}h old) - TX: ${shortTxid}`);
        }
        
        if (options.dryRun) {
            await logger.info('🔍 DRY RUN: Would cancel these orders');
            await logger.info('To actually clean up, run without --dry-run');
            return;
        }
        
        // Confirm before proceeding
        await logger.warn('This will cancel all the orders listed above.');
        await logger.info('Proceeding with cleanup in 3 seconds...');
        
        // Wait 3 seconds before proceeding
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await logger.info('🚀 Starting cleanup...');
        
        let cleaned = 0;
        const errors = [];
        
        for (const { uuid, ageHours } of oldOrders) {
            try {
                await cancelOrder(uuid);
                cleaned++;
                await logger.success(`Cancelled order ${uuid.substring(0, 8)} (${ageHours}h old)`);
            } catch (error) {
                await logger.error(`Error cancelling order ${uuid.substring(0, 8)}: ${error}`);
                errors.push(`${uuid}: ${error}`);
            }
        }
        
        await logger.success('🎉 Cleanup completed!');
        await logger.info(`   📊 Checked: ${ordersToCheck.length} orders`);
        await logger.info(`   🧹 Cleaned: ${cleaned} orders`);
        await logger.info(`   ❌ Errors: ${errors.length}`);
        
        if (errors.length > 0) {
            await logger.error('Errors encountered:');
            for (const error of errors) {
                await logger.error(`   ${error}`);
            }
        }
        
        // Update last check time
        await kv.set('monitoring:cleanup_last_run', new Date().toISOString());
        
    } catch (error) {
        await logger.error('Script error: ' + error);
        process.exit(1);
    }
}

// Run the script
main().catch(async error => {
    await logger.error('Unexpected error: ' + error);
    process.exit(1);
});