import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fundingRequestCreateSchema, FundingRequest } from "@/lib/perps/p2p-schema";
import { getFundingRequest, saveFundingRequest } from "@/lib/perps/p2p-kv";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const data = fundingRequestCreateSchema.parse(await req.json());

        // Generate unique ID for the funding request
        const fundingRequestId = uuidv4();

        // Check if funding request already exists for this perp
        // Note: In production, you might want to prevent duplicate funding requests per perp

        // Skip signature verification in preview mode
        console.log('🔧 Preview mode: Skipping trader margin intent signature verification');

        // Validate trader margin amount
        const traderMarginAmount = parseFloat(data.traderMargin);
        if (isNaN(traderMarginAmount)) {
            throw new Error(`Invalid trader margin amount: ${data.traderMargin}`);
        }

        // Create the funding request
        const fundingRequestToSave: FundingRequest = {
            id: fundingRequestId,
            perpUuid: data.perpUuid,
            traderId: data.traderId,
            traderMarginIntent: data.traderMarginIntent,

            // Position details
            direction: data.direction,
            leverage: data.leverage,
            positionSize: data.positionSize,
            entryPrice: data.entryPrice,
            liquidationPrice: data.liquidationPrice,

            // Economic terms
            traderMargin: data.traderMargin,
            maxCollateralNeeded: data.maxCollateralNeeded,
            fundingFeeRate: data.fundingFeeRate,

            // Token contracts
            baseToken: data.baseToken,
            quoteToken: data.quoteToken,
            marginToken: data.marginToken,

            // Status and lifecycle
            fundingStatus: "seeking",
            expiresAt: data.expiresAt,
            createdAt: Date.now(),

            // Initialize empty funding offers
            fundingOffers: [],
        };

        await saveFundingRequest(fundingRequestToSave);

        // Invalidate the shop page cache so new funding requests appear immediately
        revalidatePath('/shop');

        console.log(`🎯 Created P2P funding request ${fundingRequestId} for perp ${data.perpUuid}`);

        return NextResponse.json({
            success: true,
            fundingRequest: fundingRequestToSave
        }, { status: 201 });

    } catch (err: any) {
        console.error("Error processing POST /api/v1/perps/funding-request:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: "Invalid request payload.", details: err.errors },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: err.message || "An unexpected error occurred." },
            { status: 400 }
        );
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const fundingRequestId = url.searchParams.get("id");
    const traderId = url.searchParams.get("traderId");
    const status = url.searchParams.get("status") as FundingRequest['fundingStatus'] | null;

    try {
        // Get specific funding request by ID
        if (fundingRequestId) {
            const fundingRequest = await getFundingRequest(fundingRequestId);
            if (!fundingRequest) {
                return NextResponse.json(
                    { success: false, error: "Funding request not found" },
                    { status: 404 }
                );
            }
            return NextResponse.json({ success: true, fundingRequest });
        }

        // TODO: Add more filtering options as needed
        // For now, just return basic success response
        return NextResponse.json({
            success: true,
            message: "Use specific query parameters to fetch funding requests"
        });

    } catch (err: any) {
        console.error("Error processing GET /api/v1/perps/funding-request:", err);
        return NextResponse.json(
            { success: false, error: "Failed to fetch funding request" },
            { status: 500 }
        );
    }
} 