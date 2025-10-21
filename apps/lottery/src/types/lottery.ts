export interface PhysicalJackpot {
  title: string;              // Name/description of the physical item
  imageUrls: string[];        // URLs to images of the item (up to 3 for carousel)
  linkUrl: string;            // URL to view more details about the item
  estimatedValue?: number;    // Optional estimated value in STONE for reference
}

export interface Jackpot {
  id: string;                 // Unique identifier for the jackpot
  title: string;              // Name/title of the jackpot
  description: string;        // Description of the jackpot prize
  imageUrl: string;           // URL to image of the prize
}

export interface LotteryConfig {
  // Basic lottery rules
  ticketPrice: number;        // Price in STONE tokens

  // Draw scheduling
  drawFrequency?: string;     // "twice_weekly" | "weekly" | "daily"
  nextDrawDate: string | null; // ISO timestamp
  currentDrawId?: string;     // ID of the current active draw

  // Jackpot settings (new format)
  jackpots?: Jackpot[];       // Array of available jackpots
  currentJackpot: PhysicalJackpot | Jackpot | null; // Current active jackpot (supports both formats)

  // Admin metadata
  lastModified?: string;      // ISO timestamp
  lastUpdated?: string;       // ISO timestamp (alternate field name)
  version?: number;           // for versioning config changes
  isActive: boolean;          // enable/disable lottery
}

// Lottery result interfaces
export interface LotteryDraw {
  id: string;                    // unique draw identifier
  drawDate: string;              // ISO timestamp when draw occurred
  jackpotAmount: PhysicalJackpot | Jackpot; // jackpot item for this draw (supports both formats)
  totalTicketsSold: number;      // number of tickets sold
  winners: WinnerInfo[];         // winner details by tier
  winnerWalletAddress?: string;  // wallet address of the jackpot winner (for simple format)
  winningTicketId?: string;      // ID of the winning ticket (for simple format)
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
  purchaseDate: string;         // ISO timestamp when purchased
  purchasePrice: number;        // amount paid in STONE
  transactionId?: string;       // blockchain transaction ID
  status: 'pending' | 'confirmed' | 'cancelled';  // transaction/payment status
  drawStatus?: 'active' | 'archived';             // draw participation status
  drawResult?: string;          // link to completed draw (for archived tickets)
  confirmedAt?: string;         // ISO timestamp when confirmed
  cancelledAt?: string;         // ISO timestamp when cancelled
  archivedAt?: string;          // ISO timestamp when archived
  blockHeight?: number;         // block height when confirmed
  blockTime?: number;           // block time when confirmed
  isWinner?: boolean;           // indicates if this ticket won
}

export interface TicketPurchaseRequest {
  walletAddress: string;
  drawId?: string;              // specific draw (defaults to next draw)
}

export interface BulkTicketPurchaseRequest {
  walletAddress: string;
  quantity: number;             // number of tickets to generate
  drawId?: string;              // specific draw (defaults to next draw)
}

export const DEFAULT_LOTTERY_CONFIG: LotteryConfig = {
  ticketPrice: 100,
  drawFrequency: "twice_weekly",
  nextDrawDate: "2025-01-26T20:00:00Z", // Next Saturday 8 PM
  currentJackpot: {
    title: "Rare Collectible NFT",
    imageUrls: ["https://via.placeholder.com/400x300?text=Jackpot+Prize"],
    linkUrl: "https://example.com/nft-details",
    estimatedValue: 125000000 // 125M STONE equivalent
  },
  lastModified: new Date().toISOString(),
  version: 1,
  isActive: true
}