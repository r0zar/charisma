import { NextRequest, NextResponse } from 'next/server';

interface BackfillResult {
    executionId: string;
    replierHandle: string;
    bnsName: string;
    success: boolean;
    error?: string;
    tweetId?: string;
    skipped?: boolean;
    skipReason?: string;
    previewMessage?: string; // For dry runs to show the actual tweet text
}

interface BackfillSummary {
    totalFound: number;
    eligible: number;
    sent: number;
    failed: number;
    skipped: number;
    results: BackfillResult[];
}

// POST /api/admin/twitter-triggers/backfill-replies - Send replies to existing successful executions
export async function POST(request: NextRequest) {
    try {
        const { 
            dryRun = true, 
            limit = 50, 
            onlyRecentDays = 7,
            skipExistingReplies = true,
            includeBNSReminders = false  // New option for BNS not found reminders
        } = await request.json();
        
        console.log(`[Backfill Replies] Starting backfill - dryRun: ${dryRun}, limit: ${limit}, recentDays: ${onlyRecentDays}, includeBNSReminders: ${includeBNSReminders}`);
        
        // Get executions that don't have replies yet
        const { listAllTwitterExecutions } = await import('@/lib/twitter-triggers/store');
        const allExecutions = await listAllTwitterExecutions(500); // Get more to filter from
        
        // Filter for executions that need replies
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - onlyRecentDays);
        
        const eligibleExecutions = allExecutions.filter(execution => {
            // Must have reply information
            if (!execution.replyTweetId || !execution.replierHandle) {
                return false;
            }
            
            // Check date filter
            if (onlyRecentDays > 0) {
                const executedDate = new Date(execution.executedAt);
                if (executedDate < cutoffDate) {
                    return false;
                }
            }
            
            // Skip if already has reply (unless specifically requested)
            if (skipExistingReplies && execution.twitterReplyStatus === 'sent') {
                return false;
            }
            
            // Filter by execution type
            if (includeBNSReminders) {
                // Include both successful orders AND BNS not found cases
                const isSuccessful = (execution.status === 'order_broadcasted' || execution.status === 'order_confirmed') && execution.txid;
                const isBNSNotFound = execution.status === 'failed' && 
                                    execution.error?.includes('BNS') && 
                                    (execution.error.includes('not found') || execution.error.includes('resolution failed'));
                
                return isSuccessful || isBNSNotFound;
            } else {
                // Original behavior - only successful executions
                if (execution.status !== 'order_broadcasted' && execution.status !== 'order_confirmed') {
                    return false;
                }
                
                // Must have transaction ID for successful executions
                if (!execution.txid) {
                    return false;
                }
                
                // Must have BNS name for successful executions
                if (!execution.bnsName) {
                    return false;
                }
            }
            
            return true;
        }).slice(0, limit);
        
        console.log(`[Backfill Replies] Found ${eligibleExecutions.length} eligible executions out of ${allExecutions.length} total`);
        
        // Track reply tweet IDs to prevent duplicate replies to the same tweet
        const processedReplyTweetIds = new Set<string>();
        
        const summary: BackfillSummary = {
            totalFound: allExecutions.length,
            eligible: eligibleExecutions.length,
            sent: 0,
            failed: 0,
            skipped: 0,
            results: []
        };
        
        // Process each execution
        for (const execution of eligibleExecutions) {
            const result: BackfillResult = {
                executionId: execution.id,
                replierHandle: execution.replierHandle!,
                bnsName: execution.bnsName!,
                success: false
            };
            
            try {
                // Check if we've already processed this reply tweet ID
                if (execution.replyTweetId && processedReplyTweetIds.has(execution.replyTweetId)) {
                    result.skipped = true;
                    result.skipReason = 'Already replied to this tweet in this batch';
                    summary.skipped++;
                    summary.results.push(result);
                    continue;
                }
                
                // Determine if this is a BNS not found case or successful execution
                const isBNSNotFound = execution.status === 'failed' && 
                                    execution.error?.includes('BNS') && 
                                    (execution.error.includes('not found') || execution.error.includes('resolution failed'));
                
                let backfillMessage: string;
                
                if (isBNSNotFound) {
                    // Handle BNS not found cases with reminder messages
                    const safeHandle = execution.replierHandle || 'unknown';
                    const safeBnsName = execution.bnsName || undefined;
                    
                    // Use the same BNS not found message variations as the live system
                    const bnsReminderVariations = [
                        `hey @${safeHandle} - couldn't find your bns${safeBnsName ? ` "${safeBnsName}"` : ''} in the registry. set up a .btc name to receive charisma airdrops! visit btc.us to get started`,
                        `@${safeHandle} your bns${safeBnsName ? ` "${safeBnsName}"` : ''} isn't registered yet. grab a .btc name at btc.us to qualify for charisma token airdrops`,
                        `hey @${safeHandle} - no bns${safeBnsName ? ` "${safeBnsName}"` : ''} found in the registry. get a .btc name at btc.us to receive future charisma airdrops`,
                        `@${safeHandle} couldn't locate your bns${safeBnsName ? ` "${safeBnsName}"` : ''} in the registry. register a .btc name at btc.us for charisma airdrop eligibility`,
                        `hey @${safeHandle} - bns${safeBnsName ? ` "${safeBnsName}"` : ''} not found. set up your .btc name at btc.us to get charisma airdrops when they drop`
                    ];
                    
                    // Use deterministic selection based on handle for consistency
                    const messageIndex = safeHandle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % bnsReminderVariations.length;
                    backfillMessage = bnsReminderVariations[messageIndex];
                    
                    console.log(`[Backfill Debug] BNS reminder message for ${execution.id}:`, {
                        handle: safeHandle,
                        bnsName: safeBnsName,
                        messageIndex,
                        selectedMessage: bnsReminderVariations[messageIndex]
                    });
                    
                } else {
                    // Handle successful executions with order completion messages
                    const { getTwitterTrigger } = await import('@/lib/twitter-triggers/store');
                    const trigger = await getTwitterTrigger(execution.triggerId);
                    
                    if (!trigger) {
                        result.skipped = true;
                        result.skipReason = 'Trigger not found';
                        summary.skipped++;
                        summary.results.push(result);
                        continue;
                    }
                    
                    // Get token information for the reply message
                    const { getTokenMetadataCached } = await import('@/lib/contract-registry-adapter');
                    const outputTokenMeta = await getTokenMetadataCached(trigger.outputToken);
                    const tokenSymbol = outputTokenMeta.symbol || 'tokens';
                    
                    // Get the actual output amount from the order's quote metadata
                    const { getOrder } = await import('@/lib/orders/store');
                    const orderWithQuote = execution.orderUuid ? await getOrder(execution.orderUuid) : null;
                    let amountFormatted = '0';
                    
                    if (orderWithQuote?.metadata?.quote?.amountOut) {
                        const outputDecimals = outputTokenMeta.decimals || 6;
                        const actualOutputAmount = orderWithQuote.metadata.quote.amountOut;
                        amountFormatted = (actualOutputAmount / Math.pow(10, outputDecimals)).toFixed(6).replace(/\.?0+$/, '');
                        console.log(`[Backfill Debug] Using actual output amount ${amountFormatted} ${tokenSymbol} from quote data for execution ${execution.id}`);
                    } else {
                        // Fallback to input amount if quote data is not available
                        const inputTokenMeta = await getTokenMetadataCached(trigger.inputToken);
                        const inputDecimals = inputTokenMeta.decimals || 6;
                        amountFormatted = (parseInt(trigger.amountIn) / Math.pow(10, inputDecimals)).toFixed(6).replace(/\.?0+$/, '');
                        console.warn(`[Backfill Debug] Quote data not available for execution ${execution.id}, using fallback input amount ${amountFormatted}`);
                    }
                    
                    // Ensure we have safe values for template literals
                    const safeHandle = execution.replierHandle || 'unknown';
                    const safeBnsName = execution.bnsName || 'unknown.btc';
                    const safeAmount = amountFormatted || '0';
                    const safeToken = tokenSymbol || 'tokens';
                    const safeTxid = execution.txid || 'no-txid';
                    
                    // Validate that we have all required data for successful execution message
                    if (!execution.replierHandle || !execution.bnsName || !execution.txid) {
                        result.skipped = true;
                        result.skipReason = `Missing required data: handle=${!!execution.replierHandle}, bns=${!!execution.bnsName}, txid=${!!execution.txid}`;
                        summary.skipped++;
                        summary.results.push(result);
                        continue;
                    }
                    
                    // Create the actual message that would be sent with randomized variations
                    const messageVariations = [
                        `hey @${safeHandle} - i just sent you ${safeAmount} ${safeToken} to your bns at ${safeBnsName} for replying to this post`,
                        `@${safeHandle} just sent you ${safeAmount} ${safeToken} to ${safeBnsName} for the reply`,
                        `hey @${safeHandle} - you got ${safeAmount} ${safeToken} for replying. sent to ${safeBnsName}`,
                        `@${safeHandle} sent ${safeAmount} ${safeToken} to your bns at ${safeBnsName} for replying to this post`,
                        `hey @${safeHandle} - ${safeAmount} ${safeToken} sent to ${safeBnsName} for the reply`,
                        `@${safeHandle} you got ${safeAmount} ${safeToken} at ${safeBnsName} for replying to this`,
                        `hey @${safeHandle} - just sent ${safeAmount} ${safeToken} to ${safeBnsName} for replying`,
                        `@${safeHandle} ${safeAmount} ${safeToken} sent to your bns at ${safeBnsName} for the reply`,
                        `hey @${safeHandle} - sent you ${safeAmount} ${safeToken} at ${safeBnsName} for replying to this post`,
                        `@${safeHandle} just dropped ${safeAmount} ${safeToken} to ${safeBnsName} for the reply`
                    ];
                    
                    // Use a deterministic random selection based on execution ID for consistency
                    const idSlice = execution.id.slice(-2);
                    const parsedIndex = parseInt(idSlice, 16);
                    const messageIndex = isNaN(parsedIndex) ? 0 : parsedIndex % messageVariations.length;
                    const selectedMessage = messageVariations[messageIndex] || messageVariations[0];
                    
                    backfillMessage = `${selectedMessage}\n\n` +
                                    `https://explorer.hiro.so/txid/${safeTxid}?chain=mainnet`;
                    
                    console.log(`[Backfill Debug] Success message for ${execution.id}:`, {
                        replierHandle: execution.replierHandle,
                        bnsName: execution.bnsName,
                        txid: execution.txid,
                        amountFormatted,
                        tokenSymbol
                    });
                }
                
                // Mark this reply tweet ID as processed to prevent duplicates
                if (execution.replyTweetId) {
                    processedReplyTweetIds.add(execution.replyTweetId);
                }
                
                if (dryRun) {
                    // Dry run - just simulate and show the message
                    result.success = true;
                    result.skipped = true;
                    result.skipReason = 'Dry run - would send reply';
                    result.previewMessage = backfillMessage; // Add the preview message
                    summary.skipped++;
                    
                    // Debug log to verify the message content
                    console.log(`[Backfill Debug] Preview message for ${execution.id}:`, {
                        messageLength: backfillMessage?.length || 0,
                        messagePreview: backfillMessage?.substring(0, 100) || 'UNDEFINED',
                        messageType: isBNSNotFound ? 'BNS_REMINDER' : 'SUCCESS_NOTIFICATION'
                    });
                } else {
                    // Queue reply (don't wait for completion)
                    const { getTwitterReplyService } = await import('@/lib/twitter-triggers/twitter-reply-service');
                    const twitterReplyService = getTwitterReplyService();
                    
                    console.log(`[Backfill Replies] Queuing reply to @${execution.replierHandle} for ${execution.bnsName}`);
                    
                    // Queue the reply without waiting for it to be processed
                    twitterReplyService.replyToTweet(execution.replyTweetId!, backfillMessage)
                        .then((replyResult) => {
                            if (replyResult.success) {
                                console.log(`[Backfill Replies] ✅ Successfully sent reply to @${execution.replierHandle}: ${replyResult.tweetId}`);
                                // Update execution record with reply success (async)
                                import('@/lib/twitter-triggers/store').then(({ updateTwitterExecution }) => {
                                    updateTwitterExecution(execution.id, {
                                        twitterReplyId: replyResult.tweetId,
                                        twitterReplyStatus: 'sent',
                                        twitterReplyError: undefined
                                    }).catch(console.error);
                                });
                            } else {
                                console.error(`[Backfill Replies] ❌ Failed to send reply to @${execution.replierHandle}:`, replyResult.error);
                                // Update execution record with reply failure (async)
                                import('@/lib/twitter-triggers/store').then(({ updateTwitterExecution }) => {
                                    updateTwitterExecution(execution.id, {
                                        twitterReplyStatus: 'failed',
                                        twitterReplyError: replyResult.error
                                    }).catch(console.error);
                                });
                            }
                        })
                        .catch((error) => {
                            console.error(`[Backfill Replies] ❌ Error queuing reply to @${execution.replierHandle}:`, error);
                        });
                    
                    // Mark as queued for immediate response
                    result.success = true;
                    result.tweetId = 'queued';
                    summary.sent++;
                }
                
                summary.results.push(result);
                
                // No delay needed since we're just queuing, not processing
                
            } catch (error) {
                result.success = false;
                result.error = error instanceof Error ? error.message : 'Unknown error';
                summary.failed++;
                summary.results.push(result);
                
                console.error(`[Backfill Replies] Error processing execution ${execution.id}:`, error);
            }
        }
        
        console.log(`[Backfill Replies] Completed. Summary:`, {
            eligible: summary.eligible,
            sent: summary.sent,
            failed: summary.failed,
            skipped: summary.skipped
        });
        
        return NextResponse.json({
            success: true,
            data: {
                summary,
                dryRun,
                message: dryRun 
                    ? `Dry run completed: Found ${summary.eligible} eligible executions that would receive backfill replies`
                    : `Backfill completed: Queued ${summary.sent} replies for processing. Check the Queue Management tab to monitor progress.`
            }
        });
        
    } catch (error) {
        console.error('[Backfill Replies] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during backfill'
        }, { status: 500 });
    }
}

