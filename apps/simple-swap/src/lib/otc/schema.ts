import { z } from "zod";

/* ───────── asset ───────── */
export const assetSchema = z.object({
    token: z.string().min(1, "token id required"),
    amount: z.string().regex(/^\d+$/, "amount must be integer string"),
});
export type Asset = z.infer<typeof assetSchema>;

export const signedAssetSchema = assetSchema.extend({
    intentUuid: z.string().uuid("Signed asset intentUuid must be a valid UUID"),
    signature: z.string().min(1, "Signed asset signature is required"),
});
export type SignedAsset = z.infer<typeof signedAssetSchema>;

/* ───────── offer ───────── */
export const offerCreateSchema = z.object({
    offerAssets: z.array(signedAssetSchema).min(1, "At least one offer asset is required"),
});

export type OfferPayload = z.infer<typeof offerCreateSchema>;

export interface Offer {
    intentUuid: string;
    offerCreatorAddress: string;
    offerAssets: SignedAsset[];
    status: "open" | "filled" | "cancelled";
    createdAt: number;
    bids: Bid[];
}

/* ───────── bid ───────── */
export const bidCreateSchema = z.object({
    originalOfferIntentUuid: z.string().uuid(),
    bidderAddress: z.string().min(1),
    bidAssets: z.array(assetSchema).length(1),
    bidSignature: z.string().min(1),
    bidderSideIntentUuid: z.string().uuid(),
    message: z.string().optional(),
});
export const bidCancelSchema = z.object({
    originalOfferIntentUuid: z.string().uuid(),
    bidId: z.string().uuid(),
});

export type BidPayload = z.infer<typeof bidCreateSchema>;

export interface Bid extends Omit<BidPayload, 'bidSignature' | 'bidderSideIntentUuid'> {
    bidId: string;
    createdAt: number;
    status: "pending" | "accepted" | "rejected" | "cancelled";
    bidSignature?: string;
    bidderSideIntentUuid?: string;
    message?: string;
    acceptanceDetails?: {
        executeOtcSwapIntentUuid: string;
        acceptanceSignature: string;
        executeOpcodeHex: string;
        txId?: string;
    };
}

/* ───────── accept bid ───────── */
export const acceptBidSchema = z.object({
    acceptedBidId: z.string().uuid(),
    offerIntentUuid: z.string().uuid(),
});
export type AcceptBidPayload = z.infer<typeof acceptBidSchema>;
