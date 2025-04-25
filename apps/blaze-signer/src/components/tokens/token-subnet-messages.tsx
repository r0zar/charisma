import React, { useState, useEffect } from "react"
import { type StacksNetwork } from "@stacks/network"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "../ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { request } from "@stacks/connect"
import {
    stringAsciiCV,
    tupleCV,
    uintCV,
    principalCV,
    optionalCVOf,
    noneCV,
    validateStacksAddress,
    fetchCallReadOnlyFunction,
    cvToHex,
    bufferCV,
    ClarityType,
    cvToValue,
    type ClarityValue,
    type TupleCV,
    type TupleData
} from "@stacks/transactions"
import { BLAZE_PROTOCOL_NAME, BLAZE_PROTOCOL_VERSION, BLAZE_SIGNER_CONTRACT } from "../../constants/contracts"
import { v4 as uuidv4 } from "uuid"
import { executeSignedMessage } from "@/lib/execute-service"
import { Loader2 } from "lucide-react"

interface TokenSubnetMessagesProps {
    network: StacksNetwork
    isWalletConnected: boolean
    walletAddress: string
    contractId: string // The actual contract being interacted with AND used for signing context
    className?: string
}

// Match the contract's intent strings exactly
type MessageType = "TRANSFER_TOKENS" | "TRANSFER_TOKENS_LTE" | "REDEEM_BEARER"

