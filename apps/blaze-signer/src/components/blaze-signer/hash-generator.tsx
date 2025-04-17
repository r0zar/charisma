"use client"

import React, { useState, ChangeEvent } from "react"
import { StacksNetwork } from "@stacks/network"
import { fetchCallReadOnlyFunction, stringAsciiCV, cvToHex, ClarityValue, principalCV, tupleCV, uintCV, cvToValue } from "@stacks/transactions"
import { Copy, Loader2, CheckCircle2 } from "@repo/ui/icons"
import { request } from "@stacks/connect"
import { QRCodeSVG } from 'qrcode.react'
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

                // Generate QR Code Data after successful signing
                const amount = parseAmountFromOpcode(opcode);
                if (amount) {
                    // Placeholder URLs - adjust as needed for your routing setup
                    const publicUrl = `/verify?uuid=${encodeURIComponent(hashUuid)}&contract=${encodeURIComponent(coreContract)}`;
                    const privateUrl = `/redeem?sig=${encodeURIComponent(data.signature)}&amount=${encodeURIComponent(amount)}&uuid=${encodeURIComponent(hashUuid)}`;
                    setPublicQrData(publicUrl);
                    setPrivateQrData(privateUrl);
                } else {
                    console.warn("Could not parse amount from opcode for QR code generation.");
                    // Optionally set an error state or message if amount parsing fails
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
        <div className={`card ${className || ''}`}>
            <div className="card-header">
                <h2 className="card-title">Generate SIP-018 Hash</h2>
                <p className="card-description">
                    Create the hash that needs to be signed off-chain using signer contract.
                </p>
            </div>
            <div className="card-content">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="core-contract" className="label">
                            Subnet Contract (principal)
                        </label>
                        <input
                            id="core-contract"
                            className="input"
                            placeholder="SP... (Contract allowed to call 'submit')"
                            value={coreContract}
                            onChange={handleInputChange(setCoreContract)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="opcode" className="label">
                            Opcode (string-ascii 64)
                        </label>
                        <input
                            id="opcode"
                            className="input"
                            placeholder="action=transfer;token=ST...;amount=100"
                            value={opcode}
                            onChange={handleInputChange(setOpcode)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="hash-uuid" className="label">
                            UUID (string-ascii 64)
                        </label>
                        <div className="flex space-x-2">
                            <input
                                id="hash-uuid"
                                className="input"
                                placeholder="Enter unique request ID"
                                value={hashUuid}
                                onChange={handleInputChange(setHashUuid)}
                            />
                            <button
                                type="button"
                                className="button"
                                onClick={handleGenerateUUID}
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    <button
                        className="button w-full"
                        onClick={generateStructuredDataHash}
                        disabled={isGeneratingHash || !opcode || !hashUuid || !coreContract}
                    >
                        {isGeneratingHash ? (
                            <>
                                <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Generate Hash"
                        )}
                    </button>

                    {generatedHash && (
                        <div className="space-y-4 md:col-span-2">
                            <div className="result-box">
                                <div className="result-box-header">
                                    <h3 className="result-box-title">Generated Hash</h3>
                                    <button
                                        type="button"
                                        className="button-icon"
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
                                <div className="result-box-content">
                                    {generatedHash.startsWith("Error") ? (
                                        <span className="text-destructive">{generatedHash}</span>
                                    ) : (
                                        <span className="text-primary">{generatedHash}</span>
                                    )}
                                </div>
                            </div>

                            {!generatedHash.startsWith("Error") && isWalletConnected && (
                                <button
                                    className="button w-full"
                                    onClick={() => signWithWallet(generatedHash)}
                                    disabled={isSigning}
                                >
                                    {isSigning ? (
                                        <>
                                            <Loader2 className="button-icon h-4 w-4 animate-spin" />
                                            Signing...
                                        </>
                                    ) : (
                                        "Sign with Wallet"
                                    )}
                                </button>
                            )}

                            {signature && (publicQrData || privateQrData) && (
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    marginTop: '1rem'
                                }}>
                                    {publicQrData && (
                                        <a
                                            href={publicQrData}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                                        >
                                            <div style={{
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '0.375rem',
                                                padding: '1rem',
                                                backgroundColor: '#f9fafb',
                                                flex: '1 1 0%',
                                                minWidth: '150px'
                                            }}>
                                                <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Public Verification QR</h3>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    padding: '1rem'
                                                }}>
                                                    {/* Use QRCodeSVG and ignore TS error */}
                                                    {/* @ts-ignore */}
                                                    <QRCodeSVG value={publicQrData} size={128} />
                                                </div>
                                                <p style={{
                                                    fontSize: '0.75rem',
                                                    lineHeight: '1rem',
                                                    color: '#6b7280',
                                                    textAlign: 'center',
                                                    marginTop: '0.5rem'
                                                }}>Scan to verify UUID status.</p>
                                            </div>
                                        </a>
                                    )}
                                    {privateQrData && (
                                        <a
                                            href={privateQrData}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                                        >
                                            <div style={{
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '0.375rem',
                                                padding: '1rem',
                                                backgroundColor: '#f9fafb',
                                                flex: '1 1 0%',
                                                minWidth: '150px'
                                            }}>
                                                <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Private Redeem QR</h3>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    padding: '1rem'
                                                }}>
                                                    {/* Use QRCodeSVG and ignore TS error */}
                                                    {/* @ts-ignore */}
                                                    <QRCodeSVG value={privateQrData} size={128} />
                                                </div>
                                                <p style={{
                                                    fontSize: '0.75rem',
                                                    lineHeight: '1rem',
                                                    color: '#6b7280',
                                                    textAlign: 'center',
                                                    marginTop: '0.5rem'
                                                }}>Scan to pre-fill redeem form.</p>
                                            </div>
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
} 