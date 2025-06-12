import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fundingOfferCreateSchema, FundingOffer } from "@/lib/perps/p2p-schema";
import { getFundingRequest, addFundingOffer } from "@/lib/perps/p2p-kv";
import { recoverSigner } from "blaze-sdk";
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
    try {
        const data = fundingOfferCreateSchema.parse(await req.json());

        // Get the funding request
        const fundingRequest = await getFundingRequest(data.originalFundingRequestId);
        if (!fundingRequest) {
            throw new Error("Funding request not found");
        }

        if (fundingRequest.fundingStatus !== "seeking") {
            throw new Error("Funding request is no longer seeking funding");
        }

        // Verify funder's collateral intent signature
        const maxCollateralAmount = parseFloat(data.maxCollateralOffered);
        if (isNaN(maxCollateralAmount)) {
            throw new Error(`Invalid max collateral amount: ${data.maxCollateralOffered}`);
        }

        // Convert to atomic units for signature verification
        const atomicCollateralAmount = Math.floor(maxCollateralAmount * 1_000_000);

        const recoveredFunderSigner = await recoverSigner(
            data.funderCollateralIntent,
            fundingRequest.marginToken, // Should be same token as margin
            "TRANSFER_TOKENS_LTE",
            data.funderSideIntentUuid,
            { amount: atomicCollateralAmount }
        );

        if (!recoveredFunderSigner) {
            console.error("Funder collateral intent signature verification failed.", {
                fundingRequestId: data.originalFundingRequestId,
                marginToken: fundingRequest.marginToken,
                maxCollateralOffered: data.maxCollateralOffered,
                recoveredSigner: recoveredFunderSigner,
            });
            return NextResponse.json(
                { success: false, error: "Funder collateral intent signature verification failed. Please ensure the intent is properly signed." },
                { status: 403 }
            );
        }

        if (recoveredFunderSigner !== data.funderId) {
            return NextResponse.json(
                { success: false, error: "Funder ID does not match intent signer." },
                { status: 403 }
            );
        }

        // Create the funding offer
        const fundingOffer: FundingOffer = {
            ...data,
            fundingOfferId: uuidv4(),
            createdAt: Date.now(),
            status: "pending",
        };

        // Add the funding offer to the request
        const updatedRequest = await addFundingOffer(data.originalFundingRequestId, fundingOffer);
        if (!updatedRequest) {
            throw new Error("Failed to add funding offer to request");
        }

        console.log(`💰 Created funding offer ${fundingOffer.fundingOfferId} for request ${data.originalFundingRequestId}`);

        return NextResponse.json({
            success: true,
            fundingOffer: fundingOffer
        }, { status: 201 });

    } catch (err: any) {
        console.error("Error processing POST /api/v1/perps/funding-offer:", err);
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
    const fundingRequestId = url.searchParams.get("fundingRequestId");
    const funderId = url.searchParams.get("funderId");

    try {
        if (fundingRequestId) {
            const fundingRequest = await getFundingRequest(fundingRequestId);
            if (!fundingRequest) {
                return NextResponse.json(
                    { success: false, error: "Funding request not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                fundingOffers: fundingRequest.fundingOffers
            });
        }

        // TODO: Add more filtering options as needed
        return NextResponse.json({
            success: true,
            message: "Use specific query parameters to fetch funding offers"
        });

    } catch (err: any) {
        console.error("Error processing GET /api/v1/perps/funding-offer:", err);
        return NextResponse.json(
            { success: false, error: "Failed to fetch funding offers" },
            { status: 500 }
        );
    }
} 