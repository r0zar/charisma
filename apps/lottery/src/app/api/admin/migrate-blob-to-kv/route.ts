import { NextRequest, NextResponse } from 'next/server'
import { blobStorage } from '@/lib/blob-storage'
import { kvStorage } from '@/lib/kv-storage'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting migration from blob storage to KV...')

    // 1. Migrate config
    console.log('Migrating config...')
    const blobConfig = await blobStorage.getLotteryConfig()
    if (blobConfig) {
      await kvStorage.saveLotteryConfig(blobConfig)
      console.log('✓ Config migrated')
    } else {
      console.log('ℹ No config found in blob storage')
    }

    // 2. Migrate draws
    console.log('Migrating draws...')
    const blobDraws = await blobStorage.getAllLotteryDraws()
    console.log(`Found ${blobDraws.length} draws in blob storage`)

    for (const draw of blobDraws) {
      await kvStorage.saveLotteryDraw(draw)
    }
    console.log(`✓ ${blobDraws.length} draws migrated`)

    // 3. Migrate tickets
    console.log('Migrating tickets...')
    const blobTickets = await blobStorage.getAllLotteryTickets()
    console.log(`Found ${blobTickets.length} tickets in blob storage`)

    // Migrate in batches of 100
    const batchSize = 100
    for (let i = 0; i < blobTickets.length; i += batchSize) {
      const batch = blobTickets.slice(i, i + batchSize)

      for (const ticket of batch) {
        await kvStorage.saveLotteryTicket(ticket)
      }

      console.log(`Migrated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(blobTickets.length / batchSize)}`)
    }
    console.log(`✓ ${blobTickets.length} tickets migrated`)

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      migrated: {
        config: blobConfig ? 1 : 0,
        draws: blobDraws.length,
        tickets: blobTickets.length
      }
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
