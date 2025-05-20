"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast as sonnerToast } from "sonner";
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
import { truncateAddress } from "@/lib/utils/token-utils";
import { generateLiquidityPoolContract, LiquidityPoolOptions } from "@/lib/templates/liquidity-pool-contract-template";
import { TokenMetadata } from "@/lib/metadata-service";
import {
    Image as ImageIconLucide,
    Check,
} from "lucide-react";
import { PostCondition } from "@stacks/connect/dist/types/methods";
import { TokenSelectionStep, type EnhancedToken as WizardToken } from "@/components/liquidity-pool-wizard/token-selection-step";
import { PoolConfigStep } from "@/components/liquidity-pool-wizard/pool-config-step";
import { InitializePoolStep } from "@/components/liquidity-pool-wizard/initialize-pool-step";
import { ReviewDeployStep } from "@/components/liquidity-pool-wizard/review-deploy-step";
import { getTokenMetadataCached, listTokens, TokenCacheData, listPrices, KraxelPriceData } from "@repo/tokens";
import { fetchTokenMetadataPairDirectly, fetchSingleTokenMetadataDirectly } from '@/app/actions';


// Metadata constants
const METADATA_BASE_URL = 'https://metadata.charisma.rocks'
const METADATA_API_URL = `${METADATA_BASE_URL}/api/v1/metadata`;

// Wizard steps
enum WizardStep {
    SELECT_TOKENS = 0,
    CONFIGURE_POOL = 1,
    INITIALIZE_POOL = 2,
    REVIEW_DEPLOY = 3,
}

// Token type - Use TokenCacheData where EnhancedToken was used
interface Token {
    symbol: string;
    name: string;
    address: string; // This should be the contract ID
    description?: string;
    image?: string;
    decimals?: number;
    isSubnet?: boolean;
    isLpToken?: boolean;
    total_supply?: string | null;
    identifier?: string; // Added for compatibility if used elsewhere
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

// Wrap the component logic in a separate component to use hooks
function LiquidityPoolWizard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {
        authenticated,
        stxAddress,
        deployContract,
        signMessage,
        tokens,
        loading: contextLoading,
        tokensError,
        fetchTokens
    } = useApp();
    const [isDeploying, setIsDeploying] = useState(false);
    const [txid, setTxid] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
    const [isGeneratingMetadata, setIsGeneratingMetadata] = useState(false);
    const [metadataApiError, setMetadataApiError] = useState(false);
    const [hasMetadataFlag, setHasMetadataFlag] = useState(false);

    // Hoisted state definitions
    const [token1, setToken1] = useState<string>("");
    const [token2, setToken2] = useState<string>("");
    const [token1Details, setToken1Details] = useState<Token | null>(null);
    const [token2Details, setToken2Details] = useState<Token | null>(null);
    const [token1Address, setToken1Address] = useState<string>("");
    const [token2Address, setToken2Address] = useState<string>("");
    const [poolName, setPoolName] = useState("");
    const [lpTokenSymbol, setLpTokenSymbol] = useState("");
    const [swapFee, setSwapFee] = useState<string>("0.003"); // Default fee (0.3%)

    const [token1Image, setToken1Image] = useState<string | undefined>(undefined);
    const [token2Image, setToken2Image] = useState<string | undefined>(undefined);

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
            setToken1Address(tokenA_Param);
            setToken2Address(tokenB_Param);
            setSwapFee(fee_Param);
            setPricesLoading(true);

