'use server'

import { BalanceSnapshotScheduler, SnapshotStorage, KVBalanceStore } from '@services/balances'

export interface SchedulerJob {
  id: string
  addresses: string[]
  tokens: string[]
  frequency: string
  nextRun: string
  enabled: boolean
}

export interface CreateSchedulerJobRequest {
  addresses: string[]
  tokens?: string[]
  frequency: string
  enabled?: boolean
}

// Check if services are configured
function areServicesConfigured(): boolean {
  return !!(process.env.KV_URL && process.env.BLOB_READ_WRITE_TOKEN)
}

let scheduler: BalanceSnapshotScheduler | null = null
if (areServicesConfigured()) {
  try {
    const kvStore = new KVBalanceStore()
    const snapshotStorage = new SnapshotStorage()
    scheduler = new BalanceSnapshotScheduler(kvStore, snapshotStorage)
  } catch (error) {
    console.warn('Balance scheduler not available:', error)
  }
}

export async function getSchedulerJobs(): Promise<SchedulerJob[]> {
  try {
    if (!scheduler) {
      throw new Error('Scheduler service not configured - missing KV_URL or BLOB_READ_WRITE_TOKEN')
    }

    // Not yet implemented
    throw new Error('Scheduler jobs retrieval not implemented')
  } catch (error) {
    console.error('Failed to get scheduler jobs:', error)
    throw error
  }
}

export async function createSchedulerJob(request: CreateSchedulerJobRequest): Promise<SchedulerJob> {
  try {
    if (!request.addresses || request.addresses.length === 0) {
      throw new Error('At least one address is required')
    }

    if (!request.frequency) {
      throw new Error('Frequency is required')
    }

    if (!scheduler) {
      throw new Error('Scheduler service not configured - missing KV_URL or BLOB_READ_WRITE_TOKEN')
    }

    // Initialize scheduler if needed
    await scheduler.initializeScheduler()

    const job: SchedulerJob = {
      id: `job-${Date.now()}`,
      addresses: request.addresses,
      tokens: request.tokens || [],
      frequency: request.frequency,
      nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      enabled: request.enabled ?? true
    }

    return job
  } catch (error) {
    console.error('Failed to create scheduler job:', error)
    throw new Error('Failed to create scheduler job')
  }
}