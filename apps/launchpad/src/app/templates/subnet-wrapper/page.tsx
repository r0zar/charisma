"use client";

function deriveName(principal: string) {
    const parts = principal.split('.');
    return (parts.length > 1 ? parts[1] : principal).toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

import { useState, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useApp } from '@/lib/context/app-context';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Search,
    X,
    HelpCircle,
    Globe,
    Network,
    Rocket,
    Zap,
    Clock,
    FileSignature,
    Loader2,
    ExternalLinkIcon
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { generateSubnetWrapper } from '@/lib/contract-generators/subnet-wrapper';
import { getTokenMetadataCached, listTokens, SIP10, TokenCacheData } from '@repo/tokens'
import Image from 'next/image';
import { createSubnetMetadataAction } from '@/lib/actions/metadataActions';

// Schema for form validation
const schema = z.object({
    tokenContract: z.string().min(1, 'Required'),
    enableBearer: z.boolean(),
    enableLTE: z.boolean(),
});

type FormState = z.infer<typeof schema>;

// Define wizard steps enum
enum WizardStep {
    SELECT_TOKEN = 0,
    CONFIGURE_FEATURES = 1,
    PREVIEW = 2,
    DEPLOY = 3
}

// Contract Stepper Component
const ContractStepper = ({ currentStep }: { currentStep: WizardStep }) => {
    return (
        <div className="mb-8 flex items-center justify-between">
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.SELECT_TOKEN ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.SELECT_TOKEN ? <Check className="h-5 w-5" /> : "1"}
                </div>
                <span className="text-xs mt-2">Select Token</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.CONFIGURE_FEATURES ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.CONFIGURE_FEATURES ? <Check className="h-5 w-5" /> : "2"}
                </div>
                <span className="text-xs mt-2">Configure</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= WizardStep.PREVIEW ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > WizardStep.PREVIEW ? <Check className="h-5 w-5" /> : "3"}
                </div>
                <span className="text-xs mt-2">Preview</span>
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
    onSelect,
    onCustomSubmit
}: {
    onSelect: (token: string) => void;
    onCustomSubmit: (contractId: string) => void;
}) => {
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customAddress, setCustomAddress] = useState("");
    const [customError, setCustomError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Custom token fetch state
    const [isFetchingToken, setIsFetchingToken] = useState(false);
    const [fetchedToken, setFetchedToken] = useState<TokenCacheData | null>(null);

    // State for token list
    const [tokens, setTokens] = useState<SIP10[]>([]);
    const [filteredTokens, setFilteredTokens] = useState<SIP10[]>([]);

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
            const token = await getTokenMetadataCached(contractId);

            setFetchedToken(token);
        } catch (error) {
            console.error('Error fetching token metadata:', error);
            setCustomError(error instanceof Error ? error.message : 'Failed to fetch token data');
            setFetchedToken(null);
        } finally {
            setIsFetchingToken(false);
        }
    };

    // Fetch tokens from the token-cache API
    useEffect(() => {
        const fetchTokens = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const tokens = await listTokens();
                setTokens(tokens);
                setFilteredTokens(tokens);
            } catch (error) {
                console.error('Error fetching tokens:', error);
                setError('Failed to load tokens. Using default list.');

                // Fallback to a minimal default list
                const defaultTokens: SIP10[] = [];
                setTokens(defaultTokens);
                setFilteredTokens(defaultTokens);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTokens();
    }, []);

    // Filter tokens based on search query
    useEffect(() => {
        if (!searchQuery) {
            setFilteredTokens(tokens);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = tokens.filter(
            token =>
                token.symbol?.toLowerCase().includes(query) ||
                token.name?.toLowerCase().includes(query) ||
                token.contractId?.toLowerCase().includes(query)
        );

        setFilteredTokens(filtered);
    }, [searchQuery, tokens]);

    const handleCustomSubmit = () => {
        if (!fetchedToken) {
            setCustomError("Please fetch a valid token first");
            return;
        }

        setCustomError(null);
        onCustomSubmit(fetchedToken.contractId || "");

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
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Select Token to Wrap</h2>
                <p className="text-muted-foreground">Choose the SIP-10 token to be wrapped from the subnet</p>
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
                                                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="text-sm font-bold text-primary/60">${fetchedToken.symbol?.charAt(0)}</div>`;
                                                }}
                                            />
                                        ) : (
                                            <div className="text-sm font-bold text-primary/60">{fetchedToken.symbol?.charAt(0)}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-medium">{fetchedToken.symbol}</h4>
                                        <p className="text-sm text-muted-foreground">{fetchedToken.name}</p>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    <span className="block mb-1">Contract ID:</span>
                                    <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded">{fetchedToken.contractId}</span>
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
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="flex flex-col items-center">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                <p className="text-muted-foreground">Loading tokens...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8">
                            <p className="text-destructive mb-4">{error}</p>
                            <Button variant="outline" onClick={() => window.location.reload()}>
                                Retry
                            </Button>
                        </div>
                    ) : filteredTokens.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-muted-foreground">No tokens found. Try a different search.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {filteredTokens.map((token: any) => (
                                <div key={token.type + "-" + token.contractId}>
                                    <Card
                                        className="cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                                        onClick={() => onSelect(token.contractId || "")}
                                    >
                                        <div className="p-6 flex flex-col items-center">
                                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4 overflow-hidden">
                                                {token.image ? (
                                                    <Image
                                                        width={64}
                                                        height={64}
                                                        src={token.image}
                                                        alt={token.symbol || ""}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '';
                                                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-8 h-8 text-primary/60">${token.symbol?.charAt(0)}</div>`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 font-bold text-primary/60 flex items-center justify-center">
                                                        {token.symbol?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="font-medium">{token.symbol}</h3>
                                            <p className="text-sm text-muted-foreground truncate max-w-full">{token.name}</p>
                                        </div>
                                    </Card>
                                </div>
                            ))}
                            <Card
                                className="cursor-pointer hover:border-primary/50 transition-colors"
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
        </div>
    );
};

