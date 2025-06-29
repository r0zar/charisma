"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast as sonnerToast } from "sonner";
import { useApp } from "@/lib/context/app-context";
import { ArrowLeft, Globe, ExternalLink } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils/token-utils";
import { fetchSingleTokenMetadataDirectly, saveSublinkDataToDexCache, SublinkDexEntry } from '@/app/actions';
import { TokenCacheData } from "@repo/tokens";
import { generateSublink } from "@/lib/contract-generators/sublink";
import { generate1x1ColorPixel } from "@/lib/utils/image-utils";
import TokenSelectionStep from "./token-selection-step";
import PreviewStep from "./preview-step";
import ContractStepper from "./contract-stepper";

// Wizard steps
enum WizardStep {
    SELECT_SUBNET_TOKEN = 0,
    PREVIEW = 1,
    DEPLOY = 2,
}

// Main Sublink Wizard Component
export default function SublinkWizard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { authenticated, stxAddress, deployContract, tokens, loading: tokensLoading } = useApp();

    const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SELECT_SUBNET_TOKEN);
    const [isDeploying, setIsDeploying] = useState(false);
    const [txid, setTxid] = useState<string | null>(null);
    const [contractCode, setContractCode] = useState("");

    // Token info
    const [selectedToken, setSelectedToken] = useState<TokenCacheData | null>(null);
    const [tokenDetails, setTokenDetails] = useState<TokenCacheData | null>(null);

    // Subnet token info  
    const [selectedSubnetToken, setSelectedSubnetToken] = useState<TokenCacheData | null>(null);

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
                    setCurrentStep(WizardStep.PREVIEW);
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
            // Remove non-alphanumeric characters except hyphens, then convert to lowercase
            const cleanSymbol = tokenSymbol.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            return `${cleanSymbol}-sublink`;
        }
        // Fallback: extract from address
        const parts = address.split('.');
        return (parts.length > 1 ? parts[1] : address).toLowerCase().replace(/[^a-z0-9-]/g, '-') + '-sublink';
    };

    // Calculate the contract name based on the selected base token (not subnet token)
    const contractName = selectedToken?.symbol
        ? deriveName(selectedToken.symbol, selectedToken.contractId)
        : "";

    // Filter tokens for sublink - only show subnet tokens or tokens that have corresponding subnet tokens
    const getSubnetRelatedTokens = () => {
        const subnetTokens = tokens.filter(token => token.type === 'SUBNET');
        return [...subnetTokens];
    };

    // Navigation functions
    const nextStep = async () => {
        if (currentStep < WizardStep.DEPLOY) {
            setCurrentStep(prevStep => (prevStep + 1) as WizardStep);
        }
    };

    const prevStep = () => {
        if (currentStep > WizardStep.SELECT_SUBNET_TOKEN) {
            setCurrentStep(prevStep => (prevStep - 1) as WizardStep);
        }
    };

    // Handle token selection - now handles subnet token selection directly
    const handleSelectToken = async (token: TokenCacheData) => {
        setSelectedSubnetToken(token);
        setConfig(prev => ({ ...prev, subnetContract: token.contractId }));

        // Get the base token from the subnet token's .base property
        if (token.base) {
            setConfig(prev => ({ ...prev, tokenContract: token.base! }));
            // Try to find the base token details from our token list
            const baseToken = tokens.find(t => t.contractId === token.base);
            if (baseToken) {
                setSelectedToken(baseToken);
                setTokenDetails(baseToken);
            } else {
                // If not found in our list, fetch it directly
                const result = await fetchSingleTokenMetadataDirectly(token.base);
                if (result.meta) {
                    setSelectedToken(result.meta);
                    setTokenDetails(result.meta);
                }
            }
        } else {
            console.warn('Subnet token missing base property:', token);
        }

        // Skip subnet selection step and go directly to preview
        setCurrentStep(WizardStep.PREVIEW);
    };

    // Handle custom token selection - now handles custom subnet token
    const handleCustomTokenSubmit = async (contractId: string) => {
        await fetchTokenMetadataDirectly(contractId);
        // Skip subnet selection step since we selected a subnet token directly
        setCurrentStep(WizardStep.PREVIEW);
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

            const deployedContractIdentifier = stxAddress ? `${stxAddress}.${contractName}` : contractName;

            // --- Save Sublink data to Vercel KV / dex-cache ---
            if (config.tokenContract && config.subnetContract && deployedContractIdentifier && selectedToken && selectedSubnetToken) {
                try {
                    // Fetch full metadata for both tokens to ensure we have complete data
                    const [tokenAResult, tokenBResult] = await Promise.all([
                        fetchSingleTokenMetadataDirectly(config.tokenContract),
                        fetchSingleTokenMetadataDirectly(config.subnetContract)
                    ]);

                    if (tokenAResult.meta && tokenBResult.meta) {
                        const sublinkDexData: SublinkDexEntry = {
                            name: contractName,
                            image: generate1x1ColorPixel('random'), // Using random color pixel
                            contractId: deployedContractIdentifier,
                            type: "SUBLINK",
                            protocol: "CHARISMA",
                            tokenAContract: config.tokenContract, // Source Token
                            tokenBContract: config.subnetContract,  // Subnet Token (acts as TokenB in vault context)
                            tokenA: tokenAResult.meta, // Full metadata for the source token
                            tokenB: tokenBResult.meta, // Full metadata for the subnet token
                        };

                        const kvSaveResult = await saveSublinkDataToDexCache(deployedContractIdentifier, sublinkDexData);
                        if (kvSaveResult.success) {
                            sonnerToast.success("Dex Cache Update (Sublink)", { description: kvSaveResult.message });
                        } else {
                            sonnerToast.warning("Dex Cache Update Failed (Sublink)", { description: kvSaveResult.error });
                        }
                    } else {
                        sonnerToast.warning("Dex Cache Update Skipped (Sublink)", {
                            description: "Could not fetch complete token metadata for both tokens."
                        });
                    }
                } catch (metadataError) {
                    console.error("Error fetching token metadata for dex cache:", metadataError);
                    sonnerToast.warning("Dex Cache Update Skipped (Sublink)", {
                        description: "Failed to fetch token metadata for dex cache entry."
                    });
                }
            } else {
                sonnerToast.warning("Dex Cache Update Skipped (Sublink)", { description: "Missing data for sublink dex cache entry." });
            }
            // --- End Save Sublink data to Vercel KV ---

            // Redirect to the new success page
            router.push(`/templates/sublink/deploy-success?txid=${result.txid}&contractName=${encodeURIComponent(contractName)}&contractIdentifier=${encodeURIComponent(deployedContractIdentifier)}&sourceTokenContractId=${encodeURIComponent(config.tokenContract)}&subnetTokenContractId=${encodeURIComponent(config.subnetContract)}`);

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
                    subnetContract: config.subnetContract,
                    metadataUri: config.metadataUri
                });
                setContractCode(generatedCode.code);
            }
        };
        updateContractCode();
         
    }, [currentStep, config.metadataUri, config.tokenContract, config.subnetContract, selectedToken?.symbol]);

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
                    {currentStep === WizardStep.SELECT_SUBNET_TOKEN && (
                        <TokenSelectionStep
                            onSelectToken={handleSelectToken}
                            onCustomSubmit={handleCustomTokenSubmit}
                            isLoadingTokens={tokensLoading}
                            predefinedTokens={getSubnetRelatedTokens()}
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
                                <h3 className="font-medium mb-1">Subnet Token</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedSubnetToken ? (
                                        <span className="flex items-center gap-1">
                                            {selectedSubnetToken.symbol}
                                            <span className="text-xs opacity-70">({truncateAddress(selectedSubnetToken.contractId)})</span>
                                        </span>
                                    ) : 'Not selected yet'}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-medium mb-1">Base Token</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedToken ? (
                                        <span className="flex items-center gap-1">
                                            {selectedToken.symbol}
                                            <span className="text-xs opacity-70">({truncateAddress(selectedToken.contractId)})</span>
                                        </span>
                                    ) : selectedSubnetToken?.base ? truncateAddress(selectedSubnetToken.base) : 'Auto-detected from subnet'}
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