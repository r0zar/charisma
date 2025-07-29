import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, Database, AlertTriangle, CheckCircle, Clock, BarChart3, Zap } from 'lucide-react';
import { getAllEnergyAnalyticsData, fetchHoldToEarnVaults, getEnergyTokenMetadata } from '@/lib/server/energy';
import type { EnergyAnalyticsData } from '@/lib/energy/analytics';
import { fetchMetadata } from '@repo/tokens';
import { formatEnergyValue, formatEnergyCompact, getEnergyTokenSymbol } from '@/lib/format-energy';

interface EnergySystemHealth {
    totalContracts: number;
    activeContracts: number;
    staleContracts: number;
    totalUsers: number;
    totalEnergyHarvested: number;
    avgEnergyPerContract: number;
    lastDataUpdate: number;
    issuesFound: string[];
}

async function analyzeEnergySystemHealth(
    allAnalyticsData: Array<{ contractId: string; analyticsData: EnergyAnalyticsData | null }>
): Promise<EnergySystemHealth> {
    const issues: string[] = [];
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    let totalUsers = 0;
    let totalEnergyHarvested = 0;
    let activeContracts = 0;
    let staleContracts = 0;
    let lastDataUpdate = 0;
    
    for (const { contractId, analyticsData } of allAnalyticsData) {
        if (!analyticsData) {
            issues.push(`No analytics data for contract: ${contractId}`);
            continue;
        }
        
        // Check data freshness
        const dataAge = now - analyticsData.stats.lastUpdated;
        if (dataAge > staleThreshold) {
            staleContracts++;
            issues.push(`Stale data for ${contractId} (${Math.round(dataAge / (60 * 60 * 1000))}h old)`);
        } else {
            activeContracts++;
        }
        
        // Aggregate stats
        totalUsers += analyticsData.stats.uniqueUsers;
        totalEnergyHarvested += analyticsData.stats.totalEnergyHarvested;
        lastDataUpdate = Math.max(lastDataUpdate, analyticsData.stats.lastUpdated);
        
        // Check for anomalies
        if (analyticsData.stats.averageEnergyPerHarvest > 1000000) {
            issues.push(`Unusually high average energy per harvest in ${contractId}: ${analyticsData.stats.averageEnergyPerHarvest}`);
        }
        
        if (analyticsData.logs.length === 0) {
            issues.push(`No harvest logs found for ${contractId}`);
        }
        
        // Check for negative values
        if (analyticsData.stats.totalEnergyHarvested < 0) {
            issues.push(`Negative total energy harvested in ${contractId}`);
        }
    }
    
    return {
        totalContracts: allAnalyticsData.length,
        activeContracts,
        staleContracts,
        totalUsers,
        totalEnergyHarvested,
        avgEnergyPerContract: allAnalyticsData.length > 0 ? totalEnergyHarvested / allAnalyticsData.length : 0,
        lastDataUpdate,
        issuesFound: issues
    };
}

