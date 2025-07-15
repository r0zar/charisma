/**
 * Individual Reply Management API endpoint
 * GET /api/v1/activity/[id]/replies/[replyId] - Get specific reply
 * PUT /api/v1/activity/[id]/replies/[replyId] - Update reply
 * DELETE /api/v1/activity/[id]/replies/[replyId] - Delete reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { Reply } from '@/lib/activity/types';

const REPLY_HASH_KEY = 'activity_replies';
const ACTIVITY_REPLIES_SET = 'activity_replies:';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; replyId: string } }
) {
  try {
    const { id: activityId, replyId } = params;
    
    if (!activityId || !replyId) {
      return NextResponse.json(
        { error: 'Activity ID and Reply ID are required' },
        { status: 400 }
      );
    }
    
    // Get reply from storage
    const replyData = await kv.hget(REPLY_HASH_KEY, replyId);
    
    if (!replyData) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    
    const reply = JSON.parse(replyData as string) as Reply;
    
    // Verify reply belongs to the activity
    if (reply.activityId !== activityId) {
      return NextResponse.json(
        { error: 'Reply does not belong to this activity' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      data: reply
    });
    
  } catch (error) {
    console.error('Error fetching reply:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; replyId: string } }
) {
  try {
    const { id: activityId, replyId } = params;
    
    if (!activityId || !replyId) {
      return NextResponse.json(
        { error: 'Activity ID and Reply ID are required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { content, author } = body;
    
    // Validate required fields
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }
    
    // Get existing reply
    const existingReplyData = await kv.hget(REPLY_HASH_KEY, replyId);
    
    if (!existingReplyData) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    
    const existingReply = JSON.parse(existingReplyData as string) as Reply;
    
    // Verify reply belongs to the activity
    if (existingReply.activityId !== activityId) {
      return NextResponse.json(
        { error: 'Reply does not belong to this activity' },
        { status: 404 }
      );
    }
    
    // Verify author can edit (simple check - in production you'd check auth)
    if (author && existingReply.author !== author) {
      return NextResponse.json(
        { error: 'You can only edit your own replies' },
        { status: 403 }
      );
    }
    
    // Update reply
    const updatedReply: Reply = {
      ...existingReply,
      content,
      metadata: {
        ...existingReply.metadata,
        isEdited: true,
        editedAt: Date.now()
      }
    };
    
    // Save updated reply
    await kv.hset(REPLY_HASH_KEY, { [replyId]: JSON.stringify(updatedReply) });
    
    return NextResponse.json({
      success: true,
      data: updatedReply
    });
    
  } catch (error) {
    console.error('Error updating reply:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; replyId: string } }
) {
  try {
    const { id: activityId, replyId } = params;
    
    if (!activityId || !replyId) {
      return NextResponse.json(
        { error: 'Activity ID and Reply ID are required' },
        { status: 400 }
      );
    }
    
    // Get existing reply to verify ownership
    const existingReplyData = await kv.hget(REPLY_HASH_KEY, replyId);
    
    if (!existingReplyData) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    
    const existingReply = JSON.parse(existingReplyData as string) as Reply;
    
    // Verify reply belongs to the activity
    if (existingReply.activityId !== activityId) {
      return NextResponse.json(
        { error: 'Reply does not belong to this activity' },
        { status: 404 }
      );
    }
    
    // In production, you'd verify the user can delete this reply
    
    // Remove reply from storage
    await kv.hdel(REPLY_HASH_KEY, replyId);
    
    // Remove from activity's reply set
    await kv.srem(`${ACTIVITY_REPLIES_SET}${activityId}`, replyId);
    
    // Update activity's reply count
    const replyCount = await kv.scard(`${ACTIVITY_REPLIES_SET}${activityId}`);
    
    // Update activity in storage
    const activityData = await kv.hget('activity_timeline', activityId);
    if (activityData) {
      const activity = JSON.parse(activityData as string);
      const updatedActivity = {
        ...activity,
        replyCount,
        hasReplies: replyCount > 0
      };
      
      await kv.hset('activity_timeline', { 
        [activityId]: JSON.stringify(updatedActivity) 
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Reply deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting reply:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to delete reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}