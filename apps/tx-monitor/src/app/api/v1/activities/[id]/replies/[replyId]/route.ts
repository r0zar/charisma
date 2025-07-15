/**
 * Individual Reply Management API endpoint
 * GET /api/v1/activities/[id]/replies/[replyId] - Get specific reply
 * PUT /api/v1/activities/[id]/replies/[replyId] - Update reply
 * DELETE /api/v1/activities/[id]/replies/[replyId] - Delete reply
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateActivityReply, deleteActivityReply } from '@/lib/activity-storage';
import { kv } from '@vercel/kv';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  try {
    const { id: activityId, replyId } = await params;
    
    if (!activityId || !replyId) {
      return NextResponse.json(
        { error: 'Activity ID and Reply ID are required' },
        { status: 400 }
      );
    }
    
    // Get specific reply
    const replyData = await kv.hget('activity_replies', replyId);
    if (!replyData) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    
    const reply = typeof replyData === 'string' ? JSON.parse(replyData) : replyData;
    
    return NextResponse.json({
      success: true,
      data: reply
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error fetching reply:', error);
    
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
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  try {
    const { id: activityId, replyId } = await params;
    
    if (!activityId || !replyId) {
      return NextResponse.json(
        { error: 'Activity ID and Reply ID are required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { content } = body;
    
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }
    
    // Update reply
    const updatedReply = await updateActivityReply(replyId, {
      content,
      metadata: {
        isEdited: true,
        lastEditedAt: Date.now()
      }
    });
    
    if (!updatedReply) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updatedReply
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error updating reply:', error);
    
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
  { params }: { params: Promise<{ id: string; replyId: string }> }
) {
  try {
    const { id: activityId, replyId } = await params;
    
    if (!activityId || !replyId) {
      return NextResponse.json(
        { error: 'Activity ID and Reply ID are required' },
        { status: 400 }
      );
    }
    
    // Delete reply
    const deleted = await deleteActivityReply(replyId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Reply deleted successfully'
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error deleting reply:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to delete reply',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}