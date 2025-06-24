import { NextRequest, NextResponse } from 'next/server';
import { addOverflowSignaturesToTrigger } from '@/lib/twitter-triggers/store';

interface OverflowSignatureData {
    uuid: string;
    signature: string;
    inputToken: string;
    outputToken: string;
    amountIn: string;
}

interface AddOverflowRequest {
    signatures: OverflowSignatureData[];
}

// POST /api/admin/twitter-triggers/[id]/overflow - Add overflow signatures to trigger
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const triggerId = params.id;
        const body: AddOverflowRequest = await request.json();
        
        // Validate required fields
        const { signatures } = body;
        
        if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Missing required field: signatures (must be non-empty array)'
            }, { status: 400 });
        }
        
        // Validate signatures array
        if (signatures.length > 100) {
            return NextResponse.json({
                success: false,
                error: 'Maximum 100 overflow signatures allowed per request'
            }, { status: 400 });
        }
        
        // Validate each signature object
        for (const [index, sig] of signatures.entries()) {
            if (!sig.uuid || !sig.signature || !sig.inputToken || !sig.outputToken || !sig.amountIn) {
                return NextResponse.json({
                    success: false,
                    error: `Invalid signature data at index ${index}: missing required fields (uuid, signature, inputToken, outputToken, amountIn)`
                }, { status: 400 });
            }
            
            // Validate amount
            const amountNumber = parseFloat(sig.amountIn);
            if (isNaN(amountNumber) || amountNumber <= 0) {
                return NextResponse.json({
                    success: false,
                    error: `Invalid amount at index ${index}: ${sig.amountIn}`
                }, { status: 400 });
            }
        }
        
        console.log(`[Twitter Overflow API] Adding ${signatures.length} overflow signatures to trigger ${triggerId}`);
        
        // Add overflow signatures to the trigger
        const result = await addOverflowSignaturesToTrigger(triggerId, signatures);
        
        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to add overflow signatures'
            }, { status: 400 });
        }
        
        console.log(`[Twitter Overflow API] ✅ Successfully added overflow signatures to trigger ${triggerId}`);
        
        return NextResponse.json({
            success: true,
            data: {
                trigger: result.trigger,
                newOrderIds: result.newOrderIds,
                totalAvailableOrders: result.trigger?.availableOrders || 0,
                addedCount: signatures.length
            },
            message: `Successfully added ${signatures.length} overflow signatures. Trigger reactivated with ${result.trigger?.availableOrders || 0} total available orders.`
        }, { status: 200 });
        
    } catch (error) {
        console.error('[Twitter Overflow API] Error adding overflow signatures:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to add overflow signatures to trigger'
        }, { status: 500 });
    }
}