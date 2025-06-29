import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchCallReadOnlyFunction, cvToValue, principalCV } from '@stacks/transactions';
import { STACKS_MAINNET, type StacksNetwork } from '@stacks/network'; // Assuming mainnet, adjust if needed
import { Skeleton } from '@/components/ui/skeleton'; // For loading state
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // For errors
import { formatUnits, cn } from '@/lib/utils'; // Assuming a utility for formatting
import { useWallet } from '@/context/wallet-context'; // Import wallet context
import { getTokenMetadataCached } from '@repo/tokens'; // Import from tokens package
import { ExternalLink } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { PoolActionsTabs } from './PoolActionsTabs'; // Import the new tabs component
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Droplets,
    ArrowLeftRight,
    Info,
    Coins,
    Wallet,
    Scale,
    BarChart3
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PoolDetailsProps {
    contractId: string;
}

// Export this interface
export interface TokenInfoBase {
    contractId: string;
    symbol: string;
    decimals: number;
    description?: string | null;
    token_uri?: string | null;
    image?: string | null;
}

// Export this interface
export interface LpTokenInfo extends TokenInfoBase {
    name: string;
    userBalance: bigint | null;
}

// Export this interface
export interface PoolInfo {
    reserves: {
        dx: bigint;
        dy: bigint;
        dk: bigint;
    };
    lpToken: LpTokenInfo;
    tokenA: TokenInfoBase;
    tokenB: TokenInfoBase;
}

// Explorer URL (Mainnet)
// TODO: Make this dynamic based on network
const EXPLORER_BASE_URL = "https://explorer.stacks.co/txid";

// Contract IDs for underlying tokens (still needed for cache calls)
const TOKEN_A_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6";
const TOKEN_B_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-rc2";

