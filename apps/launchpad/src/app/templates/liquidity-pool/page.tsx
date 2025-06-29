"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast as sonnerToast } from "sonner";
import { useApp } from "@/lib/context/app-context";
import { ArrowLeft, Layers, ExternalLink } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils/token-utils";
import { generateLiquidityPoolContract } from "@/lib/templates/liquidity-pool-contract-template";
import { TokenMetadata } from "@/lib/metadata-service";
import { Check } from "lucide-react";
import { PostCondition } from "@stacks/connect/dist/types/methods";
import { TokenSelectionStep } from "@/components/liquidity-pool-wizard/token-selection-step";
import { PoolConfigStep } from "@/components/liquidity-pool-wizard/pool-config-step";
import { InitializePoolStep } from "@/components/liquidity-pool-wizard/initialize-pool-step";
import { ReviewDeployStep } from "@/components/liquidity-pool-wizard/review-deploy-step";
import { TokenCacheData, listPrices } from "@repo/tokens";
import { fetchTokenMetadataPairDirectly, saveMetadataToDexCache, Vault } from '@/app/actions';

// Metadata constants
const METADATA_BASE_URL = process.env.NEXT_PUBLIC_METADATA_BASE_URL || 'https://metadata.charisma.rocks'
const METADATA_API_URL = `${METADATA_BASE_URL}/api/v1/metadata`;

// Wizard steps
enum WizardStep {
    SELECT_TOKENS = 0,
    CONFIGURE_POOL = 1,
    INITIALIZE_POOL = 2,
    REVIEW_DEPLOY = 3,
}

// Token type - REMOVE LOCAL Token interface, use TokenCacheData from @repo/tokens
// interface Token {
//     symbol: string;
//     name: string;
//     address: string; 
//     description?: string;
//     image?: string;
//     decimals?: number;
//     isSubnet?: boolean;
//     isLpToken?: boolean;
//     total_supply?: string | null;
//     identifier?: string; 
// }

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

