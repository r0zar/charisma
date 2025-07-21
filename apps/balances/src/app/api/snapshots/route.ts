import { NextRequest, NextResponse } from 'next/server'
import { getSnapshots, createSnapshot, CreateSnapshotRequest } from '@/lib/actions'

export async function GET(request: NextRequest) {
  try {
    console.log('API: Getting snapshots...')
    const result = await getSnapshots()
    console.log('API: getSnapshots result:', result)
    
    return NextResponse.json({ 
      snapshots: result.snapshots,
      success: true 
    })
  } catch (error) {
    console.error('Snapshots API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch snapshots' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSnapshotRequest = await request.json()
    const snapshot = await createSnapshot(body)
    
    return NextResponse.json({ 
      snapshot,
      success: true 
    })
  } catch (error) {
    console.error('Create snapshot API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: `Failed to create snapshot: ${errorMessage}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}