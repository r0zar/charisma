import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LotteryTicket } from '@/types/lottery'

// Mock KV storage only (blob storage no longer used)
vi.mock('@vercel/kv', () => ({
  kv: {
    set: vi.fn(),
    get: vi.fn(),
    sadd: vi.fn(),
    smembers: vi.fn(),
    scard: vi.fn(),
    mget: vi.fn(),
    del: vi.fn(),
    srem: vi.fn(),
    incr: vi.fn(),
    decr: vi.fn(),
    pipeline: vi.fn(() => ({
      set: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      del: vi.fn(),
      incr: vi.fn(),
      decr: vi.fn(),
      exec: vi.fn()
    }))
  }
}))

// This test demonstrates KV-only storage (no more hybrid)
describe('KV-Only Storage (Blob Storage Removed)', () => {
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

  it('should save all tickets to KV (including archived)', async () => {
    const { hybridStorage } = await import('../hybrid-storage')
    const { kv } = await import('@vercel/kv')

    // Mock KV pipeline
    const mockPipeline = {
      set: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      incr: vi.fn(),
      exec: vi.fn()
    }
    vi.mocked(kv.pipeline).mockReturnValue(mockPipeline as any)
    vi.mocked(kv.get).mockResolvedValue(null) // No existing ticket

    await hybridStorage.saveLotteryTicket(mockTicket)

    // Verify ticket is saved to KV for immediate access (no TTL)
    expect(kv.pipeline).toHaveBeenCalled()
    expect(mockPipeline.set).toHaveBeenCalledWith(`ticket:${mockTicket.id}`, mockTicket)
    expect(mockPipeline.sadd).toHaveBeenCalledWith(`wallet_tickets:${mockTicket.walletAddress}`, mockTicket.id)
    expect(mockPipeline.sadd).toHaveBeenCalledWith(`draw_tickets:${mockTicket.drawId}`, mockTicket.id)
    expect(mockPipeline.sadd).toHaveBeenCalledWith('all_tickets', mockTicket.id)
  })

  it('should save archived tickets to KV (not blob storage)', async () => {
    const { hybridStorage } = await import('../hybrid-storage')
    const { kv } = await import('@vercel/kv')

    const archivedTicket: LotteryTicket = {
      ...mockTicket,
      drawStatus: 'archived'
    }

    // Mock KV pipeline
    const mockPipeline = {
      set: vi.fn(),
      sadd: vi.fn(),
      srem: vi.fn(),
      incr: vi.fn(),
      exec: vi.fn()
    }
    vi.mocked(kv.pipeline).mockReturnValue(mockPipeline as any)
    vi.mocked(kv.get).mockResolvedValue(null)

    await hybridStorage.saveLotteryTicket(archivedTicket)

    // Verify archived ticket goes to KV (no blob storage)
    expect(kv.pipeline).toHaveBeenCalled()
    expect(mockPipeline.set).toHaveBeenCalledWith(`ticket:${archivedTicket.id}`, archivedTicket)
    // Archived tickets removed from active index
    expect(mockPipeline.srem).toHaveBeenCalledWith('all_active_tickets', archivedTicket.id)
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
 * Storage Migration Summary:
 *
 * BEFORE (Blob Storage with eventual consistency):
 * - User purchases ticket → Saved to blob storage → Takes up to 60 seconds to be visible
 * - User refreshes page → Still shows old data
 * - Poor UX: "Where's my ticket? Did the purchase fail?"
 *
 * INTERIM (Hybrid Storage):
 * - KV: Active tickets (24hr TTL) - immediate consistency
 * - Blob: Archived tickets, draws, config - eventual consistency
 * - Better UX but complex dual-storage management
 *
 * NOW (KV-Only):
 * - User purchases ticket → Saved to KV immediately → Visible within milliseconds
 * - All data in KV (tickets, draws, config) - NO TTL, kept forever
 * - Blob storage deprecated (read-only archive)
 * - Excellent UX + Simplified architecture
 *
 * Storage Strategy:
 * - KV: Everything (tickets, draws, config) - No expiration
 * - Blob: Deprecated (kept as read-only backup archive)
 * - Single source of truth: KV
 */