// Wrap the component logic in a separate component to use hooks
function LiquidityPoolWizard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        authenticated,
        stxAddress,
        deployContract,
        signMessage,
        tokens, // This is from useApp, likely already TokenCacheData[]
        loading: contextLoading,
        tokensError,
        fetchTokens
    } = useApp();
    const [isDeploying, setIsDeploying] = useState(false);
    const [txid, setTxid] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<TokenMetadata | null>(null); // This seems specific to the LP token being created
    const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
    const [metadataApiError, setMetadataApiError] = useState(false);
    const [hasMetadataFlag, setHasMetadataFlag] = useState(false);

    // Hoisted state definitions
    const [token1Symbol, setToken1Symbol] = useState<string>(""); // Changed from token1 to token1Symbol for clarity
    const [token2Symbol, setToken2Symbol] = useState<string>(""); // Changed from token2 to token2Symbol for clarity
    const [token1Details, setToken1Details] = useState<TokenCacheData | null>(null); // Use TokenCacheData
    const [token2Details, setToken2Details] = useState<TokenCacheData | null>(null); // Use TokenCacheData
    // token1Address and token2Address can be derived from token1Details/token2Details.contractId
    // const [token1Address, setToken1Address] = useState<string>("");
    // const [token2Address, setToken2Address] = useState<string>("");
    const [poolName, setPoolName] = useState("");
    const [lpTokenSymbol, setLpTokenSymbol] = useState("");
    const [swapFee, setSwapFee] = useState<string>("0.3"); // Default fee (0.3%)

    // Remove token1Image, token2Image, use token1Details.image directly
    // const [token1Image, setToken1Image] = useState<string | undefined>(undefined);
    // const [token2Image, setToken2Image] = useState<string | undefined>(undefined);

    const [initialTokenRatio, setInitialTokenRatio] = useState({
        token1Amount: 0,
        token2Amount: 0,
        useRatio: false
    });

    const [token1UsdPrice, setToken1UsdPrice] = useState<number | null>(null);
    const [token2UsdPrice, setToken2UsdPrice] = useState<number | null>(null);
    const [pricesLoading, setPricesLoading] = useState<boolean>(false);

    const [postConditions, setPostConditions] = useState<PostCondition[]>([]);
    const [isUnlimitedAllowanceToken1, setIsUnlimitedAllowanceToken1] = useState(false);
    const [isUnlimitedAllowanceToken2, setIsUnlimitedAllowanceToken2] = useState(false);

    useEffect(() => {
        const isValid = !!metadata && !!metadata.name;
        console.log("Metadata changed:", metadata, "valid:", isValid);
        setHasMetadataFlag(isValid);
    }, [metadata]);

    const hasMetadata = hasMetadataFlag;
    const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SELECT_TOKENS);

    useEffect(() => {
        const tokenA_Param = searchParams.get('tokenA');
        const tokenB_Param = searchParams.get('tokenB');
        const fee_Param = searchParams.get('fee');
        const amountA_Param = searchParams.get('amountA');
        const useRatio_Param = searchParams.get('useRatio') === 'true';

        if (tokenA_Param && tokenB_Param && fee_Param) {
            setPricesLoading(true);

            Promise.all([
                fetchTokenMetadataPairDirectly(tokenA_Param, tokenB_Param),
                listPrices()
            ]).then(async ([tokenDetailsResult, allPrices]) => {
                if (tokenDetailsResult.token1Meta) {
                    setToken1Symbol(tokenDetailsResult.token1Meta.symbol || "");
                    setToken1Details(tokenDetailsResult.token1Meta);
                    setToken1UsdPrice(allPrices[tokenA_Param] || null);
                } else {
                    setToken1Details(null);
                    setToken1UsdPrice(null);
                }

                if (tokenDetailsResult.token2Meta) {
                    setToken2Symbol(tokenDetailsResult.token2Meta.symbol || "");
                    setToken2Details(tokenDetailsResult.token2Meta);
                    setToken2UsdPrice(allPrices[tokenB_Param] || null);
                } else {
                    setToken2Details(null);
                    setToken2UsdPrice(null);
                }

                if (tokenDetailsResult.token1Meta && tokenDetailsResult.token2Meta && !poolName) {
                    const generatedPoolName = `${tokenDetailsResult.token1Meta.symbol}-${tokenDetailsResult.token2Meta.symbol} Liquidity`;
                    const generatedLpSymbol = `${tokenDetailsResult.token1Meta.symbol}-${tokenDetailsResult.token2Meta.symbol}`;
                    setPoolName(generatedPoolName);
                    setLpTokenSymbol(generatedLpSymbol);
                }

                if (amountA_Param) {
                    const amountA = parseFloat(amountA_Param);
                    if (!isNaN(amountA)) {
                        let amountB = 0;
                        if (useRatio_Param) {
                            amountB = 10;
                        }
                        setInitialTokenRatio(prev => ({
                            ...prev,
                            token1Amount: amountA,
                            token2Amount: amountB,
                            useRatio: useRatio_Param
                        }));
                    }
                }
                if (tokenDetailsResult.token1Meta && tokenDetailsResult.token2Meta) {
                    setCurrentStep(WizardStep.REVIEW_DEPLOY);
                } else {
                    sonnerToast.error("Token Data Error", { description: "Could not fetch details for one or both tokens." });
                }
            }).catch(err => {
                console.error("Error fetching token pair details or prices:", err);
                sonnerToast.error("Data Lookup Failed", { description: err.message || "Could not fetch token details or prices." });
                setToken1UsdPrice(null);
                setToken2UsdPrice(null);
            }).finally(() => {
                setPricesLoading(false);
            });
        }
    }, [searchParams]); // Only searchParams as dependency

    useEffect(() => {
        const fetchPricesForSelectedTokens = async () => {
            if (!searchParams.get('tokenA')) {
                if (token1Details?.contractId && token2Details?.contractId) {
                    setPricesLoading(true);
                    try {
                        const allPrices = await listPrices();
                        setToken1UsdPrice(allPrices[token1Details.contractId] || null);
                        setToken2UsdPrice(allPrices[token2Details.contractId] || null);
                    } catch (error) {
                        console.error("Error fetching prices for selected tokens:", error);
                        sonnerToast.error("Price Fetch Failed", { description: "Could not fetch latest token prices." });
                        setToken1UsdPrice(null);
                        setToken2UsdPrice(null);
                    } finally {
                        setPricesLoading(false);
                    }
                } else if (token1Details?.contractId && !token2Details?.contractId) {
                    setPricesLoading(true);
                    try {
                        const allPrices = await listPrices();
                        setToken1UsdPrice(allPrices[token1Details.contractId] || null);
                        setToken2UsdPrice(null);
                    } catch (error) {
                        console.error("Error fetching price for token 1:", error);
                        sonnerToast.error("Price Fetch Failed", { description: "Could not fetch latest price for Token 1." });
                        setToken1UsdPrice(null);
                    } finally {
                        setPricesLoading(false);
                    }
                } else if (!token1Details?.contractId) {
                    setToken1UsdPrice(null);
                    setToken2UsdPrice(null);
                }
            }
        };
        fetchPricesForSelectedTokens();
    }, [token1Details, token2Details, searchParams]);

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

    // Generate contract name from pool name
    const generateContractName = (name: string) => {
        if (!name) return '';

        // First, convert to lowercase, replace spaces with hyphens, and remove special characters
        let baseName = name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        // If needed, prepend 'pool-' prefix for names starting with numbers
        baseName = baseName.replace(/^(\d)/, 'pool-$1');

        // Strip off any existing -lp, -pool, etc. suffixes to avoid duplication
        baseName = baseName
            .replace(/-liquidity-pool$/, '')
            .replace(/-pool$/, '')
            .replace(/-lp$/, '')

        // Add the standard suffix
        return `${baseName}-v1`;
    };

    const sanitizeTokenSymbol = (symbol: string): string => {
        // Remove any non-alphanumeric characters, but keep hyphens
        return symbol.replace(/[^a-zA-Z0-9-]/g, '');
    };

    // Get contract name from pool name
    const contractName = generateContractName(poolName) || 'pool';
    // Automatically generate LP token symbol if not set
    const effectiveLpTokenSymbol = lpTokenSymbol ||
        (token1Symbol && token2Symbol ? `${token1Symbol}-${token2Symbol}` : 'LP');

    const lpTokenIdentifier = sanitizeTokenSymbol(effectiveLpTokenSymbol);

    // Full contract identifier
    const contractIdentifier = stxAddress && poolName ? `${stxAddress}.${generateContractName(poolName)}` : "";

    // Form validation
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!poolName.trim()) {
            newErrors.poolName = "Pool name is required";
        }

        if (!token1Symbol.trim()) {
            newErrors.token1 = "First token is required";
        }

        if (!token1Details?.contractId) {
            newErrors.token1Address = "First token address is required";
        }

        if (!token2Symbol.trim()) {
            newErrors.token2 = "Second token is required";
        }

        if (!token2Details?.contractId) {
            newErrors.token2Address = "Second token address is required";
        } else if (token1Details?.contractId === token2Details?.contractId) {
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

    // Update the deployment function to fetch and use metadata
    const handleDeploy = async () => {
        if (!hasMetadata) {
            sonnerToast.error("Metadata Required", { description: "Metadata has not been generated yet. Please wait or refresh metadata." });
            return;
        }

        if (!authenticated) {
            sonnerToast.error("Authentication Required", { description: "Please connect your wallet to deploy a contract." });
            return;
        }

        if (!validateForm()) {
            sonnerToast.error("Validation Error", { description: "Please fix the form errors before deploying." });
            return;
        }

        try {
            setIsDeploying(true);
            sonnerToast.info("Preparing Deployment", { description: "Fetching token information..." });

            console.log({ token1Details })
            console.log({ token2Details })

            // Ensure both tokens were fetched successfully before proceeding
            if (!token1Details || !token2Details) {
                sonnerToast.error("Token Data Error", {
                    description: "Failed to fetch metadata for one or both tokens. Cannot proceed with deployment.",
                });
                setIsDeploying(false);
                return;
            }

            const tokenADecimals = Number(token1Details.decimals);
            const tokenBDecimals = Number(token2Details.decimals);

            // Check for metadata and decimals - Now directly use token1Meta and token2Meta
            if (typeof tokenADecimals !== 'number' || typeof tokenBDecimals !== 'number') {
                sonnerToast.error("Token Data Error", {
                    description: `Failed to fetch required token decimals. Please ensure both tokens have valid metadata.`,
                });
                setIsDeploying(false);
                return;
            }

            // Check for identifier which is crucial for FT post conditions
            if (!token1Details.identifier || !token2Details.identifier) {
                sonnerToast.error("Token Data Error", {
                    description: "Failed to fetch token asset identifier needed for deployment."
                });
                setIsDeploying(false);
                return;
            }
            const lpTokenDecimals = 6;

            // Log the token information for debugging
            console.log("Token A metadata:", token1Details);
            console.log("Token B metadata:", token2Details);
            console.log("Using token decimals:", { tokenADecimals, tokenBDecimals, lpTokenDecimals });

            // Check if tokens are STX
            const isToken1Stx = token1Details.contractId?.includes('stx-token');
            const isToken2Stx = token2Details.contractId?.includes('stx-token');

            // Ensure we have initial liquidity values (use 0 if not enabled)
            const token1Amount = initialTokenRatio.useRatio ? initialTokenRatio.token1Amount : 0;
            const token2Amount = initialTokenRatio.useRatio ? initialTokenRatio.token2Amount : 0;

            // Calculate the total liquidity amounts for post-conditions
            const totalTokenAAmount = initialTokenRatio.useRatio
                ? Math.floor(initialTokenRatio.token1Amount * Math.pow(10, tokenADecimals))
                : 0;
            const totalTokenBAmount = initialTokenRatio.useRatio
                ? Math.floor(initialTokenRatio.token2Amount * Math.pow(10, tokenBDecimals))
                : 0;

            // Generate the liquidity pool contract code
            const contractCode = generateLiquidityPoolContract({
                tokenA: token1Details.contractId, // Use contractId from TokenCacheData
                tokenB: token2Details.contractId, // Use contractId from TokenCacheData
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
                lpTokenIdentifier,
            });

            // Create post-conditions array
            const postConditions: PostCondition[] = [];

            // Log to inform the user about token transfers
            if (initialTokenRatio.useRatio) {
                // Create a user-friendly message about token requirements
                let tokenRequirementsMessage = "Contract will transfer: ";

                if (totalTokenAAmount > 0) {
                    tokenRequirementsMessage += `${initialTokenRatio.token1Amount} ${token1Symbol}`;
                    if (totalTokenBAmount > 0) tokenRequirementsMessage += " and ";

                    // Add post-condition for token A
                    postConditions.push(
                        isToken1Stx
                            ? {
                                type: 'stx-postcondition',
                                address: stxAddress!,
                                condition: 'eq',
                                amount: BigInt(totalTokenAAmount),
                            }
                            : {
                                type: 'ft-postcondition',
                                address: stxAddress!,
                                condition: 'eq',
                                amount: BigInt(totalTokenAAmount),
                                asset: `${token1Details.contractId}::${token1Details.identifier}` as any // Use contractId from TokenCacheData
                            }
                    );
                }

                if (totalTokenBAmount > 0) {
                    tokenRequirementsMessage += `${initialTokenRatio.token2Amount} ${token2Symbol}`;

                    // Add post-condition for token B
                    postConditions.push(
                        isToken2Stx
                            ? {
                                type: 'stx-postcondition',
                                address: stxAddress!,
                                condition: 'eq',
                                amount: BigInt(totalTokenBAmount),
                            }
                            : {
                                type: 'ft-postcondition',
                                address: stxAddress!,
                                condition: 'eq',
                                amount: BigInt(totalTokenBAmount),
                                asset: `${token2Details.contractId}::${token2Details.identifier}` as any // Use contractId from TokenCacheData
                            }
                    );
                }

                // Show a toast to inform the user
                sonnerToast.info("Token Requirements", {
                    description: tokenRequirementsMessage + ". Make sure you have sufficient balance.",
                });
            }

            // Deploy the contract with post-conditions
            const deployOptions = postConditions.length > 0 ? { postConditions } : undefined;
            const result = await deployContract(contractCode, contractName, deployOptions);
            const deployedContractId = `${stxAddress}.${contractName}`;

            setTxid(result.txid);
            sonnerToast.success("Deployment Initiated", { description: `Tx ID: ${result.txid.substring(0, 10)}...` });

            // --- Save to Vercel KV / dex-cache AFTER successful deployment ---
            if (metadata && token1Details && token2Details) { // Ensure all necessary data is present
                const vaultToCache: Vault = {
                    type: 'POOL',
                    protocol: "CHARISMA",
                    contractId: deployedContractId, // Use the actual deployed contract ID
                    name: metadata.name || poolName, // Fallback to poolName if metadata.name is not set
                    symbol: metadata.symbol || effectiveLpTokenSymbol, // Fallback to effectiveLpTokenSymbol
                    decimals: metadata.decimals || 6, // Default LP decimals
                    image: metadata.image || "", // LP token image from generated metadata
                    fee: parseFloat(swapFee) * 10000,
                    identifier: metadata.symbol || effectiveLpTokenSymbol, // LP token identifier
                    description: metadata.description || `Liquidity pool for ${token1Symbol}-${token2Symbol}`,
                    tokenA: {
                        contractId: token1Details.contractId,
                        symbol: token1Details.symbol || "",
                        name: token1Details.name || "",
                        image: token1Details.image || "",
                        description: token1Details.description || "",
                        identifier: token1Details.identifier || token1Details.symbol || "",
                        decimals: token1Details.decimals || 0
                    },
                    tokenB: {
                        contractId: token2Details.contractId,
                        symbol: token2Details.symbol || "",
                        name: token2Details.name || "",
                        image: token2Details.image || "",
                        description: token2Details.description || "",
                        identifier: token2Details.identifier || token2Details.symbol || "",
                        decimals: token2Details.decimals || 0
                    }
                };
                const kvSaveResult = await saveMetadataToDexCache(deployedContractId, vaultToCache);
                if (kvSaveResult.success) {
                    sonnerToast.info("Dex Cache Update", { description: kvSaveResult.message });
                } else {
                    sonnerToast.warning("Dex Cache Update Failed", { description: kvSaveResult.error });
                }
            } else {
                sonnerToast.warning("Dex Cache Update Skipped", { description: "Missing metadata or token details to save to dex-cache." });
            }
            // --- End Save to Vercel KV ---

            // Redirect to the new success page
            router.push(`/templates/liquidity-pool/deploy-success?txid=${result.txid}&poolName=${encodeURIComponent(poolName)}&contractIdentifier=${encodeURIComponent(deployedContractId)}`);
        } catch (error) {
            console.error("Deployment error:", error);
            sonnerToast.error("Deployment Failed", {
                description: error instanceof Error ? error.message : "There was an error deploying your pool. Please try again.",
            });
        } finally {
            setIsDeploying(false);
        }
    };

    // --- End Dex Cache Function ---

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
                    sonnerToast.info("Metadata Found", {
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

    // Helper function to generate a 2x2 pixel art data URI
    const generatePixelArtDataUri = (color1 = '#cccccc', color2 = '#999999', width = 4, height = 4): string => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Create a 2x2 pattern
            const patternCanvas = document.createElement('canvas');
            patternCanvas.width = 2;
            patternCanvas.height = 2;
            const pctx = patternCanvas.getContext('2d');

            if (pctx) {
                pctx.fillStyle = color1;
                pctx.fillRect(0, 0, 1, 1);
                pctx.fillRect(1, 1, 1, 1);
                pctx.fillStyle = color2;
                pctx.fillRect(1, 0, 1, 1);
                pctx.fillRect(0, 1, 1, 1);

                // Scale the pattern to fill the main canvas
                const pattern = ctx.createPattern(patternCanvas, 'repeat');
                if (pattern) {
                    ctx.fillStyle = pattern;
                    ctx.fillRect(0, 0, width, height);
                }
            }
        }
        return canvas.toDataURL();
    };

    // Function to generate metadata manually
    const generateMetadata = async () => {
        if (!token1Details?.contractId || !token2Details?.contractId || !poolName || !stxAddress) {
            sonnerToast.warning("Missing Information", {
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
                    sonnerToast.success("Metadata Loaded", {
                        description: "Existing metadata was found and loaded. You can proceed with deployment.",
                    });
                    return;
                }
            }

            // If not found (404), we generate it
            // Sign the contractId with wallet for authentication
            const { signature, publicKey } = await signMessage(contractId);

            // --- Generate default image ---
            let lpImage = generatePixelArtDataUri(); // Default placeholder
            try {
                const ColorThiefImport = await import('colorthief');
                const ColorThief = ColorThiefImport.default;
                const colorThief = new ColorThief();

                let c1 = '#CCCCCC'; // Default color 1
                let c2 = '#999999'; // Default color 2

                const fetchAndProcessImage = async (imageUrl: string | undefined, defaultColor: string): Promise<string> => {
                    if (!imageUrl) return defaultColor;
                    try {
                        // Using a proxy for CORS issues if images are not on the same domain
                        // Note: This proxy URL would need to be set up on your server.
                        // const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
                        // For now, assuming direct access or CORS-enabled images
                        const img = new Image();
                        img.crossOrigin = "Anonymous"; // Attempt to enable CORS
                        img.src = imageUrl;

                        return new Promise<string>((resolve) => {
                            img.onload = () => {
                                try {
                                    const dominantColor = colorThief.getColor(img);
                                    resolve(`rgb(${dominantColor.join(',')})`);
                                } catch (e) {
                                    console.warn("ColorThief couldn't process image:", imageUrl, e);
                                    resolve(defaultColor);
                                }
                            };
                            img.onerror = (e) => {
                                console.warn("Failed to load image for color extraction:", imageUrl, e);
                                resolve(defaultColor);
                            };
                        });
                    } catch (e) {
                        console.warn("Error fetching/processing image:", imageUrl, e);
                        return defaultColor;
                    }
                };

                if (token1Details?.image) {
                    c1 = await fetchAndProcessImage(token1Details.image, c1);
                }
                if (token2Details?.image) {
                    c2 = await fetchAndProcessImage(token2Details.image, c2);
                }

                // Ensure c1 and c2 are different for better visual
                if (c1 === c2) {
                    // A simple way to make them different if they are the same
                    // This could be made more sophisticated
                    const isHexColor = (color: string) => /^#([0-9A-F]{3}){1,2}$/i.test(color);
                    if (isHexColor(c2)) {
                        // slightly darken or lighten hex color
                        // Basic example: if it's light, make it darker, if dark, make it lighter
                        const brightness = parseInt(c2.slice(1), 16);
                        c2 = brightness > 0x7FFFFF ? '#555555' : '#AAAAAA';
                    } else { // for rgb
                        c2 = 'rgb(150,150,150)'; // a different default gray
                    }
                    if (c1 === c2) c2 = '#888888'; // final fallback if still same
                }


                lpImage = generatePixelArtDataUri(c1, c2);

            } catch (e) {
                console.error("Error during image generation or color thief import:", e);
                // Fallback to default pixel art if colorthief or image processing fails
                lpImage = generatePixelArtDataUri('#A0A0A0', '#D0D0D0'); // Different default colors for error
            }
            // --- End generate default image ---


            // Define the metadata structure with desired naming convention
            const currentMetadata: Partial<TokenMetadata> & { image?: string } = {
                name: `${token1Symbol}-${token2Symbol} Liquidity`, // e.g., B-CHR Liquidity
                symbol: `${token1Symbol}-${token2Symbol}`,    // e.g., B-CHR
                description: `Liquidity pool token for the ${token1Symbol}-${token2Symbol} pair`,
                decimals: 6, // Standard for LP tokens
                image: lpImage, // Add the generated image
                // Add lpRebatePercent to top level for dex-cache compatibility
                lpRebatePercent: parseFloat(swapFee),
                properties: {
                    tokenAContract: token1Details.contractId, // Use contractId from TokenCacheData
                    tokenBContract: token2Details.contractId, // Use contractId from TokenCacheData
                    swapFeePercent: parseFloat(swapFee),
                },
                type: 'POOL',
                protocol: "CHARISMA"
            };

            console.log("Generating metadata with payload:", currentMetadata);

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
                    sonnerToast.success("Metadata Generated", {
                        description: "LP token metadata has been successfully created and saved.",
                    });

                } else {
                    throw new Error('Unexpected response structure from metadata API');
                }
            } else {
                const errorText = await resp.text();
                console.error("Metadata service responded with error:", resp.status, errorText);
                throw new Error(`Metadata service responded with ${resp.status}: ${errorText || 'Unknown error'}`);
            }
        } catch (e) {
            console.error('Metadata generation error', e);
            setMetadataApiError(true);
            setMetadata(null); // Explicitly clear metadata on error
            sonnerToast.error("Metadata Generation Failed", {
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
        const shouldGenerate = token1Details?.contractId && token2Details?.contractId && poolName && stxAddress;
        if (shouldGenerate) {
            // Clear existing metadata and regenerate
            setMetadata(null);
            generateMetadata();
        } else {
            sonnerToast.warning("Missing Information", {
                description: "Please ensure you have selected both tokens and provided a pool name before refreshing.",
            });
        }
    };

    const handleSelectToken1 = (selectedToken: TokenCacheData) => { // Expect TokenCacheData
        console.log("Selected token 1:", selectedToken);
        setToken1Symbol(selectedToken.symbol || "");
        // setToken1Address(selectedToken.contractId); // No longer needed, use selectedToken.contractId directly
        setToken1Details(selectedToken); // Store full TokenCacheData
        // setToken1Image(findTokenImage(selectedToken.symbol || "", selectedToken.contractId)); // No longer needed

        if (!token2Symbol || !poolName) { // Use token2Symbol
            setPoolName(`${selectedToken.symbol || 'TKN'} Liquidity Pool`);
        }
    };

    const handleSelectToken2 = (selectedToken: TokenCacheData) => { // Expect TokenCacheData
        console.log("Selected token 2:", selectedToken);
        setToken2Symbol(selectedToken.symbol || "");
        // setToken2Address(selectedToken.contractId); // No longer needed
        setToken2Details(selectedToken); // Store full TokenCacheData
        // setToken2Image(findTokenImage(selectedToken.symbol || "", selectedToken.contractId)); // No longer needed

        if (token1Symbol) { // Use token1Symbol
            setPoolName(`${token1Symbol}-${selectedToken.symbol || 'TKN'} Liquidity Pool`);
        }
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
                            token1Symbol={token1Symbol}
                            excludedToken={token1Details?.contractId || undefined}
                            predefinedTokens={tokens}
                            isLoadingTokens={contextLoading}
                            tokenLoadError={tokensError}
                        />
                    )}

                    {currentStep === WizardStep.CONFIGURE_POOL && (
                        <PoolConfigStep
                            poolName={poolName}
                            onPoolNameChange={handlePoolNameChange}
                            swapFee={swapFee}
                            onSwapFeeChange={setSwapFee}
                            token1={token1Symbol}
                            token2={token2Symbol}
                            errors={errors}
                            onPrevious={prevStep}
                            onNext={nextStep}
                        />
                    )}

                    {currentStep === WizardStep.INITIALIZE_POOL && (
                        <InitializePoolStep
                            token1={token1Symbol || "Token A"}
                            token2={token2Symbol || "Token B"}
                            initialTokenRatio={initialTokenRatio}
                            onUpdateRatio={setInitialTokenRatio}
                            onPrevious={prevStep}
                            onNext={nextStep}
                            token1UsdPrice={token1UsdPrice}
                            token2UsdPrice={token2UsdPrice}
                            pricesLoading={pricesLoading}
                        />
                    )}

                    {currentStep === WizardStep.REVIEW_DEPLOY && (
                        <ReviewDeployStep
                            poolName={poolName}
                            lpTokenSymbol={effectiveLpTokenSymbol}
                            token1={token1Symbol}
                            token2={token2Symbol}
                            token1Address={token1Details?.contractId}
                            token2Address={token2Details?.contractId}
                            swapFee={swapFee}
                            contractIdentifier={contractIdentifier}
                            isGeneratingMetadata={isGeneratingMetadata}
                            metadataApiError={metadataApiError}
                            hasMetadata={hasMetadata}
                            metadata={metadata}
                            isDeploying={isDeploying}
                            token1Image={token1Details?.image || undefined}
                            token2Image={token2Details?.image || undefined}
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
                                <p className="text-sm text-muted-foreground">0 STX</p>
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

export default function LiquidityPoolDeployPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <LiquidityPoolWizard />
        </Suspense>
    );
} 