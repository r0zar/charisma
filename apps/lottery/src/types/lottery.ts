export type LotteryFormat = 'traditional' | 'simple'

export interface PhysicalJackpot {
  title: string;              // Name/description of the physical item
  imageUrl: string;           // URL to image of the item
  linkUrl: string;            // URL to view more details about the item
  estimatedValue?: number;    // Optional estimated value in STONE for reference
}

export interface LotteryConfig {
  // Lottery format
  format: LotteryFormat;      // "traditional" (6 numbers) or "simple" (random winner)
  
  // Basic lottery rules
  ticketPrice: number;        // 5 (STONE tokens)
  numbersToSelect: number;    // 6 (traditional) or 0 (simple)
  maxNumber: number;          // 49 (traditional) or 0 (simple)
  
  // Draw scheduling
  drawFrequency: string;      // "twice_weekly" | "weekly" | "daily"
  nextDrawDate: string;       // ISO timestamp
  
  // Jackpot settings
  currentJackpot: PhysicalJackpot; // Physical item details
  
  // Admin metadata
  lastModified: string;       // ISO timestamp
  version: number;            // for versioning config changes
  isActive: boolean;          // enable/disable lottery
}

// Lottery result interfaces
export interface LotteryDraw {
  id: string;                    // unique draw identifier
  drawDate: string;              // ISO timestamp when draw occurred
  winningNumbers: number[];      // the winning numbers (sorted)
  jackpotAmount: PhysicalJackpot; // jackpot item for this draw
  totalTicketsSold: number;      // number of tickets sold
  winners: WinnerInfo[];         // winner details by tier
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}

export interface WinnerInfo {
  tier: number;                 // 1=jackpot, 2=5numbers, 3=4numbers, etc
  matchCount: number;           // how many numbers matched
  winnerCount: number;          // number of winners in this tier
  prizePerWinner: number;       // prize amount per winner
  totalPrize: number;           // total prize for this tier
}

export interface DrawRequest {
  drawId?: string;              // optional custom draw ID
  scheduledDate?: string;       // optional custom draw date
  winningNumbers?: number[];    // optional manual winning numbers (for testing)
}

// Ticket purchase interfaces
export interface LotteryTicket {
  id: string;                   // unique ticket identifier
  drawId: string;               // which draw this ticket is for
  walletAddress: string;        // purchaser's wallet address
  numbers: number[];            // selected numbers (sorted) - empty for simple format
  purchaseDate: string;         // ISO timestamp when purchased
  purchasePrice: number;        // amount paid in STONE
  transactionId?: string;       // blockchain transaction ID
  status: 'pending' | 'confirmed' | 'cancelled' | 'archived';
  drawResult?: string;          // link to completed draw (for archived tickets)
  confirmedAt?: string;         // ISO timestamp when confirmed
  cancelledAt?: string;         // ISO timestamp when cancelled
  blockHeight?: number;         // block height when confirmed
  blockTime?: number;           // block time when confirmed
  isWinner?: boolean;           // for simple format - indicates if this ticket won
}

export interface TicketPurchaseRequest {
  walletAddress: string;
  numbers: number[];            // empty array for simple format
  quantity?: number;            // for bulk purchases (default 1)
  drawId?: string;              // specific draw (defaults to next draw)
}

export interface BulkTicketPurchaseRequest {
  walletAddress: string;
  quantity: number;             // number of tickets to generate
  drawId?: string;              // specific draw (defaults to next draw)
}

// Get lottery format from environment variable (defaults to simple)
export function getLotteryFormat(): LotteryFormat {
  const format = process.env.LOTTERY_FORMAT || 'simple'
  return format === 'traditional' ? 'traditional' : 'simple'
}

export const DEFAULT_LOTTERY_CONFIG: LotteryConfig = {
  format: getLotteryFormat(),
  ticketPrice: 100,
  numbersToSelect: getLotteryFormat() === 'traditional' ? 6 : 0, 
  maxNumber: getLotteryFormat() === 'traditional' ? 49 : 0,
  drawFrequency: "twice_weekly",
  nextDrawDate: "2025-01-26T20:00:00Z", // Next Saturday 8 PM
  currentJackpot: {
    title: "Rare Collectible NFT",
    imageUrl: "https://via.placeholder.com/400x300?text=Jackpot+Prize",
    linkUrl: "https://example.com/nft-details",
    estimatedValue: 125000000 // 125M STONE equivalent
  },
  lastModified: new Date().toISOString(),
  version: 1,
  isActive: true
}