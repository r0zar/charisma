"use client"

import React, { useState, ChangeEvent, useEffect } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, stringAsciiCV, cvToHex, ClarityValue, principalCV, tupleCV, uintCV, cvToValue, bufferCV, optionalCVOf, noneCV, ClarityType } from "@stacks/transactions"
import { Copy, Loader2, CheckCircle2 } from "lucide-react"
import { request } from "@stacks/connect"
import { QRCodeSVG } from 'qrcode.react'
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card"
import { cn } from "../ui/utils"
import { BLAZE_SIGNER_CONTRACT, generateUUID, BLAZE_PROTOCOL_NAME, BLAZE_PROTOCOL_VERSION } from "../../constants/contracts"

// Add padding utility function at the top level
function padTo64Chars(input: string): string {
    if (input.length > 64) {
        throw new Error("Input exceeds 64 characters");
    }
    return input.padEnd(64, ' ');
}

interface HashGeneratorProps {
    network: StacksNetwork
    isWalletConnected: boolean
    walletAddress: string
    className?: string
}

export function HashGenerator({
    network,
    isWalletConnected,
    walletAddress,
    className
}: HashGeneratorProps) {
    const [intent, setIntent] = useState("")
    const [opcodeOptional, setOpcodeOptional] = useState("")
    const [amountOptional, setAmountOptional] = useState("")
    const [targetOptional, setTargetOptional] = useState("")
    const [hashUuid, setHashUuid] = useState("")
    const [coreContract, setCoreContract] = useState("")
    const [generatedHash, setGeneratedHash] = useState("")
    const [isGeneratingHash, setIsGeneratingHash] = useState(false)
    const [hashCopied, setHashCopied] = useState(false)
    const [signature, setSignature] = useState("")
    const [isSigning, setIsSigning] = useState(false)
    const [publicQrData, setPublicQrData] = useState<string | null>(null)
    const [privateQrData, setPrivateQrData] = useState<string | null>(null)
    const [baseUrl, setBaseUrl] = useState("");

    // Get base URL on component mount (client-side only)
    useEffect(() => {
        setBaseUrl(window.location.origin);
    }, []);

    // Type event handlers explicitly
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setter(e.target.value);
    };

    // Helper for optional hex buffer input
    const handleHexBufferChange = (setter: React.Dispatch<React.SetStateAction<string>>, maxLengthBytes: number) => (e: ChangeEvent<HTMLInputElement>) => {
        const hex = e.target.value.replace(/[^0-9a-fA-F]/g, ''); // Allow only hex characters
        if (hex.length / 2 <= maxLengthBytes) { // Check byte length (2 hex chars per byte)
            setter(hex);
        } else {
            // Optionally provide feedback that max length is reached
            setter(hex.substring(0, maxLengthBytes * 2));
        }
    };

    // Helper for optional uint input
    const handleUintChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, ''); // Allow only digits
        setter(val);
    };

    const handleGenerateUUID = () => {
        setHashUuid(generateUUID());
    };

    const generateStructuredDataHash = async () => {
        if (!intent || !hashUuid || !coreContract) {
            setGeneratedHash("Error: Intent, UUID, and Contract fields are required")
            return
        }
        if (intent.length > 32) {
            setGeneratedHash("Error: Intent exceeds 32 ASCII characters")
            return
        }
        if (opcodeOptional && (opcodeOptional.length === 0 || opcodeOptional.length % 2 !== 0 || opcodeOptional.length / 2 > 16)) {
            setGeneratedHash("Error: Optional Opcode must be a valid hex string representing max 16 bytes")
            return
        }
        // Basic principal format check (simple)
        if (targetOptional && (!targetOptional.startsWith('SP') && !targetOptional.startsWith('ST'))) {
            setGeneratedHash("Error: Optional Target does not look like a valid principal")
            return
        }
        if (amountOptional && !/^\d+$/.test(amountOptional)) {
            setGeneratedHash("Error: Optional Amount must be a valid positive integer")
            return
        }

        setIsGeneratingHash(true)
        setGeneratedHash("")
        setSignature("")
        setPublicQrData(null)
        setPrivateQrData(null)

        try {
            const [contractAddress, contractName] = BLAZE_SIGNER_CONTRACT.split(".")
            if (!contractAddress || !contractName) {
                throw new Error("Invalid signer contract format in configuration")
            }

            // Prepare optional arguments: Use optionalCVOf only when there IS a value.
            const opcodeArg = opcodeOptional ? optionalCVOf(bufferCV(Buffer.from(opcodeOptional, 'hex'))) : noneCV();
            const amountArg = amountOptional ? optionalCVOf(uintCV(amountOptional)) : noneCV();
            const targetArg = targetOptional ? optionalCVOf(principalCV(targetOptional)) : noneCV();

            // Call the 'hash' function (ensure function name is correct)
            const result: any = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "hash", // Assuming this is the function in BLAZE_SIGNER_CONTRACT
                functionArgs: [
                    principalCV(coreContract),
                    stringAsciiCV(intent),
                    opcodeArg, // Pass the correctly constructed optional value
                    amountArg, // Pass the correctly constructed optional value
                    targetArg, // Pass the correctly constructed optional value
                    stringAsciiCV(hashUuid)
                ],
                network,
                senderAddress: walletAddress || contractAddress, // Ensure a sender is provided
            })

            if (result?.value?.value) {
                setGeneratedHash(result.value.value)
            } else {
                const errorDetails = result ? JSON.stringify(cvToValue(result, true)) : 'Unknown error structure';
                throw new Error(`Failed to generate hash: ${errorDetails}`);
            }
        } catch (error) {
            console.error("Error generating hash:", error)
            setGeneratedHash(`Error: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
            setIsGeneratingHash(false)
        }
    }

    // Function to sign a hash with wallet
    const signWithWallet = async (hash: string) => {
        if (!isWalletConnected || !hash || hash.startsWith("Error")) return

        setIsSigning(true)
        setSignature("")
        setPublicQrData(null)
        setPrivateQrData(null)

        try {
            // Prepare optional arguments for signing: Use optionalCVOf only when there IS a value.
            const opcodeArg = opcodeOptional ? optionalCVOf(bufferCV(Buffer.from(opcodeOptional, 'hex'))) : noneCV();
            const amountArg = amountOptional ? optionalCVOf(uintCV(amountOptional)) : noneCV();
            const targetArg = targetOptional ? optionalCVOf(principalCV(targetOptional)) : noneCV();

            // Updated signing payload
            const data = await request('stx_signStructuredMessage', {
                domain: tupleCV({
                    name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                    version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                    'chain-id': uintCV(network.chainId),
                }),
                message: tupleCV({
                    contract: principalCV(coreContract),
                    intent: stringAsciiCV(intent),
                    opcode: opcodeArg, // Pass the correctly constructed optional value
                    amount: amountArg, // Pass the correctly constructed optional value
                    target: targetArg, // Pass the correctly constructed optional value
                    uuid: stringAsciiCV(hashUuid),
                })
            })
            if (data && data.signature) {
                setSignature(data.signature)

                if (baseUrl) {
                    const publicUrl = `${baseUrl}/verify?uuid=${encodeURIComponent(hashUuid)}&contract=${encodeURIComponent(coreContract)}`;
                    setPublicQrData(publicUrl);
                    setPrivateQrData(null);
                } else {
                    console.warn("Base URL not available yet for QR code generation.");
                }
            }
        } catch (error) {
            console.error("Error signing message:", error)
            alert(`Error signing message: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
            setIsSigning(false)
        }
    }

    // Function to copy text to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setHashCopied(true)
        setTimeout(() => setHashCopied(false), 2000)
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Generate SIP-018 Hash</CardTitle>
                <CardDescription>
                    Create the hash that needs to be signed off-chain using signer contract.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="core-contract" className="block text-sm font-medium text-foreground">
                            Subnet Contract (principal)
                        </label>
                        <input
                            id="core-contract"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="SP... (Contract allowed to call 'execute')"
                            value={coreContract}
                            onChange={handleInputChange(setCoreContract)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="intent" className="block text-sm font-medium text-foreground">
                            Intent (string-ascii 32) *
                        </label>
                        <input
                            id="intent"
                            maxLength={32}
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="e.g., TRANSFER, MINT, VOTE_YAE"
                            value={intent}
                            onChange={handleInputChange(setIntent)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="opcode-optional" className="block text-sm font-medium text-foreground">
                            Opcode (Optional, hex buffer 16)
                        </label>
                        <input
                            id="opcode-optional"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="0x... (e.g., 0123abcd... max 32 hex chars)"
                            value={opcodeOptional}
                            onChange={handleHexBufferChange(setOpcodeOptional, 16)}
                        />
                        {opcodeOptional && (opcodeOptional.length % 2 !== 0) && <p className="text-xs text-destructive">Hex string must have an even number of characters.</p>}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="amount-optional" className="block text-sm font-medium text-foreground">
                            Amount (Optional, uint)
                        </label>
                        <input
                            id="amount-optional"
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
                        <label htmlFor="target-optional" className="block text-sm font-medium text-foreground">
                            Target (Optional, principal)
                        </label>
                        <input
                            id="target-optional"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="SP... or ST..."
                            value={targetOptional}
                            onChange={handleInputChange(setTargetOptional)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="hash-uuid" className="block text-sm font-medium text-foreground">
                            UUID (string-ascii 36) *
                        </label>
                        <div className="flex space-x-2">
                            <input
                                id="hash-uuid"
                                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                placeholder="Enter unique request ID"
                                value={hashUuid}
                                onChange={handleInputChange(setHashUuid)}
                                maxLength={36}
                            />
                            <Button
                                type="button"
                                onClick={handleGenerateUUID}
                            >
                                Generate
                            </Button>
                        </div>
                    </div>

                    <Button
                        className="w-full"
                        onClick={generateStructuredDataHash}
                        disabled={isGeneratingHash || !intent || !hashUuid || !coreContract}
                    >
                        {isGeneratingHash ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                <span className="ml-2">Generating...</span>
                            </>
                        ) : (
                            "Generate Hash"
                        )}
                    </Button>

                    {generatedHash && !generatedHash.startsWith("Error:") && (
                        <div className="space-y-4 md:col-span-2">
                            <div className="mt-4 p-4 rounded-md border border-border bg-muted/40">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold">Generated Hash</h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => copyToClipboard(generatedHash)}
                                    >
                                        {hashCopied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <p className="text-sm font-mono break-all text-muted-foreground">{generatedHash}</p>
                            </div>

                            <Button
                                className="w-full"
                                onClick={() => signWithWallet(generatedHash)}
                                disabled={!isWalletConnected || isSigning || !generatedHash || generatedHash.startsWith("Error")}
                            >
                                {isSigning ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span className="ml-2">Signing...</span>
                                    </>
                                ) : (
                                    "Sign with Wallet"
                                )}
                            </Button>

                            {signature && (
                                <div className="mt-4 p-4 rounded-md border border-border bg-muted/40">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold">Signature</h3>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-foreground"
                                            onClick={() => copyToClipboard(signature)}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-sm font-mono break-all text-muted-foreground">{signature}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {generatedHash && generatedHash.startsWith("Error:") && (
                        <p className="mt-4 text-sm text-destructive">{generatedHash}</p>
                    )}

                    {signature && (publicQrData || privateQrData) && (
                        <div className="flex flex-wrap gap-4 mt-4">
                            {publicQrData && (
                                <a
                                    href={publicQrData}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="no-underline text-foreground block flex-1 min-w-[150px]"
                                >
                                    <div className="border border-border rounded-md p-4 bg-background">
                                        <h3 className="font-bold mb-2">Public Verification QR</h3>
                                        <div className="flex justify-center p-4">
                                            {/* @ts-ignore */}
                                            <QRCodeSVG value={publicQrData} size={128} />
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center mt-2">
                                            Scan to verify UUID status.
                                        </p>
                                    </div>
                                </a>
                            )}
                            {privateQrData && (
                                <a
                                    href={privateQrData}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="no-underline text-foreground block flex-1 min-w-[150px]"
                                >
                                    <div className="border border-border rounded-md p-4 bg-background">
                                        <h3 className="font-bold mb-2">Private Redeem QR</h3>
                                        <div className="flex justify-center p-4">
                                            {/* @ts-ignore */}
                                            <QRCodeSVG value={privateQrData} size={128} />
                                        </div>
                                        <p className="text-xs text-muted-foreground text-center mt-2">
                                            Scan to pre-fill redeem form.
                                        </p>
                                    </div>
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 