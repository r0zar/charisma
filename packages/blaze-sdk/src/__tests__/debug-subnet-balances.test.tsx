/**
 * Debug test to investigate subnet balance scenarios
 * This test helps us understand when subnet fields are included/excluded
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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
      readyState: 1,
      party,
      onMessage
    };
    
    mockSocketInstances.push(instance);
    setTimeout(() => onOpen?.(), 0);
    return instance;
  })
}));

function DebugComponent({ userId, contractId }: { userId: string; contractId: string }) {
  const { balances, getBalance, getUserBalances } = useBlaze({ userId });
  
  const allBalances = getUserBalances(userId);
  const specificBalance = getBalance(userId, contractId);
  
  return (
    <div>
      <span data-testid="all-balances">{JSON.stringify(allBalances, null, 2)}</span>
      <span data-testid="specific-balance">{JSON.stringify(specificBalance, null, 2)}</span>
      <span data-testid="has-subnet-fields">
        {specificBalance?.subnetBalance !== undefined ? 'true' : 'false'}
      </span>
    </div>
  );
}

describe('Debug: Subnet Balance Field Investigation', () => {
  const testUserId = 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QKJ3';
  const aeUSDCContract = 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketInstances.length = 0;
  });

  it('should investigate different subnet balance scenarios', async () => {
    const { getByTestId } = render(
      <BlazeProvider>
        <DebugComponent userId={testUserId} contractId={aeUSDCContract} />
      </BlazeProvider>
    );

    const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');

    // Scenario 1: Your real-world aeUSDC data (no subnet fields)
    console.log('🔍 Testing Scenario 1: Real aeUSDC data (no subnet fields)');
    
    const realAeUSDCBalance = {
      type: 'BALANCE_UPDATE',
      userId: testUserId,
      contractId: aeUSDCContract,
      balance: 10149770,
      totalSent: '3970992403',
      totalReceived: '3981142173',
      formattedBalance: 10.14977,
      source: 'hiro-api',
      timestamp: 1751241430054,
      metadata: {
        contractId: aeUSDCContract,
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
      // Notice: No subnetBalance, subnetContractId, etc.
    };

    act(() => {
      balancesSocket?.onMessage({ data: JSON.stringify(realAeUSDCBalance) });
    });

    await waitFor(() => {
      expect(getByTestId('has-subnet-fields').textContent).toBe('false');
    });

    console.log('Scenario 1 result:', JSON.parse(getByTestId('specific-balance').textContent || 'null'));

    // Scenario 2: Same token but with zero subnet balance explicitly
    console.log('🔍 Testing Scenario 2: Zero subnet balance explicitly');
    
    const zeroSubnetBalance = {
      type: 'BALANCE_UPDATE',
      userId: testUserId,
      contractId: `${aeUSDCContract}-subnet-v1`,
      balance: 0, // Zero subnet balance
      totalSent: '0',
      totalReceived: '0',
      formattedBalance: 0,
      source: 'subnet-contract-call',
      timestamp: Date.now(),
      metadata: {
        contractId: `${aeUSDCContract}-subnet-v1`,
        name: 'aeUSDC',
        symbol: 'aeUSDC',
        decimals: 6,
        type: 'SUBNET',
        base: aeUSDCContract
      }
    };

    act(() => {
      balancesSocket?.onMessage({ data: JSON.stringify(zeroSubnetBalance) });
    });

    await waitFor(() => {
      expect(getByTestId('has-subnet-fields').textContent).toBe('true');
    });

    console.log('Scenario 2 result:', JSON.parse(getByTestId('specific-balance').textContent || 'null'));

    // Scenario 3: Non-zero subnet balance
    console.log('🔍 Testing Scenario 3: Non-zero subnet balance');
    
    const nonZeroSubnetBalance = {
      type: 'BALANCE_UPDATE',
      userId: testUserId,
      contractId: `${aeUSDCContract}-subnet-v1`,
      balance: 5000000,
      totalSent: '1000000',
      totalReceived: '6000000',
      formattedBalance: 5.0,
      source: 'subnet-contract-call',
      timestamp: Date.now(),
      metadata: {
        contractId: `${aeUSDCContract}-subnet-v1`,
        name: 'aeUSDC',
        symbol: 'aeUSDC',
        decimals: 6,
        type: 'SUBNET',
        base: aeUSDCContract
      }
    };

    act(() => {
      balancesSocket?.onMessage({ data: JSON.stringify(nonZeroSubnetBalance) });
    });

    await waitFor(() => {
      const finalBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
      expect(finalBalance.subnetBalance).toBe(5000000);
    });

    const finalBalance = JSON.parse(getByTestId('specific-balance').textContent || 'null');
    console.log('Scenario 3 result:', finalBalance);

    // Final verification: should have both mainnet and subnet data
    expect(finalBalance).toMatchObject({
      balance: '10149770', // Mainnet balance preserved
      subnetBalance: 5000000, // Should have the non-zero subnet balance
      subnetContractId: `${aeUSDCContract}-subnet-v1`
    });
  });

  it('should show what happens when subnet balance is undefined vs 0', async () => {
    const { getByTestId } = render(
      <BlazeProvider>
        <DebugComponent userId={testUserId} contractId={aeUSDCContract} />
      </BlazeProvider>
    );

    const balancesSocket = mockSocketInstances.find(socket => socket.party === 'balances');

    // Test with subnetBalance: undefined (like your real data)
    const undefinedSubnetBalance = {
      type: 'BALANCE_UPDATE',
      userId: testUserId,
      contractId: aeUSDCContract,
      balance: 10149770,
      totalSent: '3970992403',
      totalReceived: '3981142173',
      formattedBalance: 10.14977,
      source: 'hiro-api',
      timestamp: Date.now(),
      subnetBalance: undefined, // Explicitly undefined
      subnetContractId: undefined,
      formattedSubnetBalance: undefined,
      metadata: {
        contractId: aeUSDCContract,
        name: 'aeUSDC',
        symbol: 'aeUSDC',
        decimals: 6,
        type: 'SIP10'
      }
    };

    act(() => {
      balancesSocket?.onMessage({ data: JSON.stringify(undefinedSubnetBalance) });
    });

    const result1 = JSON.parse(getByTestId('specific-balance').textContent || 'null');
    console.log('📊 Undefined subnet fields result:', result1);

    // Test with explicit zero subnet balance message
    const zeroSubnetMessage = {
      type: 'BALANCE_UPDATE',
      userId: testUserId,
      contractId: `${aeUSDCContract}-subnet-v1`,
      balance: 0,
      totalSent: '0',
      totalReceived: '0',
      formattedBalance: 0,
      source: 'subnet-contract-call',
      timestamp: Date.now(),
      metadata: {
        contractId: `${aeUSDCContract}-subnet-v1`,
        name: 'aeUSDC',
        symbol: 'aeUSDC',
        decimals: 6,
        type: 'SUBNET',
        base: aeUSDCContract
      }
    };

    act(() => {
      balancesSocket?.onMessage({ data: JSON.stringify(zeroSubnetMessage) });
    });

    const result2 = JSON.parse(getByTestId('specific-balance').textContent || 'null');
    console.log('📊 Zero subnet fields result:', result2);
  });
});