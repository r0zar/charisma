'use client';

import { Activity, CheckCircle, AlertTriangle, Clock, Zap, Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEnergyHealth } from '@/hooks/useEnergyHealth';

export default function EnergySystemStatus() {
    const { data: healthData, loading, error, lastUpdated } = useEnergyHealth();
    
    const vaultHealth = healthData?.health[0]; // Single vault
    const contractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energize-v1';

    if (loading) {
        return (
            <div className="glass-card p-6">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Checking system status...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="glass-card">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Status Check Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle className="h-5 w-5 text-success" />;
            case 'warning':
                return <AlertTriangle className="h-5 w-5 text-warning" />;
            case 'error':
                return <AlertTriangle className="h-5 w-5 text-destructive" />;
            default:
                return <Clock className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-success';
            case 'warning': return 'text-warning';
            case 'error': return 'text-destructive';
            default: return 'text-muted-foreground';
        }
    };

    return (
        <div className="space-y-6">
            {/* Overall System Health */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">System Health</h2>
                            <p className="text-sm text-muted-foreground">Real-time energize vault status</p>
                        </div>
                    </div>
                    
                    {vaultHealth && (
                        <div className="flex items-center gap-2">
                            {getStatusIcon(vaultHealth.overallStatus)}
                            <span className={`font-medium capitalize ${getStatusColor(vaultHealth.overallStatus)}`}>
                                {vaultHealth.overallStatus}
                            </span>
                        </div>
                    )}
                </div>

                {vaultHealth ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Contract Functions */}
                        <div className="token-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap className="h-4 w-4 text-primary" />
                                <span className="font-medium">Contract Functions</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span>quote()</span>
                                    {vaultHealth.functions.quote.working ? (
                                        <Badge variant="default" className="text-xs">Working</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>get-token-uri()</span>
                                    {vaultHealth.functions.tokenUri.working ? (
                                        <Badge variant="default" className="text-xs">Working</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>engine tap</span>
                                    {vaultHealth.functions.engineTap.working ? (
                                        <Badge variant="default" className="text-xs">Working</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Configuration */}
                        <div className="token-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Database className="h-4 w-4 text-primary" />
                                <span className="font-medium">Configuration</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span>Config Status</span>
                                    {vaultHealth.configValidation.warnings.length === 0 ? (
                                        <Badge variant="default" className="text-xs">Valid</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-xs">
                                            {vaultHealth.configValidation.warnings.length} warnings
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Engine Connection</span>
                                    {vaultHealth.relationships.engine ? (
                                        <Badge variant="default" className="text-xs">Connected</Badge>
                                    ) : (
                                        <Badge variant="destructive" className="text-xs">Disconnected</Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Contract Info */}
                        <div className="token-card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle className="h-4 w-4 text-primary" />
                                <span className="font-medium">Contract Info</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Contract ID:</span>
                                    <div className="font-mono text-xs mt-1 break-all">{contractId}</div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Network</span>
                                    <Badge variant="outline" className="text-xs">Mainnet</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Health Data Unavailable</AlertTitle>
                        <AlertDescription>
                            Unable to retrieve current system health information.
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {/* Last Updated Info */}
            {lastUpdated && (
                <div className="text-center text-sm text-muted-foreground">
                    Last updated: {new Date(lastUpdated).toLocaleString()}
                </div>
            )}
        </div>
    );
}