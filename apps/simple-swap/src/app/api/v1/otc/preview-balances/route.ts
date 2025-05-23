import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOffer } from "@/lib/otc/kv";
import { fetchTokenBalance } from "blaze-sdk";

// Schema for the preview request
const previewBalancesSchema = z.object({
    offerIntentUuid: z.string().min(1, "Offer intent UUID is required")
});

interface BalanceCheck {
    address: string;
    token: string;
    required: string;
    actual: string;
    sufficient: boolean;
}

interface BidValidation {
    bidId: string;
    bidderAddress: string;
    isValid: boolean;
    balanceChecks: BalanceCheck[];
    errors: string[];
}

interface OfferValidation {
    offerCreatorAddress: string;
    isValid: boolean;
    balanceChecks: BalanceCheck[];
    errors: string[];
}

// Helper function to check token balance with error handling
const checkTokenBalance = async (token: string, address: string): Promise<string> => {
    try {
        const balance = await fetchTokenBalance(token, address);
        return balance.toString();
    } catch (error) {
        console.warn(`Failed to fetch balance for ${token} at ${address}:`, error);
        return "0";
    }
};

// Preview balances for all parties without executing transactions
const previewAllBalances = async (offerIntentUuid: string): Promise<{
    offerValidation: OfferValidation;
    bidValidations: BidValidation[];
    summary: {
        totalBids: number;
        validBids: number;
        invalidBids: number;
        offerCreatorValid: boolean;
    };
}> => {
    const offer = await getOffer(offerIntentUuid);
    if (!offer) {
        throw new Error("Offer not found");
    }

    const results = {
        offerValidation: {
            offerCreatorAddress: offer.offerCreatorAddress,
            isValid: true,
            balanceChecks: [] as BalanceCheck[],
            errors: [] as string[]
        },
        bidValidations: [] as BidValidation[],
        summary: {
            totalBids: 0,
            validBids: 0,
            invalidBids: 0,
            offerCreatorValid: true
        }
    };

    // Check offer creator balances
    console.log(`Checking offer creator balances for ${offer.offerCreatorAddress}...`);
    for (const offerAsset of offer.offerAssets) {
        const actualBalance = await checkTokenBalance(offerAsset.token, offer.offerCreatorAddress);
        const sufficient = BigInt(actualBalance) >= BigInt(offerAsset.amount);

        const balanceCheck: BalanceCheck = {
            address: offer.offerCreatorAddress,
            token: offerAsset.token,
            required: offerAsset.amount,
            actual: actualBalance,
            sufficient
        };

        results.offerValidation.balanceChecks.push(balanceCheck);

        if (!sufficient) {
            results.offerValidation.isValid = false;
            results.offerValidation.errors.push(
                `Insufficient balance for ${offerAsset.token}: required ${offerAsset.amount}, actual ${actualBalance}`
            );
        }
    }

    results.summary.offerCreatorValid = results.offerValidation.isValid;

    // Check all active bids
    const activeBids = offer.bids.filter(b => b.status === "pending");
    results.summary.totalBids = activeBids.length;

    console.log(`Checking balances for ${activeBids.length} active bids...`);
    for (const bid of activeBids) {
        const bidValidation: BidValidation = {
            bidId: bid.bidId,
            bidderAddress: bid.bidderAddress,
            isValid: true,
            balanceChecks: [],
            errors: []
        };

        for (const bidAsset of bid.bidAssets) {
            const actualBalance = await checkTokenBalance(bidAsset.token, bid.bidderAddress);
            const sufficient = BigInt(actualBalance) >= BigInt(bidAsset.amount);

            const balanceCheck: BalanceCheck = {
                address: bid.bidderAddress,
                token: bidAsset.token,
                required: bidAsset.amount,
                actual: actualBalance,
                sufficient
            };

            bidValidation.balanceChecks.push(balanceCheck);

            if (!sufficient) {
                bidValidation.isValid = false;
                bidValidation.errors.push(
                    `Insufficient balance for ${bidAsset.token}: required ${bidAsset.amount}, actual ${actualBalance}`
                );
            }
        }

        results.bidValidations.push(bidValidation);

        if (bidValidation.isValid) {
            results.summary.validBids++;
        } else {
            results.summary.invalidBids++;
        }
    }

    return results;
};

export async function POST(req: NextRequest) {
    try {
        const data = previewBalancesSchema.parse(await req.json());

        console.log(`Previewing balances for offer: ${data.offerIntentUuid}`);
        const balancePreview = await previewAllBalances(data.offerIntentUuid);

        // Log summary for debugging
        console.log("Balance preview summary:");
        console.log(`- Offer creator (${balancePreview.offerValidation.offerCreatorAddress}): ${balancePreview.offerValidation.isValid ? 'VALID' : 'INVALID'}`);
        console.log(`- Total bids: ${balancePreview.summary.totalBids}`);
        console.log(`- Valid bids: ${balancePreview.summary.validBids}`);
        console.log(`- Invalid bids: ${balancePreview.summary.invalidBids}`);

        return NextResponse.json({
            success: true,
            offerIntentUuid: data.offerIntentUuid,
            balancePreview,
            timestamp: new Date().toISOString()
        }, { status: 200 });

    } catch (err: any) {
        console.error("[API /preview-balances] Error:", err);

        if (err instanceof z.ZodError) {
            return NextResponse.json({
                success: false,
                error: "Invalid request payload.",
                details: err.errors
            }, { status: 400 });
        }

        if (err.message === "Offer not found") {
            return NextResponse.json({
                success: false,
                error: "Offer not found."
            }, { status: 404 });
        }

        return NextResponse.json({
            success: false,
            error: err.message || "An unexpected error occurred."
        }, { status: 500 });
    }
}

// Optional GET endpoint for simple preview (no body required if UUID is in query params)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const offerIntentUuid = searchParams.get('offerIntentUuid');

        if (!offerIntentUuid) {
            return NextResponse.json({
                success: false,
                error: "offerIntentUuid query parameter is required."
            }, { status: 400 });
        }

        console.log(`GET: Previewing balances for offer: ${offerIntentUuid}`);
        const balancePreview = await previewAllBalances(offerIntentUuid);

        return NextResponse.json({
            success: true,
            offerIntentUuid,
            balancePreview,
            timestamp: new Date().toISOString()
        }, { status: 200 });

    } catch (err: any) {
        console.error("[API GET /preview-balances] Error:", err);

        if (err.message === "Offer not found") {
            return NextResponse.json({
                success: false,
                error: "Offer not found."
            }, { status: 404 });
        }

        return NextResponse.json({
            success: false,
            error: err.message || "An unexpected error occurred."
        }, { status: 500 });
    }
} 