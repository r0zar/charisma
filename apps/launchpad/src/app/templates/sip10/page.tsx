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
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function SIP10DeployPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { authenticated, stxAddress } = useApp();
    const [isDeploying, setIsDeploying] = useState(false);

    // Form state
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [decimals, setDecimals] = useState("6");
    const [initialSupply, setInitialSupply] = useState("");
    const [isMintable, setIsMintable] = useState(true);
    const [isBurnable, setIsBurnable] = useState(true);

    // Generate contract name from token name
    const generateContractName = (name: string) => {
        if (!name) return '';
        // Convert to lowercase, replace spaces with hyphens, and remove special characters
        return name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            // If it starts with a number, prepend 'token-'
            .replace(/^(\d)/, 'token-$1');
    };

    // Get contract name from token name
    const contractName = generateContractName(tokenName) || 'my-token';

    // Full contract identifier
    const contractIdentifier = stxAddress ? `${stxAddress}.${contractName}` : '';

    // Form validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!tokenName.trim()) {
            newErrors.tokenName = "Token name is required";
        }

        if (!tokenSymbol.trim()) {
            newErrors.tokenSymbol = "Token symbol is required";
        } else if (tokenSymbol.length > 5) {
            newErrors.tokenSymbol = "Token symbol should be 5 characters or less";
        }

        if (!decimals.trim()) {
            newErrors.decimals = "Decimals is required";
        } else {
            const decValue = parseInt(decimals);
            if (isNaN(decValue) || decValue < 0 || decValue > 18) {
                newErrors.decimals = "Decimals must be between 0 and 18";
            }
        }

        if (!initialSupply.trim()) {
            newErrors.initialSupply = "Initial supply is required";
        } else {
            const supplyValue = parseFloat(initialSupply);
            if (isNaN(supplyValue) || supplyValue <= 0) {
                newErrors.initialSupply = "Initial supply must be a positive number";
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
                description: "Your SIP-10 token deployment has been initiated. You will be redirected to the contracts page.",
            });

            // Redirect to contracts page after successful deployment
            router.push("/contracts");
        } catch (error) {
            console.error("Deployment error:", error);
            toast({
                variant: "destructive",
                title: "Deployment Failed",
                description: "There was an error deploying your token. Please try again.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    // Calculate the actual initial supply with decimals
    const calculateActualSupply = () => {
        if (!initialSupply || !decimals) return "0";
        try {
            const supply = parseFloat(initialSupply);
            const dec = parseInt(decimals);
            if (isNaN(supply) || isNaN(dec)) return "0";

            // Format with commas for thousands and limit decimal places
            return (supply * Math.pow(10, dec)).toLocaleString(undefined, {
                maximumFractionDigits: 0,
            });
        } catch (e) {
            return "0";
        }
    };

    const handleTokenNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTokenName(value);
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
                        Please connect your wallet to deploy a SIP-10 token.
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
                        Deploy SIP-10 Token
                    </h1>
                    <p className="text-muted-foreground mb-8">
                        Configure your SIP-10 fungible token contract. This is the standard for fungible tokens on the Stacks blockchain.
                    </p>

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Token Configuration</CardTitle>
                            <CardDescription>
                                Configure the basic properties of your token
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="tokenName">
                                    Token Name
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="h-4 w-4 ml-1 inline-block text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p className="w-80">
                                                    The full name of your token, e.g., "My Awesome Token"
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </Label>
                                <Input
                                    id="tokenName"
                                    value={tokenName}
                                    onChange={handleTokenNameChange}
                                    placeholder="My Awesome Token"
                                    className={errors.tokenName ? "border-destructive" : ""}
                                />
                                {errors.tokenName && (
                                    <p className="text-destructive text-sm">{errors.tokenName}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tokenSymbol">Token Symbol</Label>
                                <Input
                                    id="tokenSymbol"
                                    placeholder="e.g. CHR"
                                    value={tokenSymbol}
                                    onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                                    className={errors.tokenSymbol ? "border-red-500" : ""}
                                />
                                {errors.tokenSymbol && (
                                    <p className="text-red-500 text-sm">{errors.tokenSymbol}</p>
                                )}
                            </div>

                            {/* Decimals */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="decimals">Decimals</Label>
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
                                                    The number of decimal places for your token. Common values: 6 (like STX), 8 (like BTC), or 18 (like ETH).
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Select
                                    value={decimals}
                                    onValueChange={setDecimals}
                                >
                                    <SelectTrigger className={errors.decimals ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select decimals" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">0 (No decimals)</SelectItem>
                                        <SelectItem value="6">6 (Like STX)</SelectItem>
                                        <SelectItem value="8">8 (Like BTC)</SelectItem>
                                        <SelectItem value="18">18 (Like ETH)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.decimals && (
                                    <p className="text-red-500 text-sm">{errors.decimals}</p>
                                )}
                            </div>

                            {/* Initial Supply */}
                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label htmlFor="initialSupply">Initial Supply</Label>
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
                                                    The number of tokens to mint initially. This amount will be sent to your wallet.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <Input
                                    id="initialSupply"
                                    placeholder="e.g. 1000000"
                                    value={initialSupply}
                                    onChange={(e) => {
                                        // Allow only numbers and decimal point
                                        const value = e.target.value.replace(/[^0-9.]/g, '');
                                        setInitialSupply(value);
                                    }}
                                    className={errors.initialSupply ? "border-red-500" : ""}
                                />
                                {errors.initialSupply ? (
                                    <p className="text-red-500 text-sm">{errors.initialSupply}</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        This will create {calculateActualSupply()} atomic units of your token
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-8 relative">
                        <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center rounded-lg">
                            <div className="bg-primary/10 rounded-full p-3 mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary h-6 w-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /></svg>
                            </div>
                            <h3 className="font-medium text-lg mb-1">Pro Feature</h3>
                            <p className="text-muted-foreground text-center max-w-[250px] text-sm">Advanced token features are available for Pro tier users</p>
                            <Button variant="outline" className="mt-4">
                                Upgrade Plan
                            </Button>
                        </div>
                        <CardHeader>
                            <CardTitle>Token Features</CardTitle>
                            <CardDescription>
                                Configure additional capabilities for your token
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Mintable Option */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center">
                                        <Label htmlFor="isMintable" className="text-base">Mintable</Label>
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
                                                        If enabled, you can mint additional tokens after deployment. Only the contract owner can mint.
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Allow creating additional tokens after deployment
                                    </p>
                                </div>
                                <Switch
                                    id="isMintable"
                                    checked={isMintable}
                                    onCheckedChange={setIsMintable}
                                    disabled
                                />
                            </div>

                            {/* Burnable Option */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center">
                                        <Label htmlFor="isBurnable" className="text-base">Burnable</Label>
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
                                                        If enabled, token holders can burn (destroy) their tokens, reducing the total supply.
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Allow token holders to burn their tokens
                                    </p>
                                </div>
                                <Switch
                                    id="isBurnable"
                                    checked={isBurnable}
                                    onCheckedChange={setIsBurnable}
                                    disabled
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Deployment Preview</CardTitle>
                            <CardDescription>
                                Review your token before deployment
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="text-sm font-medium mb-2">Token Info</h3>
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
                                                <span className="font-medium">{tokenName || "Not specified"}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground block">Symbol</span>
                                                <span className="font-medium">{tokenSymbol || "Not specified"}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground block">Initial Supply</span>
                                                <span className="font-medium">{initialSupply || "0"}</span>
                                            </div>
                                            <div>
                                                <span className="text-xs text-muted-foreground block">Decimals</span>
                                                <span className="font-medium">{decimals}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium mb-2">Contract Identifier</h3>
                                <div className="border rounded-md p-3 bg-muted/20">
                                    <div className="font-mono text-xs break-all">
                                        {contractIdentifier || "Connect wallet and enter token name"}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2">
                                        <span className="inline-block px-1.5 py-0.5 bg-muted/20 text-foreground/50 rounded mr-1">Deployer Address</span> +
                                        <span className="inline-block px-1.5 py-0.5 bg-muted/20 text-foreground/50 rounded mx-1">Contract Name</span>
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
                                "Deploy Token"
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
                                Important details about your token deployment
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
                                <h3 className="font-medium mb-1">Standard</h3>
                                <p className="text-sm text-muted-foreground">SIP-010 Fungible Token</p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-1">Deployment Cost</h3>
                                <p className="text-sm text-muted-foreground">~8,000 STX (estimated)</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t pt-6 flex flex-col items-start">
                            <h3 className="font-medium mb-2">Resources</h3>
                            <ul className="space-y-2 w-full">
                                <li>
                                    <a
                                        href="https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm flex items-center text-primary hover:underline"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> SIP-010 Standard
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="https://book.stacks.tools/tokens/sip10"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm flex items-center text-primary hover:underline"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> Token Documentation
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