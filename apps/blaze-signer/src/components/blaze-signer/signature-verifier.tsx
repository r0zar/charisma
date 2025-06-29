"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import {
    ClarityType,
    bufferCV,
    fetchCallReadOnlyFunction,
    stringAsciiCV,
    uintCV,
    optionalCVOf,
    noneCV,
    cvToValue,
    principalCV
} from "@stacks/transactions"
import { bufferFromHex } from "@stacks/transactions/dist/cl"
import { Loader2 } from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card"
import { cn } from "../ui/utils"
import { BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"

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
    const [signature, setSignature] = useState("")
    const [contract, setContract] = useState("")
    const [intent, setIntent] = useState("")
    const [opcodeOptional, setOpcodeOptional] = useState("")
    const [amountOptional, setAmountOptional] = useState("")
    const [targetOptional, setTargetOptional] = useState("")
    const [uuid, setUuid] = useState("")
    const [verificationResult, setVerificationResult] = useState<VerificationResult>(null)
    const [isVerifying, setIsVerifying] = useState(false)

    // Typed event handler
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
    };

    // Added Helper Handlers
    const handleHexBufferChange = (setter: React.Dispatch<React.SetStateAction<string>>, maxLengthBytes: number) => (e: ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value.replace(/[^0-9a-fA-F]/g, '');
        if (hex.length / 2 <= maxLengthBytes) { setter(hex); } else { setter(hex.substring(0, maxLengthBytes * 2)); }
    };
    const handleUintChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setter(val);
    };

    // Updated Function to Recover Signer
    const handleRecoverSigner = async () => {
        if (!signature || !contract || !intent || !uuid) {
            setVerificationResult({
                type: 'error',
                message: "Signature, Contract, Intent, and UUID are required."
            });
            return;
        }
        if (intent.length > 32) { setVerificationResult({ type: 'error', message: "Intent exceeds 32 chars" }); return; }
        if (opcodeOptional && (opcodeOptional.length === 0 || opcodeOptional.length % 2 !== 0 || opcodeOptional.length / 2 > 16)) { setVerificationResult({ type: 'error', message: "Invalid optional opcode hex" }); return; }
        if (targetOptional && (!targetOptional.startsWith('SP') && !targetOptional.startsWith('ST'))) { setVerificationResult({ type: 'error', message: "Invalid optional target principal" }); return; }
        if (amountOptional && !/^\d+$/.test(amountOptional)) { setVerificationResult({ type: 'error', message: "Invalid optional amount" }); return; }
        if (!contract.startsWith('SP') && !contract.startsWith('ST')) { setVerificationResult({ type: 'error', message: "Invalid contract principal" }); return; }
        if (uuid.length > 36) { setVerificationResult({ type: 'error', message: "UUID exceeds 36 chars" }); return; }
        if (!/^(0x)?[0-9a-fA-F]{130}$/.test(signature)) {
            setVerificationResult({ type: 'error', message: "Invalid signature format (must be 65 bytes hex)" });
            return;
        }

        setIsVerifying(true);
        setVerificationResult(null);

        try {
            // Parse the signer contract address and name from BLAZE_SIGNER_CONTRACT
            const [signerContractAddress, signerContractName] = BLAZE_SIGNER_CONTRACT.split(".");
            if (!signerContractAddress || !signerContractName) {
                throw new Error("Invalid signer contract format in default configuration");
            }

            // Prepare optional arguments: Use optionalCVOf only when there IS a value.
            const opcodeArg = opcodeOptional ? optionalCVOf(bufferCV(Buffer.from(opcodeOptional, 'hex'))) : noneCV();
            const amountArg = amountOptional ? optionalCVOf(uintCV(amountOptional)) : noneCV();
            const targetArg = targetOptional ? optionalCVOf(principalCV(targetOptional)) : noneCV();

            // Call the read-only function (assuming it's called 'recover', adjust if needed)
            const result = await fetchCallReadOnlyFunction({
                contractAddress: signerContractAddress,
                contractName: signerContractName,
                functionName: "recover", // Ensure this matches the actual function name
                functionArgs: [
                    bufferFromHex(signature), // Use bufferFromHex directly
                    principalCV(contract),
                    stringAsciiCV(intent),
                    opcodeArg,
                    amountArg,
                    targetArg,
                    stringAsciiCV(uuid)
                ],
                network,
                senderAddress: walletAddress || signerContractAddress, // Provide a valid sender address
            });

            // Check the result type correctly
            if (result && result.type === ClarityType.ResponseOk && result.value && result.value.type === ClarityType.PrincipalStandard) {
                const principal = cvToValue(result.value);
                setVerificationResult({
                    type: 'success',
                    signer: principal
                });
            } else if (result && result.type === ClarityType.ResponseErr) {
                const errorDetails = JSON.stringify(cvToValue(result.value, true));
                throw new Error(`Contract returned error: ${errorDetails}`);
            } else {
                // Handle unexpected result structure
                throw new Error('Could not recover signer: Unexpected result format from read-only call.');
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
                <CardTitle>Recover Signer by Intent Data</CardTitle>
                <CardDescription>
                    Recover the signer's principal from the signature and the full intent data.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="recover-contract" className="block text-sm font-medium text-foreground">
                            Contract (principal)
                        </label>
                        <input
                            id="recover-contract"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="SP... Contract that signed the intent"
                            value={contract}
                            onChange={handleInputChange(setContract)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="recover-intent" className="block text-sm font-medium text-foreground">
                            Intent (string-ascii 32)
                        </label>
                        <input
                            id="recover-intent"
                            maxLength={32}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="e.g., TRANSFER, MINT"
                            value={intent}
                            onChange={handleInputChange(setIntent)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="recover-opcode-optional" className="block text-sm font-medium text-foreground">
                            Opcode (Optional, hex buffer 16)
                        </label>
                        <input
                            id="recover-opcode-optional"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (max 32 hex chars)"
                            value={opcodeOptional}
                            onChange={handleHexBufferChange(setOpcodeOptional, 16)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="recover-amount-optional" className="block text-sm font-medium text-foreground">
                            Amount (Optional, uint)
                        </label>
                        <input
                            id="recover-amount-optional"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="e.g., 1000000"
                            value={amountOptional}
                            onChange={handleUintChange(setAmountOptional)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="recover-target-optional" className="block text-sm font-medium text-foreground">
                            Target (Optional, principal)
                        </label>
                        <input
                            id="recover-target-optional"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="SP... or ST..."
                            value={targetOptional}
                            onChange={handleInputChange(setTargetOptional)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="recover-uuid" className="block text-sm font-medium text-foreground">
                            UUID (string-ascii 36)
                        </label>
                        <input
                            id="recover-uuid"
                            maxLength={36}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="Enter unique request ID (max 36 chars)"
                            value={uuid}
                            onChange={handleInputChange(setUuid)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="recover-signature" className="block text-sm font-medium text-foreground">
                            Signature (hex buffer 65)
                        </label>
                        <input
                            id="recover-signature"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (130 hex characters)"
                            value={signature}
                            onChange={handleInputChange(setSignature)}
                        />
                    </div>

                    <Button
                        onClick={handleRecoverSigner}
                        className="w-full mt-4"
                        disabled={isVerifying || !signature || !contract || !intent || !uuid}
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="ml-2">Verifying...</span>
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