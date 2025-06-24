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
            skipExistingReplies = true 
        } = await request.json();
        
        console.log(`[Backfill Replies] Starting backfill - dryRun: ${dryRun}, limit: ${limit}, recentDays: ${onlyRecentDays}`);
        
        // Get successful executions that don't have replies yet
        const { listAllTwitterExecutions } = await import('@/lib/twitter-triggers/store');
        const allExecutions = await listAllTwitterExecutions(500); // Get more to filter from
        
        // Filter for successful executions that need replies
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - onlyRecentDays);
        
        const eligibleExecutions = allExecutions.filter(execution => {
            // Must have successful order
            if (execution.status !== 'order_broadcasted' && execution.status !== 'order_confirmed') {
                return false;
            }
            
            // Must have transaction ID
            if (!execution.txid) {
                return false;
            }
            
            // Must have reply information
            if (!execution.replyTweetId || !execution.replierHandle || !execution.bnsName) {
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
                
                // Get trigger information to build proper reply message
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
                const { getTokenMetadataCached } = await import('@repo/tokens');
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
                
                // Debug log for message selection
                console.log(`[Backfill Debug] Message selection for ${execution.id}:`, {
                    idSlice,
                    parsedIndex,
                    messageIndex,
                    variationsLength: messageVariations.length,
                    selectedMessage: selectedMessage || 'FALLBACK_UNDEFINED',
                    isValidIndex: messageIndex >= 0 && messageIndex < messageVariations.length
                });
                
                // Debug logging to see what data we have
                console.log(`[Backfill Debug] Execution ${execution.id}:`, {
                    replierHandle: execution.replierHandle,
                    bnsName: execution.bnsName,
                    txid: execution.txid,
                    amountFormatted,
                    tokenSymbol
                });
                
                // Validate that we have all required data for the message
                if (!execution.replierHandle || !execution.bnsName || !execution.txid) {
                    result.skipped = true;
                    result.skipReason = `Missing required data: handle=${!!execution.replierHandle}, bns=${!!execution.bnsName}, txid=${!!execution.txid}`;
                    summary.skipped++;
                    summary.results.push(result);
                    continue;
                }
                
                const backfillMessage = `${selectedMessage}\n\n` +
                                      `https://explorer.hiro.so/txid/${safeTxid}?chain=mainnet`;
                
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
                        selectedMessage: selectedMessage || 'UNDEFINED'
                    });
                } else {
                    // Send actual reply
                    const { getTwitterReplyService } = await import('@/lib/twitter-triggers/twitter-reply-service');
                    const twitterReplyService = getTwitterReplyService();
                    
                    console.log(`[Backfill Replies] Sending reply to @${execution.replierHandle} for ${execution.bnsName}`);
                    
                    const replyResult = await twitterReplyService.replyToTweet(execution.replyTweetId!, backfillMessage);
                    
                    if (replyResult.success) {
                        result.success = true;
                        result.tweetId = replyResult.tweetId;
                        summary.sent++;
                        
                        // Update execution record with reply success
                        const { updateTwitterExecution } = await import('@/lib/twitter-triggers/store');
                        await updateTwitterExecution(execution.id, {
                            twitterReplyId: replyResult.tweetId,
                            twitterReplyStatus: 'sent',
                            twitterReplyError: undefined // Clear any previous error
                        });
                        
                        console.log(`[Backfill Replies] ✅ Successfully sent reply to @${execution.replierHandle}`);
                    } else {
                        result.success = false;
                        result.error = replyResult.error;
                        summary.failed++;
                        
                        // Update execution record with reply failure
                        const { updateTwitterExecution } = await import('@/lib/twitter-triggers/store');
                        await updateTwitterExecution(execution.id, {
                            twitterReplyStatus: 'failed',
                            twitterReplyError: replyResult.error
                        });
                        
                        console.error(`[Backfill Replies] ❌ Failed to send reply to @${execution.replierHandle}:`, replyResult.error);
                    }
                }
                
                summary.results.push(result);
                
                // Add small delay to avoid rate limiting
                if (!dryRun) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                }
                
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
                    : `Backfill completed: Sent ${summary.sent} replies, ${summary.failed} failed, ${summary.skipped} skipped`
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
        
        // Get successful executions that don't have replies yet
        const { listAllTwitterExecutions } = await import('@/lib/twitter-triggers/store');
        const allExecutions = await listAllTwitterExecutions(500);
        
        // Filter for successful executions that need replies
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - onlyRecentDays);
        
        // Track reply tweet IDs to prevent duplicate replies in preview too
        const seenReplyTweetIds = new Set<string>();
        
        const eligibleExecutions = allExecutions.filter(execution => {
            if (execution.status !== 'order_broadcasted' && execution.status !== 'order_confirmed') {
                return false;
            }
            
            if (!execution.txid || !execution.replyTweetId || !execution.replierHandle || !execution.bnsName) {
                return false;
            }
            
            if (onlyRecentDays > 0) {
                const executedDate = new Date(execution.executedAt);
                if (executedDate < cutoffDate) {
                    return false;
                }
            }
            
            if (skipExistingReplies && execution.twitterReplyStatus === 'sent') {
                return false;
            }
            
            // Skip if we've already seen this reply tweet ID
            if (seenReplyTweetIds.has(execution.replyTweetId)) {
                return false;
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