import { getBalance, getBalances, getBulkBalances, BulkBalancesRequest } from '@/lib/actions'

// Mock the entire services module to prevent actual network calls
jest.mock('@services/balances', () => ({
  BalanceService: jest.fn().mockImplementation(() => ({
    getBalance: jest.fn().mockResolvedValue(1000000),
    getBalances: jest.fn().mockResolvedValue({ 'charisma-token': 1000000, 'stx': 500000 }),
    getBulkBalances: jest.fn().mockResolvedValue({
      data: [
        { address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', 'charisma-token': 1000000 }
      ]
    }),
  })),
}))

describe('Balance Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getBalance', () => {
    it('should throw error when address is missing', async () => {
      await expect(getBalance('', 'charisma-token')).rejects.toThrow('Address is required')
    })

    it('should throw error when contract ID is missing', async () => {
      await expect(getBalance('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', '')).rejects.toThrow('Contract ID is required')
    })

    it('should return success response for valid inputs', async () => {
      const result = await getBalance('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', 'charisma-token')

      expect(result).toMatchObject({
        address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        contractId: 'charisma-token',
        success: true
      })
      expect(result.balance).toBeDefined()
    })
  })

  describe('getBalances', () => {
    it('should throw error when address is missing', async () => {
      await expect(getBalances('')).rejects.toThrow('Address is required')
    })

    it('should return success response for valid address', async () => {
      const result = await getBalances('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE')

      expect(result).toMatchObject({
        address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        success: true
      })
      expect(result.balances).toBeDefined()
    })

    it('should accept optional contract IDs', async () => {
      const contractIds = ['charisma-token', 'stx']
      const result = await getBalances('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', contractIds)

      expect(result).toMatchObject({
        address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        success: true
      })
      expect(result.balances).toBeDefined()
    })
  })

  describe('getBulkBalances', () => {
    it('should throw error when addresses array is empty', async () => {
      const request: BulkBalancesRequest = { addresses: [] }
      await expect(getBulkBalances(request)).rejects.toThrow('Addresses array is required')
    })

    it('should throw error when addresses is not an array', async () => {
      const request = { addresses: 'not-an-array' } as any
      await expect(getBulkBalances(request)).rejects.toThrow('Addresses array is required')
    })

    it('should throw error when addresses is missing', async () => {
      const request = {} as BulkBalancesRequest
      await expect(getBulkBalances(request)).rejects.toThrow('Addresses array is required')
    })

    it('should return result for valid request', async () => {
      const request: BulkBalancesRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', 'SP2ABCD1234567890'],
        contractIds: ['charisma-token'],
        includeZeroBalances: true
      }

      const result = await getBulkBalances(request)

      expect(result).toBeDefined()
      expect(result.data).toBeDefined()
    })

    it('should work with minimal request', async () => {
      const request: BulkBalancesRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE']
      }

      const result = await getBulkBalances(request)

      expect(result).toBeDefined()
    })
  })
})