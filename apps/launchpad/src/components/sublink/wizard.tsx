"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast as sonnerToast } from "sonner";
import { useApp } from "@/lib/context/app-context";
import { ArrowLeft, HelpCircle, Globe, ExternalLink, Search, X, Check, Network, FileSignature, Loader2 } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils/token-utils";
import { fetchSingleTokenMetadataDirectly } from '@/app/actions';
import { TokenCacheData } from "@repo/tokens";
import { generateSublink } from "@/lib/contract-generators/sublink";
import TokenSelectionStep from "./token-selection-step";
import SubnetTokenSelectionStep from "./subnet-token-selection-step";
import PreviewStep from "./preview-step";
import ContractStepper from "./contract-stepper";

// Wizard steps
enum WizardStep {
    SELECT_SOURCE_TOKEN = 0,
    SELECT_SUBNET_TOKEN = 1,
    PREVIEW = 2,
    DEPLOY = 3,
}

// Main Sublink Wizard Component
export default function SublinkWizard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { authenticated, stxAddress, deployContract, tokens, loading: tokensLoading } = useApp();

    const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SELECT_SOURCE_TOKEN);
    const [isDeploying, setIsDeploying] = useState(false);
    const [txid, setTxid] = useState<string | null>(null);
    const [contractCode, setContractCode] = useState("");

    // Token info
    const [selectedToken, setSelectedToken] = useState<TokenCacheData | null>(null);
    const [tokenDetails, setTokenDetails] = useState<TokenCacheData | null>(null);

    // Subnet token info
    const [selectedSubnetToken, setSelectedSubnetToken] = useState<TokenCacheData | null>(null);
    const [subnetTokenDetails, setSubnetTokenDetails] = useState<TokenCacheData | null>(null);

    // Configuration state
    const [config, setConfig] = useState({
        tokenContract: "",
        subnetContract: "",
        metadataUri: ""
    });

    // When a token is selected from the parameter or UI
    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            // If token parameter is provided, try to load it
            fetchTokenMetadataDirectly(tokenParam);
        }
    }, [searchParams]);

    // Function to fetch token metadata directly
    const fetchTokenMetadataDirectly = async (contractId: string) => {
        try {
            sonnerToast.info("Fetching token data...");
            const result = await fetchSingleTokenMetadataDirectly(contractId);

            if (result.error) {
                throw new Error(result.error);
            }

            if (result.meta) {
                const tokenData = result.meta;
                setTokenDetails(tokenData);
                setSelectedToken({
                    symbol: tokenData.symbol || "",
                    name: tokenData.name || "",
                    contractId: tokenData.contractId || contractId,
                    description: tokenData.description || '',
                    image: tokenData.image || 'https://placehold.co/100',
                    decimals: tokenData.decimals,
                    identifier: tokenData.identifier,
                    type: tokenData.type
                });

                // Update config with the selected token
                setConfig(prev => ({
                    ...prev,
                    tokenContract: tokenData.contractId || contractId
                }));

                // Move to next step if token was loaded from URL parameter
                if (searchParams.get('token')) {
                    setCurrentStep(WizardStep.SELECT_SUBNET_TOKEN);
                }
            } else {
                throw new Error("Token metadata not found");
            }
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            sonnerToast.error("Token Fetch Error", {
                description: error instanceof Error ? error.message : 'Failed to fetch token data'
            });
        }
    };

    // Generate the contract name based on token symbol
    const deriveName = (tokenSymbol: string, address: string) => {
        if (tokenSymbol) {
            return `${tokenSymbol.toLowerCase()}-sublink`;
        }
        // Fallback: extract from address
        const parts = address.split('.');
        return (parts.length > 1 ? parts[1] : address).toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-sublink';
    };

    // Calculate the contract name based on the selected token
    const contractName = selectedToken?.symbol
        ? deriveName(selectedToken.symbol, selectedToken.contractId)
        : "";

    // Navigation functions
    const nextStep = async () => {
        if (currentStep < WizardStep.DEPLOY) {
            setCurrentStep(prevStep => (prevStep + 1) as WizardStep);
        }
    };

    const prevStep = () => {
        if (currentStep > WizardStep.SELECT_SOURCE_TOKEN) {
            setCurrentStep(prevStep => (prevStep - 1) as WizardStep);
        }
    };

    // Handle token selection
    const handleSelectToken = async (token: TokenCacheData) => {
        setSelectedToken(token);
        setConfig(prev => ({ ...prev, tokenContract: token.contractId }));
        await fetchTokenMetadataDirectly(token.contractId);
        // Try to find a subnet token with .base === selected token's contractId
        const subnet = tokens.find(
            t => t.type === 'SUBNET' && t.base === token.contractId
        );
        if (subnet) {
            setSelectedSubnetToken(subnet);
            setConfig(prev => ({ ...prev, tokenContract: token.contractId }));
            await fetchTokenMetadataDirectly(subnet.contractId);
            setCurrentStep(WizardStep.PREVIEW);
        } else {
            nextStep();
        }
    };

    // Handle custom token selection
    const handleCustomTokenSubmit = async (contractId: string) => {
        await fetchTokenMetadataDirectly(contractId);
        // Try to find a subnet token with .base === contractId
        const subnet = tokens.find(
            t => t.type === 'SUBNET' && t.base === contractId
        );
        if (subnet) {
            setSelectedSubnetToken(subnet);
            setConfig(prev => ({ ...prev, tokenContract: contractId }));
            await fetchTokenMetadataDirectly(subnet.contractId);
            setCurrentStep(WizardStep.PREVIEW);
        } else {
            nextStep();
        }
    };

    // Handle subnet token selection
    const handleSelectSubnetToken = (token: TokenCacheData) => {
        setSelectedSubnetToken(token);
        setConfig(prev => ({ ...prev, subnetContract: token.contractId }));
        fetchTokenMetadataDirectly(token.contractId);
        nextStep();
    };

    // Handle custom subnet token selection
    const handleCustomSubnetTokenSubmit = async (contractId: string) => {
        const result = await fetchSingleTokenMetadataDirectly(contractId);
        if (result.meta) {
            setSelectedSubnetToken(result.meta);
            if (result.meta.contractId) {
                setConfig(prev => ({ ...prev, subnetContract: result.meta!.contractId }));
            }
        }
        nextStep();
    };

    // Handle deploy action
    const handleDeploy = async () => {
        if (!authenticated) {
            sonnerToast.error("Authentication Required", {
                description: "Please connect your wallet to deploy a contract."
            });
            return;
        }
        try {
            setIsDeploying(true);
            sonnerToast.info("Preparing Deployment", {
                description: "Generating contract..."
            });
            // Deploy the contract
            const result = await deployContract(contractCode, contractName);
            setTxid(result.txid);
            sonnerToast.success("Deployment Initiated", {
                description: `Tx ID: ${result.txid.substring(0, 10)}...`
            });
            // Redirect to contracts page after successful deployment
            router.push(`/contracts?txid=${result.txid}`);
        } catch (error) {
            console.error("Deployment error:", error);
            sonnerToast.error("Deployment Failed", {
                description: error instanceof Error ? error.message : "There was an error deploying your contract. Please try again.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    // Regenerate contract code whenever relevant inputs change in PREVIEW step
    useEffect(() => {
        const updateContractCode = async () => {
            if (currentStep === WizardStep.PREVIEW) {
                const generatedCode = await generateSublink({
                    tokenName: selectedToken?.symbol || "",
                    subnetContract: selectedSubnetToken?.contractId || "",
                    metadataUri: config.metadataUri
                });
                setContractCode(generatedCode.code);
            }
        };
        updateContractCode();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep, config.metadataUri, config.tokenContract, config.subnetContract, selectedToken?.symbol, selectedSubnetToken?.contractId]);

    // Handle authentication flow
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
                        Please connect your wallet to deploy a subnet contract.
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
                        <Globe className="h-6 w-6 mr-2 text-primary" />
                        Deploy Subnet Link
                    </h1>
                    <p className="text-muted-foreground mb-8">
                        Create a subnet link for your token. This will allow your token to be used with off-chain signatures and gasless transactions.
                    </p>

                    <ContractStepper currentStep={currentStep} />

                    {/* Step content */}
                    {currentStep === WizardStep.SELECT_SOURCE_TOKEN && (
                        <TokenSelectionStep
                            onSelectToken={handleSelectToken}
                            onCustomSubmit={handleCustomTokenSubmit}
                            isLoadingTokens={tokensLoading}
                            predefinedTokens={tokens}
                        />
                    )}

                    {currentStep === WizardStep.SELECT_SUBNET_TOKEN && (
                        <SubnetTokenSelectionStep
                            onSelectToken={handleSelectSubnetToken}
                            isLoadingTokens={tokensLoading}
                            predefinedTokens={tokens}
                            onCustomSubmit={handleCustomSubnetTokenSubmit}
                            sourceTokenSymbol={selectedToken?.symbol || ""}
                        />
                    )}

                    {currentStep === WizardStep.PREVIEW && (
                        <PreviewStep
                            state={config}
                            contractCode={contractCode}
                            tokenName={selectedToken?.name || ""}
                            tokenSymbol={selectedToken?.symbol || ""}
                            contractName={contractName}
                            onPrevious={prevStep}
                            onDeploy={handleDeploy}
                            isDeploying={isDeploying}
                            onMetadataUriChange={(uri) => setConfig(prev => ({ ...prev, metadataUri: uri }))}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:w-80">
                    <Card className="sticky top-24">
                        <CardHeader>
                            <CardTitle>Deployment Information</CardTitle>
                            <CardDescription>
                                Important details about your deployment
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
                                <h3 className="font-medium mb-1">Base Token</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedToken ? (
                                        <span className="flex items-center gap-1">
                                            {selectedToken.symbol}
                                            <span className="text-xs opacity-70">({truncateAddress(selectedToken.contractId)})</span>
                                        </span>
                                    ) : 'Not selected yet'}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-1">Deployment Cost</h3>
                                <p className="text-sm text-muted-foreground">0 STX</p>
                            </div>
                        </CardContent>
                        <CardFooter className="border-t pt-6 flex flex-col items-start">
                            <h3 className="font-medium mb-2">Resources</h3>
                            <ul className="space-y-2 w-full">
                                <li>
                                    <a
                                        href="https://docs.charisma.rocks/subnet"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm flex items-center text-primary hover:underline"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> Subnet Documentation
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