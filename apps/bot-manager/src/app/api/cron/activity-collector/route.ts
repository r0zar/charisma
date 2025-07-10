import { type NextRequest, NextResponse } from 'next/server';
import { loadAppStateConfigurableWithFallback } from '@/lib/data-loader.server';
import { botDataStore, isKVAvailable } from '@/lib/kv-store';
import { BotActivity, type Bot } from '@/types/bot';
// import { processTransactions } from '@repo/polyglot'; // TODO: Fix import when function is available

/**
 * Activity collection cron job
 * 
 * POST /api/cron/activity-collector
 * 
 * Runs every 5 minutes to collect blockchain activity for bot wallets.
 * Security: Requires CRON_SECRET header for authentication.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Security check
  if (!cronSecret) {
    console.error('[ActivityCollector] CRON_SECRET environment variable is not set');
    return NextResponse.json({ 
      status: 'error', 
      message: 'Server configuration error (missing cron secret)' 
    }, { status: 500 });
  }
  
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[ActivityCollector] Unauthorized cron job access attempt');
    return NextResponse.json({ 
      status: 'error', 
      message: 'Unauthorized' 
    }, { status: 401 });
  }

  const startTime = Date.now();
  console.log('[ActivityCollector] Starting blockchain activity collection...');

  try {
    // Check KV availability
    const kvAvailable = await isKVAvailable();
    if (!kvAvailable) {
      console.error('[ActivityCollector] KV store is not available');
      return NextResponse.json({
        status: 'error',
        message: 'KV store unavailable',
        executionTime: Date.now() - startTime
      }, { status: 503 });
    }

    // Load all bots from the app state
    const appState = await loadAppStateConfigurableWithFallback();
    const allBots = appState.bots.list;

    // Filter bots that have wallet addresses
    const botsWithWallets = allBots.filter(bot => 
      bot.walletAddress && 
      bot.walletAddress.length > 0 &&
      bot.status === 'active'
    );

    console.log(`[ActivityCollector] Found ${botsWithWallets.length} active bots with wallets`);

    if (botsWithWallets.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No bots with wallets found',
        processedBots: 0,
        newActivities: 0,
        executionTime: Date.now() - startTime
      });
    }

    // Group bots by wallet address to avoid duplicate processing
    const walletBotMap = new Map<string, Bot[]>();
    for (const bot of botsWithWallets) {
      const address = bot.walletAddress;
      if (!walletBotMap.has(address)) {
        walletBotMap.set(address, []);
      }
      walletBotMap.get(address)!.push(bot);
    }

    console.log(`[ActivityCollector] Processing ${walletBotMap.size} unique wallet addresses`);

    // Collect activities for each wallet
    const results = {
      processedWallets: 0,
      newActivities: 0,
      errors: 0,
      walletResults: [] as Array<{ address: string; activities: number; error?: string }>
    };

    for (const [walletAddress, bots] of Array.from(walletBotMap.entries())) {
      try {
        const walletResult = await collectWalletActivity(walletAddress, bots);
        results.processedWallets++;
        results.newActivities += walletResult.newActivities;
        
        results.walletResults.push({
          address: walletAddress,
          activities: walletResult.newActivities
        });

        console.log(`[ActivityCollector] Processed wallet ${walletAddress}: ${walletResult.newActivities} new activities`);
        
      } catch (error) {
        console.error(`[ActivityCollector] Error processing wallet ${walletAddress}:`, error);
        results.errors++;
        
        results.walletResults.push({
          address: walletAddress,
          activities: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const totalExecutionTime = Date.now() - startTime;
    console.log(`[ActivityCollector] Completed. Processed: ${results.processedWallets}, New activities: ${results.newActivities}, Errors: ${results.errors}, Time: ${totalExecutionTime}ms`);

    return NextResponse.json({
      status: 'success',
      message: `Processed ${results.processedWallets} wallets`,
      processedWallets: results.processedWallets,
      newActivities: results.newActivities,
      errors: results.errors,
      walletResults: results.walletResults,
      executionTime: totalExecutionTime
    });

  } catch (error: any) {
    console.error('[ActivityCollector] Fatal error during collection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      status: 'error',
      message: `Activity collection failed: ${errorMessage}`,
      executionTime: Date.now() - startTime
    }, { status: 500 });
  }
}

/**
 * Collect blockchain activity for a specific wallet address
 */
