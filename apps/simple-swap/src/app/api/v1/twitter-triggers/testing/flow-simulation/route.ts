import { NextRequest, NextResponse } from 'next/server';
import { scrapeTwitterReplies, validateTweetUrl } from '@/lib/twitter-triggers/twitter-scraper';
import { processBNSFromReply } from '@/lib/twitter-triggers/bns-resolver';

// POST /api/v1/twitter-triggers/testing/flow-simulation - Test complete trigger flow
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tweetUrl, inputToken, outputToken, amountIn } = body;
        
        if (!tweetUrl || !inputToken || !outputToken || !amountIn) {
            return NextResponse.json({
                success: false,
                error: 'tweetUrl, inputToken, outputToken, and amountIn are required'
            }, { status: 400 });
        }

        // Validate tweet URL
        const urlValidation = validateTweetUrl(tweetUrl);
        if (!urlValidation.valid) {
            return NextResponse.json({
                success: false,
                error: urlValidation.error
            }, { status: 400 });
        }

        const tweetId = urlValidation.tweetId!;
        
        console.log(`[Testing API] Testing complete flow for tweet ${tweetId}`);
        
        const flowResult = {
            tweetId,
            tweetUrl,
            inputToken,
            outputToken,
            amountIn,
            steps: [] as any[],
            summary: {
                totalReplies: 0,
                bnsNamesFound: 0,
                successfulResolutions: 0,
                wouldExecute: 0,
                errors: [] as string[]
            },
            testedAt: new Date().toISOString()
        };

        // Step 1: Scrape Twitter replies
        const step1Start = Date.now();
        try {
            const scrapingResult = await scrapeTwitterReplies(tweetId);
            const step1Time = Date.now() - step1Start;
            
            flowResult.steps.push({
                step: 1,
                name: 'Twitter Scraping',
                success: scrapingResult.success,
                duration: step1Time,
                data: {
                    repliesFound: scrapingResult.replies?.length || 0,
                    error: scrapingResult.error
                }
            });

            if (!scrapingResult.success) {
                flowResult.summary.errors.push(`Twitter scraping failed: ${scrapingResult.error}`);
                return NextResponse.json({
                    success: true,
                    data: flowResult
                });
            }

            flowResult.summary.totalReplies = scrapingResult.replies.length;

            // Step 2: Process each reply for BNS names
            const step2Start = Date.now();
            const bnsResults = [];
            
            for (const reply of scrapingResult.replies) {
                try {
                    const bnsResult = await processBNSFromReply(reply.authorHandle, reply.authorDisplayName || '');
                    
                    if (bnsResult.bnsName) {
                        flowResult.summary.bnsNamesFound++;
                        
                        const replyResult = {
                            replyId: reply.id,
                            authorHandle: reply.authorHandle,
                            authorDisplayName: reply.authorDisplayName,
                            bnsName: bnsResult.bnsName,
                            address: bnsResult.resolution?.address,
                            resolutionSuccess: bnsResult.resolution?.success || false,
                            resolutionError: bnsResult.resolution?.error,
                            extractedFrom: bnsResult.extractedFrom
                        };
                        
                        bnsResults.push(replyResult);
                        
                        if (bnsResult.resolution?.success) {
                            flowResult.summary.successfulResolutions++;
                            flowResult.summary.wouldExecute++;
                        }
                    }
                } catch (error) {
                    console.warn(`[Testing API] Error processing reply ${reply.id}:`, error);
                    flowResult.summary.errors.push(`Error processing reply ${reply.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            
            const step2Time = Date.now() - step2Start;
            
            flowResult.steps.push({
                step: 2,
                name: 'BNS Processing',
                success: true,
                duration: step2Time,
                data: {
                    bnsNamesFound: flowResult.summary.bnsNamesFound,
                    successfulResolutions: flowResult.summary.successfulResolutions,
                    results: bnsResults
                }
            });

            // Step 3: Order creation simulation
            const step3Start = Date.now();
            const orderSimulations = [];
            
            for (const bnsResult of bnsResults.filter(r => r.resolutionSuccess)) {
                // Simulate order creation
                orderSimulations.push({
                    recipientAddress: bnsResult.address,
                    bnsName: bnsResult.bnsName,
                    inputToken,
                    outputToken,
                    amountIn,
                    simulatedOrderId: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    wouldExecute: true
                });
            }
            
            const step3Time = Date.now() - step3Start;
            
            flowResult.steps.push({
                step: 3,
                name: 'Order Creation Simulation',
                success: true,
                duration: step3Time,
                data: {
                    ordersWouldCreate: orderSimulations.length,
                    simulations: orderSimulations
                }
            });

        } catch (error) {
            console.error('[Testing API] Error in flow simulation:', error);
            flowResult.summary.errors.push(`Flow simulation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        return NextResponse.json({
            success: true,
            data: flowResult
        });
        
    } catch (error) {
        console.error('[Testing API] Error testing flow simulation:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to test flow simulation',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}