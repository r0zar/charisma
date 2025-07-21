import { NextRequest, NextResponse } from 'next/server'
import { getServiceStats } from '@/lib/actions'

export async function GET(_request: NextRequest) {
  try {
    const stats = await getServiceStats()
    
    // Transform service stats into usage percentages
    const total = stats.totalSnapshots + stats.totalAddresses + stats.totalTokens
    
    if (total === 0) {
      return NextResponse.json({ 
        data: [],
        success: true 
      })
    }
    
    const usageData = [
      {
        name: 'Balance Collection',
        value: Math.round((stats.totalAddresses / total) * 100),
        color: 'hsl(var(--primary))'
      },
      {
        name: 'Snapshots',
        value: Math.round((stats.totalSnapshots / total) * 100),
        color: 'hsl(var(--accent))'
      },
      {
        name: 'Token Contracts',
        value: Math.round((stats.totalTokens / total) * 100),
        color: 'hsl(var(--secondary))'
      }
    ]
    
    return NextResponse.json({ 
      data: usageData,
      success: true 
    })
  } catch (error) {
    console.error('Service usage API error:', error)
    return NextResponse.json(
      { error: 'Failed to get service usage data' },
      { status: 500 }
    )
  }
}