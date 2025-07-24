import { LotteryTicket, TicketPurchaseRequest, BulkTicketPurchaseRequest } from '@/types/lottery'
import { blobStorage } from './blob-storage'
import { lotteryConfigService } from './lottery-config'

export class TicketService {
  
  private generateTicketId(): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const randomSuffix = Math.random().toString(36).substring(2, 12)
    return `ticket-${timestamp}-${randomSuffix}`
  }

  private generateRandomNumbers(maxNumber: number, count: number): number[] {
    const numbers: number[] = []
    while (numbers.length < count) {
      const num = Math.floor(Math.random() * maxNumber) + 1
      if (!numbers.includes(num)) {
        numbers.push(num)
      }
    }
    return numbers.sort((a, b) => a - b)
  }

  async purchaseTicket(request: TicketPurchaseRequest): Promise<LotteryTicket> {
    try {
      const config = await lotteryConfigService.getConfig()
      
      if (!config.isActive) {
        throw new Error('Lottery is currently inactive')
      }

      // Validate numbers
      if (request.numbers.length !== config.numbersToSelect) {
        throw new Error(`Must select exactly ${config.numbersToSelect} numbers`)
      }

      if (request.numbers.some(n => n < 1 || n > config.maxNumber)) {
        throw new Error(`Numbers must be between 1 and ${config.maxNumber}`)
      }

      if (new Set(request.numbers).size !== request.numbers.length) {
        throw new Error('Cannot select duplicate numbers')
      }

      // Determine which draw this ticket is for
      const drawId = request.drawId || `next-draw-${new Date(config.nextDrawDate).toISOString().slice(0, 10)}`

      // Create the ticket
      const ticket: LotteryTicket = {
        id: this.generateTicketId(),
        drawId,
        walletAddress: request.walletAddress,
        numbers: [...request.numbers].sort((a, b) => a - b),
        purchaseDate: new Date().toISOString(),
        purchasePrice: config.ticketPrice,
        status: 'pending', // Starts as pending until blockchain confirmation
      }

      // Save to storage
      await blobStorage.saveLotteryTicket(ticket)

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

      // Generate multiple tickets with random numbers
      for (let i = 0; i < request.quantity; i++) {
        const ticket: LotteryTicket = {
          id: this.generateTicketId(),
          drawId,
          walletAddress: request.walletAddress,
          numbers: this.generateRandomNumbers(config.maxNumber, config.numbersToSelect),
          purchaseDate,
          purchasePrice: config.ticketPrice,
          status: 'pending', // Starts as pending until blockchain confirmation
        }

        // Save each ticket
        await blobStorage.saveLotteryTicket(ticket)
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
      return await blobStorage.getTicketsByWallet(walletAddress)
    } catch (error) {
      console.error('Failed to get tickets by wallet:', error)
      throw new Error('Unable to retrieve tickets')
    }
  }

  async getTicketsByDraw(drawId: string, includeArchived: boolean = false): Promise<LotteryTicket[]> {
    try {
      return await blobStorage.getTicketsByDraw(drawId, includeArchived)
    } catch (error) {
      console.error('Failed to get tickets by draw:', error)
      throw new Error('Unable to retrieve tickets for draw')
    }
  }

  async getTicket(ticketId: string): Promise<LotteryTicket | null> {
    try {
      return await blobStorage.getLotteryTicket(ticketId)
    } catch (error) {
      console.error('Failed to get ticket:', error)
      return null
    }
  }

  async getNextDrawId(): Promise<string> {
    const config = await lotteryConfigService.getConfig()
    return `next-draw-${new Date(config.nextDrawDate).toISOString().slice(0, 10)}`
  }

  async confirmTicket(ticketId: string, transactionId?: string): Promise<LotteryTicket> {
    try {
      const ticket = await blobStorage.getLotteryTicket(ticketId)
      
      if (!ticket) {
        throw new Error('Ticket not found')
      }

      if (ticket.status !== 'pending') {
        throw new Error(`Cannot confirm ticket with status: ${ticket.status}`)
      }

      const confirmedTicket: LotteryTicket = {
        ...ticket,
        status: 'confirmed',
        transactionId
      }

      await blobStorage.saveLotteryTicket(confirmedTicket)
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
        ? await blobStorage.getTicketsByDraw(drawId)
        : await blobStorage.getAllLotteryTickets()

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
}

// Singleton instance
export const ticketService = new TicketService()