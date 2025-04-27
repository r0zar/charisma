"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useApp } from "@/lib/context/app-context";
import { ArrowLeft, HelpCircle, Layers, ExternalLink, Check } from "lucide-react";
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
import { truncateAddress } from "@/lib/utils/token-utils";
import { DeploymentSidebar } from "@/components/deployment/deployment-sidebar";
import { generateContractNameFromTokenName, calculateAtomicSupply } from "@/lib/utils/token-utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";

// Fixed Charisma Token Address (Mainnet)
const CHR_TOKEN_ADDRESS = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token";
const CHR_TOKEN_SYMBOL = "CHR";
const FIXED_LP_FEE_PERCENT = 1.0;

// Updated constants for all metadata-related URLs
const METADATA_BASE_URL = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3008'
    : 'https://charisma-metadata.vercel.app';

const METADATA_API_URL = `${METADATA_BASE_URL}/api/v1/metadata`;

// Wizard steps enum
enum WizardStep {
    CONFIGURE_TOKEN = 0,
    TGE_SETUP = 1,
    SET_UP_METADATA = 2,
    REVIEW_DEPLOY = 3,
}

// Stepper Component
const ContractStepper = ({ currentStep }: { currentStep: WizardStep }) => {
    const steps = [
        { id: WizardStep.CONFIGURE_TOKEN, label: "Configure Token" },
        { id: WizardStep.TGE_SETUP, label: "Token Distribution" },
        { id: WizardStep.SET_UP_METADATA, label: "Set Up Metadata" },
        { id: WizardStep.REVIEW_DEPLOY, label: "Deploy Contract" },
    ];

    return (
        <div className="mb-8 flex items-center justify-between">
            {steps.map((step, index) => (
                <>
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${currentStep >= step.id
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted bg-muted/50 text-muted-foreground"
                                }`}
                        >
                            {currentStep > step.id ? <Check className="h-5 w-5" /> : index + 1}
                        </div>
                        <span className="text-xs mt-2">{step.label}</span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className="h-[2px] flex-1 bg-muted mx-2" />
                    )}
                </>
            ))}
        </div>
    );
};

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

    // Wizard state
    const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.CONFIGURE_TOKEN);

    // TGE State
    const [tgeMethod, setTgeMethod] = useState<'mint_to_deployer' | 'add_to_lp'>('mint_to_deployer');
    const [lpPercentage, setLpPercentage] = useState<string>("20"); // Default LP percentage if chosen

    // Get contract name from token name
    const contractName = generateContractNameFromTokenName(tokenName) || 'my-token';

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
                    const response = await fetch(`${METADATA_API_URL}/${contractIdentifier}`);

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

    // Navigation functions
    const nextStep = () => {
        if (currentStep === WizardStep.CONFIGURE_TOKEN) {
            if (!validateForm()) {
                toast({
                    variant: "destructive",
                    title: "Validation Error",
                    description: "Please fix the form errors before proceeding.",
                });
                return;
            }
        } else if (currentStep === WizardStep.TGE_SETUP) {
            const percentage = parseFloat(lpPercentage);
            if (tgeMethod === 'add_to_lp' && (isNaN(percentage) || percentage <= 0 || percentage >= 100)) {
                toast({
                    variant: "destructive",
                    title: "Invalid Percentage",
                    description: "LP percentage must be between 0 and 100.",
                });
                return;
            }
        } else if (currentStep === WizardStep.SET_UP_METADATA) {
            if (!hasMetadata) {
                toast({
                    variant: "destructive",
                    title: "Metadata Required",
                    description: "Please set up token metadata before proceeding. Click 'Add Metadata' or 'Refresh Metadata'.",
                });
                return;
            }
        }

        if (currentStep < WizardStep.REVIEW_DEPLOY) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > WizardStep.CONFIGURE_TOKEN) {
            setCurrentStep(currentStep - 1);
        }
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
            setCurrentStep(WizardStep.CONFIGURE_TOKEN);
            return;
        }

        if (!hasMetadata) {
            toast({
                variant: "destructive",
                title: "Metadata Required",
                description: "Please set up token metadata before deploying. Click 'Add Metadata' in the preview section.",
            });
            setCurrentStep(WizardStep.SET_UP_METADATA);
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

            // Redirect based on TGE method
            if (tgeMethod === 'add_to_lp') {
                // Calculate amount for LP based on percentage
                const amountForLP = (parseFloat(initialSupply) * (parseFloat(lpPercentage) / 100));

                // Construct URL for LP creation page
                const lpRedirectUrl = new URL('/templates/liquidity-pool', window.location.origin);
                lpRedirectUrl.searchParams.set('tokenA', contractIdentifier);
                lpRedirectUrl.searchParams.set('tokenB', CHR_TOKEN_ADDRESS);
                lpRedirectUrl.searchParams.set('fee', FIXED_LP_FEE_PERCENT.toString());
                lpRedirectUrl.searchParams.set('amountA', amountForLP.toString());
                lpRedirectUrl.searchParams.set('useRatio', 'true');

                toast({
                    title: "Next Step: Create Liquidity Pool",
                    description: `Redirecting you to set up the ${tokenSymbol}-${CHR_TOKEN_SYMBOL} liquidity pool...`,
                });

                setTimeout(() => {
                    router.push(lpRedirectUrl.pathname + lpRedirectUrl.search);
                }, 2000);

            } else {
                router.push(`/contracts?txid=${result.txid}`);
            }

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
                    <ContractStepper currentStep={currentStep} />

                    {/* Step 1: Configure Token */}
                    {currentStep === WizardStep.CONFIGURE_TOKEN && (
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
                                        <SelectContent className="bg-background">
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
                                            This will create {calculateAtomicSupply(initialSupply, decimals)} atomic units of your token
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end">
                                <Button onClick={nextStep}>Continue to Distribution</Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* Step 2: Set Up TGE */}
                    {currentStep === WizardStep.TGE_SETUP && (
                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle>Token Distribution (TGE)</CardTitle>
                                <CardDescription>
                                    Choose how the initial tokens will be distributed upon deployment.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <RadioGroup
                                    value={tgeMethod}
                                    onValueChange={(value: 'mint_to_deployer' | 'add_to_lp') => setTgeMethod(value)}
                                    className="space-y-4"
                                >
                                    {/* Option 1: Mint all to deployer */}
                                    <Label
                                        htmlFor="mint_to_deployer"
                                        className={`flex items-start space-x-3 rounded-md border p-4 cursor-pointer transition-colors ${tgeMethod === 'mint_to_deployer' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    >
                                        <RadioGroupItem value="mint_to_deployer" id="mint_to_deployer" className="mt-1" />
                                        <div className="flex-1">
                                            <span className="font-medium">Mint All to Deployer</span>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                The entire initial supply of your token will be minted directly to your connected wallet address ({stxAddress ? truncateAddress(stxAddress) : '...'}).
                                                This is the simplest option.
                                            </p>
                                        </div>
                                    </Label>

                                    {/* Option 2: Add portion to LP */}
                                    <Label
                                        htmlFor="add_to_lp"
                                        className={`flex items-start space-x-3 rounded-md border p-4 cursor-pointer transition-colors ${tgeMethod === 'add_to_lp' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                    >
                                        <RadioGroupItem value="add_to_lp" id="add_to_lp" className="mt-1" />
                                        <div className="flex-1">
                                            <span className="font-medium">Create Liquidity Pool</span>
                                            <p className="text-sm text-muted-foreground mt-1 mb-4">
                                                A portion of the initial supply will be prepared for a new liquidity pool paired with Charisma ({CHR_TOKEN_SYMBOL}) using a {FIXED_LP_FEE_PERCENT}% swap fee.
                                                As the liquidity provider, you will recieve a share of these fees based on how much you provide to the pool.
                                                You will be guided to deploy the pool contract after the token is deployed.
                                            </p>
                                            {tgeMethod === 'add_to_lp' && (
                                                <div className="mt-4 space-y-3 pt-4 border-t">
                                                    <Label htmlFor="lpPercentage">Percentage of Supply for Pool ({lpPercentage}%)</Label>
                                                    <div className="flex items-center space-x-4">
                                                        <Slider
                                                            id="lpPercentage"
                                                            min={1}
                                                            max={99}
                                                            step={1}
                                                            value={[parseInt(lpPercentage)]}
                                                            onValueChange={(value: number[]) => setLpPercentage(value[0].toString())}
                                                            className="flex-1"
                                                        />
                                                        <Input
                                                            type="number"
                                                            value={lpPercentage}
                                                            onChange={(e) => {
                                                                const val = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
                                                                setLpPercentage(val.toString());
                                                            }}
                                                            className="w-20 text-center"
                                                            min="1"
                                                            max="99"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Approximately {calculateAtomicSupply((parseFloat(initialSupply || '0') * (parseFloat(lpPercentage) / 100)).toString(), decimals)} {tokenSymbol || 'tokens'} will be allocated.
                                                        You will need to supply the corresponding {CHR_TOKEN_SYMBOL}.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </Label>
                                </RadioGroup>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline" onClick={prevStep}>
                                    Back
                                </Button>
                                <Button onClick={nextStep}>
                                    Continue to Metadata Setup
                                </Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* Step 3: Metadata Setup */}
                    {currentStep === WizardStep.SET_UP_METADATA && (
                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle>Token Metadata</CardTitle>
                                <CardDescription>
                                    Review and verify the on-chain metadata for your token. Wallets and explorers use this information.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {/* Combined Metadata Info (Image/Name/Description) - Columns 1-2 */}
                                <div className="md:col-span-2 space-y-4 flex flex-col">
                                    {/* Image Preview and Link */}
                                    <div className="flex flex-col items-start space-y-2">
                                        <Label className="text-sm text-muted-foreground">Preview</Label>
                                        <a
                                            href={`${METADATA_BASE_URL}/tokens/new?tokenId=${encodeURIComponent(contractIdentifier?.split('.')?.pop() || '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="group"
                                        >
                                            <div className={`border ${hasMetadata ? 'border-green-500' : isCorsError ? 'border-amber-500' : metadataApiError ? 'border-destructive' : 'border-dashed'} rounded-md aspect-square w-32 h-32 flex items-center justify-center ${hasMetadata ? 'bg-green-50/20' : isCorsError ? 'bg-amber-50/20' : metadataApiError ? 'bg-destructive/5' : 'bg-muted/30 group-hover:bg-muted/50'} transition-colors relative overflow-hidden`}>
                                                {hasMetadata ? (
                                                    <>
                                                        {metadata?.image ? (
                                                            <img src={metadata.image} alt={metadata.name || 'Token'} className="w-full h-full object-cover rounded-md" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                                        ) : (
                                                            // Fallback icon if image exists but fails or no image
                                                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                                                {metadata?.symbol ? (
                                                                    <span className="text-2xl font-bold text-green-600">{metadata.symbol.charAt(0)}</span>
                                                                ) : (
                                                                    <Check className="w-8 h-8 text-green-600" />
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="z-10 bg-green-500 rounded-full p-1 absolute bottom-2 right-2 shadow-sm">
                                                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                                        </div>
                                                    </>
                                                ) : isCheckingMetadata ? (
                                                    <svg className="animate-spin h-8 w-8 text-primary/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                ) : isCorsError ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 h-8 w-8"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                ) : metadataApiError ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive h-8 w-8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                                ) : (
                                                    <ExternalLink className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
                                                )}
                                            </div>
                                        </a>
                                        <div className="text-sm text-center font-medium">
                                            {hasMetadata ? 'Metadata Ready' : isCorsError ? 'CORS Error' : metadataApiError ? 'Service Unavailable' : 'Add/Refresh Metadata'}
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Name</Label>
                                        <div className="font-medium mt-1 break-words">{metadata?.name || tokenName || <span className="italic text-muted-foreground">Not specified</span>}</div>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Description</Label>
                                        <div className="text-sm bg-muted/30 p-3 rounded-md mt-1 min-h-[6rem] max-h-40 overflow-y-auto break-words">
                                            {metadata?.description || <span className="italic text-muted-foreground">No description provided in metadata.</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Token Details (Symbol/Decimals) - Column 3 */}
                                <div className="md:col-span-1 space-y-4">
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Symbol</Label>
                                        <div className="font-medium mt-1">{metadata?.symbol || tokenSymbol || <span className="italic text-muted-foreground">Not specified</span>}</div>
                                    </div>
                                    <div>
                                        <Label className="text-sm text-muted-foreground">Decimals</Label>
                                        <div className="font-medium mt-1">{metadata?.decimals ?? decimals}</div>
                                    </div>
                                    {/* Optionally add other relevant info here later */}
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline" onClick={prevStep}>Back</Button>
                                <Button onClick={nextStep} disabled={!hasMetadata}>Continue to Review & Deploy</Button>
                            </CardFooter>
                        </Card>
                    )}

                    {/* Step 4: Review & Deploy - Reconstructed */}
                    {currentStep === WizardStep.REVIEW_DEPLOY && (
                        <>
                            {/* Deployment Preview Card */}
                            <Card className="mb-8">
                                <CardHeader>
                                    <CardTitle>Deployment Preview</CardTitle>
                                    <CardDescription>
                                        Review your token before deployment
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Token Metadata Visual (Column 1) */}
                                        <div className="md:col-span-1">
                                            <h3 className="text-sm font-medium mb-3">Token Metadata</h3>
                                            <div className="border rounded-md p-4 bg-muted/20 flex flex-col items-center">
                                                <a
                                                    href={`${METADATA_BASE_URL}/tokens/new?tokenId=${encodeURIComponent(contractIdentifier?.split('.')?.pop() || '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mb-2"
                                                >
                                                    {/* Metadata Image/Icon Box */}
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
                                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                                const fallbackEl = e.currentTarget.parentElement?.querySelector('.image-fallback');
                                                                                if (fallbackEl) fallbackEl.classList.remove('hidden');
                                                                            }}
                                                                        />
                                                                        <div className="image-fallback hidden absolute inset-0 sm:flex items-center justify-center bg-muted/20">
                                                                            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                                                                                {metadata?.symbol ? (
                                                                                    <span className="text-2xl font-bold text-muted-foreground">
                                                                                        {metadata.symbol.charAt(0)}
                                                                                    </span>
                                                                                ) : (
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="19.07" x2="19.07" y2="4.93" /></svg>
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
                                                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="z-10 bg-green-500 rounded-full p-1 absolute bottom-2 right-2 shadow-sm">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                </div>
                                                            </>
                                                        ) : isCheckingMetadata ? (
                                                            <svg className="animate-spin h-8 w-8 text-primary/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                        ) : isCorsError ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 h-8 w-8"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                        ) : metadataApiError ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive h-8 w-8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                                        ) : (
                                                            <ExternalLink className="h-8 w-8 text-muted-foreground group-hover:text-foreground" />
                                                        )}
                                                    </div>
                                                    {/* Metadata Status Text */}
                                                    <div className="text-sm text-center mt-2 font-medium">
                                                        {hasMetadata ? "Metadata Ready" : isCorsError ? "CORS Error" : metadataApiError ? "Service Unavailable" : "Add/Refresh Metadata"}
                                                    </div>
                                                </a>
                                            </div>
                                        </div>

                                        {/* Token Details Summary (Columns 2-3) */}
                                        <div className="md:col-span-2">
                                            <h3 className="text-sm font-medium mb-3 flex items-center">
                                                Token Details
                                                {/* Metadata Required Badge */}
                                                {!hasMetadata && !metadataApiError && (
                                                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center">
                                                        Metadata Required
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" className="h-4 w-4 p-0 ml-1">
                                                                        <HelpCircle className="h-3 w-3 text-amber-800" />
                                                                        <span className="sr-only">Info</span>
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="w-80">
                                                                    <p className="mb-2">Your token requires metadata before it can be deployed.</p>
                                                                    <p>Go back to the Metadata Setup step or click the icon above.</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </span>
                                                )}
                                            </h3>
                                            {/* Details Box */}
                                            <div className="border rounded-md p-4 bg-muted/20 h-fit">
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Name, Symbol, Decimals, Supply */}
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

                                                    {/* Description (if available) */}
                                                    {hasMetadata && metadata?.description && (
                                                        <div className="col-span-2 mt-2">
                                                            <div className="text-sm text-muted-foreground mb-1">Description</div>
                                                            <div className="text-sm bg-muted/20 p-2 rounded-md max-h-24 overflow-y-auto">
                                                                {metadata.description}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Features Summary */}
                                                    <div className="col-span-2">
                                                        <div className="text-sm text-muted-foreground mb-1">Features</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                                                {isMintable ? "Mintable" : "Not Mintable"} (Pro)
                                                            </span>
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                                                                {isBurnable ? "Burnable" : "Not Burnable"} (Pro)
                                                            </span>
                                                            {hasMetadata && (
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                    Metadata Ready
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* TGE Method Summary */}
                                                    <div className="col-span-2 mt-4 pt-4 border-t">
                                                        <div className="text-sm text-muted-foreground mb-1">Token Distribution Method</div>
                                                        {tgeMethod === 'mint_to_deployer' ? (
                                                            <p className="text-sm">Mint all tokens to deployer address.</p>
                                                        ) : (
                                                            <p className="text-sm">
                                                                Allocate {lpPercentage}% of supply to a new Liquidity Pool paired with {CHR_TOKEN_SYMBOL} ({FIXED_LP_FEE_PERCENT}% fee).
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Contract Identifier */}
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

                            {/* Token Features Card (Paywalled/Disabled) */}
                            <Card className="mb-8 relative">
                                {/* Overlay */}
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
                                {/* Card Content */}
                                <CardHeader>
                                    <CardTitle>Token Features</CardTitle>
                                    <CardDescription>
                                        Configure additional capabilities for your token
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Mintable Option */}
                                    <div className="flex items-center justify-between">
                                        {/* Label and Tooltip */}
                                        <div className="space-y-0.5">
                                            <div className="flex items-center">
                                                <Label htmlFor="isMintable" className="text-base">Mintable</Label>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" className="h-5 w-5 p-0 ml-1">
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
                                            <p className="text-sm text-muted-foreground">Allow creating additional tokens after deployment</p>
                                        </div>
                                        {/* Switch */}
                                        <Switch id="isMintable" checked={isMintable} onCheckedChange={setIsMintable} disabled />
                                    </div>
                                    {/* Burnable Option */}
                                    <div className="flex items-center justify-between">
                                        {/* Label and Tooltip */}
                                        <div className="space-y-0.5">
                                            <div className="flex items-center">
                                                <Label htmlFor="isBurnable" className="text-base">Burnable</Label>
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" className="h-5 w-5 p-0 ml-1">
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
                                            <p className="text-sm text-muted-foreground">Allow token holders to burn their tokens</p>
                                        </div>
                                        {/* Switch */}
                                        <Switch id="isBurnable" checked={isBurnable} onCheckedChange={setIsBurnable} disabled />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Action Buttons */}
                            <div className="flex justify-between mt-8">
                                <Button variant="outline" onClick={prevStep}>
                                    Back
                                </Button>
                                <Button
                                    onClick={handleDeploy}
                                    disabled={isDeploying || !hasMetadata}
                                    className="min-w-[150px]"
                                >
                                    {isDeploying ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Deploying...
                                        </>
                                    ) : (
                                        "Deploy Token"
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:w-80">
                    <DeploymentSidebar
                        stxAddress={stxAddress}
                        deploymentCost="20 STX"
                        standardName="SIP-010 Fungible Token"
                        standardLink="https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md"
                        documentationLink="https://book.stacks.tools/tokens/sip10"
                    />
                </div>
            </div>
        </div>
    );
} 