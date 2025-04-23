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

    // This is a placeholder for the actual contract fetching logic
    // In a real implementation, this would come from the app context
    async function fetchContracts() {
        // Mocked data for now - this would be replaced with an actual API call
        // In the future, we would use the app context for this
        const mockContracts: Contract[] = [
            {
                id: '1',
                name: 'My Test Token',
                type: 'sip10',
                deployedAt: new Date().toISOString(),
                contractAddress: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.my-token',
                description: 'A test SIP-10 token with basic functionality',
                status: 'deployed'
            },
            {
                id: '2',
                name: 'BTC/STX Pool',
                type: 'liquidity-pool',
                deployedAt: new Date().toISOString(),
                contractAddress: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.btc-stx-pool',
                description: 'A liquidity pool for BTC and STX',
                status: 'deployed'
            }
        ];

        return mockContracts;
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
        >
            <Card className="h-full overflow-hidden hover:shadow-md transition-shadow duration-200">
                <div
                    className="h-24 relative bg-muted flex items-center justify-center cursor-pointer p-4"
                    onClick={handleNavigate}
                >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        {getIcon(contract.type)}
                    </div>

                    <div className="absolute top-2 right-2">
                        <div className="flex items-center">
                            <div className={`h-2 w-2 rounded-full mr-1 ${getStatusColor(contract.status)}`}></div>
                            <span className="text-xs capitalize text-muted-foreground">{contract.status}</span>
                        </div>
                    </div>
                </div>
                <CardContent className="pt-6 flex-grow">
                    <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-medium text-lg truncate">{contract.name || 'Unnamed Contract'}</h3>
                        <Badge variant="outline" className="ml-auto">
                            {contract.type === 'sip10' ? 'SIP-10' : 'LP'}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm truncate font-mono mb-3">{contract.contractAddress}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                        {contract.description || 'No description provided'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        Deployed: {new Date(contract.deployedAt).toLocaleDateString()}
                    </p>
                </CardContent>
                <CardFooter className="pt-2 pb-4">
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={handleNavigate}
                    >
                        View Details
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
} 