import { NextRequest, NextResponse } from 'next/server';
import { createTwitterTrigger } from '@/lib/twitter-triggers/store';
import { validateTweetUrl } from '@/lib/twitter-triggers/twitter-scraper';

interface BulkSignatureData {
    uuid: string;
    signature: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
}

interface BulkTwitterTriggerRequest {
    tweetUrl: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
    signatures: BulkSignatureData[];
}

// POST /api/admin/twitter-triggers - Create trigger with bulk pre-signed orders
export async function POST(request: NextRequest) {
    try {
        const body: BulkTwitterTriggerRequest = await request.json();
        
        // Validate required fields
        const { tweetUrl, inputToken, outputToken, amountIn, signatures } = body;
        
        if (!tweetUrl || !inputToken || !outputToken || !amountIn || !signatures || signatures.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: tweetUrl, inputToken, outputToken, amountIn, signatures'
            }, { status: 400 });
        }
        
        // Validate tweet URL and extract ID
        const urlValidation = validateTweetUrl(tweetUrl);
        if (!urlValidation.valid) {
            return NextResponse.json({
                success: false,
                error: urlValidation.error
            }, { status: 400 });
        }
        
        const tweetId = urlValidation.tweetId!;
        
        // Validate amount
        const amountNumber = parseFloat(amountIn);
        if (isNaN(amountNumber) || amountNumber <= 0) {
            return NextResponse.json({
                success: false,
                error: 'Invalid amount'
            }, { status: 400 });
        }
        
        // Validate signatures array
        if (signatures.length > 100) {
            return NextResponse.json({
                success: false,
                error: 'Maximum 100 signatures allowed per trigger'
            }, { status: 400 });
        }
        
        // Validate each signature object
        for (const sig of signatures) {
            if (!sig.uuid || !sig.signature || !sig.inputToken || !sig.outputToken || !sig.amountIn) {
                return NextResponse.json({
                    success: false,
                    error: 'Invalid signature data: missing required fields'
                }, { status: 400 });
            }
        }
        
        console.log(`[Twitter Bulk API] Creating trigger with ${signatures.length} bulk signatures`);
        
        // Create orders from signatures
        const { addOrder } = await import('@/lib/orders/store');
        const orderIds: string[] = [];
        
        for (let i = 0; i < signatures.length; i++) {
            const sig = signatures[i];
            
            try {
                // Create order payload matching the structure expected by the order system
                const orderPayload = {
                    owner: 'BULK_SIGNER', // Special owner designation for bulk-signed orders
                    inputToken: sig.inputToken,
                    outputToken: sig.outputToken,
                    amountIn: sig.amountIn,
                    recipient: 'PLACEHOLDER', // Will be overridden when executed with BNS address
                    signature: sig.signature,
                    uuid: sig.uuid,
                    // Strategy metadata for grouping
                    strategyId: `twitter_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    strategyType: 'twitter' as const,
                    strategyPosition: i + 1,
                    strategySize: signatures.length,
                    strategyDescription: `Bulk Twitter trigger orders for ${tweetUrl}`,
                    // Order metadata
                    metadata: {
                        orderType: 'twitter_trigger',
                        createdFor: 'twitter-trigger-bulk-system',
                        tweetUrl,
                        bulkSigned: true
                    }
                };
                
                const order = await addOrder(orderPayload);
                orderIds.push(order.uuid);
                
                console.log(`[Twitter Bulk API] Created order ${i + 1}/${signatures.length}: ${order.uuid}`);
                
            } catch (orderError) {
                console.error(`[Twitter Bulk API] Failed to create order ${i + 1}:`, orderError);
                return NextResponse.json({
                    success: false,
                    error: `Failed to create order ${i + 1}: ${orderError instanceof Error ? orderError.message : 'Unknown error'}`
                }, { status: 500 });
            }
        }
        
        // Create the trigger with the bulk-created orders
        const trigger = await createTwitterTrigger({
            owner: 'BULK_SIGNER', // Special owner for bulk-signed triggers
            tweetUrl,
            tweetId,
            inputToken,
            outputToken,
            amountIn,
            orderIds, // Array of bulk-created order UUIDs
            availableOrders: orderIds.length, // Initial available count
            isActive: true,
            maxTriggers: signatures.length,
            signature: 'bulk_pre_signed_orders', // Special signature designation
        });
        
        console.log(`[Twitter Bulk API] Created trigger ${trigger.id} with ${orderIds.length} bulk pre-signed orders`);
        
        return NextResponse.json({
            success: true,
            data: {
                trigger,
                ordersCreated: orderIds.length,
                orderIds
            },
            message: `Twitter trigger created successfully with ${orderIds.length} pre-signed orders`
        }, { status: 201 });
        
    } catch (error) {
        console.error('[Twitter Bulk API] Error creating bulk trigger:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to create Twitter trigger with bulk signatures'
        }, { status: 500 });
    }
}