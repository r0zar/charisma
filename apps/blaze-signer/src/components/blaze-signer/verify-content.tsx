'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchCallReadOnlyFunction, stringAsciiCV, principalCV, ClarityType } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { BLAZE_SIGNER_CONTRACT, parseContract } from '../../constants/contracts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Loader2, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import Link from 'next/link';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

// This component safely uses useSearchParams hook
function SearchParamsReader() {
    const searchParams = useSearchParams();
    const uuid = searchParams.get('uuid');
    const contract = searchParams.get('contract');

    return (
        <VerifyContentInner
            uuid={uuid}
            contract={contract}
        />
    );
}

// Main component implementation
function VerifyContentInner({
    uuid,
    contract
}: {
    uuid: string | null,
    contract: string | null
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'submitted' | 'not_submitted' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [contractDetails, setContractDetails] = useState<{ contractAddress: string, contractName: string } | null>(null);

    // Use STACKS_MAINNET directly, it's already an instance
    const network = STACKS_MAINNET;

    useEffect(() => {
        if (!uuid || !contract) return;

        const checkUuidStatus = async () => {
            setIsLoading(true);
            setVerificationStatus(null);
            setError(null);

            try {
                // We need to check the token contract's is-uuid-submitted function
                // Parse the token contract
                const [contractAddress, contractName] = parseContract(contract);

                if (!contractAddress || !contractName) {
                    throw new Error('Invalid token contract format');
                }

                setContractDetails({
                    contractAddress,
                    contractName
                });

                // Call the token contract to check if this UUID has been redeemed
                const result = await fetchCallReadOnlyFunction({
                    contractAddress,
                    contractName,
                    functionName: 'check',
                    functionArgs: [stringAsciiCV(uuid)],
                    network,
                    senderAddress: contractAddress,
                });

                // Parse the response properly
                if (result.type === ClarityType.BoolTrue) {
                    setVerificationStatus('submitted');
                } else if (result.type === ClarityType.BoolFalse) {
                    setVerificationStatus('not_submitted');
                } else {
                    throw new Error('Unexpected response from contract');
                }
            } catch (err: any) {
                console.error('Error checking UUID status:', err);

                // If check fails, try to check with the blaze contract directly
                try {
                    // Fallback to checking with the blaze contract
                    const [blazeAddress, blazeContractName] = parseContract(BLAZE_SIGNER_CONTRACT);

                    if (!blazeAddress || !blazeContractName) {
                        throw new Error('Invalid BLAZE_SIGNER_CONTRACT format');
                    }

                    const fallbackResult = await fetchCallReadOnlyFunction({
                        contractAddress: blazeAddress,
                        contractName: blazeContractName,
                        functionName: 'check',
                        functionArgs: [stringAsciiCV(uuid)],
                        network,
                        senderAddress: blazeAddress,
                    });

                    if (fallbackResult.type === ClarityType.BoolTrue) {
                        setVerificationStatus('submitted');
                    } else if (fallbackResult.type === ClarityType.BoolFalse) {
                        setVerificationStatus('not_submitted');
                    } else {
                        throw new Error('Unexpected response from contract');
                    }
                } catch (fallbackErr: any) {
                    // If both checks fail, set the error
                    setError(`Failed to verify note: ${err.message || String(err)}`);
                }
            } finally {
                setIsLoading(false);
            }
        };

        checkUuidStatus();
    }, [uuid, contract, network]);

    // Function to render status display
    const renderStatusDisplay = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-6">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="text-lg font-medium">Verifying note status...</p>
                </div>
            );
        }

        if (error) {
            return (
                <Alert variant="destructive" className="my-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Verification Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            );
        }

        if (verificationStatus === 'submitted') {
            return (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="bg-orange-100 p-3 rounded-full mb-4">
                        <XCircle className="h-10 w-10 text-orange-600" />
                    </div>
                    <h2 className="text-xl font-bold text-orange-600 mb-2">Already Redeemed</h2>
                    <p className="text-orange-700 mb-4">This note has already been submitted and cannot be used again.</p>
                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                        UUID: {uuid}
                    </Badge>
                </div>
            );
        }

        if (verificationStatus === 'not_submitted') {
            return (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="bg-green-100 p-3 rounded-full mb-4">
                        <CheckCircle className="h-10 w-10 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-green-600 mb-2">Ready to Redeem</h2>
                    <p className="text-green-700 mb-4">This note has not been redeemed yet and is valid for use.</p>
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        UUID: {uuid}
                    </Badge>

                    {contract && (
                        <div className="mt-6 w-full">
                            <Button
                                className="w-full"
                                variant="default"
                                asChild
                            >
                                <Link href={`/redeem?uuid=${uuid}&contract=${contract}`}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Redeem This Note
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center py-6">
                <p className="text-lg text-muted-foreground">No verification status available</p>
            </div>
        );
    };

    // Main render method
    return (
        <div className="container max-w-xl mx-auto py-8 px-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Note Verification</CardTitle>
                    <CardDescription>
                        Check if a bearer note has already been redeemed
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    {!uuid ? (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Missing UUID</AlertTitle>
                            <AlertDescription>
                                No UUID parameter was provided. You need a valid UUID to verify a note.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        renderStatusDisplay()
                    )}
                </CardContent>

                {uuid && (contractDetails || contract) && (
                    <CardFooter className="flex flex-col items-start border-t pt-4">
                        <details className="w-full">
                            <summary className="cursor-pointer text-sm text-muted-foreground">
                                Technical Details
                            </summary>
                            <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono space-y-1">
                                <p><strong>UUID:</strong> {uuid}</p>
                                {contract && (
                                    <p><strong>Target Contract:</strong> {contract}</p>
                                )}
                                <p>
                                    <strong>Signer Contract:</strong> {BLAZE_SIGNER_CONTRACT}
                                </p>
                                {contractDetails && (
                                    <p>
                                        <a
                                            href={`https://explorer.stacks.co/address/${contractDetails.contractAddress}.${contractDetails.contractName}?chain=mainnet`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary inline-flex items-center hover:underline"
                                        >
                                            View on Explorer <ExternalLink className="ml-1 h-3 w-3" />
                                        </a>
                                    </p>
                                )}
                            </div>
                        </details>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}

// Export the component with Suspense boundary
export function VerifyContent() {
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