import { NextRequest, NextResponse } from 'next/server';
import { getTwitterReplyService } from '@/lib/twitter-triggers/twitter-reply-service';

/**
 * Admin API for Twitter Reply Queue Management
 * 
 * GET /api/admin/twitter-queue - Get queue status and metrics
 * POST /api/admin/twitter-queue - Execute queue control commands
 */

export async function GET(request: NextRequest) {
    try {
        const twitterReplyService = getTwitterReplyService();
        
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action');
        
        if (action === 'status') {
            const status = await twitterReplyService.getQueueStatus();
            return NextResponse.json({ success: true, data: status });
        }
        
        if (action === 'items') {
            const limit = parseInt(searchParams.get('limit') || '50');
            const items = await twitterReplyService.getQueueItems(limit);
            return NextResponse.json({ success: true, data: items });
        }
        
        if (action === 'force-method') {
            const forceMethod = twitterReplyService.getForceMethod();
            return NextResponse.json({ success: true, data: { forceMethod } });
        }

        
        // Default: return comprehensive status
        const [status, items] = await Promise.all([
            twitterReplyService.getQueueStatus(),
            twitterReplyService.getQueueItems(20)
        ]);
        
        return NextResponse.json({ 
            success: true, 
            data: { 
                status,
                recentItems: items,
                forceMethod: twitterReplyService.getForceMethod()
            } 
        });
        
    } catch (error) {
        console.error('[Admin API] Error getting queue status:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...params } = body;
        
        const twitterReplyService = getTwitterReplyService();
        
        switch (action) {
            case 'pause':
                await twitterReplyService.pauseQueue();
                return NextResponse.json({ 
                    success: true, 
                    message: 'Queue processing paused' 
                });
                
            case 'resume':
                await twitterReplyService.resumeQueue();
                return NextResponse.json({ 
                    success: true, 
                    message: 'Queue processing resumed' 
                });
                
            case 'clear':
                const clearResult = await twitterReplyService.clearQueue();
                return NextResponse.json({ 
                    success: true, 
                    message: `Cleared ${clearResult.cleared} items from queue`,
                    data: clearResult
                });
                
            case 'retry-failed':
                const retryResult = await twitterReplyService.retryFailedItems();
                return NextResponse.json({ 
                    success: true, 
                    message: `Reset retry attempts for ${retryResult.retried} items`,
                    data: retryResult
                });
                
            case 'set-force-method':
                const { method } = params;
                if (!['api', 'auto'].includes(method)) {
                    return NextResponse.json(
                        { success: false, error: 'Invalid method. Must be api or auto' },
                        { status: 400 }
                    );
                }
                await twitterReplyService.setForceMethod(method);
                return NextResponse.json({ 
                    success: true, 
                    message: `Force method set to: ${method}` 
                });
                
            case 'reset-metrics':
                await twitterReplyService.resetMetrics();
                return NextResponse.json({ 
                    success: true, 
                    message: 'Metrics reset successfully' 
                });
                

                
            case 'test-reply':
                const { tweetId, message, priority, preferredMethod } = params;
                if (!tweetId || !message) {
                    return NextResponse.json(
                        { success: false, error: 'tweetId and message are required' },
                        { status: 400 }
                    );
                }
                
                const testResult = await twitterReplyService.replyToTweet(tweetId, message, {
                    priority: priority || 'high',
                    preferredMethod: preferredMethod || 'auto'
                });
                
                return NextResponse.json({ 
                    success: testResult.success, 
                    message: testResult.success ? 'Test reply queued successfully' : 'Test reply failed',
                    data: testResult
                });
                
            default:
                return NextResponse.json(
                    { success: false, error: 'Invalid action' },
                    { status: 400 }
                );
        }
        
    } catch (error) {
        console.error('[Admin API] Error executing queue action:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            },
            { status: 500 }
        );
    }
}