export const PoolDetails: React.FC<PoolDetailsProps> = ({ contractId }) => {
    const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { address: walletAddress, connected: isWalletConnected } = useWallet(); // Get wallet state
    const network: StacksNetwork = STACKS_MAINNET; // Or get from context/props

    useEffect(() => {
        const fetchPoolInfo = async () => {
            setIsLoading(true);
            setError(null);
            setPoolInfo(null);

            try {
                const [poolContractAddress, poolContractName] = contractId.split('.');
                if (!poolContractAddress || !poolContractName) {
                    throw new Error("Invalid pool contract ID format.");
                }

                // Helper for direct read-only calls (kept for non-cached functions)
                const callReadOnly = (functionName: string, functionArgs: any[] = []) =>
                    fetchCallReadOnlyFunction({
                        contractAddress: poolContractAddress,
                        contractName: poolContractName,
                        functionName,
                        functionArgs,
                        network,
                        senderAddress: walletAddress || poolContractAddress,
                    }).then(cvToValue);

                // Fetch metadata from cache, reserves & balance directly
                const [lpMeta, tokenAMeta, tokenBMeta, reservesData, lpUserBalanceData] = await Promise.all([
                    getTokenMetadataCached(contractId), // LP Token metadata from cache
                    getTokenMetadataCached(TOKEN_A_CONTRACT_ID), // Token A metadata from cache
                    getTokenMetadataCached(TOKEN_B_CONTRACT_ID), // Token B metadata from cache
                    callReadOnly('get-reserves-quote'), // Reserves from direct call
                    walletAddress ? callReadOnly('get-balance', [principalCV(walletAddress)]) : Promise.resolve(null), // Balance from direct call
                ]);

                console.log({ lpUserBalanceData })

                // --- Validation ---
                if (!lpMeta) throw new Error(`Failed to fetch LP token metadata for ${contractId} from cache.`);
                if (!tokenAMeta) throw new Error(`Failed to fetch Token A metadata for ${TOKEN_A_CONTRACT_ID} from cache.`);
                if (!tokenBMeta) throw new Error(`Failed to fetch Token B metadata for ${TOKEN_B_CONTRACT_ID} from cache.`);
                if (!reservesData || typeof reservesData !== 'object' || !('dx' in reservesData) || !('dy' in reservesData) || !('dk' in reservesData)) throw new Error('Invalid reserves data from direct call');
                const lpBalance = BigInt(lpUserBalanceData?.value || 0);
                // --- End Validation ---

                setPoolInfo({
                    reserves: {
                        dx: BigInt(reservesData.dx.value), // Still assuming ClarityValue structure from direct call
                        dy: BigInt(reservesData.dy.value),
                        dk: BigInt(reservesData.dk.value)
                    },
                    lpToken: {
                        contractId: contractId,
                        name: lpMeta.name,
                        symbol: lpMeta.symbol,
                        decimals: lpMeta.decimals || 6,
                        userBalance: lpBalance,
                        description: lpMeta.description,
                        token_uri: lpMeta.token_uri
                    },
                    tokenA: {
                        contractId: TOKEN_A_CONTRACT_ID,
                        symbol: tokenAMeta.symbol,
                        decimals: tokenAMeta.decimals || 6,
                        description: tokenAMeta.description,
                        token_uri: tokenAMeta.token_uri
                    },
                    tokenB: {
                        contractId: TOKEN_B_CONTRACT_ID,
                        symbol: tokenBMeta.symbol,
                        decimals: tokenBMeta.decimals || 6,
                        description: tokenBMeta.description,
                        token_uri: tokenBMeta.token_uri
                    },
                });

            } catch (err) {
                console.error("Failed to fetch pool info:", err);
                setError(err instanceof Error ? err.message : 'Failed to fetch pool information.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPoolInfo();
    }, [contractId, network, walletAddress]); // Re-fetch if walletAddress changes

    const renderTokenAvatar = (token: TokenInfoBase | LpTokenInfo) => {
        const symbol = token.symbol || 'TOKEN';
        const isLp = 'name' in token && token.name?.toLowerCase().includes('lp');

        return (
            <Avatar className="h-8 w-8 bg-primary/10">
                <AvatarImage src={token.image || undefined} alt={symbol} />
                <AvatarFallback className={cn(
                    "text-xs font-bold",
                    isLp ? "bg-primary/20 text-primary" : "bg-muted"
                )}>
                    {isLp ? "LP" : symbol.substring(0, 2)}
                </AvatarFallback>
            </Avatar>
        );
    };

    const renderExplorerLink = (contractId: string, label?: string) => {
        const explorerUrl = `https://explorer.stacks.co/txid/${contractId}?chain=${network.chainId === 1 ? 'mainnet' : 'testnet'}`;
        return (
            <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-primary gap-1 transition-colors"
            >
                {label || "View in Explorer"} <ExternalLink className="h-3 w-3" />
            </a>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="space-y-8">
                    {/* Pool Overview Skeleton */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <Skeleton className="h-8 w-1/3" />
                            <Skeleton className="h-6 w-24" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    </div>

                    <Separator />

                    {/* Token Info Skeletons */}
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-40" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                        <Skeleton className="h-32 w-full" />
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <Alert variant="destructive">
                    <AlertTitle>Error Loading Pool Data</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            );
        }

        if (poolInfo) {
            const { reserves, lpToken, tokenA, tokenB } = poolInfo;
            const totalLiquidity = formatUnits(reserves.dk, lpToken.decimals);
            const userSharePercent = lpToken.userBalance && reserves.dk > 0n
                ? (Number(lpToken.userBalance) / Number(reserves.dk) * 100).toFixed(2)
                : "0.00";

            // Calculate percentages for token distribution
            const totalValue = Number(reserves.dx) + Number(reserves.dy);
            const tokenAPercent = totalValue > 0 ? (Number(reserves.dx) / totalValue * 100).toFixed(1) : "50.0";
            const tokenBPercent = totalValue > 0 ? (Number(reserves.dy) / totalValue * 100).toFixed(1) : "50.0";

            return (
                <div className="space-y-8">
                    {/* Pool Overview Section */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="flex -space-x-2 mr-3">
                                    {renderTokenAvatar(tokenA)}
                                    {renderTokenAvatar(tokenB)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">
                                        {tokenA.symbol}/{tokenB.symbol} Pool
                                    </h3>
                                    <div className="text-xs text-muted-foreground">
                                        {renderExplorerLink(contractId)}
                                    </div>
                                </div>
                            </div>
                            <Badge variant="outline" className="px-3 py-1">
                                <ArrowLeftRight className="h-3 w-3 mr-1" />
                                Liquidity Pool
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Total Liquidity Card */}
                            <Card className="bg-background border-muted">
                                <CardContent className="p-4">
                                    <div className="flex items-center mb-2">
                                        <Droplets className="h-4 w-4 mr-2 text-blue-500" />
                                        <span className="text-sm font-medium">Total Liquidity</span>
                                    </div>
                                    <div className="text-2xl font-bold mb-1">{totalLiquidity}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {lpToken.symbol} Total Supply
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Pool Composition Card */}
                            <Card className="bg-background border-muted">
                                <CardContent className="p-4">
                                    <div className="flex items-center mb-2">
                                        <Scale className="h-4 w-4 mr-2 text-green-500" />
                                        <span className="text-sm font-medium">Pool Composition</span>
                                    </div>

                                    <div className="flex gap-2 items-center mb-1">
                                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${tokenAPercent}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-xs">
                                        <span className="flex items-center">
                                            <span className="w-2 h-2 bg-primary rounded-full mr-1"></span>
                                            {tokenAPercent}% {tokenA.symbol}
                                        </span>
                                        <span className="flex items-center">
                                            {tokenBPercent}% {tokenB.symbol}
                                            <span className="w-2 h-2 bg-muted rounded-full ml-1"></span>
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* User Position Card */}
                            {isWalletConnected ? (
                                <Card className={cn(
                                    "bg-background border-muted",
                                    lpToken.userBalance && lpToken.userBalance > 0n ? "border-primary/50" : ""
                                )}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center mb-2">
                                            <Wallet className="h-4 w-4 mr-2 text-violet-500" />
                                            <span className="text-sm font-medium">Your Position</span>
                                        </div>
                                        {lpToken.userBalance && lpToken.userBalance > 0n ? (
                                            <>
                                                <div className="text-2xl font-bold mb-1">{formatUnits(lpToken.userBalance, lpToken.decimals)}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {userSharePercent}% of pool
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-muted-foreground py-2">
                                                No position in this pool
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="bg-background border-muted">
                                    <CardContent className="p-4 flex items-center justify-center h-full">
                                        <div className="text-center text-muted-foreground text-sm">
                                            Connect wallet to view your position
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Token Reserves Section */}
                    <div>
                        <h3 className="font-semibold flex items-center mb-4">
                            <Coins className="h-4 w-4 mr-2 text-primary" />
                            Token Reserves
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Token A Card */}
                            <Card className="overflow-hidden">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            {renderTokenAvatar(tokenA)}
                                            <div>
                                                <CardTitle className="text-base">{tokenA.symbol}</CardTitle>
                                                <CardDescription className="text-xs truncate max-w-[200px]">
                                                    {tokenA.contractId}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-muted-foreground">
                                                        {renderExplorerLink(tokenA.contractId, "View")}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>View token contract in explorer</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Pool Reserve:</span>
                                            <span className="font-medium">{formatUnits(reserves.dx, tokenA.decimals)}</span>
                                        </div>
                                        {tokenA.description && (
                                            <div className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                                                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                <span className="line-clamp-2">{tokenA.description}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Token B Card */}
                            <Card className="overflow-hidden">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            {renderTokenAvatar(tokenB)}
                                            <div>
                                                <CardTitle className="text-base">{tokenB.symbol}</CardTitle>
                                                <CardDescription className="text-xs truncate max-w-[200px]">
                                                    {tokenB.contractId}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-muted-foreground">
                                                        {renderExplorerLink(tokenB.contractId, "View")}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>View token contract in explorer</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Pool Reserve:</span>
                                            <span className="font-medium">{formatUnits(reserves.dy, tokenB.decimals)}</span>
                                        </div>
                                        {tokenB.description && (
                                            <div className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                                                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                <span className="line-clamp-2">{tokenB.description}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* LP Token Card */}
                        <Card className="mt-6 overflow-hidden bg-muted/30">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {renderTokenAvatar(lpToken)}
                                        <div>
                                            <CardTitle className="text-base">
                                                {lpToken.symbol} <Badge variant="outline" className="ml-1">LP Token</Badge>
                                            </CardTitle>
                                            <CardDescription className="text-xs truncate max-w-[200px]">
                                                {lpToken.contractId}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="text-xs text-muted-foreground">
                                                    {renderExplorerLink(lpToken.contractId, "View")}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>View LP token contract in explorer</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col space-y-1.5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Token Name:</div>
                                            <div className="font-medium">{lpToken.name}</div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">Decimals:</div>
                                            <div className="font-medium">{lpToken.decimals}</div>
                                        </div>
                                    </div>

                                    {isWalletConnected && lpToken.userBalance !== null && (
                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-muted">
                                            <span className="text-sm text-muted-foreground">Your Balance:</span>
                                            <span className="font-medium">{formatUnits(lpToken.userBalance, lpToken.decimals)}</span>
                                        </div>
                                    )}

                                    {lpToken.description && (
                                        <div className="text-xs text-muted-foreground mt-2 flex items-start gap-1">
                                            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                            <span>{lpToken.description}</span>
                                        </div>
                                    )}

                                    {lpToken.token_uri && (
                                        <div className="text-xs text-muted-foreground mt-2">
                                            <a
                                                href={lpToken.token_uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center hover:text-primary gap-1 transition-colors"
                                            >
                                                View Metadata URI <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Separator />

                    {/* Interact Section - Pool Actions Tabs */}
                    <div>
                        <h3 className="font-semibold flex items-center mb-4">
                            <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                            Pool Actions
                        </h3>
                        <PoolActionsTabs poolInfo={poolInfo} contractId={contractId} />
                    </div>
                </div>
            );
        }

        return null;
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                    <CardTitle>
                        {poolInfo
                            ? (
                                <div className="flex items-center">
                                    <div className="flex -space-x-2 mr-2">
                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary ring-2 ring-background">
                                            {poolInfo.tokenA.symbol.substring(0, 1)}
                                        </div>
                                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary ring-2 ring-background">
                                            {poolInfo.tokenB.symbol.substring(0, 1)}
                                        </div>
                                    </div>
                                    {poolInfo.tokenA.symbol}/{poolInfo.tokenB.symbol} Pool
                                </div>
                            )
                            : (isLoading ? <Skeleton className="h-8 w-40" /> : 'Pool Details')
                        }
                    </CardTitle>
                    <CardDescription>{contractId}</CardDescription>
                </div>
                {poolInfo && !isLoading && (
                    <Badge variant="outline" className="px-2 py-1">
                        <ArrowLeftRight className="h-3 w-3 mr-1" /> Pool
                    </Badge>
                )}
            </CardHeader>
            <CardContent>
                {renderContent()}
            </CardContent>
        </Card>
    );
}; 