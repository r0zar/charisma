"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Loader2,
    Image as ImageIconLucide,
    Layers,
    Check,
    ChevronRight,
    DollarSign,
    AlertTriangle,
    Info,
    RefreshCw,
    Shield,
    X
} from "lucide-react";
import { TokenMetadata } from "@/lib/metadata-service"; // Assuming this type lives here or is globally defined

// Review and Deploy Step Component
export const ReviewDeployStep = ({
    poolName,
    lpTokenSymbol,
    token1,
    token2,
    swapFee,
    contractIdentifier,
    isGeneratingMetadata,
    metadataApiError,
    hasMetadata,
    metadata,
    isDeploying,
    token1Image,
    token2Image,
    initialTokenRatio,
    onGenerateMetadata,
    onRefreshMetadata,
    onPrevious,
    onDeploy
}: {
    poolName: string;
    lpTokenSymbol: string;
    token1: string;
    token2: string;
    swapFee: string;
    contractIdentifier: string;
    isGeneratingMetadata: boolean;
    metadataApiError: boolean;
    hasMetadata: boolean;
    metadata: TokenMetadata | null;
    isDeploying: boolean;
    token1Image?: string;
    token2Image?: string;
    initialTokenRatio: {
        token1Amount: number;
        token2Amount: number;
        useRatio: boolean;
    };
    onGenerateMetadata: () => void;
    onRefreshMetadata: () => void;
    onPrevious: () => void;
    onDeploy: () => void;
}) => {
    // Track when metadata was successfully generated to show success message
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);

    // Set success message when metadata is generated
    useEffect(() => {
        if (hasMetadata && !isGeneratingMetadata) {
            setShowSuccessMessage(true);
            // Hide success message after 5 seconds
            const timer = setTimeout(() => {
                setShowSuccessMessage(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [hasMetadata, isGeneratingMetadata]);

    return (
        <>
            <div className="space-y-8">
                {/* Success message when metadata is generated */}
                {showSuccessMessage && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3 transition-all animate-in fade-in slide-in-from-top-4">
                        <div className="h-5 w-5 mt-0.5 rounded-full bg-green-500 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-medium text-green-900">Metadata Generated Successfully</h4>
                            <p className="text-sm text-green-700">Your LP token metadata has been created and saved.</p>
                        </div>
                        <button onClick={() => setShowSuccessMessage(false)} className="text-green-500 hover:text-green-700">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Pool Configuration Summary Card */}
                <Card className="overflow-hidden border-none shadow-md">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-3">
                        <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                                <Layers className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Pool Configuration</CardTitle>
                                <CardDescription className="text-xs">
                                    Review your configured pool settings
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0 bg-slate-100/30 dark:bg-slate-900/30">
                        <div className="divide-y">
                            <div className="grid grid-cols-3 px-6 py-4">
                                <div className="col-span-1">
                                    <span className="text-xs text-muted-foreground">Name</span>
                                    <p className="font-medium">{poolName || "Not specified"}</p>
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs text-muted-foreground">LP Token Symbol</span>
                                    <p className="font-medium">{lpTokenSymbol}</p>
                                </div>
                                <div className="col-span-1">
                                    <span className="text-xs text-muted-foreground">Swap Fee</span>
                                    <p className="font-medium">{swapFee}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 px-6 py-4 bg-slate-50/60 dark:bg-slate-800/60">
                                <div className="col-span-1">
                                    <div className="flex items-center mb-2">
                                        <span className="text-xs text-muted-foreground mr-2">Token Pair</span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="w-60">The two tokens that can be swapped in this liquidity pool</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                                {token1Image ? (
                                                    <img
                                                        src={token1Image}
                                                        alt={token1}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs font-medium">${token1.charAt(0)}</span>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-xs font-medium">{token1.charAt(0)}</span>
                                                )}
                                            </div>
                                            <span className="font-medium">{token1}</span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex items-center gap-1.5">
                                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                                                {token2Image ? (
                                                    <img
                                                        src={token2Image}
                                                        alt={token2}
                                                        className="h-full w-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs font-medium">${token2.charAt(0)}</span>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-xs font-medium">{token2.charAt(0)}</span>
                                                )}
                                            </div>
                                            <span className="font-medium">{token2}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="flex items-center mb-2">
                                        <span className="text-xs text-muted-foreground mr-2">Contract Identifier</span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="w-60">The full contract identifier for this pool on the Stacks blockchain</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <div className="font-mono text-xs break-all bg-muted/30 rounded p-2">
                                        {contractIdentifier || "Connect wallet and enter pool name"}
                                    </div>
                                </div>
                            </div>

                            {/* Initial Pool Ratio Summary - Added this section */}
                            <div className="px-6 py-4">
                                <h3 className="text-sm font-medium mb-2">Initial Pool Ratio</h3>
                                <div className="border rounded-md p-3 bg-muted/20">
                                    {initialTokenRatio.useRatio ? (
                                        <div className="flex flex-col space-y-2">
                                            <div className="flex justify-between">
                                                <span className="text-xs text-muted-foreground">Initial {token1}</span>
                                                <span className="font-medium">{initialTokenRatio.token1Amount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs text-muted-foreground">Initial {token2}</span>
                                                <span className="font-medium">{initialTokenRatio.token2Amount}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-xs text-muted-foreground">Price Ratio</span>
                                                <span className="font-medium">
                                                    {initialTokenRatio.token1Amount && initialTokenRatio.token2Amount ?
                                                        `1 ${token1} = ${(initialTokenRatio.token2Amount / initialTokenRatio.token1Amount).toFixed(6)} ${token2}` :
                                                        "Not specified"}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">
                                            No initial pool ratio specified. The first liquidity provider will set the initial price.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* LP Token Metadata Card */}
                <Card className="overflow-hidden border-none shadow-md">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-3">
                        <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                                <ImageIconLucide className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">LP Token Metadata</CardTitle>
                                <CardDescription className="text-xs">
                                    Token information for your pool
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6 bg-slate-100/30 dark:bg-slate-900/30">
                        {metadataApiError ? (
                            <div className="flex items-center p-4 bg-destructive/15 border border-destructive/30 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-destructive mr-3" />
                                <div>
                                    <h4 className="font-medium text-destructive">Metadata Generation Failed</h4>
                                    <p className="text-sm text-destructive/80">
                                        There was a problem generating the LP token metadata. Please try again.
                                    </p>
                                </div>
                            </div>
                        ) : isGeneratingMetadata ? (
                            <div className="p-6 text-center">
                                <div className="flex flex-col items-center justify-center h-48">
                                    <Loader2 className="h-12 w-12 text-primary/30 animate-spin mb-4" />
                                    <p className="text-muted-foreground">Generating LP token metadata...</p>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        This may take a moment. We're creating your token information.
                                    </p>
                                </div>
                            </div>
                        ) : hasMetadata ? (
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="md:w-1/3 flex flex-col items-center justify-center">
                                    <div className="relative w-48 h-48 rounded-lg overflow-hidden bg-muted/50 border-2 border-muted/30 flex items-center justify-center">
                                        {metadata?.image ? (
                                            <img
                                                src={metadata.image}
                                                alt={metadata.name || "LP Token"}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                    const fallbackEl = document.createElement('div');
                                                    fallbackEl.className = 'text-4xl font-bold text-primary/40';
                                                    fallbackEl.textContent = lpTokenSymbol.substring(0, 2);
                                                    e.currentTarget.parentElement?.appendChild(fallbackEl);
                                                }}
                                            />
                                        ) : (
                                            <div className="text-4xl font-bold text-primary/40">
                                                {lpTokenSymbol.substring(0, 2)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center mt-4">
                                        <span className="inline-flex items-center bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full">
                                            <Check className="h-3 w-3 mr-1" /> Metadata Ready
                                        </span>
                                    </div>
                                </div>
                                <div className="md:w-2/3 space-y-4 p-4 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Token Name</p>
                                        <p className="text-lg font-medium">{metadata?.name || poolName}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Symbol</p>
                                        <p className="text-lg font-medium">{metadata?.symbol || lpTokenSymbol}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                                        <p className="text-sm">{metadata?.description || `Liquidity pool between ${token1} and ${token2}`}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="col-span-1">
                                            <p className="text-sm font-medium text-muted-foreground mb-1">Decimals</p>
                                            <p className="text-sm">{metadata?.decimals || 6}</p>
                                        </div>
                                        <div className="col-span-1">
                                            <p className="text-sm font-medium text-muted-foreground mb-1">Created</p>
                                            <p className="text-sm">{new Date().toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed rounded-lg bg-slate-50/20 dark:bg-slate-800/20">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <ImageIconLucide className="h-8 w-8 text-muted-foreground/60" />
                                </div>
                                <h3 className="text-lg font-medium mb-2">LP Token Metadata Required</h3>
                                <p className="text-center text-muted-foreground max-w-md mb-6">
                                    Before deploying your liquidity pool, you need to create metadata for your LP token.
                                    This makes your token compatible with wallets and explorers.
                                </p>
                                <Button
                                    onClick={onGenerateMetadata}
                                    size="lg"
                                    className="px-8"
                                >
                                    <Shield className="mr-2 h-5 w-5" />
                                    Create LP Token Metadata
                                </Button>

                                {/* Add a button to check for existing metadata */}
                                <Button
                                    variant="link"
                                    onClick={onRefreshMetadata} // Changed from onGenerateMetadata to onRefreshMetadata
                                    className="mt-2"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Check for Existing Metadata / Refresh
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Deployment Action Card */}
                <Card className="overflow-hidden border-none shadow-md">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-3">
                        <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                                <DollarSign className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Deployment Action</CardTitle>
                                <CardDescription className="text-xs">
                                    Final steps before deploying your pool
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6 bg-slate-100/30 dark:bg-slate-900/30">
                        <div className="space-y-4">
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-lg p-4 flex items-start space-x-3">
                                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <h4 className="font-medium mb-1">Ready to Deploy?</h4>
                                    <p className="text-sm text-muted-foreground mb-3">
                                        You're about to deploy a new liquidity pool contract to the Stacks blockchain.
                                        This action will:
                                    </p>
                                    <ul className="text-sm space-y-2 mb-3">
                                        <li className="flex items-center gap-x-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span>Deploy a new AMM liquidity pool for {token1}-{token2}</span>
                                        </li>
                                        <li className="flex items-center gap-x-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span>Create LP tokens that represent shares in the pool</span>
                                        </li>
                                        <li className="flex items-center gap-x-2">
                                            <Check className="h-4 w-4 text-green-500" />
                                            <span>Enable trading between {token1} and {token2} with {swapFee}% fee</span>
                                        </li>
                                    </ul>
                                    <p className="text-sm font-medium">
                                        Deployment requires STX for transaction fees.
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between pt-6">
                                <Button
                                    variant="outline"
                                    onClick={onPrevious}
                                    className="gap-x-2"
                                >
                                    <ChevronRight className="h-4 w-4 rotate-180" />
                                    <span>Previous Step</span>
                                </Button>
                                <Button
                                    onClick={onDeploy}
                                    disabled={isDeploying || isGeneratingMetadata || !hasMetadata}
                                    className="min-w-[200px] gap-x-2"
                                    size="lg"
                                >
                                    {isDeploying ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Deploying...</span>
                                        </>
                                    ) : !hasMetadata ? (
                                        <span>Create Metadata First</span>
                                    ) : (
                                        <>
                                            <Layers className="h-5 w-5" />
                                            <span>Deploy Pool</span>
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}; 