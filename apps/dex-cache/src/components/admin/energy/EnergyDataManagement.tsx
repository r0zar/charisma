'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Plus, Trash2, Play, Pause, RefreshCw, Settings, AlertTriangle, 
    CheckCircle, Database, Download, Search, FileText, Server 
} from 'lucide-react';
import { formatEnergyCompact } from '@/lib/format-energy';
import type { TokenCacheData } from '@repo/tokens';
import { EnergyConfigurationValidator } from './EnergyConfigurationValidator';
import { EnergyContractIntelligence } from './EnergyContractIntelligence';

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

interface DataExportOptions {
    contractId: string;
    format: 'json' | 'csv';
    dateRange: string;
    includeUserData: boolean;
}

export default function EnergyDataManagement() {
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
    const [newContractName, setNewContractName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [exportOptions, setExportOptions] = useState<DataExportOptions>({
        contractId: 'all',
        format: 'json',
        dateRange: '30d',
        includeUserData: false
    });

    useEffect(() => {
        fetchData();
        // Set up polling for processing status
        const interval = setInterval(fetchProcessingStatus, 10000); // Every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Simulate fetching contract data - replace with actual API calls
            const mockContracts: MonitoredContract[] = [
                {
                    id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
                    name: 'Charisma Token',
                    address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
                    status: 'active',
                    lastUpdated: Date.now() - 30 * 60 * 1000, // 30 minutes ago
                    totalUsers: 1247,
                    totalEnergy: 45230000,
                    dataSize: 2.4,
                    issues: []
                },
                {
                    id: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token',
                    name: 'Welsh Token',
                    address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token',
                    status: 'active',
                    lastUpdated: Date.now() - 45 * 60 * 1000, // 45 minutes ago
                    totalUsers: 856,
                    totalEnergy: 32150000,
                    dataSize: 1.8,
                    issues: ['Slow response times']
                }
            ];
            setContracts(mockContracts);
        } catch (error) {
            console.error('Failed to fetch contract data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProcessingStatus = async () => {
        try {
            // Simulate API call - replace with actual endpoint
            setProcessingStatus({
                isRunning: false,
                lastRun: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
                duration: 45000, // 45 seconds
                processedContracts: contracts.length,
                errors: []
            });
        } catch (error) {
            console.error('Failed to fetch processing status:', error);
        }
    };

    const handleAddContract = async () => {
        if (!newContractId || !newContractName) return;
        
        const newContract: MonitoredContract = {
            id: newContractId,
            name: newContractName,
            address: newContractId,
            status: 'active',
            lastUpdated: Date.now(),
            totalUsers: 0,
            totalEnergy: 0,
            dataSize: 0,
            issues: []
        };
        
        setContracts(prev => [...prev, newContract]);
        setShowAddDialog(false);
        setNewContractId('');
        setNewContractName('');
    };

    const handleRemoveContract = (contractId: string) => {
        setContracts(prev => prev.filter(c => c.id !== contractId));
    };

    const handleToggleContract = (contractId: string) => {
        setContracts(prev => prev.map(contract => 
            contract.id === contractId 
                ? { ...contract, status: contract.status === 'active' ? 'paused' : 'active' }
                : contract
        ));
    };

    const handleStartProcessing = async () => {
        setProcessingStatus(prev => ({ ...prev, isRunning: true }));
        // Simulate processing - replace with actual API call
        setTimeout(() => {
            setProcessingStatus(prev => ({ 
                ...prev, 
                isRunning: false,
                lastRun: Date.now(),
                duration: 30000 // 30 seconds
            }));
        }, 5000);
    };

    const handleExportData = async () => {
        try {
            // Simulate data export - replace with actual API call
            const exportData = {
                contracts: exportOptions.contractId === 'all' ? contracts : contracts.filter(c => c.id === exportOptions.contractId),
                timestamp: new Date().toISOString(),
                format: exportOptions.format,
                dateRange: exportOptions.dateRange,
                includeUserData: exportOptions.includeUserData
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `energy-data-${exportOptions.dateRange}.${exportOptions.format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        }
    };

    const filteredContracts = contracts.filter(contract =>
        contract.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Data & Contract Management
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center h-64">
                        <RefreshCw className="h-6 w-6 animate-spin" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Tabs defaultValue="validation" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="validation">Config Validation</TabsTrigger>
                    <TabsTrigger value="intelligence">Contract Intelligence</TabsTrigger>
                    <TabsTrigger value="contracts">Contract Management</TabsTrigger>
                    <TabsTrigger value="processing">Data Processing</TabsTrigger>
                    <TabsTrigger value="export">Data Export</TabsTrigger>
                </TabsList>
                
                <TabsContent value="validation" className="space-y-6">
                    {/* Configuration Validation - Real-time config vs contract validation */}
                    <EnergyConfigurationValidator />
                </TabsContent>
                
                <TabsContent value="intelligence" className="space-y-6">
                    {/* Contract Intelligence - AI-powered analysis of contract relationships */}
                    <EnergyContractIntelligence />
                </TabsContent>
                
                <TabsContent value="contracts" className="space-y-6">
                    {/* Contract Management */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="h-5 w-5" />
                                        Monitored Contracts
                                    </CardTitle>
                                    <CardDescription>
                                        Manage energy contracts being monitored for analytics
                                    </CardDescription>
                                </div>
                                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                                    <DialogTrigger asChild>
                                        <Button>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Contract
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add New Contract</DialogTitle>
                                            <DialogDescription>
                                                Add a new energy contract to monitor
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="contract-id">Contract ID</Label>
                                                <Input
                                                    id="contract-id"
                                                    value={newContractId}
                                                    onChange={(e) => setNewContractId(e.target.value)}
                                                    placeholder="SP...contract-name"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="contract-name">Display Name</Label>
                                                <Input
                                                    id="contract-name"
                                                    value={newContractName}
                                                    onChange={(e) => setNewContractName(e.target.value)}
                                                    placeholder="Token Name"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                                                Cancel
                                            </Button>
                                            <Button onClick={handleAddContract}>
                                                Add Contract
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Search */}
                            <div className="flex items-center gap-2 mb-4">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search contracts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="max-w-sm"
                                />
                            </div>

                            {/* Contracts List */}
                            <div className="space-y-3">
                                {filteredContracts.map((contract) => (
                                    <div key={contract.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${
                                                contract.status === 'active' ? 'bg-green-500' :
                                                contract.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
                                            }`} />
                                            <div>
                                                <h4 className="font-medium">{contract.name}</h4>
                                                <p className="text-sm text-muted-foreground">{contract.id}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {contract.totalUsers} users
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {formatEnergyCompact(contract.totalEnergy)} energy
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {contract.dataSize} MB
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {contract.issues.length > 0 && (
                                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleToggleContract(contract.id)}
                                            >
                                                {contract.status === 'active' ? (
                                                    <Pause className="h-4 w-4" />
                                                ) : (
                                                    <Play className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveContract(contract.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="processing" className="space-y-6">
                    {/* Data Processing */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="h-5 w-5" />
                                Data Processing Status
                            </CardTitle>
                            <CardDescription>
                                Monitor and control energy data processing jobs
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Processing Status */}
                                <div className="flex items-center justify-between p-4 border rounded-lg">
                                    <div className="flex items-center gap-3">
                                        {processingStatus.isRunning ? (
                                            <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                                        ) : (
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                        )}
                                        <div>
                                            <h4 className="font-medium">
                                                {processingStatus.isRunning ? 'Processing...' : 'Processing Complete'}
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                Last run: {new Date(processingStatus.lastRun).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Badge variant={processingStatus.isRunning ? "default" : "secondary"}>
                                            {processingStatus.isRunning ? 'Running' : 'Idle'}
                                        </Badge>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Duration: {Math.round(processingStatus.duration / 1000)}s
                                        </p>
                                    </div>
                                </div>

                                {/* Processing Controls */}
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={handleStartProcessing} 
                                        disabled={processingStatus.isRunning}
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Start Processing
                                    </Button>
                                    <Button variant="outline" onClick={fetchProcessingStatus}>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Refresh Status
                                    </Button>
                                </div>

                                {/* Processing Errors */}
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
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="export" className="space-y-6">
                    {/* Data Export */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Download className="h-5 w-5" />
                                Data Export
                            </CardTitle>
                            <CardDescription>
                                Export energy analytics data for external analysis
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="export-contract">Contract</Label>
                                        <select
                                            id="export-contract"
                                            value={exportOptions.contractId}
                                            onChange={(e) => setExportOptions(prev => ({ ...prev, contractId: e.target.value }))}
                                            className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                                        >
                                            <option value="all">All Contracts</option>
                                            {contracts.map((contract) => (
                                                <option key={contract.id} value={contract.id}>
                                                    {contract.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="export-format">Format</Label>
                                        <select
                                            id="export-format"
                                            value={exportOptions.format}
                                            onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'json' | 'csv' }))}
                                            className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                                        >
                                            <option value="json">JSON</option>
                                            <option value="csv">CSV</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="export-range">Date Range</Label>
                                        <select
                                            id="export-range"
                                            value={exportOptions.dateRange}
                                            onChange={(e) => setExportOptions(prev => ({ ...prev, dateRange: e.target.value }))}
                                            className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                                        >
                                            <option value="7d">Last 7 days</option>
                                            <option value="30d">Last 30 days</option>
                                            <option value="90d">Last 90 days</option>
                                        </select>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2 mt-6">
                                        <input
                                            id="include-users"
                                            type="checkbox"
                                            checked={exportOptions.includeUserData}
                                            onChange={(e) => setExportOptions(prev => ({ ...prev, includeUserData: e.target.checked }))}
                                        />
                                        <Label htmlFor="include-users">Include user data</Label>
                                    </div>
                                </div>
                                
                                <Button onClick={handleExportData} className="w-full">
                                    <FileText className="h-4 w-4 mr-2" />
                                    Export Data
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}