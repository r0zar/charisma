'use client';

import React, { useState, useEffect } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react';

interface HealthData {
  btcOracle: {
    price: number;
    sources: number;
    confidence: number;
    status: 'healthy' | 'degraded' | 'error';
  };
  priceGraph: {
    totalTokens: number;
    totalPools: number;
    sbtcPairs: number;
    status: 'healthy' | 'error';
  };
  pricingCoverage: {
    percentage: number;
    pricedTokens: number;
    totalTokens: number;
  };
  performance: {
    avgResponseTime: number;
    uptime: number;
  };
}

export default function PriceSystemHealthCards() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        setIsLoading(true);
        
        // Skip API calls during build time
        if (typeof window === 'undefined') {
          setIsLoading(false);
          return;
        }
        
        // Fetch from our health endpoint
        const response = await fetch('/api/v1/prices/health', {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        if (!response.ok) {
          throw new Error('Failed to fetch health data');
        }
        
        const healthResponse = await response.json();
        const data = healthResponse.data;
        
        // Transform the API response to our component format
        const transformedData: HealthData = {
          btcOracle: {
            price: data.btcOracle.currentPrice || 0,
            sources: data.btcOracle.availableSources?.length || 0,
            confidence: data.btcOracle.confidence || 0,
            status: data.btcOracle.status === 'healthy' ? 'healthy' : 'degraded'
          },
          priceGraph: {
            totalTokens: data.priceGraph.totalTokens || 0,
            totalPools: data.priceGraph.totalPools || 0,
            sbtcPairs: data.priceGraph.sbtcPairCount || 0,
            status: data.priceGraph.status === 'healthy' ? 'healthy' : 'error'
          },
          pricingCoverage: {
            percentage: data.dataAvailability.pricingCoverage || 0,
            pricedTokens: data.dataAvailability.tokensWithPricing || 0,
            totalTokens: data.dataAvailability.totalTokensInSystem || 0
          },
          performance: {
            avgResponseTime: 250, // Placeholder - would come from metrics
            uptime: 99.8 // Placeholder - would come from monitoring
          }
        };
        
        setHealthData(transformedData);
      } catch (error) {
        console.error('Failed to fetch price system health:', error);
        // Set fallback data
        setHealthData({
          btcOracle: { price: 0, sources: 0, confidence: 0, status: 'error' },
          priceGraph: { totalTokens: 0, totalPools: 0, sbtcPairs: 0, status: 'error' },
          pricingCoverage: { percentage: 0, pricedTokens: 0, totalTokens: 0 },
          performance: { avgResponseTime: 0, uptime: 0 }
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchHealthData();
    
    // Refresh health data every 5 minutes
    const interval = setInterval(fetchHealthData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading || !healthData) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* BTC Oracle Status */}
      <StatCard
        title="BTC Oracle"
        value={healthData.btcOracle.price > 0 ? `$${healthData.btcOracle.price.toLocaleString()}` : 'Offline'}
        icon="dollar"
        description={`${healthData.btcOracle.sources} sources • ${(healthData.btcOracle.confidence * 100).toFixed(0)}% confidence`}
        colorScheme={healthData.btcOracle.status === 'healthy' ? 'success' : 
                    healthData.btcOracle.status === 'degraded' ? 'warning' : 'danger'}
        size="sm"
      />

      {/* Graph Health */}
      <StatCard
        title="Price Graph"
        value={`${healthData.priceGraph.totalTokens} tokens`}
        icon="activity"
        description={`${healthData.priceGraph.totalPools} pools • ${healthData.priceGraph.sbtcPairs} sBTC pairs`}
        colorScheme={healthData.priceGraph.status === 'healthy' ? 'success' : 'danger'}
        size="sm"
      />

      {/* Pricing Coverage */}
      <StatCard
        title="Price Coverage"
        value={`${healthData.pricingCoverage.percentage}%`}
        icon="chart"
        description={`${healthData.pricingCoverage.pricedTokens}/${healthData.pricingCoverage.totalTokens} tokens priced`}
        colorScheme={healthData.pricingCoverage.percentage >= 80 ? 'success' : 
                    healthData.pricingCoverage.percentage >= 60 ? 'warning' : 'danger'}
        size="sm"
      />

      {/* Performance */}
      <StatCard
        title="Performance"
        value={`${healthData.performance.avgResponseTime}ms`}
        icon="clock"
        description={`${healthData.performance.uptime}% uptime`}
        colorScheme="primary"
        size="sm"
      />
    </div>
  );
}