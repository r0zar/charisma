import { listTokens } from "./token-cache-client";
import { getHostUrl } from '@modules/discovery';

const STXTOOLS_API_URL = 'https://api.stxtools.io/tokens?page=0&size=10000';

/** Get the appropriate prices endpoint for current environment */
const getPricesApiUrl = (): string => {
    // Use environment-aware URL discovery
    return `${getHostUrl('invest')}/api/v1/prices`;
};

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
 * Represents the structure of price data.
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
    stxtools: boolean;
    internal: boolean;
}

/**
 * Configuration for price aggregation strategy
 */
export interface PriceAggregationConfig {
    strategy: 'fallback' | 'average' | 'stxtools-primary' | 'internal-primary';
    timeout: number;
    sources: PriceSourceConfig;
}

/**
 * Default configuration for price aggregation
 */
const DEFAULT_CONFIG: PriceAggregationConfig = {
    strategy: 'average',
    timeout: 5000,
    sources: {
        stxtools: true,
        internal: true
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
 * Response format from our internal price API
 */
interface InternalPriceResponse {
    status: 'success' | 'error';
    data: Array<{
        tokenId: string;
        symbol: string;
        usdPrice: number;
        confidence: number;
    }>;
}

/**
 * Fetches token prices from our internal price API and converts to our format
 */
async function fetchInternalPrices(): Promise<KraxelPriceData> {
    const response = await fetch(`${getPricesApiUrl()}?limit=100`);
    if (!response.ok) {
        throw new Error(`Failed to fetch prices from Internal API: ${response.statusText}`);
    }

    const apiResponse = await response.json() as InternalPriceResponse;

    if (apiResponse.status !== 'success') {
        throw new Error('Internal API returned error status');
    }

    const priceData: KraxelPriceData = {};

    // Convert internal API format to our format
    apiResponse.data.forEach(token => {
        if (token.tokenId && token.usdPrice !== null && token.confidence > 0.1) {
            priceData[token.tokenId] = token.usdPrice;
        }

        // Handle STX specifically if present
        if (token.symbol === 'STX' || token.tokenId === '.stx') {
            priceData['.stx'] = token.usdPrice;
            priceData['stx'] = token.usdPrice;
        }
    });

    return priceData;
}

/**
 * Merges price data from multiple sources using the specified strategy
 */
function mergePriceData(
    stxToolsPrices: KraxelPriceData | null,
    internalPrices: KraxelPriceData | null,
    strategy: PriceAggregationConfig['strategy']
): KraxelPriceData {
    const merged: KraxelPriceData = {};

    switch (strategy) {
        case 'internal-primary':
            // Internal API takes precedence, STXTools fills gaps
            Object.assign(merged, stxToolsPrices || {}, internalPrices || {});
            break;

        case 'stxtools-primary':
            // STXTools takes precedence, Internal fills gaps
            Object.assign(merged, internalPrices || {}, stxToolsPrices || {});
            break;

        case 'average':
            // Average prices where sources have data
            const allKeys = new Set([
                ...Object.keys(stxToolsPrices || {}),
                ...Object.keys(internalPrices || {})
            ]);

            allKeys.forEach(key => {
                const stxToolsPrice = stxToolsPrices?.[key];
                const internalPrice = internalPrices?.[key];
                const prices = [stxToolsPrice, internalPrice].filter(p => p !== undefined) as number[];

                if (prices.length > 0) {
                    merged[key] = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                }
            });
            break;

        case 'fallback':
        default:
            // Use Internal API first, fallback to STXTools
            Object.assign(merged, stxToolsPrices || {}, internalPrices || {});
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
    if (!finalConfig.sources.stxtools && !finalConfig.sources.internal) {
        throw new Error('At least one price source must be enabled');
    }

    const createTimeoutPromise = <T>(ms: number): Promise<T> => {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Timeout: Operation took longer than ${ms}ms`));
            }, ms);
        });
    };

    let stxToolsPrices: KraxelPriceData | null = null;
    let internalPrices: KraxelPriceData | null = null;

    // Create promises array based on enabled sources
    const promises: Promise<KraxelPriceData>[] = [];
    const sourceNames: string[] = [];

    // Track whether stxtools was actually fetched (skipped in browser due to CORS)
    const stxtoolsSkipped = finalConfig.sources.stxtools && typeof window !== 'undefined';

    if (finalConfig.sources.stxtools) {
        if (stxtoolsSkipped) {
            console.log('STXTools API skipped in browser, using internal API only');
        } else {
            promises.push(Promise.race([fetchSTXToolsPrices(), createTimeoutPromise<KraxelPriceData>(finalConfig.timeout)]));
            sourceNames.push('stxtools');
        }
    }

    if (finalConfig.sources.internal) {
        promises.push(Promise.race([fetchInternalPrices(), createTimeoutPromise<KraxelPriceData>(finalConfig.timeout)]));
        sourceNames.push('internal');
    }

    // Fetch from enabled APIs concurrently
    const results = await Promise.allSettled(promises);

    // Process results based on which sources were actually fetched
    let resultIndex = 0;

    if (finalConfig.sources.stxtools && !stxtoolsSkipped) {
        if (results[resultIndex]?.status === 'fulfilled') {
            stxToolsPrices = (results[resultIndex] as PromiseFulfilledResult<KraxelPriceData>).value;
            console.log(`Successfully fetched ${Object.keys(stxToolsPrices).length} prices from STXTools API`);
        } else if (results[resultIndex]) {
            const reason = (results[resultIndex] as PromiseRejectedResult).reason;
            console.warn('Failed to fetch from STXTools API:', reason && reason.message ? reason.message : reason);
        }
        resultIndex++;
    } else if (!finalConfig.sources.stxtools) {
        console.log('STXTools API disabled');
    }

    if (finalConfig.sources.internal) {
        if (results[resultIndex]?.status === 'fulfilled') {
            internalPrices = (results[resultIndex] as PromiseFulfilledResult<KraxelPriceData>).value;
            console.log(`Successfully fetched ${Object.keys(internalPrices).length} prices from Internal API`);
        } else if (results[resultIndex]) {
            const reason = (results[resultIndex] as PromiseRejectedResult).reason;
            console.warn('Failed to fetch from Internal API:', reason && reason.message ? reason.message : reason);
        }
    } else {
        console.log('Internal API disabled');
    }

    // If all enabled APIs failed, return empty object
    const hasStxToolsData = stxToolsPrices && finalConfig.sources.stxtools;
    const hasInternalData = internalPrices && finalConfig.sources.internal;

    if (!hasStxToolsData && !hasInternalData) {
        const enabledSources = sourceNames.join(', ');
        console.error(`All enabled price APIs (${enabledSources}) failed, returning empty price object.`);
        return {};
    }

    // Merge the price data according to strategy
    const mergedPrices = mergePriceData(stxToolsPrices, internalPrices, finalConfig.strategy);

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
 * Fetches prices from STXTools API only
 */
export async function listPricesSTXTools(): Promise<KraxelPriceData> {
    return listPrices({
        strategy: 'stxtools-primary',
        sources: { stxtools: true, internal: false }
    });
}

/**
 * Fetches prices from Internal API only
 */
export async function listPricesInternal(): Promise<KraxelPriceData> {
    return listPrices({
        strategy: 'internal-primary',
        sources: { stxtools: false, internal: true }
    });
}