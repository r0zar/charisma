import { getHostUrl } from '@modules/discovery';

/** Get the appropriate data API endpoint for current environment */
const getDataApiUrl = (): string => {
  return `${getHostUrl('data')}/api/v1`;
};

// ===== TYPES =====

/** Balance data for an address */
export interface BalanceData {
  address: string;
  lastUpdated: string;
  source: string;
  stxBalance: string;
  fungibleTokens: Record<string, { balance: string; decimals?: number }>;
  nonFungibleTokens: Record<string, { count: string }>;
  metadata: {
    cacheSource: string;
    tokenCount: number;
    nftCount: number;
    stxLocked: string;
    stxTotalSent: string;
    stxTotalReceived: string;
  };
}

/** API response wrapper for balance data */
export interface BalanceResponse {
  address: string;
  balance: BalanceData;
  meta: {
    timestamp: string;
    processingTime: string;
    source: string;
    cached: boolean;
  };
}

/** Price data for a token */
export interface PriceData {
  tokenId: string;
  symbol: string;
  usdPrice: number;
  confidence: number;
  lastUpdated: string;
  source: string;
  metadata?: Record<string, any>;
}

/** API response wrapper for current prices */
export interface PricesResponse {
  status: 'success' | 'error';
  data: PriceData[];
  meta: {
    timestamp: string;
    processingTime: string;
    total: number;
    limit: number;
  };
}

/** Time series data point */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

/** Price series data for a token */
export interface PriceSeriesData {
  tokenId: string;
  symbol: string;
  timeframe: string;
  series: TimeSeriesPoint[];
  metadata: {
    firstDataPoint: string;
    lastDataPoint: string;
    totalPoints: number;
    source: string;
  };
}

/** API response wrapper for price series */
export interface PriceSeriesResponse {
  success: boolean;
  data: PriceSeriesData;
  meta: {
    timestamp: string;
    processingTime: string;
  };
}

/** Balance series data for an address */
export interface BalanceSeriesData {
  address: string;
  timeframe: string;
  series: Array<{
    timestamp: string;
    stxBalance: string;
    tokenBalances: Record<string, string>;
    nftCounts: Record<string, string>;
    metadata?: Record<string, any>;
  }>;
  metadata: {
    firstDataPoint: string;
    lastDataPoint: string;
    totalPoints: number;
    source: string;
  };
}

/** API response wrapper for balance series */
export interface BalanceSeriesResponse {
  success: boolean;
  data: BalanceSeriesData;
  meta: {
    timestamp: string;
    processingTime: string;
  };
}

/** Configuration for API requests */
export interface ClientConfig {
  timeout?: number;
  retries?: number;
  baseUrl?: string;
}

const DEFAULT_CONFIG: Required<ClientConfig> = {
  timeout: 10000,
  retries: 3,
  baseUrl: ''
};

// ===== UTILITY FUNCTIONS =====

