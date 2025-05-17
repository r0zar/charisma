'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, ExternalLink, Loader2, Shield, Zap, Clock, Users, Info, BarChartBig, Coins } from 'lucide-react';
import Link from 'next/link';
import { EnergyHarvester } from './EnergyHarvester';
import { EnergyAnalytics } from './EnergyAnalytics';
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';

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
    tokenForRewards?: TokenCacheData; // Token required for earning rewards
}

// Fetch energy vault details from API
async function fetchVaultDetails(contractId: string): Promise<Vault | null> {
    try {
        const response = await fetch(`/api/v1/vaults/${contractId}`);
        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();
        if (data.status !== 'success' || !data.data) {
            throw new Error(`API returned error: ${data.message || 'Unknown error'}`);
        }

        // Fetch token metadata for rewards if this is the expected vault
        const vault = data.data;
        try {
            // Currently we know we need the dexterity-pool-v1 token info
            const dexterityTokenId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-pool-v1';
            const tokenMetadata = await getTokenMetadataCached(dexterityTokenId);
            vault.tokenForRewards = tokenMetadata;
        } catch (tokenError) {
            console.error('Failed to fetch token metadata:', tokenError);
            // Continue without token metadata
        }

        return vault;
    } catch (error) {
        console.error('Error fetching vault details:', error);
        return null;
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

            {/* Token Focus Card - Primary Element */}
            {vault.tokenForRewards && (
                <Card className="border border-primary/10 overflow-hidden shadow-md bg-gradient-to-br from-background to-muted/5 mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 items-center">
                        {/* Token Image - Prominent */}
                        <div className="flex justify-center px-6 py-0 h-full items-center bg-primary/5">
                            <div className="w-40 h-40 rounded-lg overflow-hidden border-1 border-primary/10 shadow-md p-1 bg-background">
                                <img
                                    src={vault.tokenForRewards?.image || `https://placehold.co/300x300?text=${vault.tokenForRewards?.symbol || 'Token'}`}
                                    alt={vault.tokenForRewards?.name || 'Token'}
                                    className="w-full h-full object-cover rounded"
                                    onError={(e) => {
                                        e.currentTarget.src = `https://placehold.co/300x300?text=${vault.tokenForRewards?.symbol || 'Token'}`;
                                    }}
                                />
                            </div>
                        </div>

                        {/* Token Information - Center */}
                        <div className="md:col-span-2 p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="px-2 py-1">
                                    Required Token
                                </Badge>
                                <Badge variant="outline">{vault.tokenForRewards?.symbol}</Badge>
                            </div>

                            <h1 className="text-3xl font-bold text-primary">
                                {vault.tokenForRewards?.name}
                            </h1>

                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Coins className="h-5 w-5 text-primary" />
                                <span className="text-lg">Hold this token to earn energy rewards</span>
                            </div>

                            <p className="text-muted-foreground">
                                {vault.tokenForRewards?.description || "Hold tokens in your wallet to earn energy based on duration held."}
                            </p>

                            {/* Token details in a horizontal list */}
                            <div className="grid grid-cols-2 gap-4 mt-4 sm:flex sm:flex-wrap sm:gap-6">
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Decimals</span>
                                    <span className="font-medium">{vault.tokenForRewards?.decimals}</span>
                                </div>

                                {vault.tokenForRewards?.contract_principal && (
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">Contract</span>
                                        <span className="font-medium truncate max-w-[180px]" title={vault.tokenForRewards.contract_principal}>
                                            {vault.tokenForRewards.contract_principal.split('.')[0]}...
                                        </span>
                                    </div>
                                )}

                                {vault.tokenForRewards?.total_supply && (
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">Supply</span>
                                        <span className="font-medium">{Number(vault.tokenForRewards.total_supply).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Vault Info - Secondary Element (Now smaller) */}
                <div className="md:col-span-4">
                    <Card className="h-fit overflow-hidden border border-border/70 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center">
                                <Info className="w-4 h-4 mr-2 text-muted-foreground" />
                                Vault Details
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="pt-2">
                            <div className="flex items-center gap-3 mb-4">
                                <img
                                    src={vault.image || 'https://placehold.co/200x200?text=Energy'}
                                    alt={vault.name}
                                    className="w-10 h-10 rounded-md object-cover"
                                    onError={(e) => {
                                        e.currentTarget.src = 'https://placehold.co/200x200?text=Energy';
                                    }}
                                />
                                <div>
                                    <div className="font-medium text-sm">{vault.name}</div>
                                    {vault.symbol && <Badge variant="outline" className="text-xs mt-1">{vault.symbol}</Badge>}
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <Clock className="w-3.5 h-3.5 text-primary mr-2" />
                                            <span className="text-xs">Mechanism</span>
                                        </div>
                                        <Badge variant="outline" className="text-xs">Hold-to-Earn</Badge>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <Users className="w-3.5 h-3.5 text-primary mr-2" />
                                            <span className="text-xs">Protocol</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">{vault.additionalData?.protocol || 'CHARISMA'}</Badge>
                                    </div>
                                </div>

                                <div className="text-xs">
                                    <div className="text-muted-foreground mb-1">Contract ID</div>
                                    <div className="font-mono text-[10px] bg-muted/30 p-2 rounded break-all">
                                        {vault.contractId}
                                    </div>
                                </div>

                                {vault.engineContractId && (
                                    <div className="text-xs">
                                        <div className="text-muted-foreground mb-1">Engine Contract</div>
                                        <div className="font-mono text-[10px] bg-muted/30 p-2 rounded break-all">
                                            {vault.engineContractId}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>

                        {vault.externalPoolId && (
                            <CardFooter className="border-t pt-4 justify-center">
                                <Button variant="outline" size="sm" asChild className="text-xs w-full">
                                    <a href={`https://explorer.hiro.so/txid/${vault.externalPoolId}?chain=mainnet`} target="_blank" rel="noopener noreferrer">
                                        View on Explorer <ExternalLink className="ml-2 h-3 w-3" />
                                    </a>
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                </div>

                {/* Energy Functions - Now the main focus */}
                <div className="md:col-span-8">
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
                                    <Zap className="w-5 h-5 mr-2 text-primary" />
                                    How It Works
                                </CardTitle>
                                <CardDescription>
                                    Learn how to earn energy by holding tokens
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Working process with bigger steps */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                                <span className="font-bold text-xl">1</span>
                                            </div>
                                        </div>
                                        <h4 className="text-center font-medium mb-1">Hold Tokens</h4>
                                        <p className="text-xs text-center text-muted-foreground">
                                            Keep {vault.tokenForRewards?.symbol || "tokens"} in your wallet to start accruing energy
                                        </p>
                                    </div>
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                                <span className="font-bold text-xl">2</span>
                                            </div>
                                        </div>
                                        <h4 className="text-center font-medium mb-1">Accumulate</h4>
                                        <p className="text-xs text-center text-muted-foreground">
                                            Energy accumulates based on time and token balance
                                        </p>
                                    </div>
                                    <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                                        <div className="flex justify-center mb-2">
                                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                                <span className="font-bold text-xl">3</span>
                                            </div>
                                        </div>
                                        <h4 className="text-center font-medium mb-1">Harvest</h4>
                                        <p className="text-xs text-center text-muted-foreground">
                                            Claim your energy rewards when ready
                                        </p>
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
                                        This vault rewards you based on the duration you hold {vault.tokenForRewards?.symbol || "tokens"}.
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