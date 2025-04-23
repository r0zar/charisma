"use client";

import { useState, useEffect } from "react";
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
import { MetadataService, TokenMetadata } from "@/lib/metadata-service";
import { generateSIP10TokenContract } from "@/lib/templates/sip10-contract-template";

export default function SIP10DeployPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { authenticated, stxAddress, deployContract } = useApp();
    const [isDeploying, setIsDeploying] = useState(false);
    const [hasMetadata, setHasMetadata] = useState(false);
    const [isCheckingMetadata, setIsCheckingMetadata] = useState(false);
    const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
    const [metadataApiError, setMetadataApiError] = useState(false);
    const [isCorsError, setIsCorsError] = useState(false);
    const [txid, setTxid] = useState<string | null>(null);

    // Form state
    const [tokenName, setTokenName] = useState("");
    const [tokenSymbol, setTokenSymbol] = useState("");
    const [decimals, setDecimals] = useState("6");
    const [initialSupply, setInitialSupply] = useState("");
    const [isMintable, setIsMintable] = useState(false);
    const [isBurnable, setIsBurnable] = useState(false);

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

    // Function to check metadata
    const checkMetadata = async () => {
        if (!contractIdentifier) return;

        setIsCheckingMetadata(true);
        setMetadataApiError(false);
        setIsCorsError(false);
        try {
            // Use the metadata service directly if available in this project
            // or call the API endpoint
            let metadataData;
            try {
                // Try to use the local service first
                metadataData = await MetadataService.get(contractIdentifier);

                const hasRequiredFields =
                    metadataData?.name &&
                    metadataData?.description &&
                    metadataData?.image;

                setHasMetadata(!!hasRequiredFields);
                setMetadata(metadataData);
            } catch (error) {
                // Fallback to API call
                console.log("Using API fallback for metadata");
                try {
                    const response = await fetch(`http://localhost:3008/api/v1/metadata/${contractIdentifier}`);

                    if (response.ok) {
                        const data = await response.json();
                        const hasRequiredFields =
                            data.name &&
                            data.description &&
                            data.image;

                        setHasMetadata(!!hasRequiredFields);
                        setMetadata(data);
                    } else {
                        setHasMetadata(false);
                        setMetadata(null);
                    }
                } catch (fetchError) {
                    console.error("Error fetching metadata from API:", fetchError);
                    // Identify CORS errors
                    if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
                        setIsCorsError(true);
                        toast({
                            variant: "destructive",
                            title: "CORS Error",
                            description: "Cross-origin request blocked. The metadata service needs to allow requests from this domain.",
                        });
                    } else {
                        setMetadataApiError(true);
                        toast({
                            variant: "destructive",
                            title: "Metadata Service Error",
                            description: "Could not connect to metadata service. Please try again later.",
                        });
                    }

                    setHasMetadata(false);
                    setMetadata(null);
                }
            }
        } catch (error) {
            console.error("Error checking metadata:", error);
            setHasMetadata(false);
            setMetadata(null);
        } finally {
            setIsCheckingMetadata(false);
        }
    };

    // Check for metadata when contract identifier changes
    useEffect(() => {
        if (contractIdentifier) {
            checkMetadata();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractIdentifier]); // We intentionally omit checkMetadata from dependencies to avoid infinite loops

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

        if (!hasMetadata) {
            toast({
                variant: "destructive",
                title: "Metadata Required",
                description: "Please set up token metadata before deploying. Click 'Add Metadata' in the preview section.",
            });
            return;
        }

        try {
            setIsDeploying(true);

            // Generate the SIP-10 token contract code
            const contractCode = generateSIP10TokenContract({
                tokenName,
                tokenSymbol,
                decimals: parseInt(decimals),
                initialSupply: parseFloat(initialSupply),
                hasMinting: isMintable,
                hasBurning: isBurnable,
                deployerAddress: stxAddress!,
                contractName: contractName
            });

            // Deploy the contract using the wallet
            const result = await deployContract(contractCode, contractName);

            setTxid(result.txid);

            toast({
                title: "Deployment Initiated",
                description:
                    `Your SIP-10 token deployment has been initiated with transaction ID: ${result.txid.substring(0, 10)}...`,
            });

            // Redirect to contracts page after successful deployment
            router.push(`/contracts?txid=${result.txid}`);
        } catch (error) {
            console.error("Deployment error:", error);
            toast({
                variant: "destructive",
                title: "Deployment Failed",
                description: error instanceof Error ? error.message : "There was an error deploying your token. Please try again.",
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

                    {/* Deployment Steps */}
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${tokenName && tokenSymbol && initialSupply ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                                1
                            </div>
                            <span className="text-xs mt-2">Configure Token</span>
                        </div>
                        <div className="h-[2px] flex-1 bg-muted mx-2" />
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${hasMetadata ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                                2
                            </div>
                            <span className="text-xs mt-2">Set Up Metadata</span>
                        </div>
                        <div className="h-[2px] flex-1 bg-muted mx-2" />
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-muted bg-muted/50 text-muted-foreground">
                                3
                            </div>
                            <span className="text-xs mt-2">Deploy Contract</span>
                        </div>
                    </div>

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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Token Metadata Visual */}
                                <div className="md:col-span-1">
                                    <h3 className="text-sm font-medium mb-3">Token Metadata</h3>
                                    <div className="border rounded-md p-4 bg-muted/20 flex flex-col items-center">
                                        <a
                                            href={`https://charisma-metadata.vercel.app/tokens/new?tokenId=${encodeURIComponent(contractIdentifier?.split('.')?.pop() || '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mb-2"
                                        >
                                            <div className={`border ${hasMetadata ? 'border-solid border-green-500' : isCorsError ? 'border-solid border-amber-500' : metadataApiError ? 'border-solid border-destructive' : 'border-dashed'} rounded-md aspect-square w-32 h-32 flex items-center justify-center ${hasMetadata ? 'bg-green-50/20' : isCorsError ? 'bg-amber-50/20' : metadataApiError ? 'bg-destructive/5' : 'bg-muted/30 group-hover:bg-muted/50'} transition-colors mx-auto relative overflow-hidden`}>
                                                {hasMetadata ? (
                                                    <>
                                                        {metadata?.image ? (
                                                            <div className="absolute inset-0 w-full h-full">
                                                                <img
                                                                    src={metadata.image}
                                                                    alt={metadata.name || "Token"}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => {
                                                                        // Hide image on error and show fallback
                                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                                        const fallbackEl = e.currentTarget.parentElement?.querySelector('.image-fallback');
                                                                        if (fallbackEl) {
                                                                            fallbackEl.classList.remove('hidden');
                                                                        }
                                                                    }}
                                                                />
                                                                <div className="image-fallback hidden absolute inset-0 flex items-center justify-center bg-muted/20">
                                                                    <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                                                                        {metadata?.symbol ? (
                                                                            <span className="text-2xl font-bold text-muted-foreground">
                                                                                {metadata.symbol.charAt(0)}
                                                                            </span>
                                                                        ) : (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                                                                <circle cx="12" cy="12" r="10" />
                                                                                <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                                                                    {metadata?.symbol ? (
                                                                        <span className="text-2xl font-bold text-green-500">
                                                                            {metadata.symbol.charAt(0)}
                                                                        </span>
                                                                    ) : (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                                                                            <circle cx="12" cy="12" r="10" />
                                                                            <line x1="12" y1="8" x2="12" y2="16" />
                                                                            <line x1="8" y1="12" x2="16" y2="12" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="z-10 bg-green-500 rounded-full p-1 absolute bottom-2 right-2 shadow-sm">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        </div>
                                                    </>
                                                ) : isCheckingMetadata ? (
                                                    <svg className="animate-spin h-8 w-8 text-primary/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : isCorsError ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 h-8 w-8">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                    </svg>
                                                ) : metadataApiError ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive h-8 w-8">
                                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                        <line x1="12" y1="9" x2="12" y2="13" />
                                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                                    </svg>
                                                ) : (
                                                    <ExternalLink className="h-8 w-8 text-muted-foreground group-hover:text-foreground" />
                                                )}
                                            </div>
                                            <div className="text-sm text-center mt-2 font-medium">
                                                {hasMetadata ? "Metadata Ready" : isCorsError ? "CORS Error" : metadataApiError ? "Service Unavailable" : "Add Metadata"}
                                            </div>
                                        </a>

                                        {contractIdentifier && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={checkMetadata}
                                                disabled={isCheckingMetadata}
                                                className="mt-3"
                                            >
                                                {isCheckingMetadata ? (
                                                    <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
                                                    </svg>
                                                )}
                                                Refresh Metadata
                                            </Button>
                                        )}
                                    </div>

                                    {metadataApiError && !isCorsError && (
                                        <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                                            <p className="font-medium">Service unavailable</p>
                                            <p className="mt-1 text-xs">We're unable to connect to the metadata service.</p>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="mt-2 w-full"
                                                onClick={checkMetadata}
                                            >
                                                Retry Connection
                                            </Button>
                                        </div>
                                    )}

                                    {isCorsError && (
                                        <div className="mt-4 p-3 rounded-md bg-amber-50 text-amber-800 text-sm">
                                            <p className="font-medium">CORS Error</p>
                                            <p className="mt-1 text-xs">Cross-origin request blocked. The metadata service needs CORS headers to allow requests from this domain.</p>
                                            <div className="mt-2 bg-amber-100/50 p-2 rounded text-xs font-mono">
                                                Origin: {window.location.origin}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-2 w-full border-amber-300 hover:bg-amber-100 text-amber-800"
                                                onClick={checkMetadata}
                                            >
                                                Try Again
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Token Details */}
                                <div className="md:col-span-2">
                                    <h3 className="text-sm font-medium mb-3 flex items-center">
                                        Token Details
                                        {!hasMetadata && !metadataApiError && (
                                            <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center">
                                                Metadata Required
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                className="h-4 w-4 p-0 ml-1"
                                                            >
                                                                <HelpCircle className="h-3 w-3 text-amber-800" />
                                                                <span className="sr-only">Info</span>
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="w-80">
                                                            <p className="mb-2">Your token requires metadata before it can be deployed.</p>
                                                            <p>Click on "Add Metadata" to set up your token's details and image.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </span>
                                        )}
                                    </h3>
                                    <div className="border rounded-md p-4 bg-muted/20 h-fit">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Name</div>
                                                <div className="font-medium">
                                                    {hasMetadata && metadata?.name ? metadata.name : tokenName || "Not specified"}
                                                    {hasMetadata && metadata?.name && metadata.name !== tokenName && (
                                                        <span className="text-xs text-muted-foreground ml-2">(from metadata)</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Symbol</div>
                                                <div className="font-medium">
                                                    {hasMetadata && metadata?.symbol ? metadata.symbol : tokenSymbol || "Not specified"}
                                                    {hasMetadata && metadata?.symbol && metadata.symbol !== tokenSymbol && (
                                                        <span className="text-xs text-muted-foreground ml-2">(from metadata)</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Decimals</div>
                                                <div className="font-medium">
                                                    {hasMetadata && metadata?.decimals !== undefined ? metadata.decimals : decimals}
                                                    {hasMetadata && metadata?.decimals !== undefined && metadata.decimals.toString() !== decimals && (
                                                        <span className="text-xs text-muted-foreground ml-2">(from metadata)</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-sm text-muted-foreground mb-1">Initial Supply</div>
                                                <div className="font-medium">{initialSupply || "0"}</div>
                                            </div>

                                            {hasMetadata && metadata?.description && (
                                                <div className="col-span-2 mt-2">
                                                    <div className="text-sm text-muted-foreground mb-1">Description</div>
                                                    <div className="text-sm bg-muted/20 p-2 rounded-md max-h-24 overflow-y-auto">
                                                        {metadata.description}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="col-span-2">
                                                <div className="text-sm text-muted-foreground mb-1">Features</div>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                                        {isMintable ? "Mintable" : "Not Mintable"}
                                                    </span>
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                                        {isBurnable ? "Burnable" : "Not Burnable"}
                                                    </span>
                                                    {hasMetadata && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Metadata Ready
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t">
                                            <div className="text-sm text-muted-foreground mb-1">Contract Identifier</div>
                                            <div className="font-mono text-xs bg-muted/40 p-2 rounded-md break-all">
                                                {contractIdentifier || "Connect wallet and enter token name"}
                                            </div>
                                        </div>
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
                            disabled={isDeploying || !hasMetadata}
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
                            ) : !hasMetadata ? (
                                "Metadata Required"
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