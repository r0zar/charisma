import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { offerCreateSchema, Offer } from "@/lib/otc/schema";
import { getOffer, saveOffer } from "@/lib/otc/kv";
import { recoverSigner } from "blaze-sdk";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
    try {
        const data = offerCreateSchema.parse(await req.json());

        let offerCreatorAddress = '';
        const primaryOfferIntentUuid = data.offerAssets[0].intentUuid;

        if (await getOffer(data.offerAssets[0].intentUuid)) {
            return NextResponse.json(
                { success: false, error: "Offer with this intentUuid already exists." },
                { status: 409 }
            );
        }

        for (const asset of data.offerAssets) {
            const numericAmount = parseInt(asset.amount, 10);
            if (isNaN(numericAmount)) {
                throw new Error(`Invalid numeric amount for asset ${asset.token}: ${asset.amount}`);
            }

            const recoveredAssetSigner = await recoverSigner(
                asset.signature,
                asset.token,
                "REDEEM_BEARER",
                asset.intentUuid,
                { amount: numericAmount }
            );

            if (!recoveredAssetSigner) {
                console.error("Asset signature verification failed for an offered asset.", {
                    assetToken: asset.token,
                    assetIntentUuid: asset.intentUuid,
                    recoveredSigner: recoveredAssetSigner,
                });
                return NextResponse.json(
                    { success: false, error: `Signature verification failed for asset ${asset.token}. Ensure all assets are signed by the offer creator.` },
                    { status: 403 }
                );
            }
            offerCreatorAddress = recoveredAssetSigner;
        }

        const offerToSave: Offer = {
            intentUuid: primaryOfferIntentUuid,
            offerCreatorAddress: offerCreatorAddress,
            offerAssets: data.offerAssets,
            status: "open",
            createdAt: Date.now(),
            bids: [],
        };

        await saveOffer(offerToSave);

        // Invalidate the shop page cache so new offers appear immediately
        revalidatePath('/shop');

        return NextResponse.json({ success: true, offer: offerToSave }, { status: 201 });
    } catch (err: any) {
        console.error("Error processing POST /api/v1/otc:", err);
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
    const intentUuid = new URL(req.url).searchParams.get("intentUuid");
    if (!intentUuid)
        return NextResponse.json(
            { success: false, error: "intentUuid required" },
            { status: 400 }
        );

    const offer = await getOffer(intentUuid);
    if (!offer)
        return NextResponse.json(
            { success: false, error: "not found" },
            { status: 404 }
        );

    return NextResponse.json({ success: true, offer }, {
        headers: {
            'Cache-Control': 'public, max-age=120, stale-while-revalidate=300'
        }
    });
}
