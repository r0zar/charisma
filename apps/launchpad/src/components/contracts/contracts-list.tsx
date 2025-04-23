"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Code, Layers } from 'lucide-react';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";

// Define the contract types
export type ContractType = 'sip10' | 'liquidity-pool' | 'custom' | 'audit';

// Contract data interface
export interface Contract {
    id: string;
    name: string;
    type: ContractType;
    deployedAt: string; // ISO date string
    contractAddress: string;
    description?: string;
    status: 'deploying' | 'deployed' | 'failed';
}

interface ContractsListProps {
    limit?: number;
}

export function ContractsList({ limit }: ContractsListProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { stxAddress, authenticated } = useApp();
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [firstLoad, setFirstLoad] = useState(true);

    // This is the actual contract fetching logic
    async function fetchContracts() {
        if (!stxAddress) {
            return [];
        }

        // Call our new API endpoint
        const response = await fetch(`/api/v1/contracts/list?address=${stxAddress}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to fetch contracts: ${errorData}`);
        }

        const data = await response.json();
        return data.contracts || [];
    }

    useEffect(() => {
        async function loadContracts() {
            if (authenticated && stxAddress) {
                try {
                    const data = await fetchContracts();
                    setContracts(data);
                } catch (error) {
                    console.error('Failed to fetch contracts:', error);
                    toast({
                        variant: "destructive",
                        title: "Error loading contracts",
                        description: "Failed to fetch your contracts. Please try again later.",
                    });
                } finally {
                    setLoading(false);
                    setFirstLoad(false);
                }
            } else {
                setFirstLoad(false);
                setLoading(false);
            }
        }
        loadContracts();
    }, [authenticated, stxAddress, toast]);

    // Ensure contracts is an array before using slice or map
    const displayedContracts = contracts && Array.isArray(contracts)
        ? (limit ? contracts.slice(0, limit) : contracts)
        : [];

    // Show loading state on first load
    if (firstLoad && loading) {
        return (
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
                <span className="text-muted-foreground text-lg">Loading contracts...</span>
            </div>
        );
    }

    // Show empty state when no contracts and not loading
    if ((!displayedContracts || displayedContracts.length === 0) && !loading) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4">
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
                <h3 className="text-xl font-medium mb-2">No contracts found</h3>
                <p className="text-muted-foreground max-w-md mb-8">
                    {authenticated
                        ? "You haven't deployed any contracts yet. Deploy your first contract to get started."
                        : "Connect your wallet to view and manage your smart contracts."}
                </p>
                {authenticated && (
                    <Button onClick={() => router.push('/templates')}>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="mr-2 h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Deploy New Contract
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">My Contracts</h1>
                {authenticated && (
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setLoading(true);
                                fetchContracts()
                                    .then(data => setContracts(data))
                                    .catch(err => {
                                        console.error('Error refreshing contracts:', err);
                                        toast({
                                            variant: "destructive",
                                            title: "Error refreshing contracts",
                                            description: "Failed to refresh your contracts. Please try again later.",
                                        });
                                    })
                                    .finally(() => setLoading(false));
                            }}
                            disabled={loading}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                            </svg>
                            Refresh
                        </Button>
                        <Button onClick={() => router.push('/templates')}>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="mr-2 h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Deploy New Contract
                        </Button>
                    </div>
                )}
            </div>

            {loading && !firstLoad && (
                <div className="flex items-center justify-center w-full py-4">
                    <svg
                        className="w-6 h-6 text-primary animate-spin mr-2"
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
                    <span className="text-muted-foreground">Refreshing contracts...</span>
                </div>
            )}

            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ staggerChildren: 0.1 }}
            >
                {displayedContracts.map((contract, index) => (
                    <ContractCard key={contract.id || `contract-${index}`} contract={contract} index={index} />
                ))}
            </motion.div>
        </div>
    );
}

interface ContractCardProps {
    contract: Contract;
    index: number;
}

function ContractCard({ contract, index }: ContractCardProps) {
    const router = useRouter();

    const handleNavigate = () => {
        if (contract.id) {
            router.push(`/contracts/${encodeURIComponent(contract.id)}`);
        }
    };

    const getStatusColor = (status: Contract['status']) => {
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

    const getIcon = (type: ContractType) => {
        switch (type) {
            case 'sip10':
                return <Code className="h-6 w-6 text-primary" />;
            case 'liquidity-pool':
                return <Layers className="h-6 w-6 text-primary" />;
            default:
                return <Code className="h-6 w-6 text-primary" />;
        }
    };

    const getTypeLabel = (type: ContractType) => {
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

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return 'Unknown date';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            <Card
                className="overflow-hidden hover:shadow-md transition-shadow duration-300 h-full flex flex-col"
                onClick={handleNavigate}
            >
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2">
                            <div className="p-2 rounded-full bg-primary/10">
                                {getIcon(contract.type)}
                            </div>
                            <div>
                                <CardTitle className="text-lg">{contract.name}</CardTitle>
                                <CardDescription className="text-xs">
                                    {getTypeLabel(contract.type)}
                                </CardDescription>
                            </div>
                        </div>
                        <Badge
                            variant="outline"
                            className="flex items-center space-x-1"
                        >
                            <span className={`h-2 w-2 rounded-full ${getStatusColor(contract.status)}`}></span>
                            <span className="capitalize text-xs">{contract.status}</span>
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pb-2 text-sm">
                    <div className="flex flex-col space-y-2">
                        <div className="text-muted-foreground truncate text-xs">
                            <span className="font-medium">Address:</span> {contract.contractAddress}
                        </div>
                        <div className="text-muted-foreground text-xs">
                            <span className="font-medium">Deployed:</span> {formatDate(contract.deployedAt)}
                        </div>
                        {contract.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                                {contract.description}
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="mt-auto pt-2">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleNavigate}>
                        View Details
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
} 