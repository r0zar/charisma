"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/context/app-context';
import { Contract, ContractType } from '@/components/contracts/contracts-list';
import { Loader2, Info, Code, FileText, Box, Settings, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Define the structure for contract interface components
interface ContractFunction {
    name: string;
    access: 'public' | 'private' | 'read_only';
    args: Array<{
        name: string;
        type: string | any;
    }> | [];
    outputs: {
        type: string | any;
    } | null;
}

interface ContractVariable {
    name: string;
    type: any;
    access: 'constant' | 'variable';
}

interface ContractMap {
    name: string;
    key_type: string | any;
    value_type: string | any;
}

interface TokenDetails {
    name: string;
}

interface ContractInterface {
    functions: ContractFunction[];
    variables: ContractVariable[];
    maps: ContractMap[];
    fungible_tokens: TokenDetails[];
    non_fungible_tokens: TokenDetails[];
}

// Add a helper function to safely render type information
const renderType = (type: any): string => {
    if (!type) return 'unknown';
    if (typeof type === 'string') return type;
    try {
        if (typeof type === 'object') {
            return JSON.stringify(type, null, 0)
                .replace(/[{}"]/g, '') // Remove braces and quotes
                .replace(/,/g, ', '); // Add spaces after commas
        }
        return String(type);
    } catch (e) {
        return 'complex type';
    }
};

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
    // Use React.use to unwrap params
    const { id } = React.use(params);

    const router = useRouter();
    const { toast } = useToast();
    const { authenticated } = useApp();
    const [loading, setLoading] = useState(true);
    const [contract, setContract] = useState<Contract | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { stxAddress } = useApp();

    // State for contract interface data
    const [contractInterface, setContractInterface] = useState<ContractInterface | null>(null);
    const [loadingInterface, setLoadingInterface] = useState(false);
    const [interfaceError, setInterfaceError] = useState<string | null>(null);

    // State for active tab
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        async function loadContract() {
            try {
                setLoading(true);
                setError(null);

                if (!stxAddress) {
                    throw new Error('Wallet address not available');
                }

                // Call our API endpoint to fetch the contract details
                const response = await fetch(`/api/v1/contracts/${id}?address=${stxAddress}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(errorData || 'Failed to fetch contract details');
                }

                const data = await response.json();
                setContract(data.contract);

                // After getting the contract, fetch its interface
                if (data.contract?.contractAddress) {
                    await fetchContractInterface(data.contract.contractAddress);
                }
            } catch (error) {
                console.error('Error loading contract:', error);
                setError(error instanceof Error ? error.message : 'Unknown error occurred');
                toast({
                    variant: "destructive",
                    title: "Error loading contract",
                    description: "Could not load the contract details. Please try again later.",
                });
            } finally {
                setLoading(false);
            }
        }

        if (authenticated) {
            loadContract();
        } else {
            setLoading(false);
        }
    }, [id, authenticated, toast, stxAddress]);

    // Function to fetch and parse contract interface directly from Hiro API
    const fetchContractInterface = async (contractAddress: string) => {
        if (!contractAddress) return;

        // Parse the contract address to get the actual contract name
        const [address, contractName] = contractAddress.split('.');
        if (!address || !contractName) {
            setInterfaceError('Invalid contract address format');
            return;
        }

        try {
            setLoadingInterface(true);
            setInterfaceError(null);

            console.log(`Fetching interface for ${address}.${contractName}`);
            // Use Hiro API directly to fetch contract interface
            const response = await fetch(`https://api.mainnet.hiro.so/v2/contracts/interface/${address}/${contractName}`);

            if (!response.ok) {
                throw new Error(`Failed to fetch contract interface: ${response.statusText}`);
            }

            const interfaceData = await response.json();
            console.log('Contract interface:', interfaceData);

            setContractInterface(interfaceData as ContractInterface);
        } catch (error) {
            console.error('Error fetching contract interface:', error);
            setInterfaceError(error instanceof Error ? error.message : 'Failed to fetch contract interface');
            toast({
                variant: "destructive",
                title: "Error loading contract interface",
                description: "Could not load the contract functions. Please try again later.",
            });
        } finally {
            setLoadingInterface(false);
        }
    };

    const getIcon = (type: ContractType | undefined) => {
        switch (type) {
            case 'sip10':
                return (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                );
            case 'liquidity-pool':
                return (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polygon points="16 3 21 8 8 21 3 21 3 16 16 3"></polygon>
                    </svg>
                );
            default:
                return (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                );
        }
    };

    const getTypeLabel = (type: ContractType | undefined) => {
        switch (type) {
            case 'sip10':
                return 'SIP-10 Token';
            case 'liquidity-pool':
                return 'Liquidity Pool';
            case 'audit':
                return 'Audit Result';
            default:
                return 'Custom Contract';
        }
    };

    const getStatusColor = (status: Contract['status'] | undefined) => {
        switch (status) {
            case 'deployed':
                return 'bg-green-500';
            case 'deploying':
                return 'bg-yellow-500';
            case 'failed':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return { date: 'Unknown date', time: 'Unknown time' };
        try {
            const date = new Date(dateString);
            return {
                date: date.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                time: date.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
        } catch (e) {
            return { date: 'Unknown date', time: 'Unknown time' };
        }
    };

    const handleCopyAddress = () => {
        if (contract?.contractAddress) {
            navigator.clipboard.writeText(contract.contractAddress);
            toast({
                title: "Address copied",
                description: "Contract address copied to clipboard.",
            });
        }
    };

    // Helper to get access badge color
    const getAccessBadgeColor = (access: string) => {
        switch (access) {
            case 'public':
                return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
            case 'private':
                return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
            case 'read_only':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    if (!authenticated) {
        return (
            <div className="container py-12">
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-8 h-8 text-primary/60"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium mb-2">Authentication Required</h3>
                    <p className="text-muted-foreground max-w-md mb-8">
                        Please connect your wallet to view this contract.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container py-12">
                <div className="flex items-center justify-center w-full py-12">
                    <svg
                        className="w-8 h-8 text-primary animate-spin mr-3"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    <span className="text-muted-foreground text-lg">Loading contract details...</span>
                </div>
            </div>
        );
    }

    if (!contract) {
        return (
            <div className="container py-12">
                <div className="flex flex-col items-center justify-center text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-8 h-8 text-primary/60"
                        >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-medium mb-2">Contract Not Found</h3>
                    <p className="text-muted-foreground max-w-md mb-8">
                        We couldn't find the contract you're looking for.
                    </p>
                    <Button variant="outline" onClick={() => router.push('/contracts')}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Back to Contracts
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-12">
            <Button variant="outline" className="mb-6" onClick={() => router.push('/contracts')}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back to Contracts
            </Button>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Content */}
                <div className="flex-1">
                    <div className="flex items-center mb-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mr-4">
                            {getIcon(contract.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-bold text-ellipsis overflow-hidden">{contract.name}</h1>
                                <Badge variant="outline" className="ml-1">
                                    {getTypeLabel(contract.type)}
                                </Badge>
                                <div className="flex items-center">
                                    <div className={`h-2 w-2 rounded-full mr-1 ${getStatusColor(contract.status)}`}></div>
                                    <span className="text-xs capitalize text-muted-foreground">{contract.status}</span>
                                </div>
                            </div>
                            <div className="flex items-center mt-1">
                                <p className="text-sm text-muted-foreground font-mono flex items-center truncate">
                                    {contract.contractAddress}
                                    <button
                                        onClick={handleCopyAddress}
                                        className="ml-2 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Copy contract address"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-3.5 w-3.5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="mt-8">
                        <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
                            <TabsList className="w-full justify-start mb-4">
                                <TabsTrigger value="overview" className="flex items-center gap-1">
                                    <Info className="h-4 w-4" />
                                    <span>Overview</span>
                                </TabsTrigger>
                                <TabsTrigger value="functions" className="flex items-center gap-1">
                                    <Code className="h-4 w-4" />
                                    <span>Functions</span>
                                </TabsTrigger>
                                <TabsTrigger value="data" className="flex items-center gap-1">
                                    <Database className="h-4 w-4" />
                                    <span>Data Storage</span>
                                </TabsTrigger>
                                <TabsTrigger value="details" className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    <span>Deployment</span>
                                </TabsTrigger>
                                <TabsTrigger value="actions" className="flex items-center gap-1">
                                    <Settings className="h-4 w-4" />
                                    <span>Actions</span>
                                </TabsTrigger>
                            </TabsList>

                            {/* Tab Content */}
                            <TabsContent value="overview" className="mt-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Contract Description</h2>
                                    <p className="text-muted-foreground mb-6">{contract.description || 'No description provided.'}</p>
                                </div>

                                <div className="mt-8">
                                    <h2 className="text-xl font-semibold mb-4">Quick Info</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Type</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center">
                                                    {getIcon(contract.type)}
                                                    <span className="ml-2">{getTypeLabel(contract.type)}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Owner</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <p className="font-mono truncate">
                                                    {contract.contractAddress?.split('.')?.[0] || 'Unknown'}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-base">Deployed On</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex items-center">
                                                    <span>{formatDate(contract.deployedAt).date}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>

                                {contract.type === 'sip10' && (
                                    <div className="mt-8">
                                        <h2 className="text-xl font-semibold mb-4">Token Information</h2>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <p className="text-muted-foreground mb-4">
                                                    This is a SIP-10 compliant fungible token contract. It provides standard token functionality like transfers, balances, and approvals.
                                                </p>
                                                <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push(`/contracts/${id}/manage`)}>
                                                    Manage Token
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {contract.type === 'liquidity-pool' && (
                                    <div className="mt-8">
                                        <h2 className="text-xl font-semibold mb-4">Pool Information</h2>
                                        <Card>
                                            <CardContent className="pt-6">
                                                <p className="text-muted-foreground mb-4">
                                                    This is a liquidity pool contract that enables trading between token pairs with automated market making functionality.
                                                </p>
                                                <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push(`/contracts/${id}/manage`)}>
                                                    Manage Pool
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="functions" className="mt-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Contract Functions</h2>

                                    {loadingInterface && (
                                        <div className="flex items-center p-4 border rounded-lg">
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin text-primary" />
                                            <span>Loading contract interface...</span>
                                        </div>
                                    )}

                                    {interfaceError && (
                                        <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
                                            <p className="text-red-700 dark:text-red-400">
                                                Error loading contract interface: {interfaceError}
                                            </p>
                                        </div>
                                    )}

                                    {contractInterface && !loadingInterface && !interfaceError && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Available Functions</CardTitle>
                                                <CardDescription>
                                                    Functions you can call on this smart contract
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                {contractInterface.functions && contractInterface.functions.length > 0 ? (
                                                    <Accordion type="single" collapsible className="w-full">
                                                        {contractInterface.functions.map((fn, index) => (
                                                            <AccordionItem key={index} value={`function-${index}`}>
                                                                <AccordionTrigger className="hover:no-underline">
                                                                    <div className="flex items-center">
                                                                        <span className="font-mono">{fn.name || 'unnamed'}</span>
                                                                        <Badge className={`ml-2 ${getAccessBadgeColor(fn.access || 'unknown')}`} variant="outline">
                                                                            {fn.access || 'unknown'}
                                                                        </Badge>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent>
                                                                    <div className="bg-muted/20 p-3 rounded-md">
                                                                        <div className="mb-2">
                                                                            <span className="text-sm font-semibold">Arguments:</span>
                                                                            {fn.args && Array.isArray(fn.args) && fn.args.length > 0 ? (
                                                                                <div className="mt-1 font-mono">
                                                                                    {fn.args.map((arg, argIdx) => (
                                                                                        <div key={argIdx} className="text-xs">
                                                                                            <span className="text-muted-foreground">{arg?.name || 'unnamed'}:</span> {renderType(arg?.type)}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <div className="text-xs text-muted-foreground mt-1">No arguments</div>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm font-semibold">Returns:</span>
                                                                            <div className="text-xs font-mono mt-1">
                                                                                {fn.outputs ? renderType(fn.outputs.type) : 'void'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        ))}
                                                    </Accordion>
                                                ) : (
                                                    <p className="text-muted-foreground">No functions found in this contract.</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="data" className="mt-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Data Storage</h2>

                                    {loadingInterface && (
                                        <div className="flex items-center p-4 border rounded-lg">
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin text-primary" />
                                            <span>Loading contract data structures...</span>
                                        </div>
                                    )}

                                    {interfaceError && (
                                        <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
                                            <p className="text-red-700 dark:text-red-400">
                                                Error loading contract interface: {interfaceError}
                                            </p>
                                        </div>
                                    )}

                                    {contractInterface && !loadingInterface && !interfaceError && (
                                        <div className="space-y-6">
                                            {/* Variables and Maps */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Variables */}
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle>Variables</CardTitle>
                                                        <CardDescription>
                                                            Defined variables in this contract
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {contractInterface.variables && contractInterface.variables.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {contractInterface.variables.map((variable, index) => (
                                                                    <div key={index} className="flex justify-between items-center p-2 border rounded-md text-sm">
                                                                        <span className="font-mono">{variable.name}</span>
                                                                        <Badge variant="outline">{renderType(variable.type)}</Badge>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-muted-foreground">No variables found in this contract.</p>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* Maps */}
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle>Maps</CardTitle>
                                                        <CardDescription>
                                                            Data maps defined in this contract
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        {contractInterface.maps && contractInterface.maps.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {contractInterface.maps.map((map, index) => (
                                                                    <div key={index} className="p-2 border rounded-md text-sm">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-mono">{map.name}</span>
                                                                        </div>
                                                                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                                                                            key: {renderType(map.key_type)}, value: {renderType(map.value_type)}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-muted-foreground">No maps found in this contract.</p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>

                                            {/* Tokens */}
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle>Tokens</CardTitle>
                                                    <CardDescription>
                                                        Tokens defined in this contract
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <h4 className="text-sm font-semibold mb-2">Fungible Tokens</h4>
                                                            {contractInterface.fungible_tokens && contractInterface.fungible_tokens.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {contractInterface.fungible_tokens.map((token, index) => (
                                                                        <div key={index} className="p-2 border rounded-md">
                                                                            <span className="font-mono text-sm">{token.name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-muted-foreground text-sm">No fungible tokens found.</p>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <h4 className="text-sm font-semibold mb-2">Non-Fungible Tokens</h4>
                                                            {contractInterface.non_fungible_tokens && contractInterface.non_fungible_tokens.length > 0 ? (
                                                                <div className="space-y-2">
                                                                    {contractInterface.non_fungible_tokens.map((token, index) => (
                                                                        <div key={index} className="p-2 border rounded-md">
                                                                            <span className="font-mono text-sm">{token.name}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-muted-foreground text-sm">No non-fungible tokens found.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="details" className="mt-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Deployment Details</h2>
                                    <div className="border rounded-lg p-4 bg-muted/5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Deployed On</p>
                                                <div className="flex items-center">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-4 w-4 mr-2 text-muted-foreground"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                                    </svg>
                                                    <span>{formatDate(contract.deployedAt).date} at {formatDate(contract.deployedAt).time}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Status</p>
                                                <p className="flex items-center">
                                                    <span className={`inline-block h-2 w-2 rounded-full mr-2 ${getStatusColor(contract.status)}`}></span>
                                                    <span className="capitalize">{contract.status}</span>
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Contract Type</p>
                                                <div className="flex items-center">
                                                    {getIcon(contract.type)}
                                                    <span className="ml-2">{getTypeLabel(contract.type)}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Network</p>
                                                <p>Stacks Mainnet</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Transaction ID</p>
                                                <p className="text-sm font-mono truncate">
                                                    {contract.id}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Contract Owner</p>
                                                <p className="text-sm font-mono truncate">
                                                    {contract.contractAddress?.split('.')?.[0] || 'Unknown'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="actions" className="mt-6">
                                <div>
                                    <h2 className="text-xl font-semibold mb-4">Contract Actions</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Button
                                            variant="outline"
                                            className="flex items-center gap-2"
                                            onClick={() => window.open(`https://explorer.stacks.co/txid/${contract.id}?chain=mainnet`, '_blank')}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4 mr-2"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                <polyline points="15 3 21 3 21 9"></polyline>
                                                <line x1="10" y1="14" x2="21" y2="3"></line>
                                            </svg>
                                            View Transaction on Explorer
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex items-center gap-2"
                                            onClick={() => window.open(`https://explorer.stacks.co/contract/${contract.contractAddress}?chain=mainnet`, '_blank')}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4 mr-2"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                                <polyline points="15 3 21 3 21 9"></polyline>
                                                <line x1="10" y1="14" x2="21" y2="3"></line>
                                            </svg>
                                            View Contract on Explorer
                                        </Button>
                                        {contract.type === 'sip10' && (
                                            <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push(`/contracts/${id}/manage`)}>
                                                Manage Token
                                            </Button>
                                        )}
                                        {contract.type === 'liquidity-pool' && (
                                            <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push(`/contracts/${id}/manage`)}>
                                                Manage Pool
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:w-80 mt-8 lg:mt-0">
                    <div className="border rounded-lg p-6 bg-muted/5">
                        <h3 className="text-lg font-semibold mb-4">Add Metadata</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enhance your contract with metadata such as images, descriptions, and additional information.
                        </p>
                        <Button className="w-full mb-4" onClick={() => window.open('https://metadata.charisma.rocks', '_blank')}>
                            Add Metadata via Charisma
                        </Button>

                        <h3 className="text-lg font-semibold mt-6 mb-4">Contract Resources</h3>
                        <ul className="space-y-2">
                            <li>
                                <a
                                    href={`https://launchpad.charisma.rocks/docs`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm flex items-center text-primary hover:underline"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3.5 w-3.5 mr-2"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    Documentation
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://discord.gg/gbdt4YaPwd"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm flex items-center text-primary hover:underline"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3.5 w-3.5 mr-2"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                    Community Support
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
} 