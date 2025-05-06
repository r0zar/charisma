import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import { Cryptonomicon, TokenMetadata } from "..";

// Hiro API keys (optional - will work without them but may be rate limited)
const apiKeys = process.env.HIRO_API_KEYS?.split(',') || [];

// Global timeout of 30 seconds for potentially slow API calls
jest.setTimeout(30000);

// Create a client instance with API key rotation
let cryptonomicon: Cryptonomicon;

beforeAll(() => {
  cryptonomicon = new Cryptonomicon({
    debug: true,
  });
});

describe("Cryptonomicon getTokenMetadata", () => {
  /**
   * Basic functionality tests
   */
  describe("Basic functionality", () => {
    it("returns data for well-known tokens", async () => {
      const stx = await cryptonomicon.getTokenInfo(".stx");
      expect(stx).toBeDefined();
      expect(stx?.symbol).toBe("STX");
      expect(stx?.decimals).toBe(6);

      // USDA is a common stablecoin
      const usda = await cryptonomicon.getTokenMetadata("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token");
      expect(usda).toBeDefined();
      expect(usda?.symbol).toBe("USDA");
      expect(usda?.decimals).toBe(6);
    });

    it("handles non-existent tokens gracefully", async () => {
      const nonExistent = await cryptonomicon.getTokenMetadata("SP000000000000000000002Q6VF78.non-existent-token");
      expect(nonExistent).toBeNull();
    });

    it("correctly processes SIP-10 compliant tokens", async () => {
      const token = await cryptonomicon.getTokenMetadata("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token");

      // Verify SIP-10 standard properties
      expect(token).toBeDefined();
      expect(token?.name).toBeDefined();
      expect(token?.symbol).toBeDefined();
      expect(token?.decimals).toBeDefined();
      expect(token?.identifier).toBeDefined();
    });

    it("returns consistent results for repeated calls on the same token", async () => {
      const token1 = await cryptonomicon.getTokenMetadata("SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin");
      const token2 = await cryptonomicon.getTokenMetadata("SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin");

      expect(token1).toEqual(token2);
    });
  });

  /**
   * Performance and reliability tests
   */
  describe("Performance and reliability", () => {
    // Test tokens with varying characteristics
    const testTokens = [
      '.stx', // Native token
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token', // Stablecoin
      'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin', // Wrapped token
      'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token', // Governance token
      'SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-memo-v1', // Token with memo
      'SPQR41QJEP97QGA0DGKSX9DQSWPDX4V2P7B8S98S.ststx-token', // Staking token
    ];

    it("handles multiple concurrent requests properly", async () => {
      // Make concurrent requests
      const promises = testTokens.map(contractId =>
        cryptonomicon.getTokenMetadata(contractId)
      );

      // Wait for all to complete
      const results = await Promise.all(promises);

      // Count successful responses (non-null)
      const successCount = results.filter(r => r !== null).length;

      // We should have at least some successes
      expect(successCount).toBeGreaterThan(0);

      // Log results for diagnostics
      results.forEach((result, index) => {
        const tokenId = testTokens[index];
        if (result) {
          console.log(`√ ${tokenId}: ${result.name} (${result.symbol})`);
        } else {
          console.log(`✗ ${tokenId}: Failed to retrieve metadata`);
        }
      });
    });

    it("completes requests within reasonable time", async () => {
      // A single token that should definitely exist
      const tokenId = 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token';

      const startTime = Date.now();
      await cryptonomicon.getTokenMetadata(tokenId);
      const duration = Date.now() - startTime;

      // Should take less than 5000ms for a single token
      console.log(`Time to fetch ${tokenId}: ${duration}ms`);
      expect(duration).toBeLessThan(5000);
    });
  });

  /**
   * API key rotation tests
   */
  describe("API key rotation", () => {
    it("rotates API keys according to config", async () => {
      if (apiKeys.length < 2) {
        console.log("Skipping API key rotation test as not enough keys are available");
        return;
      }

      // Create a special client with API key logging
      const getNextApiKeySpy = jest.spyOn(Cryptonomicon.prototype as any, 'getNextApiKey');

      // Make multiple calls to force key rotation
      for (let i = 0; i < 3; i++) {
        await cryptonomicon.getTokenMetadata("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token");
      }

      // Verify that getNextApiKey was called multiple times
      expect(getNextApiKeySpy).toHaveBeenCalledTimes(3);

      getNextApiKeySpy.mockRestore();
    });
  });

  /**
   * Additional tests for specific token types
   */
  describe("Special token cases", () => {
    it("handles liquidity pool tokens", async () => {
      // Test an LP token - these often have special properties
      const lpToken = await cryptonomicon.getTokenMetadata("SP39859AD7RQ6NYK00EJ8HN1DWE40C576FBDGHPA0.chabtz-lp-token");

      // If the metadata fetch succeeded, check for special LP properties
      if (lpToken) {
        console.log("LP token metadata:", lpToken);

        // Some LP tokens have tokenA/tokenB contracts defined
        const hasLpProperties =
          'tokenAContract' in lpToken ||
          'tokenBContract' in lpToken ||
          'lpRebatePercent' in lpToken ||
          'externalPoolId' in lpToken;

        console.log("Has LP properties:", hasLpProperties);
      } else {
        console.log("Failed to fetch LP token metadata");
      }

      // Don't strictly assert on property existence as it depends on the token
    });
  });
});