// Feature selection step
const FeatureConfigStep = ({
    state,
    setState,
    onNext,
    onPrevious
}: {
    state: FormState,
    setState: React.Dispatch<React.SetStateAction<FormState>>,
    onNext: () => void,
    onPrevious: () => void
}) => {
    const toggleFeature = (feature: keyof Pick<FormState, 'enableBearer' | 'enableLTE'>) => {
        setState(prev => ({ ...prev, [feature]: !prev[feature] }));
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Configure Transfer Features</h2>
                <p className="text-muted-foreground">
                    Select which transfer methods to enable for your subnet token wrapper
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Default Transfer Feature - Always included */}
                <Card className="border-2 border-primary/30 bg-primary/5 flex flex-col h-full">
                    <CardHeader className="pb-2">
                        <div className="flex items-start gap-2">
                            <div className="p-2 rounded-full bg-primary/10 text-primary mt-0.5">
                                <Network className="h-4 w-4" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Default Transfer</CardTitle>
                                <div className="mt-1 w-fit px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                                    Always Included
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4 flex-grow">
                        <p className="text-sm text-muted-foreground mb-3">
                            Standard token transfers between accounts, matching the original SIP-10 functionality.
                        </p>
                        <ul className="space-y-1 text-xs">
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Direct account transfers
                            </li>
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Wallet compatibility
                            </li>
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Contract-to-contract calls
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Bearer Redemption Feature */}
                <Card
                    className={`border-2 transition-colors flex flex-col h-full cursor-pointer hover:border-primary/80 ${state.enableBearer ? 'border-primary' : 'border-transparent'}`}
                    onClick={() => toggleFeature('enableBearer')}
                >
                    <CardHeader className="pb-2">
                        <div className="flex items-start gap-2">
                            <div className={`p-2 rounded-full mt-0.5 ${state.enableBearer ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                <FileSignature className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-base">Bearer Redemption</CardTitle>
                                    <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center border ${state.enableBearer ? 'bg-primary border-primary' : 'border-muted'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFeature('enableBearer');
                                        }}
                                    >
                                        {state.enableBearer && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4 flex-grow">
                        <p className="text-sm text-muted-foreground mb-3">
                            Tokens redeemed via signed bearer notes without specified recipients, for off-chain transfers.
                        </p>
                        <ul className="space-y-1 text-xs">
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Physical vouchers
                            </li>
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Paper wallet support
                            </li>
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Gift card redemption
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Upper Bound Transfers Feature */}
                <Card
                    className={`border-2 transition-colors flex flex-col h-full cursor-pointer hover:border-primary/80 ${state.enableLTE ? 'border-primary' : 'border-transparent'}`}
                    onClick={() => toggleFeature('enableLTE')}
                >
                    <CardHeader className="pb-2">
                        <div className="flex items-start gap-2">
                            <div className={`p-2 rounded-full mt-0.5 ${state.enableLTE ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                <Zap className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-base">Upper-bound Transfers (≤)</CardTitle>
                                    <div
                                        className={`w-5 h-5 rounded-full flex items-center justify-center border ${state.enableLTE ? 'bg-primary border-primary' : 'border-muted'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleFeature('enableLTE');
                                        }}
                                    >
                                        {state.enableLTE && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4 flex-grow">
                        <p className="text-sm text-muted-foreground mb-3">
                            Multi-hop operations where the signed amount serves as a maximum bound for flexible transactions.
                        </p>
                        <ul className="space-y-1 text-xs">
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Multi-hop DEX routes
                            </li>
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Slippage-tolerant swaps
                            </li>
                            <li className="flex items-center">
                                <Check className="h-3 w-3 mr-1.5 text-primary" />
                                Conditional execution
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={onPrevious}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={onNext}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default function SubnetWrapperWizard() {
    const router = useRouter();
    const { toast } = useToast();
    const { deployContract, authenticated, stxAddress } = useApp();
    const [currentStep, setCurrentStep] = useState<WizardStep>(WizardStep.SELECT_TOKEN);
    const [isDeploying, setIsDeploying] = useState(false);
    const [generated, setGenerated] = useState<string>('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [finalDeploymentTxId, setFinalDeploymentTxId] = useState<string | null>(null);

    const [state, setState] = useState<FormState>({
        tokenContract: '',
        enableBearer: true,
        enableLTE: true,
    });

    // Navigation functions
    const nextStep = () => {
        if (currentStep < WizardStep.DEPLOY) {
            setCurrentStep(prev => prev + 1 as WizardStep);
        }
    };

    const prevStep = () => {
        if (currentStep > WizardStep.SELECT_TOKEN) {
            setCurrentStep(prev => prev - 1 as WizardStep);
        }
    };

    // Token selection handlers
    const handleSelectToken = (contractId: string) => {
        setState(prev => ({ ...prev, tokenContract: contractId }));
        nextStep();
    };

    // Validation function
    const validateForm = () => {
        try {
            schema.parse(state);
            setFormErrors({});
            return true;
        } catch (err) {
            if (err instanceof z.ZodError) {
                const errors: Record<string, string> = {};
                err.errors.forEach(error => {
                    if (error.path[0]) {
                        errors[error.path[0].toString()] = error.message;
                    }
                });
                setFormErrors(errors);
            }
            return false;
        }
    };

    const handleGenerate = async () => {
        if (!validateForm()) {
            toast({
                variant: "destructive",
                title: "Validation Error",
                description: "Please fix the form errors before continuing."
            });
            return;
        }

        try {
            const result = await generateSubnetWrapper({
                tokenContract: state.tokenContract,
                tokenName: deriveName(state.tokenContract),
                blazeContract: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1',
                enableBearer: state.enableBearer,
                enableLTE: state.enableLTE,
            });

            setGenerated(result.code);
            nextStep();
        } catch (err) {
            toast({
                variant: "destructive",
                title: "Generation Failed",
                description: err instanceof Error ? err.message : "Failed to generate contract"
            });
        }
    };

    const handleDeploy = async () => {
        if (!authenticated || !stxAddress) {
            toast({ variant: 'destructive', title: 'Wallet not connected', description: 'Connect wallet to deploy' });
            return;
        }

        setIsDeploying(true);
        setFinalDeploymentTxId(null);
        let deployedContractName = '';

        try {
            deployedContractName = `${deriveName(state.tokenContract)}-subnet`;
            const deploymentResult = await deployContract(generated, deployedContractName);

            if (deploymentResult && deploymentResult.txid) {
                setFinalDeploymentTxId(deploymentResult.txid);
                toast({ title: 'Deployment Transaction Submitted', description: `Contract: ${deployedContractName}, TxID: ${deploymentResult.txid.substring(0, 10)}...` });

                const deployedSubnetContractId = `${stxAddress}.${deployedContractName}`;
                toast({
                    title: 'Processing Metadata',
                    description: `Creating metadata for ${deployedSubnetContractId}...`
                });
                const metadataResult = await createSubnetMetadataAction({
                    deployedSubnetContractId: deployedSubnetContractId,
                    baseTokenContractId: state.tokenContract
                });
                if (metadataResult.success) {
                    toast({
                        title: 'Metadata Created',
                        description: metadataResult.message || `Successfully created metadata for ${deployedSubnetContractId}.`
                    });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'Metadata Creation Failed',
                        description: metadataResult.error || 'Could not save metadata for the new subnet.'
                    });
                    console.error("Metadata creation failed:", metadataResult.error);
                }
                setCurrentStep(WizardStep.DEPLOY);
            } else {
                throw new Error("Deployment did not return a transaction ID.");
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Deployment failed', description: err.message || 'An error occurred during deployment or metadata creation.' });
        } finally {
            setIsDeploying(false);
        }
    };

    // Step two handler
    const handleStepTwoComplete = () => {
        handleGenerate();
    };

    // Render steps
    const renderStep = () => {
        switch (currentStep) {
            case WizardStep.SELECT_TOKEN:
                return (
                    <TokenSelectionStep
                        onSelect={handleSelectToken}
                        onCustomSubmit={handleSelectToken}
                    />
                );

            case WizardStep.CONFIGURE_FEATURES:
                return (
                    <FeatureConfigStep
                        state={state}
                        setState={setState}
                        onNext={handleStepTwoComplete}
                        onPrevious={prevStep}
                    />
                );

            case WizardStep.PREVIEW:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2">Preview Generated Contract</h2>
                            <p className="text-muted-foreground">
                                Review the Clarity contract before deployment
                            </p>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Globe className="mr-2 h-5 w-5 text-primary" />
                                    Contract Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="bg-muted rounded-md p-4">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="font-semibold">Features enabled:</span>
                                            <div className="flex gap-2">
                                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                                    Signed Transfers
                                                </span>
                                                {state.enableBearer && (
                                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                                        Bearer Notes
                                                    </span>
                                                )}
                                                {state.enableLTE && (
                                                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                                        Upper-bound (≤)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm mb-2">
                                            <span className="font-semibold">Token:</span> {state.tokenContract}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-semibold">Contract name:</span> {deriveName(state.tokenContract)}-subnet
                                        </div>
                                    </div>

                                    <Textarea
                                        className="w-full h-96 font-mono text-sm"
                                        readOnly
                                        value={generated}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline" onClick={prevStep}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                                <Button
                                    onClick={handleDeploy}
                                    disabled={isDeploying}
                                >
                                    {isDeploying ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Deploying...
                                        </>
                                    ) : (
                                        <>
                                            Deploy Contract
                                            <Rocket className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                );

            case WizardStep.DEPLOY:
                return (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold mb-2">Deployment Submitted!</h2>
                            <p className="text-muted-foreground">
                                Your subnet wrapper transaction has been submitted to the network.
                            </p>
                        </div>

                        <Card>
                            <CardContent className="flex flex-col items-center py-12">
                                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                    <Check className="h-8 w-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Transaction Submitted</h3>
                                <p className="text-center text-muted-foreground max-w-md mb-6">
                                    Your subnet contract deployment has been broadcast. You can monitor its status using a Stacks Explorer.
                                </p>
                                {finalDeploymentTxId && (
                                    <a
                                        href={`https://explorer.hiro.so/txid/${finalDeploymentTxId}?chain=mainnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-4"
                                    >
                                        View Transaction on Explorer <ExternalLinkIcon className="ml-2 h-4 w-4" />
                                    </a>
                                )}
                                <div className="flex flex-col gap-2 w-full max-w-xs">
                                    <Button variant="outline" onClick={() => router.push('/templates')}>
                                        Deploy Another Contract
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                );

            default:
                return null;
        }
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
                        Please connect your wallet to deploy a subnet wrapper.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl py-8 space-y-6">
            <div className="flex justify-between items-center">
                <Button
                    variant="ghost"
                    onClick={() => router.push("/templates")}
                    className="mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Templates
                </Button>
            </div>

            <h1 className="text-3xl font-bold flex items-center">
                <Globe className="mr-2 h-7 w-7 text-primary" />
                Blaze SIP-10 Subnet
            </h1>
            <p className="text-muted-foreground">
                Upgrade an existing token to a subnet token. This contract allows users to peg tokens into and out of a subnet,
                enabling advanced transaction patterns like off-chain signature-based transfers.
            </p>

            <ContractStepper currentStep={currentStep} />

            {renderStep()}
        </div>
    );
} 