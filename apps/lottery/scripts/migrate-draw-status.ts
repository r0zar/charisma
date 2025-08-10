#!/usr/bin/env tsx

/**
 * Data migration script for drawStatus field
 * 
 * This script migrates existing tickets to use the new drawStatus field:
 * - Tickets with status: 'archived' -> drawStatus: 'archived', status: 'confirmed'
 * - All other tickets -> drawStatus: 'active' (or leave undefined for automatic handling)
 */

import { hybridStorage } from '../src/lib/hybrid-storage'
import { LotteryTicket } from '../src/types/lottery'

async function migrateDrawStatus() {
  try {
    console.log('🔄 Starting drawStatus migration...')
    console.log('📊 Analyzing existing ticket data...')
    
    // Get all tickets from storage
    const allTickets = await hybridStorage.getAllLotteryTickets()
    console.log(`📋 Found ${allTickets.length} total tickets`)
    
    if (allTickets.length === 0) {
      console.log('✅ No tickets to migrate')
      return
    }
    
    // Analyze ticket statuses
    const statusCounts = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      archived: 0,
      hasDrawStatus: 0,
      needsMigration: 0
    }
    
    const ticketsToMigrate: LotteryTicket[] = []
    
    for (const ticket of allTickets) {
      // Count status types
      if (ticket.status === 'pending') statusCounts.pending++
      else if (ticket.status === 'confirmed') statusCounts.confirmed++
      else if (ticket.status === 'cancelled') statusCounts.cancelled++
      else if ((ticket as any).status === 'archived') statusCounts.archived++
      
      // Check if already has drawStatus
      if (ticket.drawStatus) {
        statusCounts.hasDrawStatus++
      } else {
        statusCounts.needsMigration++
        ticketsToMigrate.push(ticket)
      }
    }
    
    console.log('📈 Current ticket analysis:')
    console.log(`   - Pending: ${statusCounts.pending}`)
    console.log(`   - Confirmed: ${statusCounts.confirmed}`)
    console.log(`   - Cancelled: ${statusCounts.cancelled}`)
    console.log(`   - Archived (old): ${statusCounts.archived}`)
    console.log(`   - Already has drawStatus: ${statusCounts.hasDrawStatus}`)
    console.log(`   - Needs migration: ${statusCounts.needsMigration}`)
    
    if (ticketsToMigrate.length === 0) {
      console.log('✅ All tickets already migrated!')
      return
    }
    
    console.log(`\n🔧 Starting migration of ${ticketsToMigrate.length} tickets...`)
    
    let migratedCount = 0
    let errorCount = 0
    
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
            archivedAt: ticket.confirmedAt || new Date().toISOString() // Use confirmed time or now
          } as LotteryTicket
          
          // Remove old archived status from the object
          delete (migratedTicket as any).status
          migratedTicket.status = 'confirmed'
          
          console.log(`   📦 Migrated archived ticket ${ticket.id}`)
        } else {
          // Migrate active tickets (pending, confirmed, cancelled)
          migratedTicket = {
            ...ticket,
            drawStatus: 'active'
          }
          console.log(`   ✅ Migrated active ticket ${ticket.id} (status: ${ticket.status})`)
        }
        
        // Save migrated ticket
        await hybridStorage.saveLotteryTicket(migratedTicket)
        migratedCount++
        
        if (migratedCount % 10 === 0) {
          console.log(`   🔄 Progress: ${migratedCount}/${ticketsToMigrate.length} tickets migrated...`)
        }
        
      } catch (error) {
        console.error(`   ❌ Failed to migrate ticket ${ticket.id}:`, error)
        errorCount++
      }
    }
    
    console.log('\n✅ Migration completed!')
    console.log(`📊 Results:`)
    console.log(`   - Successfully migrated: ${migratedCount}`)
    console.log(`   - Errors: ${errorCount}`)
    console.log(`   - Total processed: ${ticketsToMigrate.length}`)
    
    if (errorCount > 0) {
      console.log('⚠️  Some tickets failed to migrate. Check the errors above.')
      process.exit(1)
    } else {
      console.log('🎉 All tickets migrated successfully!')
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateDrawStatus()
    .then(() => {
      console.log('🏁 Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateDrawStatus }