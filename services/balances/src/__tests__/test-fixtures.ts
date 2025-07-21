/**
 * Test fixtures for consistent test data
 */

import type { BulkBalanceRequest, BulkBalanceResponse } from '../types';
import type { KVBalanceData } from '../storage/KVBalanceStore';

// Sample Stacks addresses
export const SAMPLE_ADDRESSES = {
  mainnet: {
    alice: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
    bob: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
    charlie: 'SP1WTA0YBPC5R6GDMPPJCEDEA6Z2ZEPNMQ4C39W6M'
  },
  testnet: {
    alice: 'ST3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
    bob: 'ST2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR',
    charlie: 'ST1WTA0YBPC5R6GDMPPJCEDEA6Z2ZEPNMQ4C39W6M'
  }
};

// Sample contract IDs
export const SAMPLE_CONTRACTS = {
  stx: 'SP000000000000000000002Q6VF78.stx',
  usdc: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.usdc-token',
  alex: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.alex-token',
  diko: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.diko-token',
  wrapped_bitcoin: 'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin'
};

// Sample balance data
export const SAMPLE_BALANCES = {
  alice: {
    [SAMPLE_CONTRACTS.stx]: '1000000000', // 1000 STX
    [SAMPLE_CONTRACTS.usdc]: '500000000', // 500 USDC
    [SAMPLE_CONTRACTS.alex]: '2000000000' // 2000 ALEX
  },
  bob: {
    [SAMPLE_CONTRACTS.stx]: '2500000000', // 2500 STX
    [SAMPLE_CONTRACTS.diko]: '1000000000', // 1000 DIKO
    [SAMPLE_CONTRACTS.wrapped_bitcoin]: '100000000' // 1 BTC
  },
  charlie: {
    [SAMPLE_CONTRACTS.stx]: '750000000', // 750 STX
    [SAMPLE_CONTRACTS.usdc]: '1000000000' // 1000 USDC
  }
};

// Sample KV balance data
export const SAMPLE_KV_DATA: Record<string, KVBalanceData> = {
  [`balance:${SAMPLE_ADDRESSES.mainnet.alice}:${SAMPLE_CONTRACTS.stx}`]: {
    balance: SAMPLE_BALANCES.alice[SAMPLE_CONTRACTS.stx],
    lastUpdated: Date.now() - 60000, // 1 minute ago
    blockHeight: 150000
  },
  [`balance:${SAMPLE_ADDRESSES.mainnet.alice}:${SAMPLE_CONTRACTS.usdc}`]: {
    balance: SAMPLE_BALANCES.alice[SAMPLE_CONTRACTS.usdc],
    lastUpdated: Date.now() - 120000, // 2 minutes ago
    blockHeight: 150001
  },
  [`balance:${SAMPLE_ADDRESSES.mainnet.bob}:${SAMPLE_CONTRACTS.stx}`]: {
    balance: SAMPLE_BALANCES.bob[SAMPLE_CONTRACTS.stx],
    lastUpdated: Date.now() - 180000, // 3 minutes ago
    blockHeight: 149999
  }
};

// Sample bulk balance request
export const SAMPLE_BULK_REQUEST: BulkBalanceRequest = {
  addresses: [
    SAMPLE_ADDRESSES.mainnet.alice,
    SAMPLE_ADDRESSES.mainnet.bob,
    SAMPLE_ADDRESSES.mainnet.charlie
  ],
  contractIds: [
    SAMPLE_CONTRACTS.stx,
    SAMPLE_CONTRACTS.usdc,
    SAMPLE_CONTRACTS.alex
  ],
  includeZeroBalances: false
};

