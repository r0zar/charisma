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
    const TIMEOUT_MS = 5000;

    const fetchPrices = async (): Promise<KraxelPriceData> => {
        const response = await fetch(KRAXEL_API_URL);

        if (!response.ok) {
            throw new Error(`Failed to fetch prices from Kraxel API: ${response.statusText}`);
        }

        const data: KraxelPriceData = await response.json();

        if (data.hasOwnProperty('stx')) {
            data['.stx'] = data['stx'];
        } else {
            console.warn("Price data from Kraxel API is missing 'stx' key.");
        }

        if (data.hasOwnProperty(CHARISMA_TOKEN_CONTRACT)) {
            data[CHARISMA_SUBNET_CONTRACT] = data[CHARISMA_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${CHARISMA_TOKEN_CONTRACT}' key.`);
        }

        if (data.hasOwnProperty(WELSHCORGICOIN_CONTRACT)) {
            data[WELSH_SUBNET_CONTRACT] = data[WELSHCORGICOIN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${WELSHCORGICOIN_CONTRACT}' key.`);
        }

        if (data.hasOwnProperty(SBTC_TOKEN_CONTRACT)) {
            data[SBTC_SUBNET_CONTRACT] = data[SBTC_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${SBTC_TOKEN_CONTRACT}' key.`);
        }

        // Ensure SUSDC_TOKEN_CONTRACT key exists
        if (data.hasOwnProperty(SUSDC_TOKEN_CONTRACT)) {
            data[SUSDC_SUBNET_CONTRACT] = data[SUSDC_TOKEN_CONTRACT];
        } else {
            console.warn(`Price data from Kraxel API is missing '${SUSDC_TOKEN_CONTRACT}' key.`);
        }

        // Ensure PEPE_TOKEN_CONTRACT key exists
        if (data.hasOwnProperty(PEPE_TOKEN_CONTRACT)) {
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
    };

    const timeoutPromise = new Promise<KraxelPriceData>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Timeout: Price fetching took longer than ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);
    });

    try {
        // Race the fetch operation against the timeout
        const result = await Promise.race([fetchPrices(), timeoutPromise]);
        return result;
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Timeout')) {
            console.error(error.message);
        } else {
            console.error(`Failed to parse price data from Kraxel API or other fetch error: ${error instanceof Error ? error.message : String(error)}`);
        }
        return {}; // Return empty object on any error (including timeout)
    }
} 