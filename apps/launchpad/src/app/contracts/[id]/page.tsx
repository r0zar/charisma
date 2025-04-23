"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Code, Layers, ExternalLink, Calendar, ArrowLeft, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/lib/context/app-context';
import { Contract, ContractType } from '@/components/contracts/contracts-list';

export default function ContractDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { toast } = useToast();
    const { authenticated } = useApp();
    const [loading, setLoading] = useState(true);
    const [contract, setContract] = useState<Contract | null>(null);

    useEffect(() => {
        async function loadContract() {
            try {
                setLoading(true);

                // Mocked contract data - would be replaced with an API call
                const mockContract: Contract = {
                    id: params.id,
                    name: params.id === '1' ? 'My Test Token' : 'BTC/STX Pool',
                    type: params.id === '1' ? 'sip10' : 'liquidity-pool',
                    deployedAt: new Date().toISOString(),
                    contractAddress: params.id === '1'
                        ? 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.my-token'
                        : 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.btc-stx-pool',
                    description: params.id === '1'
                        ? 'A test SIP-10 token with basic functionality'
                        : 'A liquidity pool for BTC and STX',
                    status: 'deployed'
                };

                setContract(mockContract);
            } catch (error) {
                console.error('Error loading contract:', error);
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
    }, [params.id, authenticated, toast]);

    const getIcon = (type: ContractType | undefined) => {
        switch (type) {
            case 'sip10':
                return <Code className="h-6 w-6 text-primary" />;
            case 'liquidity-pool':
                return <Layers className="h-6 w-6 text-primary" />;
            default:
                return <Code className="h-6 w-6 text-primary" />;
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
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contracts
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-12">
            <Button variant="outline" className="mb-6" onClick={() => router.push('/contracts')}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contracts
            </Button>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Content */}
                <div className="flex-1">
                    <div className="flex items-center mb-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mr-4">
                            {getIcon(contract.type)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold">{contract.name}</h1>
                                <Badge variant="outline" className="ml-1">
                                    {contract.type === 'sip10' ? 'SIP-10' : 'LP'}
                                </Badge>
                                <div className="flex items-center">
                                    <div className={`h-2 w-2 rounded-full mr-1 ${getStatusColor(contract.status)}`}></div>
                                    <span className="text-xs capitalize text-muted-foreground">{contract.status}</span>
                                </div>
                            </div>
                            <div className="flex items-center mt-1">
                                <p className="text-sm text-muted-foreground font-mono flex items-center">
                                    {contract.contractAddress}
                                    <button
                                        onClick={handleCopyAddress}
                                        className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <Copy className="h-3.5 w-3.5" />
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-muted-foreground">Deployed On</p>
                                    <p className="flex items-center">
                                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                                        {new Date(contract.deployedAt).toLocaleDateString()} at {new Date(contract.deployedAt).toLocaleTimeString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <p className="flex items-center">
                                        <div className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(contract.status)}`}></div>
                                        <span className="capitalize">{contract.status}</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Contract Type</p>
                                    <p className="flex items-center">
                                        {getIcon(contract.type)}
                                        <span className="ml-2">{contract.type === 'sip10' ? 'SIP-10 Fungible Token' : 'Liquidity Pool'}</span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Network</p>
                                    <p>Stacks Mainnet</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4">Contract Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Button variant="outline" className="flex items-center gap-2" onClick={() => window.open(`https://explorer.stacks.co/txid/${contract.contractAddress}`, '_blank')}>
                                <ExternalLink className="h-4 w-4" /> View on Explorer
                            </Button>
                            {contract.type === 'sip10' && (
                                <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push(`/contracts/${contract.id}/manage`)}>
                                    Manage Token
                                </Button>
                            )}
                            {contract.type === 'liquidity-pool' && (
                                <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push(`/contracts/${contract.id}/manage`)}>
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
                                    <ExternalLink className="h-3.5 w-3.5 mr-2" /> Documentation
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://discord.gg/charisma"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm flex items-center text-primary hover:underline"
                                >
                                    <ExternalLink className="h-3.5 w-3.5 mr-2" /> Community Support
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
} 