async function collectWalletActivity(
  walletAddress: string, 
  bots: Bot[]
): Promise<{ newActivities: number }> {
  try {
    console.log(`[ActivityCollector] Collecting activity for wallet ${walletAddress}...`);

    // Get the last processed block/timestamp to avoid duplicate processing
    // For now, we'll look for activities from the last 10 minutes to avoid processing old data
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // TODO: Use polyglot to get recent transactions for this wallet when function is available
    // const transactionData = await processTransactions([walletAddress], {
    //   startTime: tenMinutesAgo,
    //   endTime: new Date()
    // });

    // For now, return early since processTransactions is not available
    console.log(`[ActivityCollector] processTransactions function not available - skipping wallet ${walletAddress}`);
    return { newActivities: 0 };

    // if (!transactionData || !transactionData.transactions || transactionData.transactions.length === 0) {
    //   console.log(`[ActivityCollector] No recent transactions found for wallet ${walletAddress}`);
    //   return { newActivities: 0 };
    // }

    // console.log(`[ActivityCollector] Found ${transactionData.transactions.length} transactions for wallet ${walletAddress}`);

    // let newActivities = 0;

    // TODO: Process each transaction and convert to activities when processTransactions is available
    // for (const transaction of transactionData.transactions) {
    //   try {
    //     // Determine which bot this transaction belongs to
    //     const bot = bots.find(b => b.walletAddress === walletAddress) || bots[0];
    //     
    //     // Convert transaction to activity
    //     const activity = await convertTransactionToActivity(transaction, bot);
    //     
    //     if (activity) {
    //       // Store activity in KV for the bot owner
    //       // Note: Using 'default-user' for now, but in production this should be the actual user ID
    //       const userId = 'default-user'; // TODO: Get actual user ID from bot ownership
    //       
    //       await botDataStore.addBotActivity(userId, activity);
    //       newActivities++;
    //       
    //       console.log(`[ActivityCollector] Created activity ${activity.id} for transaction ${transaction.txid}`);
    //     }
    //     
    //   } catch (error) {
    //     console.error(`[ActivityCollector] Error processing transaction ${transaction.txid}:`, error);
    //   }
    // }

    // return { newActivities };

  } catch (error) {
    console.error(`[ActivityCollector] Error collecting activity for wallet ${walletAddress}:`, error);
    throw error;
  }
}

/**
 * Convert a blockchain transaction to a bot activity
 */
async function convertTransactionToActivity(
  transaction: any, 
  bot: Bot
): Promise<BotActivity | null> {
  try {
    // Determine activity type based on transaction data
    let activityType: BotActivity['type'] = 'trade';
    let description = 'Unknown transaction';
    let amount: number | undefined;
    let token: string | undefined;

    // Analyze transaction to determine type
    if (transaction.token_transfer_events && transaction.token_transfer_events.length > 0) {
      const transfer = transaction.token_transfer_events[0];
      
      if (transfer.asset_identifier.includes('stx')) {
        activityType = transfer.sender === bot.walletAddress ? 'withdrawal' : 'deposit';
        description = activityType === 'withdrawal' ? 'STX withdrawal' : 'STX deposit';
        amount = parseFloat(transfer.amount) / 1000000; // Convert microSTX to STX
        token = 'STX';
      } else {
        activityType = 'trade';
        description = 'Token transfer';
        amount = parseFloat(transfer.amount);
        token = transfer.asset_identifier.split('::')[1] || 'Unknown';
      }
    } else if (transaction.contract_call_events && transaction.contract_call_events.length > 0) {
      const contractCall = transaction.contract_call_events[0];
      
      if (contractCall.contract_identifier.includes('yield') || 
          contractCall.contract_identifier.includes('farm') ||
          contractCall.contract_identifier.includes('stake')) {
        activityType = 'yield-farming';
        description = 'Yield farming operation';
      } else {
        activityType = 'trade';
        description = 'Contract interaction';
      }
    }

    // Determine status
    const status: BotActivity['status'] = transaction.tx_status === 'success' ? 'success' : 
                                         transaction.tx_status === 'abort_by_response' || 
                                         transaction.tx_status === 'abort_by_post_condition' ? 'failed' : 'pending';

    // Create activity
    const activity: BotActivity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      botId: bot.id,
      timestamp: new Date(transaction.burn_block_time * 1000).toISOString(),
      type: activityType,
      status,
      description,
      txid: transaction.txid,
      amount,
      token,
      blockHeight: transaction.block_height,
      blockTime: new Date(transaction.burn_block_time * 1000).toISOString(),
      error: status === 'failed' ? transaction.tx_result?.repr || 'Transaction failed' : undefined
    };

    return activity;

  } catch (error) {
    console.error(`[ActivityCollector] Error converting transaction to activity:`, error);
    return null;
  }
}