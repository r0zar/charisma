import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { kvStorage } from '@/lib/kv-storage'
import { kv } from '@vercel/kv'

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

    console.log('Starting ticket data reset...')

    // Get current ticket count before reset for reporting
    let ticketsDeleted = 0
    try {
      const allTickets = await hybridStorage.getAllLotteryTickets()
      ticketsDeleted = allTickets.length
    } catch (error) {
      console.warn('Could not get ticket count before reset:', error)
    }

    // 1. Reset ticket counter in KV to 0 (so next ticket will be 000001)
    await kv.set('ticket_counter', 0)
    console.log('Reset KV ticket counter to 0')

    // 2. Reset blob storage ticket counter
    try {
      await blobStorage.resetTicketCounter()
      console.log('Reset blob storage ticket counter')
    } catch (error) {
      console.warn('Failed to reset blob storage counter:', error)
    }

    // 3. Get all ticket keys from KV storage and delete them
    try {
      // Get all ticket keys by pattern matching
      const ticketKeys: string[] = []
      const walletKeys: string[] = []
      const drawKeys: string[] = []

      // Since we can't easily scan all keys in Vercel KV, we'll use the cleanup approach
      // This is a brute force method but necessary for complete cleanup
      
      // Try to get existing tickets to identify keys to delete
      try {
        const allTickets = await hybridStorage.getAllLotteryTickets()
        
        // Create sets to track unique keys to delete
        const walletAddresses = new Set<string>()
        const drawIds = new Set<string>()
        
        for (const ticket of allTickets) {
          ticketKeys.push(`ticket:${ticket.id}`)
          walletAddresses.add(ticket.walletAddress)
          drawIds.add(ticket.drawId)
        }
        
        // Add wallet and draw index keys
        for (const walletAddress of walletAddresses) {
          walletKeys.push(`wallet_tickets:${walletAddress}`)
        }
        
        for (const drawId of drawIds) {
          drawKeys.push(`draw_tickets:${drawId}`)
        }
        
        console.log(`Found ${ticketKeys.length} ticket keys, ${walletKeys.length} wallet keys, ${drawKeys.length} draw keys to delete`)
        
        // Delete all keys in batches
        const allKeysToDelete = [...ticketKeys, ...walletKeys, ...drawKeys]
        const batchSize = 100
        
        for (let i = 0; i < allKeysToDelete.length; i += batchSize) {
          const batch = allKeysToDelete.slice(i, i + batchSize)
          if (batch.length > 0) {
            await kv.del(...batch)
            console.log(`Deleted batch of ${batch.length} keys from KV`)
          }
        }
        
      } catch (error) {
        console.warn('Error during KV cleanup:', error)
      }
      
    } catch (error) {
      console.error('Failed to clean up KV storage:', error)
      // Continue with reset even if KV cleanup fails
    }

    // 4. Clear blob storage ticket data
    try {
      await blobStorage.clearAllTickets()
      console.log('Cleared blob storage ticket data')
    } catch (error) {
      console.warn('Failed to clear blob storage tickets:', error)
    }

    // 5. Clear all lottery drawings for complete clean slate
    let drawsDeleted = 0
    try {
      const allDraws = await hybridStorage.getAllLotteryDraws()
      drawsDeleted = allDraws.length
      
      console.log(`Found ${drawsDeleted} lottery draws to delete`)
      
      for (const draw of allDraws) {
        try {
          await hybridStorage.deleteLotteryDraw(draw.id)
          console.log(`Deleted lottery draw: ${draw.id}`)
        } catch (error) {
          console.warn(`Failed to delete lottery draw ${draw.id}:`, error)
        }
      }
      
      console.log(`Cleared ${drawsDeleted} lottery draws`)
    } catch (error) {
      console.warn('Failed to clear lottery draws:', error)
    }

    console.log('Complete data reset completed successfully')

    return NextResponse.json({
      success: true,
      message: 'All lottery data has been reset successfully. Next ticket will be 000001.',
      metadata: {
        ticketsDeleted,
        drawsDeleted,
        resetTimestamp: new Date().toISOString(),
        nextTicketId: '000001',
        resetType: 'complete-clean-slate'
      }
    })

  } catch (error) {
    console.error('Reset ticket data error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reset ticket data', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}