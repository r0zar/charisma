import { listTokens } from "./token-cache-client";

const KRAXEL_API_URL = 'https://www.kraxel.io/api/prices';
const STXTOOLS_API_URL = 'https://api.stxtools.io/tokens?page=0&size=10000';

// Restore manual subnet contract mappings
export const CHARISMA_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1"
export const WELSH_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1"
export const SBTC_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1"
export const SUSDC_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.susdc-token-subnet-v1"
export const PEPE_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.pepe-token-subnet-v1"

export const CHARISMA_TOKEN_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
export const WELSHCORGICOIN_CONTRACT = "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token"
export const SBTC_TOKEN_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
export const SUSDC_TOKEN_CONTRACT = "SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1"
export const PEPE_TOKEN_CONTRACT = "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz"

type TokenContractId = string;
type PriceUSD = number;

/**
 * Represents the structure of the price data returned by the Kraxel API.
 * It's a record where keys are token identifiers (e.g., 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex')
 * and values are their corresponding prices as numbers.
 */
export type KraxelPriceData = Record<TokenContractId, PriceUSD>;

/**
 * Represents the structure of token data returned by the STXTools API
 */
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

/**
 * Represents the structure of the STXTools API response
 */
export interface STXToolsResponse {
    data: STXToolsToken[];
}

/**
 * Interface for tokens with subnet information
 */
export interface TokenWithSubnetInfo {
    contractId: string;
    type?: string;
    base?: string | null;
}

/**
 * Configuration for price sources
 */
export interface PriceSourceConfig {
    kraxel: boolean;
    stxtools: boolean;
}

/**
 * Configuration for price aggregation strategy
 */
export interface PriceAggregationConfig {
    strategy: 'fallback' | 'average' | 'kraxel-primary' | 'stxtools-primary';
    timeout: number;
    sources: PriceSourceConfig;
}

/**
 * Default configuration for price aggregation
 */
const DEFAULT_CONFIG: PriceAggregationConfig = {
    strategy: 'stxtools-primary',
    timeout: 5000,
    sources: {
        kraxel: false,
        stxtools: true
    }
};

/**
 * Process token prices to handle STX key normalization and subnet token price proxying.
 * This function:
 * 1. Normalizes STX price keys ('.stx' vs 'stx')
 * 2. Proxies subnet token prices from their base tokens
 * 
 * @param rawPrices - The raw price data from the API
 * @param tokens - Array of tokens with subnet information (optional)
 * @returns Processed price data with subnet tokens mapped to their base token prices
 */
export function processTokenPrices(
    rawPrices: KraxelPriceData,
    tokens?: TokenWithSubnetInfo[]
): KraxelPriceData {
    const processedPrices: KraxelPriceData = { ...rawPrices };

    // Handle STX price key ('.stx' vs 'stx')
    if (processedPrices.hasOwnProperty('stx') && !processedPrices.hasOwnProperty('.stx')) {
        processedPrices['.stx'] = processedPrices['stx'];
    } else if (processedPrices.hasOwnProperty('.stx') && !processedPrices.hasOwnProperty('stx')) {
        // If only .stx exists, ensure stx is also available if something expects it
        // processedPrices['stx'] = processedPrices['.stx']; 
    } else if (!processedPrices.hasOwnProperty('stx') && !processedPrices.hasOwnProperty('.stx')) {
        console.warn("Price data from API is missing both 'stx' and '.stx' keys.");
    }

    // Handle subnet token price proxying
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

/**
 * Fetches token prices from the Kraxel API
 */
async function fetchKraxelPrices(): Promise<KraxelPriceData> {
    const response = await fetch(KRAXEL_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch prices from Kraxel API: ${response.statusText}`);
    }
    return await response.json() as KraxelPriceData;
}

/**
 * Fetches token prices from the STXTools API and converts to our format
 */
async function fetchSTXToolsPrices(): Promise<KraxelPriceData> {
    const response = await fetch(STXTOOLS_API_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch prices from STXTools API: ${response.statusText}`);
    }

    const apiResponse = await response.json() as STXToolsResponse;
    const priceData: KraxelPriceData = {};

    // Convert STXTools format to our format
    apiResponse.data.forEach(token => {
        if (token.contract_id && token.metrics.price_usd !== null) {
            priceData[token.contract_id] = token.metrics.price_usd;
        }

        // Handle STX specifically - check if this is the STX token
        if (token.symbol === 'STX' && token.contract_id === '.stx') {
            priceData['.stx'] = token.metrics.price_usd || 0;
            priceData['stx'] = token.metrics.price_usd || 0;
        }
    });

    return priceData;
}