export default async function EnergySystemStatsServer() {
    try {
        const [allAnalyticsData, vaults, energyTokenMetadata, allTokenMetadata] = await Promise.all([
            getAllEnergyAnalyticsData(),
            fetchHoldToEarnVaults(),
            getEnergyTokenMetadata(),
            fetchMetadata()
        ]);
        
        const systemHealth = await analyzeEnergySystemHealth(allAnalyticsData);
        
        return (
            <div className="space-y-6">
                {/* Energy Token Information */}
                {energyTokenMetadata && (
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                {energyTokenMetadata.image && (
                                    <img 
                                        src={energyTokenMetadata.image} 
                                        alt={energyTokenMetadata.name || 'Energy Token'} 
                                        className="w-12 h-12 rounded-full"
                                    />
                                )}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold">
                                            {energyTokenMetadata.name || 'Energy Token'}
                                        </h3>
                                        {energyTokenMetadata.symbol && (
                                            <Badge variant="outline">{energyTokenMetadata.symbol}</Badge>
                                        )}
                                    </div>
                                    {energyTokenMetadata.description && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {energyTokenMetadata.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                                        {energyTokenMetadata.contractId}
                                    </p>
                                </div>
                                {energyTokenMetadata.total_supply && (
                                    <div className="text-right">
                                        <p className="text-sm font-medium">Total Supply</p>
                                        <p className="text-lg font-bold">
                                            {formatEnergyCompact(energyTokenMetadata.total_supply, energyTokenMetadata)} {getEnergyTokenSymbol(energyTokenMetadata)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* System Health Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Contracts</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{systemHealth.totalContracts}</div>
                            <p className="text-xs text-muted-foreground">
                                {systemHealth.activeContracts} active, {systemHealth.staleContracts} stale
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{systemHealth.totalUsers.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">
                                Across all contracts
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Energy</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatEnergyCompact(systemHealth.totalEnergyHarvested, energyTokenMetadata)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {getEnergyTokenSymbol(energyTokenMetadata)} Harvested to date
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">System Health</CardTitle>
                            {systemHealth.issuesFound.length === 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {systemHealth.issuesFound.length === 0 ? 'Healthy' : `${systemHealth.issuesFound.length} Issues`}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Last update: {systemHealth.lastDataUpdate > 0 ? new Date(systemHealth.lastDataUpdate).toLocaleString() : 'Never'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Issues Alert */}
                {systemHealth.issuesFound.length > 0 && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>System Issues Detected</AlertTitle>
                        <AlertDescription>
                            <ul className="mt-2 space-y-1">
                                {systemHealth.issuesFound.slice(0, 5).map((issue, index) => (
                                    <li key={index} className="text-sm">• {issue}</li>
                                ))}
                                {systemHealth.issuesFound.length > 5 && (
                                    <li className="text-sm font-medium">... and {systemHealth.issuesFound.length - 5} more issues</li>
                                )}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
                
                {/* Contract Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" />
                                Contract Analytics
                            </CardTitle>
                            <CardDescription>Detailed analytics for each energy contract</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {allAnalyticsData.map(({ contractId, analyticsData }) => {
                                    // Find corresponding vault for this contract
                                    const vault = vaults.find(v => v.contractId === contractId);
                                    // Find metadata for the contract token
                                    const contractMetadata = allTokenMetadata.find((token: any) => 
                                        token.contractId === contractId || token.contractId === vault?.base
                                    );
                                    
                                    return (
                                        <div key={contractId} className="p-4 border rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    {(vault?.image || contractMetadata?.image) && (
                                                        <img 
                                                            src={vault?.image || contractMetadata?.image || ''} 
                                                            alt={vault?.name || contractId.split('.')[1]} 
                                                            className="w-6 h-6 rounded-full"
                                                        />
                                                    )}
                                                    <div>
                                                        <h4 className="font-medium text-sm">
                                                            {vault?.name || contractMetadata?.name || contractId.split('.')[1]}
                                                        </h4>
                                                        {contractMetadata?.symbol && (
                                                            <p className="text-xs text-muted-foreground">{contractMetadata.symbol}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <Badge variant={analyticsData ? "default" : "destructive"}>
                                                    {analyticsData ? "Active" : "No Data"}
                                                </Badge>
                                            </div>
                                            {analyticsData && (
                                                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                                    <div>Users: {analyticsData.stats.uniqueUsers}</div>
                                                    <div>Energy: {formatEnergyCompact(analyticsData.stats.totalEnergyHarvested, contractMetadata || energyTokenMetadata)}</div>
                                                    <div>Logs: {analyticsData.logs.length}</div>
                                                    <div>Updated: {new Date(analyticsData.stats.lastUpdated).toLocaleDateString()}</div>
                                                </div>
                                            )}
                                            {contractMetadata?.description && (
                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                                    {contractMetadata.description}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Recent Activity
                            </CardTitle>
                            <CardDescription>Latest energy harvest transactions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {allAnalyticsData
                                    .flatMap(({ contractId, analyticsData }) => 
                                        analyticsData?.logs.slice(0, 3).map(log => ({ ...log, contractId })) || []
                                    )
                                    .sort((a, b) => (b.block_time || 0) - (a.block_time || 0))
                                    .slice(0, 8)
                                    .map((log) => (
                                        <div key={`${log.contractId}-${log.tx_id}`} className="flex items-center justify-between text-sm">
                                            <div>
                                                <div className="font-medium">{log.sender.slice(0, 8)}...{log.sender.slice(-4)}</div>
                                                <div className="text-xs text-muted-foreground">{log.contractId.split('.')[1]}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-medium">
                                                    {formatEnergyValue(log.energy, energyTokenMetadata, { compact: true, maxDecimals: 2 })}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {log.block_time ? new Date(log.block_time * 1000).toLocaleDateString() : 'Unknown'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    } catch (error) {
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Energy Analytics</AlertTitle>
                <AlertDescription>
                    {error instanceof Error ? error.message : 'Unknown error occurred'}
                </AlertDescription>
            </Alert>
        );
    }
}