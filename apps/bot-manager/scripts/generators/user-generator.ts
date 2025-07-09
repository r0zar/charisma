// User Data Generator
import { AppSettings } from '@/contexts/settings-context';
import { UIPreferences, WalletState, NotificationState, TokenBalance, WalletTransaction } from '@/types/app-state';
import { GeneratorOptions } from '@/types/app-state';
import {
  SeededRandom,
  TOKEN_NAMES,
  generateStacksAddress,
  generateTxHash,
  generateContractId,
  generateDate,
  generateAmount,
  createId,
  getProfileConfig,
} from './helpers';

export function generateUserSettings(rng: SeededRandom, options: GeneratorOptions): AppSettings {
  const config = getProfileConfig(options.profile);
  
  return {
    general: {
      isDarkMode: rng.nextBoolean(0.6),
      compactMode: rng.nextBoolean(0.3),
      autoRefresh: rng.nextBoolean(0.8),
    },
    network: {
      network: rng.choice(['mainnet', 'testnet', 'devnet']),
      rpcEndpoint: options.profile === 'testing' 
        ? 'https://stacks-node-api.testnet.stacks.co'
        : 'https://stacks-node-api.mainnet.stacks.co',
    },
    botDefaults: {
      autoRestart: rng.nextBoolean(0.7),
      defaultGasPrice: rng.nextInt(800, 1500),
      defaultSlippage: rng.nextFloat(0.3, 1.0),
      defaultStrategy: rng.choice(['yield-farming', 'dca', 'arbitrage', 'liquidity-mining']),
    },
    notifications: {
      trade: rng.nextBoolean(0.8),
      error: rng.nextBoolean(0.9),
      status: rng.nextBoolean(0.6),
      performance: rng.nextBoolean(0.7),
      security: rng.nextBoolean(0.9),
    },
    notificationChannel: rng.choice(['browser', 'email', 'webhook', 'disabled']),
    security: {
      apiKey: generateApiKey(rng),
      autoLockTimeout: rng.choice(['never', '15', '30', '60']),
      requireConfirmation: rng.nextBoolean(0.8),
    },
    advanced: {
      debugMode: options.profile === 'development' ? rng.nextBoolean(0.5) : false,
      performanceMonitoring: rng.nextBoolean(0.8),
    },
  };
}

function generateApiKey(rng: SeededRandom): string {
  const chars = '0123456789abcdef';
  let key = 'sk-';
  
  for (let i = 0; i < 40; i++) {
    key += chars[rng.nextInt(0, chars.length - 1)];
  }
  
  return key;
}

export function generateUIPreferences(rng: SeededRandom, options: GeneratorOptions): UIPreferences {
  return {
    sidebarCollapsed: rng.nextBoolean(0.3),
    theme: rng.choice(['light', 'dark']),
    skin: rng.choice(['default', 'ocean', 'sunset', 'forest', 'lavender']),
    language: rng.choice(['en', 'es', 'fr', 'de', 'zh']),
    timezone: rng.choice([
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
    ]),
    dateFormat: rng.choice(['ISO', 'US', 'EU']),
    numberFormat: rng.choice(['US', 'EU']),
  };
}

export function generateWalletState(rng: SeededRandom, options: GeneratorOptions): WalletState {
  const config = getProfileConfig(options.profile);
  const isConnected = rng.nextBoolean(0.8);
  
  const walletState: WalletState = {
    isConnected,
    address: isConnected ? generateStacksAddress(rng, options.profile === 'testing') : null,
    network: rng.choice(['mainnet', 'testnet', 'devnet']),
    balance: {
      stx: isConnected ? generateAmount(rng, options.profile, 'large') : 0,
      tokens: isConnected ? generateTokenBalances(rng, options.profile) : [],
    },
    transactions: isConnected ? generateWalletTransactions(rng, options, config) : [],
    connectionMethod: isConnected ? rng.choice(['hiro', 'xverse', 'ledger']) : null,
  };
  
  return walletState;
}

function generateTokenBalances(rng: SeededRandom, profile: string): TokenBalance[] {
  const count = rng.nextInt(2, 6);
  const balances: TokenBalance[] = [];
  
  for (let i = 0; i < count; i++) {
    const token = rng.choice(TOKEN_NAMES);
    const balance = generateAmount(rng, profile, 'large');
    const formattedBalance = balance / Math.pow(10, token.decimals);
    
    balances.push({
      contractId: generateContractId(rng, token.symbol.toLowerCase()),
      symbol: token.symbol,
      name: token.name,
      balance: Math.floor(balance),
      decimals: token.decimals,
      usdValue: formattedBalance * rng.nextFloat(0.1, 10),
    });
  }
  
  return balances;
}

