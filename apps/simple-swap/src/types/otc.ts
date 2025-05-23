export interface Asset {
    token: string;
    amount: string;
    identifier: string;
}

export interface Bid {
    bidUuid: string;
    bidderAddress: string;
    offeredAssets: Asset[];
    createdAt: number;
    status: "open" | "accepted" | "cancelled";
}

export interface Offer {
    intentUuid: string;
    status: "open" | "filled" | "cancelled";
    offerCreatorAddress: string;
    offerAssets: Asset[];
    createdAt: number;
    bids: Bid[];
}

export interface TokenDef {
    id: string;
    name: string;
    logo?: string;
    symbol: string;
    decimals: number;
    image: string;
    identifier: string;
}