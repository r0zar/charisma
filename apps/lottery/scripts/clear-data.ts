#!/usr/bin/env tsx

import { list, del } from '@vercel/blob'

const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

if (!BLOB_READ_WRITE_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN environment variable is required')
  process.exit(1)
}

// Prefixes for user data that should be cleared
const USER_DATA_PREFIXES = [
  'lottery-tickets/',  // All user tickets
  'lottery-results/',  // All lottery draw results
]

// Files to keep (app configuration)
const KEEP_FILES = [
  'lottery-config.json'  // Keep lottery configuration
]

async function clearUserData() {
  console.log('🧹 Starting user data cleanup...')
  console.log('📋 Keeping: lottery configuration')
  console.log('🗑️ Clearing: tickets and draw results')
  
  try {
    // List all blobs
    const { blobs } = await list({
      token: BLOB_READ_WRITE_TOKEN,
    })

    console.log(`\nFound ${blobs.length} total blobs`)

    // Filter blobs to only include user data
    const userDataBlobs = blobs.filter(blob => {
      // Keep config files
      if (KEEP_FILES.includes(blob.pathname)) {
        console.log(`📌 Keeping: ${blob.pathname}`)
        return false
      }
      
      // Delete user data
      return USER_DATA_PREFIXES.some(prefix => blob.pathname.startsWith(prefix))
    })

    console.log(`Found ${userDataBlobs.length} user data blobs to delete`)

    // Delete user data blobs
    let deletedCount = 0
    let errorCount = 0

    for (const blob of userDataBlobs) {
      try {
        await del(blob.url, { token: BLOB_READ_WRITE_TOKEN })
        deletedCount++
        console.log(`✅ Deleted: ${blob.pathname}`)
      } catch (error) {
        errorCount++
        console.error(`❌ Failed to delete ${blob.pathname}:`, error)
      }
    }

    console.log('\n📊 Cleanup Summary:')
    console.log(`✅ Successfully deleted: ${deletedCount} blobs`)
    console.log(`❌ Failed to delete: ${errorCount} blobs`)
    console.log(`📌 Preserved: ${blobs.length - userDataBlobs.length} config blobs`)
    console.log(`🗂️ Total processed: ${blobs.length} blobs`)
    
    if (deletedCount > 0) {
      console.log('\n🎉 User data cleanup completed! All tickets and draw results have been cleared.')
      console.log('⚙️ App configuration has been preserved.')
    } else {
      console.log('\n💭 No user data found to clear.')
    }

  } catch (error) {
    console.error('Failed to clear user data:', error)
    process.exit(1)
  }
}

// Run the cleanup
clearUserData()