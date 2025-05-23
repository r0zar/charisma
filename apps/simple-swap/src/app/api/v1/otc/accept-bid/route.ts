import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Offer, Bid, acceptBidSchema } from "@/lib/otc/schema";
import { getOffer, saveOffer } from "@/lib/otc/kv";
import { verifySignatureAndGetSigner } from 'blaze-sdk';
import { createRedeem, createTransfer, recoverSigner, fetchTokenBalance } from "blaze-sdk";
import { BLAZE_SIGNER_CONTRACT_ID, BLAZE_SIGNER_PRIVATE_KEY, BLAZE_SOLVER_ADDRESS } from "@/lib/constants";
import { broadcastTransaction, fetchNonce, makeContractCall } from "@stacks/transactions";
import { revalidatePath } from "next/cache";

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

const getNonce = async () => {
    const nonce = await fetchNonce({ address: BLAZE_SOLVER_ADDRESS });
    return Number(nonce);
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

// Validate balances for all parties involved
const validateAllBalances = async (offer: Offer, bidId?: string): Promise<{
    offerCreatorValid: boolean;
    offerCreatorChecks: BalanceCheck[];
    selectedBidValid: boolean;
    selectedBidChecks: BalanceCheck[];
    allBidsValidation: BidValidation[];
}> => {
    const results = {
        offerCreatorValid: true,
        offerCreatorChecks: [] as BalanceCheck[],
        selectedBidValid: true,
        selectedBidChecks: [] as BalanceCheck[],
        allBidsValidation: [] as BidValidation[]
    };

    // Check offer creator balances
    console.log("Checking offer creator balances...");
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

        results.offerCreatorChecks.push(balanceCheck);
        if (!sufficient) {
            results.offerCreatorValid = false;
        }
    }

    // Check all active bids
    console.log("Checking all active bid balances...");
    for (const bid of offer.bids.filter(b => b.status === "pending")) {
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

        results.allBidsValidation.push(bidValidation);

        // If this is the selected bid, store separate validation
        if (bid.bidId === bidId) {
            results.selectedBidValid = bidValidation.isValid;
            results.selectedBidChecks = bidValidation.balanceChecks;
        }
    }

    return results;
};

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

        // Find the bid to accept
        const bid = offer.bids.find(b => b.bidId === data.acceptedBidId);
        if (!bid) {
            return NextResponse.json({ success: false, error: "Bid not found." }, { status: 404 });
        }

        // Validate all balances (offer creator, selected bid, and all active bids)
        console.log("Validating all balances...");
        const balanceValidation = await validateAllBalances(offer, data.acceptedBidId);

        // Check if offer creator has sufficient balances
        if (!balanceValidation.offerCreatorValid) {
            const insufficientAssets = balanceValidation.offerCreatorChecks
                .filter(check => !check.sufficient)
                .map(check => `${check.token}: required ${check.required}, actual ${check.actual}`)
                .join(', ');

            return NextResponse.json({
                success: false,
                error: "Offer creator has insufficient balance.",
                details: `Insufficient assets: ${insufficientAssets}`,
                balanceValidation
            }, { status: 400 });
        }

        // Check if selected bid has sufficient balances
        if (!balanceValidation.selectedBidValid) {
            const insufficientAssets = balanceValidation.selectedBidChecks
                .filter(check => !check.sufficient)
                .map(check => `${check.token}: required ${check.required}, actual ${check.actual}`)
                .join(', ');

            return NextResponse.json({
                success: false,
                error: "Selected bid maker has insufficient balance.",
                details: `Insufficient assets: ${insufficientAssets}`,
                balanceValidation
            }, { status: 400 });
        }

        // Log summary of all bid validations for transparency
        console.log("Balance validation summary:");
        console.log(`Offer creator valid: ${balanceValidation.offerCreatorValid}`);
        console.log(`Selected bid valid: ${balanceValidation.selectedBidValid}`);
        balanceValidation.allBidsValidation.forEach(bv => {
            console.log(`Bid ${bv.bidId} (${bv.bidderAddress}): ${bv.isValid ? 'VALID' : 'INVALID'}`);
            if (!bv.isValid) {
                console.log(`  Errors: ${bv.errors.join(', ')}`);
            }
        });

        // Validate numeric amounts for transaction processing
        const firstOfferedAsset = offer.offerAssets[0];
        const numericAmountForSignature = parseInt(firstOfferedAsset.amount, 10);

        if (isNaN(numericAmountForSignature)) {
            return NextResponse.json(
                { success: false, error: `Invalid numeric amount for offer asset ${firstOfferedAsset.token}: ${firstOfferedAsset.amount}` },
                { status: 500 }
            );
        }

        const acceptedBidNumericAmount = parseInt(bid.bidAssets[0].amount, 10);
        if (isNaN(acceptedBidNumericAmount)) {
            return NextResponse.json(
                { success: false, error: `Invalid numeric amount for accepted bid asset ${bid.bidAssets[0].token}: ${bid.bidAssets[0].amount}` },
                { status: 500 }
            );
        }

        // All validations passed, proceed with the transaction
        console.log("All balance validations passed. Proceeding with transaction...");

        let nonce = await getNonce();

        // Transfer the bid amount to the offer creator
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

        // Loop through all offer assets and create a redeem for each
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
            balanceValidation, // Include balance validation in response for transparency
            transactionDetails: {
                transferAmount: acceptedBidNumericAmount,
                transferToken: bid.bidAssets[0].token,
                redeemAssets: offer.offerAssets.map(asset => ({
                    token: asset.token,
                    amount: asset.amount
                }))
            }
        }, { status: 200 });

    } catch (err: any) {
        console.error("[API /accept-bid] Error:", err);
        if (err instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: "Invalid request payload.", details: err.errors }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: err.message || "An unexpected error occurred." }, { status: 500 });
    }
} 