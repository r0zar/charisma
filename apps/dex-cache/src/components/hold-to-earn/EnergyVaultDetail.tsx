'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ExternalLink, Loader2, Shield, Zap, Clock, Users, Info, BarChartBig } from 'lucide-react';
import Link from 'next/link';
import { EnergyHarvester } from './EnergyHarvester';
import { EnergyAnalytics } from './EnergyAnalytics';

// Re-using the Vault interface or a shared one
interface Vault {
    contractId: string;
    type: string;
    name: string;
    symbol: string;
    description: string;
    image: string;
    fee: number;
    externalPoolId?: string;
    engineContractId?: string;
    reservesA?: number; // May not be relevant for ENERGY type
    reservesB?: number; // May not be relevant for ENERGY type
    // Add any other fields specific to an ENERGY vault's detail view
    additionalData?: Record<string, any>; // For any extra details
}

// Updated function to fetch a single vault's details from the API
async function fetchVaultDetails(contractId: string): Promise<Vault | null> {
    console.log(`Fetching details for energy vault from API: ${contractId}`);
    try {
        const response = await fetch(`/api/v1/vaults?contractId=${contractId}`);

        const responseData = await response.json();

        if (response.ok && responseData.status === 'success' && responseData.data) {
            // Ensure essential fields are present. The API should ideally guarantee this for a single valid vault.
            const vault: Vault = responseData.data;
            if (typeof vault.contractId === 'string' && typeof vault.name === 'string') {
                console.log('Fetched vault details:', vault);
                return vault;
            } else {
                console.error('Fetched vault data is missing essential fields:', vault);
                throw new Error('Invalid vault data format from API.');
            }
        } else if (response.status === 404 || (responseData.status === 'error' && responseData.message?.includes('not found'))) {
            console.warn(`Vault with contractId ${contractId} not found via API.`);
            return null; // Explicitly return null if not found
        } else {
            // Handle other non-successful statuses or unexpected JSON structure
            const errorMsg = responseData.message || responseData.error || `API request failed with status ${response.status}`;
            console.error('Failed to fetch vault details:', errorMsg, 'Response Data:', responseData);
            throw new Error(`Failed to fetch vault details: ${errorMsg}`);
        }
    } catch (error) {
        console.error(`Error in fetchVaultDetails for ${contractId}:`, error);
        // Re-throw or handle as appropriate for the calling component
        // The component's useEffect already catches and sets an error message.
        throw error;
    }
}

interface EnergyVaultDetailProps {
    contractId: string;
}

