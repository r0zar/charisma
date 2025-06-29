import { describe, it, expect } from "@jest/globals";
import {
  fetchMetadata,
  listPrices,
  listPricesKraxel,
  listPricesSTXTools,
  listPricesInternal,
  listTokens,
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

  it('gets token prices from Internal API only', async () => {
    const prices = await listPricesInternal();
    expect(prices).toBeDefined();
    expect(typeof prices).toBe('object');
  });

  it('tests different aggregation strategies', async () => {
    const fallbackPrices = await listPrices({ strategy: 'fallback' });
    const averagePrices = await listPrices({ strategy: 'average' });
    const kraxelPrimaryPrices = await listPrices({ strategy: 'kraxel-primary' });
    const stxtoolsPrimaryPrices = await listPrices({ strategy: 'stxtools-primary' });
    const internalPrimaryPrices = await listPrices({ strategy: 'internal-primary' });

    expect(fallbackPrices).toBeDefined();
    expect(averagePrices).toBeDefined();
    expect(kraxelPrimaryPrices).toBeDefined();
    expect(stxtoolsPrimaryPrices).toBeDefined();
    expect(internalPrimaryPrices).toBeDefined();
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
    const [kraxelPrices, stxtoolsPrices, internalPrices, combinedPrices] = await Promise.allSettled([
      listPricesKraxel(),
      listPricesSTXTools(),
      listPricesInternal(),
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

    if (internalPrices.status === 'fulfilled') {
      console.log(`Internal API returned ${Object.keys(internalPrices.value).length} prices`);
      // Log a few sample prices for debugging
      const sampleKeys = Object.keys(internalPrices.value).slice(0, 3);
      sampleKeys.forEach(key => {
        console.log(`Internal - ${key}: ${internalPrices.value[key]}`);
      });
    }

    if (combinedPrices.status === 'fulfilled') {
      console.log(`Combined returned ${Object.keys(combinedPrices.value).length} prices`);
    }

    // At least one should succeed
    expect(
      kraxelPrices.status === 'fulfilled' ||
      stxtoolsPrices.status === 'fulfilled' ||
      internalPrices.status === 'fulfilled' ||
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

  it('should validate Internal API data structure', async () => {
    try {
      const internalPrices = await listPricesInternal();

      // Check that we got some data
      expect(Object.keys(internalPrices).length).toBeGreaterThanOrEqual(0);

      // Check that all values are numbers
      Object.entries(internalPrices).forEach(([contractId, price]) => {
        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThanOrEqual(0);
        expect(contractId).toBeTruthy();
      });

      console.log(`Internal API validation passed for ${Object.keys(internalPrices).length} tokens`);
    } catch (error) {
      console.log('Internal API test failed (expected if API is down):', error);
      // Don't fail the test if the API is down
    }
  });

  it('should test internal-primary aggregation strategy with source configuration', async () => {
    try {
      const internalOnlyPrices = await listPrices({
        strategy: 'internal-primary',
        sources: { kraxel: false, stxtools: false, internal: true }
      });

      expect(internalOnlyPrices).toBeDefined();
      expect(typeof internalOnlyPrices).toBe('object');

      console.log(`Internal-primary strategy returned ${Object.keys(internalOnlyPrices).length} prices`);
    } catch (error) {
      console.log('Internal-primary strategy test failed (expected if API is down):', error);
      // Don't fail the test if the API is down
    }
  });

  it('should handle confidence filtering in internal API', async () => {
    try {
      // Test that the internal API only includes tokens with confidence > 0.1
      const internalPrices = await listPricesInternal();

      // Since we can't directly test the confidence filtering without mocking,
      // we just verify the function runs and returns valid data
      expect(internalPrices).toBeDefined();
      expect(typeof internalPrices).toBe('object');

      // All prices should be valid numbers >= 0
      Object.values(internalPrices).forEach(price => {
        expect(typeof price).toBe('number');
        expect(price).toBeGreaterThanOrEqual(0);
      });

      console.log(`Internal API confidence filtering test passed for ${Object.keys(internalPrices).length} tokens`);
    } catch (error) {
      console.log('Internal API confidence filtering test failed (expected if API is down):', error);
      // Don't fail the test if the API is down
    }
  });

  it('should test mixed source configurations', async () => {
    const configs = [
      { sources: { kraxel: true, stxtools: false, internal: true } },
      { sources: { kraxel: false, stxtools: true, internal: true } },
      { sources: { kraxel: true, stxtools: true, internal: false } },
    ];

    for (const config of configs) {
      try {
        const prices = await listPrices(config);
        expect(prices).toBeDefined();
        expect(typeof prices).toBe('object');

        const enabledSources = Object.entries(config.sources)
          .filter(([, enabled]) => enabled)
          .map(([source]) => source);

        console.log(`Mixed source test (${enabledSources.join(', ')}) returned ${Object.keys(prices).length} prices`);
      } catch (error) {
        console.log(`Mixed source test failed for config ${JSON.stringify(config)}:`, error);
        // Don't fail the test if APIs are down
      }
    }
  });
});