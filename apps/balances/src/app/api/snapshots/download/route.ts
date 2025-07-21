import { NextRequest, NextResponse } from 'next/server'
import { SnapshotStorage } from '@services/balances'

export async function POST(request: NextRequest) {
  try {
    const { timestamp } = await request.json()
    
    if (!timestamp) {
      return NextResponse.json(
        { error: 'Timestamp is required' },
        { status: 400 }
      )
    }

    console.log('Download API: Creating download URL for timestamp:', timestamp)

    // Initialize storage
    const storage = new SnapshotStorage()

    // Check if snapshot exists
    const exists = await storage.snapshotExists(timestamp)
    if (!exists) {
      console.log('Download API: Snapshot does not exist:', timestamp)
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      )
    }

    // Get the snapshot data (this will give us the blob URL or allow us to create a download URL)
    const snapshot = await storage.getSnapshot(timestamp)
    if (!snapshot) {
      console.log('Download API: Snapshot is corrupted:', timestamp)
      return NextResponse.json(
        { error: 'Snapshot is corrupted' },
        { status: 400 }
      )
    }

    // Create the filename for download
    const filename = `balance-snapshot-${new Date(timestamp).toISOString().split('T')[0]}-${timestamp}.json.gz`
    
    console.log('Download API: Creating download URL for file:', filename)

    // Instead of trying to get a blob URL, let's serve the data directly
    // Convert snapshot to JSON and compress it for download
    const snapshotJson = JSON.stringify(snapshot, null, 2)
    
    return NextResponse.json({ 
      success: true,
      filename,
      downloadUrl: `/api/snapshots/download/${timestamp}`,
      size: snapshotJson.length
    })

  } catch (error) {
    console.error('Download API error:', error)
    return NextResponse.json(
      { error: 'Failed to create download URL' },
      { status: 500 }
    )
  }
}