import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Offer, Bid, acceptBidSchema } from "@/lib/otc/schema";
import { getOffer, saveOffer } from "@/lib/otc/kv";
import { verifySignatureAndGetSigner } from '@repo/stacks';
import { createRedeem, createTransfer, recoverSigner } from "blaze-sdk";
import { BLAZE_SIGNER_CONTRACT_ID, BLAZE_SIGNER_PRIVATE_KEY, BLAZE_SOLVER_ADDRESS } from "@/lib/constants";
import { broadcastTransaction, fetchNonce, makeContractCall } from "@stacks/transactions";
import { revalidatePath } from "next/cache";


const getNonce = async () => {
    const nonce = await fetchNonce({ address: BLAZE_SOLVER_ADDRESS });
    return Number(nonce);
}

export async function POST(req: NextRequest) {
    try {
        const data = acceptBidSchema.parse(await req.json());

        const verified = await verifySignatureAndGetSigner(req, {
            message: data.offerIntentUuid,
        });

        if (verified.status !== 200) {
            return NextResponse.json({ success: false, error: "Invalid signature." }, { status: 401 });
        }

        const offer = await getOffer(data.offerIntentUuid);
        console.log("offer", offer);
        if (!offer) {
            return NextResponse.json({ success: false, error: "Offer not found." }, { status: 404 });
        }

        if (verified.signer !== offer.offerCreatorAddress) {
            return NextResponse.json({ success: false, error: "You are not the creator of this offer." }, { status: 401 });
        }

        const firstOfferedAsset = offer.offerAssets[0];
        const numericAmountForSignature = parseInt(firstOfferedAsset.amount, 10);

        if (isNaN(numericAmountForSignature)) {
            return NextResponse.json(
                { success: false, error: `Invalid numeric amount for offer asset ${firstOfferedAsset.token}: ${firstOfferedAsset.amount}` },
                { status: 500 } // Internal server error, as this data comes from KV
            );
        }

        //get the bid from the offer list
        const bid = offer.bids.find(b => {
            console.log("b", b);
            console.log("data.acceptedBidId", data.acceptedBidId);
            return b.bidId === data.acceptedBidId
        });

        if (!bid) {
            return NextResponse.json({ success: false, error: "Bid not found." }, { status: 404 });
        }

        // transfer the bid amount to the offer creator
        const acceptedBidNumericAmount = parseInt(bid.bidAssets[0].amount, 10);
        if (isNaN(acceptedBidNumericAmount)) {
            return NextResponse.json(
                { success: false, error: `Invalid numeric amount for accepted bid asset ${bid.bidAssets[0].token}: ${bid.bidAssets[0].amount}` },
                { status: 500 }
            );
        }

        let nonce = await getNonce();

        const transfer = createTransfer({
            contractId: bid.bidAssets[0].token,
            signature: bid.bidSignature!,
            uuid: bid.bidderSideIntentUuid!,
            amount: acceptedBidNumericAmount,
            recipient: offer.offerCreatorAddress,
            intent: "TRANSFER_TOKENS",
            senderKey: BLAZE_SIGNER_PRIVATE_KEY!,
            nonce: nonce++,
        });

        const transaction = await makeContractCall(transfer);
        const response = await broadcastTransaction({ transaction });
        console.log("transfer response", response);

        // loop through all offer assets and create a redeem for each
        for (const offerAsset of offer.offerAssets) {
            // delay for 3 seconds
            await new Promise(resolve => setTimeout(resolve, 3000));
            const redeem = createRedeem({
                contractId: offerAsset.token,
                signature: offerAsset.signature,
                uuid: offer.intentUuid,
                amount: numericAmountForSignature,
                recipient: bid.bidderAddress,
                intent: "REDEEM_BEARER",
                senderKey: BLAZE_SIGNER_PRIVATE_KEY!,
                nonce: nonce++,
            });

            const transaction = await makeContractCall(redeem);
            const response = await broadcastTransaction({ transaction });
            console.log("redeem response", response);
        }

        // Update offer status
        offer.status = "filled";

        // Update bids statuses and store acceptance details
        offer.bids = offer.bids.map(b => {
            if (b.bidId === data.acceptedBidId) {
                return {
                    ...b,
                    status: "accepted" as Bid['status']
                };
            } else if (b.status === "pending") {
                // Construct a new object for the rejected bid, omitting sensitive fields
                const rejectedBid: Bid = {
                    bidId: b.bidId,
                    createdAt: b.createdAt,
                    originalOfferIntentUuid: b.originalOfferIntentUuid,
                    bidderAddress: b.bidderAddress,
                    bidAssets: b.bidAssets,
                    status: "rejected",
                    // bidSignature and bidderSideIntentUuid are intentionally omitted
                    // acceptanceDetails is also not applicable here
                };
                return rejectedBid;
            }
            return b;
        });

        // Save the updated offer
        await saveOffer(offer);

        revalidatePath(`/otc/${offer.intentUuid}`);

        return NextResponse.json({
            success: true,
            message: "Bid accepted successfully. Offer and bids have been updated.",
            offerId: data.offerIntentUuid,
            updatedOffer: offer,
        }, { status: 200 });

    } catch (err: any) {
        console.error("[API /accept-bid] Error:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: "Invalid request payload.", details: err.errors }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: err.message || "An unexpected error occurred." }, { status: 500 });
    }
} 