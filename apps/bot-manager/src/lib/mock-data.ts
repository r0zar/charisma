import { Bot, BotStats, PerformanceMetrics, MarketData } from '@/types/bot';

// Mock bot data for demonstration
export const mockBots: Bot[] = [
  {
    id: 'bot-1',
    name: 'Yield Maximizer Pro',
    strategy: 'yield-farming',
    status: 'active',
    walletAddress: 'SP1ABC123DEF456GHI789JKL012MNO345PQR678STU901',
    createdAt: '2024-01-15T10:30:00Z',
    lastActive: '2024-01-25T14:22:00Z',
    dailyPnL: 45.67,
    totalPnL: 1234.56,
    totalVolume: 12450.00,
    successRate: 94.5,
    maxGasPrice: 1000,
    slippageTolerance: 0.5,
    autoRestart: true,
    stxBalance: 12.5,
    lpTokenBalances: [
      {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow',
        symbol: 'SXC',
        name: 'Charismatic Flow',
        balance: 1000000,
        formattedBalance: 1.0,
        decimals: 6,
        usdValue: 25.50
      },
      {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1',
        symbol: 'DEX',
        name: 'Dexterity Pool',
        balance: 2500000,
        formattedBalance: 2.5,
        decimals: 6,
        usdValue: 42.75
      }
    ],
    rewardTokenBalances: [
      {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
        symbol: 'HOOTER',
        name: 'Hooter the Owl',
        balance: 5000000,
        formattedBalance: 5.0,
        decimals: 6,
        usdValue: 15.25
      }
    ],
    setupProgress: {
      funded: true,
      lpTokensAdded: true,
      activated: true,
      completionPercentage: 100
    },
    recentActivity: [
      {
        id: 'activity-1',
        botId: 'bot-1',
        timestamp: '2024-01-25T14:22:00Z',
        type: 'yield-farming',
        status: 'success',
        txid: '0x1234567890abcdef1234567890abcdef12345678',
        description: 'Harvested 0.25 HOOTER rewards',
        blockHeight: 123456
      },
      {
        id: 'activity-2',
        botId: 'bot-1',
        timestamp: '2024-01-25T13:15:00Z',
        type: 'yield-farming',
        status: 'success',
        txid: '0xabcdef1234567890abcdef1234567890abcdef12',
        description: 'Compounded LP rewards',
        blockHeight: 123455
      }
    ]
  },
  {
    id: 'bot-2',
    name: 'DCA Bitcoin Bot',
    strategy: 'dca',
    status: 'paused',
    walletAddress: 'SP2XYZ987WVU654TSR321QPN876MLK543JHG210FED432',
    createdAt: '2024-01-20T09:15:00Z',
    lastActive: '2024-01-24T16:45:00Z',
    dailyPnL: -12.34,
    totalPnL: 567.89,
    totalVolume: 8750.00,
    successRate: 89.2,
    maxGasPrice: 800,
    slippageTolerance: 1.0,
    autoRestart: false,
    stxBalance: 8.3,
    lpTokenBalances: [],
    rewardTokenBalances: [],
    setupProgress: {
      funded: true,
      lpTokensAdded: false,
      activated: false,
      completionPercentage: 33
    },
    recentActivity: [
      {
        id: 'activity-3',
        botId: 'bot-2',
        timestamp: '2024-01-24T16:45:00Z',
        type: 'trade',
        status: 'success',
        txid: '0x9876543210fedcba9876543210fedcba98765432',
        amount: 100,
        token: 'STX',
        description: 'DCA purchase: 100 STX',
        blockHeight: 123400
      }
    ]
  },
  {
    id: 'bot-3',
    name: 'Arbitrage Scanner',
    strategy: 'arbitrage',
    status: 'error',
    walletAddress: 'SP3QRS456TUV789WXY012ZAB345CDE678FGH901IJK234',
    createdAt: '2024-01-22T14:30:00Z',
    lastActive: '2024-01-23T11:20:00Z',
    dailyPnL: 0,
    totalPnL: -45.67,
    totalVolume: 2100.00,
    successRate: 76.8,
    maxGasPrice: 1200,
    slippageTolerance: 0.3,
    autoRestart: true,
    stxBalance: 3.2,
    lpTokenBalances: [],
    rewardTokenBalances: [],
    setupProgress: {
      funded: true,
      lpTokensAdded: false,
      activated: false,
      completionPercentage: 33
    },
    recentActivity: [
      {
        id: 'activity-4',
        botId: 'bot-3',
        timestamp: '2024-01-23T11:20:00Z',
        type: 'error',
        status: 'failed',
        description: 'Arbitrage opportunity expired',
        error: 'Price difference too small after gas fees'
      }
    ]
  },
  {
    id: 'bot-4',
    name: 'Liquidity Miner',
    strategy: 'liquidity-mining',
    status: 'setup',
    walletAddress: 'SP4LMN789OPQ012RST345UVW678XYZ901ABC234DEF567',
    createdAt: '2024-01-25T12:00:00Z',
    lastActive: '2024-01-25T12:00:00Z',
    dailyPnL: 0,
    totalPnL: 0,
    totalVolume: 0,
    successRate: 0,
    maxGasPrice: 1000,
    slippageTolerance: 0.5,
    autoRestart: true,
    stxBalance: 0,
    lpTokenBalances: [],
    rewardTokenBalances: [],
    setupProgress: {
      funded: false,
      lpTokensAdded: false,
      activated: false,
      completionPercentage: 0
    },
    recentActivity: []
  }
];

