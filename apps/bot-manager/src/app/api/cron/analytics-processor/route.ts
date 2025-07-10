import { NextRequest, NextResponse } from 'next/server';
import { analyticsClient } from '@/lib/analytics-client';
import { kv } from '@vercel/kv';
import { logger } from '@/lib/server/logger';

/**
 * Analytics Processor Cron Job
 * Runs analytics processing for all active wallets in background
 * Should be triggered by external cron service (e.g., Vercel Cron)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron request attempted');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('🔄 Starting analytics cron processing');

    // Get list of all active wallets from the bots
    const activeWallets = await getActiveWalletAddresses();
    
    if (activeWallets.length === 0) {
      logger.info('No active wallets found, skipping analytics processing');
      return NextResponse.json({
        success: true,
        message: 'No active wallets to process',
        processed: 0,
        duration: Date.now() - startTime
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process analytics for each wallet
    for (const walletAddress of activeWallets) {
      try {
        logger.info(`📊 Processing analytics for wallet: ${walletAddress.slice(0, 8)}...`);
        
        // Run analytics processing (this will cache results)
        const response = await analyticsClient.getAnalyticsSummary(walletAddress);
        
        if (response.success) {
          // Also cache individual components for faster API access
          if (response.data) {
            await Promise.all([
              kv.set(`analytics:performance:${walletAddress}`, response.data.performance, { ex: 300 }), // 5 min cache
              kv.set(`analytics:holdings:${walletAddress}`, response.data.holdings, { ex: 300 }),
              kv.set(`analytics:transactions:${walletAddress}`, response.data.recentTransactions, { ex: 300 }),
              kv.set(`analytics:last_updated:${walletAddress}`, Date.now(), { ex: 300 })
            ]);
          }
          
          results.processed++;
          logger.info(`✅ Successfully processed analytics for wallet: ${walletAddress.slice(0, 8)}...`);
        } else {
          results.failed++;
          results.errors.push(`${walletAddress}: ${response.error}`);
          logger.error(`❌ Failed to process analytics for wallet ${walletAddress}: ${response.error}`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`${walletAddress}: ${errorMessage}`);
        logger.error(`❌ Error processing wallet ${walletAddress}: ${errorMessage}`);
      }
    }

    const duration = Date.now() - startTime;
    
    logger.info(`🎉 Analytics cron processing completed - ${results.processed}/${activeWallets.length} wallets processed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      totalWallets: activeWallets.length,
      processed: results.processed,
      failed: results.failed,
      errors: results.errors,
      duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`💥 Analytics cron processing failed: ${errorMessage}`);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration
    }, { status: 500 });
  }
}

/**
 * Get all active wallet addresses from bots
 */
async function getActiveWalletAddresses(): Promise<string[]> {
  try {
    // Get bots data from KV store or generate if needed
    const botsData = await kv.get('app:bots') as any[];
    
    if (!botsData || !Array.isArray(botsData)) {
      logger.warn('No bots data found in KV store for analytics processing');
      return [];
    }

    // Extract unique wallet addresses
    const walletAddresses = botsData
      .map(bot => bot.walletAddress)
      .filter((address, index, arr) => address && arr.indexOf(address) === index) // Remove duplicates and empty values
      .filter(address => typeof address === 'string' && address.length > 0);

    logger.info(`Found ${walletAddresses.length} active wallet addresses`);
    return walletAddresses;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to get active wallet addresses: ${errorMessage}`);
    return [];
  }
}

// Only allow GET method
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}