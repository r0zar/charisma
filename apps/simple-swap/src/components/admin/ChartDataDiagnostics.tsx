"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    RefreshCw, 
    AlertCircle, 
    CheckCircle, 
    Database, 
    TrendingUp,
    BarChart3,
    Search
} from 'lucide-react';
import ConditionTokenChartWrapper from '../condition-token-chart-wrapper';
import { TokenCacheData } from '@/lib/contract-registry-adapter';

interface PriceDiagnostic {
    contractId: string;
    status: 'healthy' | 'no-data';
    latestPrice?: number;
    dataPoints: {
        total: number;
        last30Days: number;
    };
    timestamps: {
        firstSeen: string | null;
        lastSeen: string | null;
    };
    chartData: {
        format: string;
        sampleSize: number;
        sample: Array<{ time: number; value: number }>;
    };
    diagnostics: {
        hasData: boolean;
        hasRecentData: boolean;
        dataGaps: {
            hasGaps: boolean;
            largestGap: number | null;
            gapCount: number;
        };
        priceValidation: {
            valid: boolean;
            issues: string[];
        };
    };
}

interface TokenValidation {
    summary: {
        totalTokens: number;
        tokensWithData: number;
        tokenTypes: Record<string, number>;
    };
    tokenDiagnostics: Array<{
        contractId: string;
        symbol: string;
        name: string;
        type: string;
        hasData: boolean;
        latestPrice?: number;
        totalDataPoints: number;
        lastSeen: string | null;
    }>;
}

interface ChartTestData {
    contractId: string;
    chartData: {
        format: string;
        data: Array<{ time: number; value: number }>;
        validation: {
            totalPoints: number;
            validPoints: number;
            timeRange: { start: string; end: string } | null;
            priceRange: { min: number; max: number } | null;
        };
    };
    apiTestUrl: string;
    readyForChart: boolean;
}