export const mockBotStats: BotStats = {
  totalBots: 4,
  activeBots: 1,
  pausedBots: 1,
  errorBots: 1,
  totalGas: 24.0,
  totalValue: 2156.78,
  totalPnL: 1756.44,
  todayPnL: 33.33
};

export const mockPerformanceMetrics: PerformanceMetrics = {
  daily: [
    { date: '2024-01-19', pnl: 15.67, volume: 1200 },
    { date: '2024-01-20', pnl: 23.45, volume: 1350 },
    { date: '2024-01-21', pnl: -8.90, volume: 980 },
    { date: '2024-01-22', pnl: 42.15, volume: 1680 },
    { date: '2024-01-23', pnl: 31.20, volume: 1420 },
    { date: '2024-01-24', pnl: -12.34, volume: 1100 },
    { date: '2024-01-25', pnl: 45.67, volume: 1580 }
  ],
  weekly: [
    { date: '2024-01-01', pnl: 156.78, volume: 8500 },
    { date: '2024-01-08', pnl: 234.56, volume: 9200 },
    { date: '2024-01-15', pnl: 189.32, volume: 8900 },
    { date: '2024-01-22', pnl: 98.45, volume: 7800 }
  ],
  monthly: [
    { date: '2023-11-01', pnl: 678.90, volume: 32000 },
    { date: '2023-12-01', pnl: 890.12, volume: 35000 },
    { date: '2024-01-01', pnl: 1234.56, volume: 38000 }
  ]
};

export const mockMarketData: MarketData = {
  tokenPrices: {
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow': 25.50,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1': 17.10,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit': 42.75,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl': 3.05,
    'STX': 1.85
  },
  priceChanges: {
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow': 2.3,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1': -1.2,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit': 5.8,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl': -0.5,
    'STX': 3.2
  },
  marketCap: {
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow': 5250000,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1': 3420000,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.perseverantia-omnia-vincit': 8575000,
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl': 1525000,
    'STX': 2850000000
  }
};

// Helper functions
export const getBotById = (id: string): Bot | undefined => {
  return mockBots.find(bot => bot.id === id);
};

export const getBotsByStatus = (status: Bot['status']): Bot[] => {
  return mockBots.filter(bot => bot.status === status);
};

export const getBotsByStrategy = (strategy: Bot['strategy']): Bot[] => {
  return mockBots.filter(bot => bot.strategy === strategy);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatTokenAmount = (amount: number, decimals: number = 6): string => {
  return (amount / Math.pow(10, decimals)).toFixed(decimals);
};

export const truncateAddress = (address: string, length: number = 8): string => {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
};

export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
};