"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useApp } from "@/lib/context/app-context";
import {
    ArrowLeft,
    HelpCircle,
    Layers,
    Network,
    ExternalLink,
    Search,
    X,
    Check,
    ArrowRight,
    Plus,
    Badge as BadgeIcon,
    AlertTriangle,
    Info,
    Loader2,
    Calculator,
    BarChart2,
    ChevronRight,
    FileText,
    Copy,
    DollarSign,
    Percent,
    RefreshCw,
    Shield,
    CircleDot,
    ChevronsUpDown,
    Trash,
    ArrowDown,
    AlertCircle
} from "lucide-react";
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
import { z } from "zod";
import { truncateAddress, cn } from "@/lib/utils";
import { generateSubnetLiquidityPool } from "@/lib/contract-generators/subnet-liquidity-pool";
import { TokenMetadata } from "@/lib/metadata-service";
import { PostCondition } from "@stacks/connect/dist/types/methods";
import { Pc } from "@stacks/transactions";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Alert,
    AlertDescription,
    AlertTitle
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    InfoIcon,
    Loader2 as UiLoader2,
    Plus as UiPlus,
    ArrowLeft as UiArrowLeft,
    ArrowRight as UiArrowRight,
    Check as UiCheck,
    X as UiX,
    Search as UiSearch,
    Copy as UiCopy,
    FileText as UiFileText,
    AlertTriangle as UiAlertTriangle,
    Info as UiInfo,
    RefreshCw as UiRefreshCw,
    Shield as UiShield,
    CircleDot as UiCircleDot,
    DollarSign as UiDollarSign,
    Percent as UiPercent,
    Network as UiNetwork,
    Circle as UiCircle,
    Wrench as UiSwitch,
    Badge as UiBadge,
} from "lucide-react";

// Metadata constants
const METADATA_BASE_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3008'
    : 'https://charisma-metadata.vercel.app';
const METADATA_API_URL = `${METADATA_BASE_URL}/api/v1/metadata`;

// Token API URL
const TOKEN_API_BASE_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://charisma-token-cache.vercel.app';
const TOKEN_API_URL = `${TOKEN_API_BASE_URL}/api/v1/sip10`;

// Wizard steps
enum WizardStep {
    SELECT_TOKENS = 0,
    CONFIGURE_POOL = 1,
    PREVIEW_CODE = 2,
    DEPLOY = 3,
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
    is_subnet?: boolean;
}

// Form validation schema
const formSchema = z.object({
    tokenA: z.string().min(1, "Token A is required"),
    tokenB: z.string().min(1, "Token B is required"),
    poolName: z.string().min(1, "Pool name is required"),
    lpTokenSymbol: z.string().min(1, "LP token symbol is required"),
    swapFee: z.string().min(1, "Swap fee is required"),
    enableLimitOrders: z.boolean().default(false),
    enableDCA: z.boolean().default(false),
    enablePerps: z.boolean().default(false),
    initialPrice: z.number().min(0.000001, "Initial price must be greater than 0"),
    minPrice: z.number().min(0.000001, "Min price must be greater than 0"),
    maxPrice: z.number().min(0.000001, "Max price must be greater than 0"),
    feeTier: z.number().min(1, "Fee tier is required"),
    token1Amount: z.number().min(0.000001, "Amount must be greater than 0"),
    token2Amount: z.number().min(0.000001, "Amount must be greater than 0"),
});

