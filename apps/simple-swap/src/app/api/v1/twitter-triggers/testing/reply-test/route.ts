import { NextRequest, NextResponse } from 'next/server';

// POST /api/v1/twitter-triggers/testing/reply-test - Test sending a Twitter reply
export async function POST(request: NextRequest) {
    try {
        const { tweetUrl, message } = await request.json();
        
        if (!tweetUrl || !message) {
            return NextResponse.json({
                success: false,
                error: 'Tweet URL and message are required'
            }, { status: 400 });
        }
        
        // Extract tweet ID from URL
        const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
        if (!tweetIdMatch) {
            return NextResponse.json({
                success: false,
                error: 'Invalid tweet URL format'
            }, { status: 400 });
        }
        
        const tweetId = tweetIdMatch[1];
        
        // Import and use the Twitter reply service
        const { getTwitterReplyService } = await import('@/lib/twitter-triggers/twitter-reply-service');
        const twitterReplyService = getTwitterReplyService();
        
        console.log(`[Twitter Reply Test] Testing reply to tweet ${tweetId} with message: ${message.substring(0, 50)}...`);
        
        // Attempt to send the reply
        const replyResult = await twitterReplyService.replyToTweet(tweetId, message);
        
        // Build response data
        const responseData = {
            success: replyResult.success,
            message: message,
            error: replyResult.error,
            debugInfo: {
                credentialsValid: !replyResult.error?.includes('credentials'),
                messageLength: message.length,
                targetTweetId: tweetId
            },
            testedAt: new Date().toISOString()
        };
        
        // Add success-specific data
        if (replyResult.success && replyResult.tweetId) {
            responseData.tweetId = replyResult.tweetId;
            responseData.replyUrl = `https://twitter.com/twitter/status/${replyResult.tweetId}`;
        }
        
        console.log(`[Twitter Reply Test] Result:`, {
            success: replyResult.success,
            tweetId: replyResult.tweetId,
            error: replyResult.error
        });
        
        return NextResponse.json({
            success: true,
            data: responseData
        });
        
    } catch (error) {
        console.error('[Twitter Reply Test] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during reply test'
        }, { status: 500 });
    }
}