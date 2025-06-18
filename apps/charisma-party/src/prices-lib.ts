import { listTokens } from "./token-cache-client";

const KRAXEL_API_URL = 'https://www.kraxel.io/api/prices';
const STXTOOLS_API_URL = 'https://api.stxtools.io/tokens?page=0&size=4000';

type TokenContractId = string;
type PriceUSD = number;
export type KraxelPriceData = Record<TokenContractId, PriceUSD>;

export interface STXToolsToken {
    contract_id: string;
    symbol: string;
    name: string;
    decimals: number;
    description: string | null;
    circulating_supply: string;
    total_supply: string;
    image_url: string;
    tx_id: string;
    sender_address: string;
    block_height: number;
    deployed_at: number;
    enabled: boolean;
    header_image_url: string | null;
    verified: boolean;
    metrics: {
        contract_id: string;
        holder_count: number;
        swap_count: number | null;
        transfer_count: number | null;
        price_usd: number | null;
        price_change_1d: number | null;
        price_change_7d: number | null;
        price_change_30d: number | null;
        liquidity_usd: number | null;
        marketcap_usd: number | null;
        volume_1h_usd: number;
        volume_6h_usd: number;
        volume_1d_usd: number;
        volume_7d_usd: number;
    };
}

export interface STXToolsResponse {
    data: STXToolsToken[];
}

export interface TokenWithSubnetInfo {
    contractId: string;
    type?: string;
    base?: string | null;
}

export interface PriceAggregationConfig {
    strategy: 'fallback' | 'average' | 'kraxel-primary' | 'stxtools-primary';
    timeout: number;
}

const DEFAULT_CONFIG: PriceAggregationConfig = {
    strategy: 'average',
    timeout: 5000
};

export function processTokenPrices(
    rawPrices: KraxelPriceData,
    tokens?: TokenWithSubnetInfo[]
): KraxelPriceData {
    const processedPrices: KraxelPriceData = { ...rawPrices };
    if (processedPrices.hasOwnProperty('stx') && !processedPrices.hasOwnProperty('.stx')) {
        processedPrices['.stx'] = processedPrices['stx'];
    } else if (processedPrices.hasOwnProperty('.stx') && !processedPrices.hasOwnProperty('stx')) {
        // processedPrices['stx'] = processedPrices['.stx']; 
    } else if (!processedPrices.hasOwnProperty('stx') && !processedPrices.hasOwnProperty('.stx')) {
        console.warn("Price data from API is missing both 'stx' and '.stx' keys.");
    }
    if (tokens && tokens.length > 0) {
        tokens.forEach(token => {
            if (token.type === 'SUBNET' && token.base) {
                const baseTokenPrice = processedPrices[token.base];
                if (baseTokenPrice !== undefined) {
                    processedPrices[token.contractId] = baseTokenPrice;
                } else {
                    console.warn(`Price for base token '${token.base}' (for subnet '${token.contractId}') not found.`);
                }
            }
        });
    }
    return processedPrices;
}

async function fetchKraxelPrices(): Promise<KraxelPriceData> {
    const response = await fetch(KRAXEL_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch prices from Kraxel API: ${response.statusText}`);
    }
    return await response.json() as KraxelPriceData;
}

async function fetchSTXToolsPrices(): Promise<KraxelPriceData> {
    const response = await fetch(STXTOOLS_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch prices from STXTools API: ${response.statusText}`);
    }
    const apiResponse = await response.json() as STXToolsResponse;
    const priceData: KraxelPriceData = {};
    apiResponse.data.forEach(token => {
        if (token.contract_id && token.metrics.price_usd !== null) {
            priceData[token.contract_id] = token.metrics.price_usd;
        }
        if (token.symbol === 'STX' && token.contract_id === '.stx') {
            priceData['.stx'] = token.metrics.price_usd || 0;
            priceData['stx'] = token.metrics.price_usd || 0;
        }
    });
    return priceData;
}

function mergePriceData(
    kraxelPrices: KraxelPriceData | null,
    stxToolsPrices: KraxelPriceData | null,
    strategy: PriceAggregationConfig['strategy']
): KraxelPriceData {
    const merged: KraxelPriceData = {};
    switch (strategy) {
        case 'kraxel-primary':
            Object.assign(merged, stxToolsPrices || {}, kraxelPrices || {});
            break;
        case 'stxtools-primary':
            Object.assign(merged, kraxelPrices || {}, stxToolsPrices || {});
            break;
        case 'average':
            const allKeys = new Set([
                ...Object.keys(kraxelPrices || {}),
                ...Object.keys(stxToolsPrices || {})
            ]);
            allKeys.forEach(key => {
                const kraxelPrice = kraxelPrices?.[key];
                const stxToolsPrice = stxToolsPrices?.[key];
                if (kraxelPrice !== undefined && stxToolsPrice !== undefined) {
                    merged[key] = (kraxelPrice + stxToolsPrice) / 2;
                } else if (kraxelPrice !== undefined) {
                    merged[key] = kraxelPrice;
                } else if (stxToolsPrice !== undefined) {
                    merged[key] = stxToolsPrice;
                }
            });
            break;
        case 'fallback':
        default:
            Object.assign(merged, stxToolsPrices || {}, kraxelPrices || {});
            break;
    }
    return merged;
}

export async function listPrices(config: Partial<PriceAggregationConfig> = {}): Promise<KraxelPriceData> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const createTimeoutPromise = <T>(ms: number): Promise<T> => {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Timeout: Operation took longer than ${ms}ms`));
            }, ms);
        });
    };
    let kraxelPrices: KraxelPriceData | null = null;
    let stxToolsPrices: KraxelPriceData | null = null;
    const results = await Promise.allSettled([
        Promise.race([fetchKraxelPrices(), createTimeoutPromise<KraxelPriceData>(finalConfig.timeout)]),
        Promise.race([fetchSTXToolsPrices(), createTimeoutPromise<KraxelPriceData>(finalConfig.timeout)])
    ]);
    if (results[0].status === 'fulfilled') {
        kraxelPrices = results[0].value;
        console.log(`Successfully fetched ${Object.keys(kraxelPrices).length} prices from Kraxel API`);
    } else {
        const reason = (results[0] as PromiseRejectedResult).reason;
        console.error('Failed to fetch from Kraxel API:', reason && reason.message ? reason.message : reason);
    }
    if (results[1].status === 'fulfilled') {
        stxToolsPrices = results[1].value;
        console.log(`Successfully fetched ${Object.keys(stxToolsPrices).length} prices from STXTools API`);
    } else {
        const reason = (results[1] as PromiseRejectedResult).reason;
        console.error('Failed to fetch from STXTools API:', reason && reason.message ? reason.message : reason);
    }
    if (!kraxelPrices && !stxToolsPrices) {
        console.error('Both price APIs failed, returning empty price object.');
        return {};
    }
    const mergedPrices = mergePriceData(kraxelPrices, stxToolsPrices, finalConfig.strategy);
    try {
        const tokens = await listTokens();
        const processedPrices = processTokenPrices(mergedPrices, tokens);
        console.log(`Final merged price data contains ${Object.keys(processedPrices).length} tokens`);
        return processedPrices;
    } catch (error) {
        console.error('Failed to process subnet tokens, returning unprocessed prices:', error && (error as Error).message ? (error as Error).message : error);
        return mergedPrices || {};
    }
} 