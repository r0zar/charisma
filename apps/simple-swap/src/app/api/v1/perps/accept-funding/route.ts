import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { acceptFundingSchema } from "@/lib/perps/p2p-schema";
import { getFundingRequest, acceptFundingOffer } from "@/lib/perps/p2p-kv";
import { verifySignatureAndGetSigner } from "blaze-sdk";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
    try {
        const data = acceptFundingSchema.parse(await req.json());

        // Simple signature verification for now (using funding request ID as message)
        const verified = await verifySignatureAndGetSigner(req, {
            message: data.fundingRequestId,
        });

        if (verified.status !== 200) {
            return NextResponse.json({
                success: false,
                error: "Invalid signature."
            }, { status: 401 });
        }

        // Get the funding request
        const fundingRequest = await getFundingRequest(data.fundingRequestId);
        if (!fundingRequest) {
            return NextResponse.json({
                success: false,
                error: "Funding request not found."
            }, { status: 404 });
        }

        // Verify the trader is accepting the funding
        if (verified.signer !== fundingRequest.traderId) {
            return NextResponse.json({
                success: false,
                error: "You are not the creator of this funding request."
            }, { status: 401 });
        }

        // Check if request is still seeking funding
        if (fundingRequest.fundingStatus !== 'seeking') {
            return NextResponse.json({
                success: false,
                error: "This funding request is no longer seeking funding."
            }, { status: 400 });
        }

        // Find the funding offer to accept
        const fundingOffer = fundingRequest.fundingOffers.find(
            offer => offer.fundingOfferId === data.acceptedFundingOfferId
        );

        if (!fundingOffer) {
            return NextResponse.json({
                success: false,
                error: "Funding offer not found."
            }, { status: 404 });
        }

        if (fundingOffer.status !== 'pending') {
            return NextResponse.json({
                success: false,
                error: "Funding offer is not available for acceptance."
            }, { status: 400 });
        }

        // Accept the funding offer
        const updatedRequest = await acceptFundingOffer(
            data.fundingRequestId,
            data.acceptedFundingOfferId,
            fundingOffer.funderId
        );

        if (!updatedRequest) {
            return NextResponse.json({
                success: false,
                error: "Failed to accept funding offer."
            }, { status: 500 });
        }

        console.log(`✅ Accepted funding offer ${data.acceptedFundingOfferId} for request ${data.fundingRequestId}`);

        // TODO: Here you would typically:
        // 1. Execute both intents (trader's margin + funder's collateral)
        // 2. Create the actual perpetual position
        // 3. Link the position to the funding arrangement

        // Invalidate shop cache since funding request status changed
        revalidatePath('/shop');

        return NextResponse.json({
            success: true,
            fundingRequest: updatedRequest,
            message: "Funding accepted successfully. Position will be created once intents are executed."
        }, { status: 200 });

    } catch (err: any) {
        console.error("Error processing POST /api/v1/perps/accept-funding:", err);
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