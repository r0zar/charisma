// Core pricing types and interfaces for three-engine architecture

export type PriceSource = 'oracle' | 'market' | 'virtual' | 'hybrid';

export interface TokenPriceData {
    tokenId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    lastUpdated: number;
    source: PriceSource;
    reliability: number; // 0-1 scale replacing confidence
    
    // Engine-specific data
    oracleData?: OraclePriceData;
    marketData?: MarketPriceData;
    virtualData?: VirtualPriceData;
    
    // Arbitrage analysis (when multiple sources available)
    arbitrageOpportunity?: {
        marketPrice?: number;
        virtualValue?: number;
        deviation: number;
        profitable: boolean;
    };
}

// Engine-specific price data types
export interface OraclePriceData {
    asset: string; // 'BTC', 'ETH', etc.
    source: string; // 'kraken', 'coingecko', etc.
    reliability: 'high' | 'medium' | 'low';
    timestamp: number;
}

export interface MarketPriceData {
    primaryPath: PricePath;
    alternativePaths: PricePath[];
    pathsUsed: number;
    totalLiquidity: number;
    priceVariation: number;
}

export interface VirtualPriceData {
    assetType: 'SUBNET' | 'LP_TOKEN';
    calculationMethod: string;
    sourceData?: {
        btcPrice?: number;
        baseTokenPrice?: number;
        underlyingAssetValues?: {
            tokenA: { amount: number; usdValue: number };
            tokenB: { amount: number; usdValue: number };
        };
    };
}

export interface PriceCalculationResult {
    success: boolean;
    price?: TokenPriceData;
    error?: string;
    cached?: boolean;
    cacheKey?: string;
    debugInfo?: {
        btcPrice?: number;
        pathsFound?: number;
        totalLiquidity?: number;
        calculationTimeMs?: number;
        enginesUsed?: PriceSource[];
    };
}

export interface BulkPriceResult {
    success: boolean;
    prices: Map<string, TokenPriceData>;
    errors: Map<string, string>;
    lastUpdated: number;
    cached?: boolean;
    debugInfo?: {
        totalTokens: number;
        successCount: number;
        errorCount: number;
        calculationTimeMs: number;
        engineStats: {
            oracle: number;
            market: number;
            virtual: number;
            hybrid: number;
        };
    };
}

export interface TokenNode {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
    totalLiquidity: number;
    poolCount: number;
    isLpToken?: boolean;
}

export interface PoolEdge {
    poolId: string;
    tokenA: string;
    tokenB: string;
    reservesA: number;
    reservesB: number;
    liquidityUsd: number;
    liquidityRelative: number;
    weight: number;
    lastUpdated: number;
    fee: number;
}

export interface PricePath {
    tokens: string[];
    pools: PoolEdge[];
    totalLiquidity: number;
    pathLength: number;
    reliability: number;
    confidence: number;
}

export interface LPTokenData {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
    totalSupply: number;
    isVault: boolean;
    component1: {
        symbol: string;
        contractId: string;
        decimals: number;
        amount: number;
    };
    component2: {
        symbol: string;
        contractId: string;
        decimals: number;
        amount: number;
    };
}

export interface BtcPriceData {
    price: number;
    source: string;
    lastUpdated: number;
    reliability: number; // 0-1 scale replacing confidence
}

// Price Service Orchestrator types
export interface PriceServiceRequest {
    tokenId: string;
    preferredSources?: PriceSource[];
    includeArbitrageAnalysis?: boolean;
    maxAge?: number;
}

export interface PriceServiceResponse {
    tokenId: string;
    result: PriceCalculationResult;
    arbitrageAnalysis?: {
        marketPrice?: number;
        virtualValue?: number;
        oraclePrice?: number;
        deviation: number;
        opportunity: boolean;
        confidence: number;
    };
}

export interface EngineHealth {
    engine: PriceSource;
    status: 'healthy' | 'degraded' | 'failed';
    lastSuccess: number;
    errorRate: number;
    averageResponseTime: number;
}

// Storage interfaces for Blob storage
export interface PriceStorageData {
    prices: { [tokenId: string]: TokenPriceData };
    lastUpdated: number;
    metadata: {
        btcPrice: number;
        totalTokens: number;
        calculationTime: number;
    };
}

export interface PriceHistoryEntry {
    timestamp: number;
    prices: { [tokenId: string]: number };
    btcPrice: number;
}

export interface DailyPriceData {
    date: string;
    entries: PriceHistoryEntry[];
}

export interface HourlyPriceData {
    hour: string;
    entries: PriceHistoryEntry[];
}

// Configuration interfaces for three-engine architecture
export interface PriceServiceConfig {
    oracle: {
        sources: string[];
        circuitBreaker: {
            failureThreshold: number;
            recoveryTimeout: number;
        };
        cacheDuration: number;
    };
    cpmm: {
        maxPathLength: number;
        minLiquidity: number;
        pathfindingTimeout: number;
        cacheDuration: number;
    };
    virtual: {
        lpQuoteTimeout: number;
        cacheDuration: number;
    };
    arbitrage: {
        enabled: boolean;
        minDeviationPercent: number;
        profitabilityThreshold: number;
    };
    cache: {
        tokenPriceDuration: number;
        bulkPriceDuration: number;
        calculationDuration: number;
    };
    storage: {
        blobPrefix: string;
        compressionEnabled: boolean;
        retentionDays: number;
    };
}