/**
 * Merges price data from multiple sources using the specified strategy
 */
function mergePriceData(
    kraxelPrices: KraxelPriceData | null,
    stxToolsPrices: KraxelPriceData | null,
    strategy: PriceAggregationConfig['strategy']
): KraxelPriceData {
    const merged: KraxelPriceData = {};

    switch (strategy) {
        case 'kraxel-primary':
            // Kraxel takes precedence, STXTools fills gaps
            Object.assign(merged, stxToolsPrices || {}, kraxelPrices || {});
            break;

        case 'stxtools-primary':
            // STXTools takes precedence, Kraxel fills gaps
            Object.assign(merged, kraxelPrices || {}, stxToolsPrices || {});
            break;

        case 'average':
            // Average prices where both sources have data
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
            // Use Kraxel, fallback to STXTools for missing data
            Object.assign(merged, stxToolsPrices || {}, kraxelPrices || {});
            break;
    }

    return merged;
}

/**
 * Fetches token prices from multiple sources with configurable aggregation strategy
 */
export async function listPrices(config: Partial<PriceAggregationConfig> = {}): Promise<KraxelPriceData> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // Validate that at least one source is enabled
    if (!finalConfig.sources.kraxel && !finalConfig.sources.stxtools) {
        throw new Error('At least one price source must be enabled');
    }

    const createTimeoutPromise = <T>(ms: number): Promise<T> => {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Timeout: Operation took longer than ${ms}ms`));
            }, ms);
        });
    };

    let kraxelPrices: KraxelPriceData | null = null;
    let stxToolsPrices: KraxelPriceData | null = null;

    // Create promises array based on enabled sources
    const promises: Promise<KraxelPriceData>[] = [];
    const sourceNames: string[] = [];

    if (finalConfig.sources.kraxel) {
        promises.push(Promise.race([fetchKraxelPrices(), createTimeoutPromise<KraxelPriceData>(finalConfig.timeout)]));
        sourceNames.push('kraxel');
    }

    if (finalConfig.sources.stxtools) {
        promises.push(Promise.race([fetchSTXToolsPrices(), createTimeoutPromise<KraxelPriceData>(finalConfig.timeout)]));
        sourceNames.push('stxtools');
    }

    // Fetch from enabled APIs concurrently
    const results = await Promise.allSettled(promises);

    // Process results based on which sources were enabled
    let resultIndex = 0;

    if (finalConfig.sources.kraxel) {
        if (results[resultIndex].status === 'fulfilled') {
            kraxelPrices = (results[resultIndex] as PromiseFulfilledResult<KraxelPriceData>).value;
            console.log(`Successfully fetched ${Object.keys(kraxelPrices).length} prices from Kraxel API`);
        } else {
            const reason = (results[resultIndex] as PromiseRejectedResult).reason;
            console.error('Failed to fetch from Kraxel API:', reason && reason.message ? reason.message : reason);
        }
        resultIndex++;
    } else {
        console.log('Kraxel API disabled');
    }

    if (finalConfig.sources.stxtools) {
        if (results[resultIndex].status === 'fulfilled') {
            stxToolsPrices = (results[resultIndex] as PromiseFulfilledResult<KraxelPriceData>).value;
            console.log(`Successfully fetched ${Object.keys(stxToolsPrices).length} prices from STXTools API`);
        } else {
            const reason = (results[resultIndex] as PromiseRejectedResult).reason;
            console.error('Failed to fetch from STXTools API:', reason && reason.message ? reason.message : reason);
        }
    } else {
        console.log('STXTools API disabled');
    }

    // If all enabled APIs failed, return empty object
    if ((!kraxelPrices || !finalConfig.sources.kraxel) && (!stxToolsPrices || !finalConfig.sources.stxtools)) {
        const enabledSources = sourceNames.join(', ');
        console.error(`All enabled price APIs (${enabledSources}) failed, returning empty price object.`);
        return {};
    }

    // Merge the price data according to strategy
    const mergedPrices = mergePriceData(kraxelPrices, stxToolsPrices, finalConfig.strategy);

    // Apply subnet token processing
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

/**
 * Fetches prices from Kraxel API only (for backward compatibility)
 */
export async function listPricesKraxel(): Promise<KraxelPriceData> {
    return listPrices({
        strategy: 'kraxel-primary',
        sources: { kraxel: true, stxtools: false }
    });
}

/**
 * Fetches prices from STXTools API only
 */
export async function listPricesSTXTools(): Promise<KraxelPriceData> {
    return listPrices({
        strategy: 'stxtools-primary',
        sources: { kraxel: false, stxtools: true }
    });
}