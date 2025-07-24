import { NextRequest, NextResponse } from 'next/server'
import { lotteryConfigService } from '@/lib/lottery-config'
import { LotteryConfig } from '@/types/lottery'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  
  console.log('Environment admin key:', adminKey ? adminKey.substring(0, 10) + '...' : 'NOT SET')
  
  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  console.log('Provided key:', providedKey ? providedKey.substring(0, 10) + '...' : 'NOT PROVIDED')
  console.log('Keys match:', providedKey === adminKey)
  
  return providedKey === adminKey
}

export async function GET(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const config = await lotteryConfigService.getConfig()
    
    return NextResponse.json({
      success: true,
      data: config
    })
  } catch (error) {
    console.error('Admin GET lottery config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const updates = await request.json()
    console.log('PUT request received with updates:', updates)
    
    // Basic validation
    if (typeof updates !== 'object' || updates === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    console.log('Calling updateConfig...')
    const updatedConfig = await lotteryConfigService.updateConfig(updates)
    console.log('Update successful:', updatedConfig)
    
    return NextResponse.json({
      success: true,
      data: updatedConfig
    })
  } catch (error) {
    console.error('Admin PUT lottery config error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const updates = await request.json()
    console.log('PATCH request received with updates:', updates)
    
    // Basic validation
    if (typeof updates !== 'object' || updates === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    console.log('Calling updateConfig...')
    const updatedConfig = await lotteryConfigService.updateConfig(updates)
    console.log('Update successful:', updatedConfig)
    
    return NextResponse.json({
      success: true,
      data: updatedConfig
    })
  } catch (error) {
    console.error('Admin PATCH lottery config error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const newConfig: LotteryConfig = await request.json()
    
    // Basic validation
    if (!newConfig.ticketPrice || !newConfig.numbersToSelect || !newConfig.maxNumber) {
      return NextResponse.json(
        { error: 'Missing required config fields' },
        { status: 400 }
      )
    }

    const updatedConfig = await lotteryConfigService.updateConfig(newConfig)
    
    return NextResponse.json({
      success: true,
      data: updatedConfig
    })
  } catch (error) {
    console.error('Admin POST lottery config error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}