// Sample bulk balance response
export const SAMPLE_BULK_RESPONSE: BulkBalanceResponse = {
  success: true,
  data: {
    [SAMPLE_ADDRESSES.mainnet.alice]: {
      [SAMPLE_CONTRACTS.stx]: SAMPLE_BALANCES.alice[SAMPLE_CONTRACTS.stx],
      [SAMPLE_CONTRACTS.usdc]: SAMPLE_BALANCES.alice[SAMPLE_CONTRACTS.usdc],
      [SAMPLE_CONTRACTS.alex]: SAMPLE_BALANCES.alice[SAMPLE_CONTRACTS.alex]
    },
    [SAMPLE_ADDRESSES.mainnet.bob]: {
      [SAMPLE_CONTRACTS.stx]: SAMPLE_BALANCES.bob[SAMPLE_CONTRACTS.stx]
    },
    [SAMPLE_ADDRESSES.mainnet.charlie]: {
      [SAMPLE_CONTRACTS.stx]: SAMPLE_BALANCES.charlie[SAMPLE_CONTRACTS.stx],
      [SAMPLE_CONTRACTS.usdc]: SAMPLE_BALANCES.charlie[SAMPLE_CONTRACTS.usdc]
    }
  },
  metadata: {
    totalAddresses: 3,
    totalContracts: 3,
    executionTime: 50,
    cacheHits: 3
  }
};

// Invalid test data
export const INVALID_DATA = {
  addresses: {
    empty: '',
    null: null,
    undefined: undefined,
    wrongFormat: 'invalid-address',
    wrongPrefix: 'BP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', // Wrong prefix
    tooShort: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5', // Too short (37 chars)
    tooLong: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTEXTOOLONG' // Too long (49 chars)
  },
  contractIds: {
    empty: '',
    null: null,
    undefined: undefined,
    noDot: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTEusdc-token',
    emptyContract: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.',
    emptyAddress: '.usdc-token'
  },
  balances: {
    empty: '',
    null: null,
    undefined: undefined,
    negative: '-1000000000',
    decimal: '1000.50',
    nonNumeric: 'not-a-number',
    infinity: 'Infinity',
    nan: 'NaN'
  }
};

// Mock KV responses
export const MOCK_KV_RESPONSES = {
  get: (key: string) => {
    return Promise.resolve(SAMPLE_KV_DATA[key] || null);
  },
  set: () => Promise.resolve('OK'),
  mget: (keys: string[]) => {
    return Promise.resolve(keys.map(key => SAMPLE_KV_DATA[key] || null));
  },
  keys: (pattern: string) => {
    return Promise.resolve(
      Object.keys(SAMPLE_KV_DATA).filter(key => key.includes(pattern))
    );
  }
};

// Test utility functions
export const createMockKVStore = () => ({
  get: vi.fn().mockImplementation(MOCK_KV_RESPONSES.get),
  set: vi.fn().mockImplementation(MOCK_KV_RESPONSES.set),
  mget: vi.fn().mockImplementation(MOCK_KV_RESPONSES.mget),
  keys: vi.fn().mockImplementation(MOCK_KV_RESPONSES.keys),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([])
  })
});

// Performance test data
export const PERFORMANCE_TEST_DATA = {
  largeAddressList: Array.from({ length: 100 }, (_, i) => 
    `SP${i.toString().padStart(38, '0')}Q6VF78`
  ),
  largeContractList: Array.from({ length: 50 }, (_, i) => 
    `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.token-${i}`
  ),
  largeBalanceMap: {} as Record<string, string>
};

// Initialize performance test data
for (let i = 0; i < 100; i++) {
  const address = PERFORMANCE_TEST_DATA.largeAddressList[i];
  for (let j = 0; j < 10; j++) {
    const contractId = `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.token-${j}`;
    PERFORMANCE_TEST_DATA.largeBalanceMap[`${address}:${contractId}`] = (Math.random() * 1000000000).toFixed(0);
  }
}

// Export vi for test files
export { vi } from 'vitest';

// Export mock KV for direct use
export const mockKV = {
  get: vi.fn(),
  set: vi.fn(),
  mget: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  pipeline: vi.fn(),
  multi: vi.fn(),
  flushall: vi.fn(),
  info: vi.fn()
};