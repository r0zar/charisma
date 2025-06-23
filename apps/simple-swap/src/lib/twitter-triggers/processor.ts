import { getTriggersToCheck, createTwitterExecution, updateTwitterExecution, incrementTriggerCount } from './store';
import { scrapeTwitterReplies, TwitterRateLimiter } from './twitter-scraper';
import { processBNSFromReply } from './bns-resolver';
import { TwitterTrigger, TwitterTriggerExecution } from './types';

// Rate limiter for Twitter API calls
const rateLimiter = new TwitterRateLimiter(30); // 30 calls per minute

/**
 * Main processing function that checks all active triggers for new replies
 */
export async function processTwitterTriggers(): Promise<{
    triggersChecked: number;
    newReplies: number;
    ordersCreated: number;
    errors: string[];
}> {
    console.log('[Twitter Processor] Starting Twitter trigger processing');

    const results = {
        triggersChecked: 0,
        newReplies: 0,
        ordersCreated: 0,
        errors: [] as string[],
    };

    try {
        // Get all active triggers that need checking
        const triggers = await getTriggersToCheck();
        console.log(`[Twitter Processor] Found ${triggers.length} active triggers to check`);

        if (triggers.length === 0) {
            return results;
        }

        // Process each trigger
        for (const trigger of triggers) {
            try {
                await rateLimiter.waitIfNeeded();
                const triggerResult = await processIndividualTrigger(trigger);

                results.triggersChecked++;
                results.newReplies += triggerResult.newReplies;
                results.ordersCreated += triggerResult.ordersCreated;

                if (triggerResult.errors.length > 0) {
                    results.errors.push(...triggerResult.errors);
                }

            } catch (error) {
                const errorMsg = `Error processing trigger ${trigger.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[Twitter Processor] ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }

        console.log(`[Twitter Processor] Completed. Results:`, results);
        return results;

    } catch (error) {
        const errorMsg = `Fatal error in Twitter trigger processing: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[Twitter Processor] ${errorMsg}`);
        results.errors.push(errorMsg);
        return results;
    }
}

/**
 * Process an individual trigger for new replies
 */
async function processIndividualTrigger(trigger: TwitterTrigger): Promise<{
    newReplies: number;
    ordersCreated: number;
    errors: string[];
}> {
    console.log(`[Twitter Processor] Processing trigger ${trigger.id} for tweet ${trigger.tweetId}`);

    const results = {
        newReplies: 0,
        ordersCreated: 0,
        errors: [] as string[],
    };

    try {
        // Get the last reply ID we've seen (to avoid processing duplicates)
        const lastReplyId = await getLastProcessedReplyId(trigger.id);

        // Scrape new replies
        const scrapingResult = await scrapeTwitterReplies(trigger.tweetId, lastReplyId);

        if (!scrapingResult.success) {
            throw new Error(`Twitter scraping failed: ${scrapingResult.error}`);
        }

        console.log(`[Twitter Processor] Found ${scrapingResult.replies.length} new replies for trigger ${trigger.id}`);
        results.newReplies = scrapingResult.replies.length;

        // Process each reply
        for (const reply of scrapingResult.replies) {
            try {
                const orderCreated = await processReplyForBNS(trigger, reply);
                if (orderCreated) {
                    results.ordersCreated++;
                }
            } catch (error) {
                const errorMsg = `Error processing reply ${reply.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[Twitter Processor] ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }

        // Update the last checked timestamp
        await updateLastProcessedReplyId(trigger.id, scrapingResult.replies);

        return results;

    } catch (error) {
        const errorMsg = `Error processing trigger ${trigger.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMsg);
        return results;
    }
}

/**
 * Process a single reply to check for BNS and create order if found
 */
async function processReplyForBNS(trigger: TwitterTrigger, reply: any): Promise<boolean> {
    console.log(`[Twitter Processor] Processing reply ${reply.id} from @${reply.authorHandle}`);

    // Extract and resolve BNS from the reply
    const bnsResult = await processBNSFromReply(reply.authorHandle, reply.authorDisplayName);

    if (!bnsResult.bnsName) {
        console.log(`[Twitter Processor] No BNS found in reply ${reply.id} from @${reply.authorHandle}`);
        return false;
    }

    console.log(`[Twitter Processor] Found BNS name: ${bnsResult.bnsName} in reply ${reply.id}`);

    // Create execution record (initially pending)
    const execution = await createTwitterExecution({
        triggerId: trigger.id,
        replyTweetId: reply.id,
        replierHandle: reply.authorHandle,
        replierDisplayName: reply.authorDisplayName,
        bnsName: bnsResult.bnsName,
        executedAt: new Date().toISOString(),
        status: 'pending',
        replyText: reply.text,
        replyCreatedAt: reply.createdAt,
    });

    // Check if BNS resolution was successful
    if (!bnsResult.resolution || !bnsResult.resolution.success) {
        const error = bnsResult.resolution?.error || 'BNS resolution failed';
        console.log(`[Twitter Processor] BNS resolution failed for ${bnsResult.bnsName}: ${error}`);

        await updateTwitterExecution(execution.id, {
            status: 'failed',
            error: `BNS resolution failed: ${error}`,
        });

        return false;
    }

    const recipientAddress = bnsResult.resolution.address;
    console.log(`[Twitter Processor] BNS ${bnsResult.bnsName} resolved to address: ${recipientAddress}`);

    // Update execution with resolved address
    await updateTwitterExecution(execution.id, {
        recipientAddress,
        status: 'bns_resolved',
    });

    // Try to execute a pre-signed order, or create overflow execution if none available
    try {
        const orderResult = await executePreSignedOrder(trigger, recipientAddress!, execution.id);

        if (orderResult.success) {
            // Update execution with order details
            await updateTwitterExecution(execution.id, {
                orderUuid: orderResult.orderUuid,
                status: 'order_created',
            });

            // Increment trigger count
            await incrementTriggerCount(trigger.id);

            console.log(`[Twitter Processor] ✅ Successfully executed order ${orderResult.orderUuid} for BNS ${bnsResult.bnsName} (${recipientAddress})`);
            
            // Twitter reply notifications temporarily disabled
            // TODO: Re-enable when Twitter authentication issues are resolved
            /*
            // Send Twitter reply notification (fire-and-forget)
            try {
                const { getTwitterReplyService } = await import('./twitter-reply-service');
                const twitterReplyService = getTwitterReplyService();
                
                // Get token info for the notification
                const { getTokenMetadataCached } = await import('@repo/tokens');
                const inputTokenMeta = await getTokenMetadataCached(trigger.inputToken);
                const outputTokenMeta = await getTokenMetadataCached(trigger.outputToken);
                
                // Format amount for display
                const decimals = inputTokenMeta.decimals || 6;
                const amountFormatted = (parseInt(trigger.amountIn) / Math.pow(10, decimals)).toFixed(6).replace(/\.?0+$/, '');
                const tokenSymbol = outputTokenMeta.symbol || 'tokens';
                
                // Send notification and track result
                twitterReplyService.notifyOrderExecution(execution, orderResult.txid!, tokenSymbol, amountFormatted)
                    .then(result => {
                        if (result.success) {
                            // Update execution with reply success
                            updateTwitterExecution(execution.id, {
                                twitterReplyId: result.tweetId,
                                twitterReplyStatus: 'sent'
                            }).catch(updateError => {
                                console.error(`[Twitter Processor] Failed to update execution with reply status:`, updateError);
                            });
                        } else {
                            // Update execution with reply failure
                            updateTwitterExecution(execution.id, {
                                twitterReplyStatus: 'failed',
                                twitterReplyError: result.error
                            }).catch(updateError => {
                                console.error(`[Twitter Processor] Failed to update execution with reply error:`, updateError);
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`[Twitter Processor] Twitter reply notification failed for execution ${execution.id}:`, error);
                        // Update execution with reply failure
                        updateTwitterExecution(execution.id, {
                            twitterReplyStatus: 'failed',
                            twitterReplyError: error instanceof Error ? error.message : 'Unknown error'
                        }).catch(updateError => {
                            console.error(`[Twitter Processor] Failed to update execution with reply error:`, updateError);
                        });
                    });
                    
            } catch (error) {
                console.error(`[Twitter Processor] Error setting up Twitter reply notification:`, error);
            }
            */
            
            return true;
        } else if (orderResult.error === 'No available orders - all pre-signed orders have been used') {
            // This is an overflow execution - log it but don't fail
            await updateTwitterExecution(execution.id, {
                status: 'overflow',
                error: 'Overflow execution - needs additional signed order',
            });

            console.log(`[Twitter Processor] 🟡 Overflow execution for BNS ${bnsResult.bnsName} (${recipientAddress}) - needs additional order`);
            return true; // Return true because the execution was processed (just as overflow)
        } else {
            throw new Error(orderResult.error || 'Failed to execute pre-signed order');
        }

    } catch (error) {
        const errorMsg = `Failed to execute order: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[Twitter Processor] ${errorMsg}`);

        await updateTwitterExecution(execution.id, {
            status: 'failed',
            error: errorMsg,
        });

        return false;
    }
}

/**
 * Execute a pre-signed order from a Twitter trigger
 */
async function executePreSignedOrder(trigger: TwitterTrigger, recipientAddress: string, executionId: string): Promise<{
    success: boolean;
    orderUuid?: string;
    txid?: string;
    error?: string;
}> {
    try {
        // Check if trigger has pre-signed orders
        if (!trigger.orderIds || trigger.orderIds.length === 0) {
            return {
                success: false,
                error: 'No pre-signed orders available for this trigger'
            };
        }

        // Import order functions
        const { getOrder } = await import('../orders/store');

        // Find the next available (open) order
        let nextOrderUuid: string | null = null;
        for (const orderUuid of trigger.orderIds) {
            const order = await getOrder(orderUuid);
            if (order && order.status === 'open') {
                nextOrderUuid = orderUuid;
                break;
            }
        }

        if (!nextOrderUuid) {
            return {
                success: false,
                error: 'No available orders - all pre-signed orders have been used'
            };
        }

        console.log(`[Twitter Processor] Found available order ${nextOrderUuid} for trigger ${trigger.id}`);

        // Get the order object first
        const order = await getOrder(nextOrderUuid);
        if (!order) {
            return {
                success: false,
                error: 'Order not found'
            };
        }

        // Update the order with the recipient address
        const updatedOrder = {
            ...order,
            recipient: recipientAddress
        };

        // Execute the order directly by calling the execution function
        const { executeTrade } = await import('../orders/executor');
        const { fillOrder } = await import('../orders/store');

        const txid = await executeTrade(updatedOrder);

        if (!txid) {
            return {
                success: false,
                error: 'Order execution failed - no transaction ID returned'
            };
        }

        // Mark the order as filled to prevent reuse
        await fillOrder(nextOrderUuid, txid);

        console.log(`[Twitter Processor] Successfully executed order ${nextOrderUuid} for recipient ${recipientAddress}, txid: ${txid}`);

        return {
            success: true,
            orderUuid: nextOrderUuid,
            txid: txid
        };

    } catch (error) {
        console.error(`[Twitter Processor] Error executing pre-signed order:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during order execution'
        };
    }
}

/**
 * Get the last processed reply ID for a trigger (to avoid duplicates)
 */
async function getLastProcessedReplyId(triggerId: string): Promise<string | undefined> {
    // This could be stored in KV or derived from the most recent execution
    // For now, we'll use a simple approach
    const { kv } = await import('@vercel/kv');
    const lastId = await kv.get(`twitter_last_reply:${triggerId}`);
    return lastId as string | undefined;
}

/**
 * Update the last processed reply ID for a trigger
 */
async function updateLastProcessedReplyId(triggerId: string, replies: any[]): Promise<void> {
    if (replies.length === 0) return;

    // Store the highest reply ID as the last processed
    const maxReplyId = Math.max(...replies.map(r => parseInt(r.id))).toString();

    const { kv } = await import('@vercel/kv');
    await kv.set(`twitter_last_reply:${triggerId}`, maxReplyId);

    console.log(`[Twitter Processor] Updated last processed reply ID for trigger ${triggerId}: ${maxReplyId}`);
}