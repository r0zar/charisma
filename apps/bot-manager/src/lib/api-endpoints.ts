// API Endpoints Configuration
export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify',
  },
  
  // Bots
  BOTS: {
    LIST: '/bots',
    CREATE: '/bots',
    GET: (id: string) => `/bots/${id}`,
    UPDATE: (id: string) => `/bots/${id}`,
    DELETE: (id: string) => `/bots/${id}`,
    START: (id: string) => `/bots/${id}/start`,
    PAUSE: (id: string) => `/bots/${id}/pause`,
    STOP: (id: string) => `/bots/${id}/stop`,
    LOGS: (id: string) => `/bots/${id}/logs`,
    METRICS: (id: string) => `/bots/${id}/metrics`,
    WITHDRAW: (id: string) => `/bots/${id}/withdraw`,
  },
  
  // Wallet
  WALLET: {
    CONNECT: '/wallet/connect',
    DISCONNECT: '/wallet/disconnect',
    BALANCE: '/wallet/balance',
    TRANSACTIONS: '/wallet/transactions',
    SIGN: '/wallet/sign',
  },
  
  // Settings
  SETTINGS: {
    GET: '/settings',
    UPDATE: '/settings',
    EXPORT: '/settings/export',
    IMPORT: '/settings/import',
    RESET: '/settings/reset',
  },
  
  // Stacks Network
  STACKS: {
    ACCOUNT_INFO: (address: string) => `/stacks/account/${address}`,
    TRANSACTION: (txId: string) => `/stacks/transaction/${txId}`,
    CONTRACT_CALL: '/stacks/contract-call',
    TOKEN_TRANSFER: '/stacks/token-transfer',
  },
  
  // DeFi Data
  DEFI: {
    POOLS: '/defi/pools',
    POOL_INFO: (poolId: string) => `/defi/pools/${poolId}`,
    TOKEN_PRICE: (tokenId: string) => `/defi/tokens/${tokenId}/price`,
    YIELD_FARMS: '/defi/yield-farms',
    LIQUIDITY_MINING: '/defi/liquidity-mining',
  },
  
  // Analytics
  ANALYTICS: {
    PERFORMANCE: '/analytics/performance',
    PROFIT_LOSS: '/analytics/profit-loss',
    TRADES: '/analytics/trades',
    PORTFOLIO: '/analytics/portfolio',
  },
  
  // Notifications
  NOTIFICATIONS: {
    LIST: '/notifications',
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
    PREFERENCES: '/notifications/preferences',
  },
  
  // Health & Status
  HEALTH: {
    STATUS: '/health/status',
    METRICS: '/health/metrics',
    VERSION: '/health/version',
  },
} as const;

// API Response Types
export interface ApiListResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  path: string;
}

// Common API Parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}

// API Cache Keys
export const API_CACHE_KEYS = {
  BOTS_LIST: 'bots:list',
  BOT_DETAIL: (id: string) => `bots:${id}`,
  WALLET_BALANCE: 'wallet:balance',
  SETTINGS: 'settings',
  DEFI_POOLS: 'defi:pools',
  ANALYTICS_PERFORMANCE: 'analytics:performance',
} as const;

// API Cache TTL (in milliseconds)
export const API_CACHE_TTL = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  STATIC: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Request timeouts
export const API_TIMEOUTS = {
  FAST: 5000, // 5 seconds
  NORMAL: 10000, // 10 seconds
  SLOW: 30000, // 30 seconds
} as const;

// Helper function to build query string
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  
  return searchParams.toString();
}

// Helper function to build URL with params
export function buildApiUrl(endpoint: string, params?: Record<string, any>): string {
  if (!params) return endpoint;
  
  const queryString = buildQueryString(params);
  return queryString ? `${endpoint}?${queryString}` : endpoint;
}