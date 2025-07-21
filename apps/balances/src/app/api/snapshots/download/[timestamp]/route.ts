import { NextRequest, NextResponse } from 'next/server'
import { SnapshotStorage } from '@services/balances'

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ timestamp: string }> }
) {
  try {
    const resolvedParams = await params
    const timestamp = parseInt(resolvedParams.timestamp)
    
    if (!timestamp || isNaN(timestamp)) {
      return NextResponse.json(
        { error: 'Invalid timestamp' },
        { status: 400 }
      )
    }

    console.log('Download: Serving snapshot:', timestamp)

    // Initialize storage
    const storage = new SnapshotStorage()

    // Get the snapshot data
    const snapshot = await storage.getSnapshot(timestamp)
    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found or corrupted' },
        { status: 404 }
      )
    }

    // Create filename
    const date = new Date(timestamp).toISOString().split('T')[0]
    const filename = `balance-snapshot-${date}-${timestamp}.json`
    
    // Convert to JSON
    const snapshotJson = JSON.stringify(snapshot, null, 2)
    
    console.log(`Download: Serving ${filename} (${snapshotJson.length} bytes)`)

    // Return the file as a download
    return new NextResponse(snapshotJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': snapshotJson.length.toString(),
      },
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: 'Failed to download snapshot' },
      { status: 500 }
    )
  }
}