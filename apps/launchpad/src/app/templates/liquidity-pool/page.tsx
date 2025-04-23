"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useApp } from "@/lib/context/app-context";
import { ArrowLeft, HelpCircle, Layers, ExternalLink, Search, X } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { truncateAddress } from "@/lib/utils";
import { generateLiquidityPoolContract, LiquidityPoolOptions } from "@/lib/templates/liquidity-pool-contract-template";
import { TokenMetadata } from "@/lib/metadata-service";
import {
    Loader2,
    Image as ImageIconLucide,
    CircleDot,
    Check,
    ChevronRight,
    DollarSign,
    Percent,
    AlertTriangle,
    Info,
    RefreshCw,
    Shield
} from "lucide-react";
import { PostCondition } from "@stacks/connect/dist/types/methods";
import { Pc } from "@stacks/transactions";


// Metadata constants
const METADATA_BASE_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3008'
    : 'https://charisma-metadata.vercel.app';
const METADATA_API_URL = `${METADATA_BASE_URL}/api/v1/metadata`;

// Token API URL
const TOKEN_API_BASE_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://token-cache.charisma.xyz'; // Replace with your actual production URL
const TOKEN_API_URL = `${TOKEN_API_BASE_URL}/api/v1/sip10`;

// Wizard steps
enum WizardStep {
    SELECT_TOKENS = 0,
    CONFIGURE_POOL = 1,
    INITIALIZE_POOL = 2,
    REVIEW_DEPLOY = 3,
}

// Token type
interface Token {
    symbol: string;
    name: string;
    address: string;
    description?: string;
    image?: string;
    decimals?: number;
}

// Enhanced Token interface
interface EnhancedToken extends Token {
    contract_principal?: string;
}

// Contract Stepper Component
const ContractStepper = ({ currentStep }: { currentStep: WizardStep }) => {
    return (
        <div className="mb-8 flex items-center justify-between">
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.SELECT_TOKENS ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.SELECT_TOKENS ? <Check className="h-5 w-5" /> : "1"}
                </div>
                <span className="text-xs mt-2">Select Tokens</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.CONFIGURE_POOL ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.CONFIGURE_POOL ? <Check className="h-5 w-5" /> : "2"}
                </div>
                <span className="text-xs mt-2">Configure Pool</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.INITIALIZE_POOL ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.INITIALIZE_POOL ? <Check className="h-5 w-5" /> : "3"}
                </div>
                <span className="text-xs mt-2">Initialize</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.REVIEW_DEPLOY ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.REVIEW_DEPLOY ? <Check className="h-5 w-5" /> : "4"}
                </div>
                <span className="text-xs mt-2">Review & Deploy</span>
            </div>
        </div>
    );
};

