/**
 * Activity Replies API endpoint
 * GET /api/v1/activities/[id]/replies - Get replies for an activity
 * POST /api/v1/activities/[id]/replies - Add reply to an activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityReplies, addActivityReply } from '@/lib/activity-storage';
import { Reply } from '@/lib/activity-types';
import { replyMessage, replySigner } from '@/lib/reply-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }
    
    // Get replies for the activity
    const replies = await getActivityReplies(activityId);
    
    return NextResponse.json({
      data: replies,
      count: replies.length
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error fetching activity replies:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch replies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { content } = body;
    
    // Validate required fields
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // The author is whoever signed it, never what the body claims
    const auth = await replySigner(request, replyMessage.add(activityId, content));
    if ('denied' in auth) return auth.denied;
    
    // Create reply object
    const reply: Reply = {
      id: `reply-${activityId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      activityId,
      content,
      timestamp: Date.now(),
      author: auth.signer,
      metadata: {
        isEdited: false
      }
    };
    
    // Add reply to storage
    await addActivityReply(activityId, reply);
    
    return NextResponse.json({
      success: true,
      data: reply
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error adding reply:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to add reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}