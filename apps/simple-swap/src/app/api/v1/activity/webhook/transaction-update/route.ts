/**
 * Transaction Update Webhook endpoint
 * Receives transaction status updates from tx-monitor service
 * POST /api/v1/activity/webhook/transaction-update
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateActivity } from '@/lib/activity/storage';
import { ActivityStatus } from '@/lib/activity/types';

const WEBHOOK_SECRET = process.env.ACTIVITY_WEBHOOK_SECRET || 'dev-secret';

interface TransactionUpdatePayload {
  txid: string;
  recordId: string;
  recordType: 'order' | 'swap';
  previousStatus: string;
  currentStatus: string;
}

/**
 * Map transaction status to activity status
 */
function mapTransactionToActivityStatus(txStatus: string): ActivityStatus {
  switch (txStatus) {
    case 'success':
      return 'completed';
    case 'abort_by_response':
    case 'abort_by_post_condition':
      return 'failed';
    case 'pending':
    case 'broadcasted':
      return 'pending';
    default:
      return 'pending';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      console.error('[ACTIVITY-WEBHOOK] Unauthorized transaction update request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload: TransactionUpdatePayload = await request.json();
    
    // Validate payload
    if (!payload.txid || !payload.recordId || !payload.recordType || !payload.currentStatus) {
      console.error('[ACTIVITY-WEBHOOK] Invalid payload:', payload);
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    
    console.log(`[ACTIVITY-WEBHOOK] Processing transaction update: ${payload.txid} - ${payload.previousStatus} -> ${payload.currentStatus}`);
    
    // Map transaction status to activity status
    const activityStatus = mapTransactionToActivityStatus(payload.currentStatus);
    
    // Update activity in timeline
    await updateActivity(payload.recordId, {
      status: activityStatus,
      txid: payload.txid,
      metadata: {
        lastStatusUpdate: Date.now(),
        txStatus: payload.currentStatus,
        previousTxStatus: payload.previousStatus
      }
    });
    
    console.log(`[ACTIVITY-WEBHOOK] Activity ${payload.recordId} updated to status: ${activityStatus}`);
    
    return NextResponse.json({
      success: true,
      message: 'Transaction update processed',
      data: {
        recordId: payload.recordId,
        recordType: payload.recordType,
        activityStatus,
        txid: payload.txid
      }
    });
    
  } catch (error) {
    console.error('[ACTIVITY-WEBHOOK] Error processing transaction update:', error);
    
    return NextResponse.json({
      error: 'Failed to process transaction update',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}