            Promise.all([
                fetchTokenMetadataPairDirectly(tokenA_Param, tokenB_Param),
                listPrices()
            ]).then(([tokenDetailsResult, allPrices]) => {
                if (tokenDetailsResult.token1Meta) {
                    setToken1(tokenDetailsResult.token1Meta.symbol || "");
                    const t1Details: Token = {
                        address: tokenA_Param, // Use param directly as it's the contract ID
                        symbol: tokenDetailsResult.token1Meta.symbol || "",
                        name: tokenDetailsResult.token1Meta.name || "",
                        decimals: tokenDetailsResult.token1Meta.decimals === undefined ? 6 : tokenDetailsResult.token1Meta.decimals, // Default to 6 if undefined
                        image: tokenDetailsResult.token1Meta.image || undefined,
                        total_supply: tokenDetailsResult.token1Meta.total_supply !== undefined ? String(tokenDetailsResult.token1Meta.total_supply) : undefined,
                        identifier: tokenDetailsResult.token1Meta.identifier || tokenA_Param, // Added identifier
                    };
                    setToken1Details(t1Details);
                    setToken1UsdPrice(allPrices[tokenA_Param] || null);
                } else {
                    setToken1Details(null);
                    setToken1UsdPrice(null);
                }

                if (tokenDetailsResult.token2Meta) {
                    setToken2(tokenDetailsResult.token2Meta.symbol || "");
                    const t2Details: Token = {
                        address: tokenB_Param, // Use param directly
                        symbol: tokenDetailsResult.token2Meta.symbol || "",
                        name: tokenDetailsResult.token2Meta.name || "",
                        decimals: tokenDetailsResult.token2Meta.decimals === undefined ? 6 : tokenDetailsResult.token2Meta.decimals, // Default to 6
                        image: tokenDetailsResult.token2Meta.image || undefined,
                        total_supply: tokenDetailsResult.token2Meta.total_supply !== undefined ? String(tokenDetailsResult.token2Meta.total_supply) : undefined,
                        identifier: tokenDetailsResult.token2Meta.identifier || tokenB_Param, // Added identifier
                    };
                    setToken2Details(t2Details);
                    setToken2UsdPrice(allPrices[tokenB_Param] || null);
                } else {
                    setToken2Details(null);
                    setToken2UsdPrice(null);
                }

                if (tokenDetailsResult.token1Meta && tokenDetailsResult.token2Meta && !poolName) { // Check poolName here before setting
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
            // Ensure details and their addresses are available, and not currently processing URL params
            if (token1Details?.address && token2Details?.address && !searchParams.get('tokenA')) {
                setPricesLoading(true);
                try {
                    const allPrices = await listPrices();
                    setToken1UsdPrice(allPrices[token1Details.address] || null);
                    setToken2UsdPrice(allPrices[token2Details.address] || null);
                } catch (error) {
                    console.error("Error fetching prices for selected tokens:", error);
                    sonnerToast.error("Price Fetch Failed", { description: "Could not fetch latest token prices." });
                    setToken1UsdPrice(null);
                    setToken2UsdPrice(null);
                } finally {
                    setPricesLoading(false);
                }
            }
        };
        fetchPricesForSelectedTokens();
    }, [token1Details?.address, token2Details?.address, searchParams]); // searchParams ensures this doesn't run if URL params are present

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
        (token1 && token2 ? `${token1}-${token2}` : 'LP');

    // Full contract identifier
    const contractIdentifier = stxAddress && poolName ? `${stxAddress}.${generateContractName(poolName)}` : "";

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
            const isToken1Stx = token1Address.includes('stx-token');
            const isToken2Stx = token2Address.includes('stx-token');

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

            // Create post-conditions array
            const postConditions: PostCondition[] = [];

