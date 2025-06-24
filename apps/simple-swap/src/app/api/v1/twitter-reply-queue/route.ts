import { NextResponse } from 'next/server';
import { getTwitterReplyService } from '@/lib/twitter-triggers/twitter-reply-service';

export async function GET() {
    try {
        const twitterReplyService = getTwitterReplyService();
        const status = await twitterReplyService.getQueueStatus();
        
        return NextResponse.json({
            status: 'success',
            data: {
                queueSize: status.queueSize,
                requestCount: status.requestCount,
                maxRequests: status.maxRequests,
                rateLimitReset: status.rateLimitReset,
                rateLimitResetTime: status.rateLimitReset > 0 ? new Date(status.rateLimitReset).toISOString() : null,
                remainingRequests: Math.max(0, status.maxRequests - status.requestCount)
            }
        });
    } catch (error) {
        console.error('Twitter reply queue status error:', error);
        return NextResponse.json(
            { error: 'Failed to get queue status' },
            { status: 500 }
        );
    }
}