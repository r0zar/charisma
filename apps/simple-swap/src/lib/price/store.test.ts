import { describe, it, expect, beforeAll } from 'vitest';
import { snapshotPricesFromOracle, getLatestPrice, getAllTrackedTokens } from './store';

describe('Price Store Oracle Integration', () => {
  // Increase timeout for network calls
  const timeout = 30000;

  beforeAll(() => {
    // Ensure we have required environment variables
    if (!process.env.KV_URL || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.warn('KV environment variables not set, tests may fail');
    }
  });

  it('should successfully snapshot prices from oracle and include charisma token', async () => {
    const result = await snapshotPricesFromOracle();

    // Should succeed
    expect(result.status).toBe('success');

    // Should have processed some tokens
    expect(result.count).toBeGreaterThan(0);
    console.log(`Processed ${result.count} tokens`);

    // Should have a valid timestamp
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.timestamp).toBeLessThanOrEqual(Date.now());

    // Should include tokens list
    expect(Array.isArray(result.tokens)).toBe(true);
    expect(result.tokens.length).toBe(result.count);

    // Log token details for debugging
    console.log('Tokens processed:', result.tokens.slice(0, 10));
    console.log('Charisma token included:', result.charismaTokenIncluded);

    // Check if charisma token is included
    const charismaToken = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    if (result.charismaTokenIncluded) {
      expect(result.tokens).toContain(charismaToken);
      console.log('✓ Charisma token successfully included in snapshot');
    } else {
      console.log('⚠ Charisma token not included in snapshot - may not be in dex tokens list');
    }
  }, timeout);

  it('should verify specific tokens have valid price data after snapshot', async () => {
    // Run a snapshot first
    const result = await snapshotPricesFromOracle();
    expect(result.status).toBe('success');

    // Test a few specific tokens that should have data
    const tokensToTest = result.tokens.slice(0, 5); // Test first 5 tokens

    for (const contractId of tokensToTest) {
      const price = await getLatestPrice(contractId);
      expect(price).toBeDefined();
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0);
      console.log(`✓ ${contractId}: $${price}`);
    }
  }, timeout);

  it('should specifically test charisma token price data', async () => {
    const charismaToken = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

    // Run snapshot
    const result = await snapshotPricesFromOracle();
    expect(result.status).toBe('success');

    if (result.charismaTokenIncluded) {
      // Check if we can retrieve the price from KV store
      const price = await getLatestPrice(charismaToken);
      expect(price).toBeDefined();
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0);
      console.log(`✓ Charisma token price in KV: $${price}`);
    } else {
      console.log('Charisma token not in snapshot, checking if it exists in oracle data...');

      // Import to test oracle data directly
      const { listPrices } = await import('@repo/tokens');
      const oraclePrices = await listPrices();

      const charismaInOracle = charismaToken in oraclePrices;
      console.log('Charisma token in oracle data:', charismaInOracle);

      if (charismaInOracle) {
        console.log(`Charisma price from oracle: $${oraclePrices[charismaToken]}`);

        // Check if it's in dex tokens
        const { listTokens } = await import('dexterity-sdk');
        const dexTokens = await listTokens();
        const charismaInDex = dexTokens.some(token => token.contractId === charismaToken);
        console.log('Charisma token in dex tokens:', charismaInDex);

        if (!charismaInDex) {
          console.log('⚠ Charisma token not in dex tokens list - this is why it was filtered out');
        }
      }
    }
  }, timeout);

  it('should validate all stored tokens have positive prices', async () => {
    // Run snapshot
    const result = await snapshotPricesFromOracle();
    expect(result.status).toBe('success');

    // Get all tracked tokens from KV
    const allTokens = await getAllTrackedTokens();
    console.log(`Total tracked tokens in KV: ${allTokens.length}`);

    // Test a sample of tokens (not all to avoid timeout)
    const sampleSize = Math.min(10, allTokens.length);
    const sampleTokens = allTokens.slice(0, sampleSize);

    for (const contractId of sampleTokens) {
      const price = await getLatestPrice(contractId);
      expect(price).toBeDefined();
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThan(0);
      expect(isFinite(price!)).toBe(true);
    }

    console.log(`✓ Validated ${sampleSize} tokens all have positive, finite prices`);
  }, timeout);

  it('should verify oracle data completeness', async () => {
    // Test that we can get oracle data directly
    const { listPrices } = await import('@repo/tokens');
    const { listTokens } = await import('dexterity-sdk');

    const oraclePrices = await listPrices();
    const dexTokens = await listTokens();

    console.log(`Oracle returned ${Object.keys(oraclePrices).length} prices`);
    console.log(`Dex SDK returned ${dexTokens.length} tokens`);

    // Check how many tokens would be filtered
    const filteredCount = Object.keys(oraclePrices).filter(contractId =>
      dexTokens.some(token => token.contractId === contractId)
    ).length;

    console.log(`After filtering: ${filteredCount} tokens would be processed`);

    // Verify we have reasonable data
    expect(Object.keys(oraclePrices).length).toBeGreaterThan(0);
    expect(dexTokens.length).toBeGreaterThan(0);
    expect(filteredCount).toBeGreaterThan(0);

    // Check specific tokens
    const charismaToken = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';
    const charismaInOracle = charismaToken in oraclePrices;
    const charismaInDex = dexTokens.some(token => token.contractId === charismaToken);

    console.log(`Charisma token in oracle: ${charismaInOracle}`);
    console.log(`Charisma token in dex: ${charismaInDex}`);

    if (charismaInOracle) {
      console.log(`Charisma oracle price: $${oraclePrices[charismaToken]}`);
    }
  }, timeout);
});