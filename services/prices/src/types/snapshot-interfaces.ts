/**
 * Detailed interfaces for Vercel Blob snapshot data structures
 * Based on analysis of actual snapshot data from blob storage
 */

export interface SnapshotMetadata {
    version: string;
    engine: string;
    generatedAt: number;
    totalTokens: number;
}

export interface MarketPath {
    tokens: string[];
    pools: PoolData[];
    totalLiquidity: number;
    pathLength: number;
    reliability: number;
    confidence: number;
}

export interface PoolData {
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

export interface MarketData {
    primaryPath: MarketPath;
    alternativePaths?: MarketPath[];
    pathsUsed: number;
    totalLiquidity: number;
    priceVariation: number;
}

export interface IntrinsicData {
    assetType: string;
    calculationMethod: string;
    sourceData: {
        btcPrice?: number;
        [key: string]: any;
    };
}

export interface ArbitrageOpportunity {
    marketPrice: number;
    virtualValue: number;
    deviation: number;
    profitable: boolean;
}

/**
 * Individual token price entry in a snapshot
 */
export interface SnapshotTokenPrice {
    tokenId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    lastUpdated: number;
    source: 'oracle' | 'market' | 'virtual' | 'hybrid' | 'intrinsic';
    reliability: number;
    
    // Optional data based on source type
    marketData?: MarketData;
    intrinsicData?: IntrinsicData;
    arbitrageOpportunity?: ArbitrageOpportunity;
}

/**
 * Complete snapshot structure as stored in Vercel Blob
 */
export interface PriceSnapshot {
    timestamp: number;
    prices: SnapshotTokenPrice[];
    metadata: SnapshotMetadata;
}

/**
 * Historical snapshot coverage analysis
 */
export interface SnapshotCoverage {
    totalSnapshots: number;
    dateRange: {
        earliest: string;
        latest: string;
    };
    tokenCoverage: {
        tokenId: string;
        symbol: string;
        firstAppearance: string;
        snapshotCount: number;
        dataPoints: number;
    }[];
    comprehensiveDataStart: string; // When snapshots started containing 100+ tokens
}

/**
 * Sparkline data availability for a token
 */
export interface TokenSparklineAvailability {
    tokenId: string;
    symbol: string;
    hasData: boolean;
    dataPoints: number;
    timespan: {
        start: string;
        end: string;
        durationHours: number;
    } | null;
    reason?: 'insufficient_history' | 'token_not_found' | 'recent_listing';
}

/**
 * Blob storage analysis result
 */
export interface BlobAnalysisResult {
    success: boolean;
    totalBlobs: number;
    latestSnapshot: PriceSnapshot | null;
    coverage: SnapshotCoverage;
    sparklineAvailability: TokenSparklineAvailability[];
    recommendations: string[];
}

/**
 * Price series entry for time-based charts
 */
export interface TimeSeriesEntry {
    timestamp: number;
    tokenId: string;
    usdPrice: number;
    sbtcRatio: number;
    source: string;
    reliability: number;
}

/**
 * Bulk sparkline request for multiple tokens
 */
export interface BulkSparklineRequest {
    tokenIds: string[];
    timeframe: '1h' | '4h' | '24h';
    maxDataPoints?: number;
}

/**
 * Bulk sparkline response
 */
export interface BulkSparklineResponse {
    success: boolean;
    data: {
        [tokenId: string]: {
            available: boolean;
            dataPoints: TimeSeriesEntry[];
            reason?: string;
        };
    };
    metadata: {
        snapshotsScanned: number;
        oldestDataPoint: string | null;
        newestDataPoint: string | null;
    };
}

/**
 * Token data quality metrics
 */
export interface TokenDataQuality {
    tokenId: string;
    symbol: string;
    reliability: {
        overall: number;
        source: string;
        marketDepth?: number;
        priceStability?: number;
    };
    coverage: {
        snapshotCount: number;
        timespan: number; // hours
        gaps: number; // missing data points
    };
    suitableForSparklines: boolean;
    recommendations: string[];
}

/**
 * System-wide data health report
 */
export interface DataHealthReport {
    timestamp: number;
    totalTokens: number;
    sparklineCapable: number;
    recentListings: number;
    dataQuality: {
        excellent: number;
        good: number;
        poor: number;
        insufficient: number;
    };
    systemRecommendations: string[];
    tokenDetails: TokenDataQuality[];
}