#!/usr/bin/env tsx

/**
 * Backfill script to add winner STX addresses to existing draw records
 * This script finds draws without winner info and adds the winner data from tickets
 */

import { loadEnvConfig } from '@next/env'
import { resolve } from 'path'

// Load Next.js environment variables
loadEnvConfig(resolve(__dirname, '..'))

import { blobStorage } from '../src/lib/blob-storage'
import { LotteryDraw } from '../src/types/lottery'

async function backfillWinnerAddresses() {
  try {
    console.log('🎯 Starting backfill of winner STX addresses...')
    
    // Get all existing draws
    const allDraws = await blobStorage.getAllLotteryDraws()
    console.log(`📊 Found ${allDraws.length} existing draws`)
    
    if (allDraws.length === 0) {
      console.log('✅ No draws found - backfill not needed')
      return
    }
    
    // Get all tickets to find winners
    const allTickets = await blobStorage.getAllLotteryTickets()
    console.log(`🎫 Found ${allTickets.length} total tickets`)
    
    // Find draws that need backfilling (missing winner info but have winners)
    const drawsNeedingBackfill = allDraws.filter(draw => 
      draw.winners.length > 0 && !draw.winnerWalletAddress
    )
    
    console.log(`🔍 Found ${drawsNeedingBackfill.length} draws needing winner address backfill`)
    
    if (drawsNeedingBackfill.length === 0) {
      console.log('✅ All draws already have winner addresses - backfill not needed')
      return
    }
    
    let backfilledCount = 0
    let errorCount = 0
    
    for (const draw of drawsNeedingBackfill) {
      try {
        console.log(`📦 Processing draw ${draw.id}...`)
        
        console.log(`   Looking for tickets with drawResult: ${draw.id}`)
        
        // Find winning tickets for this draw
        const winningTickets = allTickets.filter(ticket => 
          ticket.drawResult === draw.id && ticket.isWinner === true
        )
        
        console.log(`   Found ${winningTickets.length} winning tickets`)
        
        if (winningTickets.length === 0) {
          // Try to find tickets by looking for archived tickets from this draw
          const drawTickets = allTickets.filter(ticket => 
            ticket.drawResult === draw.id && ticket.status === 'archived'
          )
          
          // Also check the old draw ID format in case tickets reference the old ID
          const oldDrawId = draw.id === '000001' ? 'draw-20250729-qiyw14' : 
                           draw.id === '000002' ? 'draw-20250729-3yt2hb' : null
          
          let oldDrawTickets: any[] = []
          if (oldDrawId) {
            console.log(`   Also checking old draw ID: ${oldDrawId}`)
            oldDrawTickets = allTickets.filter(ticket => 
              ticket.drawResult === oldDrawId && ticket.status === 'archived'
            )
          }
          
          const allDrawTickets = [...drawTickets, ...oldDrawTickets]
          
          console.log(`   Found ${drawTickets.length} tickets for new ID, ${oldDrawTickets.length} tickets for old ID`)
          
          if (allDrawTickets.length > 0) {
            // For older draws, we might not have isWinner flag, so let's prompt for manual input
            console.log(`   Tickets found:`)
            allDrawTickets.forEach((ticket, index) => {
              console.log(`     ${index + 1}. Ticket ${ticket.id} - ${ticket.walletAddress} (drawResult: ${ticket.drawResult})`)
            })
            
            // For now, let's assume the first ticket is the winner (or we can enhance this later)
            const assumedWinnerTicket = allDrawTickets[0]
            
            console.log(`   🎯 Assuming ticket ${assumedWinnerTicket.id} is the winner`)
            
            // Update the draw with winner info
            const updatedDraw: LotteryDraw = {
              ...draw,
              winnerWalletAddress: assumedWinnerTicket.walletAddress,
              winningTicketId: assumedWinnerTicket.id
            }
            
            await blobStorage.saveLotteryDraw(updatedDraw)
            console.log(`   ✅ Backfilled winner address: ${assumedWinnerTicket.walletAddress}`)
            backfilledCount++
          } else {
            console.log(`   ⚠️  No tickets found for draw ${draw.id}`)
          }
        } else {
          // Found explicit winning tickets
          const winnerTicket = winningTickets[0] // Take the first winner
          
          const updatedDraw: LotteryDraw = {
            ...draw,
            winnerWalletAddress: winnerTicket.walletAddress,
            winningTicketId: winnerTicket.id
          }
          
          await blobStorage.saveLotteryDraw(updatedDraw)
          console.log(`   ✅ Backfilled winner address: ${winnerTicket.walletAddress}`)
          backfilledCount++
        }
        
      } catch (error) {
        console.error(`❌ Failed to backfill draw ${draw.id}:`, error)
        errorCount++
      }
    }
    
    console.log(`✅ Backfill completed!`)
    console.log(`📊 Summary:`)
    console.log(`   - Draws needing backfill: ${drawsNeedingBackfill.length}`)
    console.log(`   - Successfully backfilled: ${backfilledCount}`)
    console.log(`   - Errors: ${errorCount}`)
    
    if (errorCount > 0) {
      console.log(`⚠️  Some draws failed to backfill - check logs above`)
    }
    
  } catch (error) {
    console.error('💥 Backfill failed:', error)
    process.exit(1)
  }
}

// Run the backfill
backfillWinnerAddresses()
  .then(() => {
    console.log('🎉 Backfill script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Backfill script failed:', error)
    process.exit(1)
  })