// import { listTokens, SIP10 } from './token-cache-client'; // Remove this import

const KRAXEL_API_URL = 'https://www.kraxel.io/api/prices';

// Restore manual subnet contract mappings
export const CHARISMA_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1"
export const WELSH_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1"
export const SBTC_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1"
export const SUSDC_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.susdc-token-subnet-v1"
export const PEPE_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.pepe-token-subnet-v1"
export const MALI_SUBNET_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.mali-token-subnet-v1"

export const CHARISMA_TOKEN_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
export const WELSHCORGICOIN_CONTRACT = "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token"
export const SBTC_TOKEN_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
export const SUSDC_TOKEN_CONTRACT = "SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1"
export const PEPE_TOKEN_CONTRACT = "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz"
export const MALI_TOKEN_CONTRACT = "SPKBV3CZB15CM3CVMCMRX56WRYKDY5P5CTQQXSN0.belgian-malinois"

type TokenContractId = string;
type PriceUSD = number;

/**
 * Represents the structure of the price data returned by the Kraxel API.
 * It's a record where keys are token identifiers (e.g., 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex')
 * and values are their corresponding prices as numbers.
 */
export type KraxelPriceData = Record<TokenContractId, PriceUSD>;

/**
 * Interface for tokens with subnet information
 */
export interface TokenWithSubnetInfo {
    contractId: string;
    type?: string;
    base?: string | null;
}

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
        console.warn("Price data from Kraxel API is missing both 'stx' and '.stx' keys.");
    }

    // Handle subnet token price proxying
    if (tokens && tokens.length > 0) {
        tokens.forEach(token => {
            if (token.type === 'SUBNET' && token.base) {
                const baseTokenPrice = processedPrices[token.base];
                if (baseTokenPrice !== undefined) {
                    processedPrices[token.contractId] = baseTokenPrice;
                } else {
                    // console.warn(`Price for base token '${token.base}' (for subnet '${token.contractId}') not found.`);
                }
            }
        });
    }

    return processedPrices;
}

/**
 * Fetches the latest token prices from the Kraxel API.
 *
 * @returns A promise that resolves to an object containing token identifiers as keys and their prices as values.
 * @throws Throws an error if the network request fails or if the response cannot be parsed as JSON.
 */
export async function listPrices(): Promise<KraxelPriceData> {
    const TIMEOUT_MS = 5000;

    const fetchPrices = async (): Promise<KraxelPriceData> => {
        const response = await fetch(KRAXEL_API_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch prices from Kraxel API: ${response.statusText}`);
        }
        const data = await response.json() as KraxelPriceData;

        // Use the new processTokenPrices function with manual mappings
        const manualTokenMappings: TokenWithSubnetInfo[] = [
            { contractId: CHARISMA_SUBNET_CONTRACT, type: 'SUBNET', base: CHARISMA_TOKEN_CONTRACT },
            { contractId: WELSH_SUBNET_CONTRACT, type: 'SUBNET', base: WELSHCORGICOIN_CONTRACT },
            { contractId: SBTC_SUBNET_CONTRACT, type: 'SUBNET', base: SBTC_TOKEN_CONTRACT },
            { contractId: SUSDC_SUBNET_CONTRACT, type: 'SUBNET', base: SUSDC_TOKEN_CONTRACT },
            { contractId: PEPE_SUBNET_CONTRACT, type: 'SUBNET', base: PEPE_TOKEN_CONTRACT },
            { contractId: MALI_SUBNET_CONTRACT, type: 'SUBNET', base: MALI_TOKEN_CONTRACT },
        ];

        return processTokenPrices(data, manualTokenMappings);
    };

    const timeoutPromise = new Promise<KraxelPriceData>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Timeout: Price fetching took longer than ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);
    });

    try {
        const result = await Promise.race([fetchPrices(), timeoutPromise]);
        return result;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Timeout')) {
            console.error(error.message);
        } else {
            console.error(`Failed to parse price data from Kraxel API or other fetch error: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {}; // Return empty object on any error
    }
} 