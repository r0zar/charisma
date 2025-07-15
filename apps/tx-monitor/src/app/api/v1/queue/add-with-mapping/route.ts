/**
 * Add transactions to queue with activity mapping
 * POST /api/v1/queue/add-with-mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { addToQueue } from '@/lib/transaction-monitor';
import { storeTransactionMapping } from '@/lib/activity-integration';

interface AddWithMappingRequest {
  transactions: Array<{
    txid: string;
    recordId: string;
    recordType: 'order' | 'swap';
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: AddWithMappingRequest = await request.json();
    
    // Validate request
    if (!body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json(
        { error: 'Invalid request: transactions array is required' },
        { status: 400 }
      );
    }
    
    const txids: string[] = [];
    const mappings: Array<{ txid: string; recordId: string; recordType: 'order' | 'swap' }> = [];
    
    // Validate and extract transaction data
    for (const tx of body.transactions) {
      if (!tx.txid || !tx.recordId || !tx.recordType) {
        return NextResponse.json(
          { error: 'Invalid transaction: txid, recordId, and recordType are required' },
          { status: 400 }
        );
      }
      
      if (!['order', 'swap'].includes(tx.recordType)) {
        return NextResponse.json(
          { error: 'Invalid recordType: must be "order" or "swap"' },
          { status: 400 }
        );
      }
      
      txids.push(tx.txid);
      mappings.push({
        txid: tx.txid,
        recordId: tx.recordId,
        recordType: tx.recordType
      });
    }
    
    console.log(`[TX-MONITOR] Adding ${txids.length} transactions to queue with activity mappings`);
    
    // Add transactions to monitoring queue
    const queueResult = await addToQueue(txids);
    
    // Store transaction mappings for activity integration
    const mappingPromises = mappings.map(mapping => 
      storeTransactionMapping(mapping.txid, mapping.recordId, mapping.recordType)
    );
    
    await Promise.all(mappingPromises);
    
    console.log(`[TX-MONITOR] Successfully added ${queueResult.added.length} transactions with activity mappings`);
    
    return NextResponse.json({
      success: true,
      message: 'Transactions added to monitoring queue with activity mappings',
      data: {
        added: queueResult.added,
        alreadyMonitored: queueResult.alreadyMonitored,
        mappingsStored: mappings.length
      }
    });
    
  } catch (error) {
    console.error('[TX-MONITOR] Error adding transactions with mappings:', error);
    
    return NextResponse.json({
      error: 'Failed to add transactions to queue',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}