export function TokenSubnetMessages({
    network,
    isWalletConnected,
    walletAddress,
    contractId, // Use this for both API call and signing context
    className
}: TokenSubnetMessagesProps) {
    const [messageType, setMessageType] = useState<MessageType>("TRANSFER_TOKENS")
    const [amount, setAmount] = useState("")
    const [bound, setBound] = useState("")
    const [recipient, setRecipient] = useState("")
    const [generatedHash, setGeneratedHash] = useState("")
    const [signature, setSignature] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const [loading, setLoading] = useState(false) // For executeMessage
    const [uuid] = useState(() => uuidv4())
    const [messageDomainCV, setMessageDomainCV] = useState<ClarityValue | null>(null) // State for domain CV
    const [messageMessageCV, setMessageMessageCV] = useState<ClarityValue | null>(null) // State for message CV

    // Effect to clear states when inputs change
    useEffect(() => {
        setGeneratedHash("");
        setSignature("");
        setMessageDomainCV(null);
        setMessageMessageCV(null);
    }, [messageType, amount, bound, recipient]);

    const handleUintChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/[^0-9]/g, "")
        setter(value)
    }

    const generateHash = async () => {
        const contractAddress = contractId.split('.')[0]; // Extract address part

        // Prevent generation if wallet not connected or contract ADDRESS is invalid
        if (!isWalletConnected || !validateStacksAddress(contractAddress)) { // Validate address part
            setGeneratedHash("");
            setError("");
            setMessageDomainCV(null);
            setMessageMessageCV(null);
            return;
        }

        setError("");
        setSuccess("")
        setGeneratedHash("")
        setSignature("")
        setMessageDomainCV(null);
        setMessageMessageCV(null);

        try {
            // Re-validate the extracted address just in case
            if (!validateStacksAddress(contractAddress)) {
                throw new Error("Invalid Token Subnet Contract Address derived from contractId.")
            }

            const [signerContractAddress, signerContractName] = BLAZE_SIGNER_CONTRACT.split(".");
            if (!signerContractAddress || !signerContractName) {
                throw new Error("Invalid signer contract format in configuration");
            }

            const opcodeArg = noneCV();
            const amountArg = amount ? optionalCVOf(uintCV(parseInt(amount))) : noneCV();
            const boundArg = bound ? optionalCVOf(uintCV(parseInt(bound))) : noneCV();
            const targetArg = recipient ? optionalCVOf(principalCV(recipient)) : noneCV();

            const result: any = await fetchCallReadOnlyFunction({
                contractAddress: signerContractAddress,
                contractName: signerContractName,
                functionName: "hash",
                functionArgs: [
                    principalCV(contractId),
                    stringAsciiCV(messageType),
                    opcodeArg,
                    messageType === "TRANSFER_TOKENS_LTE" ? boundArg : amountArg,
                    targetArg,
                    stringAsciiCV(uuid)
                ],
                network,
                senderAddress: walletAddress || signerContractAddress,
            });

            if (result?.value?.value) {
                setGeneratedHash(result.value.value);

                // Also construct and store the CVs for the preview
                const domain = tupleCV({
                    name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                    version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                    "chain-id": uintCV(network.chainId),
                });
                const message = tupleCV({
                    contract: principalCV(contractId),
                    intent: stringAsciiCV(messageType),
                    opcode: noneCV(),
                    amount: messageType === "TRANSFER_TOKENS_LTE" ? boundArg : amountArg, // Use the *same* args as hash
                    target: targetArg,
                    uuid: stringAsciiCV(uuid),
                });
                setMessageDomainCV(domain);
                setMessageMessageCV(message);

            } else {
                const errorDetails = result ? JSON.stringify(cvToValue(result, true)) : 'Unknown error structure';
                throw new Error(`Failed to generate hash: ${errorDetails}`);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate hash")
            setGeneratedHash("")
            setMessageDomainCV(null);
            setMessageMessageCV(null);
        }
    }

    // Effect to automatically generate hash on relevant input changes
    useEffect(() => {
        const handler = setTimeout(() => {
            generateHash();
        }, 500);

        return () => {
            clearTimeout(handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messageType, amount, bound, recipient, contractId, isWalletConnected, walletAddress]);

    const signMessage = async () => {
        try {
            setError("")
            setSuccess("")

            const contractAddress = contractId.split('.')[0]; // Extract address part

            if (!generatedHash || generatedHash.startsWith("Error:")) {
                throw new Error("Please generate a valid hash first.")
            }
            // Validate the ADDRESS part of the contractId prop before signing
            if (!validateStacksAddress(contractAddress)) { // Validate address part
                throw new Error("Invalid Token Subnet Contract Address for signing.")
            }
            if (!messageDomainCV || !messageMessageCV) {
                console.error("Attempted to sign without generated CV data.");
                throw new Error("Cannot sign: structured data not prepared. Please check for hash generation errors.")
            }

            // Cast state variables to TupleCV before passing to request
            const data = await request("stx_signStructuredMessage", {
                domain: messageDomainCV as TupleCV<TupleData<ClarityValue>>,
                message: messageMessageCV as TupleCV<TupleData<ClarityValue>>,
            })

            if (data && data.signature) {
                setSignature(data.signature)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to sign message")
        }
    }

    const executeMessage = async () => {
        try {
            setError("")
            setSuccess("")
            setLoading(true)

            if (!signature) {
                throw new Error("Please sign the message first")
            }

            const params = {
                messageType,
                contractId, // Use the original contractId prop for the API call
                signature,
                uuid,
                ...(messageType === "TRANSFER_TOKENS" && {
                    amount: parseInt(amount),
                    recipient
                }),
                ...(messageType === "TRANSFER_TOKENS_LTE" && {
                    bound: parseInt(bound),
                    recipient
                }),
                ...(messageType === "REDEEM_BEARER" && {
                    amount: parseInt(amount),
                    recipient // API expects recipient even if default is contractAddress
                })
            }

            const result = await executeSignedMessage(params)

            if (result.success && result.txid) {
                setSuccess(`Transaction broadcasted successfully! TXID: ${result.txid}`)
            } else {
                setError(result.message || "Failed to execute transaction")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to execute transaction")
        } finally {
            setLoading(false)
        }
    }

    if (!isWalletConnected) {
        return (
            <Card className={cn(className)}>
                <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">
                        Please connect your wallet to generate and sign messages
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Token Subnet Messages</CardTitle>
                <CardDescription>Generate and sign messages for token subnet operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Message Type</Label>
                        <div className="flex gap-2">
                            <Button
                                variant={messageType === "TRANSFER_TOKENS" ? "default" : "outline"}
                                onClick={() => setMessageType("TRANSFER_TOKENS")}
                            >
                                Exact Transfer
                            </Button>
                            <Button
                                variant={messageType === "TRANSFER_TOKENS_LTE" ? "default" : "outline"}
                                onClick={() => setMessageType("TRANSFER_TOKENS_LTE")}
                            >
                                Bounded Transfer
                            </Button>
                            <Button
                                variant={messageType === "REDEEM_BEARER" ? "default" : "outline"}
                                onClick={() => setMessageType("REDEEM_BEARER")}
                            >
                                Bearer Redeem
                            </Button>
                        </div>
                    </div>

                    {(messageType === "TRANSFER_TOKENS" || messageType === "TRANSFER_TOKENS_LTE") && (
                        <div className="space-y-2">
                            <Label htmlFor="recipient">Recipient</Label>
                            <Input
                                id="recipient"
                                placeholder="Enter recipient address"
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                            />
                        </div>
                    )}

                    {messageType === "TRANSFER_TOKENS" && (
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input
                                id="amount"
                                placeholder="Enter exact amount"
                                value={amount}
                                onChange={handleUintChange(setAmount)}
                            />
                        </div>
                    )}

                    {messageType === "TRANSFER_TOKENS_LTE" && (
                        <div className="space-y-2">
                            <Label htmlFor="bound">Upper Bound</Label>
                            <Input
                                id="bound"
                                placeholder="Enter maximum amount"
                                value={bound}
                                onChange={handleUintChange(setBound)}
                            />
                        </div>
                    )}

                    {messageType === "REDEEM_BEARER" && (
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input
                                id="amount"
                                placeholder="Enter amount to redeem"
                                value={amount}
                                onChange={handleUintChange(setAmount)}
                            />
                        </div>
                    )}
                </div>

                <div className="flex gap-4">
                    <Button
                        onClick={signMessage}
                        disabled={!generatedHash || generatedHash.startsWith("Error:") || !validateStacksAddress(contractId.split('.')[0])}
                    >
                        Sign Message
                    </Button>
                    <Button
                        onClick={executeMessage}
                        disabled={!signature || loading}
                        variant="default"
                    >
                        {loading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /><span className="ml-2">Processing...</span></>
                        ) : (
                            "Execute On-chain"
                        )}
                    </Button>
                </div>

                {/* Accordion for Signed Data Preview */}
                {generatedHash && !generatedHash.startsWith("Error:") && messageDomainCV && messageMessageCV && (
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Show Signed Data Structure</AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Domain (SIP-018)</Label>
                                        <pre className="mt-1 break-all rounded-md bg-muted p-3 text-xs font-mono">
                                            {JSON.stringify(cvToValue(messageDomainCV, true), null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground">Message (SIP-018)</Label>
                                        <pre className="mt-1 break-all rounded-md bg-muted p-3 text-xs font-mono">
                                            {JSON.stringify(cvToValue(messageMessageCV, true), null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert variant="default" className="bg-green-50 border-green-200">
                        <AlertDescription className="text-green-800">{success}</AlertDescription>
                    </Alert>
                )}

                {generatedHash && !generatedHash.startsWith("Error:") && (
                    <div className="space-y-2">
                        <Label>Generated SIP-018 Hash</Label>
                        <div className="break-all rounded-md bg-muted p-4 font-mono text-sm">
                            {generatedHash}
                        </div>
                    </div>
                )}

                {signature && (
                    <div className="space-y-2">
                        <Label>Signature</Label>
                        <div className="break-all rounded-md bg-muted p-4 font-mono text-sm">
                            {signature}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
} 