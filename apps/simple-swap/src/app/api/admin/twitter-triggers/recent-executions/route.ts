import { NextRequest, NextResponse } from 'next/server';
import { listAllTwitterExecutions } from '@/lib/twitter-triggers/store';

// GET /api/admin/twitter-triggers/recent-executions - Get recent executions with reply status
export async function GET(request: NextRequest) {
    try {
        console.log('[Recent Executions API] Fetching recent Twitter executions...');
        
        // Get recent executions (last 20)
        const executions = await listAllTwitterExecutions(20);
        
        // Format for easy viewing
        const formattedExecutions = executions.map(exec => ({
            id: exec.id,
            triggerId: exec.triggerId,
            replierHandle: exec.replierHandle,
            bnsName: exec.bnsName,
            status: exec.status,
            executedAt: exec.executedAt,
            recipientAddress: exec.recipientAddress,
            orderUuid: exec.orderUuid,
            txid: exec.txid,
            error: exec.error,
            // Reply tracking fields
            twitterReplyId: exec.twitterReplyId,
            twitterReplyStatus: exec.twitterReplyStatus,
            twitterReplyError: exec.twitterReplyError,
            // Computed fields for easy viewing
            hasReply: !!exec.twitterReplyId,
            replySuccess: exec.twitterReplyStatus === 'sent',
            replyFailed: exec.twitterReplyStatus === 'failed'
        }));
        
        console.log(`[Recent Executions API] Found ${formattedExecutions.length} recent executions`);
        
        // Summary stats
        const stats = {
            total: formattedExecutions.length,
            withReplies: formattedExecutions.filter(e => e.hasReply).length,
            repliesSent: formattedExecutions.filter(e => e.replySuccess).length,
            repliesFailed: formattedExecutions.filter(e => e.replyFailed).length,
            noReplies: formattedExecutions.filter(e => !e.twitterReplyStatus).length
        };
        
        return NextResponse.json({
            success: true,
            data: {
                executions: formattedExecutions,
                stats
            },
            message: `Retrieved ${formattedExecutions.length} recent executions`
        }, { status: 200 });
        
    } catch (error) {
        console.error('[Recent Executions API] Error fetching recent executions:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch recent executions'
        }, { status: 500 });
    }
}