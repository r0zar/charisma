#!/usr/bin/env node
/**
 * Script to check environment and configuration
 */

// Load environment variables
import { config } from 'dotenv'
import { join } from 'path'

// Load .env.local from the app directory
config({ path: join(process.cwd(), '.env.local') })

console.log('🔍 Environment Check')
console.log('===================')

console.log('\n🔄 Loading environment from .env.local...')

console.log('\n📝 Environment Variables:')
console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined')
console.log('- KV_URL:', process.env.KV_URL ? `Set (${process.env.KV_URL.substring(0, 20)}...)` : '❌ Missing')
console.log('- BLOB_READ_WRITE_TOKEN:', process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ Missing')
console.log('- KV_REST_API_URL:', process.env.KV_REST_API_URL ? `Set (${process.env.KV_REST_API_URL.substring(0, 30)}...)` : '❌ Missing')
console.log('- KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? '✅ Set' : '❌ Missing')
console.log('- NEXT_PUBLIC_NETWORK:', process.env.NEXT_PUBLIC_NETWORK || 'undefined')

console.log('\n📦 Required for snapshots:')
const hasKV = !!process.env.KV_URL
const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN
console.log('- KV Storage:', hasKV ? '✅' : '❌')
console.log('- Blob Storage:', hasBlob ? '✅' : '❌')

if (!hasKV || !hasBlob) {
  console.log('\n⚠️  Snapshot functionality is in DEMO MODE because:')
  if (!hasKV) console.log('   - KV_URL is missing (needed for balance storage)')
  if (!hasBlob) console.log('   - BLOB_READ_WRITE_TOKEN is missing (needed for snapshot files)')
  console.log('\n💡 To enable real snapshots:')
  console.log('   1. Set up Vercel KV database')
  console.log('   2. Set up Vercel Blob storage') 
  console.log('   3. Add environment variables to .env.local')
} else {
  console.log('\n✅ All required environment variables are present!')
}

console.log('\n🔄 Testing imports...')
try {
  console.log('- Importing @services/balances...')
  // Just test the import without initializing
  const balanceModule = require('@services/balances')
  console.log('✅ @services/balances imports successfully')
  console.log('- Available exports:', Object.keys(balanceModule))
} catch (error) {
  console.log('❌ Failed to import @services/balances:', error instanceof Error ? error.message : String(error))
}

console.log('\n📋 Summary:')
if (hasKV && hasBlob) {
  console.log('✅ Configuration looks good for real snapshots!')
} else {
  console.log('❌ Missing configuration - snapshots will be in demo mode')
  console.log('   This explains why getSnapshotMetadata() returns null')
}