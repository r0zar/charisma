import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { LotteryTicket } from '@/types/lottery'

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

    console.log('Starting drawStatus migration...')
    
    // Get all tickets from storage
    const allTickets = await hybridStorage.getAllLotteryTickets()
    console.log(`Found ${allTickets.length} total tickets`)
    
    if (allTickets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tickets to migrate',
        data: {
          totalTickets: 0,
          migrated: 0,
          alreadyMigrated: 0,
          errors: 0
        }
      })
    }
    
    // Analyze and migrate tickets
    const stats = {
      totalTickets: allTickets.length,
      migrated: 0,
      alreadyMigrated: 0,
      errors: 0,
      archived: 0,
      active: 0
    }
    
    const ticketsToMigrate: LotteryTicket[] = []
    
    for (const ticket of allTickets) {
      if (ticket.drawStatus) {
        stats.alreadyMigrated++
      } else {
        ticketsToMigrate.push(ticket)
      }
    }
    
    console.log(`Need to migrate ${ticketsToMigrate.length} tickets`)
    
    for (const ticket of ticketsToMigrate) {
      try {
        let migratedTicket: LotteryTicket
        
        // Check if this ticket has the old 'archived' status
        if ((ticket as any).status === 'archived') {
          // Migrate archived tickets
          migratedTicket = {
            ...ticket,
            status: 'confirmed', // Most archived tickets were confirmed before archiving
            drawStatus: 'archived',
            archivedAt: ticket.confirmedAt || new Date().toISOString()
          } as LotteryTicket
          
          stats.archived++
          console.log(`Migrated archived ticket ${ticket.id}`)
        } else {
          // Migrate active tickets (pending, confirmed, cancelled)
          migratedTicket = {
            ...ticket,
            drawStatus: 'active'
          }
          stats.active++
          console.log(`Migrated active ticket ${ticket.id}`)
        }
        
        // Save migrated ticket
        await hybridStorage.saveLotteryTicket(migratedTicket)
        stats.migrated++
        
      } catch (error) {
        console.error(`Failed to migrate ticket ${ticket.id}:`, error)
        stats.errors++
      }
    }
    
    const message = `Migration completed: ${stats.migrated} tickets migrated (${stats.archived} archived, ${stats.active} active)${stats.errors > 0 ? `, ${stats.errors} errors` : ''}`
    
    return NextResponse.json({
      success: true,
      message,
      data: stats
    })
    
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}