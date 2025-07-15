/**
 * Activity Replies API endpoint
 * GET /api/v1/activity/[id]/replies - Get replies for an activity
 * POST /api/v1/activity/[id]/replies - Add reply to an activity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivityReplies, addReply } from '@/lib/activity/storage';
import { Reply } from '@/lib/activity/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const activityId = params.id;
    
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
    console.error('Error fetching activity replies:', error);
    
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
  { params }: { params: { id: string } }
) {
  try {
    const activityId = params.id;
    
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { content, author } = body;
    
    // Validate required fields
    if (!content || !author) {
      return NextResponse.json(
        { error: 'Content and author are required' },
        { status: 400 }
      );
    }
    
    // Create reply object
    const reply: Reply = {
      id: `reply-${activityId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      activityId,
      content,
      timestamp: Date.now(),
      author,
      metadata: {
        isEdited: false
      }
    };
    
    // Add reply to storage
    await addReply(reply);
    
    return NextResponse.json({
      success: true,
      data: reply
    });
    
  } catch (error) {
    console.error('Error adding reply:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to add reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}