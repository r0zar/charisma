export interface LotteryConfig {
  // Basic lottery rules
  ticketPrice: number;        // 5 (STONE tokens)
  numbersToSelect: number;    // 6 
  maxNumber: number;          // 49 (numbers 1-49)
  
  // Draw scheduling
  drawFrequency: string;      // "twice_weekly" | "weekly" | "daily"
  nextDrawDate: string;       // ISO timestamp
  
  // Jackpot settings
  currentJackpot: number;     // in STONE tokens
  
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
  jackpotAmount: number;         // jackpot amount for this draw
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
  numbers: number[];            // selected numbers (sorted)
  purchaseDate: string;         // ISO timestamp when purchased
  purchasePrice: number;        // amount paid in STONE
  transactionId?: string;       // blockchain transaction ID
  status: 'pending' | 'confirmed' | 'cancelled' | 'archived';
  drawResult?: string;          // link to completed draw (for archived tickets)
  confirmedAt?: string;         // ISO timestamp when confirmed
  blockHeight?: number;         // block height when confirmed
  blockTime?: number;           // block time when confirmed
}

export interface TicketPurchaseRequest {
  walletAddress: string;
  numbers: number[];
  quantity?: number;            // for bulk purchases (default 1)
  drawId?: string;              // specific draw (defaults to next draw)
}

export interface BulkTicketPurchaseRequest {
  walletAddress: string;
  quantity: number;             // number of tickets to generate
  drawId?: string;              // specific draw (defaults to next draw)
}

export const DEFAULT_LOTTERY_CONFIG: LotteryConfig = {
  ticketPrice: 5,
  numbersToSelect: 6, 
  maxNumber: 49,
  drawFrequency: "twice_weekly",
  nextDrawDate: "2025-01-26T20:00:00Z", // Next Saturday 8 PM
  currentJackpot: 125000000, // 125M STONE
  lastModified: new Date().toISOString(),
  version: 1,
  isActive: true
}