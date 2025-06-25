'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Play, Pause, RefreshCw, Settings, AlertTriangle, CheckCircle, Database, Zap } from 'lucide-react';
import { formatEnergyCompact } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';
// Note: fetchMetadata is moved to server-side API calls

interface MonitoredContract {
    id: string;
    name: string;
    address: string;
    status: 'active' | 'paused' | 'error';
    lastUpdated: number;
    totalUsers: number;
    totalEnergy: number;
    dataSize: number;
    issues: string[];
}

interface ProcessingStatus {
    isRunning: boolean;
    lastRun: number;
    duration: number;
    processedContracts: number;
    errors: string[];
}

export default function EnergyContractManager() {
    const [contracts, setContracts] = useState<MonitoredContract[]>([]);
    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData[]>([]);
    const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
        isRunning: false,
        lastRun: 0,
        duration: 0,
        processedContracts: 0,
        errors: []
    });
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [newContractId, setNewContractId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchContracts();
        fetchProcessingStatus();
    }, []);

    const fetchContracts = async () => {
        try {
            setLoading(true);
            const contractsResponse = await fetch('/api/v1/admin/energy-contracts');
            
            if (!contractsResponse.ok) {
                throw new Error('Failed to fetch contracts');
            }
            const data = await contractsResponse.json();
            
            // Transform the data to match our interface
            const transformedContracts: MonitoredContract[] = data.contracts?.map((contract: any) => ({
                id: contract.contractId,
                name: contract.contractId.split('.')[1] || contract.contractId,
                address: contract.contractId.split('.')[0] || '',
                status: contract.analyticsData ? 'active' : 'error',
                lastUpdated: contract.analyticsData?.stats?.lastUpdated || 0,
                totalUsers: contract.analyticsData?.stats?.uniqueUsers || 0,
                totalEnergy: contract.analyticsData?.stats?.totalEnergyHarvested || 0,
                dataSize: contract.analyticsData?.logs?.length || 0,
                issues: contract.analyticsData ? [] : ['No analytics data available']
            })) || [];
            
            setContracts(transformedContracts);
            setTokenMetadata(data.metadata || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            // Mock data for demonstration
            setContracts([
                {
                    id: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.dexterity-hold-to-earn',
                    name: 'dexterity-hold-to-earn',
                    address: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ',
                    status: 'active',
                    lastUpdated: Date.now() - 3600000,
                    totalUsers: 150,
                    totalEnergy: 45000,
                    dataSize: 1250,
                    issues: []
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchProcessingStatus = async () => {
        try {
            const response = await fetch('/api/v1/admin/energy-processing-status');
            if (response.ok) {
                const data = await response.json();
                setProcessingStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch processing status:', err);
        }
    };

    const addContract = async () => {
        if (!newContractId.trim()) return;
        
        try {
            setError(null);
            const response = await fetch('/api/v1/cron/energy-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractId: newContractId.trim() })
            });

            if (!response.ok) {
                throw new Error('Failed to add contract');
            }

            setSuccess('Contract added successfully');
            setNewContractId('');
            setShowAddDialog(false);
            fetchContracts();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const removeContract = async (contractId: string) => {
        try {
            setError(null);
            const response = await fetch('/api/v1/cron/energy-data', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contractId })
            });

            if (!response.ok) {
                throw new Error('Failed to remove contract');
            }

            setSuccess('Contract removed successfully');
            fetchContracts();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const triggerDataProcessing = async () => {
        try {
            setError(null);
            setProcessingStatus(prev => ({ ...prev, isRunning: true }));
            
            const response = await fetch('/api/v1/cron/energy-data', {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Failed to trigger processing');
            }

            const result = await response.json();
            setProcessingStatus({
                isRunning: false,
                lastRun: result.timestamp,
                duration: result.duration,
                processedContracts: result.contractsProcessed || 0,
                errors: result.errors || []
            });
            
            setSuccess('Data processing completed successfully');
            fetchContracts();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setProcessingStatus(prev => ({ ...prev, isRunning: false }));
        }
    };

    const clearSuccess = () => setSuccess(null);
    const clearError = () => setError(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Energy Contract Manager
                </CardTitle>
                <CardDescription>Manage monitored energy contracts and data processing</CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                        <Button variant="ghost" size="sm" onClick={clearError} className="mt-2">
                            Dismiss
                        </Button>
                    </Alert>
                )}

                {success && (
                    <Alert className="mb-4">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{success}</AlertDescription>
                        <Button variant="ghost" size="sm" onClick={clearSuccess} className="mt-2">
                            Dismiss
                        </Button>
                    </Alert>
                )}

                <Tabs defaultValue="contracts" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="contracts">Contracts</TabsTrigger>
                        <TabsTrigger value="processing">Processing</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="contracts" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Monitored Contracts</h3>
                            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Contract
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Energy Contract</DialogTitle>
                                        <DialogDescription>
                                            Add a new contract to monitor for energy analytics data
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="contract-id">Contract ID</Label>
                                            <Input
                                                id="contract-id"
                                                placeholder="SP...contract-name"
                                                value={newContractId}
                                                onChange={(e) => setNewContractId(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                                            Cancel
                                        </Button>
                                        <Button onClick={addContract} disabled={!newContractId.trim()}>
                                            Add Contract
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="space-y-4">
                            {loading ? (
                                <div className="space-y-3">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="border rounded-lg p-4 animate-pulse">
                                            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                                            <div className="h-3 bg-muted rounded w-1/2" />
                                        </div>
                                    ))}
                                </div>
                            ) : contracts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Database className="h-8 w-8 mx-auto mb-2" />
                                    <p>No contracts are being monitored</p>
                                </div>
                            ) : (
                                contracts.map((contract) => {
                                    const metadata = tokenMetadata.find((token: any) => 
                                        token.contractId === contract.id
                                    );
                                    
                                    return (
                                        <div key={contract.id} className="border rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {metadata?.image && (
                                                        <img 
                                                            src={metadata.image} 
                                                            alt={metadata.name || contract.name} 
                                                            className="w-8 h-8 rounded-full"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    )}
                                                    <div>
                                                        <h4 className="font-medium">
                                                            {metadata?.name || contract.name}
                                                        </h4>
                                                        <p className="text-sm text-muted-foreground font-mono">
                                                            {contract.address}
                                                        </p>
                                                        {metadata?.symbol && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {metadata.symbol}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={
                                                    contract.status === 'active' ? 'default' :
                                                    contract.status === 'paused' ? 'secondary' : 'destructive'
                                                }>
                                                    {contract.status}
                                                </Badge>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => removeContract(contract.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <p className="text-muted-foreground">Users</p>
                                                <p className="font-semibold">{contract.totalUsers.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Total Energy</p>
                                                <p className="font-semibold">
                                                    {formatEnergyCompact(contract.totalEnergy, metadata)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Data Points</p>
                                                <p className="font-semibold">{contract.dataSize.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Last Updated</p>
                                                <p className="font-semibold text-xs">
                                                    {contract.lastUpdated > 0 
                                                        ? new Date(contract.lastUpdated).toLocaleDateString()
                                                        : 'Never'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {contract.issues.length > 0 && (
                                            <Alert variant="destructive">
                                                <AlertTriangle className="h-4 w-4" />
                                                <AlertDescription>
                                                    <ul className="list-disc list-inside">
                                                        {contract.issues.map((issue, index) => (
                                                            <li key={index}>{issue}</li>
                                                        ))}
                                                    </ul>
                                                </AlertDescription>
                                            </Alert>
                                        )}
                                    </div>
                                    );
                                })
                            )}
                        </div>
                    </TabsContent>
                    
                    <TabsContent value="processing" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold">Data Processing</h3>
                            <Button 
                                onClick={triggerDataProcessing} 
                                disabled={processingStatus.isRunning}
                                size="sm"
                            >
                                {processingStatus.isRunning ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                )}
                                {processingStatus.isRunning ? 'Processing...' : 'Run Processing'}
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Status</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        {processingStatus.isRunning ? (
                                            <>
                                                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                                                <span className="font-medium">Running</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4 text-green-500" />
                                                <span className="font-medium">Idle</span>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                            
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Last Run</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="font-medium text-sm">
                                        {processingStatus.lastRun > 0 
                                            ? new Date(processingStatus.lastRun).toLocaleString()
                                            : 'Never'
                                        }
                                    </p>
                                </CardContent>
                            </Card>
                            
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Duration</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="font-medium">
                                        {processingStatus.duration > 0 
                                            ? `${Math.round(processingStatus.duration / 1000)}s`
                                            : 'N/A'
                                        }
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                        
                        {processingStatus.errors.length > 0 && (
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Processing Errors</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside mt-2">
                                        {processingStatus.errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}
                        
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Processing Configuration</CardTitle>
                                <CardDescription>
                                    Configure how energy data is processed and cached
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="batch-size">Batch Size</Label>
                                    <Input
                                        id="batch-size"
                                        type="number"
                                        placeholder="100"
                                        disabled
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Number of events to process per batch
                                    </p>
                                </div>
                                
                                <div>
                                    <Label htmlFor="cache-duration">Cache Duration (hours)</Label>
                                    <Input
                                        id="cache-duration"
                                        type="number"
                                        placeholder="24"
                                        disabled
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        How long to cache processed data
                                    </p>
                                </div>
                                
                                <Button disabled>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Update Configuration
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}