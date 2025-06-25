import { useState, useEffect, useCallback } from 'react';

interface ContractHealth {
  contractId: string;
  name: string;
  isAccessible: boolean;
  functions: {
    quote: { working: boolean; responseTime?: number; error?: string };
    tokenUri: { working: boolean; responseTime?: number; error?: string };
    engineTap: { working: boolean; responseTime?: number; error?: string };
  };
  relationships: {
    engine?: string;
    baseToken?: string;
    traits: string[];
  };
  configValidation: {
    engineMatches: boolean;
    baseTokenReferenced: boolean;
    warnings: string[];
  };
  lastChecked: string;
  overallStatus: 'healthy' | 'warning' | 'error';
}

interface HealthSummary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  lastChecked: string;
}

interface EnergyHealthData {
  health: ContractHealth[];
  summary: HealthSummary;
}

interface UseEnergyHealthReturn {
  data: EnergyHealthData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

export function useEnergyHealth(autoRefresh = false, refreshInterval = 30000): UseEnergyHealthReturn {
  const [data, setData] = useState<EnergyHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/energy/health', {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const healthData = await response.json();
      setData(healthData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
      console.error('Energy health check failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchHealth]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchHealth();
  }, [fetchHealth]);

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated
  };
}

// Helper functions for working with health data
export function getHealthStatusIcon(status: ContractHealth['overallStatus']): string {
  switch (status) {
    case 'healthy': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '❌';
    default: return '❓';
  }
}

export function getHealthStatusColor(status: ContractHealth['overallStatus']): string {
  switch (status) {
    case 'healthy': return 'text-green-600';
    case 'warning': return 'text-yellow-600';
    case 'error': return 'text-red-600';
    default: return 'text-gray-600';
  }
}

export function getFunctionStatusIcon(working: boolean): string {
  return working ? '✅' : '❌';
}

export function formatResponseTime(responseTime?: number): string {
  if (!responseTime) return '';
  return responseTime < 1000 ? `${responseTime}ms` : `${(responseTime / 1000).toFixed(1)}s`;
}