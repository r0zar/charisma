"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useApp } from "@/lib/context/app-context";
import { ArrowLeft, HelpCircle, Layers, ExternalLink } from "lucide-react";
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

export default function LiquidityPoolDeployPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { authenticated, stxAddress } = useApp();
    const [isDeploying, setIsDeploying] = useState(false);

    // Form state
    const [poolName, setPoolName] = useState("");
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
        // Convert to lowercase, replace spaces with hyphens, and remove special characters
        return name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            // If it starts with a number, prepend 'pool-'
            .replace(/^(\d)/, 'pool-$1');
    };

    // Get contract name from pool name
    const contractName = generateContractName(poolName) || 'amm-pool';

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

    const handleDeploy = async () => {
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

            // In a real implementation, this would deploy the contract
            // For now, we'll just simulate a successful deployment after a delay
            await new Promise((resolve) => setTimeout(resolve, 2000));

            toast({
                title: "Deployment Initiated",
                description:
                    "Your liquidity pool deployment has been initiated. You will be redirected to the contracts page.",
            });

            // Redirect to contracts page after successful deployment
            router.push("/contracts");
        } catch (error) {
            console.error("Deployment error:", error);
            toast({
                variant: "destructive",
                title: "Deployment Failed",
                description: "There was an error deploying your pool. Please try again.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    const handlePoolNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPoolName(value);
    };

    // Predefined tokens for the dropdown
    const predefinedTokens = [
        { symbol: "STX", name: "Stacks", address: "SP000000000000000000002Q6VF78.stx-token" },
        { symbol: "USDA", name: "USDA", address: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token" },
        { symbol: "XUSD", name: "xUSD", address: "SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-USD" },
        { symbol: "BTC", name: "Bitcoin", address: "SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.wrapped-bitcoin" },
    ];

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

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Pool Configuration</CardTitle>
                            <CardDescription>
                                Set the core properties of your liquidity pool
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
                                                    The name of your liquidity pool, e.g., "STX-BTC AMM Pool"
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </Label>
                                <Input
                                    id="poolName"
                                    value={poolName}
                                    onChange={handlePoolNameChange}
                                    placeholder="STX-BTC AMM Pool"
                                    className={errors.poolName ? "border-destructive" : ""}
                                />
                                {errors.poolName && (
                                    <p className="text-destructive text-sm">{errors.poolName}</p>
                                )}
                            </div>

                            {/* Token 1 */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="token1">First Token</Label>
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
                                                    Select the first token for your trading pair
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Select
                                    value={token1}
                                    onValueChange={(value: string) => {
                                        setToken1(value);
                                        const selectedToken = predefinedTokens.find(t => t.symbol === value);
                                        if (selectedToken) {
                                            setToken1Address(selectedToken.address);
                                        }
                                    }}
                                >
                                    <SelectTrigger className={errors.token1 ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select first token" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {predefinedTokens.map((token) => (
                                            <SelectItem key={token.symbol} value={token.symbol}>
                                                {token.symbol} - {token.name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="custom">Custom Token</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.token1 && (
                                    <p className="text-red-500 text-sm">{errors.token1}</p>
                                )}
                            </div>

                            {/* Token 1 Address */}
                            {token1 === "custom" && (
                                <div className="space-y-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="token1Address">First Token Address</Label>
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
                                                        The contract address of the first token
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Input
                                        id="token1Address"
                                        placeholder="e.g. SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.my-token"
                                        value={token1Address}
                                        onChange={(e) => setToken1Address(e.target.value)}
                                        className={errors.token1Address ? "border-red-500" : ""}
                                    />
                                    {errors.token1Address && (
                                        <p className="text-red-500 text-sm">{errors.token1Address}</p>
                                    )}
                                </div>
                            )}

                            {/* Token 2 */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="token2">Second Token</Label>
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
                                                    Select the second token for your trading pair
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Select
                                    value={token2}
                                    onValueChange={(value: string) => {
                                        setToken2(value);
                                        const selectedToken = predefinedTokens.find(t => t.symbol === value);
                                        if (selectedToken) {
                                            setToken2Address(selectedToken.address);
                                        }
                                    }}
                                >
                                    <SelectTrigger className={errors.token2 ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select second token" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {predefinedTokens.map((token) => (
                                            <SelectItem key={token.symbol} value={token.symbol}>
                                                {token.symbol} - {token.name}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="custom">Custom Token</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.token2 && (
                                    <p className="text-red-500 text-sm">{errors.token2}</p>
                                )}
                            </div>

                            {/* Token 2 Address */}
                            {token2 === "custom" && (
                                <div className="space-y-2">
                                    <div className="flex items-center">
                                        <Label htmlFor="token2Address">Second Token Address</Label>
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
                                                        The contract address of the second token
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <Input
                                        id="token2Address"
                                        placeholder="e.g. SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.other-token"
                                        value={token2Address}
                                        onChange={(e) => setToken2Address(e.target.value)}
                                        className={errors.token2Address ? "border-red-500" : ""}
                                    />
                                    {errors.token2Address && (
                                        <p className="text-red-500 text-sm">{errors.token2Address}</p>
                                    )}
                                </div>
                            )}

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
                                    onValueChange={setSwapFee}
                                >
                                    <SelectTrigger className={errors.swapFee ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select swap fee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0.1">0.1% (Stable pairs)</SelectItem>
                                        <SelectItem value="0.3">0.3% (Standard)</SelectItem>
                                        <SelectItem value="1.0">1.0% (Exotic pairs)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.swapFee && (
                                    <p className="text-red-500 text-sm">{errors.swapFee}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Deployment Preview</CardTitle>
                            <CardDescription>
                                Review your liquidity pool before deployment
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium mb-2">Pool Info</h3>
                                <div className="border rounded-md p-3 space-y-3 bg-muted/20">
                                    <div className="flex items-start">
                                        <a
                                            href={`https://charisma-metadata.vercel.app/tokens/new?tokenId=${encodeURIComponent(contractIdentifier?.split('.')?.pop() || '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-shrink-0 mr-3 group"
                                        >
                                            <div className="border border-dashed rounded-md w-16 h-16 flex items-center justify-center bg-muted/30 group-hover:bg-muted/50 transition-colors">
                                                <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
                                            </div>
                                            <div className="text-xs text-center mt-1 text-muted-foreground group-hover:text-foreground">
                                                Add Metadata
                                            </div>
                                        </a>
                                        <div className="flex-1 space-y-3">
                                            <div>
                                                <span className="text-xs text-muted-foreground block">Name</span>
                                                <span className="font-medium">{poolName || "Not specified"}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground block">Token Pair</span>
                                                <span className="font-medium">{token1 || "Token 1"} / {token2 || "Token 2"}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground block">Swap Fee</span>
                                                <span className="font-medium">{swapFee}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mb-2">Contract Identifier</h3>
                                <div className="border rounded-md p-3 bg-muted/20">
                                    <div className="font-mono text-xs break-all">
                                        {contractIdentifier || "Connect wallet and enter pool name"}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2">
                                        <span className="inline-block px-1.5 py-0.5 bg-muted/50 rounded mr-1">Deployer Address</span> +
                                        <span className="inline-block px-1.5 py-0.5 bg-muted/50 rounded mx-1">Contract Name</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end mt-8">
                        <Button
                            variant="outline"
                            className="mr-4"
                            onClick={() => router.push("/templates")}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleDeploy}
                            disabled={isDeploying}
                            className="min-w-[150px]"
                        >
                            {isDeploying ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                                    Deploying...
                                </>
                            ) : (
                                "Deploy Pool"
                            )}
                        </Button>
                    </div>
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
                                    {stxAddress || 'Connect wallet'}
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