'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, RefreshCw, Clock, AlertTriangle, CheckCircle, 
  Zap, Link, ExternalLink, Timer, Activity 
} from 'lucide-react';
import { 
  useEnergyHealth, 
  getHealthStatusIcon, 
  getHealthStatusColor, 
  getFunctionStatusIcon, 
  formatResponseTime 
} from '@/hooks/useEnergyHealth';

export function EnergyContractHealthMonitor() {
  const { data, loading, error, refetch, lastUpdated } = useEnergyHealth(true, 30000); // Auto-refresh every 30s
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (loading && !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Contract Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading contract health data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Contract Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Health Check Failed</AlertTitle>
            <AlertDescription>
              {error}
              <Button onClick={handleRefresh} variant="outline" size="sm" className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { health, summary } = data;

  return (
    <div className="space-y-6">
      {/* Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contract Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.healthy}/{summary.total} contracts healthy
            </p>
            <Badge 
              variant={summary.healthy === summary.total ? "default" : summary.error === 0 ? "secondary" : "destructive"}
              className="mt-2"
            >
              {summary.healthy === summary.total ? "Excellent" : summary.error === 0 ? "Warning" : "Critical"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Function Status</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {health.map(contract => (
                <div key={contract.contractId} className="flex items-center gap-2 text-xs">
                  <span className="w-16 truncate">{contract.name}</span>
                  <span>{getFunctionStatusIcon(contract.functions.quote.working)}</span>
                  <span>{getFunctionStatusIcon(contract.functions.tokenUri.working)}</span>
                  <span>{getFunctionStatusIcon(contract.functions.engineTap.working)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Configuration</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health.filter(h => h.configValidation.warnings.length === 0).length}/{health.length}
            </div>
            <p className="text-xs text-muted-foreground">
              configs match contracts
            </p>
            {health.some(h => h.configValidation.warnings.length > 0) && (
              <Badge variant="secondary" className="mt-2">
                {health.reduce((sum, h) => sum + h.configValidation.warnings.length, 0)} warnings
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastUpdated ? 
                `${Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s` : 
                'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">ago</p>
            <Button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              variant="outline" 
              size="sm"
              className="mt-2 h-6 text-xs"
            >
              {isRefreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Health Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Contract Health Details
          </CardTitle>
          <CardDescription>
            Real-time status of energy system contracts and functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="functions">Functions</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {health.map(contract => (
                <div key={contract.contractId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getHealthStatusIcon(contract.overallStatus)}</span>
                      <div>
                        <h3 className="font-medium">{contract.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {contract.contractId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={contract.overallStatus === 'healthy' ? 'default' : 
                                    contract.overallStatus === 'warning' ? 'secondary' : 'destructive'}>
                        {contract.overallStatus}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <a 
                          href={`https://explorer.stacks.co/address/${contract.contractId}?chain=mainnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  {contract.relationships.engine && (
                    <div className="text-sm text-muted-foreground mb-2">
                      <Link className="h-3 w-3 inline mr-1" />
                      Engine: {contract.relationships.engine}
                    </div>
                  )}

                  {contract.configValidation.warnings.length > 0 && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {contract.configValidation.warnings[0]}
                        {contract.configValidation.warnings.length > 1 && 
                          ` (+${contract.configValidation.warnings.length - 1} more)`
                        }
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="functions" className="space-y-4">
              {health.map(contract => (
                <div key={contract.contractId} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">{contract.name} Functions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span>{getFunctionStatusIcon(contract.functions.quote.working)}</span>
                        <span className="text-sm font-medium">quote()</span>
                        <Badge variant="outline" size="sm">read-only</Badge>
                      </div>
                      {contract.functions.quote.responseTime && (
                        <p className="text-xs text-muted-foreground">
                          <Timer className="h-3 w-3 inline mr-1" />
                          {formatResponseTime(contract.functions.quote.responseTime)}
                        </p>
                      )}
                      {contract.functions.quote.error && (
                        <p className="text-xs text-red-600">{contract.functions.quote.error}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span>{getFunctionStatusIcon(contract.functions.tokenUri.working)}</span>
                        <span className="text-sm font-medium">get-token-uri()</span>
                        <Badge variant="outline" size="sm">read-only</Badge>
                      </div>
                      {contract.functions.tokenUri.responseTime && (
                        <p className="text-xs text-muted-foreground">
                          <Timer className="h-3 w-3 inline mr-1" />
                          {formatResponseTime(contract.functions.tokenUri.responseTime)}
                        </p>
                      )}
                      {contract.functions.tokenUri.error && (
                        <p className="text-xs text-red-600">{contract.functions.tokenUri.error}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span>{getFunctionStatusIcon(contract.functions.engineTap.working)}</span>
                        <span className="text-sm font-medium">engine-tap()</span>
                        <Badge variant="outline" size="sm">read-only</Badge>
                      </div>
                      {contract.functions.engineTap.responseTime && (
                        <p className="text-xs text-muted-foreground">
                          <Timer className="h-3 w-3 inline mr-1" />
                          {formatResponseTime(contract.functions.engineTap.responseTime)}
                        </p>
                      )}
                      {contract.functions.engineTap.error && (
                        <p className="text-xs text-red-600">{contract.functions.engineTap.error}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              {health.map(contract => (
                <div key={contract.contractId} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">{contract.name} Configuration</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Engine Contract Match</span>
                      <Badge variant={contract.configValidation.engineMatches ? "default" : "destructive"}>
                        {contract.configValidation.engineMatches ? "✅ Match" : "❌ Mismatch"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm">Base Token Referenced</span>
                      <Badge variant={contract.configValidation.baseTokenReferenced ? "default" : "secondary"}>
                        {contract.configValidation.baseTokenReferenced ? "✅ Yes" : "⚠️ No"}
                      </Badge>
                    </div>

                    {contract.relationships.engine && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Discovered Engine:</strong> {contract.relationships.engine}
                      </div>
                    )}

                    {contract.relationships.baseToken && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Discovered Base Token:</strong> {contract.relationships.baseToken}
                      </div>
                    )}

                    {contract.relationships.traits.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Traits:</strong> {contract.relationships.traits.join(', ')}
                      </div>
                    )}

                    {contract.configValidation.warnings.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-600">Configuration Issues:</p>
                        {contract.configValidation.warnings.map((warning, index) => (
                          <p key={index} className="text-xs text-red-600">• {warning}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}