#!/usr/bin/env tsx

// Load environment variables from .env.local - use require for Node.js compatibility
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

import { blobStorage } from '../src/lib/blob-storage'
import { LotteryTicket } from '../src/types/lottery'

async function migrateTicketIds() {
  try {
    console.log('🔍 Fetching existing tickets...')
    
    // Get all existing tickets
    const existingTickets = await blobStorage.getAllLotteryTickets()
    
    if (existingTickets.length === 0) {
      console.log('✅ No existing tickets found. Migration not needed.')
      return
    }

    console.log(`📊 Found ${existingTickets.length} tickets to migrate`)
    
    // Filter tickets that have old random ID format
    const ticketsToMigrate = existingTickets.filter(ticket => 
      ticket.id.startsWith('ticket-') && ticket.id.includes('-')
    )
    
    if (ticketsToMigrate.length === 0) {
      console.log('✅ All tickets already use new ID format. Migration not needed.')
      return
    }

    console.log(`🔄 Migrating ${ticketsToMigrate.length} tickets with old ID format...`)
    
    // Sort by purchase date to maintain chronological order
    ticketsToMigrate.sort((a, b) => 
      new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    )

    let migratedCount = 0
    
    for (let i = 0; i < ticketsToMigrate.length; i++) {
      const oldTicket = ticketsToMigrate[i]
      const newId = (i + 1).toString().padStart(6, '0')
      
      // Create ticket with new ID
      const newTicket: LotteryTicket = {
        ...oldTicket,
        id: newId
      }
      
      try {
        // Save ticket with new ID
        await blobStorage.saveLotteryTicket(newTicket)
        
        // Delete old ticket
        await blobStorage.deleteLotteryTicket(oldTicket.id)
        
        migratedCount++
        console.log(`✅ Migrated: ${oldTicket.id} → ${newId}`)
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`❌ Failed to migrate ticket ${oldTicket.id}:`, error)
      }
    }
    
    // Set the counter to start after the migrated tickets
    const nextCounter = ticketsToMigrate.length + 1
    console.log(`🔢 Setting ticket counter to start at ${nextCounter}`)
    
    try {
      // Save the counter directly
      const counterData = { counter: nextCounter }
      const counterJson = JSON.stringify(counterData, null, 2)
      
      // Use the put function from @vercel/blob directly
      const { put } = await import('@vercel/blob')
      await put('ticket-counter.json', counterJson, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        contentType: 'application/json',
        allowOverwrite: true,
      })
      
      console.log(`✅ Ticket counter set to ${nextCounter}`)
    } catch (error) {
      console.error('❌ Failed to set ticket counter:', error)
    }
    
    console.log(`\n🎉 Migration complete!`)
    console.log(`📊 Summary:`)
    console.log(`   - Tickets migrated: ${migratedCount}/${ticketsToMigrate.length}`)
    console.log(`   - Next ticket ID will be: ${nextCounter.toString().padStart(6, '0')}`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateTicketIds()
    .then(() => {
      console.log('🏁 Migration script finished')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error)
      process.exit(1)
    })
}

export { migrateTicketIds }