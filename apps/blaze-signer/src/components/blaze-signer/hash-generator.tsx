"use client"

import React, { useState, ChangeEvent, useEffect } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, stringAsciiCV, cvToHex, ClarityValue, principalCV, tupleCV, uintCV, cvToValue } from "@stacks/transactions"
import { Copy, Loader2, CheckCircle2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"
import { QRCodeSVG } from 'qrcode.react'
import { Button } from "@repo/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/card"
import { cn } from "@repo/ui/utils"
import { BLAZE_SIGNER_CONTRACT, generateUUID, BLAZE_PROTOCOL_NAME, BLAZE_PROTOCOL_VERSION } from "../../constants/contracts"

// Add padding utility function at the top level
function padTo64Chars(input: string): string {
    if (input.length > 64) {
        throw new Error("Input exceeds 64 characters");
    }
    return input.padEnd(64, ' ');
}

// Helper function to parse amount from opcode string
function parseAmountFromOpcode(opcode: string): string | null {
    // Updated regex to match TRANSFER_<number> format
    const match = opcode.match(/^TRANSFER_(\d+)$/);
    return match ? match[1] : null; // Returns the digits if found, otherwise null
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
    const [opcode, setOpcode] = useState("")
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

    const handleGenerateUUID = () => {
        setHashUuid(generateUUID());
    };

    const generateStructuredDataHash = async () => {
        if (!opcode || !hashUuid || !coreContract) {
            setGeneratedHash("Error: All fields are required")
            return
        }

        setIsGeneratingHash(true)
        setGeneratedHash("")
        setSignature("")
        setPublicQrData(null)
        setPrivateQrData(null)

        try {
            // Validate input lengths
            if (opcode.length > 64) {
                throw new Error("Opcode exceeds 64 characters");
            }
            if (hashUuid.length > 64) {
                throw new Error("UUID exceeds 64 characters");
            }

            // Parse the contract address and name from constant
            const [contractAddress, contractName] = BLAZE_SIGNER_CONTRACT.split(".")

            if (!contractAddress || !contractName) {
                throw new Error("Invalid signer contract format in default configuration")
            }

            // Call the hash-data function on the contract
            const result: any = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: "hash-args",
                functionArgs: [
                    principalCV(coreContract),
                    stringAsciiCV(opcode),
                    stringAsciiCV(hashUuid)],
                network,
                senderAddress: walletAddress || contractAddress,
            })

            setGeneratedHash(result.value.value)
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
            const data = await request('stx_signStructuredMessage', {
                domain: tupleCV({
                    name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                    version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                    'chain-id': uintCV(network.chainId),
                }),
                message: tupleCV({
                    contract: principalCV(coreContract),
                    opcode: stringAsciiCV(opcode),
                    uuid: stringAsciiCV(hashUuid),
                })
            })
            if (data && data.signature) {
                setSignature(data.signature)

                // Generate QR Code Data only if baseUrl is available
                if (baseUrl) {
                    const amount = parseAmountFromOpcode(opcode);
                    if (amount) {
                        // Prepend baseUrl to create absolute URLs
                        const publicUrl = `${baseUrl}/verify?uuid=${encodeURIComponent(hashUuid)}&contract=${encodeURIComponent(coreContract)}`;
                        const privateUrl = `${baseUrl}/redeem?sig=${encodeURIComponent(data.signature)}&amount=${encodeURIComponent(amount)}&uuid=${encodeURIComponent(hashUuid)}`;
                        setPublicQrData(publicUrl);
                        setPrivateQrData(privateUrl);
                    } else {
                        console.warn("Could not parse amount from opcode for QR code generation.");
                    }
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
                            placeholder="SP... (Contract allowed to call 'submit')"
                            value={coreContract}
                            onChange={handleInputChange(setCoreContract)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="opcode" className="block text-sm font-medium text-foreground">
                            Opcode (string-ascii 64)
                        </label>
                        <input
                            id="opcode"
                            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            placeholder="action=transfer;token=ST...;amount=100"
                            value={opcode}
                            onChange={handleInputChange(setOpcode)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="hash-uuid" className="block text-sm font-medium text-foreground">
                            UUID (string-ascii 64)
                        </label>
                        <div className="flex space-x-2">
                            <input
                                id="hash-uuid"
                                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                placeholder="Enter unique request ID"
                                value={hashUuid}
                                onChange={handleInputChange(setHashUuid)}
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
                        disabled={isGeneratingHash || !opcode || !hashUuid || !coreContract}
                    >
                        {isGeneratingHash ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Generate Hash"
                        )}
                    </Button>

                    {generatedHash && (
                        <div className="space-y-4 md:col-span-2">
                            <div className="mt-4 p-4 rounded-md border border-border">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold">Generated Hash</h3>
                                    <button
                                        type="button"
                                        className="text-muted hover:text-foreground"
                                        onClick={() => copyToClipboard(generatedHash)}
                                        title="Copy to clipboard"
                                    >
                                        {hashCopied ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            <Copy className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <div className="font-mono text-sm break-all">
                                    {generatedHash.startsWith("Error") ? (
                                        <span className="text-destructive">{generatedHash}</span>
                                    ) : (
                                        <span className="text-primary">{generatedHash}</span>
                                    )}
                                </div>
                            </div>

                            {!generatedHash.startsWith("Error") && isWalletConnected && (
                                <Button
                                    className="w-full"
                                    onClick={() => signWithWallet(generatedHash)}
                                    disabled={isSigning}
                                >
                                    {isSigning ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Signing...
                                        </>
                                    ) : (
                                        "Sign with Wallet"
                                    )}
                                </Button>
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
                    )}
                </div>
            </CardContent>
        </Card>
    )
} 