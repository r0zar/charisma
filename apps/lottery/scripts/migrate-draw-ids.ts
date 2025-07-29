#!/usr/bin/env tsx

/**
 * Migration script to update existing draw IDs from random format to incrementing format
 * This script finds all existing draws and updates them to use the new ID system
 */

import { loadEnvConfig } from '@next/env'
import { resolve } from 'path'

// Load Next.js environment variables
loadEnvConfig(resolve(__dirname, '..'))

import { blobStorage } from '../src/lib/blob-storage'
import { LotteryDraw } from '../src/types/lottery'

async function migrateDrawIds() {
  try {
    console.log('🎯 Starting migration to update draw IDs...')
    
    // Get all existing draws
    const allDraws = await blobStorage.getAllLotteryDraws()
    console.log(`📊 Found ${allDraws.length} existing draws`)
    
    if (allDraws.length === 0) {
      console.log('✅ No draws found - migration not needed')
      return
    }
    
    // Sort draws by date to maintain chronological order
    const sortedDraws = allDraws.sort((a, b) => 
      new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime()
    )
    
    console.log('📈 Existing draws (chronological order):')
    sortedDraws.forEach((draw, index) => {
      console.log(`   ${index + 1}. ${draw.id} - ${new Date(draw.drawDate).toLocaleDateString()}`)
    })
    
    // Get current draw counter to start from the right number (or 1 if not exists)
    let currentCounter = 1
    try {
      currentCounter = await blobStorage.getDrawCounter()
      console.log(`🔢 Current draw counter: ${currentCounter}`)
    } catch (error) {
      console.log(`🔢 No existing draw counter found, starting from 1`)
    }
    
    // Check if migration is needed
    const needsMigration = sortedDraws.some(draw => 
      !draw.id.match(/^\d{6}$/) // Check if ID is not 6-digit format
    )
    
    if (!needsMigration) {
      console.log('✅ All draws already use the new ID format - migration not needed')
      return
    }
    
    console.log(`🔄 Migrating ${sortedDraws.length} draws to new ID format...`)
    
    let migratedCount = 0
    let errorCount = 0
    
    for (let i = 0; i < sortedDraws.length; i++) {
      const draw = sortedDraws[i]
      const newDrawId = (i + 1).toString().padStart(6, '0') // 000001, 000002, etc.
      
      try {
        console.log(`📦 Migrating draw ${draw.id} -> ${newDrawId}`)
        
        // Create updated draw with new ID
        const updatedDraw: LotteryDraw = {
          ...draw,
          id: newDrawId
        }
        
        // Save draw with new ID
        await blobStorage.saveLotteryDraw(updatedDraw)
        
        // Delete old draw record if ID changed
        if (draw.id !== newDrawId) {
          try {
            await blobStorage.deleteLotteryDraw(draw.id)
            console.log(`   ✅ Migrated and deleted old record: ${draw.id} -> ${newDrawId}`)
          } catch (deleteError) {
            console.log(`   ⚠️  Migrated but couldn't delete old record: ${draw.id}`)
          }
        }
        
        migratedCount++
        
      } catch (error) {
        console.error(`❌ Failed to migrate draw ${draw.id}:`, error)
        errorCount++
      }
    }
    
    // Update the draw counter to be ready for the next draw
    const nextCounter = sortedDraws.length + 1
    try {
      // Set counter to the next number
      const counterData = { counter: nextCounter }
      const counterJson = JSON.stringify(counterData, null, 2)
      
      await (await import('@vercel/blob')).put('draw-counter.json', counterJson, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN!,
        contentType: 'application/json',
        allowOverwrite: true,
      })
      
      console.log(`🔢 Updated draw counter to ${nextCounter} for next draw`)
      
    } catch (counterError) {
      console.error('⚠️  Failed to update draw counter:', counterError)
    }
    
    console.log(`✅ Migration completed!`)
    console.log(`📊 Summary:`)
    console.log(`   - Draws processed: ${sortedDraws.length}`)
    console.log(`   - Successfully migrated: ${migratedCount}`)
    console.log(`   - Errors: ${errorCount}`)
    console.log(`   - Next draw ID will be: ${(nextCounter).toString().padStart(6, '0')}`)
    
    if (errorCount > 0) {
      console.log(`⚠️  Some draws failed to migrate - check logs above`)
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
migrateDrawIds()
  .then(() => {
    console.log('🎉 Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error)
    process.exit(1)
  })