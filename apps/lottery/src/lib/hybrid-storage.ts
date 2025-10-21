import { LotteryTicket, LotteryConfig, LotteryDraw } from '@/types/lottery'
import { kvStorage } from './kv-storage'

/**
 * Hybrid Storage Service (Now KV-Only)
 *
 * This layer now acts as a simple pass-through to KV storage.
 * Blob storage has been removed - all data stored in Vercel KV with no TTL.
 *
 * Kept for backward compatibility - all calls redirect to kvStorage.
 */
export class HybridStorageService {
  
  // ===== LOTTERY TICKETS =====

  async saveLotteryTicket(ticket: LotteryTicket): Promise<void> {
    return await kvStorage.saveLotteryTicket(ticket)
  }

  async getLotteryTicket(ticketId: string): Promise<LotteryTicket | null> {
    return await kvStorage.getLotteryTicket(ticketId)
  }

  async getTicketsByWallet(walletAddress: string): Promise<LotteryTicket[]> {
    return await kvStorage.getTicketsByWallet(walletAddress)
  }

  async getTicketsByDraw(drawId: string, includeArchived: boolean = false): Promise<LotteryTicket[]> {
    return await kvStorage.getTicketsByDraw(drawId, includeArchived)
  }

  async deleteLotteryTicket(ticketId: string): Promise<void> {
    return await kvStorage.deleteLotteryTicket(ticketId)
  }

  async incrementTicketCounter(): Promise<number> {
    return await kvStorage.incrementTicketCounter()
  }

  async getAllLotteryTickets(): Promise<LotteryTicket[]> {
    return await kvStorage.getAllLotteryTickets()
  }

  async getAllActiveTickets(): Promise<LotteryTicket[]> {
    return await kvStorage.getAllActiveTickets()
  }

  // Archive tickets (update status to archived)
  async archiveTicketsForDraw(drawId: string): Promise<void> {
    try {
      console.log('Archiving tickets for draw:', drawId)

      // Get all active tickets for the draw
      const activeTickets = await kvStorage.getTicketsByDraw(drawId, false)

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

        // Save archived ticket to KV
        await kvStorage.saveLotteryTicket(archivedTicket)
      }

      console.log(`Successfully archived ${activeTickets.length} tickets`)
    } catch (error) {
      console.error('Failed to archive tickets for draw:', error)
      throw new Error(`Failed to archive tickets for draw: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // ===== LOTTERY CONFIG =====

  async saveLotteryConfig(config: LotteryConfig): Promise<void> {
    return await kvStorage.saveLotteryConfig(config)
  }

  async getLotteryConfig(): Promise<LotteryConfig | null> {
    return await kvStorage.getLotteryConfig()
  }

  async configExists(): Promise<boolean> {
    return await kvStorage.configExists()
  }

  // ===== LOTTERY DRAWS =====

  async saveLotteryDraw(draw: LotteryDraw): Promise<void> {
    return await kvStorage.saveLotteryDraw(draw)
  }

  async getLotteryDraw(drawId: string): Promise<LotteryDraw | null> {
    return await kvStorage.getLotteryDraw(drawId)
  }

  async getAllLotteryDraws(): Promise<LotteryDraw[]> {
    return await kvStorage.getAllLotteryDraws()
  }

  async getLatestLotteryDraw(): Promise<LotteryDraw | null> {
    return await kvStorage.getLatestLotteryDraw()
  }

  async deleteLotteryDraw(drawId: string): Promise<void> {
    return await kvStorage.deleteLotteryDraw(drawId)
  }

  // ===== COUNTERS =====

  async getDrawCounter(): Promise<number> {
    return await kvStorage.getDrawCounter()
  }

  async incrementDrawCounter(): Promise<number> {
    return await kvStorage.incrementDrawCounter()
  }
}

// Singleton instance
export const hybridStorage = new HybridStorageService()