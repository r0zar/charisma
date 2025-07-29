// Stub service to replace missing @services/prices until proper refactor
export interface TokenPriceData {
    tokenId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    reliability: number;
    lastUpdated: number;
    source: string;
}

export interface PriceAPIResponse {
    success: boolean;
    data?: {
        prices: Record<string, TokenPriceData>;
    };
    error?: string;
}

export class PriceSeriesStorage {
    // Stub implementation
}

export class PriceSeriesAPI {
    constructor(private storage: PriceSeriesStorage) {}

    async getBulkCurrentPrices({ tokenIds }: { tokenIds: string[] }): Promise<PriceAPIResponse> {
        // Stub implementation that calls the new lakehouse API
        try {
            const lakehouseUrl = new URL('https://lakehouse.charisma.rocks/api/token-prices');
            lakehouseUrl.searchParams.set('limit', '1000');

            const response = await fetch(lakehouseUrl.toString());
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const prices: Record<string, TokenPriceData> = {};

            data.prices.forEach((price: any) => {
                if (tokenIds.includes(price.token_contract_id)) {
                    prices[price.token_contract_id] = {
                        tokenId: price.token_contract_id,
                        symbol: price.token_contract_id.split('.').pop()?.toUpperCase() || 'UNKNOWN',
                        usdPrice: price.usd_price,
                        sbtcRatio: price.sbtc_price,
                        reliability: Math.min(1, Math.max(0, 1 - (price.final_convergence_percent || 0) / 100)),
                        lastUpdated: new Date(price.calculated_at).getTime(),
                        source: 'lakehouse'
                    };
                }
            });

            return {
                success: true,
                data: { prices }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}

// Stub functions for LP token analysis
export function analyzeLpTokenPricing(vault: any, prices: Record<string, number>): Promise<any> {
    return Promise.resolve({
        intrinsicValue: 0,
        marketPrice: null,
        priceDifference: 0,
        isArbitrageOpportunity: false,
        assetBreakdown: null
    });
}

export function formatLpPriceAnalysis(analysis: any): any {
    return {
        intrinsicValue: '$0.00',
        marketPrice: null,
        priceDifference: '$0.00',
        absoluteDifference: '0.00%'
    };
}