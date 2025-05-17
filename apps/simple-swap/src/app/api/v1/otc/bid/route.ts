import { NextRequest, NextResponse } from "next/server";
import {
    bidCreateSchema,
    bidCancelSchema,
    Bid,
    Offer,
} from "@/lib/otc/schema";
import { getOffer, saveOffer } from "@/lib/otc/kv";
import { recoverSigner } from "blaze-sdk";

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
        const { originalOfferIntentUuid, bidId, requestingAddress } =
            bidCancelSchema.parse(await req.json());

        const offer = await getOffer(originalOfferIntentUuid);
        if (!offer) throw new Error("offer not found");

        const idx = offer.bids.findIndex((b) => b.bidId === bidId);
        if (idx === -1) throw new Error("bid not found");

        const bid = offer.bids[idx];
        if (bid.bidderAddress !== requestingAddress)
            throw new Error("unauthorized");
        if (bid.status !== "pending")
            throw new Error(`cannot cancel bid with status ${bid.status}`);

        offer.bids[idx].status = "cancelled";
        await saveOffer(offer);

        return NextResponse.json({ success: true });
    } catch (err: any) {
        const msg = err.message ?? "bad request";
        const code =
            msg === "offer not found" || msg === "bid not found" ? 404 : 400;
        return NextResponse.json({ success: false, error: msg }, { status: code });
    }
}
