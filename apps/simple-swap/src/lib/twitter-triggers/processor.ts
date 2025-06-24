import { getTriggersToCheck, createTwitterExecution, updateTwitterExecution, incrementTriggerCount, getExecutionByTriggerAndBNS } from './store';
import { scrapeTwitterReplies } from './twitter-scraper';
import { processBNSFromReply } from './bns-resolver';
import { TwitterTrigger, TwitterTriggerExecution } from './types';

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

    // Get all active triggers that need checking
    const triggers = await getTriggersToCheck();
    console.log(`[Twitter Processor] Found ${triggers.length} active triggers to check`);

    if (triggers.length === 0) {
        return results;
    }

    // Process each trigger
    for (const trigger of triggers) {
        try {
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
}

/**
 * Process an individual trigger for new replies
 */
async function processIndividualTrigger(trigger: TwitterTrigger): Promise<{
    newReplies: number;
    ordersCreated: number;
    errors: string[];
}> {

    console.warn(`[Twitter Processor] Processing trigger ${trigger.id} for tweet ${trigger.tweetId}`);
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
        console.error(`[Twitter Processor] Scraping result:`, scrapingResult);

        if (!scrapingResult.success) {
            throw new Error(`Twitter scraping failed: ${scrapingResult.error}`);
        }

        console.log(`[Twitter Processor] Found ${scrapingResult.replies.length} new replies for trigger ${trigger.id}`);
        results.newReplies = scrapingResult.replies.length;

        // Process each reply sequentially to prevent nonce conflicts
        for (const reply of scrapingResult.replies) {
            try {
                const orderCreated = await processReplyForBNS(trigger, reply);
                if (orderCreated) {
                    results.ordersCreated++;
                }

                // Add delay between executions to prevent nonce conflicts
                if (scrapingResult.replies.indexOf(reply) < scrapingResult.replies.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between executions
                }
            } catch (error) {
                const errorMsg = `Error processing reply ${reply.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[Twitter Processor] ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }

        // Retry failed executions for this trigger
        try {
            console.log(`[Twitter Processor] Checking for failed executions to retry for trigger ${trigger.id}`);
            const retryResult = await retryFailedExecutions(trigger);
            results.ordersCreated += retryResult.ordersCreated;
            results.errors.push(...retryResult.errors);
        } catch (error) {
            console.error(`[Twitter Processor] Error retrying failed executions for trigger ${trigger.id}:`, error);
            results.errors.push(`Retry failed executions: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

        // Send helpful reply about BNS setup for Charisma airdrops
        // Create a temporary execution record to track the BNS not found notification
        let tempExecution: TwitterTriggerExecution | null = null;
        try {
            // Create execution record for tracking the BNS not found notification
            tempExecution = await createTwitterExecution({
                triggerId: trigger.id,
                replyTweetId: reply.id,
                replierHandle: reply.authorHandle,
                replierDisplayName: reply.authorDisplayName,
                bnsName: 'no_bns_found',
                executedAt: new Date().toISOString(),
                status: 'failed',
                error: 'No BNS found in reply',
                replyText: reply.text,
                replyCreatedAt: reply.createdAt,
            });

            const { getTwitterReplyService } = await import('./twitter-reply-service');
            const twitterReplyService = getTwitterReplyService();

            console.log(`[Twitter Processor] 💬 Sending BNS setup notification to @${reply.authorHandle}`);
            const replyResult = await twitterReplyService.notifyBNSNotFound(
                reply.id,
                reply.authorHandle
            );

            // Update execution with reply status
            if (replyResult.success) {
                console.log(`[Twitter Processor] ✅ Successfully sent BNS setup notification to @${reply.authorHandle}`);
                await updateTwitterExecution(tempExecution.id, {
                    twitterReplyId: replyResult.tweetId,
                    twitterReplyStatus: 'sent'
                });
            } else {
                console.error(`[Twitter Processor] ❌ Failed to send BNS setup notification:`, replyResult.error);
                await updateTwitterExecution(tempExecution.id, {
                    twitterReplyStatus: 'failed',
                    twitterReplyError: replyResult.error
                });
            }
        } catch (error) {
            console.error(`[Twitter Processor] Error sending BNS setup notification:`, error);
            if (tempExecution) {
                await updateTwitterExecution(tempExecution.id, {
                    twitterReplyStatus: 'failed',
                    twitterReplyError: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return false;
    }

    console.log(`[Twitter Processor] Found BNS name: ${bnsResult.bnsName} in reply ${reply.id}`);

    // Check if we already have an execution for this trigger + BNS combination (idempotent processing)
    const existingExecution = await getExecutionByTriggerAndBNS(trigger.id, bnsResult.bnsName);

    let execution: TwitterTriggerExecution;

    if (existingExecution) {
        console.log(`[Twitter Processor] Found existing execution ${existingExecution.id} for BNS ${bnsResult.bnsName} with status: ${existingExecution.status}`);

        // Decide what to do based on existing execution status
        if (existingExecution.status === 'order_broadcasted' || existingExecution.status === 'order_confirmed') {
            console.log(`[Twitter Processor] ✅ Skipping BNS ${bnsResult.bnsName} - already processed successfully`);
            return true; // Consider this a success since user already got their order
        }

        // For failed, pending, or bns_resolved statuses, we'll retry the execution
        console.log(`[Twitter Processor] 🔄 Retrying execution for BNS ${bnsResult.bnsName} - previous status: ${existingExecution.status}`);
        execution = existingExecution;

        // Reset status to pending for retry
        await updateTwitterExecution(execution.id, {
            status: 'pending',
            error: undefined, // Clear any previous error
            executedAt: new Date().toISOString(), // Update timestamp for retry
        });
    } else {
        // No existing execution, create a new one
        console.log(`[Twitter Processor] 🆕 Creating new execution for BNS ${bnsResult.bnsName}`);
        execution = await createTwitterExecution({
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
    }

    // Check if BNS resolution was successful
    if (!bnsResult.resolution || !bnsResult.resolution.success) {
        const error = bnsResult.resolution?.error || 'BNS resolution failed';
        console.log(`[Twitter Processor] BNS resolution failed for ${bnsResult.bnsName}: ${error}`);

        await updateTwitterExecution(execution.id, {
            status: 'failed',
            error: `BNS resolution failed: ${error}`,
        });

        // Send helpful reply about BNS setup for Charisma airdrops (with the specific BNS name)
        try {
            const { getTwitterReplyService } = await import('./twitter-reply-service');
            const twitterReplyService = getTwitterReplyService();

            console.log(`[Twitter Processor] 💬 Sending BNS not found notification to @${reply.authorHandle} for ${bnsResult.bnsName}`);
            const replyResult = await twitterReplyService.notifyBNSNotFound(
                reply.id,
                reply.authorHandle,
                bnsResult.bnsName
            );

            // Update execution with reply status
            if (replyResult.success) {
                console.log(`[Twitter Processor] ✅ Successfully sent BNS not found notification to @${reply.authorHandle}`);
                await updateTwitterExecution(execution.id, {
                    twitterReplyId: replyResult.tweetId,
                    twitterReplyStatus: 'sent'
                });
            } else {
                console.error(`[Twitter Processor] ❌ Failed to send BNS not found notification:`, replyResult.error);
                await updateTwitterExecution(execution.id, {
                    twitterReplyStatus: 'failed',
                    twitterReplyError: replyResult.error
                });
            }
        } catch (replyError) {
            console.error(`[Twitter Processor] Error sending BNS not found notification:`, replyError);
            await updateTwitterExecution(execution.id, {
                twitterReplyStatus: 'failed',
                twitterReplyError: replyError instanceof Error ? replyError.message : 'Unknown error'
            });
        }

        return false;
    }

    const recipientAddress = bnsResult.resolution.address;
    console.log(`[Twitter Processor] BNS ${bnsResult.bnsName} resolved to address: ${recipientAddress}`);

    // Update execution with resolved address
    await updateTwitterExecution(execution.id, {
        recipientAddress,
        status: 'bns_resolved',
    });

    // Get the updated execution record to pass to order metadata update
    const updatedExecution = { ...execution, recipientAddress, status: 'bns_resolved' as const };

    // Try to execute a pre-signed order, or create overflow execution if none available
    try {
        const orderResult = await executePreSignedOrder(trigger, recipientAddress!, execution.id);

        if (orderResult.success) {
            // Update execution with order details including txid
            await updateTwitterExecution(execution.id, {
                orderUuid: orderResult.orderUuid,
                txid: orderResult.txid,
                status: 'order_broadcasted',
            });

            // Update the order metadata with Twitter execution information
            const finalExecution = {
                ...updatedExecution,
                orderUuid: orderResult.orderUuid,
                txid: orderResult.txid,
                status: 'order_broadcasted' as const
            };
            await updateOrderWithExecutionMetadata(orderResult.orderUuid!, finalExecution, recipientAddress!);

            // Increment trigger count
            await incrementTriggerCount(trigger.id);

            console.log(`[Twitter Processor] ✅ Successfully executed order ${orderResult.orderUuid} for BNS ${bnsResult.bnsName} (${recipientAddress})`);

            // Send Twitter reply notification (fire-and-forget)
            try {
                const { getTwitterReplyService } = await import('./twitter-reply-service');
                const twitterReplyService = getTwitterReplyService();

                // Get token info for the notification
                const { getTokenMetadataCached } = await import('@repo/tokens');
                const outputTokenMeta = await getTokenMetadataCached(trigger.outputToken);
                const tokenSymbol = outputTokenMeta.symbol || 'tokens';

                // Get the actual output amount from the order's quote metadata
                const { getOrder } = await import('../orders/store');
                const orderWithQuote = await getOrder(orderResult.orderUuid!);
                let amountFormatted = '0';

                if (orderWithQuote?.metadata?.quote?.amountOut) {
                    const outputDecimals = outputTokenMeta.decimals || 6;
                    const actualOutputAmount = orderWithQuote.metadata.quote.amountOut;
                    amountFormatted = (actualOutputAmount / Math.pow(10, outputDecimals)).toFixed(6).replace(/\.?0+$/, '');
                    console.log(`[Twitter Processor] Using actual output amount ${amountFormatted} ${tokenSymbol} from quote data`);
                } else {
                    // Fallback to input amount if quote data is not available
                    const { getTokenMetadataCached: getInputTokenMeta } = await import('@repo/tokens');
                    const inputTokenMeta = await getInputTokenMeta(trigger.inputToken);
                    const inputDecimals = inputTokenMeta.decimals || 6;
                    amountFormatted = (parseInt(trigger.amountIn) / Math.pow(10, inputDecimals)).toFixed(6).replace(/\.?0+$/, '');
                    console.warn(`[Twitter Processor] Quote data not available, using fallback input amount ${amountFormatted}`);
                }

                // Send notification and track result
                twitterReplyService.notifyOrderExecution(finalExecution, orderResult.txid!, tokenSymbol, amountFormatted)
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
export async function executePreSignedOrder(trigger: TwitterTrigger, recipientAddress: string, executionId: string, isFirstTransaction: boolean = false): Promise<{
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
        const { getOrder, updateOrder } = await import('../orders/store');

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
        const { broadcastOrder } = await import('../orders/store');

        // Use higher slippage for Twitter triggers to handle simultaneous executions
        const twitterSlippage = 50; // 50% slippage for Twitter triggers
        console.log(`[Twitter Processor] Using ${twitterSlippage}% slippage for Twitter trigger execution${isFirstTransaction ? ' (first tx - using blockchain nonce)' : ''}`);
        const executionResult = await executeTrade(updatedOrder, twitterSlippage, isFirstTransaction);

        console.log(`[Twitter Processor] Trade execution result for order ${nextOrderUuid}:`, {
            orderUuid: nextOrderUuid,
            recipient: recipientAddress,
            executionResult
        });

        if (!executionResult.success || !executionResult.txid) {
            return {
                success: false,
                error: `Order execution failed: ${executionResult.error || 'No transaction ID returned'}`
            };
        }

        // Mark the order as broadcasted to prevent reuse
        await broadcastOrder(nextOrderUuid, executionResult.txid);

        console.log(`[Twitter Processor] ✅ Successfully executed order ${nextOrderUuid} for recipient ${recipientAddress}, txid: ${executionResult.txid}`);

        return {
            success: true,
            orderUuid: nextOrderUuid,
            txid: executionResult.txid
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

/**
 * Updates an order's metadata with Twitter execution information
 */
async function updateOrderWithExecutionMetadata(
    orderUuid: string,
    execution: TwitterTriggerExecution,
    recipientAddress: string
): Promise<void> {
    try {
        console.log(`[Twitter Processor] 🔄 Starting metadata update for order ${orderUuid}`);
        console.log(`[Twitter Processor] 📝 Execution data:`, {
            replierHandle: execution.replierHandle,
            replierDisplayName: execution.replierDisplayName,
            bnsName: execution.bnsName,
            replyTweetId: execution.replyTweetId,
            status: execution.status,
            executedAt: execution.executedAt
        });

        const { getOrder, updateOrder } = await import('../orders/store');
        const order = await getOrder(orderUuid);

        if (!order) {
            console.error(`[Twitter Processor] ❌ Order ${orderUuid} not found when trying to update metadata`);
            return;
        }

        console.log(`[Twitter Processor] 📋 Current order metadata:`, order.metadata);

        // Validate execution data before storing
        const requiredFields = ['replierHandle', 'bnsName', 'executedAt', 'status'];
        const missingFields = requiredFields.filter(field => !execution[field as keyof TwitterTriggerExecution]);

        if (missingFields.length > 0) {
            console.error(`[Twitter Processor] ❌ Missing required execution fields: ${missingFields.join(', ')}`);
            console.error(`[Twitter Processor] 📊 Execution object:`, execution);
            return;
        }

        // Create or update the metadata.execution field
        const executionMetadata = {
            replierHandle: execution.replierHandle || '',
            replierDisplayName: execution.replierDisplayName || '',
            bnsName: execution.bnsName || '',
            replyTweetId: execution.replyTweetId || '',
            replyText: execution.replyText || '',
            replyCreatedAt: execution.replyCreatedAt || '',
            executedAt: execution.executedAt || new Date().toISOString(),
            status: execution.status || 'unknown',
            error: execution.error || null
        };

        // Validate that we have the minimum required fields for UI
        const uiRequiredFields = ['replierHandle', 'bnsName', 'executedAt'];
        const missingUIFields = uiRequiredFields.filter(field => !executionMetadata[field as keyof typeof executionMetadata]);

        if (missingUIFields.length > 0) {
            console.warn(`[Twitter Processor] ⚠️ Missing UI-required fields: ${missingUIFields.join(', ')}`);
        }

        const updatedOrder = {
            ...order,
            recipient: recipientAddress,
            metadata: {
                ...order.metadata,
                execution: executionMetadata
            }
        };

        console.log(`[Twitter Processor] 🔧 New execution metadata being stored:`, executionMetadata);
        console.log(`[Twitter Processor] 📦 Complete updated order metadata:`, updatedOrder.metadata);

        await updateOrder(updatedOrder);

        // Verify the update was successful by re-fetching the order
        const verifyOrder = await getOrder(orderUuid);
        console.log(`[Twitter Processor] ✅ Verification - order metadata after update:`, verifyOrder?.metadata);

        if (verifyOrder?.metadata?.execution) {
            console.log(`[Twitter Processor] ✅ SUCCESS: Metadata update completed for order ${orderUuid}`);
            console.log(`[Twitter Processor] 📊 Stored execution metadata:`, verifyOrder.metadata.execution);
        } else {
            console.error(`[Twitter Processor] ❌ FAILED: Metadata not found after update for order ${orderUuid}`);
        }

    } catch (error) {
        console.error(`[Twitter Processor] ❌ Failed to update order ${orderUuid} with execution metadata:`, error);
        console.error(`[Twitter Processor] 📊 Execution object:`, execution);
        console.error(`[Twitter Processor] 📍 Recipient address:`, recipientAddress);
    }
}

/**
 * Retry failed executions for a specific trigger
 */
export async function retryFailedExecutions(trigger: TwitterTrigger, isFirstTransaction: boolean = false): Promise<{
    ordersCreated: number;
    errors: string[];
}> {
    const results = {
        ordersCreated: 0,
        errors: [] as string[]
    };

    try {
        // Get all execution records for this trigger
        const { kv } = await import('@vercel/kv');
        const executionKeys = await kv.keys('twitter_execution:*');

        const failedExecutions = [];
        for (const key of executionKeys) {
            try {
                const execution = await kv.get(key) as any;
                if (execution &&
                    execution.triggerId === trigger.id &&
                    (execution.status === 'failed' || execution.status === 'pending')) {
                    failedExecutions.push(execution);
                }
            } catch (error) {
                console.warn(`[Twitter Processor] Failed to fetch execution ${key}:`, error);
            }
        }

        if (failedExecutions.length === 0) {
            console.log(`[Twitter Processor] No failed executions to retry for trigger ${trigger.id}`);
            return results;
        }

        console.log(`[Twitter Processor] Found ${failedExecutions.length} failed executions to retry for trigger ${trigger.id}`);

        // Retry each failed execution sequentially to prevent nonce conflicts
        let currentIsFirstTransaction = isFirstTransaction;
        for (const execution of failedExecutions) {
            try {
                console.log(`[Twitter Processor] Retrying execution ${execution.id} for BNS ${execution.bnsName}${currentIsFirstTransaction ? ' (first tx)' : ''}`);

                // Create a mock reply object for processReplyForBNS
                const mockReply = {
                    id: execution.replyTweetId || 'retry',
                    text: execution.replyText || '',
                    authorHandle: execution.replierHandle,
                    authorDisplayName: execution.replierDisplayName || execution.replierHandle,
                    createdAt: execution.replyCreatedAt || execution.executedAt,
                    inReplyToTweetId: trigger.tweetId
                };

                // Use the existing processReplyForBNS logic which handles retries
                const orderCreated = await processReplyForBNS(trigger, mockReply);
                if (orderCreated) {
                    results.ordersCreated++;
                    currentIsFirstTransaction = false; // Mark subsequent retries as non-first
                    console.log(`[Twitter Processor] ✅ Successfully retried execution ${execution.id}`);
                } else {
                    console.log(`[Twitter Processor] ⚠️ Retry attempt for execution ${execution.id} did not create order`);
                }

                // Add delay between retry attempts to prevent nonce conflicts
                if (failedExecutions.indexOf(execution) < failedExecutions.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between retries
                }

            } catch (error) {
                const errorMsg = `Failed to retry execution ${execution.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(`[Twitter Processor] ${errorMsg}`);
                results.errors.push(errorMsg);
            }
        }

    } catch (error) {
        const errorMsg = `Error getting failed executions for trigger ${trigger.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`[Twitter Processor] ${errorMsg}`);
        results.errors.push(errorMsg);
    }

    return results;
}