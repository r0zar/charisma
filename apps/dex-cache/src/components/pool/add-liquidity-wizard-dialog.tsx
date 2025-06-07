"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Wallet, AlertCircle, CheckCircle, Loader2, Sparkle, Sparkles, Copy } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { getFungibleTokenBalance, Vault, listVaultTokens } from '@/lib/pool-service';
import { AddLiquidityModal } from '@/components/pool/add-liquidity-modal';
import { ClientDisplayVault } from '@/components/pool/vault-detail-client';
import { listTokens, TokenCacheData } from '@repo/tokens';
import { getAccountBalances } from '@repo/polyglot';

interface AddLiquidityWizardProps {
    pools: Vault[];
    prices: Record<string, number>;
}

interface WalletToken {
    contractId: string;
    symbol: string;
    name: string;
    balance: number;
    decimals: number;
    image?: string;
    price?: number;
}

// Function to fetch user's wallet tokens from the pool tokens
const fetchUserWalletTokens = async (address: string, pools: Vault[], prices: Record<string, number>, allTokens: TokenCacheData[]): Promise<WalletToken[]> => {
    try {
        // Fetch all balances at once
        const balances = await getAccountBalances(address);
        if (!balances) return [];
        const walletTokens: WalletToken[] = [];

        for (const token of allTokens) {
            // Construct the key for fungible_tokens: contractId:identifier
            const key = `${token.contractId}::${token.identifier ?? ''}`;
            const tokenBalanceObj = balances.fungible_tokens?.[key];
            const balance = tokenBalanceObj ? parseInt(tokenBalanceObj.balance) : 0;
            if (balance > 0) {
                walletTokens.push({
                    contractId: token.contractId,
                    symbol: token.symbol ?? '',
                    name: token.name ?? '',
                    balance,
                    decimals: token.decimals ?? 0,
                    image: token.image ?? '',
                    price: prices[token.contractId]
                });
            }
        }

        // Special case for STX
        if (balances.stx && balances.stx.balance) {
            const stxToken = allTokens.find(t => t.contractId === '.stx');
            if (stxToken) {
                const stxBalance = parseInt(balances.stx.balance);
                if (stxBalance > 0) {
                    walletTokens.push({
                        contractId: '.stx',
                        symbol: stxToken.symbol ?? '',
                        name: stxToken.name ?? '',
                        balance: stxBalance,
                        decimals: stxToken.decimals ?? 6,
                        image: stxToken.image ?? '',
                        price: prices['.stx']
                    });
                }
            }
        }

        // Sort by balance value (highest first)
        return walletTokens.sort((a, b) => {
            const valueA = (a.balance / Math.pow(10, a.decimals)) * (a.price || 0);
            const valueB = (b.balance / Math.pow(10, b.decimals)) * (b.price || 0);
            return valueB - valueA;
        });
    } catch (error) {
        console.error('Error fetching wallet tokens:', error);
        return [];
    }
};

