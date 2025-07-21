// Mock all the dependencies that cause import issues
jest.mock('@services/balances', () => ({
  BalanceService: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(1000000),
    getBalances: jest.fn().mockResolvedValue({ 'charisma-token': 1000000, 'stx': 500000 }),
  })),
  KVBalanceStore: jest.fn().mockImplementation(() => ({
    getStats: jest.fn().mockResolvedValue({
      totalSnapshots: 1,
      totalAddresses: 25,
      totalTokens: 12,
      lastUpdate: '2024-01-15T10:30:00Z'
    }),
  })),
}))
jest.mock('@vercel/kv', () => ({}))
jest.mock('@modules/blob-monitor', () => ({}))

import { getServiceStats, runCollection } from '@/lib/actions/service'

describe('Service Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getServiceStats', () => {
    it('should return real stats when services are available', async () => {

      const result = await getServiceStats()

      // Now returns real data from mocked services
      expect(result.status).toEqual('healthy')
      expect(result.lastUpdate).toBeDefined()
    })

    it('should return real stats from actual service methods', async () => {

      const result = await getServiceStats()

      // This test expects the real implementation to call actual service methods
      expect(result.status).toEqual('healthy')
      expect(result.totalSnapshots).toBeGreaterThan(0) // Should get real data, not 0
      expect(result.lastUpdate).toBeDefined()
    })
  })

  describe('runCollection', () => {
    it('should throw error when services are not configured', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      await expect(runCollection()).rejects.toThrow('Collection run not implemented')
    })

    it('should successfully run collection when services are configured', async () => {

      const result = await runCollection()

      // This test expects the real implementation to be done
      expect(result.snapshotsCreated).toBeGreaterThanOrEqual(0)
      expect(result.addressesProcessed).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
    })
  })
})