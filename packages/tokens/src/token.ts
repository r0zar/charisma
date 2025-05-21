export interface SIP10 {
    contractId: string;
    identifier: string;
    name: string;
    symbol: string;
    image: string;
    description: string;
    decimals: number;
}

class Token {
    contractId: string;
    identifier: string;
    name: string;
    symbol: string;
    image: string;
    description: string;
    decimals: number;

    constructor(data: SIP10) {
        if (!data.contractId) throw new Error(`Contract ID is required in ${data.contractId}`)
        if (!data.identifier) throw new Error(`Identifier is required in ${data.contractId}`)
        if (!data.name) throw new Error(`Name is required in ${data.contractId}`)
        if (!data.symbol) throw new Error(`Symbol is required in ${data.contractId}`)
        if (!data.decimals) throw new Error(`Decimals is required in ${data.contractId}`)
        this.contractId = data.contractId;
        this.identifier = data.identifier;
        this.name = data.name;
        this.symbol = data.symbol;
        this.image = data.image ?? 'https://placehold.co/400?text=' + data.symbol;
        this.description = data.description ?? '';
        this.decimals = data.decimals;
    }

    toAtomicUnits(amount: number): number {
        return amount * 10 ** this.decimals;
    }

    toFormattedUnits(amount: number): number {
        return amount / 10 ** this.decimals;
    }
}

export { Token };