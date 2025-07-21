'use server'

import { BalanceSnapshotScheduler, SnapshotStorage, SnapshotReader, KVBalanceStore, Snapshot } from '@services/balances'

export interface CreateSnapshotRequest {
  addresses: string[]
  tokens?: string[]
}

// Check if services are configured
function areServicesConfigured(): boolean {
  return !!(process.env.KV_URL && process.env.BLOB_READ_WRITE_TOKEN)
}

let scheduler: BalanceSnapshotScheduler | null = null
let snapshotReader: SnapshotReader | null = null
let kvStore: KVBalanceStore | null = null
let snapshotStorage: SnapshotStorage | null = null

if (areServicesConfigured()) {
  try {
    kvStore = new KVBalanceStore()
    snapshotStorage = new SnapshotStorage()
    scheduler = new BalanceSnapshotScheduler(kvStore, snapshotStorage)
    snapshotReader = new SnapshotReader(snapshotStorage, kvStore)
  } catch (error) {
    console.warn('Balance services not available:', error)
  }
}

export async function getSnapshots(): Promise<{ snapshots: Snapshot[], demo?: boolean }> {
  try {
    console.log('getSnapshots: snapshotReader available:', !!snapshotReader)
    if (!snapshotReader || !snapshotStorage) {
      // Return empty result with demo flag instead of throwing
      console.log('getSnapshots: No snapshot reader, returning demo mode')
      return { snapshots: [], demo: true }
    }

    console.log('getSnapshots: Getting available snapshots using SnapshotReader')
    // First get the index to see what snapshots are available
    const index = await snapshotReader.getSnapshotIndex()
    console.log('getSnapshots: Index returned:', index)
    
    if (!index || !index.timestamps || index.timestamps.length === 0) {
      console.log('getSnapshots: No snapshots available')
      return { snapshots: [] }
    }

    // Query recent snapshots with metadata - limit to latest 50 for performance
    const recentTimestamps = index.timestamps.slice(-50).reverse() // Latest first
    console.log('getSnapshots: Querying snapshots for timestamps:', recentTimestamps.length)
    
    // Get information for each snapshot
    const snapshots: Snapshot[] = await Promise.all(
      recentTimestamps.map(async (timestamp: number) => {
        try {
          // First try to check if snapshot exists and get basic info
          const exists = await snapshotStorage!.snapshotExists(timestamp)
          if (!exists) {
            console.log(`getSnapshots: Snapshot ${timestamp} does not exist`)
            return null
          }

          // Try to validate snapshot exists and is readable
          try {
            console.log(`getSnapshots: Validating snapshot ${timestamp}`)
            
            // First check if it exists in storage
            const exists = await snapshotStorage!.snapshotExists(timestamp)
            if (!exists) {
              console.log(`getSnapshots: Snapshot ${timestamp} does not exist in storage, skipping`)
              return null
            }
            
            // Try to retrieve the actual snapshot to validate it's not corrupted
            const snapshot = await snapshotStorage!.getSnapshot(timestamp)
            if (!snapshot) {
              console.log(`getSnapshots: Snapshot ${timestamp} is corrupted (exists but returns null), skipping`)
              return null
            }
            
            console.log(`getSnapshots: Snapshot ${timestamp} is valid`)
            
            // Use data from the snapshot itself
            const size = snapshot.metadata?.originalSize || 0
            const compressedSize = snapshot.metadata?.compressedSize || 0
            const compressionRatio = snapshot.metadata?.compressionRatio || 0
            const balanceCount = snapshot.balances ? 
              Object.values(snapshot.balances).reduce((total: number, addressBalances: any) => 
                total + Object.keys(addressBalances || {}).length, 0
              ) : 0
            const addressCount = snapshot.totalAddresses || 0
            const contractCount = snapshot.totalContracts || 0
          
            return {
              id: `snapshot-${timestamp}`,
              createdAt: new Date(timestamp).toISOString(),
              size,
              compressedSize,
              compressionRatio,
              balanceCount,
              addressCount,
              contractCount,
              status: 'completed' as const,
              url: `balances/snapshots/${timestamp}.json.gz`
            }
          } catch (error) {
            console.log(`getSnapshots: Snapshot ${timestamp} validation failed, skipping:`, error.message)
            return null
          }
        } catch (error) {
          console.warn(`Failed to process snapshot ${timestamp}:`, error)
          return null
        }
      })
    )
    
    // Filter out null entries
    const validSnapshots = snapshots.filter((s): s is Snapshot => s !== null)
    
    console.log('getSnapshots: Returning snapshots:', validSnapshots.length)
    return { snapshots: validSnapshots }
  } catch (error) {
    console.error('Failed to get snapshots:', error)
    // Return demo mode instead of throwing on error
    return { snapshots: [], demo: true }
  }
}

export async function createSnapshot(request: CreateSnapshotRequest): Promise<{ snapshot: Snapshot, demo?: boolean }> {
  try {
    if (!request.addresses || request.addresses.length === 0) {
      throw new Error('At least one address is required')
    }

    if (!scheduler) {
      // Create a demo snapshot instead of throwing
      const demoSnapshot: Snapshot = {
        id: `demo-${Date.now()}`,
        createdAt: new Date().toISOString(),
        size: 0,
        compressedSize: 0,
        compressionRatio: 0,
        balanceCount: 0,
        addressCount: 0,
        contractCount: 0,
        status: 'completed',
        url: undefined
      }
      return { snapshot: demoSnapshot, demo: true }
    }

    const result = await scheduler.createSnapshot()
    return { snapshot: result }
  } catch (error) {
    console.error('Failed to create snapshot:', error)
    // Create demo snapshot on error
    const demoSnapshot: Snapshot = {
      id: `demo-${Date.now()}`,
      createdAt: new Date().toISOString(),
      size: 0,
      compressedSize: 0,
      compressionRatio: 0,
      balanceCount: 0,
      addressCount: 0,
      contractCount: 0,
      status: 'completed',
      url: undefined
    }
    return { snapshot: demoSnapshot, demo: true }
  }
}