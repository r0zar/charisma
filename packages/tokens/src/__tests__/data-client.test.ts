import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAddressBalance,
  getAddressBalances,
  getCurrentPrices,
  getTokenPrice,
  getTokenPrices,
  getAddressPortfolio,
  type BalanceData,
  type PriceData,
  type BalanceResponse
} from '../data-client';

// Mock the discovery module
vi.mock('@modules/discovery', () => ({
  getHostUrl: vi.fn(() => 'http://localhost:3800')
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Data Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAddressBalance', () => {
    it('should fetch balance for valid address', async () => {
      const mockBalance: BalanceData = {
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        lastUpdated: '2024-01-01T00:00:00Z',
        source: 'test',
        stxBalance: '1000000',
        fungibleTokens: {
          'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
            balance: '1000000000'
          }
        },
        nonFungibleTokens: {},
        metadata: {
          cacheSource: 'test',
          tokenCount: 1,
          nftCount: 0,
          stxLocked: '0',
          stxTotalSent: '0',
          stxTotalReceived: '1000000'
        }
      };

      const mockResponse: BalanceResponse = {
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        balance: mockBalance,
        meta: {
          timestamp: '2024-01-01T00:00:00Z',
          processingTime: '10ms',
          source: 'test',
          cached: true
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await getAddressBalance('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3800/api/v1/balances/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        expect.objectContaining({
          headers: { 'Accept': 'application/json' }
        })
      );
      expect(result).toEqual(mockBalance);
    });

    it('should throw error for invalid address', async () => {
      await expect(getAddressBalance('invalid-address')).rejects.toThrow('Invalid Stacks address format');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({})
      } as Response);

      await expect(getAddressBalance('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS')).rejects.toThrow('HTTP 404: Not Found');
    }, 10000);
  });

  describe('getAddressBalances', () => {
    it('should fetch balances for multiple addresses', async () => {
      const addresses = [
        'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G'
      ];

      const mockBalances = addresses.map(address => ({
        address,
        lastUpdated: '2024-01-01T00:00:00Z',
        source: 'test',
        stxBalance: '1000000',
        fungibleTokens: {},
        nonFungibleTokens: {},
        metadata: {
          cacheSource: 'test',
          tokenCount: 0,
          nftCount: 0,
          stxLocked: '0',
          stxTotalSent: '0',
          stxTotalReceived: '1000000'
        }
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ balance: mockBalances[0] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ balance: mockBalances[1] })
        });

      const result = await getAddressBalances(addresses);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[addresses[0]]).toEqual(mockBalances[0]);
      expect(result[addresses[1]]).toEqual(mockBalances[1]);
    });

    it('should return empty object for empty address list', async () => {
      const result = await getAddressBalances([]);
      expect(result).toEqual({});
    });
  });

  describe('getCurrentPrices', () => {
    it('should fetch current prices', async () => {
      const mockPrices: PriceData[] = [
        {
          tokenId: '.stx',
          symbol: 'STX',
          usdPrice: 2.5,
          confidence: 1.0,
          lastUpdated: '2024-01-01T00:00:00Z',
          source: 'test'
        },
        {
          tokenId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
          symbol: 'CHA',
          usdPrice: 0.01,
          confidence: 0.8,
          lastUpdated: '2024-01-01T00:00:00Z',
          source: 'test'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          data: mockPrices,
          meta: {
            timestamp: '2024-01-01T00:00:00Z',
            processingTime: '10ms',
            total: 2,
            limit: 100
          }
        })
      });

      const result = await getCurrentPrices();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3800/api/v1/prices/current?limit=100',
        expect.objectContaining({
          headers: { 'Accept': 'application/json' }
        })
      );
      expect(result).toEqual(mockPrices);
    });
  });

  describe('getTokenPrice', () => {
    it('should fetch price for specific token', async () => {
      const mockPrice: PriceData = {
        tokenId: '.stx',
        symbol: 'STX',
        usdPrice: 2.5,
        confidence: 1.0,
        lastUpdated: '2024-01-01T00:00:00Z',
        source: 'test'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ price: mockPrice })
      });

      const result = await getTokenPrice('.stx');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3800/api/v1/prices/current/.stx',
        expect.objectContaining({
          headers: { 'Accept': 'application/json' }
        })
      );
      expect(result).toEqual(mockPrice);
    });

    it('should throw error for empty contract ID', async () => {
      await expect(getTokenPrice('')).rejects.toThrow('Contract ID is required');
    });
  });

  describe('getTokenPrices', () => {
    it('should fetch prices for multiple tokens', async () => {
      const contractIds = ['.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'];
      
      const mockPrices = contractIds.map(tokenId => ({
        tokenId,
        symbol: tokenId === '.stx' ? 'STX' : 'CHA',
        usdPrice: tokenId === '.stx' ? 2.5 : 0.01,
        confidence: 1.0,
        lastUpdated: '2024-01-01T00:00:00Z',
        source: 'test'
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: mockPrices[0] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: mockPrices[1] })
        });

      const result = await getTokenPrices(contractIds);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result[contractIds[0]]).toEqual(mockPrices[0]);
      expect(result[contractIds[1]]).toEqual(mockPrices[1]);
    });
  });

  describe('getAddressPortfolio', () => {
    it('should calculate portfolio value correctly', async () => {
      const mockBalance: BalanceData = {
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
        lastUpdated: '2024-01-01T00:00:00Z',
        source: 'test',
        stxBalance: '2000000', // 2 STX
        fungibleTokens: {
          'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token': {
            balance: '1000000000', // 1000 CHA (6 decimals)
            decimals: 6
          }
        },
        nonFungibleTokens: {},
        metadata: {
          cacheSource: 'test',
          tokenCount: 1,
          nftCount: 0,
          stxLocked: '0',
          stxTotalSent: '0',
          stxTotalReceived: '2000000'
        }
      };

      const mockPrices = [
        {
          tokenId: '.stx',
          symbol: 'STX',
          usdPrice: 2.5,
          confidence: 1.0,
          lastUpdated: '2024-01-01T00:00:00Z',
          source: 'test'
        },
        {
          tokenId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
          symbol: 'CHA',
          usdPrice: 0.01,
          confidence: 0.8,
          lastUpdated: '2024-01-01T00:00:00Z',
          source: 'test'
        }
      ];

      // Mock balance fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ balance: mockBalance })
      });

      // Mock price fetches
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: mockPrices[0] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: mockPrices[1] })
        });

      const result = await getAddressPortfolio('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS');

      expect(result.balance).toEqual(mockBalance);
      expect(result.portfolioValue.stxValue).toBe(5.0); // 2 STX * $2.5
      expect(result.portfolioValue.tokenValue).toBe(10.0); // 1000 CHA * $0.01
      expect(result.portfolioValue.totalValue).toBe(15.0);
    });
  });
});