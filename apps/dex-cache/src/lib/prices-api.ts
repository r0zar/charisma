/** Token prices from prices.charisma.rocks, Charisma's price service (apps/prices) */
const PRICES_API = 'https://prices.charisma.rocks/api/v1';

/** One token as the prices API reports it */
export interface PricedToken {
    contractId: string;
    symbol: string;
    name: string;
    image?: string;
    decimals: number;
    usd: number;
    sbtc: number;
    liquidityUsd: number;
    /** Percent lost buying about $1 and selling straight back; null for older prices */
    roundTripLoss: number | null;
    updatedAt: string;
}

/** Latest prices, for every priced token or just `tokens` */
export async function fetchPrices(tokens?: string[]): Promise<{ updatedAt: string | null; tokens: PricedToken[] }> {
    const url = tokens?.length ? `${PRICES_API}/prices?tokens=${tokens.map(encodeURIComponent).join(',')}` : `${PRICES_API}/prices`;
    const res = await fetch(url, { headers: { 'User-Agent': 'dex-cache/1.0' } });
    if (!res.ok) throw new Error(`Prices API answered HTTP ${res.status} for ${url}`);
    return res.json();
}

/** A price in the shape invest's /api/v1/prices has always returned */
export const toInvestPrice = (t: PricedToken) => ({
    tokenId: t.contractId,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals,
    image: t.image ?? '',
    usdPrice: t.usd,
    sbtcRatio: t.sbtc,
    confidence: t.roundTripLoss === null ? 1 : Math.max(0, 1 - t.roundTripLoss / 100),
    lastUpdated: Date.parse(t.updatedAt),
    totalLiquidity: t.liquidityUsd,
    isLpToken: false,
    intrinsicValue: t.usd,
    marketPrice: t.usd,
});

/** A token's price as the energy calculations use it */
export interface TokenPriceData {
    tokenId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    /** 1 for a healthy pool, lower as a $1 round trip loses more */
    reliability: number;
    confidence: number;
    lastUpdated: number;
    source: string;
}

export function toTokenPriceData(t: PricedToken): TokenPriceData {
    const reliability = t.roundTripLoss === null ? 1 : Math.max(0, 1 - t.roundTripLoss / 100);
    return {
        tokenId: t.contractId,
        symbol: t.symbol,
        usdPrice: t.usd,
        sbtcRatio: t.sbtc,
        reliability,
        confidence: reliability,
        lastUpdated: Date.parse(t.updatedAt),
        source: 'prices.charisma.rocks',
    };
}