export default function ChartDataDiagnostics() {
    const [contractId, setContractId] = useState('');
    const [baseContractId, setBaseContractId] = useState('');
    const [diagnostic, setDiagnostic] = useState<PriceDiagnostic | null>(null);
    const [tokenValidation, setTokenValidation] = useState<TokenValidation | null>(null);
    const [chartTestData, setChartTestData] = useState<ChartTestData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('health-check');

    // Popular conditional token contract IDs for quick testing
    const popularTokens = [
        'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token',
        'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx',
        'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt',
        'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx'
    ];

    const handleHealthCheck = async () => {
        if (!contractId.trim()) {
            setError('Please enter a contract ID');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/price-diagnostics?action=health-check&contractId=${encodeURIComponent(contractId)}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setDiagnostic(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run health check');
        } finally {
            setLoading(false);
        }
    };

    const handleValidateTokens = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/price-diagnostics?action=validate-tokens');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setTokenValidation(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to validate tokens');
        } finally {
            setLoading(false);
        }
    };

    const handleTestChartData = async () => {
        if (!contractId.trim()) {
            setError('Please enter a contract ID');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            let url = `/api/admin/price-diagnostics?action=test-chart-data&contractId=${encodeURIComponent(contractId)}`;
            if (baseContractId.trim()) {
                url += `&baseTokenId=${encodeURIComponent(baseContractId)}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            setChartTestData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to test chart data');
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (timestamp: string | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString();
    };

    const formatDuration = (ms: number | null) => {
        if (!ms) return 'N/A';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d ${hours % 24}h`;
        return `${hours}h`;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Chart Data Diagnostics
                    </CardTitle>
                    <CardDescription>
                        Diagnose and test conditional token chart data loading issues
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <Label htmlFor="contractId">Token Contract ID</Label>
                                <Input
                                    id="contractId"
                                    value={contractId}
                                    onChange={(e) => setContractId(e.target.value)}
                                    placeholder="e.g., SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token"
                                />
                            </div>
                            <div className="flex gap-2 items-end">
                                <Button onClick={handleHealthCheck} disabled={loading}>
                                    {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                                    Test Token
                                </Button>
                            </div>
                        </div>

                        {/* Quick test buttons */}
                        <div className="flex flex-wrap gap-2">
                            {popularTokens.map((tokenId) => (
                                <Button
                                    key={tokenId}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setContractId(tokenId)}
                                >
                                    {tokenId.split('.')[1]?.substring(0, 15) || tokenId.substring(0, 15)}...
                                </Button>
                            ))}
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="health-check" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="health-check">Health Check</TabsTrigger>
                    <TabsTrigger value="chart-test">Chart Test</TabsTrigger>
                    <TabsTrigger value="token-overview">Token Overview</TabsTrigger>
                </TabsList>

                <TabsContent value="health-check" className="space-y-4">
                    {diagnostic && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {diagnostic.status === 'healthy' ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    Health Check Results
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label>Status</Label>
                                        <Badge variant={diagnostic.status === 'healthy' ? 'default' : 'destructive'}>
                                            {diagnostic.status}
                                        </Badge>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Latest Price</Label>
                                        <div className="font-mono">
                                            {diagnostic.latestPrice !== undefined ? `$${diagnostic.latestPrice.toFixed(6)}` : 'N/A'}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Total Data Points</Label>
                                        <div className="font-mono">{diagnostic.dataPoints.total}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Recent Data (30d)</Label>
                                        <div className="font-mono">{diagnostic.dataPoints.last30Days}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>First Seen</Label>
                                        <div className="text-sm">{formatTimestamp(diagnostic.timestamps.firstSeen)}</div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Last Seen</Label>
                                        <div className="text-sm">{formatTimestamp(diagnostic.timestamps.lastSeen)}</div>
                                    </div>
                                </div>

                                {/* Data quality indicators */}
                                <div className="space-y-2">
                                    <Label>Data Quality</Label>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant={diagnostic.diagnostics.hasData ? 'default' : 'destructive'}>
                                            {diagnostic.diagnostics.hasData ? 'Has Data' : 'No Data'}
                                        </Badge>
                                        <Badge variant={diagnostic.diagnostics.hasRecentData ? 'default' : 'secondary'}>
                                            {diagnostic.diagnostics.hasRecentData ? 'Recent Data' : 'Stale Data'}
                                        </Badge>
                                        <Badge variant={diagnostic.diagnostics.dataGaps.hasGaps ? 'secondary' : 'default'}>
                                            {diagnostic.diagnostics.dataGaps.hasGaps ? `${diagnostic.diagnostics.dataGaps.gapCount} Gaps` : 'No Gaps'}
                                        </Badge>
                                        <Badge variant={diagnostic.diagnostics.priceValidation.valid ? 'default' : 'destructive'}>
                                            {diagnostic.diagnostics.priceValidation.valid ? 'Valid Prices' : 'Invalid Prices'}
                                        </Badge>
                                    </div>
                                </div>

                                {diagnostic.diagnostics.priceValidation.issues.length > 0 && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            Issues found: {diagnostic.diagnostics.priceValidation.issues.join(', ')}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Sample chart data */}
                                {diagnostic.chartData.sample.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Sample Chart Data</Label>
                                        <div className="bg-muted p-3 rounded-md overflow-x-auto">
                                            <pre className="text-xs">
                                                {JSON.stringify(diagnostic.chartData.sample, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="chart-test" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ratio Chart Testing</CardTitle>
                            <CardDescription>
                                Test the conditional chart ratio calculation between two tokens
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="conditionToken">Condition Token (numerator)</Label>
                                    <Input
                                        id="conditionToken"
                                        value={contractId}
                                        onChange={(e) => setContractId(e.target.value)}
                                        placeholder="Condition token contract ID"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="baseToken">Base Token (denominator)</Label>
                                    <Input
                                        id="baseToken"
                                        value={baseContractId}
                                        onChange={(e) => setBaseContractId(e.target.value)}
                                        placeholder="Base token contract ID (optional)"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-4">
                                <Button onClick={handleTestChartData} disabled={loading || !contractId.trim()}>
                                    {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                                    Test Chart Rendering
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setContractId('SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dme000-governance-token');
                                        setBaseContractId('SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-susdt');
                                    }}
                                >
                                    DME/SUSDT Example
                                </Button>
                            </div>

                            {!baseContractId.trim() && (
                                <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Without a base token, the chart will show raw price data. With a base token, it will show the ratio (condition/base).
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {chartTestData && (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Chart Test Results</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Data Points</Label>
                                            <div className="font-mono">{chartTestData.chartData.validation.totalPoints}</div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Valid Points</Label>
                                            <div className="font-mono">{chartTestData.chartData.validation.validPoints}</div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Chart Ready</Label>
                                            <Badge variant={chartTestData.readyForChart ? 'default' : 'destructive'}>
                                                {chartTestData.readyForChart ? 'Ready' : 'Not Ready'}
                                            </Badge>
                                        </div>
                                    </div>

                                    {chartTestData.chartData.validation.priceRange && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Price Range</Label>
                                                <div className="text-sm">
                                                    ${chartTestData.chartData.validation.priceRange.min.toFixed(6)} - 
                                                    ${chartTestData.chartData.validation.priceRange.max.toFixed(6)}
                                                </div>
                                            </div>
                                            {chartTestData.chartData.validation.timeRange && (
                                                <div className="space-y-2">
                                                    <Label>Time Range</Label>
                                                    <div className="text-sm">
                                                        {formatTimestamp(chartTestData.chartData.validation.timeRange.start)} - 
                                                        {formatTimestamp(chartTestData.chartData.validation.timeRange.end)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label>API Test URL</Label>
                                        <div className="bg-muted p-2 rounded-md">
                                            <code className="text-xs break-all">{chartTestData.apiTestUrl}</code>
                                        </div>
                                    </div>

                                    {/* Show ratio test results if available */}
                                    {(chartTestData as any).ratioTest && (
                                        <div className="space-y-2">
                                            <Label>Ratio Calculation Test</Label>
                                            {(chartTestData as any).ratioTest.error ? (
                                                <Alert variant="destructive">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertDescription>
                                                        {(chartTestData as any).ratioTest.error}
                                                        <br />
                                                        Base token data points: {(chartTestData as any).ratioTest.baseTokenDataPoints}
                                                        <br />
                                                        Condition token data points: {(chartTestData as any).ratioTest.conditionTokenDataPoints}
                                                    </AlertDescription>
                                                </Alert>
                                            ) : (
                                                <div className="bg-muted p-3 rounded-md space-y-2">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <div className="font-medium">Base Token Data</div>
                                                            <div>Original: {(chartTestData as any).ratioTest.baseToken.dataPoints}</div>
                                                            {(chartTestData as any).ratioTest.baseToken.extrapolatedPoints && (
                                                                <div>Extrapolated: {(chartTestData as any).ratioTest.baseToken.extrapolatedPoints}</div>
                                                            )}
                                                            {(chartTestData as any).ratioTest.baseToken.wasExtrapolated && (
                                                                <Badge variant="secondary">Extrapolated</Badge>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">Condition Token Data</div>
                                                            <div>Original: {(chartTestData as any).ratioTest.conditionToken?.dataPoints || chartTestData.chartData.validation.totalPoints}</div>
                                                            {(chartTestData as any).ratioTest.conditionToken?.extrapolatedPoints && (
                                                                <div>Extrapolated: {(chartTestData as any).ratioTest.conditionToken.extrapolatedPoints}</div>
                                                            )}
                                                            {(chartTestData as any).ratioTest.conditionToken?.wasExtrapolated && (
                                                                <Badge variant="secondary">Extrapolated</Badge>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">Ratio Status</div>
                                                            <div>Points: {(chartTestData as any).ratioTest.ratio.dataPoints}</div>
                                                            <Badge variant={(chartTestData as any).ratioTest.ratio.resilient ? 'default' : 'destructive'}>
                                                                {(chartTestData as any).ratioTest.ratio.resilient ? 'Resilient' : 'Failed'}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    {/* Show extrapolation information */}
                                                    {((chartTestData as any).ratioTest.baseToken?.wasExtrapolated || (chartTestData as any).ratioTest.conditionToken?.wasExtrapolated) && (
                                                        <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded-md">
                                                            <div className="text-green-800 dark:text-green-200 text-sm">
                                                                <div className="font-medium mb-1">🛡️ Resilience Applied</div>
                                                                <div>
                                                                    Sparse data was automatically extrapolated to create a meaningful ratio chart.
                                                                    {(chartTestData as any).ratioTest.baseToken?.wasExtrapolated && " Base token data was extended."}
                                                                    {(chartTestData as any).ratioTest.conditionToken?.wasExtrapolated && " Condition token data was extended."}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(chartTestData as any).ratioTest.ratio.sampleData?.length > 0 && (
                                                        <div>
                                                            <div className="font-medium text-sm mb-1">Sample Ratio Data:</div>
                                                            <pre className="text-xs overflow-x-auto">
                                                                {JSON.stringify((chartTestData as any).ratioTest.ratio.sampleData, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Visual chart comparison */}
                            {chartTestData.readyForChart && contractId && (
                                <div className="space-y-4">
                                    {/* Individual token charts */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Individual Token Charts</CardTitle>
                                            <CardDescription>
                                                Compare the raw price data for each token
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Condition Token Chart */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-base font-medium">
                                                        Condition Token: {contractId.split('.')[1] || 'Unknown'}
                                                    </Label>
                                                    <Badge variant="outline">
                                                        {chartTestData.chartData.validation.totalPoints} points
                                                    </Badge>
                                                </div>
                                                <div className="border rounded-lg p-4">
                                                    <ConditionTokenChartWrapper
                                                        token={{
                                                            contractId,
                                                            symbol: contractId.split('.')[1] || 'CONDITION',
                                                            name: 'Condition Token',
                                                            decimals: 6,
                                                            image: ''
                                                        } as TokenCacheData}
                                                        baseToken={null}
                                                        targetPrice=""
                                                        onTargetPriceChange={() => {}}
                                                    />
                                                </div>
                                            </div>

                                            {/* Base Token Chart (if provided) */}
                                            {baseContractId && (chartTestData as any).ratioTest && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="text-base font-medium">
                                                            Base Token: {baseContractId.split('.')[1] || 'Unknown'}
                                                        </Label>
                                                        <Badge variant="outline">
                                                            {(chartTestData as any).ratioTest.baseToken?.dataPoints || 0} points
                                                        </Badge>
                                                    </div>
                                                    <div className="border rounded-lg p-4">
                                                        <ConditionTokenChartWrapper
                                                            token={{
                                                                contractId: baseContractId,
                                                                symbol: baseContractId.split('.')[1] || 'BASE',
                                                                name: 'Base Token',
                                                                decimals: 6,
                                                                image: ''
                                                            } as TokenCacheData}
                                                            baseToken={null}
                                                            targetPrice=""
                                                            onTargetPriceChange={() => {}}
                                                        />
                                                    </div>
                                                    
                                                    {/* Data comparison */}
                                                    <div className="bg-muted/50 p-3 rounded-lg">
                                                        <div className="text-sm space-y-1">
                                                            <div className="font-medium">Data Comparison:</div>
                                                            <div>• Condition token: {chartTestData.chartData.validation.totalPoints} data points</div>
                                                            <div>• Base token: {(chartTestData as any).ratioTest.baseToken?.dataPoints || 0} data points</div>
                                                            <div>• Resulting ratio points: {(chartTestData as any).ratioTest.ratio?.dataPoints || 0}</div>
                                                            {(chartTestData as any).ratioTest.baseToken?.dataPoints === 1 && (
                                                                <div className="text-amber-600 font-medium">
                                                                    ⚠️ Base token has only 1 data point - this creates a flat ratio line!
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Ratio Chart */}
                                    {baseContractId && (chartTestData as any).ratioTest?.ratio?.hasValidRatio && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Ratio Chart (Conditional Chart)</CardTitle>
                                                <CardDescription>
                                                    This is what the conditional chart shows: {contractId.split('.')[1]} / {baseContractId.split('.')[1]}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="border rounded-lg p-4">
                                                    <ConditionTokenChartWrapper
                                                        token={{
                                                            contractId,
                                                            symbol: contractId.split('.')[1] || 'CONDITION',
                                                            name: 'Condition Token',
                                                            decimals: 6,
                                                            image: ''
                                                        } as TokenCacheData}
                                                        baseToken={{
                                                            contractId: baseContractId,
                                                            symbol: baseContractId.split('.')[1] || 'BASE',
                                                            name: 'Base Token',
                                                            decimals: 6,
                                                            image: ''
                                                        } as TokenCacheData}
                                                        targetPrice=""
                                                        onTargetPriceChange={() => {}}
                                                    />
                                                </div>
                                                
                                                <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                                                    <div className="text-sm">
                                                        <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Analysis:</div>
                                                        <div className="text-blue-700 dark:text-blue-300">
                                                            {(chartTestData as any).ratioTest.baseToken?.dataPoints === 1 
                                                                ? "The base token has only 1 data point, so the ratio will appear as a flat line divided by a constant. This suggests the base token price data is not being updated properly."
                                                                : `The ratio chart shows ${(chartTestData as any).ratioTest.ratio.dataPoints} calculated points from dividing condition token prices by base token prices.`
                                                            }
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="token-overview" className="space-y-4">
                    <div className="flex gap-4">
                        <Button onClick={handleValidateTokens} disabled={loading}>
                            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                            Validate All Tokens
                        </Button>
                    </div>

                    {tokenValidation && (
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Token Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label>Total Tokens</Label>
                                            <div className="font-mono text-2xl">{tokenValidation.summary.totalTokens}</div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>With Price Data</Label>
                                            <div className="font-mono text-2xl">{tokenValidation.summary.tokensWithData}</div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Coverage</Label>
                                            <div className="font-mono text-2xl">
                                                {((tokenValidation.summary.tokensWithData / tokenValidation.summary.totalTokens) * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Top Tokens by Data Points</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {tokenValidation.tokenDiagnostics.slice(0, 10).map((token) => (
                                            <div key={token.contractId} className="flex items-center justify-between p-2 border rounded">
                                                <div className="flex-1">
                                                    <div className="font-medium">{token.symbol}</div>
                                                    <div className="text-xs text-muted-foreground">{token.contractId}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-mono">{token.totalDataPoints}</div>
                                                    <div className="text-xs">
                                                        {token.hasData ? (
                                                            <Badge variant="default">Has Data</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">No Data</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}