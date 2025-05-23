import { NextRequest, NextResponse } from "next/server";
import {
    bidCreateSchema,
    bidCancelSchema,
    Bid,
    Offer,
} from "@/lib/otc/schema";
import { getOffer, saveOffer } from "@/lib/otc/kv";
import { recoverSigner, verifySignatureAndGetSigner } from "blaze-sdk";

/* POST ────────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
    try {
        const data = bidCreateSchema.parse(await req.json());

        const offer = await getOffer(data.originalOfferIntentUuid);
        if (!offer) throw new Error("offer not found");
        if (offer.status !== "open") throw new Error("offer not open");

        /* sig check */
        const [{ token, amount }] = data.bidAssets;
        await recoverSigner(
            data.bidSignature,
            token,
            "TRANSFER_TOKENS",
            data.bidderSideIntentUuid,
            { amount, target: offer.offerCreatorAddress }
        );

        const newBid: Bid = {
            ...data,
            bidId: data.bidderSideIntentUuid,
            createdAt: Date.now(),
            status: "pending",
        };

        (offer.bids ??= []).push(newBid);
        await saveOffer(offer);

        console.log("[BidForm] Offer after bid:", offer);

        return NextResponse.json({ success: true, bid: newBid }, { status: 201 });
    } catch (err: any) {
        const msg = err.message ?? "bad request";
        const code = msg === "offer not found" ? 404 : 400;
        return NextResponse.json({ success: false, error: msg }, { status: code });
    }
}

/* DELETE ──────────────────────────────────────────────*/
export async function DELETE(req: NextRequest) {
    try {
        const { originalOfferIntentUuid, bidId } = bidCancelSchema.parse(await req.json());

        // Verify the signature and get the signer
        const verified = await verifySignatureAndGetSigner(req, {
            message: bidId, // Use bidId as the message to sign
        });

        if (verified.status !== 200) {
            return NextResponse.json({ success: false, error: "Invalid signature." }, { status: 401 });
        }

        const offer = await getOffer(originalOfferIntentUuid);
        if (!offer) {
            return NextResponse.json({ success: false, error: "Offer not found." }, { status: 404 });
        }

        const idx = offer.bids.findIndex((b) => b.bidId === bidId);
        if (idx === -1) {
            return NextResponse.json({ success: false, error: "Bid not found." }, { status: 404 });
        }

        const bid = offer.bids[idx];
        if (bid.bidderAddress !== verified.signer) {
            return NextResponse.json({ success: false, error: "Unauthorized: You can only cancel your own bids." }, { status: 403 });
        }

        if (bid.status !== "pending") {
            return NextResponse.json({ success: false, error: `Cannot cancel bid with status "${bid.status}". Only pending bids can be cancelled.` }, { status: 400 });
        }

        offer.bids[idx].status = "cancelled";
        await saveOffer(offer);

        return NextResponse.json({
            success: true,
            message: "Bid cancelled successfully.",
            bidId: bidId
        });
    } catch (err: any) {
        console.error("Error cancelling bid:", err);
        const msg = err.message ?? "Bad request";
        const code = msg.includes("not found") ? 404 : 400;
        return NextResponse.json({ success: false, error: msg }, { status: code });
    }
}
