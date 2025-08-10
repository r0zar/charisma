import { kv } from '@vercel/kv'
import { LotteryTicket } from '@/types/lottery'

const TICKET_PREFIX = 'ticket:'
const WALLET_TICKETS_PREFIX = 'wallet_tickets:'
const DRAW_TICKETS_PREFIX = 'draw_tickets:'
const TICKET_COUNTER_KEY = 'ticket_counter'

export class KVTicketStorageService {
  // Save a lottery ticket with immediate consistency
  async saveLotteryTicket(ticket: LotteryTicket): Promise<void> {
    try {
      console.log('Saving ticket to KV:', ticket.id)
      
      // Use pipeline for atomic operations
      const pipeline = kv.pipeline()
      
      // 1. Save the ticket data
      pipeline.set(`${TICKET_PREFIX}${ticket.id}`, ticket)
      
      // 2. Add to wallet index (for fast wallet-based queries)
      pipeline.sadd(`${WALLET_TICKETS_PREFIX}${ticket.walletAddress}`, ticket.id)
      
      // 3. Add to draw index (for fast draw-based queries)
      pipeline.sadd(`${DRAW_TICKETS_PREFIX}${ticket.drawId}`, ticket.id)
      
      // 4. Set expiration for active tickets (24 hours), archived tickets (30 days)
      const ttl = ticket.drawStatus === 'archived' ? 30 * 24 * 60 * 60 : 24 * 60 * 60
      pipeline.expire(`${TICKET_PREFIX}${ticket.id}`, ttl)
      
      await pipeline.exec()
      
      console.log('Ticket saved to KV successfully:', ticket.id)
    } catch (error) {
      console.error('Failed to save ticket to KV:', error)
      throw new Error(`Failed to save ticket to KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get a single lottery ticket
  async getLotteryTicket(ticketId: string): Promise<LotteryTicket | null> {
    try {
      const ticket = await kv.get<LotteryTicket>(`${TICKET_PREFIX}${ticketId}`)
      return ticket
    } catch (error) {
      console.error('Failed to get ticket from KV:', error)
      throw new Error(`Failed to get ticket from KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get all tickets for a wallet (fast lookup using wallet index)
  async getTicketsByWallet(walletAddress: string): Promise<LotteryTicket[]> {
    try {
      console.log('Getting tickets for wallet from KV:', walletAddress)
      
      // Get ticket IDs from wallet index
      const ticketIds = await kv.smembers(`${WALLET_TICKETS_PREFIX}${walletAddress}`)
      
      if (!ticketIds || ticketIds.length === 0) {
        console.log('No ticket IDs found for wallet:', walletAddress)
        return []
      }
      
      console.log('Found ticket IDs for wallet:', ticketIds)
      
      // Batch get all tickets
      const ticketKeys = ticketIds.map(id => `${TICKET_PREFIX}${id}`)
      const tickets = await kv.mget<LotteryTicket[]>(...ticketKeys)
      
      // Filter out null values and sort by purchase date (newest first)
      const validTickets = tickets.filter((ticket): ticket is LotteryTicket => ticket !== null)
      return validTickets.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get tickets by wallet from KV:', error)
      throw new Error(`Failed to get tickets by wallet from KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get all tickets for a draw (fast lookup using draw index)
  async getTicketsByDraw(drawId: string, includeArchived: boolean = false): Promise<LotteryTicket[]> {
    try {
      // Get ticket IDs from draw index
      const ticketIds = await kv.smembers(`${DRAW_TICKETS_PREFIX}${drawId}`)
      
      if (!ticketIds || ticketIds.length === 0) {
        return []
      }
      
      // Batch get all tickets
      const ticketKeys = ticketIds.map(id => `${TICKET_PREFIX}${id}`)
      const tickets = await kv.mget<LotteryTicket[]>(...ticketKeys)
      
      // Filter out null values and optionally exclude archived
      let validTickets = tickets.filter((ticket): ticket is LotteryTicket => ticket !== null)
      
      if (!includeArchived) {
        validTickets = validTickets.filter(ticket => ticket.drawStatus !== 'archived')
      }
      
      // Sort by purchase date (oldest first for draws)
      return validTickets.sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get tickets by draw from KV:', error)
      throw new Error(`Failed to get tickets by draw from KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Delete a ticket (cleanup from indexes too)
  async deleteLotteryTicket(ticketId: string): Promise<void> {
    try {
      // First get the ticket to access its wallet and draw for index cleanup
      const ticket = await this.getLotteryTicket(ticketId)
      
      if (ticket) {
        const pipeline = kv.pipeline()
        
        // Remove from all indexes
        pipeline.del(`${TICKET_PREFIX}${ticketId}`)
        pipeline.srem(`${WALLET_TICKETS_PREFIX}${ticket.walletAddress}`, ticketId)
        pipeline.srem(`${DRAW_TICKETS_PREFIX}${ticket.drawId}`, ticketId)
        
        await pipeline.exec()
      } else {
        // Just try to delete the ticket key if we can't find it
        await kv.del(`${TICKET_PREFIX}${ticketId}`)
      }
      
      console.log('Ticket deleted from KV successfully:', ticketId)
    } catch (error) {
      console.error('Failed to delete ticket from KV:', error)
      throw new Error(`Failed to delete ticket from KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get and increment ticket counter atomically
  async incrementTicketCounter(): Promise<number> {
    try {
      const counter = await kv.incr(TICKET_COUNTER_KEY)
      // Return the value before increment (the one to use for this ticket)
      return counter - 1 || 1
    } catch (error) {
      console.error('Failed to increment ticket counter in KV:', error)
      throw new Error(`Failed to increment ticket counter in KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clean up expired data from indexes (should be run periodically)
  async cleanupExpiredIndexes(): Promise<void> {
    try {
      console.log('Starting KV index cleanup...')
      
      // This is a maintenance operation that could be run via cron
      // For now, we'll rely on TTL to clean up the main ticket data
      // The indexes will have stale references but they'll be filtered out during queries
      
      console.log('KV index cleanup completed')
    } catch (error) {
      console.error('Failed to cleanup KV indexes:', error)
    }
  }

  // Archive tickets (extend TTL and update status)
  async archiveTickets(ticketIds: string[]): Promise<void> {
    try {
      console.log('Archiving tickets in KV:', ticketIds)
      
      const pipeline = kv.pipeline()
      
      for (const ticketId of ticketIds) {
        // Get the ticket first
        const ticket = await this.getLotteryTicket(ticketId)
        if (ticket) {
          // Update status to archived
          const archivedTicket: LotteryTicket = {
            ...ticket,
            drawStatus: 'archived',
            archivedAt: new Date().toISOString()
          }
          
          // Save with extended TTL (30 days)
          pipeline.set(`${TICKET_PREFIX}${ticketId}`, archivedTicket)
          pipeline.expire(`${TICKET_PREFIX}${ticketId}`, 30 * 24 * 60 * 60)
        }
      }
      
      await pipeline.exec()
      console.log('Tickets archived in KV successfully')
    } catch (error) {
      console.error('Failed to archive tickets in KV:', error)
      throw new Error(`Failed to archive tickets in KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Singleton instance
export const kvTicketStorage = new KVTicketStorageService()