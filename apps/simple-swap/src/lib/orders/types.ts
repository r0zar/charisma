export interface LimitOrder {
    owner: string; // principal address
    inputToken: string; // subnet token contract id
    outputToken: string; // token contract id
    amountIn: string; // micro units string
    targetPrice: string; // price in micro units output per input (for equals for now)
    /**
     * Direction of the price comparison. If `gt`, the order should fill when the
     * observed price is >= targetPrice. If `lt`, it should fill when the price
     * is <= targetPrice.
     */
    direction: 'lt' | 'gt';
    /**
     * Contract id of the token whose price should be watched when deciding if
     * this order triggers. If omitted, the outputToken will be used.
     */
    conditionToken: string;
    baseAsset?: string; // optional base asset contract id or 'USD'
    recipient: string;
    signature: string; // 65-byte hex without 0x
    uuid: string; // uuid from signed message
    status: 'open' | 'filled' | 'cancelled';
    createdAt: string; // ISO
    txid?: string;
}

export type NewOrderRequest = Omit<LimitOrder, 'status' | 'createdAt' | 'txid' | 'id'>; 