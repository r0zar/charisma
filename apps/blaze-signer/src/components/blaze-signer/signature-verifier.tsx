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
        <div className={`card mb-8 ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Get Signer by Hash</h2>
                <p className="card-description">
                    Recover the signer's principal from a pre-computed hash and signature.
                </p>
            </div>
            <div className="card-content space-y-4">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="verify-hash" className="label">
                            Hash (buff 32)
                        </label>
                        <input
                            id="verify-hash"
                            className="input"
                            placeholder="0x..."
                            value={verifyHash}
                            onChange={handleInputChange(setVerifyHash)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="signature" className="label">
                            Signature (buff 65)
                        </label>
                        <input
                            id="signature"
                            className="input"
                            placeholder="0x..."
                            value={verifySignature}
                            onChange={handleInputChange(setVerifySignature)}
                        />
                    </div>
                </div>

                <button
                    onClick={handleVerifySignature}
                    className="button w-full mt-4"
                    disabled={isVerifying || !verifyHash || !verifySignature}
                >
                    {isVerifying ? (
                        <>
                            <Loader2 className="button-icon h-4 w-4 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        "Recover Signer"
                    )}
                </button>

                <div className="result-box md:col-span-2">
                    <p className="result-box-title">Verification Result:</p>
                    <div className="result-box-content">
                        {isVerifying ? (
                            "Verifying signature..."
                        ) : !verificationResult ? (
                            "Result will appear here..."
                        ) : verificationResult.type === 'error' ? (
                            <span className="text-destructive">{verificationResult.message}</span>
                        ) : (
                            <span className="text-primary">Signer: {verificationResult.signer}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 