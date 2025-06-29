'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { STACKS_MAINNET } from '@stacks/network';
import {
    fetchCallReadOnlyFunction,
    stringAsciiCV,
    uintCV,
    principalCV,
    ClarityType
} from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { connect } from "@stacks/connect";
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Loader2,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Wallet,
    ArrowRight,
    ExternalLink,
    RefreshCw,
    Info,
    Coins
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { BLAZE_SIGNER_CONTRACT, parseContract } from '../../constants/contracts';
import { Separator } from '../ui/separator';
import { request } from '@stacks/connect';
import Image from 'next/image';

// This component will safely use the useSearchParams hook
function SearchParamsReader() {
    const searchParams = useSearchParams();
    const sig = searchParams.get('sig');
    const amount = searchParams.get('amount');
    const uuid = searchParams.get('uuid');
    const contract = searchParams.get('contract');

    return (
        <RedeemPageContentInner
            sig={sig}
            amount={amount}
            uuid={uuid}
            contract={contract}
        />
    );
}

// Inner component that doesn't directly use useSearchParams
function RedeemPageContentInner({
    sig,
    amount,
    uuid,
    contract
}: {
    sig: string | null,
    amount: string | null,
    uuid: string | null,
    contract: string | null
}) {
    // State for wallet details 
    const [isConnected, setIsConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [targetPrincipal, setTargetPrincipal] = useState<string>('');

    // State for form inputs (pre-populated from URL params)
    const [signature, setSignature] = useState(sig || '');
    const [amountValue, setAmountValue] = useState(amount || '');
    const [uuidValue, setUuidValue] = useState(uuid || '');
    const [contractValue, setContractValue] = useState(contract || '');
    const [contractFromUrl, setContractFromUrl] = useState(!!contract);

    // Token metadata state
    const [tokenMetadata, setTokenMetadata] = useState<TokenCacheData | null>(null);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
    const [metadataError, setMetadataError] = useState<string | null>(null);

    // State for UUID status check
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [isAlreadySubmitted, setIsAlreadySubmitted] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);

    // State for transaction submission
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    const [transactionId, setTransactionId] = useState<string | null>(null);

    // Check validity of inputs
    const isValidSignature = signature && /^(0x)?[0-9a-fA-F]{130}$/.test(signature);
    const isValidAmount = amountValue && /^\d+$/.test(amountValue);
    const isValidUuid = uuidValue && uuidValue.length > 10;
    const isValidContract = contractValue && contractValue.includes('.');
    const isValidTarget = !targetPrincipal || /^SP[0-9A-Z]{33}$/.test(targetPrincipal);

    const canSubmit = isConnected && isValidSignature && isValidAmount && isValidUuid && isValidContract && !isAlreadySubmitted && isValidTarget;

    // Network instance
    const network = STACKS_MAINNET;

    // Read wallet from localStorage on component mount
    useEffect(() => {
        try {
            const storedAddresses = localStorage.getItem('addresses');
            if (storedAddresses) {
                const addresses = JSON.parse(storedAddresses);
                if (addresses.length > 2 && addresses[2]?.address) {
                    setWalletAddress(addresses[2].address);
                    setIsConnected(true);
                } else {
                    setIsConnected(false);
                    setWalletAddress(null);
                }
            } else {
                setIsConnected(false);
                setWalletAddress(null);
            }
        } catch (error) {
            console.error("Error reading wallet address from localStorage:", error);
            setIsConnected(false);
            setWalletAddress(null);
        }
    }, []);

    // Check UUID status when form inputs change
    useEffect(() => {
        if (uuidValue && contractValue) {
            checkUuidStatus();
        }
    }, [uuidValue, contractValue]);

    // Function to check UUID status
    const checkUuidStatus = async () => {
        if (!uuidValue || !contractValue) {
            setCheckError("Both UUID and contract are required to check status");
            return;
        }

        setIsCheckingStatus(true);
        setIsAlreadySubmitted(false);
        setCheckError(null);

        try {
            // Parse the token contract
            const [contractAddress, contractName] = parseContract(contractValue);

            if (!contractAddress || !contractName) {
                throw new Error('Invalid contract format');
            }

            // Call the token contract's check function
            const result = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: 'check',
                functionArgs: [stringAsciiCV(uuidValue)],
                network,
                senderAddress: contractAddress,
            });

            if (result.type === ClarityType.BoolTrue) {
                setIsAlreadySubmitted(true);
            } else if (result.type === ClarityType.BoolFalse) {
                setIsAlreadySubmitted(false);
            } else {
                throw new Error('Unexpected response from contract');
            }
        } catch (err: any) {
            console.error("Error checking UUID status on redeem page:", err);

            // Fallback to checking with blaze contract directly
            try {
                const [blazeAddress, blazeContractName] = parseContract(BLAZE_SIGNER_CONTRACT);

                if (!blazeAddress || !blazeContractName) {
                    throw new Error('Invalid BLAZE_SIGNER_CONTRACT format');
                }

                const fallbackResult = await fetchCallReadOnlyFunction({
                    contractAddress: blazeAddress,
                    contractName: blazeContractName,
                    functionName: 'check',
                    functionArgs: [stringAsciiCV(uuidValue)],
                    network,
                    senderAddress: blazeAddress,
                });

                if (fallbackResult.type === ClarityType.BoolTrue) {
                    setIsAlreadySubmitted(true);
                } else if (fallbackResult.type === ClarityType.BoolFalse) {
                    setIsAlreadySubmitted(false);
                } else {
                    throw new Error('Unexpected response from contract');
                }
            } catch (fallbackErr: any) {
                setCheckError(`Failed to check note status: ${err.message || String(err)}`);
            }
        } finally {
            setIsCheckingStatus(false);
        }
    };

    // Function to connect wallet
    const connectWallet = async () => {
        setIsConnecting(true);
        try {
            const result = await connect();
            if (result?.addresses && result.addresses.length >= 3 && result.addresses[2]?.address) {
                setIsConnected(true);
                setWalletAddress(result.addresses[2].address);
            }
        } catch (error) {
            console.error("Error connecting wallet:", error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Submit the redemption
    const submitRedemption = async () => {
        if (!isValidSignature || !isValidAmount || !isValidUuid || !isValidContract || !isConnected || !isValidTarget) {
            return;
        }

        setIsSubmitting(true);
        setSubmissionError(null);
        setSubmissionSuccess(false);
        setTransactionId(null);

        try {
            // Use target principal if provided, otherwise use connected wallet address
            const recipientAddress = targetPrincipal || walletAddress!;

            // We should call the token contract's x-redeem function rather than blaze.execute directly
            const params = {
                contract: contractValue as `${string}.${string}`,
                functionName: "x-redeem",
                functionArgs: [
                    bufferFromHex(signature),
                    uintCV(amountValue),
                    stringAsciiCV(uuidValue),
                    principalCV(recipientAddress)
                ],
                network: "mainnet"
            };

            const result = await request('stx_callContract', params) as any;

            console.log("result", result);
            if (result && result.txid) {
                setSubmissionSuccess(true);
                setTransactionId(result.txid);
            } else {
                const errorMessage = result?.error?.message || "Transaction failed or was rejected";
                throw new Error(errorMessage);
            }
        } catch (error: any) {
            console.error("Error submitting redemption:", error);
            setSubmissionError(`Failed to submit: ${error.message || String(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render status check results
    const renderStatusCheck = () => {
        if (isCheckingStatus) {
            return (
                <div className="flex items-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking note status...
                </div>
            );
        }

        if (checkError) {
            return (
                <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Status check failed</AlertTitle>
                    <AlertDescription>{checkError}</AlertDescription>
                </Alert>
            );
        }

        if (isAlreadySubmitted) {
            return (
                <Alert variant="warning" className="mt-2 border-orange-200 bg-orange-50 text-orange-800">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Already redeemed</AlertTitle>
                    <AlertDescription>This note has already been submitted and cannot be used again.</AlertDescription>
                </Alert>
            );
        }

        if (uuidValue && !isCheckingStatus) {
            return (
                <div className="flex items-center text-sm text-green-600 mt-1">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Note is available for redemption
                </div>
            );
        }

        return null;
    };

    // Render submission results
    const renderSubmissionResult = () => {
        if (submissionSuccess && transactionId) {
            return (
                <Alert className="mt-4 border-green-200 bg-green-50 text-green-800">
                    <AlertTitle>Transaction submitted successfully!</AlertTitle>
                    <AlertDescription>
                        <p className="mb-2">Your redemption has been submitted to the network.</p>
                        <a
                            href={`https://explorer.stacks.co/txid/${transactionId}?chain=mainnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary hover:underline"
                        >
                            View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    </AlertDescription>
                </Alert>
            );
        }

        if (submissionError) {
            return (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Submission Failed</AlertTitle>
                    <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
            );
        }

        return null;
    };

    // Format amount with proper decimals
    const getFormattedAmount = () => {
        if (!amountValue || !tokenMetadata) return amountValue;

        const amount = parseInt(amountValue);
        if (isNaN(amount)) return amountValue;

        const decimals = tokenMetadata.decimals || 0;
        if (decimals === 0) return amount.toString();

        // Convert to decimal representation
        const decimalAmount = amount / Math.pow(10, decimals);

        // Format with correct number of decimal places
        return decimalAmount.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    };

    // Fetch token metadata when contract value changes
    useEffect(() => {
        async function fetchTokenMetadata() {
            if (!contractValue) return;

            setIsLoadingMetadata(true);
            setMetadataError(null);

            try {
                const metadata = await getTokenMetadataCached(contractValue);
                setTokenMetadata(metadata);
            } catch (error: any) {
                console.error("Error fetching token metadata:", error);
                setMetadataError(error.message || "Failed to load token information");
            } finally {
                setIsLoadingMetadata(false);
            }
        }

        fetchTokenMetadata();
    }, [contractValue]);

    return (
        <div className="container max-w-xl mx-auto py-8 px-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Redeem Bearer Note</CardTitle>
                    <CardDescription>
                        Submit a pre-signed note to receive tokens
                    </CardDescription>

                    {/* Token Info Display */}
                    {tokenMetadata && (
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg border">
                            <div className="flex items-center gap-4">
                                {tokenMetadata.image ? (
                                    <div className="w-16 h-16 relative rounded-md overflow-hidden flex-shrink-0">
                                        <Image
                                            src={tokenMetadata.image}
                                            alt={tokenMetadata.name}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                            className="rounded-md"
                                            onError={(e) => {
                                                // Replace with coin icon if image fails to load
                                                (e.target as HTMLElement).style.display = 'none';
                                                const parent = (e.target as HTMLElement).parentElement;
                                                if (parent) {
                                                    parent.innerHTML = '<div class="w-16 h-16 bg-muted flex items-center justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>';
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                        <Coins className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    <h3 className="text-lg font-medium flex items-center gap-2">
                                        {tokenMetadata.name}
                                        <Badge variant="secondary" className="text-xs">
                                            {tokenMetadata.symbol}
                                        </Badge>
                                    </h3>
                                    {amountValue && (
                                        <div className="text-2xl font-bold mt-1">
                                            {getFormattedAmount()} {tokenMetadata.symbol}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {tokenMetadata.description && (
                                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                                    {tokenMetadata.description}
                                </p>
                            )}
                        </div>
                    )}

                    {isLoadingMetadata && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading token information...
                        </div>
                    )}

                    {metadataError && (
                        <div className="flex items-center gap-2 text-sm text-red-500 mt-2">
                            <Info className="h-4 w-4" />
                            {metadataError}
                        </div>
                    )}
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Wallet Connection Section */}
                    <div className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-medium mb-1 flex items-center">
                                    <Wallet className="h-4 w-4 mr-2" />
                                    Wallet Connection
                                </h3>
                                {isConnected && walletAddress ? (
                                    <p className="text-sm text-muted-foreground">
                                        Connected: <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">Connect your wallet to redeem tokens</p>
                                )}
                            </div>
                            <Button
                                onClick={connectWallet}
                                disabled={isConnecting}
                                variant={isConnected ? "outline" : "default"}
                                size="sm"
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Connecting...
                                    </>
                                ) : isConnected ? "Reconnect" : "Connect Wallet"}
                            </Button>
                        </div>
                    </div>

                    {/* Note Details Form */}
                    <div className="space-y-4 pt-2">
                        {/* Signature Input */}
                        <div className="space-y-2">
                            <Label htmlFor="signature">Signature</Label>
                            <Input
                                id="signature"
                                placeholder="Enter the signature (65 bytes hex)"
                                value={signature}
                                onChange={(e) => setSignature(e.target.value)}
                                className={`font-mono text-xs ${!signature ? '' : isValidSignature ? 'border-green-500' : 'border-red-500'}`}
                            />
                            {signature && !isValidSignature && (
                                <p className="text-xs text-red-500">Invalid signature format</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Amount Input */}
                            <div className="space-y-2">
                                <Label htmlFor="amount">Amount</Label>
                                <Input
                                    id="amount"
                                    placeholder="Token amount (integer)"
                                    value={amountValue}
                                    onChange={(e) => setAmountValue(e.target.value)}
                                    className={`${!amountValue ? '' : isValidAmount ? 'border-green-500' : 'border-red-500'}`}
                                />
                                {amountValue && !isValidAmount && (
                                    <p className="text-xs text-red-500">Amount must be a positive integer</p>
                                )}
                            </div>

                            {/* UUID Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label htmlFor="uuid">UUID</Label>
                                    {uuidValue && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 px-2 text-xs"
                                            onClick={checkUuidStatus}
                                            disabled={isCheckingStatus}
                                        >
                                            {isCheckingStatus ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3 w-3" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                                <Input
                                    id="uuid"
                                    placeholder="Unique identifier"
                                    value={uuidValue}
                                    onChange={(e) => setUuidValue(e.target.value)}
                                    className={`font-mono ${!uuidValue ? '' : isValidUuid ? 'border-green-500' : 'border-red-500'}`}
                                />
                                {renderStatusCheck()}
                            </div>
                        </div>

                        {/* Contract Input - only show if not provided in URL */}
                        {!contractFromUrl && (
                            <div className="space-y-2">
                                <Label htmlFor="contract">Target Contract</Label>
                                <Input
                                    id="contract"
                                    placeholder="Contract principal (e.g., SP2VCQJGH7PHP2DJK7Z0V5BGKZ8GSNXNQ7ZR1HVKV.my-contract)"
                                    value={contractValue}
                                    onChange={(e) => setContractValue(e.target.value)}
                                    className={`font-mono text-xs ${!contractValue ? '' : isValidContract ? 'border-green-500' : 'border-red-500'}`}
                                />
                                {contractValue && !isValidContract && (
                                    <p className="text-xs text-red-500">Invalid contract format</p>
                                )}
                            </div>
                        )}

                        {/* Target Principal Input */}
                        <div className="space-y-2">
                            <Label htmlFor="targetPrincipal">
                                Target Recipient (Optional)
                                <span className="ml-2 text-xs text-muted-foreground">
                                    Defaults to your wallet if left empty
                                </span>
                            </Label>
                            <Input
                                id="targetPrincipal"
                                placeholder={walletAddress || "SP address to receive tokens"}
                                value={targetPrincipal}
                                onChange={(e) => setTargetPrincipal(e.target.value)}
                                className={`font-mono text-xs ${!targetPrincipal ? '' : isValidTarget ? 'border-green-500' : 'border-red-500'}`}
                            />
                            {targetPrincipal && !isValidTarget && (
                                <p className="text-xs text-red-500">Invalid Stacks address format</p>
                            )}
                        </div>
                    </div>

                    {renderSubmissionResult()}

                    {/* Submit Button */}
                    <div className="pt-4">
                        <Button
                            className="w-full"
                            disabled={!canSubmit || isSubmitting || submissionSuccess}
                            onClick={submitRedemption}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : submissionSuccess ? (
                                <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Submitted Successfully
                                </>
                            ) : (
                                <>
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Redeem Tokens
                                </>
                            )}
                        </Button>
                        {!isConnected && (
                            <p className="text-xs text-center mt-2 text-muted-foreground">
                                Please connect your wallet to redeem tokens
                            </p>
                        )}
                        {isAlreadySubmitted && (
                            <p className="text-xs text-center mt-2 text-orange-600">
                                This note has already been redeemed and cannot be used again
                            </p>
                        )}
                    </div>
                </CardContent>

                <Separator />

                <CardFooter className="flex flex-col items-start pt-6">
                    <h4 className="text-sm font-semibold mb-2">How Bearer Notes Work</h4>
                    <p className="text-xs text-muted-foreground leading-normal">
                        Bearer notes are a secure way to transfer tokens off-chain. They work like digital checks -
                        the sender creates and signs a note authorizing a specific amount of tokens to be
                        transferred. Each note has a unique ID (UUID) to prevent double-spending.
                        When you redeem a note, you're submitting this pre-authorized transfer to the blockchain.
                        The system verifies the signature and processes the transfer if the note hasn't been used before.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}

// Export the component with Suspense boundary
export function RedeemPageContent() {
    return (
        <Suspense fallback={
            <div className="container max-w-xl mx-auto py-8 px-4 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        }>
            <SearchParamsReader />
        </Suspense>
    );
} 