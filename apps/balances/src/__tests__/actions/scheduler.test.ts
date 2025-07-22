// Mock all the dependencies that cause import issues
jest.mock('@services/balances', () => ({}))
jest.mock('@vercel/kv', () => ({}))

import { getSchedulerJobs, createSchedulerJob, CreateSchedulerJobRequest } from '@/lib/actions/scheduler'

// Mock environment variables
const originalEnv = process.env

describe('Scheduler Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getSchedulerJobs', () => {
    it('should return mock jobs when services are not configured', async () => {
      // No environment variables set
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const result = await getSchedulerJobs()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'demo-job-1',
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        tokens: ['STX', 'charisma-token'],
        frequency: 'daily',
        enabled: true
      })
      expect(result[0].nextRun).toBeDefined()
    })
  })

  describe('createSchedulerJob', () => {
    it('should create mock job when services are not configured', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const request: CreateSchedulerJobRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        tokens: ['STX', 'charisma-token'],
        frequency: 'daily',
        enabled: true
      }

      const result = await createSchedulerJob(request)

      expect(result).toMatchObject({
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        tokens: ['STX', 'charisma-token'],
        frequency: 'daily',
        enabled: true
      })
      expect(result.id).toMatch(/^demo-job-\d+$/)
      expect(result.nextRun).toBeDefined()
    })

    it('should create job with default enabled true when not specified', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const request: CreateSchedulerJobRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        frequency: 'daily'
      }

      const result = await createSchedulerJob(request)

      expect(result.enabled).toBe(true)
      expect(result.tokens).toEqual([])
    })

    it('should create job with enabled false when explicitly set', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const request: CreateSchedulerJobRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        frequency: 'daily',
        enabled: false
      }

      const result = await createSchedulerJob(request)

      expect(result.enabled).toBe(false)
    })

    it('should throw error when no addresses provided', async () => {
      const request: CreateSchedulerJobRequest = {
        addresses: [],
        frequency: 'daily'
      }

      await expect(createSchedulerJob(request)).rejects.toThrow('Failed to create scheduler job')
    })

    it('should throw error when addresses is undefined', async () => {
      const request = {
        frequency: 'daily'
      } as CreateSchedulerJobRequest

      await expect(createSchedulerJob(request)).rejects.toThrow('Failed to create scheduler job')
    })

    it('should throw error when frequency is missing', async () => {
      const request: CreateSchedulerJobRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        frequency: ''
      }

      await expect(createSchedulerJob(request)).rejects.toThrow('Failed to create scheduler job')
    })

    it('should throw error when frequency is undefined', async () => {
      const request = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE']
      } as CreateSchedulerJobRequest

      await expect(createSchedulerJob(request)).rejects.toThrow('Failed to create scheduler job')
    })

    it('should include job in subsequent getSchedulerJobs calls', async () => {
      delete process.env.KV_URL
      delete process.env.BLOB_READ_WRITE_TOKEN

      const initialJobs = await getSchedulerJobs()
      const initialCount = initialJobs.length

      const request: CreateSchedulerJobRequest = {
        addresses: ['SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE'],
        frequency: 'hourly'
      }

      await createSchedulerJob(request)

      const updatedJobs = await getSchedulerJobs()
      expect(updatedJobs).toHaveLength(initialCount + 1)
    })
  })
})