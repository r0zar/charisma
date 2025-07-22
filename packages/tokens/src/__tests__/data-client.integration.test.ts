import { describe, it, expect, beforeAll } from 'vitest';
import {
  getAddressBalance,
  getAddressBalances,
  getCurrentPrices,
  getTokenPrice,
  getTokenPrices,
  getAddressPortfolio,
  getKnownAddresses,
  type ClientConfig
} from '../data-client';

// Test configuration - points to actual data API
const testConfig: ClientConfig = {
  timeout: 15000,
  retries: 2,
  baseUrl: 'http://localhost:3800/api/v1' // Adjust if your data API runs on different port
};

// Test addresses - using known Stacks addresses
const TEST_ADDRESSES = {
  CHARISMA_DEPLOYER: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  ALEX_DEPLOYER: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM',
  WELSH_DEPLOYER: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'
};

const TEST_TOKENS = {
  SBTC: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
  CHARISMA: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  ARKADIKO: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token',
  WELSH: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'
};

describe('Data Client Integration Tests', () => {
  // Check if data API is available before running tests
  beforeAll(async () => {
    try {
      const response = await fetch(`${testConfig.baseUrl?.replace('/api/v1', '')}/api/v1`);
      if (!response.ok) {
        throw new Error('Data API not available');
      }
    } catch (error) {
      console.warn('Data API not available, skipping integration tests');
      console.warn('Make sure the data app is running on http://localhost:3800');
      throw error;
    }
  }, 30000);

  describe('Balance Operations', () => {
    it('should get balance for a known address', async () => {
      const balance = await getAddressBalance(TEST_ADDRESSES.CHARISMA_DEPLOYER, testConfig);
      
      expect(balance).toBeDefined();
      expect(balance.address).toBe(TEST_ADDRESSES.CHARISMA_DEPLOYER);
      expect(balance.stxBalance).toBeDefined();
      expect(typeof balance.stxBalance).toBe('string');
      expect(balance.fungibleTokens).toBeDefined();
      expect(balance.nonFungibleTokens).toBeDefined();
      expect(balance.metadata).toBeDefined();
      expect(balance.metadata.tokenCount).toBeGreaterThanOrEqual(0);
      expect(balance.metadata.nftCount).toBeGreaterThanOrEqual(0);
      
      console.log(`✓ Balance for ${TEST_ADDRESSES.CHARISMA_DEPLOYER}:`, {
        stx: `${parseInt(balance.stxBalance) / 1000000} STX`,
        tokens: balance.metadata.tokenCount,
        nfts: balance.metadata.nftCount
      });
    }, 20000);

    it('should get balances for multiple addresses', async () => {
      const addresses = [TEST_ADDRESSES.CHARISMA_DEPLOYER, TEST_ADDRESSES.ALEX_DEPLOYER];
      const balances = await getAddressBalances(addresses, testConfig);
      
      expect(Object.keys(balances).length).toBeGreaterThan(0);
      
      for (const address of addresses) {
        if (balances[address]) {
          expect(balances[address].address).toBe(address);
          expect(balances[address].stxBalance).toBeDefined();
        }
      }
      
      console.log(`✓ Fetched balances for ${Object.keys(balances).length} addresses`);
    }, 30000);

    it('should get known addresses list', async () => {
      const addresses = await getKnownAddresses(testConfig);
      
      expect(Array.isArray(addresses)).toBe(true);
      expect(addresses.length).toBeGreaterThan(0);
      
      // Verify addresses are valid Stacks addresses
      addresses.slice(0, 5).forEach(address => {
        expect(address).toMatch(/^S[PTM][0-9A-Z]{39}$/);
      });
      
      console.log(`✓ Found ${addresses.length} known addresses`);
    }, 20000);
  });

  describe('Price Operations', () => {
    it('should get current prices', async () => {
      const prices = await getCurrentPrices(50, testConfig);
      
      expect(Array.isArray(prices)).toBe(true);
      expect(prices.length).toBeGreaterThan(0);
      
      // Check structure of first price
      const firstPrice = prices[0];
      expect(firstPrice.tokenId).toBeDefined();
      expect(firstPrice.symbol).toBeDefined();
      expect(typeof firstPrice.usdPrice).toBe('number');
      expect(firstPrice.usdPrice).toBeGreaterThan(0);
      expect(typeof firstPrice.confidence).toBe('number');
      expect(firstPrice.confidence).toBeGreaterThan(0);
      
      console.log(`✓ Fetched ${prices.length} current prices`);
      console.log(`✓ Sample price: ${firstPrice.symbol} = $${firstPrice.usdPrice}`);
    }, 20000);

    it('should get price for SBTC', async () => {
      const price = await getTokenPrice(TEST_TOKENS.SBTC, testConfig);
      
      expect(price).toBeDefined();
      expect(price.tokenId).toBe(TEST_TOKENS.SBTC);
      expect(price.symbol).toBe('sbtc-token');
      expect(typeof price.usdPrice).toBe('number');
      expect(price.usdPrice).toBeGreaterThan(0);
      
      console.log(`✓ SBTC price: $${price.usdPrice}`);
    }, 20000);

    it('should get prices for multiple tokens', async () => {
      const tokenIds = [TEST_TOKENS.SBTC, TEST_TOKENS.CHARISMA];
      const prices = await getTokenPrices(tokenIds, testConfig);
      
      expect(Object.keys(prices).length).toBeGreaterThan(0);
      
      if (prices[TEST_TOKENS.SBTC]) {
        expect(prices[TEST_TOKENS.SBTC].symbol).toBe('sbtc-token');
        expect(prices[TEST_TOKENS.SBTC].usdPrice).toBeGreaterThan(0);
      }
      
      console.log(`✓ Fetched prices for ${Object.keys(prices).length} tokens`);
    }, 25000);
  });

  describe('Composite Operations', () => {
    it('should get complete portfolio for an address', async () => {
      const portfolio = await getAddressPortfolio(TEST_ADDRESSES.CHARISMA_DEPLOYER, testConfig);
      
      expect(portfolio).toBeDefined();
      expect(portfolio.balance).toBeDefined();
      expect(portfolio.tokenPrices).toBeDefined();
      expect(portfolio.portfolioValue).toBeDefined();
      
      const { portfolioValue } = portfolio;
      expect(typeof portfolioValue.stxValue).toBe('number');
      expect(typeof portfolioValue.tokenValue).toBe('number');
      expect(typeof portfolioValue.totalValue).toBe('number');
      expect(portfolioValue.totalValue).toBe(portfolioValue.stxValue + portfolioValue.tokenValue);
      
      console.log(`✓ Portfolio for ${TEST_ADDRESSES.CHARISMA_DEPLOYER}:`, {
        stxValue: `$${portfolioValue.stxValue.toFixed(2)}`,
        tokenValue: `$${portfolioValue.tokenValue.toFixed(2)}`,
        totalValue: `$${portfolioValue.totalValue.toFixed(2)}`,
        tokensHeld: Object.keys(portfolio.balance.fungibleTokens).length
      });
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid address gracefully', async () => {
      await expect(getAddressBalance('invalid-address', testConfig))
        .rejects.toThrow('Invalid Stacks address format');
    });

    it('should handle non-existent token gracefully', async () => {
      await expect(getTokenPrice('SP000000000000000000000000000000000.non-existent', testConfig))
        .rejects.toThrow();
    });

    it('should handle timeout configuration', async () => {
      const shortTimeoutConfig = { ...testConfig, timeout: 1 }; // 1ms timeout
      
      await expect(getCurrentPrices(10, shortTimeoutConfig))
        .rejects.toThrow(/timeout|took longer than/i);
    }, 10000);
  });

  describe('Data Validation', () => {
    it('should validate balance data structure', async () => {
      const balance = await getAddressBalance(TEST_ADDRESSES.CHARISMA_DEPLOYER, testConfig);
      
      // Required fields
      expect(typeof balance.address).toBe('string');
      expect(typeof balance.lastUpdated).toBe('string');
      expect(typeof balance.source).toBe('string');
      expect(typeof balance.stxBalance).toBe('string');
      expect(typeof balance.fungibleTokens).toBe('object');
      expect(typeof balance.nonFungibleTokens).toBe('object');
      expect(typeof balance.metadata).toBe('object');
      
      // Metadata structure
      expect(typeof balance.metadata.tokenCount).toBe('number');
      expect(typeof balance.metadata.nftCount).toBe('number');
      expect(typeof balance.metadata.stxLocked).toBe('string');
      expect(typeof balance.metadata.stxTotalSent).toBe('string');
      expect(typeof balance.metadata.stxTotalReceived).toBe('string');
      
      // STX balance should be numeric string
      expect(balance.stxBalance).toMatch(/^\d+$/);
      
      console.log('✓ Balance data structure is valid');
    }, 20000);

    it('should validate price data structure', async () => {
      const prices = await getCurrentPrices(5, testConfig);
      
      for (const price of prices) {
        expect(typeof price.tokenId).toBe('string');
        expect(typeof price.symbol).toBe('string');
        expect(typeof price.usdPrice).toBe('number');
        expect(typeof price.confidence).toBe('number');
        expect(typeof price.lastUpdated).toBe('string');
        expect(typeof price.source).toBe('string');
        
        expect(price.usdPrice).toBeGreaterThan(0);
        expect(price.confidence).toBeGreaterThan(0);
        expect(price.confidence).toBeLessThanOrEqual(1);
      }
      
      console.log('✓ Price data structure is valid');
    }, 20000);
  });
});