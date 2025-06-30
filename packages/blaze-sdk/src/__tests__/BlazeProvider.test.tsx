/**
 * BlazeProvider Tests - Client-Side Token Merging
 * 
 * These tests target the new client-side merging approach where the server
 * sends separate balance messages for mainnet and subnet tokens, and the
 * BlazeProvider merges them under the same base contract ID.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { BlazeProvider, useBlaze } from '../realtime/providers/BlazeProvider';

// Mock partysocket/react
const mockSend = jest.fn();
const mockClose = jest.fn();
const mockSocketInstances: any[] = [];

jest.mock('partysocket/react', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ onOpen, onMessage, onClose, party }) => {
    const instance = {
      send: mockSend,
      close: mockClose,
      readyState: 1, // WebSocket.OPEN
      party,
      onMessage
    };
    
    mockSocketInstances.push(instance);
    
    // Simulate connection opening
    setTimeout(() => onOpen?.(), 0);
    
    return instance;
  })
}));

// Test component that uses the BlazeProvider
function TestComponent({ userId, contractId }: { userId?: string; contractId?: string }) {
  const { balances, getBalance, getUserBalances, isConnected, lastUpdate } = useBlaze({ userId });
  
  const targetContract = contractId || 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.test-token';
  
  return (
    <div data-testid="test-component">
      <span data-testid="connected">{isConnected.toString()}</span>
      <span data-testid="last-update">{lastUpdate}</span>
      <span data-testid="balances-count">{Object.keys(balances).length}</span>
      {userId && (
        <>
          <span data-testid="user-balances-count">{Object.keys(getUserBalances(userId)).length}</span>
          <span data-testid="specific-balance">
            {JSON.stringify(getBalance(userId, targetContract))}
          </span>
        </>
      )}
    </div>
  );
}

describe('BlazeProvider - Client-Side Token Merging', () => {
  const testUserId = 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKJ3';
  const baseContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.test-token';
  const subnetContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.test-token-subnet-v1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketInstances.length = 0;
  });

  describe('Separate Token Messages - Server sends individual messages', () => {
    it('should merge separate mainnet and subnet balance messages', async () => {
      const { getByTestId } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} />
        </BlazeProvider>
      );

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      // First: Send mainnet balance
      const mainnetBalanceUpdate = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: baseContractId,
        balance: 1000000,
        totalSent: '500000',
        totalReceived: '1500000',
        formattedBalance: 1.0,
        timestamp: Date.now(),
        source: 'hiro-api',
        metadata: {
          contractId: baseContractId,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 6,
          type: 'SIP10'
        }
      };

      // Find the balances socket and send the message
      const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');
      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(mainnetBalanceUpdate) });
      });

      // Verify mainnet balance is stored
      await waitFor(() => {
        expect(getByTestId('user-balances-count').textContent).toBe('1');
      });

      // Now: Send subnet balance as a completely separate message
      const subnetBalanceUpdate = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: subnetContractId, // Different contract ID 
        balance: 2000000, // Different balance
        totalSent: '100000',
        totalReceived: '2100000',
        formattedBalance: 2.0,
        timestamp: Date.now(),
        source: 'subnet-contract-call',
        // NO subnet-specific fields - server sends this as a separate token
        metadata: {
          contractId: subnetContractId,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 6,
          type: 'SUBNET', // Indicates this is a subnet token
          base: baseContractId // Points to base contract for merging
        }
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(subnetBalanceUpdate) });
      });

      // Client-side merging should combine both messages into one balance
      const specificBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      
      // The balance should contain BOTH mainnet and subnet data
      expect(specificBalance).toMatchObject({
        balance: '1000000', // Should keep mainnet balance
        subnetBalance: 2000000, // Should add subnet balance
        subnetContractId: subnetContractId,
        formattedSubnetBalance: 2.0
      });

      // Should still be only 1 balance entry (merged under base contract)
      expect(getByTestId('user-balances-count').textContent).toBe('1');
    });

    it('should preserve mainnet balance when subnet balance arrives first', async () => {
      const { getByTestId } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} />
        </BlazeProvider>
      );

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      // Find the balances socket
      const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');
      
      // First: Send subnet balance as separate message
      const subnetBalanceUpdate = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: subnetContractId,
        balance: 2000000,
        totalSent: '100000',
        totalReceived: '2100000',
        formattedBalance: 2.0,
        timestamp: Date.now(),
        source: 'subnet-contract-call',
        metadata: {
          contractId: subnetContractId,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 6,
          type: 'SUBNET',
          base: baseContractId
        }
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(subnetBalanceUpdate) });
      });

      // Then: Send mainnet balance
      const mainnetBalanceUpdate = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: baseContractId,
        balance: 1000000,
        totalSent: '500000',
        totalReceived: '1500000',
        formattedBalance: 1.0,
        timestamp: Date.now(),
        source: 'hiro-api',
        metadata: {
          contractId: baseContractId,
          name: 'Test Token',
          symbol: 'TEST',
          decimals: 6,
          type: 'SIP10'
        }
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(mainnetBalanceUpdate) });
      });

      // Client-side merging should preserve both balances
      const specificBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      
      // Should contain BOTH mainnet and subnet data
      expect(specificBalance).toMatchObject({
        balance: '1000000', // Mainnet balance
        subnetBalance: 2000000, // Should preserve subnet balance
        subnetContractId: subnetContractId,
        formattedSubnetBalance: 2.0
      });

      expect(getByTestId('user-balances-count').textContent).toBe('1');
    });

    it('should handle BALANCE_BATCH with separate mainnet and subnet balance messages', async () => {
      const { getByTestId } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} />
        </BlazeProvider>
      );

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      // Find the balances socket
      const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');

      // Send BALANCE_BATCH with separate mainnet and subnet messages
      const balanceBatch = {
        type: 'BALANCE_BATCH',
        balances: [
          // Mainnet token message
          {
            userId: testUserId,
            contractId: baseContractId,
            balance: 1000000,
            totalSent: '500000',
            totalReceived: '1500000',
            formattedBalance: 1.0,
            timestamp: Date.now(),
            source: 'hiro-api',
            metadata: {
              contractId: baseContractId,
              name: 'Test Token',
              symbol: 'TEST',
              decimals: 6,
              type: 'SIP10'
            }
          },
          // Separate subnet token message
          {
            userId: testUserId,
            contractId: subnetContractId,
            balance: 2000000,
            totalSent: '100000',
            totalReceived: '2100000',
            formattedBalance: 2.0,
            timestamp: Date.now(),
            source: 'subnet-contract-call',
            metadata: {
              contractId: subnetContractId,
              name: 'Test Token',
              symbol: 'TEST',
              decimals: 6,
              type: 'SUBNET',
              base: baseContractId
            }
          }
        ],
        timestamp: Date.now()
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(balanceBatch) });
      });

      // Client-side batch processing should merge the separate messages
      const specificBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      
      expect(specificBalance).toMatchObject({
        balance: '1000000', // Mainnet balance
        subnetBalance: 2000000, // Subnet balance
        subnetContractId: subnetContractId,
        formattedSubnetBalance: 2.0
      });

      // Should have only 1 merged balance entry
      expect(getByTestId('user-balances-count').textContent).toBe('1');
    });

    it('should handle multiple different subnet tokens with separate messages', async () => {
      const { getByTestId } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} />
        </BlazeProvider>
      );

      const baseToken1 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a';
      const baseToken2 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-b';
      const subnetToken1 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-a-subnet-v1';
      const subnetToken2 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.token-b-subnet-v1';

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      // Find the balances socket
      const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');

      // Send separate messages for each token (mainnet and subnet)
      const updates = [
        // Mainnet tokens
        {
          contractId: baseToken1,
          balance: 1000000,
          metadata: {
            contractId: baseToken1,
            name: 'Token A',
            symbol: 'TKNA',
            decimals: 6,
            type: 'SIP10'
          }
        },
        {
          contractId: baseToken2,
          balance: 3000000,
          metadata: {
            contractId: baseToken2,
            name: 'Token B',
            symbol: 'TKNB',
            decimals: 6,
            type: 'SIP10'
          }
        },
        // Subnet tokens (separate messages)
        {
          contractId: subnetToken1,
          balance: 2000000,
          metadata: {
            contractId: subnetToken1,
            name: 'Token A',
            symbol: 'TKNA',
            decimals: 6,
            type: 'SUBNET',
            base: baseToken1
          }
        },
        {
          contractId: subnetToken2,
          balance: 4000000,
          metadata: {
            contractId: subnetToken2,
            name: 'Token B',
            symbol: 'TKNB',
            decimals: 6,
            type: 'SUBNET',
            base: baseToken2
          }
        }
      ];

      for (const update of updates) {
        const message = {
          type: 'BALANCE_UPDATE',
          userId: testUserId,
          contractId: update.contractId,
          balance: update.balance,
          totalSent: '0',
          totalReceived: String(update.balance),
          formattedBalance: update.balance / 1000000,
          timestamp: Date.now(),
          source: update.metadata.type === 'SUBNET' ? 'subnet-contract-call' : 'hiro-api',
          metadata: update.metadata
        };

        act(() => {
          balancesSocket?.onMessage({ data: JSON.stringify(message) });
        });
      }

      // Should have 2 merged entries (one per base token)
      await waitFor(() => {
        expect(getByTestId('user-balances-count').textContent).toBe('2');
      });

      // Each token should have both mainnet and subnet data merged
      // The client-side merging should handle this correctly
    });

    it('should handle tokens with only mainnet balances (no subnet)', async () => {
      const aeUSDCContract = 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc';
      const { getByTestId } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} contractId={aeUSDCContract} />
        </BlazeProvider>
      );

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      // Find the balances socket
      const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');

      // Send a mainnet-only balance (like your aeUSDC example)
      const mainnetOnlyBalance = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
        balance: 10149770,
        totalSent: '3970992403',
        totalReceived: '3981142173',
        formattedBalance: 10.14977,
        timestamp: 1751241430054,
        source: 'hiro-api',
        metadata: {
          contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
          name: 'aeUSDC',
          symbol: 'aeUSDC',
          decimals: 6,
          type: 'SIP10',
          identifier: '',
          description: 'Ethereum USDC via Allbridge',
          image: 'https://allbridge-assets.web.app/320px/ETH/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.svg',
          total_supply: 21950899048410,
          lastUpdated: 1750963969400,
          verified: false,
          price: null,
          change1h: null,
          change24h: null,
          change7d: null,
          marketCap: null
        }
        // Note: No subnetBalance, subnetContractId, etc. fields
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(mainnetOnlyBalance) });
      });

      // Should store the balance correctly without subnet fields
      await waitFor(() => {
        expect(getByTestId('user-balances-count').textContent).toBe('1');
      });

      // The balance object should NOT have subnet fields (they should be undefined)
      const specificBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      
      // Should have mainnet data
      expect(specificBalance).toMatchObject({
        balance: '10149770',
        formattedBalance: 10.14977,
        totalSent: '3970992403',
        totalReceived: '3981142173',
        source: 'hiro-api'
      });

      // Should NOT have subnet fields (or they should be undefined)
      expect(specificBalance.subnetBalance).toBeUndefined();
      expect(specificBalance.subnetContractId).toBeUndefined();
      expect(specificBalance.formattedSubnetBalance).toBeUndefined();
    });

    it('should handle real-world scenario: mainnet first, then potential subnet later', async () => {
      const aeUSDCContract = 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc';
      const { getByTestId } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} contractId={aeUSDCContract} />
        </BlazeProvider>
      );

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');

      // Step 1: Receive mainnet balance (like your aeUSDC example)
      const mainnetBalance = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
        balance: 10149770,
        totalSent: '3970992403',
        totalReceived: '3981142173',
        formattedBalance: 10.14977,
        timestamp: 1751241430054,
        source: 'hiro-api',
        metadata: {
          contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
          name: 'aeUSDC',
          symbol: 'aeUSDC',
          decimals: 6,
          type: 'SIP10'
        }
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(mainnetBalance) });
      });

      // Verify mainnet balance stored
      await waitFor(() => {
        expect(getByTestId('user-balances-count').textContent).toBe('1');
      });

      let specificBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      expect(specificBalance.balance).toBe('10149770');
      expect(specificBalance.subnetBalance).toBeUndefined();

      // Step 2: Later, receive separate subnet balance message
      const subnetBalance = {
        type: 'BALANCE_UPDATE',
        userId: testUserId,
        contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc-subnet-v1',
        balance: 5000000, // Different subnet balance
        totalSent: '1000000',
        totalReceived: '6000000',
        formattedBalance: 5.0,
        timestamp: Date.now(),
        source: 'subnet-contract-call',
        metadata: {
          contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc-subnet-v1',
          name: 'aeUSDC',
          symbol: 'aeUSDC',
          decimals: 6,
          type: 'SUBNET',
          base: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc'
        }
      };

      act(() => {
        balancesSocket?.onMessage({ data: JSON.stringify(subnetBalance) });
      });

      // Should still be 1 balance entry (merged)
      await waitFor(() => {
        expect(getByTestId('user-balances-count').textContent).toBe('1');
      });

      // Now should have BOTH mainnet and subnet data merged
      specificBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      expect(specificBalance).toMatchObject({
        balance: '10149770', // Preserved mainnet balance
        subnetBalance: 5000000, // Added subnet balance
        subnetContractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc-subnet-v1',
        formattedSubnetBalance: 5.0
      });
    });
  });

  describe('Connection and Subscription Management', () => {
    it('should properly manage subscription lifecycle', async () => {
      const { getByTestId, rerender } = render(
        <BlazeProvider>
          <TestComponent userId={testUserId} />
        </BlazeProvider>
      );

      await waitFor(() => {
        expect(getByTestId('connected').textContent).toBe('true');
      });

      // Should send subscription message
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('SUBSCRIBE')
      );

      // Change userId - should unsubscribe old and subscribe new
      const newUserId = 'SP2DIFFERENT9C05J7HBJTHGR0GGW7KX975CN0QKJ3';
      
      rerender(
        <BlazeProvider>
          <TestComponent userId={newUserId} />
        </BlazeProvider>
      );

      // Should send unsubscribe and new subscribe
      expect(mockSend).toHaveBeenCalledWith(
        expect.stringContaining('UNSUBSCRIBE')
      );
    });
  });
});

describe('BlazeProvider - Price Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketInstances.length = 0;
  });

  it('should handle price updates correctly', async () => {
    function PriceTestComponent() {
      const { prices, getPrice, isConnected } = useBlaze();
      return (
        <div>
          <span data-testid="connected">{isConnected.toString()}</span>
          <span data-testid="prices-count">{Object.keys(prices).length}</span>
          <span data-testid="specific-price">{getPrice('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.test-token') || 'undefined'}</span>
        </div>
      );
    }

    const { getByTestId } = render(
      <BlazeProvider>
        <PriceTestComponent />
      </BlazeProvider>
    );

    await waitFor(() => {
      expect(getByTestId('connected').textContent).toBe('true');
    });

    // Find the prices socket (should be the first one)
    const pricesSocket = mockSocketInstances.find(socket => socket.party === 'prices');
    expect(pricesSocket).toBeDefined();

    // Send price update through the prices socket
    const priceUpdate = {
      type: 'PRICE_UPDATE',
      contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.test-token',
      price: 1.5,
      timestamp: Date.now(),
      source: 'realtime'
    };

    act(() => {
      pricesSocket.onMessage({ data: JSON.stringify(priceUpdate) });
    });

    await waitFor(() => {
      expect(getByTestId('specific-price').textContent).toBe('1.5');
      expect(getByTestId('prices-count').textContent).toBe('1');
    });
  });
});