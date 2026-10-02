export interface LimitOrder {
    owner: string; // principal address
    inputToken: string; // subnet token contract id
    outputToken: string; // token contract id
    amountIn: string; // micro units string
    targetPrice?: string; // price in micro units output per input (for equals for now) - optional for manual orders
    /**
     * Direction of the price comparison. If `gt`, the order should fill when the
     * observed price is >= targetPrice. If `lt`, it should fill when the price
     * is <= targetPrice. Optional for manual orders.
     */
    direction?: 'lt' | 'gt';
    /**
     * Contract id of the token whose price should be watched when deciding if
     * this order triggers. Optional - if omitted, this is a manual order that
     * can be executed immediately without conditions.
     */
    conditionToken?: string;
    baseAsset?: string; // optional base asset contract id or 'USD'
    recipient: string;
    /**
     * Router contract the signature was made for (its signed `target`). Absent on older orders = x-multihop-rc9.
     * x-multihop-v2 and x-multihop-v1 only pay out to the signer.
     */
    router?: string;
    signature: string; // 65-byte hex without 0x
    uuid: string; // uuid from signed message
    status: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled' | 'filled';
    createdAt: string; // ISO
    txid?: string;
    /** When the swap transaction was broadcast (ISO) */
    broadcastedAt?: string;
    
    // Blockchain confirmation details (populated when status becomes 'confirmed' or 'failed')
    blockHeight?: number;
    blockTime?: number;
    confirmedAt?: string; // ISO timestamp when status changed to 'confirmed'
    failedAt?: string; // ISO timestamp when status changed to 'failed'
    failureReason?: string; // Reason for failure (e.g., 'abort_by_response')
    cancelledAt?: string; // ISO timestamp when status changed to 'cancelled'

    /**
     * Optional ISO 8601 timestamps that bound when the order can be executed.
     * If omitted, the order is valid immediately (validFrom) and/or never
     * expires (validTo).
     */
    validFrom?: string;
    validTo?: string;

    // Price tracking for progress indicators
    /**
     * Price of the condition token when the order was created.
     * Used to show progress from creation price → current price → target price.
     */
    creationPrice?: string;

    // Order strategies for split swaps and DCA
    /**
     * Groups related orders together (e.g., split swaps, DCA batches).
     * Orders with the same strategyId should be displayed as a single logical unit.
     */
    strategyId?: string;
    
    /**
     * Type of order strategy for UI display purposes.
     */
    strategyType?: 'dca' | 'twitter' | 'range' | 'zesty' | 'in-and-out';

    /**
     * Which side of a range swap this order is. Only set when strategyType is 'range'.
     */
    leg?: 'sell' | 'buy';

    /**
     * Position within the strategy (1-based index) for ordering and progress tracking.
     */
    strategyPosition?: number;
    
    /**
     * Total number of orders in this strategy for progress calculation.
     */
    strategySize?: number;
    
    /**
     * Human-readable description of the strategy.
     * e.g., "Split $1000 into 4 orders", "DCA $100 weekly for 10 weeks"
     */
    strategyDescription?: string;
    
    /**
     * Order conditions for conditional orders.
     */
    conditions?: {
        type: 'price' | 'ratio' | 'dca' | 'manual';
        params: {
            conditionToken?: string;
            targetPrice?: string;
            direction?: 'lt' | 'gt';
            baseAsset?: string;
        };
    };
    
    /**
     * Optional metadata for additional order information.
     */
    metadata?: Record<string, any>;
}

export type NewOrderRequest = Omit<LimitOrder, 'status' | 'createdAt' | 'txid' | 'id'>; 
/** An order as public APIs return it: no signature, and a handle in place of the uuid (see lib/orders/public.ts) */
export type PublicOrder = Omit<LimitOrder, 'signature'>;

export const LEGACY_ROUTER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9';
/** Pays out only to whoever signed the order, for subnets on Blaze v1 or v2: what new orders sign for */
export const SIGNER_PAYOUT_ROUTER = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v2';
/** The v1 router, which also pays only the signer (v1 subnets). Orders signed for it still execute on it. */
export const SIGNER_PAYOUT_ROUTER_V1 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1';
export const SIGNER_ONLY_ROUTERS = [SIGNER_PAYOUT_ROUTER, SIGNER_PAYOUT_ROUTER_V1];
export const ORDER_ROUTERS = [LEGACY_ROUTER, ...SIGNER_ONLY_ROUTERS];
