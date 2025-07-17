'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SchedulerStatus {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: number;
  lastUpdate: number | null;
  lastUpdateAge: number | null;
  storage: {
    totalSnapshots: number;
    estimatedStorageGB: number;
  };
  latestSnapshot: {
    timestamp: number;
    tokenCount: number;
    arbitrageOpportunities: number;
    engineStats: {
      oracle: number;
      market: number;
      intrinsic: number;
      hybrid: number;
    };
  } | null;
  environment: {
    INVEST_URL: string;
    SWAP_URL: string;
    NODE_ENV: string;
  };
}

export default function SchedulerDashboard() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerUpdate = async () => {
    setTriggering(true);
    try {
      const response = await fetch('/api/trigger', { method: 'POST' });
      const data = await response.json();
      console.log('Trigger result:', data);
      
      // Refresh status after a delay
      setTimeout(fetchStatus, 2000);
    } catch (error) {
      console.error('Error triggering update:', error);
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'Never';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">Loading scheduler status...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Price Update Scheduler</h1>
          <p className="text-muted-foreground">Three-Engine Architecture • 5-minute intervals</p>
        </div>

        {/* Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              System Status
              <Badge className={getStatusColor(status?.status || 'error')}>
                {status?.status?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Last updated: {status?.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : 'Never'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Last Update</div>
                <div className="text-lg font-semibold">
                  {formatDuration(status?.lastUpdateAge ?? null)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Snapshots</div>
                <div className="text-lg font-semibold">
                  {status?.storage.totalSnapshots || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Storage Used</div>
                <div className="text-lg font-semibold">
                  {status?.storage.estimatedStorageGB.toFixed(3) || 0} GB
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Latest Snapshot */}
        {status?.latestSnapshot && (
          <Card>
            <CardHeader>
              <CardTitle>Latest Price Snapshot</CardTitle>
              <CardDescription>
                {new Date(status.latestSnapshot.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Tokens Priced</div>
                  <div className="text-2xl font-bold">{status.latestSnapshot.tokenCount}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Arbitrage Opportunities</div>
                  <div className="text-2xl font-bold text-orange-500">
                    {status.latestSnapshot.arbitrageOpportunities}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Engine Usage</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Oracle:</span>
                      <span>{status.latestSnapshot.engineStats.oracle}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Market:</span>
                      <span>{status.latestSnapshot.engineStats.market}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Intrinsic:</span>
                      <span>{status.latestSnapshot.engineStats.intrinsic}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Environment:</span>
                <Badge variant="outline">{status?.environment.NODE_ENV}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Invest Service URL:</span>
                <span className="font-mono text-xs">{status?.environment.INVEST_URL}</span>
              </div>
              <div className="flex justify-between">
                <span>Swap Service URL:</span>
                <span className="font-mono text-xs">{status?.environment.SWAP_URL}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Actions</CardTitle>
            <CardDescription>
              Trigger updates manually for testing and debugging
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={triggerUpdate} 
              disabled={triggering}
              className="w-full"
            >
              {triggering ? 'Triggering Update...' : 'Trigger Price Update Now'}
            </Button>
            <Button 
              onClick={fetchStatus} 
              variant="outline"
              className="w-full"
            >
              Refresh Status
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}