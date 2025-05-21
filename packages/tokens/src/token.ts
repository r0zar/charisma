import { TokenCacheData } from "./token-cache-client";

class Token {
    id: string;
    name: string;
    symbol: string;
    image: string;
    description: string;
    decimals: number;
    constructor(data: TokenCacheData) {
        if (!data.contractId) throw new Error('Contract ID is required')
        if (!data.name) throw new Error('Name is required')
        if (!data.symbol) throw new Error('Symbol is required')
        if (!data.image) throw new Error('Image is required')
        if (!data.description) throw new Error('Description is required')
        if (!data.decimals) throw new Error('Decimals is required')
        this.id = data.contractId;
        this.name = data.name;
        this.symbol = data.symbol;
        this.image = data.image;
        this.description = data.description;
        this.decimals = data.decimals;
    }

    toAtomicUnits(amount: number): number {
        return amount * 10 ** this.decimals;
    }

    toFormattedUnits(amount: number): number {
        return amount / 10 ** this.decimals;
    }
}

export default Token;