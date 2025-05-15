import { fetch } from 'cross-fetch';

const KRAXEL_API_URL = 'https://www.kraxel.io/api/prices';

// Charisma Credits contract
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
 * Fetches the latest token prices from the Kraxel API.
 *
 * @returns A promise that resolves to an object containing token identifiers as keys and their prices as values.
 * @throws Throws an error if the network request fails or if the response cannot be parsed as JSON.
 */
export async function listPrices(): Promise<KraxelPriceData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch(KRAXEL_API_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch prices from Kraxel API: ${response.statusText}`);
        }

        const data: KraxelPriceData = await response.json();

        // Ensure 'stx' key exists before assigning
        if (data.hasOwnProperty('stx')) {
            data['.stx'] = data['stx'];
        } else {
            console.warn("Price data from Kraxel API is missing 'stx' key.");
            // Optionally set data['.stx'] = undefined or some default if needed elsewhere
        }

        // Ensure CHARISMA_TOKEN_CONTRACT key exists
        if (data.hasOwnProperty(CHARISMA_TOKEN_CONTRACT)) {
            data[CHARISMA_SUBNET_CONTRACT] = data[CHARISMA_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${CHARISMA_TOKEN_CONTRACT}' key.`);
        }

        // Ensure WELSHCORGICOIN_CONTRACT key exists
        if (data.hasOwnProperty(WELSHCORGICOIN_CONTRACT)) {
            data[WELSH_SUBNET_CONTRACT] = data[WELSHCORGICOIN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${WELSHCORGICOIN_CONTRACT}' key.`);
        }

        // Ensure SBTC_SUBNET_CONTRACT key exists
        if (data.hasOwnProperty(SBTC_SUBNET_CONTRACT)) {
            data[SBTC_SUBNET_CONTRACT] = data[SBTC_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${SBTC_TOKEN_CONTRACT}' key.`);
        }

        // Ensure SUSDC_SUBNET_CONTRACT key exists
        if (data.hasOwnProperty(SUSDC_SUBNET_CONTRACT)) {
            data[SUSDC_SUBNET_CONTRACT] = data[SUSDC_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${SUSDC_TOKEN_CONTRACT}' key.`);
        }

        // Ensure PEPE_SUBNET_CONTRACT key exists
        if (data.hasOwnProperty(PEPE_SUBNET_CONTRACT)) {
            data[PEPE_SUBNET_CONTRACT] = data[PEPE_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${PEPE_TOKEN_CONTRACT}' key.`);
        }


        // Ensure MALI_TOKEN_CONTRACT key exists
        if (data.hasOwnProperty(MALI_TOKEN_CONTRACT)) {
            data[MALI_SUBNET_CONTRACT] = data[MALI_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${MALI_TOKEN_CONTRACT}' key.`);
        }

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('Price fetch timed out');
            throw new Error('Failed to fetch prices: The request timed out.');
        }
        throw new Error(`Failed to parse price data from Kraxel API or other fetch error: ${error instanceof Error ? error.message : String(error)}`);
    }
} 