// GET /api/admin/twitter-triggers/backfill-replies - Preview what executions would be backfilled
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const onlyRecentDays = parseInt(searchParams.get('onlyRecentDays') || '7');
        const skipExistingReplies = searchParams.get('skipExistingReplies') !== 'false';
        const includeBNSReminders = searchParams.get('includeBNSReminders') === 'true';
        
        // Get executions that don't have replies yet
        const { listAllTwitterExecutions } = await import('@/lib/twitter-triggers/store');
        const allExecutions = await listAllTwitterExecutions(500);
        
        // Filter for executions that need replies
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - onlyRecentDays);
        
        // Track reply tweet IDs to prevent duplicate replies in preview too
        const seenReplyTweetIds = new Set<string>();
        
        const eligibleExecutions = allExecutions.filter(execution => {
            // Must have reply information
            if (!execution.replyTweetId || !execution.replierHandle) {
                return false;
            }
            
            // Check date filter
            if (onlyRecentDays > 0) {
                const executedDate = new Date(execution.executedAt);
                if (executedDate < cutoffDate) {
                    return false;
                }
            }
            
            // Skip if already has reply (unless specifically requested)
            if (skipExistingReplies && execution.twitterReplyStatus === 'sent') {
                return false;
            }
            
            // Skip if we've already seen this reply tweet ID
            if (seenReplyTweetIds.has(execution.replyTweetId)) {
                return false;
            }
            
            // Filter by execution type
            if (includeBNSReminders) {
                // Include both successful orders AND BNS not found cases
                const isSuccessful = (execution.status === 'order_broadcasted' || execution.status === 'order_confirmed') && execution.txid;
                const isBNSNotFound = execution.status === 'failed' && 
                                    execution.error?.includes('BNS') && 
                                    (execution.error.includes('not found') || execution.error.includes('resolution failed'));
                
                if (!isSuccessful && !isBNSNotFound) {
                    return false;
                }
            } else {
                // Original behavior - only successful executions
                if (execution.status !== 'order_broadcasted' && execution.status !== 'order_confirmed') {
                    return false;
                }
                
                // Must have transaction ID and BNS name for successful executions
                if (!execution.txid || !execution.bnsName) {
                    return false;
                }
            }
            
            // Mark this reply tweet ID as seen
            seenReplyTweetIds.add(execution.replyTweetId);
            
            return true;
        }).slice(0, limit);
        
        const preview = eligibleExecutions.map(execution => ({
            executionId: execution.id,
            replierHandle: execution.replierHandle,
            bnsName: execution.bnsName,
            txid: execution.txid,
            executedAt: execution.executedAt,
            currentReplyStatus: execution.twitterReplyStatus || 'none',
            triggerId: execution.triggerId
        }));
        
        return NextResponse.json({
            success: true,
            data: {
                totalFound: allExecutions.length,
                eligible: eligibleExecutions.length,
                preview,
                filters: {
                    limit,
                    onlyRecentDays,
                    skipExistingReplies
                }
            }
        });
        
    } catch (error) {
        console.error('[Backfill Replies Preview] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during preview'
        }, { status: 500 });
    }
}