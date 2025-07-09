export interface Bot {
  id: string;
  name: string;
  strategy: 'yield-farming' | 'dca' | 'arbitrage' | 'liquidity-mining';
  status: 'active' | 'paused' | 'error' | 'inactive' | 'setup';
  walletAddress: string;
  createdAt: string;
  lastActive: string;
  
  // Performance metrics
  dailyPnL: number;
  totalPnL: number;
  totalVolume: number;
  successRate: number;
  
  // Configuration
  maxGasPrice: number;
  slippageTolerance: number;
  autoRestart: boolean;
  
  // Balances
  stxBalance: number;
  lpTokenBalances: LpTokenBalance[];
  rewardTokenBalances: RewardTokenBalance[];
  
  // Setup progress
  setupProgress: SetupProgress;
  
  // Activity
  recentActivity: BotActivity[];
}

export interface LpTokenBalance {
  contractId: string;
  symbol: string;
  name: string;
  balance: number;
  formattedBalance: number;
  decimals: number;
  image?: string;
  usdValue?: number;
}

export interface RewardTokenBalance {
  contractId: string;
  symbol: string;
  name: string;
  balance: number;
  formattedBalance: number;
  decimals: number;
  image?: string;
  usdValue?: number;
}

export interface SetupProgress {
  funded: boolean;
  lpTokensAdded: boolean;
  activated: boolean;
  completionPercentage: number;
}

export interface BotActivity {
  id: string;
  botId: string;
  timestamp: string;
  type: 'yield-farming' | 'deposit' | 'withdrawal' | 'trade' | 'error';
  status: 'pending' | 'success' | 'failed';
  txid?: string;
  amount?: number;
  token?: string;
  description: string;
  error?: string;
  blockHeight?: number;
  blockTime?: string;
}

export interface CreateBotRequest {
  name: string;
  strategy: Bot['strategy'];
  maxGasPrice: number;
  slippageTolerance: number;
  autoRestart: boolean;
}

export interface BotStats {
  totalBots: number;
  activeBots: number;
  pausedBots: number;
  errorBots: number;
  totalGas: number;
  totalValue: number;
  totalPnL: number;
  todayPnL: number;
}

export interface PortfolioDistribution {
  stx: number;
  lpTokens: number;
  rewardTokens: number;
}

export interface PerformanceMetrics {
  daily: PnLDataPoint[];
  weekly: PnLDataPoint[];
  monthly: PnLDataPoint[];
}

export interface PnLDataPoint {
  date: string;
  pnl: number;
  volume: number;
}

export interface MarketData {
  tokenPrices: Record<string, number>;
  priceChanges: Record<string, number>;
  marketCap: Record<string, number>;
}