// Token Selection Step Component
const TokenSelectionStep = ({
    onSelectToken1,
    onSelectToken2,
    token1Symbol,
    excludedToken,
    predefinedTokens,
    isLoadingTokens,
    tokenLoadError
}: {
    onSelectToken1: (token: string, address: string) => void;
    onSelectToken2: (token: string, address: string) => void;
    token1Symbol: string;
    excludedToken?: string;
    predefinedTokens: Token[];
    isLoadingTokens: boolean;
    tokenLoadError: string | null;
}) => {
    const [selectingToken2, setSelectingToken2] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customAddress, setCustomAddress] = useState("");
    const [customError, setCustomError] = useState<string | null>(null);

    // Custom token fetch state
    const [isFetchingToken, setIsFetchingToken] = useState(false);
    const [fetchedToken, setFetchedToken] = useState<EnhancedToken | null>(null);

    // Token list state
    const [filteredTokens, setFilteredTokens] = useState<EnhancedToken[]>(predefinedTokens as EnhancedToken[]);
    const [searchQuery, setSearchQuery] = useState("");

    // Function to fetch token metadata by contract ID
    const fetchTokenMetadata = async (contractId: string) => {
        if (!contractId.trim()) {
            setCustomError("Contract address is required");
            return;
        }

        // Basic validation for Stacks contract address format
        if (!/^[A-Z0-9]+\.[a-zA-Z0-9-]+$/.test(contractId)) {
            setCustomError("Invalid contract address format. Should be like: SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token");
            return;
        }

        setCustomError(null);
        setIsFetchingToken(true);

        try {
            // Fetch token data from the API
            const response = await fetch(`${TOKEN_API_BASE_URL}/api/v1/sip10/${contractId}`);

            if (!response.ok) {
                throw new Error(response.status === 404
                    ? 'Token not found. Please verify the contract address.'
                    : 'Failed to fetch token data');
            }

            const tokenData = await response.json();
            // Check if data has a nested 'data' property (API response format)
            const tokenInfo = tokenData.data || tokenData;

            // Format the response into our token format
            const enhancedToken: EnhancedToken = {
                symbol: tokenInfo.symbol || 'Unknown',
                name: tokenInfo.name || tokenInfo.symbol || 'Unknown Token',
                address: contractId,
                description: tokenInfo.description || `${tokenInfo.symbol || 'Custom'} token`,
                image: tokenInfo.image || tokenInfo.image_uri || '',
                contract_principal: contractId,
                decimals: tokenInfo.decimals || 6
            };

            setFetchedToken(enhancedToken);
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            setCustomError(error instanceof Error ? error.message : 'Failed to fetch token data');
            setFetchedToken(null);
        } finally {
            setIsFetchingToken(false);
        }
    };

    // Update filtered tokens when predefinedTokens change
    useEffect(() => {
        setFilteredTokens(predefinedTokens as EnhancedToken[]);
    }, [predefinedTokens]);

    // Filter tokens based on search query
    useEffect(() => {
        if (!searchQuery) {
            setFilteredTokens(predefinedTokens as EnhancedToken[]);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = (predefinedTokens as EnhancedToken[]).filter(
            token =>
                token.symbol.toLowerCase().includes(query) ||
                token.name.toLowerCase().includes(query) ||
                token.address.toLowerCase().includes(query)
        );

        setFilteredTokens(filtered);
    }, [searchQuery, predefinedTokens]);

    const handleCustomSubmit = () => {
        if (!fetchedToken) {
            setCustomError("Please fetch a valid token first");
            return;
        }

        setCustomError(null);

        // Call the appropriate select function based on which step we're on
        if (!selectingToken2) {
            onSelectToken1(fetchedToken.symbol, fetchedToken.address);
            setSelectingToken2(true);
        } else {
            onSelectToken2(fetchedToken.symbol, fetchedToken.address);
        }

        // Reset the custom input state
        setShowCustomInput(false);
        setCustomAddress("");
        setFetchedToken(null);
    };

    const handleCancelCustom = () => {
        setShowCustomInput(false);
        setCustomAddress("");
        setCustomError(null);
        setFetchedToken(null);
    };

    return (
        <div className="space-y-8">
            {!selectingToken2 ? (
                <>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Select First Token</h2>
                        <p className="text-muted-foreground">Choose the first token for your liquidity pool</p>
                    </div>

                    {/* Search Bar */}
                    {!showCustomInput && (
                        <div className="relative mx-auto max-w-md mb-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 pr-8"
                                    placeholder="Search tokens..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <X
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                                        onClick={() => setSearchQuery("")}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {showCustomInput ? (
                        <Card className="p-6">
                            <h3 className="font-medium mb-4">Enter Custom Token Details</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customAddress">Token Contract ID</Label>
                                    <Input
                                        id="customAddress"
                                        value={customAddress}
                                        onChange={(e) => {
                                            setCustomAddress(e.target.value);
                                            setCustomError(null);
                                            setFetchedToken(null);
                                        }}
                                        placeholder="e.g. SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.token-name"
                                    />
                                </div>

                                <div>
                                    <Button
                                        onClick={() => fetchTokenMetadata(customAddress)}
                                        disabled={isFetchingToken || !customAddress.trim()}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {isFetchingToken ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Fetching Token...
                                            </>
                                        ) : (
                                            <>Fetch Token Details</>
                                        )}
                                    </Button>
                                </div>

                                {fetchedToken && (
                                    <div className="border rounded-md p-4 bg-muted/10 space-y-3">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-3 overflow-hidden">
                                                {fetchedToken.image ? (
                                                    <img
                                                        src={fetchedToken.image}
                                                        alt={fetchedToken.symbol}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '';
                                                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="text-sm font-bold text-primary/60">${fetchedToken.symbol.charAt(0)}</div>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="text-sm font-bold text-primary/60">{fetchedToken.symbol.charAt(0)}</div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{fetchedToken.symbol}</h4>
                                                <p className="text-sm text-muted-foreground">{fetchedToken.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            <span className="block mb-1">Contract ID:</span>
                                            <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">{fetchedToken.address}</span>
                                        </div>
                                    </div>
                                )}

                                {customError && (
                                    <div className="text-destructive text-sm pt-1">{customError}</div>
                                )}

                                <div className="flex justify-end space-x-2 pt-2">
                                    <Button variant="outline" onClick={handleCancelCustom}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCustomSubmit}
                                        disabled={!fetchedToken}
                                    >
                                        Use Custom Token
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div>
                            {isLoadingTokens ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : tokenLoadError ? (
                                <div className="text-center text-destructive mb-4">
                                    {tokenLoadError}
                                </div>
                            ) : filteredTokens.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No tokens found. Try a different search.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {filteredTokens.map((token) => (
                                        <Card
                                            key={token.address + token.symbol}
                                            className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                                            onClick={() => {
                                                onSelectToken1(token.symbol, token.address);
                                                setSelectingToken2(true);
                                            }}
                                        >
                                            <div className="p-6 flex flex-col items-center">
                                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 overflow-hidden">
                                                    {token.image ? (
                                                        <img
                                                            src={token.image}
                                                            alt={token.symbol}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = '';
                                                                (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-8 h-8 text-primary/60">${token.symbol.charAt(0)}</div>`;
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 font-bold text-primary/60 flex items-center justify-center">
                                                            {token.symbol.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                <h3 className="font-medium">{token.symbol}</h3>
                                                <p className="text-sm text-muted-foreground truncate max-w-full">{token.name}</p>
                                            </div>
                                        </Card>
                                    ))}
                                    <Card className="cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setShowCustomInput(true)}
                                    >
                                        <div className="p-6 flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                                <HelpCircle className="w-8 h-8 text-primary/60" />
                                            </div>
                                            <h3 className="font-medium">Custom Token</h3>
                                            <p className="text-sm text-muted-foreground">Use another SIP-10 token</p>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">Select Second Token</h2>
                        <p className="text-muted-foreground">Choose the second token for your {token1Symbol} liquidity pool</p>
                    </div>

                    {/* Search Bar for Second Token */}
                    {!showCustomInput && (
                        <div className="relative mx-auto max-w-md mb-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 pr-8"
                                    placeholder="Search tokens..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {searchQuery && (
                                    <X
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                                        onClick={() => setSearchQuery("")}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {showCustomInput ? (
                        <Card className="p-6">
                            <h3 className="font-medium mb-4">Enter Custom Token Details</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="customAddress">Token Contract ID</Label>
                                    <Input
                                        id="customAddress"
                                        value={customAddress}
                                        onChange={(e) => {
                                            setCustomAddress(e.target.value);
                                            setCustomError(null);
                                            setFetchedToken(null);
                                        }}
                                        placeholder="e.g. SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.token-name"
                                    />
                                </div>

                                <div>
                                    <Button
                                        onClick={() => fetchTokenMetadata(customAddress)}
                                        disabled={isFetchingToken || !customAddress.trim()}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        {isFetchingToken ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Fetching Token...
                                            </>
                                        ) : (
                                            <>Fetch Token Details</>
                                        )}
                                    </Button>
                                </div>

                                {fetchedToken && (
                                    <div className="border rounded-md p-4 bg-muted/10 space-y-3">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mr-3 overflow-hidden">
                                                {fetchedToken.image ? (
                                                    <img
                                                        src={fetchedToken.image}
                                                        alt={fetchedToken.symbol}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-xs font-medium">${fetchedToken.symbol.charAt(0)}</span>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <span className="text-xs font-medium">{fetchedToken.symbol.charAt(0)}</span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-medium">{fetchedToken.symbol}</h4>
                                                <p className="text-sm text-muted-foreground">{fetchedToken.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            <span className="block mb-1">Contract ID:</span>
                                            <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">{fetchedToken.address}</span>
                                        </div>
                                    </div>
                                )}

                                {customError && (
                                    <div className="text-destructive text-sm pt-1">{customError}</div>
                                )}

                                <div className="flex justify-end space-x-2 pt-2">
                                    <Button variant="outline" onClick={handleCancelCustom}>
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleCustomSubmit}
                                        disabled={!fetchedToken}
                                    >
                                        Use Custom Token
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <div>
                            {isLoadingTokens ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : tokenLoadError ? (
                                <div className="text-center text-destructive mb-4">
                                    {tokenLoadError}
                                </div>
                            ) : filteredTokens.filter(token => token.symbol !== excludedToken).length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">No tokens found. Try a different search.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {filteredTokens
                                        .filter((token) => token.symbol !== excludedToken)
                                        .map((token) => (
                                            <Card
                                                key={token.address + token.symbol}
                                                className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                                                onClick={() => onSelectToken2(token.symbol, token.address)}
                                            >
                                                <div className="p-6 flex flex-col items-center">
                                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 overflow-hidden">
                                                        {token.image ? (
                                                            <img
                                                                src={token.image}
                                                                alt={token.symbol}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    const fallbackEl = document.createElement('div');
                                                                    fallbackEl.className = 'text-4xl font-bold text-primary/40';
                                                                    fallbackEl.textContent = token.symbol.charAt(0);
                                                                    e.currentTarget.parentElement?.appendChild(fallbackEl);
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="text-4xl font-bold text-primary/40">
                                                                {token.symbol.charAt(0)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h3 className="font-medium">{token.symbol}</h3>
                                                    <p className="text-sm text-muted-foreground truncate max-w-full">{token.name}</p>
                                                </div>
                                            </Card>
                                        ))}
                                    <Card className="cursor-pointer hover:border-primary/50 transition-colors"
                                        onClick={() => setShowCustomInput(true)}
                                    >
                                        <div className="p-6 flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                                <HelpCircle className="w-8 h-8 text-primary/60" />
                                            </div>
                                            <h3 className="font-medium">Custom Token</h3>
                                            <p className="text-sm text-muted-foreground">Use another SIP-10 token</p>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="text-center">
                        <Button
                            variant="outline"
                            onClick={() => setSelectingToken2(false)}
                        >
                            Change First Token
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
};

// Pool Configuration Step Component
const PoolConfigStep = ({
    poolName,
    onPoolNameChange,
    swapFee,
    onSwapFeeChange,
    token1,
    token2,
    errors,
    onPrevious,
    onNext
}: {
    poolName: string;
    onPoolNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    swapFee: string;
    onSwapFeeChange: (value: string) => void;
    token1: string;
    token2: string;
    errors: Record<string, string>;
    onPrevious: () => void;
    onNext: () => void;
}) => {
    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Pool Configuration</CardTitle>
                <CardDescription>
                    Set the core properties of your {token1}-{token2} liquidity pool
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="poolName">
                        Pool Name
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 ml-1 inline-block text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-80">
                                        The name of your liquidity pool
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </Label>
                    <Input
                        id="poolName"
                        value={poolName}
                        onChange={onPoolNameChange}
                        placeholder={`${token1}-${token2} Liquidity Pool`}
                        className={errors.poolName ? "border-destructive" : ""}
                    />
                    {errors.poolName && (
                        <p className="text-destructive text-sm">{errors.poolName}</p>
                    )}
                </div>

                {/* Swap Fee */}
                <div className="space-y-2">
                    <div className="flex items-center">
                        <Label htmlFor="swapFee">Swap Fee (%)</Label>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-5 w-5 p-0 ml-1"
                                    >
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="sr-only">Info</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-80">
                                        The fee charged on swaps, which is distributed to liquidity providers. Common values: 0.3% (standard), 0.1% (stable pairs), 1% (exotic pairs)
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Select
                        value={swapFee}
                        onValueChange={onSwapFeeChange}
                    >
                        <SelectTrigger className={errors.swapFee ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select swap fee" />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                            <SelectItem value="0.1">0.1% (Stable pairs)</SelectItem>
                            <SelectItem value="0.3">0.3% (Standard)</SelectItem>
                            <SelectItem value="1.0">1.0% (Exotic pairs)</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.swapFee && (
                        <p className="text-destructive text-sm">{errors.swapFee}</p>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={onPrevious}>
                    Back
                </Button>
                <Button onClick={onNext}>
                    Continue to Review
                </Button>
            </CardFooter>
        </Card>
    );
};

// Review and Deploy Step Component
const ReviewDeployStep = ({
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

                            <div>
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
                                    onClick={onGenerateMetadata}
                                    className="mt-2"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Check for Existing Metadata
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

// Initial Pool Ratio Configuration Step Component
const InitializePoolStep = ({
    token1,
    token2,
    initialTokenRatio,
    onUpdateRatio,
    onPrevious,
    onNext
}: {
    token1: string;
    token2: string;
    initialTokenRatio: {
        token1Amount: number;
        token2Amount: number;
        useRatio: boolean;
    };
    onUpdateRatio: (ratio: {
        token1Amount: number;
        token2Amount: number;
        useRatio: boolean;
    }) => void;
    onPrevious: () => void;
    onNext: () => void;
}) => {
    const [token1Amount, setToken1Amount] = useState(initialTokenRatio.token1Amount.toString());
    const [token2Amount, setToken2Amount] = useState(initialTokenRatio.token2Amount.toString());
    const [useRatio, setUseRatio] = useState(initialTokenRatio.useRatio);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (useRatio) {
            if (token1Amount && isNaN(parseFloat(token1Amount))) {
                newErrors.token1Amount = "Must be a valid number";
            }

            if (token2Amount && isNaN(parseFloat(token2Amount))) {
                newErrors.token2Amount = "Must be a valid number";
            }

            if (parseFloat(token1Amount) <= 0 && parseFloat(token2Amount) <= 0) {
                newErrors.general = "At least one token amount must be greater than zero";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateForm()) {
            onUpdateRatio({
                token1Amount: useRatio ? Math.max(0, parseFloat(token1Amount) || 0) : 0,
                token2Amount: useRatio ? Math.max(0, parseFloat(token2Amount) || 0) : 0,
                useRatio
            });
            onNext();
        }
    };

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Initial Pool Ratio</CardTitle>
                <CardDescription>
                    Set the initial ratio between {token1} and {token2} for your liquidity pool
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                    <Switch
                        id="useInitialRatio"
                        checked={useRatio}
                        onCheckedChange={setUseRatio}
                    />
                    <Label htmlFor="useInitialRatio">Initialize the pool with an initial token ratio</Label>
                </div>

                {useRatio && (
                    <div className="space-y-4 pt-4">
                        <div className="border rounded-md p-4 bg-muted/10">
                            <p className="text-sm text-muted-foreground mb-4">
                                Providing initial liquidity allows you to set the starting price ratio for your pool.
                                This affects the initial swap rate between the two tokens.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="token1Amount">
                                        Initial {token1} Amount
                                    </Label>
                                    <div className="flex">
                                        <Input
                                            id="token1Amount"
                                            value={token1Amount}
                                            onChange={(e) => setToken1Amount(e.target.value)}
                                            placeholder="0"
                                            type="number"
                                            min="0"
                                            className={errors.token1Amount ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {errors.token1Amount && (
                                        <p className="text-destructive text-sm">{errors.token1Amount}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="token2Amount">
                                        Initial {token2} Amount
                                    </Label>
                                    <div className="flex">
                                        <Input
                                            id="token2Amount"
                                            value={token2Amount}
                                            onChange={(e) => setToken2Amount(e.target.value)}
                                            placeholder="0"
                                            type="number"
                                            min="0"
                                            className={errors.token2Amount ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {errors.token2Amount && (
                                        <p className="text-destructive text-sm">{errors.token2Amount}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                            <p className="text-sm text-muted-foreground">
                                The contract will automatically transfer these token amounts from your wallet
                                during deployment. Make sure you have sufficient balance.
                            </p>
                        </div>

                        {errors.general && (
                            <p className="text-destructive text-sm">{errors.general}</p>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={onPrevious}>
                    Back
                </Button>
                <Button onClick={handleNext}>
                    Continue to Review
                </Button>
            </CardFooter>
        </Card>
    );
};

export default function LiquidityPoolDeployPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { authenticated, stxAddress, deployContract, signMessage } = useApp();
    const [isDeploying, setIsDeploying] = useState(false);
    const [txid, setTxid] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
    const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
    const [metadataApiError, setMetadataApiError] = useState(false);

    // Add more thorough check to ensure UI updates properly
    const [hasMetadataFlag, setHasMetadataFlag] = useState(false);

    // State for API-loaded tokens
    const [availableTokens, setAvailableTokens] = useState<EnhancedToken[]>([]);
    const [isLoadingTokens, setIsLoadingTokens] = useState(false);
    const [tokenLoadError, setTokenLoadError] = useState<string | null>(null);

    // Track token images separately from metadata
    const [token1Image, setToken1Image] = useState<string | undefined>(undefined);
    const [token2Image, setToken2Image] = useState<string | undefined>(undefined);

    // Add state for initial token ratio
    const [initialTokenRatio, setInitialTokenRatio] = useState({
        token1Amount: 0,
        token2Amount: 0,
        useRatio: false
    });

    // When metadata changes, ensure the hasMetadataFlag updates
    useEffect(() => {
        const isValid = !!metadata && !!metadata.name;
        console.log("Metadata changed:", metadata, "valid:", isValid);
        setHasMetadataFlag(isValid);
    }, [metadata]);

    // Use the state flag to determine if metadata is present
    const hasMetadata = hasMetadataFlag;

    // Wizard step state
    const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SELECT_TOKENS);

    // Navigation functions
    const nextStep = () => {
        if (currentStep < WizardStep.REVIEW_DEPLOY) {
            // If moving to the review step, check if metadata exists
            if (currentStep === WizardStep.CONFIGURE_POOL &&
                contractIdentifier &&
                !hasMetadata &&
                !isGeneratingMetadata) {
                checkExistingMetadata();
            }
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > WizardStep.SELECT_TOKENS) {
            setCurrentStep(currentStep - 1);
        }
    };

    // Form state
    const [poolName, setPoolName] = useState("");
    const [lpTokenSymbol, setLpTokenSymbol] = useState("");
    const [token1, setToken1] = useState("STX");
    const [token1Address, setToken1Address] = useState(
        "SP000000000000000000002Q6VF78.stx-token"
    );
    const [token2, setToken2] = useState("");
    const [token2Address, setToken2Address] = useState("");
    const [swapFee, setSwapFee] = useState("0.3");

    // Generate contract name from pool name
    const generateContractName = (name: string) => {
        if (!name) return '';

        // First, convert to lowercase, replace spaces with hyphens, and remove special characters
        let baseName = name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        // If needed, prepend 'pool-' prefix for names starting with numbers
        baseName = baseName.replace(/^(\d)/, 'pool-$1');

        // Strip off any existing -amm, -lp, -pool, etc. suffixes to avoid duplication
        baseName = baseName
            .replace(/-liquidity-pool$/, '')
            .replace(/-pool$/, '')
            .replace(/-lp$/, '')
            .replace(/-amm$/, '');

        // Add the standard suffix
        return `${baseName}-amm-lp-v1`;
    };

    // Get contract name from pool name
    const contractName = generateContractName(poolName) || 'amm-pool';

    // Automatically generate LP token symbol if not set
    const effectiveLpTokenSymbol = lpTokenSymbol ||
        (token1 && token2 ? `${token1}-${token2}-LP` : 'LP');

    // Full contract identifier
    const contractIdentifier = stxAddress ? `${stxAddress}.${contractName}` : '';

    // Form validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!poolName.trim()) {
            newErrors.poolName = "Pool name is required";
        }

        if (!token1.trim()) {
            newErrors.token1 = "First token is required";
        }

        if (!token1Address.trim()) {
            newErrors.token1Address = "First token address is required";
        }

        if (!token2.trim()) {
            newErrors.token2 = "Second token is required";
        }

        if (!token2Address.trim()) {
            newErrors.token2Address = "Second token address is required";
        } else if (token1Address === token2Address) {
            newErrors.token2Address = "Both tokens cannot be the same";
        }

        if (!swapFee.trim()) {
            newErrors.swapFee = "Swap fee is required";
        } else {
            const feeValue = parseFloat(swapFee);
            if (isNaN(feeValue) || feeValue < 0 || feeValue > 5) {
                newErrors.swapFee = "Swap fee must be between 0% and 5%";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Add a function to fetch token metadata for specific tokens
    // Function to fetch specific token metadata
    const fetchTokenMetadata = async (contractId: string) => {
        try {
            const response = await fetch(`${TOKEN_API_URL}/${contractId}`);

            if (!response.ok) {
                console.error(`Failed to fetch token metadata for ${contractId}:`, response.status);
                return null;
            }

            const data = await response.json();

            // Check if data has a nested 'data' property (API response format)
            const tokenData = data.data || data;

            console.log("Raw token data from API:", tokenData);

            return {
                symbol: tokenData.symbol || 'Unknown',
                name: tokenData.name || tokenData.symbol || 'Unknown Token',
                address: tokenData.contract_principal || contractId,
                description: tokenData.description || `${tokenData.symbol || 'Unknown'} token`,
                image: tokenData.image || tokenData.image_uri || '',
                contract_principal: tokenData.contract_principal || contractId,
                decimals: tokenData.decimals,
                identifier: tokenData.identifier
            };
        } catch (error) {
            console.error(`Error fetching token metadata for ${contractId}:`, error);
            return null;
        }
    };

    // Update the deployment function to fetch and use metadata
    const handleDeploy = async () => {
        if (!hasMetadata) {
            toast({
                variant: "destructive",
                title: "Metadata Required",
                description: "Metadata has not been generated yet. Please wait or refresh metadata.",
            });
            return;
        }

        if (!authenticated) {
            toast({
                variant: "destructive",
                title: "Authentication Required",
                description: "Please connect your wallet to deploy a contract.",
            });
            return;
        }

        if (!validateForm()) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please fix the form errors before deploying.",
            });
            return;
        }

        try {
            setIsDeploying(true);

            // Fetch exact token metadata for both tokens to get accurate decimal information
            setIsDeploying(true);
            toast({
                title: "Preparing Deployment",
                description: "Fetching token information...",
            });

            // Fetch token metadata to get accurate decimal information
            const [token1Metadata, token2Metadata] = await Promise.all([
                fetchTokenMetadata(token1Address),
                fetchTokenMetadata(token2Address)
            ]);

            // Extract token decimals with fallbacks
            // NEVER assume decimal places - always use verified metadata
            if (!token1Metadata || !token2Metadata) {
                throw new Error("Failed to fetch token metadata. Cannot proceed without verified token information.");
            }

            const tokenADecimals = token1Metadata?.decimals;
            const tokenBDecimals = token2Metadata?.decimals;
            // LP tokens typically use 6 decimals, but should be configurable if needed
            const lpTokenDecimals = 6;

            // Log the token information for debugging
            console.log("Token A metadata:", token1Metadata);
            console.log("Token B metadata:", token2Metadata);
            console.log("Using token decimals:", { tokenADecimals, tokenBDecimals, lpTokenDecimals });

            // Check if tokens are STX
            const isToken1Stx = token1Address.includes('stx-token');
            const isToken2Stx = token2Address.includes('stx-token');

            // Ensure we have initial liquidity values (use 0 if not enabled)
            const token1Amount = initialTokenRatio.useRatio ? initialTokenRatio.token1Amount : 0;
            const token2Amount = initialTokenRatio.useRatio ? initialTokenRatio.token2Amount : 0;

            // Generate the liquidity pool contract code
            const contractCode = generateLiquidityPoolContract({
                tokenA: token1Address,
                tokenB: token2Address,
                lpTokenName: poolName,
                lpTokenSymbol: effectiveLpTokenSymbol,
                swapFee: Math.round(parseFloat(swapFee) * 10000), // Convert percentage to integer parts per million
                isTokenAStx: isToken1Stx,
                isTokenBStx: isToken2Stx,
                initialLiquidityA: token1Amount,
                initialLiquidityB: token2Amount,
                tokenADecimals,
                tokenBDecimals,
                contractIdentifier,
            });

            // Calculate the total liquidity amounts for post-conditions
            const totalTokenAAmount = initialTokenRatio.useRatio
                ? initialTokenRatio.token1Amount * Math.pow(10, tokenADecimals)
                : 0;
            const totalTokenBAmount = initialTokenRatio.useRatio
                ? initialTokenRatio.token2Amount * Math.pow(10, tokenBDecimals)
                : 0;

            // Create post-conditions array
            const postConditions: PostCondition[] = [];

            // Log to inform the user about token transfers
            if (initialTokenRatio.useRatio) {
                // Create a user-friendly message about token requirements
                let tokenRequirementsMessage = "Contract will transfer: ";

                if (totalTokenAAmount > 0) {
                    tokenRequirementsMessage += `${initialTokenRatio.token1Amount} ${token1}`;
                    if (totalTokenBAmount > 0) tokenRequirementsMessage += " and ";

                    console.log("Adding post-condition for token A", {
                        sender: stxAddress,
                        amount: totalTokenAAmount,
                        contractId: token1Address,
                        identifier: token1Metadata.identifier
                    });
                    // Add post-condition for token A
                    postConditions.push(
                        isToken1Stx
                            ? Pc.principal(stxAddress!).willSendEq(totalTokenAAmount).ustx() as any
                            : Pc.principal(stxAddress!).willSendEq(totalTokenAAmount).ft(token1Address as any, token1Metadata.identifier) as any
                    );
                }

                if (totalTokenBAmount > 0) {
                    tokenRequirementsMessage += `${initialTokenRatio.token2Amount} ${token2}`;

                    // Add post-condition for token B
                    postConditions.push(
                        isToken2Stx
                            ? Pc.principal(stxAddress!).willSendEq(totalTokenBAmount).ustx() as any
                            : Pc.principal(stxAddress!).willSendEq(totalTokenBAmount).ft(token2Address as any, token2Metadata.identifier) as any
                    );
                }

                // Show a toast to inform the user
                toast({
                    title: "Token Requirements",
                    description: tokenRequirementsMessage + ". Make sure you have sufficient balance.",
                });
            }

            // Deploy the contract with post-conditions
            const deployOptions = postConditions.length > 0 ? { postConditions } : undefined;
            const result = await deployContract(contractCode, contractName, deployOptions);

            setTxid(result.txid);

            toast({
                title: "Deployment Initiated",
                description:
                    `Your liquidity pool deployment has been initiated with transaction ID: ${result.txid.substring(0, 10)}...`,
            });

            // Redirect to contracts page after successful deployment
            router.push(`/contracts?txid=${result.txid}`);
        } catch (error) {
            console.error("Deployment error:", error);
            toast({
                variant: "destructive",
                title: "Deployment Failed",
                description: error instanceof Error ? error.message : "There was an error deploying your pool. Please try again.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    const handlePoolNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPoolName(value);
    };

    // Function to check if metadata already exists for this contract
    const checkExistingMetadata = async () => {
        if (!contractIdentifier) return;

        try {
            console.log("Checking for existing metadata...");
            // Don't show loading state for this initial check
            const getResp = await fetch(`${METADATA_API_URL}/${contractIdentifier}`);
            if (getResp.ok) {
                const data = await getResp.json();
                if (data && data.name) {
                    console.log("Found existing metadata", data);
                    // Force the state update in a way that ensures UI re-renders
                    setTimeout(() => {
                        setMetadata(data);
                    }, 0);

                    // Show a short toast to inform the user metadata was found
                    toast({
                        title: "Metadata Found",
                        description: "Existing metadata was loaded. You can proceed with deployment.",
                    });
                    return true;
                }
            }
            console.log("No existing metadata found");
            return false;
        } catch (e) {
            console.error("Error checking existing metadata:", e);
            return false;
        }
    };

    // Function to generate metadata manually
    const generateMetadata = async () => {
        if (!token1Address || !token2Address || !poolName || !stxAddress) {
            toast({
                variant: "destructive",
                title: "Missing Information",
                description: "Please ensure you have selected both tokens and provided a pool name.",
            });
            return;
        }

        setIsGeneratingMetadata(true);
        setMetadataApiError(false);
        try {
            const contractId = contractIdentifier;

            // First, attempt to fetch existing metadata
            const getResp = await fetch(`${METADATA_API_URL}/${contractId}`);
            if (getResp.ok) {
                const data = await getResp.json();
                if (data && data.name) {
                    // Force the state update to ensure UI refreshes
                    setTimeout(() => {
                        setMetadata(data);
                    }, 0);
                    setIsGeneratingMetadata(false);
                    toast({
                        title: "Metadata Loaded",
                        description: "Existing metadata was found and loaded. You can proceed with deployment.",
                    });
                    return;
                }
            }

            // If not found (404), we generate it
            // Sign the contractId with wallet for authentication
            const { signature, publicKey } = await signMessage(contractId);

            const currentMetadata = {
                name: poolName,
                symbol: effectiveLpTokenSymbol,
                description: `Liquidity pool between ${token1} and ${token2}`,
                identifier: effectiveLpTokenSymbol,
                decimals: 6,
                properties: {
                    tokenAContract: token1Address,
                    tokenBContract: token2Address,
                    lpRebatePercent: parseFloat(swapFee),
                },
                imagePrompt: `Minimalist professional logo representing liquidity pool between ${token1} and ${token2}`
            };

            const resp = await fetch(`${METADATA_API_URL}/${contractId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': signature,
                    'x-public-key': publicKey
                },
                body: JSON.stringify(currentMetadata)
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.success && data.metadata) {
                    setMetadata(data.metadata);
                    toast({
                        title: "Metadata Generated",
                        description: "LP token metadata has been successfully created and saved.",
                    });
                } else {
                    throw new Error('Unexpected response structure');
                }
            } else {
                throw new Error('Metadata service responded with error');
            }
        } catch (e) {
            console.error('Metadata generation error', e);
            setMetadataApiError(true);
            toast({
                variant: "destructive",
                title: "Metadata Generation Failed",
                description: e instanceof Error ? e.message : "There was an error generating metadata. Please try again.",
            });
        } finally {
            setIsGeneratingMetadata(false);
        }
    };

    // Helper function to refresh metadata
    const refreshMetadata = () => {
        setMetadataApiError(false);

        // Verify the right conditions before triggering refresh
        const shouldGenerate = token1Address && token2Address && poolName && stxAddress;
        if (shouldGenerate) {
            // Clear existing metadata and regenerate
            setMetadata(null);
            generateMetadata();
        } else {
            toast({
                variant: "destructive",
                title: "Missing Information",
                description: "Please ensure you have selected both tokens and provided a pool name before refreshing.",
            });
        }
    };

    // Helper functions for token selection
    const handleSelectToken1 = (symbol: string, address: string) => {
        setToken1(symbol);
        setToken1Address(address);
        setToken1Image(findTokenImage(symbol, address));
        // Auto-generate pool name
        setPoolName(`${symbol} Liquidity Pool`);
    };

    const handleSelectToken2 = (symbol: string, address: string) => {
        setToken2(symbol);
        setToken2Address(address);
        setToken2Image(findTokenImage(symbol, address));
        // Update pool name to reflect the token pair
        setPoolName(`${token1}-${symbol} Liquidity Pool`);

        // Move to next step
        nextStep();
    };

    // Check metadata when the component mounts or when key dependencies change
    useEffect(() => {
        console.log("Checking metadata in useEffect", { currentStep, hasMetadata, isGeneratingMetadata });
        if (currentStep === WizardStep.REVIEW_DEPLOY &&
            contractIdentifier &&
            !hasMetadata &&
            !isGeneratingMetadata) {
            console.log("Auto-checking for metadata");
            checkExistingMetadata();
        }
    }, [currentStep, contractIdentifier, hasMetadataFlag, isGeneratingMetadata]);

    // Helper function to find a token's image from the token list
    const findTokenImage = (symbol: string, address: string): string | undefined => {
        // First look through the tokens by address
        const foundToken = availableTokens.find(t =>
            t.address.toLowerCase() === address.toLowerCase() ||
            t.symbol.toUpperCase() === symbol.toUpperCase()
        ) as (Token & { image?: string }) | undefined;

        // Check if the token and image property exist
        return foundToken?.image;
    };

    // Fetch tokens from the token-cache API
    useEffect(() => {
        const fetchTokens = async () => {
            setIsLoadingTokens(true);
            setTokenLoadError(null);

            try {
                // Fetch tokens from the token-cache API
                const response = await fetch(TOKEN_API_URL);

                if (!response.ok) {
                    throw new Error('Failed to fetch tokens');
                }

                const responseData = await response.json();
                // Check if the response has a data property that contains the tokens array
                const tokensArray = Array.isArray(responseData) ? responseData :
                    (responseData.data && Array.isArray(responseData.data) ? responseData.data : []);

                console.log("Tokens from API:", tokensArray);

                // Convert fetched tokens to EnhancedToken format
                const enhancedTokens: EnhancedToken[] = tokensArray.map((token: any) => ({
                    symbol: token.symbol || 'Unknown',
                    name: token.name || token.symbol || 'Unknown Token',
                    address: token.contract_principal || '',
                    description: token.description || `${token.symbol} token`,
                    image: token.image || token.image_uri || '',
                    contract_principal: token.contract_principal,
                    decimals: token.decimals || 6
                }));

                // Add default STX token if not present
                const hasStx = enhancedTokens.some(token =>
                    token.symbol === 'STX' ||
                    token.address.includes('stx-token')
                );

                if (!hasStx) {
                    enhancedTokens.unshift({
                        symbol: "STX",
                        name: "Stacks",
                        address: "SP000000000000000000002Q6VF78.stx-token",
                        description: "Native token of the Stacks blockchain",
                        decimals: 6
                    });
                }

                setAvailableTokens(enhancedTokens);
            } catch (error) {
                console.error('Error fetching tokens:', error);
                setTokenLoadError('Failed to load tokens. Using default list.');

                // Fallback to a minimal default list with at least STX
                setAvailableTokens([
                    {
                        symbol: "STX",
                        name: "Stacks",
                        address: "SP000000000000000000002Q6VF78.stx-token",
                        description: "Native token of the Stacks blockchain",
                        decimals: 6
                    }
                ]);
            } finally {
                setIsLoadingTokens(false);
            }
        };

        fetchTokens();
    }, []);

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
                        Please connect your wallet to deploy a liquidity pool.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-12">
            <Button
                variant="outline"
                className="mb-8"
                onClick={() => router.push("/templates")}
            >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Templates
            </Button>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Main Form */}
                <div className="flex-1">
                    <h1 className="text-3xl font-bold mb-6 flex items-center">
                        <Layers className="h-6 w-6 mr-2 text-primary" />
                        Deploy Liquidity Pool
                    </h1>
                    <p className="text-muted-foreground mb-8">
                        Configure your automated market maker liquidity pool. This will create a smart contract for swapping between two tokens.
                    </p>

                    <ContractStepper currentStep={currentStep} />

                    {/* Step content */}
                    {currentStep === WizardStep.SELECT_TOKENS && (
                        <TokenSelectionStep
                            onSelectToken1={handleSelectToken1}
                            onSelectToken2={handleSelectToken2}
                            token1Symbol={token1}
                            excludedToken={token1}
                            predefinedTokens={availableTokens}
                            isLoadingTokens={isLoadingTokens}
                            tokenLoadError={tokenLoadError}
                        />
                    )}

                    {currentStep === WizardStep.CONFIGURE_POOL && (
                        <PoolConfigStep
                            poolName={poolName}
                            onPoolNameChange={handlePoolNameChange}
                            swapFee={swapFee}
                            onSwapFeeChange={setSwapFee}
                            token1={token1}
                            token2={token2}
                            errors={errors}
                            onPrevious={prevStep}
                            onNext={nextStep}
                        />
                    )}

                    {currentStep === WizardStep.INITIALIZE_POOL && (
                        <InitializePoolStep
                            token1={token1}
                            token2={token2}
                            initialTokenRatio={initialTokenRatio}
                            onUpdateRatio={setInitialTokenRatio}
                            onPrevious={prevStep}
                            onNext={nextStep}
                        />
                    )}

                    {currentStep === WizardStep.REVIEW_DEPLOY && (
                        <ReviewDeployStep
                            poolName={poolName}
                            lpTokenSymbol={effectiveLpTokenSymbol}
                            token1={token1}
                            token2={token2}
                            swapFee={swapFee}
                            contractIdentifier={contractIdentifier}
                            isGeneratingMetadata={isGeneratingMetadata}
                            metadataApiError={metadataApiError}
                            hasMetadata={hasMetadata}
                            metadata={metadata}
                            isDeploying={isDeploying}
                            token1Image={token1Image}
                            token2Image={token2Image}
                            initialTokenRatio={initialTokenRatio}
                            onGenerateMetadata={generateMetadata}
                            onRefreshMetadata={refreshMetadata}
                            onPrevious={prevStep}
                            onDeploy={handleDeploy}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:w-80">
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle>Deployment Information</CardTitle>
                            <CardDescription>
                                Important details about your pool deployment
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-1">Deploying as</h3>
                                <p className="text-sm font-mono text-muted-foreground">
                                    {stxAddress ? truncateAddress(stxAddress) : 'Connect wallet'}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-1">Network</h3>
                                <p className="text-sm text-muted-foreground">Stacks Mainnet</p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-1">Deployment Cost</h3>
                                <p className="text-sm text-muted-foreground">~15,000 STX (estimated)</p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-1">Contract Type</h3>
                                <p className="text-sm text-muted-foreground">Liquidity Pool (AMM)</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t pt-6 flex flex-col items-start">
                            <h3 className="font-medium mb-2">Resources</h3>
                            <ul className="space-y-2 w-full">
                                <li>
                                    <a
                                        href="https://book.stacks.tools/defi/liquidity-pools"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm flex items-center text-primary hover:underline"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> Liquidity Pool Documentation
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
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
} 