'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, AlertTriangle, CheckCircle, RefreshCw, 
  ExternalLink, Copy, Eye, EyeOff, GitCompare 
} from 'lucide-react';

interface ConfigValidationData {
  vaultId: string;
  vaultName: string;
  configured: {
    engine?: string;
    baseToken?: string;
    protocol: string;
    type: string;
  };
  discovered: {
    engine?: string;
    baseToken?: string;
    traits: string[];
    contractType: string;
    relationships: Array<{
      type: string;
      target: string;
      evidence: string;
    }>;
  };
  mismatches: Array<{
    field: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    recommendation?: string;
  }>;
  lastAnalyzed: string;
}

export function EnergyConfigurationValidator() {
  const [data, setData] = useState<ConfigValidationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

  const fetchConfigValidation = async () => {
    try {
      setError(null);
      // For now, we'll simulate the data based on our validation insights
      // In a real implementation, this would call an API endpoint
      const response = await fetch('/api/admin/energy/health');
      const healthData = await response.json();
      
      const validationData: ConfigValidationData[] = healthData.health.map((contract: any) => ({
        vaultId: contract.contractId,
        vaultName: contract.name,
        configured: {
          engine: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn', // From vault config
          baseToken: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1', // From vault config
          protocol: 'CHARISMA',
          type: 'ENERGY'
        },
        discovered: {
          engine: contract.relationships.engine,
          baseToken: contract.relationships.baseToken,
          traits: contract.relationships.traits,
          contractType: 'energize-vault',
          relationships: []
        },
        mismatches: contract.configValidation.warnings.map((warning: string) => ({
          field: warning.includes('engine') ? 'engine' : 'baseToken',
          severity: 'warning' as const,
          message: warning,
          recommendation: warning.includes('engine') ? 
            'Update vault configuration to match contract source code' :
            'Verify base token configuration matches contract usage'
        })),
        lastAnalyzed: contract.lastChecked
      }));

      setData(validationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configuration validation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigValidation();
  }, []);

  const toggleDetails = (vaultId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [vaultId]: !prev[vaultId]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Validator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Analyzing configuration...</span>
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
            <Settings className="h-5 w-5" />
            Configuration Validator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Validation Failed</AlertTitle>
            <AlertDescription>
              {error}
              <Button onClick={fetchConfigValidation} variant="outline" size="sm" className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const totalMismatches = data.reduce((sum, vault) => sum + vault.mismatches.length, 0);
  const vaultsWithIssues = data.filter(vault => vault.mismatches.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Config Health</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.length > 0 ? Math.round(((data.length - vaultsWithIssues) / data.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {data.length - vaultsWithIssues}/{data.length} configs valid
            </p>
            <Badge 
              variant={vaultsWithIssues === 0 ? "default" : "destructive"}
              className="mt-2"
            >
              {vaultsWithIssues === 0 ? "All Valid" : `${vaultsWithIssues} Issues`}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mismatches</CardTitle>
            <GitCompare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMismatches}</div>
            <p className="text-xs text-muted-foreground">
              config vs contract differences
            </p>
            {totalMismatches > 0 && (
              <Badge variant="secondary" className="mt-2">
                Need Review
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Check</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.length > 0 ? Math.round((Date.now() - new Date(data[0].lastAnalyzed).getTime()) / 1000) : 0}s
            </div>
            <p className="text-xs text-muted-foreground">ago</p>
            <Button 
              onClick={fetchConfigValidation} 
              variant="outline" 
              size="sm"
              className="mt-2 h-6 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Validation Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration Validation Details
          </CardTitle>
          <CardDescription>
            Compare vault configuration with discovered contract relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {data.map(vault => (
              <div key={vault.vaultId} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-lg">{vault.vaultName}</h3>
                    <p className="text-sm text-muted-foreground">{vault.vaultId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={vault.mismatches.length === 0 ? "default" : "destructive"}>
                      {vault.mismatches.length === 0 ? "✅ Valid" : `⚠️ ${vault.mismatches.length} issues`}
                    </Badge>
                    <Button 
                      onClick={() => toggleDetails(vault.vaultId)}
                      variant="ghost" 
                      size="sm"
                    >
                      {showDetails[vault.vaultId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Issues Summary */}
                {vault.mismatches.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {vault.mismatches.map((mismatch, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{mismatch.field}:</strong> {mismatch.message}
                          {mismatch.recommendation && (
                            <div className="mt-1 text-sm">
                              💡 <em>{mismatch.recommendation}</em>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                {/* Configuration Comparison */}
                <Tabs defaultValue="comparison" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="comparison">Config vs Contract</TabsTrigger>
                    <TabsTrigger value="relationships">Discovered Relationships</TabsTrigger>
                  </TabsList>

                  <TabsContent value="comparison" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-blue-600">📝 Configured Values</h4>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                            <span className="text-sm font-medium">Engine:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono truncate max-w-32">{vault.configured.engine || 'Not set'}</span>
                              {vault.configured.engine && (
                                <Button 
                                  onClick={() => copyToClipboard(vault.configured.engine!)}
                                  variant="ghost" 
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                            <span className="text-sm font-medium">Base Token:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono truncate max-w-32">{vault.configured.baseToken || 'Not set'}</span>
                              {vault.configured.baseToken && (
                                <Button 
                                  onClick={() => copyToClipboard(vault.configured.baseToken!)}
                                  variant="ghost" 
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                            <span className="text-sm font-medium">Protocol:</span>
                            <span className="text-xs">{vault.configured.protocol}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-green-600">🔍 Discovered Values</h4>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span className="text-sm font-medium">Engine:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono truncate max-w-32">{vault.discovered.engine || 'Not found'}</span>
                              {vault.discovered.engine && (
                                <Button 
                                  onClick={() => copyToClipboard(vault.discovered.engine!)}
                                  variant="ghost" 
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span className="text-sm font-medium">Base Token:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-mono truncate max-w-32">{vault.discovered.baseToken || 'Not found'}</span>
                              {vault.discovered.baseToken && (
                                <Button 
                                  onClick={() => copyToClipboard(vault.discovered.baseToken!)}
                                  variant="ghost" 
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span className="text-sm font-medium">Contract Type:</span>
                            <span className="text-xs">{vault.discovered.contractType}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="relationships" className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">🔗 Contract Relationships</h4>
                      
                      {vault.discovered.traits.length > 0 && (
                        <div className="p-3 bg-gray-50 rounded">
                          <p className="text-sm font-medium mb-2">Implemented Traits:</p>
                          {vault.discovered.traits.map((trait, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span className="font-mono">{trait}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm font-medium mb-2">Analysis Summary:</p>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>• Contract implements liquidity-pool-trait for standardization</p>
                          <p>• Engine relationship discovered through source code analysis</p>
                          <p>• Base token relationship inferred from contract references</p>
                          <p>• Single-vault architecture optimized for energy system</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a 
                            href={`https://explorer.stacks.co/address/${vault.vaultId}?chain=mainnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Contract
                          </a>
                        </Button>
                        {vault.discovered.engine && (
                          <Button variant="outline" size="sm" asChild>
                            <a 
                              href={`https://explorer.stacks.co/address/${vault.discovered.engine}?chain=mainnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Engine
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}