interface PriceResponse {
  prices: Array<{
    type: 'PRICE_UPDATE';
    contractId: string;
    price: number;
    timestamp: number;
    source?: string;
  }>;
  party: string;
  serverTime: number;
}

/**
 * Fetches token prices from PartyKit prices endpoint
 * @param tokens - Single contract ID or array of contract IDs
 * @returns Promise resolving to PriceResponse with prices array
 */
export async function getPrices(tokens: string | string[]): Promise<PriceResponse> {
  const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
  const tokensParam = tokenArray.join(',');

  // Use environment variable for base URL, fallback to localhost for development
  const baseUrl = process.env.PARTYKIT_URL || 'http://localhost:1999';
  const url = `${baseUrl}/parties/prices/main?tokens=${encodeURIComponent(tokensParam)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`PartyKit prices API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PriceResponse;
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch prices from PartyKit: ${error instanceof Error ? error.message : String(error)}`);
  }
}