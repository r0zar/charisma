/**
 * Mock data generator for activity timeline
 * Creates realistic swap and order activity for UI development
 */

import { ActivityItem, ActivityType, ActivityStatus, TokenInfo, Reply } from './types';

// Common token definitions
const TOKENS = {
  STX: { symbol: 'STX', contractId: '.stx', decimals: 6 },
  CHA: { symbol: 'CHA', contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', decimals: 6 },
  sCHA: { symbol: 'sCHA', contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', decimals: 6 },
  sBTC: { symbol: 'sBTC', contractId: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', decimals: 8 },
  ssBTC: { symbol: 'ssBTC', contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1', decimals: 8 },
  USDC: { symbol: 'USDC', contractId: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc', decimals: 6 },
  WELSH: { symbol: 'WELSH', contractId: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', decimals: 6 },
  sWELSH: { symbol: 'sWELSH', contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1', decimals: 6 },
  LEO: { symbol: 'LEO', contractId: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token', decimals: 6 },
  sLEO: { symbol: 'sLEO', contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1', decimals: 6 }
};

// Price ranges for tokens (in USD)
const TOKEN_PRICES = {
  STX: { min: 0.8, max: 1.2 },
  CHA: { min: 0.035, max: 0.055 },
  sBTC: { min: 43000, max: 47000 },
  USDC: { min: 0.998, max: 1.002 },
  WELSH: { min: 0.0008, max: 0.0012 },
  LEO: { min: 0.002, max: 0.005 }
};

function createTokenInfo(tokenKey: keyof typeof TOKENS, amount: string, usdPrice?: number): TokenInfo {
  const token = TOKENS[tokenKey];
  const priceRange = TOKEN_PRICES[tokenKey as keyof typeof TOKEN_PRICES];
  const price = usdPrice || (priceRange ? Math.random() * (priceRange.max - priceRange.min) + priceRange.min : 1);
  const numericAmount = parseFloat(amount);
  const usdValue = numericAmount * price;
  
  return {
    ...token,
    amount,
    usdValue: parseFloat(usdValue.toFixed(2))
  };
}

function randomTxId(): string {
  return '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function timeAgo(hours: number): number {
  return Date.now() - (hours * 60 * 60 * 1000);
}

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Mock users for activity ownership
const MOCK_USERS = [
  { address: 'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60', displayName: 'crypto_whale' },
  { address: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', displayName: 'defi_trader' },
  { address: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', displayName: 'yield_farmer' },
  { address: 'SP1HTBVD3JG9C05J7HBJTHGR0GGW7KX975CN0QQ89', displayName: 'stx_degen' },
  { address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', displayName: 'charisma_dev' },
  { address: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K', displayName: 'arbitrage_bot' },
  { address: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6', displayName: 'leo_hodler' },
  { address: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G', displayName: 'welsh_community' }
];

function getRandomUser() {
  return randomElement(MOCK_USERS);
}

function generateMockReplies(activityId: string, count: number = 0): Reply[] {
  if (count === 0) return [];
  
  const mockUsers = [
    'SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60',
    'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
    'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
    'crypto_analyst',
    'defi_trader',
    'whale_watcher',
    'stx_degen',
    'yield_farmer'
  ];
  
  const replyContents = [
    "Great trade! Nice timing on this one 📈",
    "How did you get such good execution price?",
    "This is why I love DCA strategies 🔥",
    "Subnet shifts are getting so smooth lately",
    "LFG! CHA to the moon! 🚀",
    "Perfect entry point, well done",
    "Hope you're taking some profits here",
    "This aged well 👀",
    "Smart move avoiding that price impact",
    "Bullish on this strategy",
    "Thanks for sharing, copying this trade",
    "When did you first spot this opportunity?",
    "Risk management on point 💯",
    "What's your next target?",
    "This is the gm I needed today",
    "Subnet capital efficiency is insane",
    "Based and CHA-pilled",
    "Tutorial please? 🙏",
    "Whale moves only",
    "This is financial advice (not) 😂"
  ];
  
  const replies: Reply[] = [];
  const baseTime = timeAgo(Math.random() * 24); // Random time within last 24h
  
  for (let i = 0; i < count; i++) {
    replies.push({
      id: `reply-${activityId}-${i}`,
      activityId,
      content: randomElement(replyContents),
      timestamp: baseTime + (i * 60 * 60 * 1000), // Space replies out by hours
      author: randomElement(mockUsers),
      metadata: {
        isEdited: Math.random() < 0.1, // 10% chance of being edited
        editedAt: Math.random() < 0.1 ? baseTime + (i * 60 * 60 * 1000) + (30 * 60 * 1000) : undefined
      }
    });
  }
  
  return replies.sort((a, b) => a.timestamp - b.timestamp);
}

export function generateMockActivityData(): ActivityItem[] {
  const activities: ActivityItem[] = [];

  // Recent instant swap - completed (with replies)
  const recentSwapReplies = generateMockReplies('swap-1', 5);
  const swapUser1 = getRandomUser();
  activities.push({
    id: 'swap-1',
    type: 'instant_swap',
    timestamp: timeAgo(2),
    status: 'completed',
    owner: swapUser1.address,
    displayName: swapUser1.displayName,
    fromToken: createTokenInfo('sBTC', '0.1'),
    toToken: createTokenInfo('CHA', '95240'),
    txid: randomTxId(),
    confirmations: 3,
    priceImpact: -0.52,
    route: ['sBTC', 'CHA'],
    replies: recentSwapReplies,
    replyCount: recentSwapReplies.length,
    hasReplies: recentSwapReplies.length > 0,
    metadata: {
      isSubnetShift: false,
      gasUsed: '0.001 STX',
      router: 'dexterity'
    }
  });

  // Order filled - price trigger (with replies)
  const orderReplies = generateMockReplies('order-1', 3);
  const orderUser1 = getRandomUser();
  activities.push({
    id: 'order-1',
    type: 'order_filled',
    timestamp: timeAgo(5),
    status: 'completed',
    owner: orderUser1.address,
    displayName: orderUser1.displayName,
    fromToken: createTokenInfo('CHA', '50000'),
    toToken: createTokenInfo('sBTC', '1.089'),
    txid: randomTxId(),
    orderType: 'price_trigger',
    targetPrice: 45000,
    executionPrice: 45120,
    waitTime: '3 days',
    strategy: 'single',
    replies: orderReplies,
    replyCount: orderReplies.length,
    hasReplies: orderReplies.length > 0,
    metadata: {
      notes: 'Perfect timing on this trade!'
    }
  });

  // Pending subnet deposit
  const subnetUser = getRandomUser();
  activities.push({
    id: 'swap-2',
    type: 'instant_swap',
    timestamp: timeAgo(3),
    status: 'pending',
    owner: subnetUser.address,
    displayName: subnetUser.displayName,
    fromToken: createTokenInfo('CHA', '100000'),
    toToken: createTokenInfo('sCHA', '100000'),
    txid: randomTxId(),
    confirmations: 1,
    priceImpact: 0,
    route: ['CHA', 'sCHA'],
    metadata: {
      isSubnetShift: true,
      gasUsed: '0.0005 STX',
      router: 'sublink'
    }
  });

  // DCA strategy update
  const dcaUser1 = getRandomUser();
  activities.push({
    id: 'dca-1',
    type: 'dca_update',
    timestamp: timeAgo(25), // Yesterday
    status: 'completed',
    owner: dcaUser1.address,
    displayName: dcaUser1.displayName,
    fromToken: createTokenInfo('USDC', '100'),
    toToken: createTokenInfo('CHA', '2380'),
    txid: randomTxId(),
    orderType: 'time_trigger',
    strategy: 'dca',
    strategyPosition: 3,
    strategyTotal: 5,
    executionPrice: 0.042,
    metadata: {
      notes: 'DCA strategy running smoothly'
    }
  });

  // Failed swap
  const failedUser = getRandomUser();
  activities.push({
    id: 'swap-3',
    type: 'instant_swap',
    timestamp: timeAgo(26),
    status: 'failed',
    owner: failedUser.address,
    displayName: failedUser.displayName,
    fromToken: createTokenInfo('WELSH', '1000000'),
    toToken: createTokenInfo('sBTC', '0'),
    priceImpact: -15.2,
    route: ['WELSH', 'CHA', 'sBTC'],
    metadata: {
      errorMessage: 'Insufficient liquidity for large trade',
      router: 'dexterity'
    }
  });

  // Twitter triggered order (with replies)
  const twitterReplies = generateMockReplies('twitter-1', 8);
  const twitterUser = getRandomUser();
  activities.push({
    id: 'twitter-1',
    type: 'twitter_trigger',
    timestamp: timeAgo(72), // 3 days ago
    status: 'completed',
    owner: twitterUser.address,
    displayName: twitterUser.displayName,
    fromToken: createTokenInfo('STX', '1000'),
    toToken: createTokenInfo('CHA', '22500'),
    txid: randomTxId(),
    orderType: 'manual',
    strategy: 'twitter',
    executionPrice: 0.0444,
    replies: twitterReplies,
    replyCount: twitterReplies.length,
    hasReplies: twitterReplies.length > 0,
    metadata: {
      isTwitterTriggered: true,
      twitterHandle: '@crypto_whale',
      notes: 'Triggered by reply: "moon when?"'
    }
  });

  // Large subnet withdrawal
  const withdrawUser = getRandomUser();
  activities.push({
    id: 'swap-4',
    type: 'instant_swap',
    timestamp: timeAgo(73),
    status: 'completed',
    owner: withdrawUser.address,
    displayName: withdrawUser.displayName,
    fromToken: createTokenInfo('ssBTC', '5.0'),
    toToken: createTokenInfo('sBTC', '5.0'),
    txid: randomTxId(),
    confirmations: 6,
    priceImpact: 0,
    route: ['ssBTC', 'sBTC'],
    metadata: {
      isSubnetShift: true,
      gasUsed: '0.002 STX',
      router: 'sublink'
    }
  });

  // Cancelled order
  const cancelUser = getRandomUser();
  activities.push({
    id: 'order-2',
    type: 'order_cancelled',
    timestamp: timeAgo(168), // 1 week ago
    status: 'cancelled',
    owner: cancelUser.address,
    displayName: cancelUser.displayName,
    fromToken: createTokenInfo('LEO', '50000'),
    toToken: createTokenInfo('sBTC', '0.45'),
    orderType: 'price_trigger',
    targetPrice: 50000,
    waitTime: '2 weeks',
    strategy: 'single',
    metadata: {
      notes: 'Market conditions changed, cancelled manually'
    }
  });

  // Old DCA completion
  const dcaUser2 = getRandomUser();
  activities.push({
    id: 'dca-2',
    type: 'dca_update',
    timestamp: timeAgo(336), // 2 weeks ago
    status: 'completed',
    owner: dcaUser2.address,
    displayName: dcaUser2.displayName,
    fromToken: createTokenInfo('USDC', '500'),
    toToken: createTokenInfo('sBTC', '0.0108'),
    txid: randomTxId(),
    orderType: 'time_trigger',
    strategy: 'dca',
    strategyPosition: 5,
    strategyTotal: 5,
    executionPrice: 46300,
    metadata: {
      notes: 'DCA strategy completed successfully! Avg price: $46,120'
    }
  });

  // Massive whale swap (with replies)
  const whaleReplies = generateMockReplies('swap-5', 12);
  const whaleUser = getRandomUser();
  activities.push({
    id: 'swap-5',
    type: 'instant_swap',
    timestamp: timeAgo(504), // 3 weeks ago
    status: 'completed',
    owner: whaleUser.address,
    displayName: whaleUser.displayName,
    fromToken: createTokenInfo('sBTC', '10.0'),
    toToken: createTokenInfo('CHA', '10500000'),
    txid: randomTxId(),
    confirmations: 8,
    priceImpact: -2.8,
    route: ['sBTC', 'CHA'],
    replies: whaleReplies,
    replyCount: whaleReplies.length,
    hasReplies: whaleReplies.length > 0,
    metadata: {
      gasUsed: '0.005 STX',
      router: 'dexterity',
      notes: 'Large whale transaction!'
    }
  });

  return activities.sort((a, b) => b.timestamp - a.timestamp);
}

export function generateMoreMockData(offset: number = 0): ActivityItem[] {
  // Generate additional mock data for infinite scroll
  const moreActivities: ActivityItem[] = [];
  const baseTime = timeAgo(720 + offset * 24); // Start from 30 days ago + offset
  
  for (let i = 0; i < 10; i++) {
    const randomType = randomElement(['instant_swap', 'order_filled', 'dca_update'] as ActivityType[]);
    const randomStatus = randomElement(['completed', 'completed', 'completed', 'failed'] as ActivityStatus[]); // Bias toward completed
    const randomUser = getRandomUser();
    
    const activity: ActivityItem = {
      id: `generated-${offset}-${i}`,
      type: randomType,
      timestamp: baseTime - (i * 60 * 60 * 1000), // Space them out by hours
      status: randomStatus,
      owner: randomUser.address,
      displayName: randomUser.displayName,
      fromToken: createTokenInfo(randomElement(['STX', 'CHA', 'sBTC', 'USDC', 'WELSH'] as const), 
                                 (Math.random() * 1000 + 10).toFixed(2)),
      toToken: createTokenInfo(randomElement(['STX', 'CHA', 'sBTC', 'USDC', 'LEO'] as const), 
                              (Math.random() * 10000 + 100).toFixed(2)),
      txid: randomStatus === 'completed' ? randomTxId() : undefined,
      priceImpact: Math.random() * 4 - 2, // -2% to +2%
      route: ['token1', 'token2'],
      strategy: randomElement(['single', 'dca', 'twitter']),
      metadata: {
        gasUsed: `${(Math.random() * 0.01).toFixed(4)} STX`
      }
    };
    
    moreActivities.push(activity);
  }
  
  return moreActivities;
}