import { kv } from '@vercel/kv'
import { LotteryTicket } from '@/types/lottery'

const TICKET_PREFIX = 'ticket:'
const WALLET_TICKETS_PREFIX = 'wallet_tickets:'
const DRAW_TICKETS_PREFIX = 'draw_tickets:'
const ALL_ACTIVE_TICKETS_KEY = 'all_active_tickets'
const TICKET_COUNTER_KEY = 'ticket_counter'

// Stats counters for fast analytics
const STATS_TOTAL_TICKETS = 'stats:total_tickets'
const STATS_CONFIRMED_TICKETS = 'stats:confirmed_tickets'
const STATS_PENDING_TICKETS = 'stats:pending_tickets'
const STATS_CANCELLED_TICKETS = 'stats:cancelled_tickets'
const STATS_UNIQUE_WALLETS = 'stats:unique_wallets'

export class KVTicketStorageService {
  // Save a lottery ticket with immediate consistency
  async saveLotteryTicket(ticket: LotteryTicket): Promise<void> {
    try {
      console.log('Saving ticket to KV:', ticket.id)

      // Check if ticket already exists to determine if it's new or update
      const existingTicket = await kv.get<LotteryTicket>(`${TICKET_PREFIX}${ticket.id}`)
      const isNewTicket = !existingTicket

      // Use pipeline for atomic operations
      const pipeline = kv.pipeline()

      // 1. Save the ticket data
      pipeline.set(`${TICKET_PREFIX}${ticket.id}`, ticket)

      // 2. Add to wallet index (for fast wallet-based queries)
      pipeline.sadd(`${WALLET_TICKETS_PREFIX}${ticket.walletAddress}`, ticket.id)

      // 3. Add to draw index (for fast draw-based queries)
      pipeline.sadd(`${DRAW_TICKETS_PREFIX}${ticket.drawId}`, ticket.id)

      // 4. Add to global active tickets index (for fast admin queries)
      if (ticket.drawStatus !== 'archived') {
        pipeline.sadd(ALL_ACTIVE_TICKETS_KEY, ticket.id)
      } else {
        // Remove from active index if archived
        pipeline.srem(ALL_ACTIVE_TICKETS_KEY, ticket.id)
      }

      // 5. Update stats counters
      if (isNewTicket) {
        // New ticket: increment total and status-specific counter
        pipeline.incr(STATS_TOTAL_TICKETS)
        pipeline.sadd(STATS_UNIQUE_WALLETS, ticket.walletAddress)

        if (ticket.status === 'confirmed') {
          pipeline.incr(STATS_CONFIRMED_TICKETS)
        } else if (ticket.status === 'pending') {
          pipeline.incr(STATS_PENDING_TICKETS)
        } else if (ticket.status === 'cancelled') {
          pipeline.incr(STATS_CANCELLED_TICKETS)
        }
      } else if (existingTicket && existingTicket.status !== ticket.status) {
        // Status changed: decrement old, increment new
        if (existingTicket.status === 'confirmed') {
          pipeline.decr(STATS_CONFIRMED_TICKETS)
        } else if (existingTicket.status === 'pending') {
          pipeline.decr(STATS_PENDING_TICKETS)
        } else if (existingTicket.status === 'cancelled') {
          pipeline.decr(STATS_CANCELLED_TICKETS)
        }

        if (ticket.status === 'confirmed') {
          pipeline.incr(STATS_CONFIRMED_TICKETS)
        } else if (ticket.status === 'pending') {
          pipeline.incr(STATS_PENDING_TICKETS)
        } else if (ticket.status === 'cancelled') {
          pipeline.incr(STATS_CANCELLED_TICKETS)
        }
      }

      // 6. Set expiration for active tickets (24 hours), archived tickets (30 days)
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
        pipeline.srem(ALL_ACTIVE_TICKETS_KEY, ticketId)

        // Update stats counters
        pipeline.decr(STATS_TOTAL_TICKETS)
        if (ticket.status === 'confirmed') {
          pipeline.decr(STATS_CONFIRMED_TICKETS)
        } else if (ticket.status === 'pending') {
          pipeline.decr(STATS_PENDING_TICKETS)
        } else if (ticket.status === 'cancelled') {
          pipeline.decr(STATS_CANCELLED_TICKETS)
        }

        // Note: We don't remove from STATS_UNIQUE_WALLETS since they might have other tickets

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

  // Get all active tickets (uses global index for fast admin queries)
  async getAllActiveTickets(): Promise<LotteryTicket[]> {
    try {
      console.log('Getting all active tickets from KV')

      // Get all active ticket IDs from the global index
      const ticketIds = await kv.smembers(ALL_ACTIVE_TICKETS_KEY)

      if (!ticketIds || ticketIds.length === 0) {
        console.log('No active tickets found in KV')
        return []
      }

      console.log(`Found ${ticketIds.length} active ticket IDs`)

      // Batch get tickets in chunks to avoid Redis mget limits (100 keys per batch)
      const BATCH_SIZE = 100
      const allTickets: LotteryTicket[] = []

      for (let i = 0; i < ticketIds.length; i += BATCH_SIZE) {
        const batchIds = ticketIds.slice(i, i + BATCH_SIZE)
        const ticketKeys = batchIds.map(id => `${TICKET_PREFIX}${id}`)
        const batchTickets = await kv.mget<LotteryTicket[]>(...ticketKeys)

        // Filter out null values and add to results
        const validBatchTickets = batchTickets.filter((ticket): ticket is LotteryTicket => ticket !== null)
        allTickets.push(...validBatchTickets)

        console.log(`Fetched batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ticketIds.length / BATCH_SIZE)}: ${validBatchTickets.length} tickets`)
      }

      console.log(`Total tickets fetched: ${allTickets.length}`)

      // Sort by purchase date (newest first)
      return allTickets.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get all active tickets from KV:', error)
      throw new Error(`Failed to get all active tickets from KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Get stats from counters (instant, no ticket fetching needed)
  async getStats() {
    try {
      const [totalTickets, confirmedTickets, pendingTickets, cancelledTickets, uniqueWalletsCount] = await Promise.all([
        kv.get<number>(STATS_TOTAL_TICKETS),
        kv.get<number>(STATS_CONFIRMED_TICKETS),
        kv.get<number>(STATS_PENDING_TICKETS),
        kv.get<number>(STATS_CANCELLED_TICKETS),
        kv.scard(STATS_UNIQUE_WALLETS)
      ])

      return {
        totalTickets: totalTickets || 0,
        confirmedTickets: confirmedTickets || 0,
        pendingTickets: pendingTickets || 0,
        cancelledTickets: cancelledTickets || 0,
        uniqueWallets: uniqueWalletsCount || 0
      }
    } catch (error) {
      console.error('Failed to get stats from KV:', error)
      throw new Error(`Failed to get stats from KV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Singleton instance
export const kvTicketStorage = new KVTicketStorageService()