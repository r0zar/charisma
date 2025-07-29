#!/usr/bin/env tsx

/**
 * One-time migration script to archive tickets from the last draw
 * This script finds all non-archived tickets and archives them as if from a completed draw
 */

import { loadEnvConfig } from '@next/env'
import { resolve } from 'path'

// Load Next.js environment variables
loadEnvConfig(resolve(__dirname, '..'))

import { blobStorage } from '../src/lib/blob-storage'
import { ticketService } from '../src/lib/ticket-service'
import { LotteryTicket, LotteryDraw } from '../src/types/lottery'

function generateDrawId(): string {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  return `draw-${timestamp}-${randomSuffix}`
}

async function archiveLastDrawTickets() {
  try {
    console.log('🎯 Starting migration to archive tickets from last draw...')
    
    // Get all tickets
    const allTickets = await blobStorage.getAllLotteryTickets()
    console.log(`📊 Found ${allTickets.length} total tickets`)
    
    // Find all non-archived tickets (these would be from the "last draw")
    const activeTickets = allTickets.filter(ticket => ticket.status !== 'archived')
    console.log(`🎫 Found ${activeTickets.length} active tickets to archive`)
    
    if (activeTickets.length === 0) {
      console.log('✅ No active tickets found - migration not needed')
      return
    }
    
    // Show breakdown of active tickets
    const confirmed = activeTickets.filter(t => t.status === 'confirmed').length
    const pending = activeTickets.filter(t => t.status === 'pending').length
    const cancelled = activeTickets.filter(t => t.status === 'cancelled').length
    
    console.log(`📈 Active ticket breakdown:`)
    console.log(`   - Confirmed: ${confirmed}`)
    console.log(`   - Pending: ${pending}`)
    console.log(`   - Cancelled: ${cancelled}`)
    
    // Create a historical draw record for these archived tickets
    const drawId = generateDrawId()
    console.log(`🎲 Creating historical draw record: ${drawId}`)
    
    const historicalDraw: LotteryDraw = {
      id: drawId,
      drawDate: new Date().toISOString(),
      winningNumbers: [], // Simple format doesn't use numbers
      jackpotAmount: {
        title: "Historical Physical Prize",
        imageUrls: ["https://via.placeholder.com/400x300?text=Historical+Prize"],
        linkUrl: "https://example.com/historical-prize",
        estimatedValue: 0
      },
      totalTicketsSold: confirmed, // Only count confirmed tickets as "sold"
      winners: [], // No winners for this historical draw
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Save the historical draw
    await blobStorage.saveLotteryDraw(historicalDraw)
    console.log(`💾 Saved historical draw record`)
    
    // Archive all active tickets
    console.log(`🗄️  Archiving ${activeTickets.length} tickets...`)
    
    let archivedCount = 0
    for (const ticket of activeTickets) {
      try {
        const archivedTicket: LotteryTicket = {
          ...ticket,
          status: 'archived',
          drawResult: drawId,
          isWinner: false // No winners in this historical migration
        }
        
        await blobStorage.saveLotteryTicket(archivedTicket)
        archivedCount++
        
        if (archivedCount % 10 === 0) {
          console.log(`   📦 Archived ${archivedCount}/${activeTickets.length} tickets...`)
        }
      } catch (error) {
        console.error(`❌ Failed to archive ticket ${ticket.id}:`, error)
        // Continue with other tickets
      }
    }
    
    console.log(`✅ Migration completed successfully!`)
    console.log(`📊 Summary:`)
    console.log(`   - Historical draw created: ${drawId}`)
    console.log(`   - Tickets processed: ${activeTickets.length}`)
    console.log(`   - Tickets archived: ${archivedCount}`)
    console.log(`   - Failed: ${activeTickets.length - archivedCount}`)
    
    if (archivedCount < activeTickets.length) {
      console.log(`⚠️  Some tickets failed to archive - check logs above`)
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
archiveLastDrawTickets()
  .then(() => {
    console.log('🎉 Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error)
    process.exit(1)
  })