const TokenSelector = ({
    label,
    selectedToken,
    onTokenSelect,
    walletTokens,
    disabled
}: {
    label: string;
    selectedToken: WalletToken | null;
    onTokenSelect: (token: WalletToken) => void;
    walletTokens: WalletToken[];
    disabled: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTokens = useMemo(() => {
        return walletTokens.filter(token =>
            token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            token.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [walletTokens, searchTerm]);

    const formatBalance = (balance: number, decimals: number) => {
        const formatted = balance / Math.pow(10, decimals);
        if (formatted < 0.001) {
            return formatted.toExponential(2);
        }
        return formatted.toLocaleString(undefined, { maximumFractionDigits: 6 });
    };

    const formatUsdValue = (balance: number, decimals: number, price?: number) => {
        if (!price) return null;
        const tokenAmount = balance / Math.pow(10, decimals);
        const usdValue = tokenAmount * price;
        if (usdValue < 0.01) return '< $0.01';
        return `$${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        disabled={disabled}
                        className="w-full justify-start h-16 p-4"
                    >
                        {selectedToken ? (
                            <div className="flex items-center w-full">
                                {selectedToken.image && (
                                    <Image
                                        src={selectedToken.image}
                                        alt={selectedToken.symbol}
                                        width={32}
                                        height={32}
                                        className="rounded-full mr-3"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                )}
                                <div className="flex-1 text-left">
                                    <div className="font-medium">{selectedToken.symbol}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {formatBalance(selectedToken.balance, selectedToken.decimals)} {selectedToken.symbol}
                                        {selectedToken.price && (
                                            <span className="ml-2">
                                                ({formatUsdValue(selectedToken.balance, selectedToken.decimals, selectedToken.price)})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <Search className="w-4 h-4 mr-2" />
                                Select token
                            </div>
                        )}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Select Token</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search tokens..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                            {filteredTokens.map((token) => (
                                <Button
                                    key={token.contractId}
                                    variant="ghost"
                                    className="w-full justify-start h-16 p-4"
                                    onClick={() => {
                                        onTokenSelect(token);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                >
                                    <div className="flex items-center w-full">
                                        {token.image && (
                                            <Image
                                                src={token.image}
                                                alt={token.symbol}
                                                width={32}
                                                height={32}
                                                className="rounded-full mr-3"
                                            />
                                        )}
                                        <div className="flex-1 text-left">
                                            <div className="font-medium">{token.symbol}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {formatBalance(token.balance, token.decimals)} {token.symbol}
                                            </div>
                                        </div>
                                        {token.price && (
                                            <div className="text-sm text-muted-foreground">
                                                ${token.price.toFixed(4)}
                                            </div>
                                        )}
                                    </div>
                                </Button>
                            ))}
                            {filteredTokens.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                    No tokens found
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export function AddLiquidityWizard({ pools, prices }: AddLiquidityWizardProps) {
    const { walletState } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [walletTokens, setWalletTokens] = useState<WalletToken[]>([]);
    const [selectedTokenA, setSelectedTokenA] = useState<WalletToken | null>(null);
    const [selectedTokenB, setSelectedTokenB] = useState<WalletToken | null>(null);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);
    const [matchingPool, setMatchingPool] = useState<Vault | null>(null);

    // Load wallet tokens when dialog opens and wallet is connected
    useEffect(() => {
        let isMounted = true;
        async function loadTokens() {
            if (isOpen && walletState.connected && walletState.address) {
                setIsLoadingTokens(true);
                try {
                    // Fetch whitelist from token cache
                    const allTokens = await listTokens();
                    const tokens = await fetchUserWalletTokens(walletState.address, pools, prices, allTokens);
                    // Add prices from props to tokens
                    const tokensWithPrices = tokens.map(token => ({
                        ...token,
                        price: prices[token.contractId]
                    }));
                    if (isMounted) setWalletTokens(tokensWithPrices);
                } catch (error) {
                    console.error('Failed to fetch wallet tokens:', error);
                    toast.error('Failed to load wallet tokens');
                } finally {
                    if (isMounted) setIsLoadingTokens(false);
                }
            }
        }
        loadTokens();
        return () => { isMounted = false; };
    }, [isOpen, walletState.connected, walletState.address, prices, pools]);

    // Check for matching pool when both tokens are selected
    useEffect(() => {
        if (selectedTokenA && selectedTokenB) {
            const pool = pools.find(p => {
                const tokenAMatch = p.tokenA?.contractId === selectedTokenA.contractId || p.tokenA?.contractId === selectedTokenB.contractId;
                const tokenBMatch = p.tokenB?.contractId === selectedTokenA.contractId || p.tokenB?.contractId === selectedTokenB.contractId;
                return tokenAMatch && tokenBMatch && p.tokenA?.contractId !== p.tokenB?.contractId;
            });
            setMatchingPool(pool || null);
        } else {
            setMatchingPool(null);
        }
    }, [selectedTokenA, selectedTokenB, pools]);

    // Add fragment support for opening dialog
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (window.location.hash.toLowerCase() === '#add-liquidity' ||
                window.location.hash.toLowerCase() === '#add') {
                //wait 100ms
                setTimeout(() => {
                    setIsOpen(true);
                }, 100);
            }
        }
    }, []);

    // Add after walletTokens are loaded
    useEffect(() => {
        if (walletTokens.length === 0) return;
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const tokenAParam = params.get('tokenA');
        const tokenBParam = params.get('tokenB');
        if (tokenAParam) {
            const foundA = walletTokens.find(t => t.contractId === tokenAParam);
            if (foundA) setSelectedTokenA(foundA);
        }
        if (tokenBParam) {
            const foundB = walletTokens.find(t => t.contractId === tokenBParam);
            if (foundB) setSelectedTokenB(foundB);
        }
    }, [walletTokens]);

    const handleReset = () => {
        setSelectedTokenA(null);
        setSelectedTokenB(null);
        setMatchingPool(null);
    };

    const convertToClientDisplayVault = (vault: Vault): ClientDisplayVault => {
        return {
            type: vault.type,
            contractId: vault.contractId,
            name: vault.name,
            identifier: vault.identifier,
            symbol: vault.symbol,
            decimals: vault.decimals,
            description: vault.description,
            image: vault.image,
            fee: vault.fee,
            externalPoolId: vault.externalPoolId,
            engineContractId: vault.engineContractId,
            tokenA: vault.tokenA as TokenCacheData,
            tokenB: vault.tokenB as TokenCacheData,
            reservesA: vault.reservesA || 0,
            reservesB: vault.reservesB || 0,
        };
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
                handleReset();
            }
        }}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4" />
                    Add Liquidity
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add Liquidity to Pool</DialogTitle>
                </DialogHeader>

                {!walletState.connected ? (
                    <div className="text-center py-8">
                        <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground mb-4">Connect your wallet to add liquidity</p>
                        <Button onClick={() => setIsOpen(false)}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {isLoadingTokens ? (
                            <div className="text-center py-8">
                                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
                                <p className="text-muted-foreground">Loading your tokens...</p>
                            </div>
                        ) : (
                            <>
                                {/* Token Selection */}
                                <div className="space-y-4">
                                    <TokenSelector
                                        label="First Token"
                                        selectedToken={selectedTokenA}
                                        onTokenSelect={setSelectedTokenA}
                                        walletTokens={walletTokens.filter(t => t.contractId !== selectedTokenB?.contractId)}
                                        disabled={walletTokens.length === 0}
                                    />

                                    <div className="flex justify-center">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                            <Plus className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </div>

                                    <TokenSelector
                                        label="Second Token"
                                        selectedToken={selectedTokenB}
                                        onTokenSelect={setSelectedTokenB}
                                        walletTokens={walletTokens.filter(t => t.contractId !== selectedTokenA?.contractId)}
                                        disabled={walletTokens.length === 0 || !selectedTokenA}
                                    />
                                </div>

                                {/* Pool Status */}
                                {(selectedTokenA && selectedTokenB && matchingPool) ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center text-green-600">
                                            <CheckCircle className="w-5 h-5 mr-2" />
                                            <span className="font-medium">Pool Found!</span>
                                        </div>
                                        <div className="bg-muted/50 rounded-lg p-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                {matchingPool.image && (
                                                    <Image
                                                        src={matchingPool.image}
                                                        alt={matchingPool.name}
                                                        width={24}
                                                        height={24}
                                                        className="rounded-full"
                                                    />
                                                )}
                                                <span className="font-medium">{matchingPool.name}</span>
                                                <Badge variant="outline">
                                                    {(matchingPool.fee / 10000).toFixed(2)}% fee
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                {matchingPool.tokenA?.symbol} / {matchingPool.tokenB?.symbol} • {matchingPool.protocol}
                                            </div>
                                        </div>
                                        <AddLiquidityModal
                                            vault={convertToClientDisplayVault(matchingPool)}
                                            prices={prices}
                                            trigger={
                                                <Button className="w-full gap-2">
                                                    <Wallet className="w-4 h-4" />
                                                    Add Liquidity to Pool
                                                </Button>
                                            }
                                        />
                                    </div>
                                ) : (
                                    <>
                                        {(selectedTokenA && !selectedTokenB) && (
                                            <div className="text-center text-muted-foreground py-4">
                                                Select a second token to check for an available liquidity pool.
                                            </div>
                                        )}
                                        {(selectedTokenB && !selectedTokenA) && (
                                            <div className="text-center text-muted-foreground py-4">
                                                Select a first token to check for an available liquidity pool.
                                            </div>
                                        )}
                                        {selectedTokenA && selectedTokenB && !matchingPool && (
                                            <div className="col-span-full w-full flex flex-col gap-4 pt-4">
                                                <Alert variant="default" className="flex items-start gap-3 bg-card border-primary/40">
                                                    <Sparkles className="h-5 w-5 mt-0.5 min-w-6 animate-pulse" />
                                                    <div>
                                                        <div className="font-medium text-primary">Create this pool and collect fees!</div>
                                                        <div className="text-sm text-muted-foreground">As the first liquidity provider, you'll receive <b>100% of all swap fees</b> until others add liquidity to this pool.</div>
                                                    </div>
                                                </Alert>
                                                <Button
                                                    asChild
                                                    variant="secondary"
                                                    className="w-full h-12 text-base font-semibold gap-2"
                                                >
                                                    <a
                                                        href={`https://launchpad.charisma.rocks/templates/liquidity-pool?tokenA=${encodeURIComponent(selectedTokenA.contractId)}&tokenB=${encodeURIComponent(selectedTokenB.contractId)}&fee=1`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                        Create Pool on Launchpad
                                                    </a>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="w-full flex gap-2 mt-2"
                                                    onClick={() => {
                                                        const url = new URL(window.location.href);
                                                        url.searchParams.set('tokenA', selectedTokenA.contractId);
                                                        url.searchParams.set('tokenB', selectedTokenB.contractId);
                                                        url.hash = '#add';
                                                        navigator.clipboard.writeText(url.toString());
                                                        toast.success('Shareable link copied to clipboard!');
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    Invite a friend
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Reset Button */}
                                {(selectedTokenA || selectedTokenB) && (
                                    <Button
                                        variant="outline"
                                        onClick={handleReset}
                                        className="w-full"
                                    >
                                        Reset Selection
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}