type FormValues = z.infer<typeof formSchema>;

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
                    ${currentStep >= WizardStep.PREVIEW_CODE ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.PREVIEW_CODE ? <Check className="h-5 w-5" /> : "3"}
                </div>
                <span className="text-xs mt-2">Preview Code</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.DEPLOY ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.DEPLOY ? <Check className="h-5 w-5" /> : "4"}
                </div>
                <span className="text-xs mt-2">Deploy</span>
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
            // Create a simplified token object for manual entry
            // For testing, we'll assume any custom token is a subnet token
            const tokenParts = contractId.split('.');
            const symbol = tokenParts.length > 1 ? tokenParts[1].toUpperCase().replace(/-/g, '') : 'TOKEN';
            const name = tokenParts.length > 1 ?
                tokenParts[1].split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') :
                'Custom Token';

            const enhancedToken: EnhancedToken = {
                symbol: symbol,
                name: name,
                address: contractId,
                description: `${name} Subnet Token`,
                contract_principal: contractId,
                decimals: 6,
                is_subnet: true  // Assume it's a subnet token
            };

            setFetchedToken(enhancedToken);
        } catch (error) {
            console.error('Error creating token metadata:', error);
            setCustomError(error instanceof Error ? error.message : 'Failed to create token');
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
                        <h2 className="text-2xl font-bold mb-2">Select First Subnet Token</h2>
                        <p className="text-muted-foreground">Choose the first token for your subnet liquidity pool</p>
                    </div>

                    {/* Search Bar */}
                    {!showCustomInput && (
                        <div className="relative mx-auto max-w-md mb-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 pr-8"
                                    placeholder="Search subnet tokens..."
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
                            <h3 className="font-medium mb-4">Enter Custom Subnet Token Details</h3>
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
                                        placeholder="e.g. SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.subnet-token"
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
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3 overflow-hidden">
                                                <Network className="h-5 w-5 text-primary/70" />
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
                                        <div className="flex">
                                            <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                                                <Check className="h-3 w-3 mr-1" />
                                                Subnet Token
                                            </span>
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
                                    <p className="text-muted-foreground">No subnet tokens found. Try a different search.</p>
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
                                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 overflow-hidden">
                                                    <Network className="w-8 h-8 text-primary/60" />
                                                </div>
                                                <h3 className="font-medium">{token.symbol}</h3>
                                                <p className="text-sm text-muted-foreground truncate max-w-full">{token.name}</p>
                                                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full mt-2">
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Subnet
                                                </span>
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
                                            <p className="text-sm text-muted-foreground">Use another subnet token</p>
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
                        <h2 className="text-2xl font-bold mb-2">Select Second Subnet Token</h2>
                        <p className="text-muted-foreground">Choose the second token for your {token1Symbol} subnet liquidity pool</p>
                    </div>

                    {/* Search Bar for Second Token */}
                    {!showCustomInput && (
                        <div className="relative mx-auto max-w-md mb-4">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-8 pr-8"
                                    placeholder="Search subnet tokens..."
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
                            <h3 className="font-medium mb-4">Enter Custom Subnet Token Details</h3>
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
                                        placeholder="e.g. SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.subnet-token"
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
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3 overflow-hidden">
                                                <Network className="h-5 w-5 text-primary/70" />
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
                                        <div className="flex">
                                            <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                                                <Check className="h-3 w-3 mr-1" />
                                                Subnet Token
                                            </span>
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
                                    <p className="text-muted-foreground">No subnet tokens found. Try a different search.</p>
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
                                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 overflow-hidden">
                                                        <Network className="w-8 h-8 text-primary/60" />
                                                    </div>
                                                    <h3 className="font-medium">{token.symbol}</h3>
                                                    <p className="text-sm text-muted-foreground truncate max-w-full">{token.name}</p>
                                                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full mt-2">
                                                        <Check className="h-3 w-3 mr-1" />
                                                        Subnet
                                                    </span>
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
                                            <p className="text-sm text-muted-foreground">Use another subnet token</p>
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

// LiquidityConfigStep Component
const LiquidityConfigStep = ({
    formState,
    setFormState,
    token1Symbol,
    token2Symbol,
    onPreviousStep,
    onNextStep,
}: {
    formState: FormValues;
    setFormState: React.Dispatch<React.SetStateAction<FormValues>>;
    token1Symbol: string;
    token2Symbol: string;
    onPreviousStep: () => void;
    onNextStep: () => void;
}) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ...formState,
            // Ensure boolean values have defaults
            enableLimitOrders: false,
            enableDCA: false,
            enablePerps: false,
            // Ensure number values have defaults
            initialPrice: formState.initialPrice || 0,
            minPrice: formState.minPrice || 0,
            maxPrice: formState.maxPrice || 0,
            feeTier: formState.feeTier || 30,
            token1Amount: formState.token1Amount || 1,
            token2Amount: formState.token2Amount || 1,
        },
        mode: "onSubmit"
    });

    const [isLoading, setIsLoading] = useState(false);

    async function onSubmit(values: any) {
        setIsLoading(true);
        try {
            // Force advanced features to be disabled
            const updatedValues = {
                ...values,
                enableLimitOrders: false,
                enableDCA: false,
                enablePerps: false,
                // Ensure numeric values
                token1Amount: Number(values.token1Amount) || 1,
                token2Amount: Number(values.token2Amount) || 1,
                initialPrice: Number(values.initialPrice) || 0,
                minPrice: Number(values.minPrice) || 0,
                maxPrice: Number(values.maxPrice) || 0,
                feeTier: Number(values.feeTier) || 30,
            };
            setFormState(updatedValues);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
            onNextStep();
        } catch (error) {
            console.error("Form submission error:", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Configure Subnet Pool</h2>
                <p className="text-muted-foreground">Set pool parameters and initial liquidity</p>
            </div>

            <div>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pool Configuration</CardTitle>
                            <CardDescription>
                                Configure the basic parameters for your subnet liquidity pool
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="swapFee">Swap Fee</Label>
                                    <Select
                                        value={form.watch("swapFee")}
                                        onValueChange={(value: string) => form.setValue("swapFee", value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select swap fee" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-background">
                                            <SelectItem value="10">0.1% (Stable pairs)</SelectItem>
                                            <SelectItem value="30">0.3% (Standard)</SelectItem>
                                            <SelectItem value="100">1.0% (Exotic pairs)</SelectItem>
                                            <div className="relative py-1.5 pl-8 pr-2 text-sm flex items-center justify-between bg-muted/20 pointer-events-none opacity-60">
                                                <span>3.0% (Meme pairs)</span>
                                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">Pro</span>
                                            </div>
                                        </SelectContent>
                                    </Select>
                                    {form.formState.errors.swapFee && (
                                        <p className="text-sm text-destructive">{form.formState.errors.swapFee.message}</p>
                                    )}
                                    <p className="text-sm text-muted-foreground">Fee charged on swaps, distributed to liquidity providers</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="poolName">Custom Pool Name</Label>
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Pro</span>
                                    </div>
                                    <Input
                                        id="poolName"
                                        placeholder={`${formState.tokenA || 'Token1'}-${formState.tokenB || 'Token2'} Pool`}
                                        disabled={true}
                                        className="bg-muted/20"
                                    />
                                    <p className="text-sm text-muted-foreground">Customize your pool's display name</p>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="lpTokenSymbol">Custom Token Symbol</Label>
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Pro</span>
                                    </div>
                                    <Input
                                        id="lpTokenSymbol"
                                        placeholder={`${formState.tokenA || 'T1'}-${formState.tokenB || 'T2'}`}
                                        disabled={true}
                                        className="bg-muted/20"
                                    />
                                    <p className="text-sm text-muted-foreground">Customize your LP token symbol</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium">Advanced Features</h3>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Pro Tier</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-row items-center justify-between p-3 border rounded-md bg-muted/10">
                                        <div className="space-y-0.5">
                                            <Label>Limit Orders</Label>
                                            <p className="text-xs text-muted-foreground">Enable limit order functionality</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-primary">Pro</div>
                                            <Switch
                                                checked={false}
                                                disabled={true}
                                                onCheckedChange={() => { }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-row items-center justify-between p-3 border rounded-md bg-muted/10">
                                        <div className="space-y-0.5">
                                            <Label>DCA</Label>
                                            <p className="text-xs text-muted-foreground">Enable dollar-cost averaging</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-primary">Pro</div>
                                            <Switch
                                                checked={false}
                                                disabled={true}
                                                onCheckedChange={() => { }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-row items-center justify-between p-3 border rounded-md bg-muted/10">
                                        <div className="space-y-0.5">
                                            <Label>Perpetuals</Label>
                                            <p className="text-xs text-muted-foreground">Enable perpetuals trading</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-xs text-primary">Pro</div>
                                            <Switch
                                                checked={false}
                                                disabled={true}
                                                onCheckedChange={() => { }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Initial Liquidity</CardTitle>
                            <CardDescription>
                                Configure the initial token amounts for your liquidity pool
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="token1Amount">{token1Symbol} Amount</Label>
                                    <div className="relative">
                                        <Input
                                            id="token1Amount"
                                            type="number"
                                            step="any"
                                            placeholder="0.0"
                                            {...form.register("token1Amount", {
                                                valueAsNumber: true
                                            })}
                                            className="pr-20 bg-muted/10 border-border"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <Badge variant="secondary" className="font-semibold">
                                                {token1Symbol}
                                            </Badge>
                                        </div>
                                    </div>
                                    {form.formState.errors.token1Amount && (
                                        <p className="text-sm text-destructive">{form.formState.errors.token1Amount.message}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="token2Amount">{token2Symbol} Amount</Label>
                                    <div className="relative">
                                        <Input
                                            id="token2Amount"
                                            type="number"
                                            step="any"
                                            placeholder="0.0"
                                            {...form.register("token2Amount", {
                                                valueAsNumber: true
                                            })}
                                            className="pr-20 bg-muted/10 border-border"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            <Badge variant="secondary" className="font-semibold">
                                                {token2Symbol}
                                            </Badge>
                                        </div>
                                    </div>
                                    {form.formState.errors.token2Amount && (
                                        <p className="text-sm text-destructive">{form.formState.errors.token2Amount.message}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onPreviousStep}
                            disabled={isLoading}
                        >
                            Previous
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Continue"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Code Preview Component
const CodePreviewStep = ({
    contractCode,
    onPrevious,
    onNext
}: {
    contractCode: string;
    onPrevious: () => void;
    onNext: () => void;
}) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(contractCode);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([contractCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subnet-liquidity-pool.clar';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="mt-6">
            <h3 className="text-lg font-medium mb-4">Preview Generated Contract</h3>

            <div className="mb-4 bg-muted/30 p-4 rounded-md">
                <p className="text-sm">
                    <Info className="h-4 w-4 inline-block mr-1 text-primary" />
                    Review the generated Clarity contract before deployment. You can copy or download the code.
                </p>
            </div>

            <div className="relative">
                <div className="absolute right-2 top-2 flex space-x-2 z-10">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCopyCode}
                        className="h-8 px-2 py-1"
                    >
                        {isCopied ? (
                            <>
                                <Check className="h-4 w-4 mr-1" />
                                Copied
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4 mr-1" />
                                Copy
                            </>
                        )}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleDownload}
                        className="h-8 px-2 py-1"
                    >
                        <FileText className="h-4 w-4 mr-1" />
                        Download
                    </Button>
                </div>
                <div className="border rounded-md overflow-hidden">
                    <pre className="p-4 bg-gray-100 dark:bg-gray-900 text-xs sm:text-sm overflow-auto max-h-[500px]">
                        <code>{contractCode}</code>
                    </pre>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={onPrevious}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Button onClick={onNext}>
                    Proceed to Deploy
                    <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};

// ConfirmationStep Component
const ConfirmationStep = ({
    formState,
    token1Symbol,
    token2Symbol,
    onPreviousStep,
    onSubmit,
}: {
    formState: FormValues;
    token1Symbol: string;
    token2Symbol: string;
    onPreviousStep: () => void;
    onSubmit: () => void;
}) => {
    const [isDeploying, setIsDeploying] = useState(false);

    const handleSubmit = async () => {
        setIsDeploying(true);
        await onSubmit();
        setIsDeploying(false);
    };

    const getFeeDisplay = (fee: string) => {
        switch (fee) {
            case "10": return "0.1% (Stable pairs)";
            case "30": return "0.3% (Standard)";
            case "100": return "1.0% (Exotic pairs)";
            default: return `${parseInt(fee) / 100}%`;
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Review and Deploy</h2>
                <p className="text-muted-foreground">
                    Confirm your subnet liquidity pool configuration before deployment
                </p>
            </div>

            <Card className="overflow-hidden border-border">
                <CardHeader className="pb-3 bg-muted/10">
                    <CardTitle className="flex items-center">
                        <Network className="h-5 w-5 text-primary mr-2" />
                        Pool Configuration
                    </CardTitle>
                    <CardDescription>
                        Review these details carefully before deploying
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                    <div className="space-y-6">
                        <div className="flex justify-center mb-6">
                            <div className="flex items-center gap-6 p-5 rounded-lg bg-muted/10 border border-border">
                                <div className="flex flex-col items-center">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Network className="h-7 w-7 text-primary" />
                                    </div>
                                    <span className="mt-2 font-medium">{token1Symbol}</span>
                                </div>
                                <Plus className="h-6 w-6 text-muted-foreground" />
                                <div className="flex flex-col items-center">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Network className="h-7 w-7 text-primary" />
                                    </div>
                                    <span className="mt-2 font-medium">{token2Symbol}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
                            <Card className="border">
                                <CardHeader className="pb-2 bg-muted/10">
                                    <CardTitle className="text-base flex items-center">
                                        <FileText className="h-4 w-4 text-primary mr-2" />
                                        Pool Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Pool Name</Label>
                                            <div className="text-sm font-medium p-2.5 rounded bg-muted/10 border border-border">
                                                {formState.poolName ?? ""}
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label className="text-xs font-medium text-muted-foreground">LP Token Symbol</Label>
                                            <div className="text-sm font-medium p-2.5 rounded bg-muted/10 border border-border">
                                                {formState.lpTokenSymbol ?? ""}
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label className="text-xs font-medium text-muted-foreground">Fee Tier</Label>
                                            <div className="text-sm font-medium flex items-center">
                                                <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-muted/20 text-foreground border border-border text-sm font-medium">
                                                    {getFeeDisplay(formState.swapFee)}
                                                </div>
                                                <span className="text-xs text-muted-foreground ml-2">(Paid to liquidity providers)</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border">
                                <CardHeader className="pb-2 bg-muted/10">
                                    <CardTitle className="text-base flex items-center">
                                        <DollarSign className="h-4 w-4 text-primary mr-2" />
                                        Initial Liquidity
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="space-y-4">
                                        <div className="p-3.5 rounded bg-muted/10 border border-border">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-muted-foreground">Amount {token1Symbol}</span>
                                                <div className="inline-flex items-center px-3 py-1 rounded-md bg-muted/20 text-foreground border border-border text-sm font-medium">
                                                    {formState.token1Amount}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-muted-foreground">Amount {token2Symbol}</span>
                                                <div className="inline-flex items-center px-3 py-1 rounded-md bg-muted/20 text-foreground border border-border text-sm font-medium">
                                                    {formState.token2Amount}
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-xs font-medium text-muted-foreground">Token Contracts</Label>
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div className="text-xs font-mono p-2 bg-muted/10 border border-border rounded truncate">
                                                    {token1Symbol}
                                                </div>
                                                <div className="text-xs font-mono p-2 bg-muted/10 border border-border rounded truncate">
                                                    {token2Symbol}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border">
                            <CardHeader className="pb-2 bg-muted/10">
                                <CardTitle className="text-base flex items-center">
                                    <BarChart2 className="h-4 w-4 text-primary mr-2" />
                                    Liquidity Pool Features
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">Token Swaps</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                                                <span className="text-xs text-green-600">Enabled</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">Add Liquidity</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                                                <span className="text-xs text-green-600">Enabled</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">Remove Liquidity</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                                                <span className="text-xs text-green-600">Enabled</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">LP Rewards</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                                                <span className="text-xs text-green-600">Enabled</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">Limit Orders</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-muted"></div>
                                                <span className="text-xs text-muted-foreground">Disabled</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">DCA Trading</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-muted"></div>
                                                <span className="text-xs text-muted-foreground">Disabled</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center p-3 border rounded-md bg-muted/10">
                                        <div className="flex items-center justify-between w-full">
                                            <span className="text-sm font-medium">Perpetuals</span>
                                            <div className="inline-flex items-center space-x-1">
                                                <div className="h-2.5 w-2.5 rounded-full bg-muted"></div>
                                                <span className="text-xs text-muted-foreground">Disabled</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>

                <CardFooter className="border-t bg-muted/10 flex flex-col p-6 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                        <div className="bg-amber-100 dark:bg-amber-900/60 py-2 px-4 flex items-center">
                            <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
                            <h3 className="font-semibold text-amber-900 dark:text-amber-300">Important: Immutable Parameters</h3>
                        </div>
                        <div className="p-4">
                            <p className="text-amber-800 dark:text-amber-200">
                                After deployment, the following parameters <span className="font-semibold">cannot be modified</span>:
                            </p>
                            <ul className="mt-2 pl-5 text-sm text-amber-700 dark:text-amber-300 list-disc space-y-1">
                                <li>Token pair addresses</li>
                                <li>Fee tier configuration</li>
                                <li>Pool name and LP token symbol</li>
                            </ul>
                            <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
                                Please verify all details carefully before proceeding with deployment.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between w-full mt-2">
                        <Button
                            variant="outline"
                            onClick={onPreviousStep}
                            disabled={isDeploying}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Previous
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isDeploying}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            {isDeploying ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deploying...
                                </>
                            ) : (
                                <>
                                    Deploy Pool
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

// TokensStep Component
const TokensStep = ({
    formState,
    setFormState,
    onPreviousStep,
    onNextStep,
}: {
    formState: FormValues;
    setFormState: React.Dispatch<React.SetStateAction<FormValues>>;
    onPreviousStep: () => void;
    onNextStep: () => void;
}) => {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            ...formState,
            // Ensure boolean values have defaults
            enableLimitOrders: false,
            enableDCA: false,
            enablePerps: false,
        },
        mode: "onSubmit"
    });

    const [isLoading, setIsLoading] = useState(false);
    const [token1Symbol, setToken1Symbol] = useState<string>("TOKEN1");
    const [token2Symbol, setToken2Symbol] = useState<string>("TOKEN2");

    useEffect(() => {
        if (formState.tokenA) fetchTokenSymbol(formState.tokenA, setToken1Symbol);
        if (formState.tokenB) fetchTokenSymbol(formState.tokenB, setToken2Symbol);
    }, [formState.tokenA, formState.tokenB]);

    const fetchTokenSymbol = async (address: string, setSymbol: (symbol: string) => void) => {
        try {
            // Simulate fetching token symbol
            // In a real implementation, you would call the ERC20 token contract
            setTimeout(() => {
                // Mock response - in production, use actual token data
                const symbol = address.slice(0, 6).toUpperCase();
                setSymbol(symbol);
            }, 500);
        } catch (error) {
            console.error("Error fetching token symbol:", error);
        }
    };

    async function onSubmit(values: any) {
        setIsLoading(true);
        try {
            setFormState(values);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
            onNextStep();
        } catch (error) {
            console.error("Form submission error:", error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Select Subnet Tokens</h2>
                <p className="text-muted-foreground">
                    Choose the token pair for your subnet liquidity pool
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-6">
                                <div className="flex justify-center mb-4">
                                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Network className="h-6 w-6 text-primary/70" />
                                            </div>
                                            <span className="mt-1 font-medium">{token1Symbol}</span>
                                        </div>
                                        <Plus className="h-5 w-5 text-muted-foreground" />
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Network className="h-6 w-6 text-primary/70" />
                                            </div>
                                            <span className="mt-1 font-medium">{token2Symbol}</span>
                                        </div>
                                    </div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="tokenA"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Token 1 Address</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="0x..."
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        fetchTokenSymbol(e.target.value, setToken1Symbol);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Enter the contract address of the first token in your pair
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="tokenB"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Token 2 Address</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="0x..."
                                                    {...field}
                                                    onChange={(e) => {
                                                        field.onChange(e);
                                                        fetchTokenSymbol(e.target.value, setToken2Symbol);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Enter the contract address of the second token in your pair
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Alert variant="warning">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Token Order Matters</AlertTitle>
                                    <AlertDescription>
                                        The order of tokens affects how prices and ranges are calculated.
                                        The price is expressed as Token2/Token1.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onPreviousStep}
                            disabled={isLoading}
                        >
                            Previous
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Continue"
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};

// Main wizard component
export default function SubnetLiquidityPoolWizard() {
    const router = useRouter();
    const { toast } = useToast();
    const { authenticated, stxAddress, deployContract } = useApp();
    // Using any type to access handleDeployContract
    const appContext = useApp() as any;

    // Set up wizard state
    const [currentStep, setCurrentStep] = useState(WizardStep.SELECT_TOKENS);
    const [formState, setFormState] = useState<FormValues>({
        tokenA: "",
        tokenB: "",
        poolName: "",
        lpTokenSymbol: "",
        swapFee: "30", // Default to 0.3%
        enableLimitOrders: false,
        enableDCA: false,
        enablePerps: false,
        initialPrice: 0.1,  // Set a valid default
        minPrice: 0.001,    // Set a valid default
        maxPrice: 10,       // Set a valid default
        feeTier: 30,
        token1Amount: 1,    // Set a valid default
        token2Amount: 1,    // Set a valid default
    });

    // Loading state
    const [isLoadingTokens, setIsLoadingTokens] = useState(false); // Changed to false for hardcoded tokens
    const [tokenLoadError, setTokenLoadError] = useState<string | null>(null);
    const [tokensMetadata, setTokensMetadata] = useState<Record<string, EnhancedToken>>({});

    // Hardcoded subnet tokens as requested
    const [predefinedTokens] = useState<EnhancedToken[]>([
        {
            symbol: "CHRM",
            name: "Charisma Token",
            address: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6",
            description: "Charisma Subnet Token",
            decimals: 6,
            is_subnet: true,
            contract_principal: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6"
        },
        {
            symbol: "WLSH",
            name: "Welsh Token",
            address: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-rc2",
            description: "Welsh Subnet Token",
            decimals: 6,
            is_subnet: true,
            contract_principal: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-rc2"
        }
    ]);

    // Code generation state
    const [contractCode, setContractCode] = useState("");
    const [filename, setFilename] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Token address and metadata
    const [tokenAAddress, setTokenAAddress] = useState("");
    const [tokenBAddress, setTokenBAddress] = useState("");

    // Fetch token list on component mount - no longer needed with hardcoded tokens
    useEffect(() => {
        if (!authenticated) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet to deploy a contract",
                variant: "destructive",
            });
            router.push("/templates");
            return;
        }

        // Initialize token metadata from hardcoded values
        const metadataMap: Record<string, EnhancedToken> = {};
        predefinedTokens.forEach((token: EnhancedToken) => {
            metadataMap[token.address] = token;
        });
        setTokensMetadata(metadataMap);
    }, [authenticated, router, toast, predefinedTokens]);

    // The fetchTokens function is no longer needed with hardcoded tokens

    // Navigation functions
    const nextStep = () => {
        if (currentStep === WizardStep.CONFIGURE_POOL) {
            if (!validateForm()) {
                return;
            }
            generateContractCode();
        }
        setCurrentStep(prev => prev + 1);
    };

    const prevStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    // Token selection handlers
    const handleSelectToken1 = (symbol: string, address: string) => {
        setFormState({
            ...formState,
            tokenA: symbol
        });
        setTokenAAddress(address);
    };

    const handleSelectToken2 = (symbol: string, address: string) => {
        // Auto-generate pool name and LP token symbol based on the token names
        const autoPoolName = `${formState.tokenA}-${symbol} Subnet Pool`;
        const autoLpSymbol = `${formState.tokenA}-${symbol}-SLP`;

        setFormState({
            ...formState,
            tokenB: symbol,
            poolName: autoPoolName,
            lpTokenSymbol: autoLpSymbol
        });
        setTokenBAddress(address);
        nextStep();
    };

    // Form validation
    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        let valid = true;

        try {
            // Basic validation
            if (!formState.poolName.trim()) {
                newErrors.poolName = "Pool name is required";
                valid = false;
            } else if (formState.poolName.length < 3) {
                newErrors.poolName = "Pool name must be at least 3 characters";
                valid = false;
            }

            if (!formState.lpTokenSymbol.trim()) {
                newErrors.lpTokenSymbol = "LP token symbol is required";
                valid = false;
            }

            const swapFeeNumber = Number(formState.swapFee);
            if (isNaN(swapFeeNumber) || swapFeeNumber < 0 || swapFeeNumber > 1000) {
                newErrors.swapFee = "Swap fee must be between 0 and 1000";
                valid = false;
            }

            // Additional validation for token amounts - ensure they are numbers and > 0
            const token1Amount = Number(formState.token1Amount);
            if (isNaN(token1Amount) || token1Amount <= 0) {
                newErrors.token1Amount = "Token 1 amount must be greater than 0";
                // Don't block progression for this - we'll use default values
            }

            const token2Amount = Number(formState.token2Amount);
            if (isNaN(token2Amount) || token2Amount <= 0) {
                newErrors.token2Amount = "Token 2 amount must be greater than 0";
                // Don't block progression for this - we'll use default values
            }

        } catch (error) {
            console.error("Validation error:", error);
            // Don't block progression due to unexpected errors
        }

        setErrors(newErrors);
        return valid;
    };

    // Generate contract code
    const generateContractCode = async () => {
        setIsGenerating(true);

        try {
            const result = await generateSubnetLiquidityPool({
                tokenAContractId: tokenAAddress,
                tokenBContractId: tokenBAddress,
                poolName: formState.poolName,
                lpTokenSymbol: formState.lpTokenSymbol,
                swapFee: Number(formState.swapFee),
                rebate: Number(formState.swapFee), // Use same value for rebate as fee by default
                enableLimitOrders: formState.enableLimitOrders,
                enableDCA: formState.enableDCA,
                enablePerps: formState.enablePerps
            });

            setContractCode(result.code);
            setFilename(result.filename);
        } catch (error) {
            console.error("Error generating contract code:", error);
            toast({
                title: "Error generating contract",
                description: "There was an error generating the contract. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    // Deploy contract - fixed to use appContext
    const handleDeploy = async () => {
        if (!authenticated) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet to deploy a contract",
                variant: "destructive",
            });
            return;
        }

        setIsDeploying(true);

        try {
            await deployContract(contractCode, formState.poolName, {
                postConditions: [
                    Pc.principal(stxAddress!)
                        .willSendEq(formState.token1Amount)
                        .ft(tokenAAddress as any, 'TODO') as any
                ]
            })
        } catch (error) {
            console.error("Error deploying contract:", error);
            toast({
                title: "Error deploying contract",
                description: "There was an error deploying the contract. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    // Render the appropriate step
    const renderStep = () => {
        switch (currentStep) {
            case WizardStep.SELECT_TOKENS:
                return (
                    <TokenSelectionStep
                        onSelectToken1={handleSelectToken1}
                        onSelectToken2={handleSelectToken2}
                        token1Symbol={formState.tokenA}
                        excludedToken={tokenAAddress}
                        predefinedTokens={predefinedTokens}
                        isLoadingTokens={isLoadingTokens}
                        tokenLoadError={tokenLoadError}
                    />
                );
            case WizardStep.CONFIGURE_POOL:
                return (
                    <LiquidityConfigStep
                        formState={formState}
                        setFormState={setFormState}
                        token1Symbol={formState.tokenA}
                        token2Symbol={formState.tokenB}
                        onPreviousStep={prevStep}
                        onNextStep={nextStep}
                    />
                );
            case WizardStep.PREVIEW_CODE:
                return (
                    <CodePreviewStep
                        contractCode={contractCode}
                        onPrevious={prevStep}
                        onNext={nextStep}
                    />
                );
            case WizardStep.DEPLOY:
                return (
                    <ConfirmationStep
                        formState={formState}
                        token1Symbol={formState.tokenA}
                        token2Symbol={formState.tokenB}
                        onPreviousStep={prevStep}
                        onSubmit={handleDeploy}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="container max-w-5xl px-4 py-8 mx-auto">
            <div className="mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.push("/templates")}
                    className="mb-4"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Templates
                </Button>
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Network className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">AMM Liquidity Subnet</h1>
                </div>
                <p className="text-muted-foreground mt-2">
                    Create a subnet-enabled liquidity pool with advanced DeFi features for signature-based off-chain transactions.
                </p>
            </div>

            <Card>
                <CardContent className="p-6">
                    <ContractStepper currentStep={currentStep} />
                    {renderStep()}
                </CardContent>
            </Card>
        </div>
    );
} 