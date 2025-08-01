import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LotteryTicket } from '@/types/lottery'

// Mock KV and blob storage
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    mget: vi.fn(),
    del: vi.fn(),
    srem: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    pipeline: vi.fn(() => ({
      set: vi.fn(),
      sadd: vi.fn(),
      expire: vi.fn(),
      srem: vi.fn(),
      del: vi.fn(),
      exec: vi.fn()
    }))
  }
}))

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
  list: vi.fn(() => ({ blobs: [] }))
}))

// This test demonstrates the improvement in UX
describe('Hybrid Storage UX Improvement', () => {
  const mockTicket: LotteryTicket = {
    id: '000001',
    drawId: 'next-draw-2025-01-26',
    walletAddress: 'ST123456789ABCDEFGHIJK',
    purchaseDate: '2025-01-26T12:00:00Z',
    purchasePrice: 1,
    status: 'pending'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should save active tickets to KV for immediate consistency', async () => {
    const { hybridStorage } = await import('../hybrid-storage')
    const { kv } = await import('@vercel/kv')
    
    // Mock KV pipeline
    const mockPipeline = {
      set: vi.fn(),
      sadd: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn()
    }
    vi.mocked(kv.pipeline).mockReturnValue(mockPipeline as any)
    
    await hybridStorage.saveLotteryTicket(mockTicket)
    
    // Verify ticket is saved to KV for immediate access
    expect(kv.pipeline).toHaveBeenCalled()
    expect(mockPipeline.set).toHaveBeenCalledWith(`ticket:${mockTicket.id}`, mockTicket)
    expect(mockPipeline.sadd).toHaveBeenCalledWith(`wallet_tickets:${mockTicket.walletAddress}`, mockTicket.id)
    expect(mockPipeline.sadd).toHaveBeenCalledWith(`draw_tickets:${mockTicket.drawId}`, mockTicket.id)
  })

  it('should move archived tickets to blob storage for long-term storage', async () => {
    const { hybridStorage } = await import('../hybrid-storage')
    const { put } = await import('@vercel/blob')
    
    const archivedTicket: LotteryTicket = {
      ...mockTicket,
      status: 'archived'
    }
    
    await hybridStorage.saveLotteryTicket(archivedTicket)
    
    // Verify archived ticket goes to blob storage
    expect(put).toHaveBeenCalledWith(
      `lottery-tickets/${archivedTicket.id}.json`,
      expect.stringContaining(archivedTicket.id),
      expect.any(Object)
    )
  })

  it('should retrieve tickets from KV first for immediate access', async () => {
    const { hybridStorage } = await import('../hybrid-storage')
    const { kv } = await import('@vercel/kv')
    
    // Mock KV returning ticket IDs and ticket data
    vi.mocked(kv.smembers).mockResolvedValue([mockTicket.id])
    vi.mocked(kv.mget).mockResolvedValue([mockTicket])
    
    const tickets = await hybridStorage.getTicketsByWallet(mockTicket.walletAddress)
    
    expect(tickets).toEqual([mockTicket])
    expect(kv.smembers).toHaveBeenCalledWith(`wallet_tickets:${mockTicket.walletAddress}`)
    expect(kv.mget).toHaveBeenCalledWith(`ticket:${mockTicket.id}`)
  })
})

/**
 * UX Improvement Summary:
 * 
 * BEFORE (Blob Storage Only):
 * - User purchases ticket → Saved to blob storage → Takes up to 60 seconds to be visible
 * - User refreshes page → Still shows old data due to eventual consistency
 * - Poor UX: "Where's my ticket? Did the purchase fail?"
 * 
 * AFTER (Hybrid Storage):
 * - User purchases ticket → Saved to KV immediately → Visible within milliseconds
 * - User refreshes page → Shows ticket immediately from KV
 * - Excellent UX: "My ticket appears instantly!"
 * 
 * Storage Strategy:
 * - KV: Active tickets (pending, confirmed, cancelled) - 24 hour TTL
 * - Blob: Archived tickets, draws, config - Permanent storage
 * - Best of both worlds: Speed + Cost efficiency
 */