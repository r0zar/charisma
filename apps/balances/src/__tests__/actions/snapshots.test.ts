// Mock all the dependencies that cause import issues
jest.mock('@services/balances', () => ({}))
jest.mock('@vercel/kv', () => ({}))
jest.mock('@modules/blob-monitor', () => ({}))

import { getSnapshots, createSnapshot, CreateSnapshotRequest } from '@/lib/actions/snapshots'

// Mock environment variables
const originalEnv = process.env

describe('Snapshot Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getSnapshots', () => {
    it('should return mock snapshots when services are not configured', async () => {
      // No environment variables set
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const result = await getSnapshots()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'demo-1',
        address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        balances: { STX: 1000000, 'charisma-token': 50000 }
      })
      expect(result[0].timestamp).toBeDefined()
    })
  })

  describe('createSnapshot', () => {
    it('should create mock snapshot when services are not configured', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const request: CreateSnapshotRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        tokens: ['STX', 'charisma-token']
      }

      const result = await createSnapshot(request)

      expect(result).toMatchObject({
        address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        balances: expect.any(Object)
      })
      expect(result.id).toMatch(/^demo-\d+$/)
      expect(result.timestamp).toBeDefined()
      expect(typeof result.balances.STX).toBe('number')
      expect(typeof result.balances['charisma-token']).toBe('number')
    })


    it('should create multiple different mock snapshots', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const request: CreateSnapshotRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE']
      }

      const result1 = await createSnapshot(request)
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      const result2 = await createSnapshot(request)

      expect(result1.id).not.toBe(result2.id)
      // Note: balances are random so they might occasionally be equal, just check they're defined
      expect(result1.balances).toBeDefined()
      expect(result2.balances).toBeDefined()
    })

    it('should include snapshot in subsequent getSnapshots calls', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const initialSnapshots = await getSnapshots()
      const initialCount = initialSnapshots.length

      const request: CreateSnapshotRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE']
      }

      await createSnapshot(request)

      const updatedSnapshots = await getSnapshots()
      expect(updatedSnapshots).toHaveLength(initialCount + 1)
    })
  })
})