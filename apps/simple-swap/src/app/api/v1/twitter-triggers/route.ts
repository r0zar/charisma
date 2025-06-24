import { NextRequest, NextResponse } from 'next/server';
import { listTwitterTriggers, createTwitterTrigger } from '@/lib/twitter-triggers/store';
import { extractTweetId, validateTweetUrl } from '@/lib/twitter-triggers/twitter-scraper';
import { CreateTwitterTriggerRequest } from '@/lib/twitter-triggers/types';

// GET /api/v1/twitter-triggers - List all triggers
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('active') === 'true';
        const owner = searchParams.get('owner');

        let triggers = await listTwitterTriggers(activeOnly);

        // Filter by owner if specified
        if (owner) {
            triggers = triggers.filter(trigger => trigger.owner === owner);
        }

        return NextResponse.json({
            success: true,
            data: triggers,
            meta: {
                total: triggers.length,
                activeOnly,
                owner: owner || null,
            }
        });

    } catch (error) {
        console.error('[Twitter API] Error listing triggers:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to list Twitter triggers'
        }, { status: 500 });
    }
}

// POST /api/v1/twitter-triggers - Create new trigger
export async function POST(request: NextRequest) {
    try {
        const body: CreateTwitterTriggerRequest = await request.json();

        // Validate required fields
        const { tweetUrl, inputToken, outputToken, amountIn, signature } = body;

        if (!tweetUrl || !inputToken || !outputToken || !amountIn || !signature) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: tweetUrl, inputToken, outputToken, amountIn, signature'
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

        // TODO: Add owner verification from signature
        // For now, use a placeholder owner
        const owner = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'; // This should be derived from signature

        // Create the trigger
        const trigger = await createTwitterTrigger({
            owner,
            tweetUrl,
            tweetId,
            inputToken,
            outputToken,
            amountIn,
            targetPrice: body.targetPrice,
            direction: body.direction,
            conditionToken: body.conditionToken,
            baseAsset: body.baseAsset,
            orderIds: body.orderIds, // Store pre-signed order UUIDs
            availableOrders: body.orderIds?.length || 0, // Initial available count
            isActive: true,
            maxTriggers: body.maxTriggers,
            signature,
        });

        console.log(`[Twitter API] Created new trigger ${trigger.id} for tweet ${tweetId}`);

        return NextResponse.json({
            success: true,
            data: trigger,
            message: 'Twitter trigger created successfully'
        }, { status: 201 });

    } catch (error) {
        console.error('[Twitter API] Error creating trigger:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to create Twitter trigger'
        }, { status: 500 });
    }
}