/** Create a timeout promise */
function createTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout: Operation took longer than ${ms}ms`));
    }, ms);
  });
}

/** Make HTTP request with timeout and retries */
async function makeRequest<T>(
  url: string, 
  config: Partial<ClientConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const apiUrl = finalConfig.baseUrl || getDataApiUrl();
  const fullUrl = `${apiUrl}${url}`;
  
  let lastError: Error;

  for (let attempt = 0; attempt <= finalConfig.retries; attempt++) {
    try {
      const response = await Promise.race([
        fetch(fullUrl, {
          headers: {
            'Accept': 'application/json',
          }
        }),
        createTimeoutPromise<Response>(finalConfig.timeout)
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < finalConfig.retries) {
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError!;
}

// ===== BALANCE FUNCTIONS =====

/**
 * Get current balance data for a specific address
 */
export async function getAddressBalance(
  address: string,
  config: Partial<ClientConfig> = {}
): Promise<BalanceData> {
  if (!address || !address.match(/^S[PTM][0-9A-Z]{39}$/)) {
    throw new Error('Invalid Stacks address format');
  }

  const response = await makeRequest<BalanceResponse>(`/balances/${address}`, config);
  return response.balance;
}

/**
 * Get balance data for multiple addresses
 */
export async function getAddressBalances(
  addresses: string[],
  config: Partial<ClientConfig> = {}
): Promise<Record<string, BalanceData>> {
  if (!addresses.length) {
    return {};
  }

  // Validate all addresses
  for (const address of addresses) {
    if (!address.match(/^S[PTM][0-9A-Z]{39}$/)) {
      throw new Error(`Invalid Stacks address format: ${address}`);
    }
  }

  // Fetch balances concurrently
  const promises = addresses.map(address => 
    getAddressBalance(address, config).then(balance => ({ address, balance }))
  );

  const results = await Promise.allSettled(promises);
  const balances: Record<string, BalanceData> = {};

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      balances[result.value.address] = result.value.balance;
    } else {
      console.warn(`Failed to fetch balance for ${addresses[index]}:`, result.reason);
    }
  });

  return balances;
}

/**
 * Get historical balance data for an address
 */
export async function getAddressBalanceSeries(
  address: string,
  timeframe: string = '24h',
  config: Partial<ClientConfig> = {}
): Promise<BalanceSeriesData> {
  if (!address || !address.match(/^S[PTM][0-9A-Z]{39}$/)) {
    throw new Error('Invalid Stacks address format');
  }

  const response = await makeRequest<BalanceSeriesResponse>(
    `/addresses/${address}/historical/${timeframe}`, 
    config
  );
  
  if (!response.success) {
    throw new Error('Failed to fetch balance series data');
  }

  return response.data;
}

/**
 * Get list of known addresses with balances
 */
export async function getKnownAddresses(
  config: Partial<ClientConfig> = {}
): Promise<string[]> {
  const response = await makeRequest<{ addresses: string[] }>('/balances/known-addresses', config);
  return response.addresses;
}

// ===== PRICE FUNCTIONS =====

/**
 * Get current price data for all tokens
 */
export async function getCurrentPrices(
  limit: number = 100,
  config: Partial<ClientConfig> = {}
): Promise<PriceData[]> {
  const response = await makeRequest<PricesResponse>(
    `/prices/current?limit=${limit}`, 
    config
  );
  
  if (response.status !== 'success') {
    throw new Error('Failed to fetch current prices');
  }

  return response.data;
}

/**
 * Get current price for a specific token
 */
export async function getTokenPrice(
  contractId: string,
  config: Partial<ClientConfig> = {}
): Promise<PriceData> {
  if (!contractId) {
    throw new Error('Contract ID is required');
  }

  const response = await makeRequest<{ price: PriceData }>(`/prices/current/${contractId}`, config);
  return response.price;
}

/**
 * Get price data for multiple tokens
 */
export async function getTokenPrices(
  contractIds: string[],
  config: Partial<ClientConfig> = {}
): Promise<Record<string, PriceData>> {
  if (!contractIds.length) {
    return {};
  }

  // Fetch prices concurrently
  const promises = contractIds.map(contractId => 
    getTokenPrice(contractId, config).then(price => ({ contractId, price }))
  );

  const results = await Promise.allSettled(promises);
  const prices: Record<string, PriceData> = {};

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      prices[result.value.contractId] = result.value.price;
    } else {
      console.warn(`Failed to fetch price for ${contractIds[index]}:`, result.reason);
    }
  });

  return prices;
}

/**
 * Get historical price data for a token
 */
export async function getTokenPriceSeries(
  contractId: string,
  timeframe: string = '24h',
  config: Partial<ClientConfig> = {}
): Promise<PriceSeriesData> {
  if (!contractId) {
    throw new Error('Contract ID is required');
  }

  const response = await makeRequest<PriceSeriesResponse>(
    `/price-series/${contractId}?timeframe=${timeframe}`, 
    config
  );
  
  if (!response.success) {
    throw new Error('Failed to fetch price series data');
  }

  return response.data;
}

/**
 * Lookup token price by symbol
 */
export async function lookupTokenPriceBySymbol(
  symbol: string,
  config: Partial<ClientConfig> = {}
): Promise<PriceData> {
  if (!symbol) {
    throw new Error('Token symbol is required');
  }

  const response = await makeRequest<{ price: PriceData }>(`/prices/lookup/${symbol}`, config);
  return response.price;
}

// ===== COMPOSITE FUNCTIONS =====

/**
 * Get comprehensive data for an address (balance + price data for held tokens)
 */
export async function getAddressPortfolio(
  address: string,
  config: Partial<ClientConfig> = {}
): Promise<{
  balance: BalanceData;
  tokenPrices: Record<string, PriceData>;
  portfolioValue: {
    stxValue: number;
    tokenValue: number;
    totalValue: number;
  };
}> {
  // Get balance data
  const balance = await getAddressBalance(address, config);
  
  // Extract token contract IDs from fungible tokens
  const tokenIds = Object.keys(balance.fungibleTokens);
  
  // Get prices for all held tokens + STX
  const allTokenIds = ['.stx', ...tokenIds];
  const tokenPrices = await getTokenPrices(allTokenIds, config);
  
  // Calculate portfolio value
  let stxValue = 0;
  let tokenValue = 0;
  
  // STX value
  const stxPrice = tokenPrices['.stx']?.usdPrice || 0;
  const stxBalance = parseFloat(balance.stxBalance) / 1000000; // Convert from microSTX
  stxValue = stxBalance * stxPrice;
  
  // Token values
  for (const [tokenId, tokenBalance] of Object.entries(balance.fungibleTokens)) {
    const price = tokenPrices[tokenId]?.usdPrice || 0;
    const amount = parseFloat(tokenBalance.balance) / Math.pow(10, tokenBalance.decimals || 6);
    tokenValue += amount * price;
  }
  
  return {
    balance,
    tokenPrices,
    portfolioValue: {
      stxValue,
      tokenValue,
      totalValue: stxValue + tokenValue
    }
  };
}

/**
 * Get price trends for multiple tokens over time
 */
export async function getTokenPriceTrends(
  contractIds: string[],
  timeframe: string = '24h',
  config: Partial<ClientConfig> = {}
): Promise<Record<string, PriceSeriesData>> {
  if (!contractIds.length) {
    return {};
  }

  // Fetch price series concurrently
  const promises = contractIds.map(contractId => 
    getTokenPriceSeries(contractId, timeframe, config).then(series => ({ contractId, series }))
  );

  const results = await Promise.allSettled(promises);
  const trends: Record<string, PriceSeriesData> = {};

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      trends[result.value.contractId] = result.value.series;
    } else {
      console.warn(`Failed to fetch price trend for ${contractIds[index]}:`, result.reason);
    }
  });

  return trends;
}