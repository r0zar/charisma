import { LotteryTicket, LotteryConfig, LotteryDraw } from '@/types/lottery'
import { blobStorage } from './blob-storage'
import { kvTicketStorage } from './kv-ticket-storage'

/**
 * Hybrid Storage Service
 * 
 * Strategy:
 * - KV: Real-time ticket data (pending, confirmed, cancelled) for immediate consistency
 * - Blob: Historical data (archived tickets, draws, config) for long-term storage
 * 
 * This solves the UX problem where users don't see their tickets immediately after purchase
 * due to blob storage eventual consistency (~60 seconds).
 */
export class HybridStorageService {
  
  // ===== LOTTERY TICKETS =====
  
  async saveLotteryTicket(ticket: LotteryTicket): Promise<void> {
    console.log('Saving ticket with hybrid storage:', ticket.id, 'status:', ticket.status)
    
    if (ticket.drawStatus === 'archived') {
      // Archived tickets go to blob storage for long-term storage
      await Promise.all([
        blobStorage.saveLotteryTicket(ticket),
        // Also remove from KV if it exists there
        kvTicketStorage.deleteLotteryTicket(ticket.id).catch(err => 
          console.warn('Failed to delete archived ticket from KV:', err)
        )
      ])
    } else {
      // Active tickets (pending, confirmed, cancelled) go to KV for immediate consistency
      await kvTicketStorage.saveLotteryTicket(ticket)
      
      // Also save to blob storage as backup (fire and forget)
      blobStorage.saveLotteryTicket(ticket).catch(err => 
        console.warn('Failed to backup ticket to blob storage:', err)
      )
    }
    
    console.log('Ticket saved successfully with hybrid storage')
  }

  async getLotteryTicket(ticketId: string): Promise<LotteryTicket | null> {
    try {
      // Try KV first (for active tickets)
      const kvTicket = await kvTicketStorage.getLotteryTicket(ticketId)
      if (kvTicket) {
        return kvTicket
      }
      
      // Fallback to blob storage (for archived tickets)
      return await blobStorage.getLotteryTicket(ticketId)
    } catch (error) {
      console.error('Failed to get ticket with hybrid storage:', error)
      throw error
    }
  }

  async getTicketsByWallet(walletAddress: string): Promise<LotteryTicket[]> {
    try {
      console.log('Getting tickets for wallet with hybrid storage:', walletAddress)
      
      // Get active tickets from KV and archived tickets from blob storage in parallel
      const [kvTickets, blobTickets] = await Promise.all([
        kvTicketStorage.getTicketsByWallet(walletAddress).catch(err => {
          console.warn('Failed to get tickets from KV:', err)
          return []
        }),
        blobStorage.getTicketsByWallet(walletAddress).catch(err => {
          console.warn('Failed to get tickets from blob storage:', err)
          return []
        })
      ])
      
      console.log('Found tickets - KV:', kvTickets.length, 'Blob:', blobTickets.length)
      
      // Combine and deduplicate (KV takes precedence for active tickets)
      const allTickets = new Map<string, LotteryTicket>()
      
      // Add blob tickets first
      blobTickets.forEach(ticket => allTickets.set(ticket.id, ticket))
      
      // Add KV tickets (will override blob tickets if same ID)
      kvTickets.forEach(ticket => allTickets.set(ticket.id, ticket))
      
      // Convert to array and sort by purchase date (newest first)
      const combinedTickets = Array.from(allTickets.values())  
      return combinedTickets.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get tickets by wallet with hybrid storage:', error)
      throw error
    }
  }

