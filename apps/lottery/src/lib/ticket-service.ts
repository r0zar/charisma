import { LotteryTicket, TicketPurchaseRequest, BulkTicketPurchaseRequest } from '@/types/lottery'
import { hybridStorage } from './hybrid-storage'
import { lotteryConfigService } from './lottery-config'

export class TicketService {
  
  private async generateTicketId(): Promise<string> {
    const ticketNumber = await hybridStorage.incrementTicketCounter()
    return ticketNumber.toString().padStart(6, '0')
  }


  async purchaseTicket(request: TicketPurchaseRequest): Promise<LotteryTicket> {
    try {
      const config = await lotteryConfigService.getConfig()
      
      if (!config.isActive) {
        throw new Error('Lottery is currently inactive')
      }

      // Determine which draw this ticket is for
      const drawId = request.drawId || `next-draw-${new Date(config.nextDrawDate).toISOString().slice(0, 10)}`

      // Create the ticket
      const ticket: LotteryTicket = {
        id: await this.generateTicketId(),
        drawId,
        walletAddress: request.walletAddress,
        purchaseDate: new Date().toISOString(),
        purchasePrice: config.ticketPrice,
        status: 'pending', // Starts as pending until blockchain confirmation
      }

      // Save to storage (will use KV for immediate consistency)
      await hybridStorage.saveLotteryTicket(ticket)

      console.log('Ticket purchased successfully:', ticket)
      return ticket
    } catch (error) {
      console.error('Failed to purchase ticket:', error)
      throw new Error(`Unable to purchase ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async purchaseBulkTickets(request: BulkTicketPurchaseRequest): Promise<LotteryTicket[]> {
    try {
      const config = await lotteryConfigService.getConfig()
      
      if (!config.isActive) {
        throw new Error('Lottery is currently inactive')
      }

      if (request.quantity < 1 || request.quantity > 10000) {
        throw new Error('Quantity must be between 1 and 10,000')
      }

      // Determine which draw these tickets are for
      const drawId = request.drawId || `next-draw-${new Date(config.nextDrawDate).toISOString().slice(0, 10)}`

      const tickets: LotteryTicket[] = []
      const purchaseDate = new Date().toISOString()

      // Generate multiple tickets
      for (let i = 0; i < request.quantity; i++) {
        const ticket: LotteryTicket = {
          id: await this.generateTicketId(),
          drawId,
          walletAddress: request.walletAddress,
          purchaseDate,
          purchasePrice: config.ticketPrice,
          status: 'pending', // Starts as pending until blockchain confirmation
        }

        // Save each ticket (will use KV for immediate consistency)
        await hybridStorage.saveLotteryTicket(ticket)
        tickets.push(ticket)
      }

      console.log(`${tickets.length} bulk tickets purchased successfully`)
      return tickets
    } catch (error) {
      console.error('Failed to purchase bulk tickets:', error)
      throw new Error(`Unable to purchase bulk tickets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getTicketsByWallet(walletAddress: string): Promise<LotteryTicket[]> {
    try {
      return await hybridStorage.getTicketsByWallet(walletAddress)
    } catch (error) {
      console.error('Failed to get tickets by wallet:', error)
      throw new Error('Unable to retrieve tickets')
    }
  }

  async getTicketsByDraw(drawId: string, includeArchived: boolean = false): Promise<LotteryTicket[]> {
    try {
      return await hybridStorage.getTicketsByDraw(drawId, includeArchived)
    } catch (error) {
      console.error('Failed to get tickets by draw:', error)
      throw new Error('Unable to retrieve tickets for draw')
    }
  }

  async getTicket(ticketId: string): Promise<LotteryTicket | null> {
    try {
      return await hybridStorage.getLotteryTicket(ticketId)
    } catch (error) {
      console.error('Failed to get ticket:', error)
      return null
    }
  }

  async getNextDrawId(): Promise<string> {
    const config = await lotteryConfigService.getConfig()
    return `next-draw-${new Date(config.nextDrawDate).toISOString().slice(0, 10)}`
  }

  async updateTicketTransactionId(ticketId: string, transactionId: string): Promise<LotteryTicket> {
    try {
      const ticket = await hybridStorage.getLotteryTicket(ticketId)
      
      if (!ticket) {
        throw new Error('Ticket not found')
      }

      const updatedTicket: LotteryTicket = {
        ...ticket,
        transactionId
      }

      await hybridStorage.saveLotteryTicket(updatedTicket)
      console.log(`Ticket ${ticketId} updated with transaction ID: ${transactionId}`)
      
      return updatedTicket
    } catch (error) {
      console.error('Failed to update ticket transaction ID:', error)
      throw new Error(`Unable to update ticket transaction ID: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async confirmTicket(ticketId: string, transactionId?: string): Promise<LotteryTicket> {
    try {
      const ticket = await hybridStorage.getLotteryTicket(ticketId)
      
      if (!ticket) {
        throw new Error('Ticket not found')
      }

      if (ticket.status !== 'pending') {
        throw new Error(`Cannot confirm ticket with status: ${ticket.status}`)
      }

      const confirmedTicket: LotteryTicket = {
        ...ticket,
        status: 'confirmed',
        transactionId: transactionId || ticket.transactionId, // Use provided TX ID or existing one
        confirmedAt: new Date().toISOString()
      }

      await hybridStorage.saveLotteryTicket(confirmedTicket)
      console.log(`Ticket ${ticketId} confirmed`)
      
      return confirmedTicket
    } catch (error) {
      console.error('Failed to confirm ticket:', error)
      throw new Error(`Unable to confirm ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getTicketStats(drawId?: string): Promise<{
    totalTickets: number;
    totalRevenue: number;
    uniqueWallets: number;
  }> {
    try {
      const tickets = drawId 
        ? await hybridStorage.getTicketsByDraw(drawId)
        : await hybridStorage.getAllLotteryTickets()

      const totalTickets = tickets.length
      const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.purchasePrice, 0)
      const uniqueWallets = new Set(tickets.map(t => t.walletAddress)).size

      return {
        totalTickets,
        totalRevenue,
        uniqueWallets
      }
    } catch (error) {
      console.error('Failed to get ticket stats:', error)
      throw new Error('Unable to retrieve ticket statistics')
    }
  }

  async expirePendingTickets(): Promise<{
    expired: number;
    errors: number;
  }> {
    try {
      console.log('Starting pending ticket expiration cleanup...')
      
      // Get all tickets
      const allTickets = await hybridStorage.getAllLotteryTickets()
      
      // Find pending tickets older than 48 hours
      const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000)
      const expiredPendingTickets = allTickets.filter(ticket => 
        ticket.status === 'pending' && 
        (!ticket.drawStatus || ticket.drawStatus === 'active') &&
        new Date(ticket.purchaseDate).getTime() < fortyEightHoursAgo
      )
      
      console.log(`Found ${expiredPendingTickets.length} expired pending tickets`)
      
      if (expiredPendingTickets.length === 0) {
        return { expired: 0, errors: 0 }
      }
      
      let expiredCount = 0
      let errorCount = 0
      
      // Cancel each expired ticket
      for (const ticket of expiredPendingTickets) {
        try {
          const cancelledTicket: LotteryTicket = {
            ...ticket,
            status: 'cancelled',
            cancelledAt: new Date().toISOString()
          }
          
          await hybridStorage.saveLotteryTicket(cancelledTicket)
          expiredCount++
          console.log(`Expired pending ticket ${ticket.id} (${Math.round((Date.now() - new Date(ticket.purchaseDate).getTime()) / (60 * 60 * 1000))}h old)`)
        } catch (error) {
          console.error(`Failed to expire ticket ${ticket.id}:`, error)
          errorCount++
        }
      }
      
      console.log(`Pending ticket expiration completed: ${expiredCount} expired, ${errorCount} errors`)
      
      return { expired: expiredCount, errors: errorCount }
    } catch (error) {
      console.error('Failed to expire pending tickets:', error)
      throw new Error(`Unable to expire pending tickets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Singleton instance
export const ticketService = new TicketService()