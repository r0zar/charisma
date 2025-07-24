import { put, head, del, list } from '@vercel/blob'
import { LotteryConfig, LotteryDraw, LotteryTicket } from '@/types/lottery'

const LOTTERY_CONFIG_KEY = 'lottery-config.json'
const LOTTERY_RESULTS_PREFIX = 'lottery-results/'
const LOTTERY_TICKETS_PREFIX = 'lottery-tickets/'

export class BlobStorageService {
  private token: string

  constructor() {
    this.token = process.env.BLOB_READ_WRITE_TOKEN!
    if (!this.token) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is required')
    }
  }

  async saveLotteryConfig(config: LotteryConfig): Promise<void> {
    try {
      console.log('Attempting to save config to blob storage:', config)
      const configJson = JSON.stringify(config, null, 2)
      console.log('Config JSON:', configJson)
      
      const result = await put(LOTTERY_CONFIG_KEY, configJson, {
        access: 'public',
        token: this.token,
        contentType: 'application/json',
        allowOverwrite: true, // Allow overwriting existing blobs with same pathname
      })
      
      console.log('Blob storage save result:', result)
    } catch (error) {
      console.error('Failed to save lottery config to blob storage:', error)
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
      throw new Error(`Failed to save lottery configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getLotteryConfig(): Promise<LotteryConfig | null> {
    try {
      // Try to get the metadata first
      const metadata = await head(LOTTERY_CONFIG_KEY, { token: this.token })
      
      if (!metadata?.url) {
        return null
      }

      // Fetch the config data using the blob URL
      const response = await fetch(metadata.url)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Failed to fetch config: ${response.statusText}`)
      }

      const configData = await response.json()
      return configData as LotteryConfig
    } catch (error) {
      // If blob doesn't exist, return null to trigger initialization
      if (error instanceof Error && (
        error.message.includes('NotFound') || 
        error.message.includes('BlobNotFound') ||
        error.message.includes('404')
      )) {
        console.log('Config blob not found, will initialize with defaults')
        return null
      }
      
      console.error('Failed to get lottery config from blob storage:', error)
      throw error
    }
  }

  async configExists(): Promise<boolean> {
    try {
      const metadata = await head(LOTTERY_CONFIG_KEY, { token: this.token })
      return !!metadata
    } catch (error) {
      return false
    }
  }

  // Lottery Results Methods
  async saveLotteryDraw(draw: LotteryDraw): Promise<void> {
    try {
      console.log('Attempting to save draw to blob storage:', draw)
      const drawKey = `${LOTTERY_RESULTS_PREFIX}${draw.id}.json`
      const drawJson = JSON.stringify(draw, null, 2)
      console.log('Draw JSON:', drawJson)
      
      const result = await put(drawKey, drawJson, {
        access: 'public',
        token: this.token,
        contentType: 'application/json',
        allowOverwrite: true,
      })
      
      console.log('Blob storage save draw result:', result)
    } catch (error) {
      console.error('Failed to save lottery draw to blob storage:', error)
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
      throw new Error(`Failed to save lottery draw: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getLotteryDraw(drawId: string): Promise<LotteryDraw | null> {
    try {
      const drawKey = `${LOTTERY_RESULTS_PREFIX}${drawId}.json`
      const metadata = await head(drawKey, { token: this.token })
      
      if (!metadata?.url) {
        return null
      }

      const response = await fetch(metadata.url)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Failed to fetch draw: ${response.statusText}`)
      }

      const drawData = await response.json()
      return drawData as LotteryDraw
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('NotFound') || 
        error.message.includes('BlobNotFound') ||
        error.message.includes('404')
      )) {
        console.log(`Draw ${drawId} not found`)
        return null
      }
      
      console.error('Failed to get lottery draw from blob storage:', error)
      throw error
    }
  }

  async getAllLotteryDraws(): Promise<LotteryDraw[]> {
    try {
      const { blobs } = await list({
        prefix: LOTTERY_RESULTS_PREFIX,
        token: this.token,
      })

      const draws: LotteryDraw[] = []
      
      for (const blob of blobs) {
        try {
          const response = await fetch(blob.url)
          if (response.ok) {
            const drawData = await response.json()
            draws.push(drawData as LotteryDraw)
          }
        } catch (error) {
          console.error(`Failed to fetch draw from ${blob.url}:`, error)
        }
      }

      // Sort by draw date (newest first)
      return draws.sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime())
    } catch (error) {
      console.error('Failed to get all lottery draws from blob storage:', error)
      throw new Error(`Failed to retrieve lottery draws: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getLatestLotteryDraw(): Promise<LotteryDraw | null> {
    try {
      const draws = await this.getAllLotteryDraws()
      return draws.length > 0 ? draws[0] : null
    } catch (error) {
      console.error('Failed to get latest lottery draw:', error)
      return null
    }
  }

  async deleteLotteryDraw(drawId: string): Promise<void> {
    try {
      const drawKey = `${LOTTERY_RESULTS_PREFIX}${drawId}.json`
      await del(drawKey, { token: this.token })
      console.log(`Successfully deleted draw ${drawId}`)
    } catch (error) {
      console.error(`Failed to delete lottery draw ${drawId}:`, error)
      throw new Error(`Failed to delete lottery draw: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Lottery Tickets Methods
  async saveLotteryTicket(ticket: LotteryTicket): Promise<void> {
    try {
      console.log('Attempting to save ticket to blob storage:', ticket)
      const ticketKey = `${LOTTERY_TICKETS_PREFIX}${ticket.id}.json`
      const ticketJson = JSON.stringify(ticket, null, 2)
      console.log('Ticket JSON:', ticketJson)
      
      const result = await put(ticketKey, ticketJson, {
        access: 'public',
        token: this.token,
        contentType: 'application/json',
        allowOverwrite: true,
      })
      
      console.log('Blob storage save ticket result:', result)
    } catch (error) {
      console.error('Failed to save lottery ticket to blob storage:', error)
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
      throw new Error(`Failed to save lottery ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getLotteryTicket(ticketId: string): Promise<LotteryTicket | null> {
    try {
      const ticketKey = `${LOTTERY_TICKETS_PREFIX}${ticketId}.json`
      const metadata = await head(ticketKey, { token: this.token })
      
      if (!metadata?.url) {
        return null
      }

      const response = await fetch(metadata.url)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Failed to fetch ticket: ${response.statusText}`)
      }

      const ticketData = await response.json()
      return ticketData as LotteryTicket
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('NotFound') || 
        error.message.includes('BlobNotFound') ||
        error.message.includes('404')
      )) {
        console.log(`Ticket ${ticketId} not found`)
        return null
      }
      
      console.error('Failed to get lottery ticket from blob storage:', error)
      throw error
    }
  }

  async getTicketsByDraw(drawId: string, includeArchived: boolean = false): Promise<LotteryTicket[]> {
    try {
      const { blobs } = await list({
        prefix: LOTTERY_TICKETS_PREFIX,
        token: this.token,
      })

      const tickets: LotteryTicket[] = []
      
      for (const blob of blobs) {
        try {
          const response = await fetch(blob.url)
          if (response.ok) {
            const ticketData = await response.json() as LotteryTicket
            if (ticketData.drawId === drawId) {
              // Only include non-archived tickets unless specifically requested
              if (includeArchived || ticketData.status !== 'archived') {
                tickets.push(ticketData)
              }
            }
          }
        } catch (error) {
          console.error(`Failed to fetch ticket from ${blob.url}:`, error)
        }
      }

      // Sort by purchase date (oldest first)
      return tickets.sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get tickets by draw from blob storage:', error)
      throw new Error(`Failed to retrieve tickets for draw: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getTicketsByWallet(walletAddress: string): Promise<LotteryTicket[]> {
    try {
      const { blobs } = await list({
        prefix: LOTTERY_TICKETS_PREFIX,
        token: this.token,
      })

      const tickets: LotteryTicket[] = []
      
      for (const blob of blobs) {
        try {
          const response = await fetch(blob.url)
          if (response.ok) {
            const ticketData = await response.json() as LotteryTicket
            if (ticketData.walletAddress === walletAddress) {
              tickets.push(ticketData)
            }
          }
        } catch (error) {
          console.error(`Failed to fetch ticket from ${blob.url}:`, error)
        }
      }

      // Sort by purchase date (newest first)
      return tickets.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get tickets by wallet from blob storage:', error)
      throw new Error(`Failed to retrieve tickets for wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getAllLotteryTickets(): Promise<LotteryTicket[]> {
    try {
      const { blobs } = await list({
        prefix: LOTTERY_TICKETS_PREFIX,
        token: this.token,
      })

      const tickets: LotteryTicket[] = []
      
      for (const blob of blobs) {
        try {
          const response = await fetch(blob.url)
          if (response.ok) {
            const ticketData = await response.json()
            tickets.push(ticketData as LotteryTicket)
          }
        } catch (error) {
          console.error(`Failed to fetch ticket from ${blob.url}:`, error)
        }
      }

      // Sort by purchase date (newest first)
      return tickets.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    } catch (error) {
      console.error('Failed to get all lottery tickets from blob storage:', error)
      throw new Error(`Failed to retrieve lottery tickets: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteLotteryTicket(ticketId: string): Promise<void> {
    try {
      const ticketKey = `${LOTTERY_TICKETS_PREFIX}${ticketId}.json`
      await del(ticketKey, { token: this.token })
      console.log(`Successfully deleted ticket ${ticketId}`)
    } catch (error) {
      console.error(`Failed to delete lottery ticket ${ticketId}:`, error)
      throw new Error(`Failed to delete lottery ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Singleton instance
export const blobStorage = new BlobStorageService()