            // Log to inform the user about token transfers
            if (initialTokenRatio.useRatio) {
                // Create a user-friendly message about token requirements
                let tokenRequirementsMessage = "Contract will transfer: ";

                if (totalTokenAAmount > 0) {
                    tokenRequirementsMessage += `${initialTokenRatio.token1Amount} ${token1}`;
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
                                asset: `${token1Address}::${token1Details.identifier}` as any
                            }
                    );
                }

                if (totalTokenBAmount > 0) {
                    tokenRequirementsMessage += `${initialTokenRatio.token2Amount} ${token2}`;

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
                                asset: `${token2Address}::${token2Details.identifier}` as any
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

            // --- Add Pool to Dex Cache --- 
            // run this after 10 seconds
            setTimeout(async () => {
                await getTokenMetadataCached(deployedContractId);
            }, 10000);
            // --- End Add Pool to Dex Cache ---

            // Redirect to contracts page after successful deployment
            router.push(`/contracts?txid=${result.txid}`);
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

    // Function to generate metadata manually
    const generateMetadata = async () => {
        if (!token1Address || !token2Address || !poolName || !stxAddress) {
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

            // Define the metadata structure with desired naming convention
            const currentMetadata: Partial<TokenMetadata> = {
                name: `${token1}-${token2} Liquidity`, // e.g., B-CHR Liquidity
                symbol: `${token1}-${token2}`,    // e.g., B-CHR
                description: `Liquidity pool token for the ${token1}-${token2} pair`,
                decimals: 6, // Standard for LP tokens
                // Add lpRebatePercent to top level for dex-cache compatibility
                lpRebatePercent: parseFloat(swapFee),
                properties: {
                    tokenAContract: token1Address,
                    tokenBContract: token2Address,
                    // Keep swapFeePercent in properties for potential future use/consistency
                    swapFeePercent: parseFloat(swapFee),
                },
                // Optional: Add image prompt if your metadata service uses it
                // imagePrompt: `Minimalist professional logo representing liquidity pool between ${token1} and ${token2}`
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
                    throw new Error('Unexpected response structure');
                }
            } else {
                throw new Error('Metadata service responded with error');
            }
        } catch (e) {
            console.error('Metadata generation error', e);
            setMetadataApiError(true);
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
        const shouldGenerate = token1Address && token2Address && poolName && stxAddress;
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

    // Helper function to adapt WizardToken (EnhancedToken) to TokenCacheData
    const adaptWizardTokenToCacheData = (wizardToken: WizardToken): TokenCacheData => {
        return {
            ...wizardToken, // Spread existing compatible fields
            contractId: wizardToken.address,
            contract_principal: wizardToken.address,
            decimals: wizardToken.decimals ?? 0,
            total_supply: wizardToken.total_supply !== undefined && wizardToken.total_supply !== null
                ? String(wizardToken.total_supply)
                : undefined,
            identifier: wizardToken.identifier || wizardToken.symbol,
            name: wizardToken.name || wizardToken.symbol || 'Unknown Token',
            symbol: wizardToken.symbol || 'UNK',
            // Ensure any other fields *required* by TokenCacheData and not present on WizardToken
            // are explicitly added here with default/null values.
            // For example, if TokenCacheData requires 'ft', 'nft', 'lastRefreshed', they must be handled.
            // Assuming for now they are optional or will be added to WizardToken if strictly required.
        } as any;
    };

    const handleSelectToken1 = (selectedToken: WizardToken) => {
        console.log("Selected token 1:", selectedToken);
        setToken1(selectedToken.symbol || "");
        setToken1Address(selectedToken.address); // Use selectedToken.address

        const details: Token = {
            address: selectedToken.address,       // Use selectedToken.address
            symbol: selectedToken.symbol || "",
            name: selectedToken.name || "",
            decimals: selectedToken.decimals === undefined ? 6 : selectedToken.decimals,
            image: selectedToken.image || undefined,
            description: selectedToken.description || undefined,
            total_supply: selectedToken.total_supply !== undefined ? String(selectedToken.total_supply) : undefined,
            identifier: selectedToken.identifier || selectedToken.address, // Use identifier or address
        };
        setToken1Details(details);
        setToken1Image(findTokenImage(selectedToken.symbol || "", selectedToken.address)); // Use selectedToken.address
        // Auto-generate pool name if token2 is not yet selected or if pool name is empty
        if (!token2 || !poolName) {
            setPoolName(`${selectedToken.symbol} Liquidity Pool`);
        }
        // Do not automatically advance here, let TokenSelectionStep handle it
    };

    const handleSelectToken2 = (selectedToken: WizardToken) => {
        console.log("Selected token 2:", selectedToken);
        setToken2(selectedToken.symbol || "");
        setToken2Address(selectedToken.address); // Use selectedToken.address

        const details: Token = {
            address: selectedToken.address,       // Use selectedToken.address
            symbol: selectedToken.symbol || "",
            name: selectedToken.name || "",
            decimals: selectedToken.decimals === undefined ? 6 : selectedToken.decimals,
            image: selectedToken.image || undefined,
            description: selectedToken.description || undefined,
            total_supply: selectedToken.total_supply !== undefined ? String(selectedToken.total_supply) : undefined,
            identifier: selectedToken.identifier || selectedToken.address, // Use identifier or address
        };
        setToken2Details(details);
        setToken2Image(findTokenImage(selectedToken.symbol || "", selectedToken.address)); // Use selectedToken.address
        // Update pool name to reflect the token pair if token1 is set
        if (token1) {
            setPoolName(`${token1}-${selectedToken.symbol} Liquidity Pool`);
        }
        // TokenSelectionStep will call nextStep after this if it's the final selection in that component
        nextStep(); // Explicitly call next step after second token selection
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

    // Helper function to find a token's image from the token list (USE CONTEXT TOKENS)
    const findTokenImage = (symbol: string, contractIdInput: string): string | undefined => {
        const foundToken = tokens.find(t =>
            (t.contractId && t.contractId.toLowerCase() === contractIdInput.toLowerCase()) ||
            (t.symbol && t.symbol.toUpperCase() === symbol.toUpperCase())
        );
        return foundToken?.image ?? undefined;
    };

    const predefinedTokensForStep: any[] = tokens.filter(t => {
        if (t.contractId && t.symbol && t.name) {
            return true;
        }
        return false;
    }).map((token, index) => {
        // Check for subnet using contract_principal from the original TokenCacheData
        const isSubnet = !!token.contract_principal?.includes('subnet');
        // Check if it's an LP token by looking for specific properties
        const isLpToken = !!(token.tokenAContract && token.tokenBContract);

        return {
            symbol: token.symbol,
            name: token.name,
            address: token.contractId, // Ensure address is always a valid string
            description: token.description ?? undefined,
            image: token.image ?? undefined,
            decimals: token.decimals,
            isSubnet: isSubnet,
            isLpToken: isLpToken,
            total_supply: token.total_supply ?? null,
        };
    });

    const [isLoadingToken1Details, setIsLoadingToken1Details] = useState(false);
    const [isLoadingToken2Details, setIsLoadingToken2Details] = useState(false);

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
                            predefinedTokens={predefinedTokensForStep}
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
                            token1={token1}
                            token2={token2}
                            errors={errors}
                            onPrevious={prevStep}
                            onNext={nextStep}
                        />
                    )}

                    {currentStep === WizardStep.INITIALIZE_POOL && (
                        <InitializePoolStep
                            token1={token1 || "Token A"}
                            token2={token2 || "Token B"}
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