export default function EnergyVaultDetail({ contractId }: EnergyVaultDetailProps) {
    const [vault, setVault] = useState<Vault | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'harvest' | 'analytics'>('overview');

    useEffect(() => {
        if (!contractId) return;

        async function loadVaultDetails() {
            try {
                setIsLoading(true);
                const fetchedVault = await fetchVaultDetails(contractId);
                if (fetchedVault) {
                    setVault(fetchedVault);
                } else {
                    setError('Energy vault not found.');
                }
            } catch (err) {
                setError('Failed to load energy vault details.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        }
        loadVaultDetails();
    }, [contractId]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading vault details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <Link href="/energy" passHref>
                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Energy Vaults</Button>
                </Link>
            </div>
        );
    }

    if (!vault) {
        return (
            <div className="text-center">
                <p className="text-muted-foreground mb-4">Vault data is not available.</p>
                <Link href="/energy" passHref>
                    <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Energy Vaults</Button>
                </Link>
            </div>
        );
    }

    // Calculate fee percentage if available
    const feePercent = vault.fee ? (vault.fee / 10000).toFixed(2) : 0;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <Link href="/energy" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Energy Vaults
                </Link>
                <Badge variant="outline" className="font-mono">{vault.type || 'ENERGY'}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left column - Vault Info */}
                <div className="md:col-span-5">
                    <Card className="h-fit overflow-hidden border border-primary/20 shadow-md bg-gradient-to-br from-card to-muted/20 backdrop-blur-sm">
                        <CardHeader>
                            <div className="flex justify-center mb-4">
                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-primary/10">
                                    <img
                                        src={vault.image || 'https://placehold.co/200x200?text=Energy'}
                                        alt={vault.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.src = 'https://placehold.co/200x200?text=Energy'
                                        }}
                                    />
                                </div>
                            </div>
                            <CardTitle className="text-2xl font-bold text-center text-primary">{vault.name}</CardTitle>
                            {vault.symbol && <div className="text-center"><Badge className="mt-1">{vault.symbol}</Badge></div>}
                        </CardHeader>

                        <CardContent>
                            <div className="space-y-6">
                                <CardDescription className="text-sm whitespace-pre-line">
                                    {vault.description || "This energy vault rewards token holders based on how long they hold tokens in their wallet."}
                                </CardDescription>

                                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <Shield className="w-4 h-4 text-primary mr-2" />
                                            <span className="text-sm">Reward Rate</span>
                                        </div>
                                        <Badge className="bg-primary/10 text-primary border-primary/30">
                                            {feePercent}%
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <Clock className="w-4 h-4 text-primary mr-2" />
                                            <span className="text-sm">Mechanism</span>
                                        </div>
                                        <Badge variant="outline">Hold-to-Earn</Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <Users className="w-4 h-4 text-primary mr-2" />
                                            <span className="text-sm">Protocol</span>
                                        </div>
                                        <Badge variant="secondary">{vault.additionalData?.protocol || 'CHARISMA'}</Badge>
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        {/* Contract Info */}
                        <div className="px-6 pb-6 space-y-3">
                            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Contract Details</div>
                            <div className="space-y-2">
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1">Contract ID</div>
                                    <div className="font-mono text-xs bg-muted/50 p-2 rounded break-all">
                                        {vault.contractId}
                                    </div>
                                </div>
                                {vault.engineContractId && (
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1">Engine Contract</div>
                                        <div className="font-mono text-xs bg-muted/50 p-2 rounded break-all">
                                            {vault.engineContractId}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {vault.externalPoolId && (
                            <CardFooter className="border-t pt-6 justify-center">
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`https://explorer.hiro.so/txid/${vault.externalPoolId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
                                        View on Explorer <ExternalLink className="ml-2 h-4 w-4" />
                                    </a>
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                </div>

                {/* Right column - Energy Harvester */}
                <div className="md:col-span-7">
                    <div className="flex space-x-1 mb-4 border-b border-muted">
                        <button
                            className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            Overview
                        </button>
                        <button
                            className={`px-3 py-2 text-sm font-medium flex items-center transition-colors whitespace-nowrap ${activeTab === 'harvest' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('harvest')}
                        >
                            <Zap className="h-3.5 w-3.5 mr-1.5" />
                            Harvest Energy
                        </button>
                        <button
                            disabled={true}
                            className={`cursor-not-allowed px-3 py-2 text-sm font-medium flex items-center transition-colors whitespace-nowrap ${activeTab === 'analytics' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('analytics')}
                        >
                            <BarChartBig className="h-3.5 w-3.5 mr-1.5" />
                            Analytics
                        </button>
                    </div>

                    {activeTab === 'overview' && vault && (
                        <Card className="border border-border/50">
                            <CardHeader>
                                <CardTitle className="flex items-center text-xl">
                                    <Info className="w-5 h-5 mr-2 text-primary" />
                                    Vault Overview
                                </CardTitle>
                                <CardDescription>
                                    Key details and information about this energy vault.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-muted/30 rounded-lg">
                                    <h3 className="font-semibold text-lg mb-2">What is Energy?</h3>
                                    <p className="text-muted-foreground">
                                        Energy is a reward token that accumulates based on how long you hold tokens in your wallet.
                                        The longer you hold, the more energy you earn. Energy can be used for various benefits in
                                        the ecosystem, such as redeeming for token rewards, minting exclusive NFTs, and more.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-base">How It Works</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                            <div className="flex justify-center mb-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <span className="font-bold">1</span>
                                                </div>
                                            </div>
                                            <h4 className="text-center font-medium mb-1">Hold Tokens</h4>
                                            <p className="text-xs text-center text-muted-foreground">
                                                Keep tokens in your wallet to start accruing energy
                                            </p>
                                        </div>
                                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                            <div className="flex justify-center mb-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <span className="font-bold">2</span>
                                                </div>
                                            </div>
                                            <h4 className="text-center font-medium mb-1">Accumulate</h4>
                                            <p className="text-xs text-center text-muted-foreground">
                                                Energy accumulates based on time and token balance
                                            </p>
                                        </div>
                                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                            <div className="flex justify-center mb-2">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <span className="font-bold">3</span>
                                                </div>
                                            </div>
                                            <h4 className="text-center font-medium mb-1">Harvest</h4>
                                            <p className="text-xs text-center text-muted-foreground">
                                                Claim your energy rewards when ready
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                                    <h3 className="font-semibold mb-2">Benefits of Energy</h3>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-start">
                                            <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs mr-2 mt-0.5">✓</span>
                                            <span>Redeem energy for liquid token payouts</span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs mr-2 mt-0.5">✓</span>
                                            <span>Spend energy to mint exclusive NFTs and assets</span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-xs mr-2 mt-0.5">✓</span>
                                            <span>Access to exclusive protocol features and rewards</span>
                                        </li>
                                    </ul>
                                </div>

                                <Alert variant="default" className="bg-primary/5 border-primary/20">
                                    <Zap className="h-4 w-4 text-primary" />
                                    <AlertTitle className="text-primary">Hold-to-Earn Mechanism</AlertTitle>
                                    <AlertDescription>
                                        This vault rewards you based on the duration you hold associated tokens.
                                        The longer you hold, the more energy you accumulate, which can be harvested for rewards.
                                    </AlertDescription>
                                </Alert>

                                {vault.additionalData?.infoLink && (
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={vault.additionalData.infoLink} target="_blank" rel="noopener noreferrer">
                                            Learn More <ExternalLink className="ml-2 h-3.5 w-3.5" />
                                        </a>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'analytics' && vault && (
                        <EnergyAnalytics vaultContractId={vault.contractId} />
                    )}

                    {activeTab === 'harvest' && vault && (
                        <EnergyHarvester vault={vault} />
                    )}
                </div>
            </div>
        </div>
    );
}