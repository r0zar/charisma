"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    ClarityType,
    ClarityValue,
    bufferCV,
    fetchCallReadOnlyFunction,
    ResponseOkCV,
    PrincipalCV,
    StandardPrincipalCV
} from "@stacks/transactions"
import { bufferFromHex } from "@stacks/transactions/dist/cl"
import { Loader2 } from "@repo/ui/icons"
import { Button } from "@repo/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/card"
import { cn } from "@repo/ui/utils"

// Default signer contract - keep in sync with hash-generator
const DEFAULT_SIGNER_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc9"

interface SignatureVerifierProps {
    network: StacksNetwork;
    walletAddress: string; // Needed for senderAddress fallback
    className?: string;
}

type VerificationError = {
    type: 'error';
    message: string;
}

type VerificationSuccess = {
    type: 'success';
    signer: string;
}

type VerificationResult = VerificationError | VerificationSuccess | null;

export function SignatureVerifier({ network, walletAddress, className }: SignatureVerifierProps) {
    const [verifyHash, setVerifyHash] = useState("")
    const [verifySignature, setVerifySignature] = useState("")
    const [verificationResult, setVerificationResult] = useState<VerificationResult>(null)
    const [isVerifying, setIsVerifying] = useState(false)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
    };

    // Function to verify a signature by calling the contract
    const handleVerifySignature = async () => {
        if (!verifyHash || !verifySignature) {
            setVerificationResult({
                type: 'error',
                message: "Both hash and signature are required."
            });
            return;
        }

        setIsVerifying(true);
        setVerificationResult(null);

        try {
            // Parse the signer contract address and name
            const [signerContractAddress, signerContractName] = DEFAULT_SIGNER_CONTRACT.split(".");
            if (!signerContractAddress || !signerContractName) {
                throw new Error("Invalid signer contract format in default configuration");
            }

            // Call the get-signer function on the contract
            const result = await fetchCallReadOnlyFunction({
                contractAddress: signerContractAddress,
                contractName: signerContractName,
                functionName: "get-signer-from-hash",
                functionArgs: [
                    bufferFromHex(verifyHash),
                    bufferFromHex(verifySignature),
                ],
                network,
                senderAddress: walletAddress || signerContractAddress,
            }) as any;

            // Check if the result is a response with principal
            if (result.type === ClarityType.ResponseOk) {
                const principal = result.value.value;
                setVerificationResult({
                    type: 'success',
                    signer: principal
                });
            } else {
                throw new Error("Invalid signature");
            }

        } catch (error) {
            console.error("Error verifying signature:", error);
            setVerificationResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setIsVerifying(false);
        }
    }

    return (
        <Card className={cn("mb-8", className)}>
            <CardHeader>
                <CardTitle>Get Signer by Hash</CardTitle>
                <CardDescription>
                    Recover the signer's principal from a pre-computed hash and signature.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="verify-hash" className="block text-sm font-medium text-foreground">
                            Hash (buff 32)
                        </label>
                        <input
                            id="verify-hash"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x..."
                            value={verifyHash}
                            onChange={handleInputChange(setVerifyHash)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="signature" className="block text-sm font-medium text-foreground">
                            Signature (buff 65)
                        </label>
                        <input
                            id="signature"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x..."
                            value={verifySignature}
                            onChange={handleInputChange(setVerifySignature)}
                        />
                    </div>

                    <Button
                        onClick={handleVerifySignature}
                        className="w-full mt-4"
                        disabled={isVerifying || !verifyHash || !verifySignature}
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            "Recover Signer"
                        )}
                    </Button>

                    <div className="mt-4 p-4 rounded-md border border-border">
                        <p className="text-sm font-medium mb-1">Verification Result:</p>
                        <div className="font-mono text-sm break-all">
                            {isVerifying ? (
                                "Verifying signature..."
                            ) : !verificationResult ? (
                                "Result will appear here..."
                            ) : verificationResult.type === 'error' ? (
                                <span className="text-destructive">{verificationResult.message}</span>
                            ) : (
                                <span className="text-primary">{verificationResult.signer}</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 