function generateWalletTransactions(rng: SeededRandom, options: GeneratorOptions, config: any): WalletTransaction[] {
  const count = rng.nextInt(10, 50);
  const transactions: WalletTransaction[] = [];
  
  for (let i = 0; i < count; i++) {
    const transaction = generateWalletTransaction(rng, options, config);
    transactions.push(transaction);
  }
  
  // Sort by timestamp (newest first)
  return transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateWalletTransaction(rng: SeededRandom, options: GeneratorOptions, config: any): WalletTransaction {
  const types = ['send', 'receive', 'contract-call', 'deploy'];
  const statuses = ['pending', 'confirmed', 'failed'];
  const type = rng.choice(types);
  const status = rng.choice(statuses);
  const timestamp = generateDate(rng, config.daysOfHistory);
  
  const transaction: WalletTransaction = {
    txId: generateTxHash(rng),
    timestamp,
    type,
    amount: generateAmount(rng, options.profile, 'medium'),
    token: rng.choice(TOKEN_NAMES).symbol,
    status,
    fee: rng.nextFloat(0.001, 0.01),
  };
  
  // Add optional fields
  if (status === 'confirmed') {
    transaction.blockHeight = rng.nextInt(100000, 999999);
  }
  
  if (rng.nextBoolean(0.3)) {
    transaction.memo = rng.choice([
      'Bot funding',
      'Yield farming reward',
      'LP token withdrawal',
      'Staking reward',
      'Trading profit',
    ]);
  }
  
  return transaction;
}

export function generateNotifications(rng: SeededRandom, options: GeneratorOptions): NotificationState[] {
  const config = getProfileConfig(options.profile);
  const count = rng.nextInt(5, 20);
  const notifications: NotificationState[] = [];
  
  for (let i = 0; i < count; i++) {
    const notification = generateNotification(rng, options, config);
    notifications.push(notification);
  }
  
  // Sort by timestamp (newest first)
  return notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateNotification(rng: SeededRandom, options: GeneratorOptions, config: any): NotificationState {
  const types = ['success', 'error', 'warning', 'info'];
  const type = rng.choice(types);
  
  const titles = {
    success: [
      'Bot started successfully',
      'Trade executed',
      'Yield harvested',
      'LP tokens staked',
      'Settings updated',
    ],
    error: [
      'Bot execution failed',
      'Transaction reverted',
      'Insufficient balance',
      'Network connection lost',
      'Contract call failed',
    ],
    warning: [
      'High slippage detected',
      'Gas price elevated',
      'Bot performance declining',
      'Wallet balance low',
      'API rate limit approaching',
    ],
    info: [
      'New farming opportunity available',
      'Market volatility increased',
      'System maintenance scheduled',
      'New token listing detected',
      'Price alert triggered',
    ],
  };
  
  const messages = {
    success: [
      'Your bot has been activated and is now running',
      'Successfully swapped 100 STX for ALEX',
      'Collected 5.2 CHA tokens in farming rewards',
      'Added 250 STX to liquidity pool',
      'Notification preferences have been saved',
    ],
    error: [
      'Bot encountered an error and has been paused',
      'Transaction failed due to insufficient gas',
      'Wallet balance too low to execute trade',
      'Unable to connect to RPC endpoint',
      'Smart contract rejected the transaction',
    ],
    warning: [
      'Current slippage exceeds your tolerance of 1%',
      'Network gas prices are 50% above normal',
      'Your bot has not made a profit in 24 hours',
      'Less than 10 STX remaining in wallet',
      'Approaching 80% of hourly API limit',
    ],
    info: [
      'New STX-ALEX pool offers 25% APR',
      'Bitcoin price movement may affect STX',
      'Maintenance window: 2 AM - 4 AM UTC',
      'WELSH token now available for trading',
      'STX price increased by 15% in last hour',
    ],
  };
  
  const notification: NotificationState = {
    id: createId('notification', rng),
    type,
    title: rng.choice(titles[type]),
    message: rng.choice(messages[type]),
    timestamp: generateDate(rng, config.daysOfHistory),
    read: rng.nextBoolean(0.6),
    persistent: rng.nextBoolean(0.2),
  };
  
  // Add action URL for some notifications
  if (rng.nextBoolean(0.3)) {
    const actionUrls = [
      '/bots',
      '/analytics',
      '/settings',
      '/wallet',
      '/market',
    ];
    notification.actionUrl = rng.choice(actionUrls);
  }
  
  return notification;
}

// All exports are already defined above with export keyword