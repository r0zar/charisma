import { NextRequest, NextResponse } from 'next/server';
import { getTwitterTrigger, updateTwitterTrigger } from '@/lib/twitter-triggers/store';

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
        
        // Implement actual Twitter checking logic
        let repliesFound = 0;
        let bnsNamesFound = 0;
        let ordersExecuted = 0;
        let status = 'No new replies with .btc names found';
        let mockExecutions = [];
        
        try {
            // Import required functions
            const { scrapeTwitterReplies } = await import('@/lib/twitter-triggers/twitter-scraper');
            const { processBNSFromReply } = await import('@/lib/twitter-triggers/bns-resolver');
            
            // Scrape Twitter replies
            console.log(`[Test API] Scraping replies for tweet ${trigger.tweetId}`);
            const scrapingResult = await scrapeTwitterReplies(trigger.tweetId);
            
            if (scrapingResult.success && scrapingResult.replies.length > 0) {
                repliesFound = scrapingResult.replies.length;
                console.log(`[Test API] Found ${repliesFound} replies`);
                
                // Check each reply for BNS names with real resolution
                const bnsReplies = [];
                for (const reply of scrapingResult.replies) {
                    try {
                        // Use the full BNS processing pipeline like the real system
                        const bnsResult = await processBNSFromReply(reply.authorHandle, reply.authorDisplayName || '');
                        
                        if (bnsResult.bnsName) {
                            bnsNamesFound++;
                            console.log(`[Test API] Found BNS name: ${bnsResult.bnsName} from @${reply.authorHandle}`);
                            
                            let recipientAddress: string | undefined;
                            let resolutionStatus = 'pending';
                            let resolutionError: string | undefined;
                            
                            // Attempt BNS resolution
                            if (bnsResult.resolution && bnsResult.resolution.success) {
                                recipientAddress = bnsResult.resolution.address;
                                resolutionStatus = 'resolved';
                                console.log(`[Test API] BNS ${bnsResult.bnsName} resolved to: ${recipientAddress}`);
                            } else {
                                resolutionStatus = 'failed';
                                resolutionError = bnsResult.resolution?.error || 'Resolution failed';
                                console.log(`[Test API] BNS resolution failed for ${bnsResult.bnsName}: ${resolutionError}`);
                            }
                            
                            bnsReplies.push({
                                ...reply,
                                bnsName: bnsResult.bnsName,
                                recipientAddress,
                                resolutionStatus,
                                resolutionError
                            });
                            
                            // Create detailed mock execution entry with real data
                            mockExecutions.push({
                                id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                triggerId: id,
                                replyTweetId: reply.id,
                                replierHandle: reply.authorHandle,
                                replierDisplayName: reply.authorDisplayName || '',
                                bnsName: bnsResult.bnsName,
                                recipientAddress,
                                orderUuid: undefined, // Would be assigned in real execution
                                executedAt: new Date().toISOString(),
                                status: resolutionStatus === 'resolved' ? 'test_run' as any : 'test_failed' as any,
                                replyText: reply.text ? reply.text.substring(0, 200) + (reply.text.length > 200 ? '...' : '') : '',
                                replyCreatedAt: reply.createdAt,
                                error: resolutionError
                            });
                        }
                    } catch (bnsError) {
                        console.warn(`[Test API] Error processing BNS for reply ${reply.id}:`, bnsError);
                        // Continue with other replies
                    }
                }
                
                if (bnsNamesFound > 0) {
                    const resolvedCount = bnsReplies.filter(r => r.resolutionStatus === 'resolved').length;
                    const failedCount = bnsReplies.filter(r => r.resolutionStatus === 'failed').length;
                    
                    status = `Found ${bnsNamesFound} reply${bnsNamesFound > 1 ? 'ies' : ''} with .btc names from ${repliesFound} total replies`;
                    if (resolvedCount > 0) {
                        status += ` (${resolvedCount} resolved`;
                        if (failedCount > 0) {
                            status += `, ${failedCount} failed to resolve`;
                        }
                        status += ')';
                    } else if (failedCount > 0) {
                        status += ` (all ${failedCount} failed to resolve)`;
                    }
                    
                    // In test mode, we don't actually execute orders, just report what would happen
                    const availableOrders = trigger.availableOrders || 0;
                    const executableCount = resolvedCount; // Only resolved BNS names can execute
                    const maxExecutions = Math.min(executableCount, availableOrders);
                    const overflowCount = Math.max(0, executableCount - availableOrders);
                    
                    if (maxExecutions > 0) {
                        status += ` - Would execute ${maxExecutions} order${maxExecutions > 1 ? 's' : ''}`;
                        if (overflowCount > 0) {
                            status += ` + ${overflowCount} overflow execution${overflowCount > 1 ? 's' : ''} (need${overflowCount > 1 ? '' : 's'} additional order${overflowCount > 1 ? 's' : ''})`;
                        }
                        
                        // Update mock executions to reflect what would actually execute vs overflow
                        mockExecutions = mockExecutions.map((exec, index) => {
                            if (exec.status === 'test_run' && index < maxExecutions) {
                                return {
                                    ...exec,
                                    status: 'test_would_execute' as any
                                };
                            } else if (exec.status === 'test_run' && index < executableCount) {
                                return {
                                    ...exec,
                                    status: 'test_overflow' as any,
                                    error: 'Overflow execution - needs additional signed order'
                                };
                            } else if (exec.status === 'test_run') {
                                return {
                                    ...exec,
                                    status: 'test_limited' as any,
                                    error: 'Would not execute - BNS resolution failed'
                                };
                            }
                            return exec;
                        });
                    } else if (executableCount > 0) {
                        status += ` - All ${executableCount} execution${executableCount > 1 ? 's' : ''} would be overflow (need${executableCount > 1 ? '' : 's'} signed order${executableCount > 1 ? 's' : ''})`;
                        // Mark all resolved ones as overflow
                        mockExecutions = mockExecutions.map(exec => ({
                            ...exec,
                            status: exec.status === 'test_run' ? 'test_overflow' as any : exec.status,
                            error: exec.status === 'test_run' ? 'Overflow execution - needs additional signed order' : exec.error
                        }));
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
            console.error(`[Test API] Error during Twitter scraping test:`, error);
            status = `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        const testResult = {
            success: true,
            message: 'Manual test completed successfully',
            data: {
                triggerId: id,
                tweetId: trigger.tweetId,
                tweetUrl: trigger.tweetUrl,
                lastChecked: new Date().toISOString(),
                repliesFound,
                bnsNamesFound,
                ordersExecuted, // Always 0 in test mode
                availableOrders: trigger.availableOrders || 0,
                status,
                mockExecutions // Include the test execution results
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