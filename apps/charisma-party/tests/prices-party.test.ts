/// <reference path="./test-utils.d.ts" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TestUtils } from './test-utils';
import { listPrices } from '@repo/tokens';
import PricesParty from '../src/parties/prices';

// Mock the @repo/tokens module
vi.mocked(listPrices).mockResolvedValue({
  'SP000000000000000000002Q6VF78.test-token': 1.5,
  '.stx': 2.0
});

describe('PricesParty - Baseline Coverage', () => {
  let mockRoom: any;
  let mockConnection: any;
  let pricesParty: PricesParty;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoom = TEST_UTILS.createMockRoom('prices-room');
    mockConnection = TEST_UTILS.createMockConnection('test-client');

    // Mock getConnection to return our mock connection
    mockRoom.getConnection.mockReturnValue(mockConnection);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('1a. PricesParty Constructor Initialization', () => {
    it('should initialize PricesParty with correct room ID', () => {
      // RED: This test should fail initially
      pricesParty = new PricesParty(mockRoom);

      expect(pricesParty).toBeDefined();
      expect(pricesParty.room).toBe(mockRoom);
    });

    it('should detect local development environment correctly', () => {
      // RED: Test environment detection
      process.env.NODE_ENV = 'test';
      pricesParty = new PricesParty(mockRoom);

      // In test environment, should not set up production alarms
      expect(mockRoom.storage.setAlarm).not.toHaveBeenCalled();
    });

    it('should initialize empty subscription and price maps', () => {
      pricesParty = new PricesParty(mockRoom);

      // Test internal state (we'll need to expose these for testing)
      expect(pricesParty['subscriptions']).toBeDefined();
      expect(pricesParty['latestPrices']).toBeDefined();
      expect(pricesParty['watchedTokens']).toBeDefined();
    });
  });

  describe('1b. Price Subscription Message Handling', () => {
    beforeEach(() => {
      pricesParty = new PricesParty(mockRoom);
      // Establish connection first
      pricesParty.onConnect(mockConnection, {} as any);
      vi.clearAllMocks(); // Clear connection setup calls
    });

    it('should handle SUBSCRIBE message for all prices', () => {
      // RED: Test subscription to all prices
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        contractIds: [],
        clientId: 'test-client'
      };

      pricesParty.onMessage(JSON.stringify(subscribeMessage), mockConnection);

      // Should set subscription to subscribeToAll = true
      const subscription = pricesParty['subscriptions'].get('test-client');
      expect(subscription?.subscribeToAll).toBe(true);
    });

    it('should handle SUBSCRIBE message for specific contract IDs', () => {
      // RED: Test specific contract subscription
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        contractIds: ['SP000000000000000000002Q6VF78.test-token', '.stx'],
        clientId: 'test-client'
      };

      pricesParty.onMessage(JSON.stringify(subscribeMessage), mockConnection);

      // Should validate contract IDs and send response
      expect(mockConnection.send).toHaveBeenCalled();
    });

    it('should reject invalid contract ID format', () => {
      // RED: Test invalid contract ID validation
      const subscribeMessage = {
        type: 'SUBSCRIBE',
        contractIds: ['invalid-contract-id'],
        clientId: 'test-client'
      };

      pricesParty.onMessage(JSON.stringify(subscribeMessage), mockConnection);

      // Should send error message for invalid contract ID
      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
    });

    it('should handle UNSUBSCRIBE message', () => {
      // RED: Test unsubscription
      const unsubscribeMessage = {
        type: 'UNSUBSCRIBE',
        contractIds: ['SP000000000000000000002Q6VF78.test-token'],
        clientId: 'test-client'
      };

      pricesParty.onMessage(JSON.stringify(unsubscribeMessage), mockConnection);

      // Should still have the subscription (subscription exists but tokens removed)
      expect(pricesParty['subscriptions'].get('test-client')).toBeDefined();
    });

    it('should handle PING message with PONG response', () => {
      // RED: Test ping-pong mechanism
      const pingMessage = {
        type: 'PING',
        timestamp: Date.now()
      };

      pricesParty.onMessage(JSON.stringify(pingMessage), mockConnection);

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.stringContaining('PONG')
      );
    });

    it('should handle invalid JSON message gracefully', () => {
      // RED: Test error handling for malformed messages
      pricesParty.onMessage('invalid-json', mockConnection);

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
    });
  });

  describe('1c. Price Update Broadcasting', () => {
    beforeEach(() => {
      pricesParty = new PricesParty(mockRoom);
    });

    it('should fetch and broadcast price updates', async () => {
      // RED: Test price fetching and broadcasting
      await pricesParty['fetchAndBroadcastPrices']();

      expect(listPrices).toHaveBeenCalled();
      expect(mockRoom.broadcast).toHaveBeenCalled();
    });

    it('should only broadcast changed prices', async () => {
      // RED: Test price change detection
      // First fetch
      await pricesParty['fetchAndBroadcastPrices']();

      const firstCallCount = mockRoom.broadcast.mock.calls.length;

      // Second fetch with same prices
      await pricesParty['fetchAndBroadcastPrices']();

      // Should not broadcast unchanged prices
      expect(mockRoom.broadcast).toHaveBeenCalledTimes(firstCallCount);
    });

    it('should handle price fetch errors gracefully', async () => {
      // RED: Test error handling during price fetch
      vi.mocked(listPrices).mockRejectedValueOnce(new Error('API Error'));

      await pricesParty['fetchAndBroadcastPrices']();

      // Should not crash and should log error
      expect(console.error).toHaveBeenCalled();
    });

    it('should validate price data types', async () => {
      // RED: Test price data validation
      vi.mocked(listPrices).mockResolvedValueOnce({
        'SP000000000000000000002Q6VF78.test-token': NaN,
        '.stx': 'invalid-price' as any
      });

      await pricesParty['fetchAndBroadcastPrices']();

      // Should skip invalid prices and log warnings
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('1d. Price Noise Generation (Local Dev)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      pricesParty = new PricesParty(mockRoom);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start noise interval in local development', () => {
      // RED: Test noise interval setup
      expect(pricesParty['noiseInterval']).toBeDefined();
    });

    it('should add price noise to existing prices', async () => {
      // RED: Test price noise generation
      // First add some prices
      await pricesParty['fetchAndBroadcastPrices']();

      const originalBroadcastCount = mockRoom.broadcast.mock.calls.length;

      // Trigger noise generation
      vi.advanceTimersByTime(1000);

      // Should broadcast noise updates
      expect(mockRoom.broadcast.mock.calls.length).toBeGreaterThan(originalBroadcastCount);
    });

    it('should not generate noise when no prices exist', () => {
      // RED: Test noise generation with empty price map
      vi.advanceTimersByTime(1000);

      // Should not broadcast anything
      expect(mockRoom.broadcast).not.toHaveBeenCalled();
    });

    it('should stop noise interval when no connections remain', () => {
      // RED: Test noise interval cleanup
      // First connect, then disconnect
      pricesParty.onConnect(mockConnection, {} as any);
      pricesParty.onClose(mockConnection);

      // Should clear intervals when no connections
      expect(pricesParty['noiseInterval']).toBeNull();
    });
  });

  describe('Connection Lifecycle', () => {
    beforeEach(() => {
      pricesParty = new PricesParty(mockRoom);
    });

    it('should handle client connection with initial price batch', () => {
      // RED: Test connection handling
      pricesParty.onConnect(mockConnection, {} as any);

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.stringContaining('SERVER_INFO')
      );
    });

    it('should send existing prices to new connections', async () => {
      // RED: Test initial price delivery
      // First fetch some prices
      await pricesParty['fetchAndBroadcastPrices']();

      // Then connect a client
      pricesParty.onConnect(mockConnection, {} as any);

      expect(mockConnection.send).toHaveBeenCalledWith(
        expect.stringContaining('PRICE_BATCH')
      );
    });

    it('should clean up subscriptions on disconnect', () => {
      // RED: Test cleanup on disconnect
      pricesParty.onConnect(mockConnection, {} as any);
      pricesParty.onClose(mockConnection);

      expect(pricesParty['subscriptions'].has('test-client')).toBe(false);
    });
  });

  describe('HTTP Request Handling', () => {
    beforeEach(() => {
      pricesParty = new PricesParty(mockRoom);
    });

    it('should handle GET request for all prices', () => {
      // RED: Test GET endpoint
      const request = TEST_UTILS.createMockRequest('http://localhost/prices');
      const response = pricesParty.onRequest(request as any);

      expect(response).toBeInstanceOf(Promise);
    });

    it('should handle GET request for specific tokens', () => {
      // RED: Test GET with token filter
      const request = TEST_UTILS.createMockRequest('http://localhost/prices?tokens=SP000000000000000000002Q6VF78.test-token,.stx');
      const response = pricesParty.onRequest(request as any);

      expect(response).toBeInstanceOf(Promise);
    });

    it('should handle POST request to trigger manual update', () => {
      // RED: Test POST endpoint
      const request = TEST_UTILS.createMockRequest('http://localhost/prices', { method: 'POST' });
      const response = pricesParty.onRequest(request as any);

      expect(response).toBeInstanceOf(Response);
    });

    it('should reject unsupported HTTP methods', () => {
      // RED: Test method validation
      const request = TEST_UTILS.createMockRequest('http://localhost/prices', { method: 'DELETE' });
      const response = pricesParty.onRequest(request as any);

      expect(response).toBeInstanceOf(Response);
    });
  });
});