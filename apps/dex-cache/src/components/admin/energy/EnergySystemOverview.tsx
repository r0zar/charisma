import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Database, AlertTriangle, CheckCircle, Clock, BarChart3, Zap, Activity, RefreshCw, Shield, Link } from 'lucide-react';
import { getAllEnergyAnalyticsData, fetchHoldToEarnVaults, getEnergyTokenMetadata } from '@/lib/server/energy';
import type { EnergyAnalyticsData } from '@/lib/energy/analytics';
import { fetchMetadata, type TokenCacheData } from '@repo/tokens';
import { formatEnergyValue, formatEnergyCompact, getEnergyTokenSymbol } from '@/lib/format-energy';
import { EnergyContractHealthMonitor } from './EnergyContractHealthMonitor';
import { EnergizeVaultHeader } from './EnergizeVaultHeader';
import { EnergyTokenRequirements } from './EnergyTokenRequirements';

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
    }
    
    const totalContracts = allAnalyticsData.length;
    const avgEnergyPerContract = totalContracts > 0 ? totalEnergyHarvested / totalContracts : 0;
    
    // Add system-level health checks
    if (totalContracts === 0) {
        issues.push('No energy contracts found');
    }
    
    if (staleContracts > totalContracts * 0.3) {
        issues.push(`High number of stale contracts: ${staleContracts}/${totalContracts}`);
    }
    
    if (totalUsers === 0) {
        issues.push('No active users found across all contracts');
    }
    
    return {
        totalContracts,
        activeContracts,
        staleContracts,
        totalUsers,
        totalEnergyHarvested,
        avgEnergyPerContract,
        lastDataUpdate,
        issuesFound: issues
    };
}

export default async function EnergySystemOverview() {
    try {
        // Fetch system data
        const [vaults, energyTokenMetadata, allAnalyticsData] = await Promise.all([
            fetchHoldToEarnVaults(),
            getEnergyTokenMetadata(),
            getAllEnergyAnalyticsData()
        ]);
        
        const systemHealth = await analyzeEnergySystemHealth(allAnalyticsData);
        const energySymbol = getEnergyTokenSymbol(energyTokenMetadata);
        
        // Calculate system metrics
        const healthPercentage = systemHealth.totalContracts > 0 
            ? Math.round((systemHealth.activeContracts / systemHealth.totalContracts) * 100)
            : 0;
        
        const avgUsersPerContract = systemHealth.activeContracts > 0 
            ? Math.round(systemHealth.totalUsers / systemHealth.activeContracts)
            : 0;
        
        const timeSinceUpdate = systemHealth.lastDataUpdate > 0 
            ? Math.round((Date.now() - systemHealth.lastDataUpdate) / (60 * 1000)) // minutes
            : 0;

        return (
            <div className="space-y-6">
                {/* Single Vault Header */}
                <EnergizeVaultHeader showDetails={true} />
                
                {/* Token Requirements - Critical Information */}
                <EnergyTokenRequirements />
                
                {/* System Health Alert */}
                {systemHealth.issuesFound.length > 0 && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>System Health Issues ({systemHealth.issuesFound.length})</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                {systemHealth.issuesFound.slice(0, 3).map((issue, index) => (
                                    <li key={index} className="text-sm">{issue}</li>
                                ))}
                                {systemHealth.issuesFound.length > 3 && (
                                    <li className="text-sm">...and {systemHealth.issuesFound.length - 3} more issues</li>
                                )}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
                
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">System Health</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{healthPercentage}%</div>
                            <p className="text-xs text-muted-foreground">
                                {systemHealth.activeContracts}/{systemHealth.totalContracts} contracts active
                            </p>
                            <Badge 
                                variant={healthPercentage >= 80 ? "default" : healthPercentage >= 60 ? "secondary" : "destructive"}
                                className="mt-2"
                            >
                                {healthPercentage >= 80 ? "Healthy" : healthPercentage >= 60 ? "Warning" : "Critical"}
                            </Badge>
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
                                harvested across all contracts
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                                ~{formatEnergyCompact(systemHealth.avgEnergyPerContract, energyTokenMetadata)} avg/contract
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{systemHealth.totalUsers.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">
                                across all energy contracts
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                ~{avgUsersPerContract} avg users/contract
                            </p>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {timeSinceUpdate < 60 ? `${timeSinceUpdate}m` : `${Math.round(timeSinceUpdate / 60)}h`}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                since last data refresh
                            </p>
                            <Badge 
                                variant={timeSinceUpdate < 60 ? "default" : timeSinceUpdate < 240 ? "secondary" : "destructive"}
                                className="mt-2"
                            >
                                {timeSinceUpdate < 60 ? "Fresh" : timeSinceUpdate < 240 ? "Stale" : "Very Stale"}
                            </Badge>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Contract Status Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                Contract Status
                            </CardTitle>
                            <CardDescription>
                                Overview of energy contract health and activity
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                        <span className="text-sm">Active Contracts</span>
                                    </div>
                                    <Badge variant="default">{systemHealth.activeContracts}</Badge>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                        <span className="text-sm">Stale Contracts</span>
                                    </div>
                                    <Badge variant={systemHealth.staleContracts > 0 ? "destructive" : "secondary"}>
                                        {systemHealth.staleContracts}
                                    </Badge>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm">Total Monitored</span>
                                    </div>
                                    <Badge variant="outline">{systemHealth.totalContracts}</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5" />
                                System Performance
                            </CardTitle>
                            <CardDescription>
                                Key performance indicators for the energy system
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Energy per Contract</span>
                                    <span className="font-medium">
                                        {formatEnergyValue(systemHealth.avgEnergyPerContract, energyTokenMetadata)}
                                    </span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Users per Contract</span>
                                    <span className="font-medium">{avgUsersPerContract.toLocaleString()}</span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">System Uptime</span>
                                    <span className="font-medium">{healthPercentage}%</span>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Data Freshness</span>
                                    <span className="font-medium">
                                        {timeSinceUpdate < 60 ? "Excellent" : timeSinceUpdate < 240 ? "Good" : "Poor"}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                
                {/* Contract Health Monitor - Real-time contract health checking */}
                <EnergyContractHealthMonitor />
                
                {/* Recent Activity Summary */}
                {systemHealth.lastDataUpdate > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <RefreshCw className="h-5 w-5" />
                                System Status
                            </CardTitle>
                            <CardDescription>
                                Last updated {new Date(systemHealth.lastDataUpdate).toLocaleString()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Monitoring {systemHealth.totalContracts} energy contracts with {systemHealth.totalUsers} active users
                                </div>
                                <Badge variant={systemHealth.issuesFound.length === 0 ? "default" : "destructive"}>
                                    {systemHealth.issuesFound.length === 0 ? "All Systems Operational" : `${systemHealth.issuesFound.length} Issues Found`}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
        
    } catch (error) {
        console.error('Error loading energy system overview:', error);
        return (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading System Overview</AlertTitle>
                <AlertDescription>
                    Failed to load system health data. Please try refreshing the page.
                </AlertDescription>
            </Alert>
        );
    }
}