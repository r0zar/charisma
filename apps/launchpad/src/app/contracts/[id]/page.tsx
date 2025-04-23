"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/context/app-context';
import { Contract, ContractType } from '@/components/contracts/contracts-list';

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

                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4">Contract Description</h2>
                        <p className="text-muted-foreground mb-6">{contract.description || 'No description provided.'}</p>
                    </div>

                    <div className="mt-8">
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

                    <div className="mt-8">
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
                </div>

                {/* Sidebar */}
                <div className="lg:w-80 mt-8 lg:mt-0">
                    <div className="border rounded-lg p-6 bg-muted/5">
                        <h3 className="text-lg font-semibold mb-4">Add Metadata</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Enhance your contract with metadata such as images, descriptions, and additional information.
                        </p>
                        <Button className="w-full mb-4" onClick={() => window.open('https://metadata.charisma.app', '_blank')}>
                            Add Metadata via Charisma
                        </Button>

                        <h3 className="text-lg font-semibold mt-6 mb-4">Contract Resources</h3>
                        <ul className="space-y-2">
                            <li>
                                <a
                                    href={`https://docs.charisma.app/contracts/${contract.type === 'sip10' ? 'sip10' : 'liquidity-pool'}`}
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
                                    href="https://discord.gg/charisma"
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