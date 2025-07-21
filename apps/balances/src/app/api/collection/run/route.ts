import { NextRequest, NextResponse } from 'next/server'
import { runCollection } from '@/lib/actions'

export async function POST(_request: NextRequest) {
  try {
    const result = await runCollection()
    
    return NextResponse.json({
      success: result.success,
      result
    })
  } catch (error) {
    console.error('Collection run API error:', error)
    return NextResponse.json(
      { error: 'Failed to run collection' },
      { status: 500 }
    )
  }
}