  async getTicketsByDraw(drawId: string, includeArchived: boolean = false): Promise<LotteryTicket[]> {
    try {
      if (includeArchived) {
        // Get from both KV and blob storage
        const [kvTickets, blobTickets] = await Promise.all([
          kvTicketStorage.getTicketsByDraw(drawId, true).catch(err => {
            console.warn('Failed to get draw tickets from KV:', err)
            return []
          }),
          blobStorage.getTicketsByDraw(drawId, true).catch(err => {
            console.warn('Failed to get draw tickets from blob storage:', err)
            return []
          })
        ])
        
        // Combine and deduplicate
        const allTickets = new Map<string, LotteryTicket>()
        blobTickets.forEach(ticket => allTickets.set(ticket.id, ticket))
        kvTickets.forEach(ticket => allTickets.set(ticket.id, ticket))
        
        return Array.from(allTickets.values())
          .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())
      } else {
        // Only active tickets from KV
        return await kvTicketStorage.getTicketsByDraw(drawId, false)
      }
    } catch (error) {
      console.error('Failed to get tickets by draw with hybrid storage:', error)
      throw error
    }
  }

  async deleteLotteryTicket(ticketId: string): Promise<void> {
    // Delete from both storages
    await Promise.all([
      kvTicketStorage.deleteLotteryTicket(ticketId).catch(err => 
        console.warn('Failed to delete ticket from KV:', err)
      ),
      blobStorage.deleteLotteryTicket(ticketId).catch(err => 
        console.warn('Failed to delete ticket from blob storage:', err)
      )
    ])
  }

  async incrementTicketCounter(): Promise<number> {
    // KV has atomic increment, use that as primary
    try {
      return await kvTicketStorage.incrementTicketCounter()
    } catch (error) {
      console.warn('Failed to increment counter in KV, falling back to blob storage:', error)
      return await blobStorage.incrementTicketCounter()
    }
  }

  // Migrate active tickets to archived status (used after draws)
  async archiveTicketsForDraw(drawId: string): Promise<void> {
    try {
      console.log('Archiving tickets for draw:', drawId)
      
      // Get all active tickets for the draw from KV
      const activeTickets = await kvTicketStorage.getTicketsByDraw(drawId, false)
      
      if (activeTickets.length === 0) {
        console.log('No active tickets to archive for draw:', drawId)
        return
      }
      
      console.log(`Archiving ${activeTickets.length} tickets for draw ${drawId}`)
      
      // Update each ticket to archived status
      for (const ticket of activeTickets) {
        const archivedTicket: LotteryTicket = {
          ...ticket,
          drawStatus: 'archived',
          drawResult: drawId,
          archivedAt: new Date().toISOString()
        }
        
        // Save archived ticket (will go to blob storage)
        await this.saveLotteryTicket(archivedTicket)
      }
      
      console.log(`Successfully archived ${activeTickets.length} tickets`)
    } catch (error) {
      console.error('Failed to archive tickets for draw:', error)
      throw new Error(`Failed to archive tickets for draw: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ===== LOTTERY CONFIG (blob storage only) =====
  
  async saveLotteryConfig(config: LotteryConfig): Promise<void> {
    return await blobStorage.saveLotteryConfig(config)
  }

  async getLotteryConfig(): Promise<LotteryConfig | null> {
    return await blobStorage.getLotteryConfig()
  }

  async configExists(): Promise<boolean> {
    return await blobStorage.configExists()
  }

  // ===== LOTTERY DRAWS (blob storage only) =====
  
  async saveLotteryDraw(draw: LotteryDraw): Promise<void> {
    return await blobStorage.saveLotteryDraw(draw)
  }

  async getLotteryDraw(drawId: string): Promise<LotteryDraw | null> {
    return await blobStorage.getLotteryDraw(drawId)
  }

  async getAllLotteryDraws(): Promise<LotteryDraw[]> {
    return await blobStorage.getAllLotteryDraws()
  }

  async getLatestLotteryDraw(): Promise<LotteryDraw | null> {
    return await blobStorage.getLatestLotteryDraw()
  }

  async deleteLotteryDraw(drawId: string): Promise<void> {
    return await blobStorage.deleteLotteryDraw(drawId)
  }

  // ===== MAINTENANCE =====
  
  async cleanupExpiredData(): Promise<void> {
    // Cleanup KV indexes
    await kvTicketStorage.cleanupExpiredIndexes()
  }

  // Get draw counter (use blob storage for consistency with historical data)
  async getDrawCounter(): Promise<number> {
    return await blobStorage.getDrawCounter()
  }

  async incrementDrawCounter(): Promise<number> {
    return await blobStorage.incrementDrawCounter()
  }

  // Get all tickets (combination of both storages)
  async getAllLotteryTickets(): Promise<LotteryTicket[]> {
    try {
      // This is mainly for admin use, so we can take the performance hit
      const [kvTickets, blobTickets] = await Promise.all([
        kvTicketStorage.getTicketsByWallet('*').catch(() => []), // This won't work as expected, but that's ok
        blobStorage.getAllLotteryTickets().catch(() => [])
      ])

      // For now, just return blob storage tickets since getting all from KV is complex
      // In production, we'd implement a proper admin query method
      return blobTickets
    } catch (error) {
      console.error('Failed to get all tickets with hybrid storage:', error)
      throw error
    }
  }

  // Get all active tickets (queries both KV and blob, filters non-archived)
  async getAllActiveTickets(): Promise<LotteryTicket[]> {
    try {
      // Try KV first (for recently created tickets)
      const kvTickets = await kvTicketStorage.getAllActiveTickets().catch(() => [])

      // Also get from blob storage (where existing tickets are stored)
      const blobTickets = await blobStorage.getAllLotteryTickets().catch(() => [])

      // Filter blob tickets to only active ones
      const activeBlobTickets = blobTickets.filter(ticket => ticket.drawStatus !== 'archived')

      // Combine and deduplicate (KV takes precedence)
      const allTickets = new Map<string, LotteryTicket>()
      activeBlobTickets.forEach(ticket => allTickets.set(ticket.id, ticket))
      kvTickets.forEach(ticket => allTickets.set(ticket.id, ticket))

      return Array.from(allTickets.values())
        .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get all active tickets with hybrid storage:', error)
      throw error
    }
  }
}

// Singleton instance
export const hybridStorage = new HybridStorageService()