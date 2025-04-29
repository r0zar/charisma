import { fetch } from 'cross-fetch';

const KRAXEL_API_URL = 'https://www.kraxel.io/api/prices';

/**
 * Represents the structure of the price data returned by the Kraxel API.
 * It's a record where keys are token identifiers (e.g., 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex')
 * and values are their corresponding prices as numbers.
 */
export type KraxelPriceData = Record<string, number>;

/**
 * Fetches the latest token prices from the Kraxel API.
 *
 * @returns A promise that resolves to an object containing token identifiers as keys and their prices as values.
 * @throws Throws an error if the network request fails or if the response cannot be parsed as JSON.
 */
export async function listPrices(): Promise<KraxelPriceData> {
    const response = await fetch(KRAXEL_API_URL);

    if (!response.ok) {
        throw new Error(`Failed to fetch prices from Kraxel API: ${response.statusText}`);
    }

    try {
        const data: KraxelPriceData = await response.json();
        data['.stx'] = data['stx'];
        return data;
    } catch (error) {
        throw new Error(`Failed to parse price data from Kraxel API: ${error instanceof Error ? error.message : String(error)}`);
    }
} 