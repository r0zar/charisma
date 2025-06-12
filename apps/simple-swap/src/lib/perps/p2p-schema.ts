import { z } from "zod";

/* ───────── funding request ───────── */
export const fundingRequestCreateSchema = z.object({
    // Link to perpetual position
    perpUuid: z.string().uuid("Perp UUID must be valid"),
    traderId: z.string().min(1, "Trader address required"),
    traderMarginIntent: z.string().min(1, "Trader margin intent signature required"),

    // Position details
    direction: z.enum(['long', 'short']),
    leverage: z.number().min(1).max(100),
    positionSize: z.string().regex(/^\d+(?:\.\d{1,8})?$/, "Position size must be numeric"),
    entryPrice: z.string().regex(/^\d+(?:\.\d{1,8})?$/, "Entry price must be numeric"),
    liquidationPrice: z.string().regex(/^\d+(?:\.\d{1,8})?$/, "Liquidation price must be numeric"),

    // Economic terms
    traderMargin: z.string().regex(/^\d+(?:\.\d{1,8})?$/, "Trader margin must be numeric"),
    maxCollateralNeeded: z.string().regex(/^\d+(?:\.\d{1,8})?$/, "Max collateral must be numeric"),
    fundingFeeRate: z.string().regex(/^\d+(?:\.\d{1,2})?%?$/, "Funding fee rate must be percentage"),

    // Token contracts
    baseToken: z.string().min(1, "Base token contract required"),
    quoteToken: z.string().min(1, "Quote token contract required"),
    marginToken: z.string().min(1, "Margin token contract required"),

    // Timing
    expiresAt: z.number().min(Date.now(), "Expiry must be in future"),
});

export type FundingRequestPayload = z.infer<typeof fundingRequestCreateSchema>;

export interface FundingRequest {
    id: string; // Unique ID for the funding request
    perpUuid: string;
    traderId: string;
    traderMarginIntent: string;

    // Position details
    direction: 'long' | 'short';
    leverage: number;
    positionSize: string;
    entryPrice: string;
    liquidationPrice: string;

    // Economic terms
    traderMargin: string;
    maxCollateralNeeded: string;
    fundingFeeRate: string;

    // Token contracts
    baseToken: string;
    quoteToken: string;
    marginToken: string;

    // Status and lifecycle
    fundingStatus: "seeking" | "funded" | "expired" | "settled";
    expiresAt: number;
    createdAt: number;
    funderId?: string;
    fundedAt?: number;
    settledAt?: number;

    // Funding offers
    fundingOffers: FundingOffer[];
}

/* ───────── funding offer ───────── */
export const fundingOfferCreateSchema = z.object({
    originalFundingRequestId: z.string().uuid("Original funding request ID must be valid"),
    funderId: z.string().min(1, "Funder address required"),
    funderCollateralIntent: z.string().min(1, "Funder collateral intent signature required"),
    maxCollateralOffered: z.string().regex(/^\d+(?:\.\d{1,8})?$/, "Max collateral offered must be numeric"),
    requestedFeeRate: z.string().regex(/^\d+(?:\.\d{1,2})?%?$/, "Requested fee rate must be percentage"),
    funderSideIntentUuid: z.string().uuid("Funder side intent UUID must be valid"),
    message: z.string().optional(),
});

export const fundingOfferCancelSchema = z.object({
    originalFundingRequestId: z.string().uuid(),
    fundingOfferId: z.string().uuid(),
});

export type FundingOfferPayload = z.infer<typeof fundingOfferCreateSchema>;

export interface FundingOffer extends Omit<FundingOfferPayload, 'funderCollateralIntent' | 'funderSideIntentUuid'> {
    fundingOfferId: string;
    createdAt: number;
    status: "pending" | "accepted" | "rejected" | "cancelled";
    funderCollateralIntent?: string;
    funderSideIntentUuid?: string;
    acceptanceDetails?: {
        executeFundingIntentUuid: string;
        acceptanceSignature: string;
        executeOpcodeHex: string;
        txId?: string;
    };
}

/* ───────── accept funding ───────── */
export const acceptFundingSchema = z.object({
    acceptedFundingOfferId: z.string().uuid(),
    fundingRequestId: z.string().uuid(),
});

export type AcceptFundingPayload = z.infer<typeof acceptFundingSchema>; 