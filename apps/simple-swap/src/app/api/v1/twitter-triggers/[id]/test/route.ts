import { NextRequest, NextResponse } from 'next/server';
import { getTwitterTrigger, updateTwitterTrigger, createTwitterExecution, updateTwitterExecution, incrementTriggerCount, getExecutionByTriggerAndBNS } from '@/lib/twitter-triggers/store';

// POST /api/v1/twitter-triggers/[id]/test - Manually test a trigger
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;
        
        const trigger = await getTwitterTrigger(id);
        
        if (!trigger) {
            return NextResponse.json({
                success: false,
                error: 'Twitter trigger not found'
            }, { status: 404 });
        }
        
        if (!trigger.isActive) {
            return NextResponse.json({
                success: false,
                error: 'Trigger is not active'
            }, { status: 400 });
        }
        
        // Update last checked timestamp
        await updateTwitterTrigger(id, {
            lastChecked: new Date().toISOString()
        });
        
        // Implement actual Twitter checking and execution logic
        let repliesFound = 0;
        let bnsNamesFound = 0;
        let ordersExecuted = 0;
        let status = 'No new replies with .btc names found';
        const realExecutions = [];
        
        try {
            // Import required functions
            const { scrapeTwitterReplies } = await import('@/lib/twitter-triggers/twitter-scraper');
            const { processBNSFromReply } = await import('@/lib/twitter-triggers/bns-resolver');
            const { executePreSignedOrder } = await import('@/lib/twitter-triggers/processor');
            
            // Scrape Twitter replies
            console.log(`[Test API] Scraping replies for tweet ${trigger.tweetId}`);
            const scrapingResult = await scrapeTwitterReplies(trigger.tweetId);
            
            if (scrapingResult.success && scrapingResult.replies.length > 0) {
                repliesFound = scrapingResult.replies.length;
                console.log(`[Test API] Found ${repliesFound} replies`);
                
                // Process each reply for BNS resolution and actual order execution
                for (const reply of scrapingResult.replies) {
                    try {
                        // Use the full BNS processing pipeline like the real system
                        const bnsResult = await processBNSFromReply(reply.authorHandle, reply.authorDisplayName || '');
                        
                        if (bnsResult.bnsName) {
                            bnsNamesFound++;
                            console.log(`[Test API] Found BNS name: ${bnsResult.bnsName} from @${reply.authorHandle}`);
                            
                            // Check if we already have an execution for this trigger + BNS combination (idempotent processing)
                            const existingExecution = await getExecutionByTriggerAndBNS(id, bnsResult.bnsName);
                            
                            let execution;
                            
                            if (existingExecution) {
                                console.log(`[Test API] Found existing execution ${existingExecution.id} for BNS ${bnsResult.bnsName} with status: ${existingExecution.status}`);
                                
                                // Decide what to do based on existing execution status
                                if (existingExecution.status === 'order_broadcasted' || existingExecution.status === 'order_confirmed') {
                                    console.log(`[Test API] ✅ Skipping BNS ${bnsResult.bnsName} - already processed successfully`);
                                    realExecutions.push(existingExecution);
                                    continue; // Skip to next reply
                                }
                                
                                // For failed, pending, or bns_resolved statuses, we'll retry the execution
                                console.log(`[Test API] 🔄 Retrying execution for BNS ${bnsResult.bnsName} - previous status: ${existingExecution.status}`);
                                execution = existingExecution;
                                
                                // Reset status to pending for retry
                                await updateTwitterExecution(execution.id, {
                                    status: 'pending',
                                    error: undefined, // Clear any previous error
                                    executedAt: new Date().toISOString(), // Update timestamp for retry
                                });
                            } else {
                                // No existing execution, create a new one
                                console.log(`[Test API] 🆕 Creating new execution for BNS ${bnsResult.bnsName}`);
                                execution = await createTwitterExecution({
                                    triggerId: id,
                                    replyTweetId: reply.id,
                                    replierHandle: reply.authorHandle,
                                    replierDisplayName: reply.authorDisplayName || '',
                                    bnsName: bnsResult.bnsName,
                                    executedAt: new Date().toISOString(),
                                    status: 'pending',
                                    replyText: reply.text ? reply.text.substring(0, 200) + (reply.text.length > 200 ? '...' : '') : '',
                                    replyCreatedAt: reply.createdAt,
                                });
                            }

                            realExecutions.push(execution);
                            
                            // Check if BNS resolution was successful
                            if (!bnsResult.resolution || !bnsResult.resolution.success) {
                                const error = bnsResult.resolution?.error || 'BNS resolution failed';
                                console.log(`[Test API] BNS resolution failed for ${bnsResult.bnsName}: ${error}`);

                                await updateTwitterExecution(execution.id, {
                                    status: 'failed',
                                    error: `BNS resolution failed: ${error}`,
                                });

                                continue;
                            }

                            const recipientAddress = bnsResult.resolution.address;
                            console.log(`[Test API] BNS ${bnsResult.bnsName} resolved to address: ${recipientAddress}`);

                            // Update execution with resolved address
                            await updateTwitterExecution(execution.id, {
                                recipientAddress,
                                status: 'bns_resolved',
                            });

                            // Try to execute a pre-signed order
                            try {
                                const orderResult = await executePreSignedOrder(trigger, recipientAddress!, execution.id);

                                if (orderResult.success) {
                                    // Update execution with order details including txid
                                    await updateTwitterExecution(execution.id, {
                                        orderUuid: orderResult.orderUuid,
                                        txid: orderResult.txid,
                                        status: 'order_broadcasted',
                                    });

                                    // Increment trigger count
                                    await incrementTriggerCount(trigger.id);
                                    ordersExecuted++;

                                    console.log(`[Test API] ✅ Successfully executed order ${orderResult.orderUuid} for BNS ${bnsResult.bnsName} (${recipientAddress})`);
                                    
                                } else if (orderResult.error === 'No available orders - all pre-signed orders have been used') {
                                    // Handle overflow - mark as overflow execution
                                    await updateTwitterExecution(execution.id, {
                                        status: 'overflow',
                                        error: 'No available pre-signed orders remaining',
                                    });

                                    console.log(`[Test API] ⚠️ Overflow execution for BNS ${bnsResult.bnsName} - no available orders`);
                                } else {
                                    // Order execution failed
                                    await updateTwitterExecution(execution.id, {
                                        status: 'failed',
                                        error: `Order execution failed: ${orderResult.error}`,
                                    });

                                    console.log(`[Test API] ❌ Order execution failed for BNS ${bnsResult.bnsName}: ${orderResult.error}`);
                                }
                            } catch (orderError) {
                                await updateTwitterExecution(execution.id, {
                                    status: 'failed',
                                    error: `Order execution error: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`,
                                });

                                console.error(`[Test API] Order execution error for BNS ${bnsResult.bnsName}:`, orderError);
                            }
                        }
                    } catch (bnsError) {
                        console.warn(`[Test API] Error processing BNS for reply ${reply.id}:`, bnsError);
                        // Continue with other replies
                    }
                }
                
                // Build status message
                if (bnsNamesFound > 0) {
                    const successfulExecutions = realExecutions.filter(e => e.status === 'order_broadcasted').length;
                    const overflowExecutions = realExecutions.filter(e => e.status === 'overflow').length;
                    const failedExecutions = realExecutions.filter(e => e.status === 'failed').length;
                    
                    status = `Found ${bnsNamesFound} reply${bnsNamesFound > 1 ? 'ies' : ''} with .btc names from ${repliesFound} total replies`;
                    
                    if (ordersExecuted > 0) {
                        status += ` - Successfully executed ${ordersExecuted} order${ordersExecuted > 1 ? 's' : ''}`;
                    }
                    
                    if (overflowExecutions > 0) {
                        status += ` - ${overflowExecutions} overflow execution${overflowExecutions > 1 ? 's' : ''} (need${overflowExecutions > 1 ? '' : 's'} additional order${overflowExecutions > 1 ? 's' : ''})`;
                    }
                    
                    if (failedExecutions > 0) {
                        status += ` - ${failedExecutions} failed execution${failedExecutions > 1 ? 's' : ''}`;
                    }
                } else {
                    status = `Found ${repliesFound} reply${repliesFound > 1 ? 'ies' : ''} but no .btc names detected`;
                }
            } else {
                status = 'No replies found for this tweet';
                if (!scrapingResult.success && scrapingResult.error) {
                    status += ` (${scrapingResult.error})`;
                }
            }
            
        } catch (error) {
            console.error(`[Test API] Error during Twitter trigger test:`, error);
            status = `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        // Also retry any previously failed executions for this trigger
        try {
            console.log(`[Test API] Checking for failed executions to retry for trigger ${id}`);
            const { retryFailedExecutions } = await import('@/lib/twitter-triggers/processor');
            const retryResult = await retryFailedExecutions(trigger);
            
            if (retryResult.ordersCreated > 0) {
                ordersExecuted += retryResult.ordersCreated;
                status += ` | Retried and created ${retryResult.ordersCreated} additional order${retryResult.ordersCreated > 1 ? 's' : ''}`;
            }
            
            if (retryResult.errors.length > 0) {
                console.warn(`[Test API] Retry errors:`, retryResult.errors);
                status += ` | ${retryResult.errors.length} retry error${retryResult.errors.length > 1 ? 's' : ''}`;
            }
            
        } catch (retryError) {
            console.error(`[Test API] Error during retry of failed executions:`, retryError);
            status += ` | Retry failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`;
        }

        const testResult = {
            success: true,
            message: 'Manual test completed successfully - REAL EXECUTIONS',
            data: {
                triggerId: id,
                tweetId: trigger.tweetId,
                tweetUrl: trigger.tweetUrl,
                lastChecked: new Date().toISOString(),
                repliesFound,
                bnsNamesFound,
                ordersExecuted, // Actual orders executed
                availableOrders: trigger.availableOrders || 0,
                status,
                realExecutions, // Include the actual execution results
                executionSummary: {
                    total: realExecutions.length,
                    successful: realExecutions.filter(e => e.status === 'order_broadcasted').length,
                    overflow: realExecutions.filter(e => e.status === 'overflow').length,
                    failed: realExecutions.filter(e => e.status === 'failed').length
                }
            }
        };
        
        console.log(`[Twitter API] Manual test completed for trigger ${id}`);
        
        return NextResponse.json(testResult);
        
    } catch (error) {
        console.error(`[Twitter API] Error testing trigger ${params.id}:`, error);
        return NextResponse.json({
            success: false,
            error: 'Failed to test Twitter trigger'
        }, { status: 500 });
    }
}