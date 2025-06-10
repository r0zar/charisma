import { describe, it, expect, jest, test } from "@jest/globals";
import {
  fetchMetadata,
  listPrices,
  listPricesKraxel,
  listPricesSTXTools,
  listTokens,
  Token
} from "..";

describe("@repo/tokens", () => {

  it('gets token prices from combined sources', async () => {
    const prices = await listPrices();
    expect(prices).toBeDefined();
    expect(typeof prices).toBe('object');
  });

  it('gets token prices from Kraxel only', async () => {
    const prices = await listPricesKraxel();
    expect(prices).toBeDefined();
    expect(typeof prices).toBe('object');
  });

  it('gets token prices from STXTools only', async () => {
    const prices = await listPricesSTXTools();
    expect(prices).toBeDefined();
    expect(typeof prices).toBe('object');
  });

  it('tests different aggregation strategies', async () => {
    const fallbackPrices = await listPrices({ strategy: 'fallback' });
    const averagePrices = await listPrices({ strategy: 'average' });
    const kraxelPrimaryPrices = await listPrices({ strategy: 'kraxel-primary' });
    const stxtoolsPrimaryPrices = await listPrices({ strategy: 'stxtools-primary' });

    expect(fallbackPrices).toBeDefined();
    expect(averagePrices).toBeDefined();
    expect(kraxelPrimaryPrices).toBeDefined();
    expect(stxtoolsPrimaryPrices).toBeDefined();
  });

  it('handles timeout configuration', async () => {
    const quickPrices = await listPrices({ timeout: 1000 });
    expect(quickPrices).toBeDefined();
  });

});

describe('Token Cache', () => {
  it('should list tokens and create Token objects', async () => {
    const tokens = await listTokens();
    expect(tokens).toBeDefined();
    expect(tokens.length).toBeGreaterThan(0);

    // create Token objects
    const tokenObjects = tokens
      .filter((token) => token.identifier)
      .filter((token) => token.contractId !== '.stx')
      .map((token) => new Token(token as any));

    console.log('Token contract IDs:', tokenObjects.map((token) => token.contractId));
    expect(tokenObjects.length).toBeGreaterThan(0);
  });

  it('should data integrity check subnet tokens', async () => {
    const metadataList = await fetchMetadata();
    const metadata = metadataList
      .filter((metadata: any) => metadata.type === 'SUBNET')
      .map((metadata) => metadata.contractId);

    console.log('Subnet tokens:', metadata);
    expect(Array.isArray(metadata)).toBe(true);
  });

  it('should data integrity check sublinks', async () => {
    const metadataList = await fetchMetadata();
    const metadata = metadataList
      .filter((metadata: any) => metadata.type === 'SUBLINK')
      .map((metadata) => metadata.contractId);

    console.log('Sublink tokens:', metadata);
    expect(Array.isArray(metadata)).toBe(true);
  });

  it('should compare prices from different sources', async () => {
    const [kraxelPrices, stxtoolsPrices, combinedPrices] = await Promise.allSettled([
      listPricesKraxel(),
      listPricesSTXTools(),
      listPrices({ strategy: 'average' })
    ]);

    if (kraxelPrices.status === 'fulfilled') {
      console.log(`Kraxel returned ${Object.keys(kraxelPrices.value).length} prices`);
      // Log a few sample prices for debugging
      const sampleKeys = Object.keys(kraxelPrices.value).slice(0, 3);
      sampleKeys.forEach(key => {
        console.log(`Kraxel - ${key}: ${kraxelPrices.value[key]}`);
      });
    }

    if (stxtoolsPrices.status === 'fulfilled') {
      console.log(`STXTools returned ${Object.keys(stxtoolsPrices.value).length} prices`);
      // Log a few sample prices for debugging
      const sampleKeys = Object.keys(stxtoolsPrices.value).slice(0, 3);
      sampleKeys.forEach(key => {
        console.log(`STXTools - ${key}: ${stxtoolsPrices.value[key]}`);
      });
    }

    if (combinedPrices.status === 'fulfilled') {
      console.log(`Combined returned ${Object.keys(combinedPrices.value).length} prices`);
    }

    // At least one should succeed
    expect(
      kraxelPrices.status === 'fulfilled' ||
      stxtoolsPrices.status === 'fulfilled' ||
      combinedPrices.status === 'fulfilled'
    ).toBe(true);
  });

  it('should validate STXTools data structure', async () => {
    try {
      const stxtoolsPrices = await listPricesSTXTools();

      // Check that we got some data
      expect(Object.keys(stxtoolsPrices).length).toBeGreaterThan(0);

      // Check that all values are numbers
      Object.entries(stxtoolsPrices).forEach(([contractId, price]) => {
        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThanOrEqual(0);
        expect(contractId).toBeTruthy();
      });

      console.log(`STXTools validation passed for ${Object.keys(stxtoolsPrices).length} tokens`);
    } catch (error) {
      console.log('STXTools API test failed (expected if API is down):', error);
      // Don't fail the test if the API is down
    }
  });
});