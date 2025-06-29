"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, ClarityType, cvToValue, bufferCV } from "@stacks/transactions"
import { Loader2 } from "lucide-react"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card"
import { cn } from "../ui/utils"

interface VerifySignatureProps {
    network: StacksNetwork
    walletAddress: string
    className?: string
}

type VerificationError = {
    type: 'error'
    message: string
}

type VerificationSuccess = {
    type: 'success'
    signer: string
}

type VerificationResult = VerificationError | VerificationSuccess | null

export function VerifySignature({ network, walletAddress, className }: VerifySignatureProps) {
    const [messageHash, setMessageHash] = useState("")
    const [signature, setSignature] = useState("")
    const [verificationResult, setVerificationResult] = useState<VerificationResult>(null)
    const [isVerifying, setIsVerifying] = useState(false)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
    }

    // Function to verify a signature by calling the contract
    const handleVerifySignature = async () => {
        if (!signature || !messageHash) {
            setVerificationResult({
                type: 'error',
                message: "Message Hash and Signature fields are required."
            })
            return
        }

        // Basic check for signature format (hex, 130 chars/65 bytes)
        const cleanSignature = signature.startsWith('0x') ? signature.substring(2) : signature;
        if (!/^[0-9a-fA-F]+$/.test(cleanSignature) || cleanSignature.length !== 130) {
            setVerificationResult({ type: 'error', message: "Signature must be a 65-byte hex string (130 characters)" })
            return
        }

        // Basic check for hash format (hex, 64 chars/32 bytes)
        const cleanMessageHash = messageHash.startsWith('0x') ? messageHash.substring(2) : messageHash;
        if (!/^[0-9a-fA-F]+$/.test(cleanMessageHash) || cleanMessageHash.length !== 64) {
            setVerificationResult({ type: 'error', message: "Message Hash must be a 32-byte hex string (64 characters)" })
            return
        }

        setIsVerifying(true)
        setVerificationResult(null)

        try {
            // Parse the contract address and name from constant
            const [contractAddress, contractName] = BLAZE_SIGNER_CONTRACT.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid signer contract format in default configuration")
            }

            // Call the updated 'verify' function
            const result: any = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "verify",
                functionArgs: [
                    bufferCV(Buffer.from(cleanMessageHash, 'hex')),
                    bufferCV(Buffer.from(cleanSignature, 'hex')),
                ],
                network,
                senderAddress: walletAddress || contractAddress,
            })

            // verify returns (ok principal) or (err ...)
            if (result && result.type === ClarityType.ResponseOk && result.value && result.value.type === ClarityType.PrincipalStandard) {
                const principal = cvToValue(result.value)
                setVerificationResult({
                    type: 'success',
                    signer: principal
                })
            } else if (result && result.type === ClarityType.ResponseErr) {
                const errorDetails = JSON.stringify(cvToValue(result.value, true));
                throw new Error(`Contract returned error: ${errorDetails}`);
            } else {
                // Handle unexpected result structure or wrong principal type
                const errorDetails = result ? JSON.stringify(cvToValue(result, true)) : 'Verification failed';
                throw new Error(`Invalid signature or hash, or unexpected result: ${errorDetails}`);
            }

        } catch (error) {
            console.error("Error verifying signature:", error)
            setVerificationResult({
                type: 'error',
                message: error instanceof Error ? error.message : String(error)
            })
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Verify Signature by Hash</CardTitle>
                <CardDescription>
                    Verify a signature against its pre-computed SIP-018 message hash.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="message-hash" className="block text-sm font-medium text-foreground">
                            Message Hash (hex buffer 32)
                        </label>
                        <input
                            id="message-hash"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (64 hex characters)"
                            value={messageHash}
                            onChange={handleInputChange(setMessageHash)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="verify-signature" className="block text-sm font-medium text-foreground">
                            Signature (hex buffer 65)
                        </label>
                        <input
                            id="verify-signature"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (130 hex characters)"
                            value={signature}
                            onChange={handleInputChange(setSignature)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleVerifySignature}
                        disabled={isVerifying || !messageHash || !signature}
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="ml-2">Verifying...</span>
                            </>
                        ) : (
                            "Verify Signature"
                        )}
                    </Button>

                    <div className="mt-4 p-4 rounded-md border border-border">
                        <p className="text-sm font-medium mb-1">Verification Result</p>
                        <div className="text-base">
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
            </CardContent>
        </Card>
    )
} 